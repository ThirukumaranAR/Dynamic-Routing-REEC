const assert = require('node:assert/strict');

async function testLiveApi() {
  const baseUrl = 'http://127.0.0.1:5000';

  // 1. Login as CEO to inspect general workflow
  console.log('1. Logging in as CEO...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@gmail.com', password: 'pass123' })
  });
  assert.equal(loginRes.status, 200, 'CEO login should succeed');
  const cookie = loginRes.headers.get('set-cookie');
  assert.ok(cookie, 'Cookie should be present');

  // 2. Fetch general workflow
  console.log('2. Fetching active general workflow...');
  const gwRes = await fetch(`${baseUrl}/api/admin/general-workflow`, {
    headers: { Cookie: cookie }
  });
  assert.equal(gwRes.status, 200, 'GET /general-workflow should succeed');
  const gwJson = await gwRes.json();
  assert.ok(gwJson.generalWorkflow, 'generalWorkflow should be present');
  console.log(`Active general workflow version: v${gwJson.generalWorkflow.version}`);
  console.log('Stages:', gwJson.generalWorkflow.stages.map(s => `${s.stageOrder}. ${s.role} (applicable: ${s.isApplicable})`).join(' -> '));

  // Verify all 8 core stages are applicable and in exact sequence
  const expectedRoles = ['INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN', 'CEO', 'CHAIRMAN'];
  const actualRoles = gwJson.generalWorkflow.stages.map(s => s.role);
  assert.deepEqual(actualRoles, expectedRoles, 'Workflow stages must exactly match standard sequence');
  gwJson.generalWorkflow.stages.forEach(s => {
    assert.equal(s.isApplicable, true, `Stage ${s.role} must be applicable`);
  });

  // 3. Login as Requester and create a request (e.g. Leave request)
  console.log('3. Logging in as Requester (requester@gmail.com)...');
  const reqLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'requester@gmail.com', password: 'pass123' })
  });
  assert.equal(reqLoginRes.status, 200);
  const reqCookie = reqLoginRes.headers.get('set-cookie');

  console.log('4. Creating Leave request...');
  const createRes = await fetch(`${baseUrl}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: reqCookie },
    body: JSON.stringify({
      title: 'Medical Leave Clearance Verification',
      amount: 0,
      category: 'Leave',
      description: 'Medical leave request with institutional approval sequence'
    })
  });
  assert.equal(createRes.status, 201, 'Request creation should return 201');
  const createdJson = await createRes.json();
  const created = createdJson.request;
  console.log(`Created request #${created.id}`);
  console.log('Initial stage:', created.currentStage);
  assert.equal(created.currentStage, 'INSTITUTION_MANAGER', 'Initial stage must be INSTITUTION_MANAGER');

  // Verify full stage sequence for this request
  console.log('Request stages:');
  created.stages.forEach(s => console.log(` - Step ${s.stageIndex + 1}: ${s.role} (${s.status}, applicable: ${s.isApplicable})`));

  const stagesSequence = created.stages.map(s => s.role);
  const expectedSequenceWithBranch = [
    'INSTITUTION_MANAGER',
    'FINANCE',
    'ACCOUNTANT',
    'VP',
    'HOI',
    'DEAN',
    'HR',
    'CEO',
    'CHAIRMAN'
  ];
  assert.deepEqual(stagesSequence, expectedSequenceWithBranch, 'Request must instantiate exact institutional sequence with selected branch');

  created.stages.forEach(s => {
    assert.equal(s.isApplicable, true, `Stage ${s.role} must be applicable`);
  });
  assert.equal(created.stages[0].status, 'PENDING');
  for (let i = 1; i < created.stages.length; i++) {
    assert.equal(created.stages[i].status, 'FUTURE');
  }

  // 5. Create an Equipment request to verify IT branch alternative
  console.log('5. Creating Equipment request (testing IT branch alternative)...');
  const createEqRes = await fetch(`${baseUrl}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: reqCookie },
    body: JSON.stringify({
      title: 'Workstation GPU Setup',
      amount: 120000,
      category: 'Equipment',
      description: 'High performance GPU workstation for AI research lab'
    })
  });
  assert.equal(createEqRes.status, 201);
  const eqJson = await createEqRes.json();
  const eqCreated = eqJson.request;
  const eqSequence = eqCreated.stages.map(s => s.role);
  assert.deepEqual(eqSequence, [
    'INSTITUTION_MANAGER',
    'FINANCE',
    'ACCOUNTANT',
    'VP',
    'HOI',
    'DEAN',
    'IT',
    'CEO',
    'CHAIRMAN'
  ], 'Equipment request must have IT as the alternative branch');

  console.log('✓ All live API assertions passed successfully!');
}

testLiveApi().catch(err => {
  console.error('Live API assertion failed:', err);
  process.exit(1);
});
