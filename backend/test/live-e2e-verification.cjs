const assert = require('node:assert/strict');

const PROXY_BASE = 'http://localhost:3000/api';
const DIRECT_BASE = 'http://127.0.0.1:5000/api';

async function runE2E() {
  console.log('--- 1. Testing Health Endpoints ---');
  const directHealth = await fetch(`${DIRECT_BASE}/health`).then(r => r.json());
  console.log('Direct Health (Port 5000):', directHealth);
  assert.equal(directHealth.status, 'ok');

  const proxyHealth = await fetch(`${PROXY_BASE}/health`).then(r => r.json());
  console.log('Proxy Health (Port 3000):', proxyHealth);
  assert.equal(proxyHealth.status, 'ok');

  console.log('\n--- 2. Testing Authentication via Port 3000 Proxy ---');
  async function login(email, password = 'pass123') {
    const res = await fetch(`${PROXY_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    assert.equal(res.status, 200, `Login failed for ${email}: ${JSON.stringify(data)}`);
    const cookie = res.headers.get('set-cookie');
    return { user: data.user, token: data.token, cookie };
  }

  const requester = await login('requester@flownexus.com');
  console.log(`✓ Logged in as Requester: ${requester.user.name} (${requester.user.role})`);

  const ceo = await login('ceo@flownexus.com');
  console.log(`✓ Logged in as CEO: ${ceo.user.name} (${ceo.user.role})`);

  const chair = await login('chairman@flownexus.com');
  console.log(`✓ Logged in as Chairman: ${chair.user.name} (${chair.user.role})`);

  console.log('\n--- 3. Testing Request Creation via Port 3000 Proxy ---');
  const createRes = await fetch(`${PROXY_BASE}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
      'Authorization': `Bearer ${requester.token}`
    },
    body: JSON.stringify({
      title: 'E2E Validation Request — Enterprise Lab Equipment',
      description: 'Validation testing of complete multi-tier approval workflow',
      amount: 45000,
      category: 'Purchase',
      branch: 'IT',
      priority: 'MEDIUM'
    })
  });
  const createData = await createRes.json();
  assert.equal(createRes.status, 201, `Create failed: ${JSON.stringify(createData)}`);
  const reqId = createData.request.id;
  console.log(`✓ Created request: ${reqId} with status: ${createData.request.status}`);
  console.log(`Initial sequence stages (${createData.request.stages.length}):`,
    createData.request.stages.map((s, i) => `${i + 1}. ${s.role}`).join(' -> ')
  );

  console.log('\n--- 4. Testing Workflow Inspection & Swap via Port 3000 Proxy ---');
  // Get active general workflow
  const gwRes = await fetch(`${PROXY_BASE}/admin/general-workflow`, {
    headers: {
      'Origin': 'http://localhost:3000',
      'Authorization': `Bearer ${ceo.token}`
    }
  });
  const gwData = await gwRes.json();
  console.log('✓ General workflow active version:', gwData.generalWorkflow?.version || 'Default');

  // Perform Swap on custom request workflow:
  // Current stages: find adjacent configurable stages, e.g., stage 1 and stage 2
  const currentStages = createData.request.stages.map((s, idx) => ({ ...s, stageIndex: idx }));
  // Swap stage 0 and stage 1
  const swapped = [...currentStages];
  const temp = swapped[0];
  swapped[0] = swapped[1];
  swapped[1] = temp;
  swapped.forEach((s, idx) => { s.stageIndex = idx; });

  const swapUpdateRes = await fetch(`${PROXY_BASE}/admin/requests/${reqId}/custom-workflow`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
      'Authorization': `Bearer ${ceo.token}`
    },
    body: JSON.stringify({
      reason: 'E2E testing swap of adjacent configurable roles',
      stages: swapped,
      expectedUpdatedAt: createData.request.updatedAt
    })
  });
  const swapData = await swapUpdateRes.json();
  assert.equal(swapUpdateRes.status, 200, `Swap failed: ${JSON.stringify(swapData)}`);
  console.log(`✓ Swap executed successfully! New sequence:`,
    swapData.request.stages.map((s, i) => `${i + 1}. ${s.role}`).join(' -> ')
  );

  console.log('\n--- 5. Testing Dashboard Metrics via Port 3000 Proxy ---');
  const dashRes = await fetch(`${PROXY_BASE}/analytics/dashboard`, {
    headers: {
      'Origin': 'http://localhost:3000',
      'Authorization': `Bearer ${ceo.token}`
    }
  });
  const dashData = await dashRes.json();
  assert.equal(dashRes.status, 200);
  console.log('✓ Dashboard metrics retrieved successfully:', dashData.metrics);

  console.log('\n--- 6. Testing All Requests Listing via Port 3000 Proxy ---');
  const listRes = await fetch(`${PROXY_BASE}/requests`, {
    headers: {
      'Origin': 'http://localhost:3000',
      'Authorization': `Bearer ${ceo.token}`
    }
  });
  const listData = await listRes.json();
  assert.equal(listRes.status, 200);
  const found = listData.requests.find(r => r.id === reqId);
  assert.ok(found, 'Created request must appear in requests list');
  console.log(`✓ Verified request ${reqId} is present in list with status: ${found.status}`);

  console.log('\n========================================================');
  console.log('🎉 ALL END-TO-END WORKFLOW & SYSTEM CHECKS PASSED 100%!');
  console.log('========================================================');
}

runE2E().catch(err => {
  console.error('❌ E2E Verification failed:', err);
  process.exit(1);
});
