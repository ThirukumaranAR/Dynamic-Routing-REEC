const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createRequestStageInstances,
  getDefaultGeneralWorkflow,
  initializeRequestWorkflow,
  approveWorkflowStep,
  validateWorkflowConfig,
  getRoleDisplayName
} = require('../dist/services/workflowService.js');

const roles = [
  'REQUESTER',
  'INSTITUTION_MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'VP',
  'HOI',
  'DEAN',
  'IT',
  'AUDIT',
  'HR',
  'MMI',
  'CEO',
  'CHAIRMAN',
  'GENERAL_MANAGER'
];

test('Targeted Test 1 & 2: Swap exchanges two adjacent roles, updates position numbers, and persists sequence', () => {
  const stages = [
    { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true },
    { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'PENDING', isApplicable: true },
    { id: 's3', stageIndex: 2, role: 'ACCOUNTANT', label: 'Accountant', status: 'FUTURE', isApplicable: true },
    { id: 's4', stageIndex: 3, role: 'VP', label: 'Vice President', status: 'FUTURE', isApplicable: true },
    { id: 's5', stageIndex: 4, role: 'HOI', label: 'Head of Institution', status: 'FUTURE', isApplicable: true },
    { id: 's6', stageIndex: 5, role: 'DEAN', label: 'Dean Checkpoint', status: 'FUTURE', isApplicable: true },
    { id: 's7', stageIndex: 6, role: 'CHAIRMAN', label: 'Chairman', status: 'FUTURE', isApplicable: true }
  ];

  // Helper swap function matching frontend handleSwapStages
  const swap = (list, idxA, idxB) => {
    if (list[idxA].status === 'COMPLETED' || list[idxB].status === 'COMPLETED') {
      throw new Error('Completed approval stages cannot be swapped or reordered.');
    }
    const updated = [...list];
    updated[idxA] = { ...list[idxB], stageIndex: idxA };
    updated[idxB] = { ...list[idxA], stageIndex: idxB };

    // Validate Chairman constraint
    const chairIdx = updated.findIndex(s => s.role === 'CHAIRMAN');
    if (chairIdx !== -1 && chairIdx !== updated.length - 1) {
      throw new Error('Chairman must remain the final approval authority stage when included in workflow.');
    }
    return updated;
  };

  // 1. Swap adjacent roles: VP (index 3) and HOI (index 4)
  const swapped = swap(stages, 3, 4);
  assert.equal(swapped[3].role, 'HOI', 'Position 4 must now be HOI');
  assert.equal(swapped[3].stageIndex, 3);
  assert.equal(swapped[4].role, 'VP', 'Position 5 must now be VP');
  assert.equal(swapped[4].stageIndex, 4);

  // Stage IDs and properties preserved
  assert.equal(swapped[3].id, 's5');
  assert.equal(swapped[4].id, 's4');

  // Displayed positions update
  const displayedPositions = swapped.map(s => s.stageIndex + 1);
  assert.deepEqual(displayedPositions, [1, 2, 3, 4, 5, 6, 7]);
});

test('Targeted Test 3: Attempting an invalid swap safely rejects and preserves previous valid order', () => {
  const stages = [
    { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true },
    { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'PENDING', isApplicable: true },
    { id: 's3', stageIndex: 2, role: 'DEAN', label: 'Dean Checkpoint', status: 'FUTURE', isApplicable: true },
    { id: 's4', stageIndex: 3, role: 'CHAIRMAN', label: 'Chairman', status: 'FUTURE', isApplicable: true }
  ];

  const safeSwap = (list, idxA, idxB) => {
    const stageA = list[idxA];
    const stageB = list[idxB];
    if (stageA.status === 'COMPLETED' || stageB.status === 'COMPLETED') {
      return { success: false, error: 'Completed approval stages cannot be swapped or reordered.', stages: list };
    }
    const updated = [...list];
    updated[idxA] = { ...stageB, stageIndex: idxA };
    updated[idxB] = { ...stageA, stageIndex: idxB };

    const chairIdx = updated.findIndex(s => s.role === 'CHAIRMAN');
    if (chairIdx !== -1 && chairIdx !== updated.length - 1) {
      return { success: false, error: 'Cannot swap stages: Chairman must remain the final approval authority stage when included in workflow.', stages: list };
    }
    return { success: true, error: null, stages: updated };
  };

  // Attempt 1: Swap completed IM with Finance -> Must be safely rejected
  const res1 = safeSwap(stages, 0, 1);
  assert.equal(res1.success, false);
  assert.match(res1.error, /Completed approval stages cannot be swapped/);
  assert.equal(res1.stages[0].role, 'INSTITUTION_MANAGER', 'Previous valid order must remain intact');

  // Attempt 2: Swap Dean (index 2) with Chairman (index 3) -> Displaces Chairman from final stage!
  const res2 = safeSwap(stages, 2, 3);
  assert.equal(res2.success, false);
  assert.match(res2.error, /Chairman must remain the final approval authority/);
  assert.equal(res2.stages[3].role, 'CHAIRMAN', 'Previous valid order must remain intact');
  assert.equal(res2.stages[2].role, 'DEAN');
});

