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

test('Leave and Permission Request Creation with Specific Details & Prev Balance', async (t) => {
  const requesterCookie = await login('requester@gmail.com');

  await t.test('1. Create Leave request with previous balance and specific details', async () => {
    const leavePayload = {
      title: 'Family Function Casual Leave',
      category: 'Leave',
      requestType: 'HR Request', // Workflow Type
      amount: null,
      description: 'Requesting 2 days casual leave for attending family function in hometown.',
      purpose: 'Personal and family function',
      requestDetails: {
        prevBalance: '12',
        leaveType: 'Casual Leave (CL)',
        startDate: '2026-11-05',
        endDate: '2026-11-06',
        totalDays: '2',
        handoverPerson: 'Ravi Kumar (AP/CSE)',
        reason: 'Attending elder sister wedding ceremony'
      }
    };

    const res = await apiCall(requesterCookie, '/requests', 'POST', leavePayload);
    const text = await res.text();
    assert.equal(res.status, 201, `Failed to create leave request (${res.status}): ${text}`);
    const body = JSON.parse(text);
    assert.equal(body.success, true);
    assert.ok(body.request?.id);
    assert.equal(body.request.category, 'Leave');
    assert.equal(body.request.requestType, 'HR Request');
    assert.equal(body.request.amount, null);
    assert.equal(body.request.requestDetails?.prevBalance, '12');
    assert.equal(body.request.requestDetails?.leaveType, 'Casual Leave (CL)');

    // Fetch by ID and verify persistence
    const fetchRes = await apiCall(requesterCookie, `/requests/${body.request.id}`);
    assert.equal(fetchRes.status, 200);
    const fetchBody = await fetchRes.json();
    assert.equal(fetchBody.request.category, 'Leave');
    assert.equal(fetchBody.request.requestDetails?.prevBalance, '12');
    assert.equal(fetchBody.request.requestDetails?.totalDays, '2');
  });

  await t.test('2. Create Permission request with previous permission balance and time details', async () => {
    const permissionPayload = {
      title: 'Morning Medical Checkup Permission',
      category: 'Permission',
      requestType: 'IT Request', // Workflow Type
      amount: null,
      description: 'Requesting 2 hours morning permission for routine health checkup.',
      purpose: 'Routine medical examination',
      requestDetails: {
        prevBalance: '1',
        permissionDate: '2026-10-25',
        startTime: '09:00',
        endTime: '11:00',
        duration: '2 Hours',
        permissionWindow: 'Late Arrival (Morning)',
        reason: 'Fasting blood sugar test at clinic'
      }
    };

    const res = await apiCall(requesterCookie, '/requests', 'POST', permissionPayload);
    const text = await res.text();
    assert.equal(res.status, 201, `Failed to create permission request (${res.status}): ${text}`);
    const body = JSON.parse(text);
    assert.equal(body.success, true);
    assert.ok(body.request?.id);
    assert.equal(body.request.category, 'Permission');
    assert.equal(body.request.requestType, 'IT Request');
    assert.equal(body.request.amount, null);
    assert.equal(body.request.requestDetails?.prevBalance, '1');
    assert.equal(body.request.requestDetails?.permissionWindow, 'Late Arrival (Morning)');

    // Fetch by ID and verify persistence
    const fetchRes = await apiCall(requesterCookie, `/requests/${body.request.id}`);
    assert.equal(fetchRes.status, 200);
    const fetchBody = await fetchRes.json();
    assert.equal(fetchBody.request.category, 'Permission');
    assert.equal(fetchBody.request.requestDetails?.prevBalance, '1');
    assert.equal(fetchBody.request.requestDetails?.startTime, '09:00');
  });
});
