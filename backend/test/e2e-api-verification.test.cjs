const assert = require('node:assert/strict');
const test = require('node:test');

const BASE_URL = 'http://localhost:5000/api';

test('8. End-to-End API: Login, Request Creation, Finance vs Non-Finance Routing, and Approvals', async () => {
  // 1. Login as Chairman
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: JSON.stringify({ email: 'chairman@flownexus.com', password: 'Password@123456' })
  });
  const loginData = await loginRes.json();
  assert.equal(loginRes.status, 200, `Login must succeed: ${JSON.stringify(loginData)}`);
  assert.equal(loginData.user.role, 'CHAIRMAN');

  const cookie = loginRes.headers.get('set-cookie');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000',
    'Cookie': cookie ? cookie.split(';')[0] : ''
  };

  // 2. User management check
  const adminRes = await fetch(`${BASE_URL}/admin`, { headers: authHeaders });
  const adminData = await adminRes.json();
  assert.equal(adminRes.status, 200);
  assert.ok(adminData.roles.includes('INSTITUTION_MANAGER'));
  assert.ok(adminData.roles.includes('FINANCE'));
  assert.ok(adminData.roles.includes('ACCOUNTANT'));
  assert.ok(adminData.roles.includes('VP'));
  assert.ok(adminData.roles.includes('HOI'));
  assert.ok(adminData.roles.includes('DEAN'));
  assert.ok(adminData.roles.includes('IT'));
  assert.ok(adminData.roles.includes('AUDIT'));
  assert.ok(adminData.roles.includes('HR'));
  assert.ok(adminData.roles.includes('MMI'));
  assert.ok(adminData.roles.includes('CEO'));

  // 3. Login as Requester to create requests (Request creation is reserved for Requester through Dean)
  const reqLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: JSON.stringify({ email: 'requester@flownexus.com', password: 'Password@123456' })
  });
  const reqCookie = reqLoginRes.headers.get('set-cookie');
  const reqHeaders = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000',
    'Cookie': reqCookie ? reqCookie.split(';')[0] : ''
  };

  // 4. Create a Finance Request (Purchase)
  const purchaseRes = await fetch(`${BASE_URL}/requests`, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      title: 'Lab Server Procurement',
      category: 'Purchase',
      amount: 150000,
      description: 'High performance servers for CSE research department'
    })
  });
  const purchaseData = await purchaseRes.json();
  assert.equal(purchaseRes.status, 201, `Purchase creation failed: ${JSON.stringify(purchaseData)}`);
  const purchaseStages = purchaseData.request.stages;
  const pFinStage = purchaseStages.find(s => s.role === 'FINANCE');
  const pAccStage = purchaseStages.find(s => s.role === 'ACCOUNTANT');
  assert.ok(pFinStage && pFinStage.isApplicable && pFinStage.status !== 'SKIPPED', 'Finance Head must be applicable in Purchase');
  assert.ok(pAccStage && pAccStage.isApplicable && pAccStage.status !== 'SKIPPED', 'Accountant must be applicable in Purchase');

  // 4. Create a Non-Finance Request (Leave)
  const leaveRes = await fetch(`${BASE_URL}/requests`, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      title: 'Faculty Medical Leave',
      category: 'Leave',
      amount: 1, // positive amount required by schema validation
      description: 'Medical leave request for surgery and recovery'
    })
  });
  const leaveData = await leaveRes.json();
  assert.equal(leaveRes.status, 201, `Leave creation failed: ${JSON.stringify(leaveData)}`);
  const leaveStages = leaveData.request.stages;
  const lFinStage = leaveStages.find(s => s.role === 'FINANCE');
  const lAccStage = leaveStages.find(s => s.role === 'ACCOUNTANT');
  assert.equal(lFinStage.isApplicable, false, 'Finance Head must be Not Applicable in Leave');
  assert.equal(lFinStage.status, 'SKIPPED', 'Finance Head must be SKIPPED in Leave');
  assert.equal(lAccStage.isApplicable, false, 'Accountant must be Not Applicable in Leave');
  assert.equal(lAccStage.status, 'SKIPPED', 'Accountant must be SKIPPED in Leave');

  // Initial stage is INSTITUTION_MANAGER
  assert.equal(leaveData.request.currentStage, 'INSTITUTION_MANAGER');

  // 5. Login as Institution Manager and approve Leave request
  const imLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: JSON.stringify({ email: 'manager@flownexus.com', password: 'Password@123456' })
  });
  const imLoginData = await imLoginRes.json();
  assert.equal(imLoginRes.status, 200);
  const imCookie = imLoginRes.headers.get('set-cookie');
  const imHeaders = { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000', 'Cookie': imCookie ? imCookie.split(';')[0] : '' };

  const imApproveRes = await fetch(`${BASE_URL}/requests/${leaveData.request.id}/approve`, {
    method: 'POST',
    headers: imHeaders,
    body: JSON.stringify({})
  });
  const imApproveData = await imApproveRes.json();
  assert.equal(imApproveRes.status, 200, `IM approval failed: ${JSON.stringify(imApproveData)}`);
  // Non-finance request must forward directly to VP, skipping Finance Head and Accountant!
  assert.equal(imApproveData.request.currentStage, 'VP', 'Non-finance request must advance directly to VP after IM!');
});