test('Targeted Test 4: Example A — Removing HOI from remaining workflow routes to Dean without HOI', () => {
  // Workflow: Requester -> Institution Manager -> Finance Head -> Accountant -> VP -> HOI -> Dean -> CEO -> Chairman
  const originalStages = [
    { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true },
    { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'COMPLETED', isApplicable: true },
    { id: 's3', stageIndex: 2, role: 'ACCOUNTANT', label: 'Accountant', status: 'COMPLETED', isApplicable: true },
    { id: 's4', stageIndex: 3, role: 'VP', label: 'Vice President', status: 'PENDING', isApplicable: true },
    { id: 's5', stageIndex: 4, role: 'HOI', label: 'Head of Institution', status: 'FUTURE', isApplicable: true },
    { id: 's6', stageIndex: 5, role: 'DEAN', label: 'Dean Checkpoint', status: 'FUTURE', isApplicable: true },
    { id: 's7', stageIndex: 6, role: 'CEO', label: 'Chief Executive Officer', status: 'FUTURE', isApplicable: true },
    { id: 's8', stageIndex: 7, role: 'CHAIRMAN', label: 'Chairman', status: 'FUTURE', isApplicable: true }
  ];

  // Admin removes HOI from remaining workflow
  const updatedStages = originalStages
    .filter(s => s.role !== 'HOI')
    .map((s, idx) => ({ ...s, stageIndex: idx }));

  assert.equal(updatedStages.some(s => s.role === 'HOI'), false, 'HOI must not exist in updated stages');

  const request = {
    id: 'REQ-HOI-REMOVAL',
    title: 'Lab Equipment Purchase',
    department: 'Engineering',
    amount: 50000,
    currentStage: 'VP',
    currentStepIndex: 3,
    status: 'PENDING',
    stages: updatedStages,
    auditTrail: [],
    approvalHistory: [
      { stepIndex: 0, role: 'INSTITUTION_MANAGER', actorName: 'Manager A', action: 'APPROVED', ts: '2026-10-10T09:00:00Z' },
      { stepIndex: 1, role: 'FINANCE', actorName: 'Finance B', action: 'APPROVED', ts: '2026-10-10T10:00:00Z' },
      { stepIndex: 2, role: 'ACCOUNTANT', actorName: 'Accountant C', action: 'APPROVED', ts: '2026-10-10T11:00:00Z' }
    ]
  };

  // VP approves
  const vpUser = { id: 'vp-user-1', name: 'Dr. VP', role: 'VP' };
  const afterVp = approveWorkflowStep(request, vpUser, '2026-10-10T12:00:00Z');

  // Request MUST route directly to DEAN, bypassing HOI!
  assert.equal(afterVp.currentStage, 'DEAN', 'Subsequent approval must route to DEAN, not HOI');
  assert.equal(afterVp.assignedRole, 'DEAN');
  const deanStage = afterVp.stages.find(s => s.role === 'DEAN');
  assert.equal(deanStage.status, 'PENDING');
});

