const assert = require('node:assert/strict');
const test = require('node:test');

const base = 'http://127.0.0.1:5000/api';
const defaultPassword = 'pass123';
const frontendOrigin = 'http://localhost:3000';

const login = async (email, password = defaultPassword) => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: frontendOrigin
    },
    body: JSON.stringify({ email, password })
  });
  assert.equal(res.status, 200, `Login failed for ${email}: ${await res.text()}`);
  const cookieHeader = res.headers.get('set-cookie');
  assert.ok(cookieHeader, `Expected set-cookie header for ${email}`);
  return cookieHeader.split(';', 1)[0];
};

const apiCall = (cookie, endpoint, method = 'GET', data = undefined) => fetch(`${base}${endpoint}`, {
  method,
  headers: {
    cookie: cookie || '',
    origin: frontendOrigin,
    ...(data !== undefined ? { 'content-type': 'application/json' } : {})
  },
  ...(data !== undefined ? { body: JSON.stringify(data) } : {})
});

test('FlowNexus Five Independent Workflows, Dynamic Routing, and Optional Cost Test Suite', { timeout: 120000 }, async (t) => {
  // 1. Authenticate users
  const ceoCookie = await login('ceo@gmail.com');
  const chairmanCookie = await login('chairman@gmail.com');
  const requesterCookie = await login('requester@gmail.com');
  const imCookie = await login('manager@gmail.com');
  const financeCookie = await login('finance@gmail.com');
  const accountantCookie = await login('accountant@gmail.com');
  const vpCookie = await login('vp@gmail.com');
  const hoiCookie = await login('hoi@gmail.com');
  const deanCookie = await login('dean@gmail.com');
  const itCookie = await login('it@gmail.com');
  const auditCookie = await login('audit@gmail.com');
  const hrCookie = await login('hr@gmail.com');
  const mmiCookie = await login('mmi@gmail.com');

  console.log('✓ All 13 system roles authenticated successfully');

  // Test 1: List all 5 workflow configurations
  await t.test('1. Admin can list all 5 workflow configurations independently', async () => {
    const res = await apiCall(ceoCookie, '/admin/workflow-configs');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.workflows));
    assert.equal(body.workflows.length, 5);

    const ids = body.workflows.map(w => w.id);
    assert.ok(ids.includes('workflow-general'), 'workflow-general must exist');
    assert.ok(ids.includes('workflow-hr'), 'workflow-hr must exist');
    assert.ok(ids.includes('workflow-it'), 'workflow-it must exist');
    assert.ok(ids.includes('workflow-audit'), 'workflow-audit must exist');
    assert.ok(ids.includes('workflow-mmi'), 'workflow-mmi must exist');
  });

  // Test 2: Get specific workflow config and test draft isolation
  await t.test('2. Workflow draft saving is completely isolated per workflow', async () => {
    // Get current IT workflow
    const itRes = await apiCall(ceoCookie, '/admin/workflow-configs/workflow-it');
    assert.equal(itRes.status, 200);
    const itBody = await resJson(itRes);
    assert.equal(itBody.workflow.id, 'workflow-it');

    // Save a draft for IT workflow with an extra note
    const customStages = itBody.workflow.stages.map(s => ({ ...s, notes: 'Draft custom stage' }));
    const draftRes = await apiCall(ceoCookie, '/admin/workflow-configs/workflow-it/draft', 'POST', {
      stages: customStages
    });
    assert.equal(draftRes.status, 200);

    // Verify IT workflow now has draft
    const itDraftCheck = await apiCall(ceoCookie, '/admin/workflow-configs/workflow-it');
    const itDraftBody = await resJson(itDraftCheck);
    assert.ok(itDraftBody.workflow.draftStages);
    assert.equal(itDraftBody.workflow.draftStages.length, customStages.length);

    // Verify HR workflow does NOT have a draft
    const hrCheck = await apiCall(ceoCookie, '/admin/workflow-configs/workflow-hr');
    const hrBody = await resJson(hrCheck);
    assert.equal(hrBody.workflow.draftStages, null, 'HR workflow draft must remain null');

    // Reset IT workflow draft
    const resetRes = await apiCall(ceoCookie, '/admin/workflow-configs/workflow-it/reset-default', 'POST');
    assert.equal(resetRes.status, 200);

    const itResetCheck = await apiCall(ceoCookie, '/admin/workflow-configs/workflow-it');
    const itResetBody = await resJson(itResetCheck);
    assert.equal(itResetBody.workflow.draftStages, null, 'IT workflow draft cleared after reset');
  });

  // Test 3: Create IT Request with NULL Cost
  let itRequestId = '';
  await t.test('3. Create IT Request with optional (null) cost and verify dynamic routing sequence', async () => {
    const res = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Lab Server Upgrade',
      requestType: 'IT Request',
      // amount is completely omitted
      description: 'Upgrade RAM and storage on AI lab servers'
    });
    assert.equal(res.status, 201);
    const body = await resJson(res);
    assert.equal(body.success, true);
    const req = body.request;
    itRequestId = req.id;

    assert.equal(req.requestType, 'IT Request');
    assert.equal(req.amount, null, 'Cost must be null when omitted');
    assert.equal(req.selectedBranch, 'IT');
    assert.equal(req.currentStage, 'INSTITUTION_MANAGER');

    // Verify stages: IM -> FINANCE -> ACCOUNTANT -> VP -> HOI -> DEAN -> IT -> CEO -> CHAIRMAN
    const roles = req.stages.map(s => s.role);
    console.log('IT Request stages:', roles);
    assert.deepEqual(roles, [
      'INSTITUTION_MANAGER',
      'FINANCE',
      'ACCOUNTANT',
      'VP',
      'HOI',
      'DEAN',
      'IT',
      'CEO',
      'CHAIRMAN'
    ]);

    // Ensure phantom branches (HR, AUDIT, MMI) are NOT present in stages
    assert.ok(!roles.includes('HR'), 'HR branch must not be in IT request stages');
    assert.ok(!roles.includes('AUDIT'), 'AUDIT branch must not be in IT request stages');
    assert.ok(!roles.includes('MMI'), 'MMI branch must not be in IT request stages');
    assert.equal(roles[roles.length - 1], 'CHAIRMAN', 'Chairman must be terminal stage');
  });

  // Test 4: Create Audit Request with valid amount
  await t.test('4. Create Audit Request with specified cost and verify Audit branch', async () => {
    const res = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Annual Statutory Audit FY26',
      requestType: 'Audit Request',
      amount: 45000,
      description: 'Statutory compliance ledger review'
    });
    assert.equal(res.status, 201);
    const req = (await resJson(res)).request;
    assert.equal(req.requestType, 'Audit Request');
    assert.equal(req.amount, 45000);
    assert.equal(req.selectedBranch, 'AUDIT');

    const roles = req.stages.map(s => s.role);
    assert.deepEqual(roles, [
      'INSTITUTION_MANAGER',
      'FINANCE',
      'ACCOUNTANT',
      'VP',
      'HOI',
      'DEAN',
      'AUDIT',
      'CEO',
      'CHAIRMAN'
    ]);
  });

  // Test 5: Create HR Request with valid amount
  await t.test('5. Create HR Request and verify HR branch routing', async () => {
    const res = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Faculty Recruitment Notification',
      requestType: 'HR Request',
      description: 'Sanctioned faculty vacancy advertisement'
    });
    assert.equal(res.status, 201);
    const req = (await resJson(res)).request;
    assert.equal(req.requestType, 'HR Request');
    assert.equal(req.selectedBranch, 'HR');

    const roles = req.stages.map(s => s.role);
    assert.deepEqual(roles, [
      'INSTITUTION_MANAGER',
      'FINANCE',
      'ACCOUNTANT',
      'VP',
      'HOI',
      'DEAN',
      'HR',
      'CEO',
      'CHAIRMAN'
    ]);
  });

  // Test 6: Create MMI Request and verify MMI branch routing
  await t.test('6. Create MMI Request and verify MMI branch routing', async () => {
    const res = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Bio-Medical Equipment Maintenance',
      requestType: 'MMI Request',
      amount: 120000,
      description: 'Annual servicing agreement for clinical analyzer'
    });
    assert.equal(res.status, 201);
    const req = (await resJson(res)).request;
    assert.equal(req.requestType, 'MMI Request');
    assert.equal(req.selectedBranch, 'MMI');

    const roles = req.stages.map(s => s.role);
    assert.deepEqual(roles, [
      'INSTITUTION_MANAGER',
      'FINANCE',
      'ACCOUNTANT',
      'VP',
      'HOI',
      'DEAN',
      'MMI',
      'CEO',
      'CHAIRMAN'
    ]);
  });

  // Test 7: Full multi-tier approval execution for the IT Request with NULL cost
  await t.test('7. End-to-end multi-tier approval execution for IT Request with null cost', async () => {
    // 1. Institution Manager approves
    let approveRes = await apiCall(imCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    let req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'FINANCE');

    // 2. Finance approves (even with amount: null!)
    approveRes = await apiCall(financeCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'ACCOUNTANT');

    // 3. Accountant approves
    approveRes = await apiCall(accountantCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'VP');

    // 4. VP approves
    approveRes = await apiCall(vpCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'HOI');

    // 5. HOI approves
    approveRes = await apiCall(hoiCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'DEAN');

    // 6. Dean approves -> advances directly to IT branch!
    approveRes = await apiCall(deanCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'IT', 'Dean approval must advance directly to IT branch');

    // 7. IT Branch approves -> advances to CEO!
    approveRes = await apiCall(itCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'CEO');

    // 8. CEO approves -> advances to Chairman!
    approveRes = await apiCall(ceoCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.currentStage, 'CHAIRMAN');

    // 9. Chairman approves -> Request APPROVED!
    approveRes = await apiCall(chairmanCookie, `/requests/${itRequestId}/approve`, 'POST');
    assert.equal(approveRes.status, 200);
    req = (await resJson(approveRes)).request;
    assert.equal(req.status, 'APPROVED', 'Terminal approval by Chairman must mark request APPROVED');
  });

  // Test 8: Cost validation
  await t.test('8. Rejects invalid negative cost', async () => {
    const res = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Invalid Request',
      requestType: 'IT Request',
      amount: -500,
      description: 'Testing negative amount'
    });
    assert.equal(res.status, 400);
    const body = await resJson(res);
    assert.equal(body.success, false);
  });
});

async function resJson(res) {
  return JSON.parse(await res.text());
}
