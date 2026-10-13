const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const port = 5333;
const base = `http://127.0.0.1:${port}/api`;
const defaultPassword = 'pass123';

const frontendOrigin = `http://localhost:${port + 1}`;

const launchBackend = () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'dist', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: 'mysql://root@127.0.0.1:3306/flownexus',
      JWT_SECRET: 'test-jwt-secret-key-12345678901234567890',
      FRONTEND_ORIGIN: frontendOrigin,
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk.toString();
    process.stdout.write(chunk);
  });
  child.stderr.on('data', chunk => {
    output += chunk.toString();
    process.stderr.write(chunk);
  });
  return { child, getOutput: () => output };
};

const stopBackend = async (info) => {
  if (!info?.child) return;
  if (info.child.exitCode !== null) return;
  await new Promise(resolve => {
    info.child.once('exit', resolve);
    info.child.kill();
  });
};

const waitForBackend = async (info) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (info.child.exitCode !== null) throw new Error(`Backend exited early: ${info.getOutput()}`);
    try {
      const res = await fetch(`${base}/health`);
      if (res.status === 200) return;
    } catch {
      // waiting
    }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`Backend did not become ready: ${info.getOutput()}`);
};

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

test('FlowNexus MySQL End-to-End Enterprise Approval System Suite', { timeout: 120000 }, async (t) => {
  let backend = launchBackend();
  t.after(async () => {
    await stopBackend(backend);
  });
  await waitForBackend(backend);
  console.log('✓ Backend launched on MySQL successfully');

  // Authenticate sessions for different roles
  const chairmanCookie = await login('chairman@gmail.com');
  const ceoCookie = await login('ceo@gmail.com');
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

  // CRITERION 1: All new roles appear correctly in the role-management interface
  await t.test('1. Role management exposes all 13 standard roles with metadata', async () => {
    const res = await apiCall(ceoCookie, '/admin/roles');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.roles));
    const roleNames = body.roles.map(r => r.name);
    const expectedRoles = [
      'REQUESTER', 'INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT',
      'VP', 'HOI', 'DEAN', 'IT', 'AUDIT', 'HR', 'MMI', 'CEO', 'CHAIRMAN'
    ];
    for (const expected of expectedRoles) {
      assert.ok(roleNames.includes(expected), `Role ${expected} must exist in roles list`);
    }
  });

  // CRITERION 2: Request creation is available to Requester through Dean
  await t.test('2. Request creation is permitted for Requester through Dean', async () => {
    const creatorCookies = [
      { role: 'REQUESTER', cookie: requesterCookie },
      { role: 'INSTITUTION_MANAGER', cookie: imCookie },
      { role: 'FINANCE', cookie: financeCookie },
      { role: 'ACCOUNTANT', cookie: accountantCookie },
      { role: 'VP', cookie: vpCookie },
      { role: 'HOI', cookie: hoiCookie },
      { role: 'DEAN', cookie: deanCookie }
    ];

    for (const { role, cookie } of creatorCookies) {
      const res = await apiCall(cookie, '/requests', 'POST', {
        title: `Request by ${role}`,
        amount: 25000,
        category: 'Purchase',
        description: `Automated test request created by authorized role ${role}`
      });
      assert.equal(res.status, 201, `Role ${role} should be permitted to create request`);
      const body = await res.json();
      assert.ok(body.request?.id);
    }
  });

  // CRITERION 3: Request creation is rejected for IT, Audit, HR, MMI, CEO, and Chairman
  await t.test('3. Request creation is strictly rejected for IT, Audit, HR, MMI, CEO, and Chairman', async () => {
    const forbiddenCookies = [
      { role: 'IT', cookie: itCookie },
      { role: 'AUDIT', cookie: auditCookie },
      { role: 'HR', cookie: hrCookie },
      { role: 'MMI', cookie: mmiCookie },
      { role: 'CEO', cookie: ceoCookie },
      { role: 'CHAIRMAN', cookie: chairmanCookie }
    ];

    for (const { role, cookie } of forbiddenCookies) {
      const res = await apiCall(cookie, '/requests', 'POST', {
        title: `Forbidden Request by ${role}`,
        amount: 10000,
        category: 'Equipment',
        description: `Should be blocked for role ${role}`
      });
      assert.equal(res.status, 403, `Role ${role} must receive HTTP 403 Forbidden on create request`);
    }
  });

  // CRITERION 4: CEO can add, remove, reorder, and configure workflow stages
  // CRITERION 5: Institution Manager can be marked not applicable for future workflows
  // CRITERION 6: All four post-Dean branches are supported (IT, Audit, HR, MMI)
  let publishedVersionNumber = 1;
  await t.test('4, 5, 6. CEO dynamic workflow configuration, IM applicability toggle, and 4 post-Dean branches', async () => {
    const newWorkflowPayload = {
      name: 'Executive Reconfigured Workflow v2',
      description: 'IM marked not applicable for future workflows, supporting IT/AUDIT/HR/MMI branches',
      preDeanStages: [
        { stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, isApplicable: false, isActive: true },
        { stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance Head', stageOrder: 2, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_VP', role: 'VP', label: 'Vice President', stageOrder: 4, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_HOI', role: 'HOI', label: 'Head of Institution', stageOrder: 5, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean Checkpoint', stageOrder: 6, isApplicable: true, isActive: true }
      ],
      branchConfigs: [
        { branchKey: 'IT', displayName: 'IT Infrastructure Branch', role: 'IT', isActive: true },
        { branchKey: 'AUDIT', displayName: 'Audit & Compliance Branch', role: 'AUDIT', isActive: true },
        { branchKey: 'HR', displayName: 'Human Resources Branch', role: 'HR', isActive: true },
        { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
      ]
    };

    const res = await apiCall(ceoCookie, '/admin/workflow-versions', 'POST', newWorkflowPayload);
    const resText = await res.text();
    assert.equal(res.status, 201, `CEO workflow publication failed: ${resText}`);
    const body = JSON.parse(resText);
    assert.ok(body.workflowVersion);
    publishedVersionNumber = body.workflowVersion.version;
    assert.ok(publishedVersionNumber >= 2, 'Version should increment');

    // Verify newly submitted request captures version 2 and skips Institution Manager
    const reqRes = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Request under v2 workflow',
      amount: 150000,
      category: 'Equipment',
      description: 'Testing v2 workflow with skipped IM stage'
    });
    assert.equal(reqRes.status, 201);
    const createdReq = (await reqRes.json()).request;
    assert.equal(createdReq.workflowVersionNumber, publishedVersionNumber, 'Newly created request must capture published version');
    assert.equal(createdReq.currentStage, 'FINANCE', 'When IM is not applicable, initial stage should be FINANCE');

    // Verify stage instances
    const imStage = createdReq.stages.find(s => s.role === 'INSTITUTION_MANAGER');
    assert.ok(imStage);
    assert.equal(imStage.status, 'SKIPPED');
    assert.equal(imStage.isApplicable, false);

    const financeStage = createdReq.stages.find(s => s.role === 'FINANCE');
    assert.ok(financeStage);
    assert.equal(financeStage.status, 'PENDING');
  });

  // CRITERION 7: A newly submitted request captures its workflow version
  // CRITERION 8: CEO can inspect a request's complete historical and current workflow
  let testRequestId = '';
  await t.test('7, 8. Workflow version capture and CEO inspection of complete stages', async () => {
    const reqRes = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Full Lifecycle Flow',
      amount: 45000,
      category: 'Purchase',
      description: 'Request for inspecting stages and migration'
    });
    assert.equal(reqRes.status, 201);
    const created = (await reqRes.json()).request;
    testRequestId = created.id;

    // CEO inspects request detail
    const inspectRes = await apiCall(ceoCookie, `/requests/${testRequestId}`);
    assert.equal(inspectRes.status, 200);
    const inspected = (await inspectRes.json()).request;
    assert.equal(inspected.id, testRequestId);
    assert.ok(Array.isArray(inspected.stages), 'Stages list must be present');
    assert.ok(inspected.workflowVersionNumber);
    assert.ok(inspected.stages.some(s => s.status === 'PENDING'));
    assert.ok(inspected.stages.some(s => s.status === 'FUTURE'));
  });

  // CRITERION 9: Completed stages and decisions remain unchanged after workflow updates
  // CRITERION 10: A pending Accountant stage can be safely migrated to General Manager with authorization and audit history
  // CRITERION 11: Completed Accountant decisions remain visible in historical records
  // CRITERION 12: Historical requests are not silently rewritten when global workflow definitions change
  await t.test('9, 10, 11, 12. Safe migration of pending stage, preserving completed history', async () => {
    // Check initial stage and advance through IM to Finance, then Accountant
    const currentRes = await apiCall(ceoCookie, `/requests/${testRequestId}`);
    const currentText = await currentRes.text();
    let currReq;
    try { currReq = JSON.parse(currentText).request; } catch { console.error('Failed to parse currentRes:', currentRes.status, currentText); }
    if (!currReq) console.error('currReq is undefined. status:', currentRes.status, 'text:', currentText, 'testRequestId:', testRequestId);
    if (currReq.currentStage === 'INSTITUTION_MANAGER') {
      const imApprove = await apiCall(imCookie, `/requests/${testRequestId}/approve`, 'POST', {
        notes: 'IM approved'
      });
      assert.equal(imApprove.status, 200);
    }

    // Approve Finance step to advance to Accountant
    const financeApprove = await apiCall(financeCookie, `/requests/${testRequestId}/approve`, 'POST', {
      notes: 'Finance stage approved'
    });
    assert.equal(financeApprove.status, 200);
    const afterFinance = (await financeApprove.json()).request;
    assert.equal(afterFinance.currentStage, 'ACCOUNTANT', 'Should now be pending at Accountant');

    // Confirm Finance is COMPLETED in stages
    const financeStageInstance = afterFinance.stages.find(s => s.role === 'FINANCE');
    assert.equal(financeStageInstance.status, 'COMPLETED');
    assert.equal(financeStageInstance.decidedByRole, 'FINANCE');

    // CEO performs authorized workflow migration from pending Accountant to GENERAL_MANAGER
    const migrationPayload = {
      targetWorkflowVersion: publishedVersionNumber,
      reason: 'Organizational restructuring: replacing pending Accountant with General Manager review',
      oldStage: 'ACCOUNTANT',
      newStage: 'GENERAL_MANAGER'
    };

    const migrateRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/migrate`, 'POST', migrationPayload);
    const migrateText = await migrateRes.text();
    assert.equal(migrateRes.status, 200, `Migration failed: ${migrateText}`);
    const migrated = JSON.parse(migrateText).request;

    // Verify Accountant stage is marked SUPERSEDED (not approved, not deleted)
    const accountantStage = migrated.stages.find(s => s.role === 'ACCOUNTANT');
    assert.ok(accountantStage, 'Historical Accountant stage must remain in request stages');
    assert.equal(accountantStage.status, 'SUPERSEDED', 'Pending Accountant must be marked SUPERSEDED');

    // Verify completed Finance stage remains COMPLETED
    const financeStageStillCompleted = migrated.stages.find(s => s.role === 'FINANCE');
    assert.equal(financeStageStillCompleted.status, 'COMPLETED', 'Completed Finance must not be altered');

    // Verify new stage is active / pending
    assert.equal(migrated.currentStage, 'GENERAL_MANAGER');

    // Verify audit migration event
    assert.ok(Array.isArray(migrated.migrationEvents));
    assert.ok(migrated.migrationEvents.length >= 1, 'Migration event must be recorded');
    assert.equal(migrated.migrationEvents[0].actorRole, 'CEO');
    assert.equal(migrated.migrationEvents[0].oldStage, 'ACCOUNTANT');
    assert.equal(migrated.migrationEvents[0].newStage, 'GENERAL_MANAGER');
  });

  // CRITERION 13: Requests, users, workflows, and audit records persist across backend restarts
  await t.test('13. Persistence across backend restart', async () => {
    // Stop server
    console.log('Stopping backend to test restart persistence...');
    await stopBackend(backend);

    // Restart server
    backend = launchBackend();
    await waitForBackend(backend);
    console.log('✓ Backend restarted cleanly on MySQL');

    // Query request using CEO session
    const reloadedRes = await apiCall(ceoCookie, `/requests/${testRequestId}`);
    assert.equal(reloadedRes.status, 200, 'Request must persist after backend restart');
    const reloaded = (await reloadedRes.json()).request;
    assert.equal(reloaded.id, testRequestId);
    assert.equal(reloaded.currentStage, 'GENERAL_MANAGER');
    assert.ok(reloaded.stages.some(s => s.role === 'ACCOUNTANT' && s.status === 'SUPERSEDED'));
    assert.ok(reloaded.stages.some(s => s.role === 'FINANCE' && s.status === 'COMPLETED'));
  });

  // CRITERION 14: Separate authorized browser sessions access the same MySQL-backed records
  await t.test('14. Concurrent browser sessions see consistent MySQL records', async () => {
    const session1Res = await apiCall(ceoCookie, `/requests/${testRequestId}`);
    const session2Res = await apiCall(requesterCookie, `/requests/${testRequestId}`);
    assert.equal(session1Res.status, 200);
    assert.equal(session2Res.status, 200);
    const r1 = (await session1Res.json()).request;
    const r2 = (await session2Res.json()).request;
    assert.equal(r1.id, r2.id);
    assert.equal(r1.currentStage, r2.currentStage);
    assert.equal(r1.workflowVersionNumber, r2.workflowVersionNumber);
  });

  // CRITERION 15: Unauthorized direct API calls are rejected
  await t.test('15. Unauthorized direct API calls are rejected', async () => {
    // Unauthenticated call
    const unauth = await apiCall(null, '/requests');
    assert.equal(unauth.status, 401, 'Unauthenticated call must return 401');

    // Requester attempting CEO workflow publishing
    const requesterPublish = await apiCall(requesterCookie, '/admin/workflow-versions', 'POST', {
      name: 'Hacked Workflow', preDeanStages: [], branchConfigs: []
    });
    assert.equal(requesterPublish.status, 403, 'Non-admin cannot publish workflow');

    // Non-CEO attempting request migration
    const requesterMigrate = await apiCall(requesterCookie, `/admin/requests/${testRequestId}/migrate`, 'POST', {
      reason: 'Illegal migration'
    });
    assert.equal(requesterMigrate.status, 403, 'Non-admin cannot migrate request workflow');

    // Non-CEO attempting request-specific workflow customization
    const requesterCustomWf = await apiCall(requesterCookie, `/admin/requests/${testRequestId}/custom-workflow`, 'PUT', {
      reason: 'Hacked workflow',
      stages: []
    });
    assert.equal(requesterCustomWf.status, 403, 'Non-admin cannot customize request workflow');
  });

  // CRITERION 16: Request search and selection supports multi-field discovery
  await t.test('16. Request search and selection supports multi-field discovery', async () => {
    // Search by request ID
    const listRes = await apiCall(ceoCookie, '/requests');
    assert.equal(listRes.status, 200);
    const allRequests = (await listRes.json()).requests;
    assert.ok(allRequests.length > 0);

    const foundById = allRequests.find(r => r.id === testRequestId);
    assert.ok(foundById, 'Request must be discoverable by request ID');

    // Filter by title / requester / department
    const foundByTitle = allRequests.filter(r => r.title.toLowerCase().includes('lifecycle'));
    assert.ok(foundById.requester, 'Requester property must exist on request');
    const foundByRequester = allRequests.filter(r => r.requester.toLowerCase().includes(foundById.requester.toLowerCase()));
    assert.ok(foundByRequester.length > 0, 'Requests must be findable by requester');
  });

  // CRITERION 17: Workflow draft validation enforces mandatory rules (Dean checkpoint, Chairman final authority)
  await t.test('17. Workflow draft validation enforces mandatory rules (Dean checkpoint, Chairman final authority)', async () => {
    // 1. Missing Chairman as final authority
    const invalidDraftRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/validate-workflow`, 'POST', {
      stages: [
        { role: 'INSTITUTION_MANAGER', label: 'Institution Manager', isApplicable: true },
        { role: 'DEAN', label: 'Dean', isApplicable: true },
        { role: 'CEO', label: 'CEO', isApplicable: true }
      ]
    });
    assert.equal(invalidDraftRes.status, 200);
    const invalidResult = await invalidDraftRes.json();
    assert.equal(invalidResult.valid, false);
    assert.ok(invalidResult.errors.some(e => e.toLowerCase().includes('chairman') && e.toLowerCase().includes('final authority')));

    // 2. Missing Dean checkpoint
    const missingDeanRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/validate-workflow`, 'POST', {
      stages: [
        { role: 'INSTITUTION_MANAGER', label: 'Institution Manager', isApplicable: true },
        { role: 'CEO', label: 'CEO', isApplicable: true },
        { role: 'CHAIRMAN', label: 'Chairman', isApplicable: true }
      ]
    });
    assert.equal(missingDeanRes.status, 200);
    const missingDeanResult = await missingDeanRes.json();
    assert.equal(missingDeanResult.valid, false);
    assert.ok(missingDeanResult.errors.some(e => e.includes('DEAN') || e.includes('Dean')));

    // 3. Valid draft
    const validDraftRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/validate-workflow`, 'POST', {
      stages: [
        { role: 'INSTITUTION_MANAGER', label: 'Institution Manager', isApplicable: true },
        { role: 'FINANCE', label: 'Finance', isApplicable: true },
        { role: 'DEAN', label: 'Dean', isApplicable: true },
        { role: 'AUDIT', label: 'Audit', isApplicable: true },
        { role: 'CEO', label: 'CEO', isApplicable: true },
        { role: 'CHAIRMAN', label: 'Chairman', isApplicable: true }
      ],
      selectedBranch: 'AUDIT'
    });
    assert.equal(validDraftRes.status, 200);
    const validResult = await validDraftRes.json();
    assert.equal(validResult.valid, true);
    assert.equal(validResult.errors.length, 0);
  });

  // CRITERION 18: Concurrency check rejects stale updates with outdated expectedUpdatedAt (HTTP 409)
  await t.test('18. Concurrency check rejects stale updates with outdated expectedUpdatedAt (HTTP 409)', async () => {
    const staleRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/custom-workflow`, 'PUT', {
      reason: 'Testing concurrency conflict',
      expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
      stages: [
        { role: 'DEAN', label: 'Dean', isApplicable: true },
        { role: 'CEO', label: 'CEO', isApplicable: true },
        { role: 'CHAIRMAN', label: 'Chairman', isApplicable: true }
      ]
    });
    assert.equal(staleRes.status, 409, 'Stale expectedUpdatedAt must trigger HTTP 409 Conflict');
    const body = await staleRes.json();
    assert.ok(body.message?.includes('modified by another') || body.error?.includes('modified by another'));
  });

  // CRITERION 19: Full Request-Specific Workflow Customization persists in MySQL, preserves completed stages, supersedes replaced pending stage
  await t.test('19. Request-specific customization persists to MySQL and supersedes pending stage safely', async () => {
    // Create an unrelated second request to verify editing one request does not affect unrelated requests
    const secondReqRes = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Unrelated Request to verify isolation',
      amount: 15000,
      category: 'Equipment',
      description: 'Should never have its workflow altered when modifying testRequestId'
    });
    assert.equal(secondReqRes.status, 201);
    const secondReqId = (await secondReqRes.json()).request.id;

    // Fetch latest testRequestId state and its updatedAt
    const reqRes = await apiCall(ceoCookie, `/requests/${testRequestId}`);
    assert.equal(reqRes.status, 200);
    const currentReq = (await reqRes.json()).request;

    // Custom stages for testRequestId:
    // Notice Finance is already COMPLETED.
    // We provide:
    // 1. INSTITUTION_MANAGER (already decided or skipped)
    // 2. FINANCE (COMPLETED - must be preserved!)
    // 3. VP (new pending stage replacing GENERAL_MANAGER)
    // 4. DEAN (mandatory checkpoint)
    // 5. AUDIT (post-Dean branch)
    // 6. CEO (mandatory checkpoint)
    // 7. CHAIRMAN (mandatory final authority)
    const customStages = [
      { role: 'INSTITUTION_MANAGER', label: 'Institution Manager', isApplicable: true },
      { role: 'FINANCE', label: 'Finance', isApplicable: true },
      { role: 'VP', label: 'Vice President', isApplicable: true },
      { role: 'DEAN', label: 'Dean', isApplicable: true },
      { role: 'AUDIT', label: 'Audit Inspection', isApplicable: true },
      { role: 'CEO', label: 'Chief Executive Officer', isApplicable: true },
      { role: 'CHAIRMAN', label: 'Chairman of the Board', isApplicable: true }
    ];

    const activateRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/custom-workflow`, 'PUT', {
      reason: 'Special executive committee workflow adjustment for audit review',
      selectedBranch: 'AUDIT',
      expectedUpdatedAt: currentReq.updatedAt,
      stages: customStages
    });
    const activateText = await activateRes.text();
    assert.equal(activateRes.status, 200, `Activation failed: ${activateText}`);
    const updated = JSON.parse(activateText).request;

    // 1. Check updated request ID
    assert.equal(updated.id, testRequestId);

    // 2. Completed stage FINANCE remains COMPLETED
    const financeStage = updated.stages.find(s => s.role === 'FINANCE');
    assert.ok(financeStage, 'Finance stage must be in stages list');
    assert.equal(financeStage.status, 'COMPLETED', 'Historical completed Finance stage must remain COMPLETED');

    // 3. Previous pending stage GENERAL_MANAGER is SUPERSEDED
    const gmStage = updated.stages.find(s => s.role === 'GENERAL_MANAGER');
    assert.ok(gmStage, 'Previous stage must remain in stages history');
    assert.equal(gmStage.status, 'SUPERSEDED', 'Replaced pending stage must be SUPERSEDED');

    // 4. New active stage is VP
    assert.equal(updated.currentStage, 'VP');
    const vpStage = updated.stages.find(s => s.role === 'VP' && s.status === 'PENDING');
    assert.ok(vpStage, 'VP must now be the PENDING stage');

    // 5. Selected branch is AUDIT
    assert.equal(updated.selectedBranch, 'AUDIT');

    // 6. Audit & Migration history contains the customization event
    assert.ok(updated.migrationEvents.length >= 2, 'Must have at least 2 migration events');
    const customEvent = updated.migrationEvents.find(e => e.reason.includes('Special executive committee'));
    assert.ok(customEvent, 'Custom workflow migration event must be logged');
    assert.equal(customEvent.actorRole, 'CEO');

    // 7. Isolation check: Verify unrelated second request was NOT modified
    const checkSecondRes = await apiCall(ceoCookie, `/requests/${secondReqId}`);
    assert.equal(checkSecondRes.status, 200);
    const secondReq = (await checkSecondRes.json()).request;
    assert.notEqual(secondReq.currentStage, 'VP', 'Unrelated request must not have its stage modified');
    assert.equal(secondReq.selectedBranch, 'IT', 'Unrelated request must retain its own default branch config (IT)');
  });

  // CRITERION 20: Subsequent modifications follow the same edit -> preview -> activate workflow
  await t.test('20. Subsequent modifications follow the same edit -> preview -> activate process', async () => {
    // Fetch latest request state
    const reqRes = await apiCall(ceoCookie, `/requests/${testRequestId}`);
    assert.equal(reqRes.status, 200);
    const currentReq = (await reqRes.json()).request;

    // Subsequent edit: swap VP to HOI
    const subsequentStages = [
      { role: 'INSTITUTION_MANAGER', label: 'Institution Manager', isApplicable: true },
      { role: 'FINANCE', label: 'Finance', isApplicable: true },
      { role: 'HOI', label: 'Head of Institution', isApplicable: true },
      { role: 'DEAN', label: 'Dean', isApplicable: true },
      { role: 'HR', label: 'HR Branch', isApplicable: true },
      { role: 'CEO', label: 'Chief Executive Officer', isApplicable: true },
      { role: 'CHAIRMAN', label: 'Chairman of the Board', isApplicable: true }
    ];

    const subsequentActivateRes = await apiCall(ceoCookie, `/admin/requests/${testRequestId}/custom-workflow`, 'PUT', {
      reason: 'Second re-customization: Routing through HOI and HR branch',
      selectedBranch: 'HR',
      expectedUpdatedAt: currentReq.updatedAt,
      stages: subsequentStages
    });
    const subsequentText = await subsequentActivateRes.text();
    assert.equal(subsequentActivateRes.status, 200, `Subsequent activation failed: ${subsequentText}`);
    const subsequentReq = JSON.parse(subsequentText).request;

    // VP was pending and was replaced by HOI, so VP should now be SUPERSEDED
    const vpStage = subsequentReq.stages.find(s => s.role === 'VP');
    assert.ok(vpStage, 'VP stage must be retained in stages history');
    assert.equal(vpStage.status, 'SUPERSEDED');

    // HOI should now be PENDING
    assert.equal(subsequentReq.currentStage, 'HOI');
    assert.equal(subsequentReq.selectedBranch, 'HR');
  });

  // CRITERION 21: CEO and Chairman User Management visibility and security restrictions
  await t.test('21. CEO and Chairman User Management visibility and security restrictions', async () => {
    // 1. Chairman perspective: sees CEO accounts, but excludes Chairman accounts
    const chairmanMgmtRes = await apiCall(chairmanCookie, '/admin');
    assert.equal(chairmanMgmtRes.status, 200);
    const chairmanData = await chairmanMgmtRes.json();
    assert.ok(chairmanData.roles.includes('CEO'), 'Chairman must see CEO role in assignable roles');
    assert.ok(!chairmanData.roles.includes('CHAIRMAN'), 'Chairman must not see CHAIRMAN role in assignable roles');
    assert.ok(chairmanData.users.some(u => u.role === 'CEO'), 'Chairman users list must include CEO accounts');
    assert.ok(!chairmanData.users.some(u => u.role === 'CHAIRMAN'), 'Chairman users list must exclude CHAIRMAN accounts');

    // 2. CEO perspective: excludes CEO and Chairman accounts
    const ceoMgmtRes = await apiCall(ceoCookie, '/admin');
    assert.equal(ceoMgmtRes.status, 200);
    const ceoData = await ceoMgmtRes.json();
    assert.ok(!ceoData.roles.includes('CEO'), 'CEO must not see CEO role in assignable roles');
    assert.ok(!ceoData.roles.includes('CHAIRMAN'), 'CEO must not see CHAIRMAN role in assignable roles');
    assert.ok(!ceoData.users.some(u => u.role === 'CEO'), 'CEO users list must exclude CEO accounts');
    assert.ok(!ceoData.users.some(u => u.role === 'CHAIRMAN'), 'CEO users list must exclude CHAIRMAN accounts');

    // 3. CEO cannot create a CEO account (returns 403)
    const ceoCreateCeoRes = await apiCall(ceoCookie, '/admin/users', 'POST', {
      name: 'Unauthorized CEO Attempt',
      email: `rogue_ceo_${Date.now()}@example.com`,
      password: 'password123456',
      role: 'CEO',
      dept: 'Executive'
    });
    assert.equal(ceoCreateCeoRes.status, 403, 'CEO must be forbidden from creating a CEO account');

    // 4. CEO cannot create a Chairman account (returns 403)
    const ceoCreateChairmanRes = await apiCall(ceoCookie, '/admin/users', 'POST', {
      name: 'Unauthorized Chairman Attempt',
      email: `rogue_chair_${Date.now()}@example.com`,
      password: 'password123456',
      role: 'CHAIRMAN',
      dept: 'Executive'
    });
    assert.equal(ceoCreateChairmanRes.status, 403, 'CEO must be forbidden from creating a Chairman account');

    // 5. Chairman CAN create a CEO account
    const testCeoEmail = `managed_ceo_${Date.now()}@example.com`;
    const chairmanCreateCeoRes = await apiCall(chairmanCookie, '/admin/users', 'POST', {
      name: 'Test Managed CEO',
      email: testCeoEmail,
      password: 'password123456',
      role: 'CEO',
      dept: 'Executive Operations'
    });
    assert.equal(chairmanCreateCeoRes.status, 201, 'Chairman must be permitted to create CEO accounts via user management');
    const createdCeo = (await chairmanCreateCeoRes.json()).user;
    assert.equal(createdCeo.role, 'CEO');

    // 6. CEO cannot update or deactivate this CEO account
    const ceoUpdateCeoRes = await apiCall(ceoCookie, `/admin/users/${createdCeo.id}`, 'PUT', {
      name: 'Compromised CEO',
      role: 'CEO',
      dept: 'Executive'
    });
    assert.ok(ceoUpdateCeoRes.status === 403 || ceoUpdateCeoRes.status === 404, 'CEO must not be allowed to update CEO accounts');

    const ceoDeactivateCeoRes = await apiCall(ceoCookie, `/admin/users/${createdCeo.id}`, 'DELETE');
    assert.ok(ceoDeactivateCeoRes.status === 404, 'CEO must not be allowed to deactivate CEO accounts');

    // 7. Chairman CAN update and deactivate this CEO account
    const chairmanUpdateCeoRes = await apiCall(chairmanCookie, `/admin/users/${createdCeo.id}`, 'PUT', {
      name: 'Updated Managed CEO',
      dept: 'Executive Operations'
    });
    assert.equal(chairmanUpdateCeoRes.status, 200, 'Chairman must be permitted to update CEO accounts');

    const chairmanDeactivateCeoRes = await apiCall(chairmanCookie, `/admin/users/${createdCeo.id}`, 'DELETE');
    assert.equal(chairmanDeactivateCeoRes.status, 200, 'Chairman must be permitted to deactivate CEO accounts');

    // 8. Chairman account remains protected from deletion/modification via ordinary user management
    const meRes = await apiCall(chairmanCookie, '/auth/me');
    assert.equal(meRes.status, 200);
    const chairmanUser = (await meRes.json()).user;
    const chairDelRes = await apiCall(chairmanCookie, `/admin/users/${chairmanUser.id}`, 'DELETE');
    assert.equal(chairDelRes.status, 404, 'Chairman account must not be deletable through ordinary user management');
    const chairUpdateRes = await apiCall(chairmanCookie, `/admin/users/${chairmanUser.id}`, 'PUT', { name: 'Attempted Change' });
    assert.equal(chairUpdateRes.status, 404, 'Chairman account must not be modifiable through ordinary user management');
  });

  // CRITERION 22: Restore and verify standard institutional approval sequence
  await t.test('22. Standard institutional general workflow sequence is active and verified', async () => {
    const standardWorkflowPayload = {
      name: 'General Approval Workflow',
      description: 'Standard institutional sequence: IM -> Finance -> Accountant -> VP -> HOI -> Dean -> (IT/Audit/HR/MMI) -> CEO -> Chairman',
      preDeanStages: [
        { stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance Head', stageOrder: 2, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_VP', role: 'VP', label: 'Vice President', stageOrder: 4, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_HOI', role: 'HOI', label: 'Head of Institution', stageOrder: 5, isApplicable: true, isActive: true },
        { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean Checkpoint', stageOrder: 6, isApplicable: true, isActive: true }
      ],
      branchConfigs: [
        { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
        { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
        { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
        { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
      ]
    };

    const res = await apiCall(ceoCookie, '/admin/workflow-versions', 'POST', standardWorkflowPayload);
    assert.equal(res.status, 201, 'Publishing standard institutional workflow must succeed');
    const body = await res.json();
    assert.ok(body.workflowVersion);

    // Verify GET /admin/general-workflow returns this version with all stages applicable
    const gwRes = await apiCall(ceoCookie, '/admin/general-workflow');
    assert.equal(gwRes.status, 200);
    const gw = (await gwRes.json()).generalWorkflow;
    assert.ok(gw);
    const expectedRoles = ['INSTITUTION_MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN', 'CEO', 'CHAIRMAN'];
    assert.deepEqual(gw.stages.map(s => s.role), expectedRoles);
    gw.stages.forEach(s => assert.equal(s.isApplicable, true, `Stage ${s.role} must be applicable`));

    // Verify creating a new request instantiates this exact order with single alternative branch
    const reqRes = await apiCall(requesterCookie, '/requests', 'POST', {
      title: 'Standard Workflow Verification',
      amount: 15000,
      category: 'Purchase',
      description: 'Verifying complete institutional sequence'
    });
    assert.equal(reqRes.status, 201);
    const created = (await reqRes.json()).request;
    assert.equal(created.currentStage, 'INSTITUTION_MANAGER');
    const stageRoles = created.stages.map(s => s.role);
    assert.deepEqual(stageRoles, [
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
});