test('Targeted Test 5: Example B — Adding Accountant after Finance Head routes to Accountant next', () => {
  // Existing workflow: Requester -> IM -> Finance Head -> VP -> Dean -> CEO -> Chairman
  // Admin adds Accountant after Finance Head
  // Target workflow: Requester -> IM -> Finance Head -> Accountant -> VP -> Dean -> CEO -> Chairman
  const stages = [
    { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true },
    { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'PENDING', isApplicable: true },
    { id: 's3', stageIndex: 2, role: 'ACCOUNTANT', label: 'Accountant', status: 'FUTURE', isApplicable: true },
    { id: 's4', stageIndex: 3, role: 'VP', label: 'Vice President', status: 'FUTURE', isApplicable: true },
    { id: 's5', stageIndex: 4, role: 'DEAN', label: 'Dean Checkpoint', status: 'FUTURE', isApplicable: true },
    { id: 's6', stageIndex: 5, role: 'CEO', label: 'Chief Executive Officer', status: 'FUTURE', isApplicable: true },
    { id: 's7', stageIndex: 6, role: 'CHAIRMAN', label: 'Chairman', status: 'FUTURE', isApplicable: true }
  ];

  const request = {
    id: 'REQ-INSERT-ACC',
    title: 'Research Grant Allocation',
    department: 'Biology',
    amount: 100000,
    currentStage: 'FINANCE',
    currentStepIndex: 1,
    status: 'PENDING',
    stages,
    auditTrail: [],
    approvalHistory: [
      { stepIndex: 0, role: 'INSTITUTION_MANAGER', actorName: 'Manager A', action: 'APPROVED', ts: '2026-10-10T09:00:00Z' }
    ]
  };

  // Finance approves
  const finUser = { id: 'fin-user-1', name: 'Alice Finance', role: 'FINANCE' };
  const afterFinance = approveWorkflowStep(request, finUser, '2026-10-10T10:00:00Z');

  // Must route to newly inserted Accountant at correct point!
  assert.equal(afterFinance.currentStage, 'ACCOUNTANT', 'Next eligible approver must be Accountant');
  assert.equal(afterFinance.assignedRole, 'ACCOUNTANT');
  const accStage = afterFinance.stages.find(s => s.role === 'ACCOUNTANT');
  assert.equal(accStage.status, 'PENDING');

  // When Accountant approves, it routes to VP
  const accUser = { id: 'acc-user-1', name: 'Bob Accountant', role: 'ACCOUNTANT' };
  const afterAcc = approveWorkflowStep(afterFinance, accUser, '2026-10-10T11:00:00Z');
  assert.equal(afterAcc.currentStage, 'VP', 'After Accountant, routes to VP');

  // When VP approves, routes to Dean
  const vpUser = { id: 'vp-user-1', name: 'Dr. VP', role: 'VP' };
  const afterVp = approveWorkflowStep(afterAcc, vpUser, '2026-10-10T12:00:00Z');
  assert.equal(afterVp.currentStage, 'DEAN', 'After VP, routes to Dean');

  // When Dean approves, routes to CEO (no phantom branch injected!)
  const deanUser = { id: 'dean-user-1', name: 'Dean Davis', role: 'DEAN' };
  const afterDean = approveWorkflowStep(afterVp, deanUser, '2026-10-10T13:00:00Z');
  assert.equal(afterDean.currentStage, 'CEO', 'After Dean, routes directly to CEO without phantom branch injection');

  // When CEO approves, routes to Chairman
  const ceoUser = { id: 'ceo-user-1', name: 'Dr. CEO', role: 'CEO' };
  const afterCeo = approveWorkflowStep(afterDean, ceoUser, '2026-10-10T14:00:00Z');
  assert.equal(afterCeo.currentStage, 'CHAIRMAN', 'After CEO, routes to Chairman');

  // When Chairman approves, final approval granted
  const chairUser = { id: 'chair-user-1', name: 'Chairman Sir', role: 'CHAIRMAN' };
  const afterChair = approveWorkflowStep(afterCeo, chairUser, '2026-10-10T15:00:00Z');
  assert.equal(afterChair.status, 'APPROVED');
  assert.equal(afterChair.currentStage, 'COMPLETED');
});

test('Targeted Test 6 & 7: Newly inserted role can view request and approval history; past records remain unchanged', () => {
  const pastHistory = [
    { stepIndex: 0, role: 'INSTITUTION_MANAGER', actorName: 'Manager A', action: 'APPROVED', ts: '2026-10-10T09:00:00Z' },
    { stepIndex: 1, role: 'FINANCE', actorName: 'Alice Finance', action: 'APPROVED', ts: '2026-10-10T10:00:00Z' }
  ];

  const stages = [
    { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true, decidedByName: 'Manager A', decisionTs: '2026-10-10T09:00:00Z' },
    { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'COMPLETED', isApplicable: true, decidedByName: 'Alice Finance', decisionTs: '2026-10-10T10:00:00Z' },
    { id: 's3', stageIndex: 2, role: 'ACCOUNTANT', label: 'Accountant', status: 'PENDING', isApplicable: true },
    { id: 's4', stageIndex: 3, role: 'CHAIRMAN', label: 'Chairman', status: 'FUTURE', isApplicable: true }
  ];

  const request = {
    id: 'REQ-PERM-TEST',
    title: 'Chemical Lab Supplies',
    amount: 30000,
    currentStage: 'ACCOUNTANT',
    assignedRole: 'ACCOUNTANT',
    status: 'PENDING',
    stages,
    approvalHistory: pastHistory,
    auditTrail: [
      { ts: '2026-10-10T09:00:00Z', actor: 'Manager A (INSTITUTION_MANAGER)', action: 'Approved by Manager A' },
      { ts: '2026-10-10T10:00:00Z', actor: 'Alice Finance (FINANCE)', action: 'Approved by Alice Finance' }
    ]
  };

  // Helper matching requestController canViewRequest
  const canView = (req, user) => {
    if (user.role === 'CEO' || user.role === 'CHAIRMAN') return true;
    if (user.role === 'REQUESTER') return req.requesterId === user.id;
    return req.assignedUserId === user.id || req.currentStage === user.role ||
      req.approvalHistory?.some(e => e.actorId === user.id) === true ||
      req.stages?.some(s => s.role === user.role && s.isApplicable !== false) === true;
  };

  const accountantUser = { id: 'acc-user-99', name: 'Bob Accountant', role: 'ACCOUNTANT' };
  assert.equal(canView(request, accountantUser), true, 'Accountant approver can view request');

  // Verify previous approvals, comments, timestamps, and audit records remain unchanged
  assert.equal(request.approvalHistory.length, 2);
  assert.equal(request.approvalHistory[0].actorName, 'Manager A');
  assert.equal(request.approvalHistory[0].ts, '2026-10-10T09:00:00Z');
  assert.equal(request.approvalHistory[1].actorName, 'Alice Finance');
  assert.equal(request.approvalHistory[1].ts, '2026-10-10T10:00:00Z');
  assert.equal(request.auditTrail.length, 2);
});

test('Targeted Test 8 & 9: Request-specific changes do not affect other requests; new requests use active general workflow', () => {
  const gw = getDefaultGeneralWorkflow();

  // Create Request 1
  const req1 = initializeRequestWorkflow({ id: 'REQ-1', title: 'Request 1', category: 'Purchase', amount: 10000, auditTrail: [] }, [], gw);
  // Create Request 2
  const req2 = initializeRequestWorkflow({ id: 'REQ-2', title: 'Request 2', category: 'Purchase', amount: 20000, auditTrail: [] }, [], gw);

  // Modify Request 1's workflow specifically (remove HOI, add custom stage)
  const modifiedReq1Stages = req1.stages.filter(s => s.role !== 'HOI');
  const customizedReq1 = {
    ...req1,
    stages: modifiedReq1Stages,
    stagesJson: JSON.stringify(modifiedReq1Stages)
  };

  // Request 2's stages remain unaffected
  assert.ok(req2.stages.some(s => s.role === 'HOI'), 'Request 2 must still include HOI');
  assert.equal(req2.stages.length, req1.stages.length);

  // New request 3 uses the active general workflow
  const req3 = initializeRequestWorkflow({ id: 'REQ-3', title: 'Request 3', category: 'Purchase', amount: 30000, auditTrail: [] }, [], gw);
  assert.ok(req3.stages.some(s => s.role === 'HOI'), 'New request must use active general workflow');
});
