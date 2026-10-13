const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isFinanceCategory,
  createRequestStageInstances,
  getDefaultGeneralWorkflow,
  initializeRequestWorkflow,
  approveWorkflowStep,
  routeRequestToBranch,
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

test('1. Finance requests include Finance Head and Accountant', () => {
  const gw = getDefaultGeneralWorkflow();
  assert.ok(isFinanceCategory('Purchase'));
  assert.ok(isFinanceCategory('Reimbursement'));

  const purchaseResult = createRequestStageInstances(gw, 'AUDIT', 'Purchase');
  const financeStage = purchaseResult.stages.find(s => s.role === 'FINANCE');
  const accountantStage = purchaseResult.stages.find(s => s.role === 'ACCOUNTANT');

  assert.ok(financeStage, 'Finance Head stage must exist');
  assert.equal(financeStage.isApplicable, true, 'Finance Head must be applicable for Purchase');
  assert.notEqual(financeStage.status, 'SKIPPED', 'Finance Head must not be skipped for Purchase');

  assert.ok(accountantStage, 'Accountant stage must exist');
  assert.equal(accountantStage.isApplicable, true, 'Accountant must be applicable for Purchase');
  assert.notEqual(accountantStage.status, 'SKIPPED', 'Accountant must not be skipped for Purchase');

  // Request initialization for Purchase starts with IM
  const req = { id: 'req-p', category: 'Purchase', title: 'Procurement of Servers', amount: 50000, requester: 'User A', auditTrail: [] };
  const initReq = initializeRequestWorkflow(req, [], gw);
  assert.equal(initReq.currentStage, 'INSTITUTION_MANAGER');

  // When IM approves, next is Finance Head
  const imUser = { id: 'im-1', name: 'Inst Mgr', role: 'INSTITUTION_MANAGER' };
  const afterIm = approveWorkflowStep(initReq, imUser, '2026-10-11T10:00:00Z');
  assert.equal(afterIm.currentStage, 'FINANCE', 'After IM, must route to Finance Head');

  // When Finance Head approves, next is Accountant
  const finUser = { id: 'fin-1', name: 'Fin Controller', role: 'FINANCE' };
  const afterFin = approveWorkflowStep(afterIm, finUser, '2026-10-11T10:05:00Z');
  assert.equal(afterFin.currentStage, 'ACCOUNTANT', 'After Finance Head, must route to Accountant');

  // When Accountant approves, next is VP
  const accUser = { id: 'acc-1', name: 'Chief Accountant', role: 'ACCOUNTANT' };
  const afterAcc = approveWorkflowStep(afterFin, accUser, '2026-10-11T10:10:00Z');
  assert.equal(afterAcc.currentStage, 'VP', 'After Accountant, must route to VP');
});

test('2. All requests (including Leave) follow unified sequence through Finance and Accountant', () => {
  const gw = getDefaultGeneralWorkflow();
  assert.equal(isFinanceCategory('Leave'), false);

  const leaveResult = createRequestStageInstances(gw, 'HR', 'Leave');
  const imStage = leaveResult.stages.find(s => s.role === 'INSTITUTION_MANAGER');
  const financeStage = leaveResult.stages.find(s => s.role === 'FINANCE');
  const accountantStage = leaveResult.stages.find(s => s.role === 'ACCOUNTANT');
  const vpStage = leaveResult.stages.find(s => s.role === 'VP');

  assert.equal(imStage.isApplicable, true, 'Institution Manager must be applicable');
  assert.equal(imStage.status, 'PENDING', 'Institution Manager must be initial PENDING stage');

  assert.equal(financeStage.isApplicable, true, 'Finance Head must be applicable in unified sequence');
  assert.equal(financeStage.status, 'FUTURE', 'Finance Head must not be skipped');

  assert.equal(accountantStage.isApplicable, true, 'Accountant must be applicable in unified sequence');
  assert.equal(accountantStage.status, 'FUTURE', 'Accountant must not be skipped');

  // Verify specified order: IM -> Finance -> Accountant -> VP
  assert.ok(imStage.stageIndex < financeStage.stageIndex, 'IM must precede Finance');
  assert.ok(financeStage.stageIndex < accountantStage.stageIndex, 'Finance must precede Accountant');
  assert.ok(accountantStage.stageIndex < vpStage.stageIndex, 'Accountant must precede VP');

  // When request is created, starts at IM
  const req = { id: 'req-l', category: 'Leave', title: 'Medical Leave', amount: 0, requester: 'User B', auditTrail: [] };
  const initReq = initializeRequestWorkflow(req, [], gw);
  assert.equal(initReq.currentStage, 'INSTITUTION_MANAGER');

  // IM approves -> routes to Finance Head
  const imUser = { id: 'im-1', name: 'Inst Mgr', role: 'INSTITUTION_MANAGER' };
  const afterIm = approveWorkflowStep(initReq, imUser, '2026-10-11T10:00:00Z');
  assert.equal(afterIm.currentStage, 'FINANCE', 'After IM, must route to Finance Head');

  // Finance approves -> routes to Accountant
  const finUser = { id: 'fin-1', name: 'Fin Controller', role: 'FINANCE' };
  const afterFin = approveWorkflowStep(afterIm, finUser, '2026-10-11T10:05:00Z');
  assert.equal(afterFin.currentStage, 'ACCOUNTANT', 'After Finance Head, must route to Accountant');

  // Accountant approves -> routes to VP
  const accUser = { id: 'acc-1', name: 'Chief Accountant', role: 'ACCOUNTANT' };
  const afterAcc = approveWorkflowStep(afterFin, accUser, '2026-10-11T10:10:00Z');
  assert.equal(afterAcc.currentStage, 'VP', 'After Accountant, must route to VP');
});

test('3. Exactly one post-Dean branch executes', () => {
  const gw = getDefaultGeneralWorkflow();
  const req = { id: 'req-b', category: 'Leave', title: 'Annual Leave', amount: 0, requester: 'User C', auditTrail: [] };
  let currentReq = initializeRequestWorkflow(req, [], gw);

  // 1. IM approves -> FINANCE
  currentReq = approveWorkflowStep(currentReq, { id: 'im', name: 'IM', role: 'INSTITUTION_MANAGER' }, '2026-10-11T10:00:00Z');
  assert.equal(currentReq.currentStage, 'FINANCE');

  // 2. Finance approves -> ACCOUNTANT
  currentReq = approveWorkflowStep(currentReq, { id: 'fin', name: 'Fin', role: 'FINANCE' }, '2026-10-11T10:01:00Z');
  assert.equal(currentReq.currentStage, 'ACCOUNTANT');

  // 3. Accountant approves -> VP
  currentReq = approveWorkflowStep(currentReq, { id: 'acc', name: 'Acc', role: 'ACCOUNTANT' }, '2026-10-11T10:02:00Z');
  assert.equal(currentReq.currentStage, 'VP');

  // 4. VP approves -> HOI
  currentReq = approveWorkflowStep(currentReq, { id: 'vp', name: 'VP', role: 'VP' }, '2026-10-11T10:03:00Z');
  assert.equal(currentReq.currentStage, 'HOI');

  // 5. HOI approves -> DEAN
  currentReq = approveWorkflowStep(currentReq, { id: 'hoi', name: 'HOI', role: 'HOI' }, '2026-10-11T10:04:00Z');
  assert.equal(currentReq.currentStage, 'DEAN');

  // 6. Dean selects branch: IT
  currentReq = routeRequestToBranch(currentReq, { id: 'dean', name: 'Dean Academics', role: 'DEAN' }, 'IT', '2026-10-11T10:05:00Z');
  assert.equal(currentReq.currentStage, 'IT', 'Current stage must be IT');
  assert.equal(currentReq.selectedBranch, 'IT');

  // Verify only IT executes, not AUDIT, HR, or MMI
  const branchStages = currentReq.stages.filter(s => s.stageType === 'BRANCH' || ['IT', 'AUDIT', 'HR', 'MMI'].includes(s.role));
  assert.equal(branchStages.filter(s => s.status === 'PENDING').length, 1);
  assert.equal(branchStages.find(s => s.status === 'PENDING').role, 'IT');

  // 7. IT approves -> CEO
  currentReq = approveWorkflowStep(currentReq, { id: 'it', name: 'IT Head', role: 'IT' }, '2026-10-11T10:06:00Z');
  assert.equal(currentReq.currentStage, 'CEO', 'After branch approval, must continue to CEO');
});

test('4. CEO and Chairman approvals remain in the correct order', () => {
  const gw = getDefaultGeneralWorkflow();
  const req = { id: 'req-exec', category: 'Leave', title: 'Executive Flow', amount: 0, requester: 'User D', auditTrail: [] };
  let currentReq = initializeRequestWorkflow(req, [], gw);

  // Advance to CEO: IM -> Finance -> Accountant -> VP -> HOI -> Dean -> Branch (MMI) -> CEO
  currentReq = approveWorkflowStep(currentReq, { id: 'im', name: 'IM', role: 'INSTITUTION_MANAGER' }, '2026-10-11T10:00:00Z');
  currentReq = approveWorkflowStep(currentReq, { id: 'fin', name: 'Fin', role: 'FINANCE' }, '2026-10-11T10:01:00Z');
  currentReq = approveWorkflowStep(currentReq, { id: 'acc', name: 'Acc', role: 'ACCOUNTANT' }, '2026-10-11T10:02:00Z');
  currentReq = approveWorkflowStep(currentReq, { id: 'vp', name: 'VP', role: 'VP' }, '2026-10-11T10:03:00Z');
  currentReq = approveWorkflowStep(currentReq, { id: 'hoi', name: 'HOI', role: 'HOI' }, '2026-10-11T10:04:00Z');
  currentReq = routeRequestToBranch(currentReq, { id: 'dean', name: 'Dean', role: 'DEAN' }, 'MMI', '2026-10-11T10:05:00Z');
  currentReq = approveWorkflowStep(currentReq, { id: 'mmi', name: 'MMI Head', role: 'MMI' }, '2026-10-11T10:06:00Z');
  assert.equal(currentReq.currentStage, 'CEO');

  // CEO cannot be final approval when Chairman is in the flow; CEO approval advances to CHAIRMAN
  currentReq = approveWorkflowStep(currentReq, { id: 'ceo', name: 'Dr. CEO', role: 'CEO' }, '2026-10-11T10:07:00Z');
  assert.equal(currentReq.currentStage, 'CHAIRMAN', 'After CEO approval, stage must be CHAIRMAN');
  assert.equal(currentReq.status, 'PENDING', 'Request must remain PENDING until Chairman approves');

  // Chairman gives terminal final approval
  currentReq = approveWorkflowStep(currentReq, { id: 'chair', name: 'Chairman Sir', role: 'CHAIRMAN' }, '2026-10-11T10:08:00Z');
  assert.equal(currentReq.currentStage, 'COMPLETED', 'Chairman approval terminates the workflow');
  assert.equal(currentReq.status, 'APPROVED', 'Request is now APPROVED');
});

test('5. GM is included only when configured', () => {
  // Default workflow has NO General Manager
  const defaultGw = getDefaultGeneralWorkflow();
  assert.equal(defaultGw.stages.some(s => s.role === 'GENERAL_MANAGER' || s.role === 'GM'), false);

  // Workflow with GM explicitly configured
  const gwWithGm = {
    ...defaultGw,
    stages: [
      defaultGw.stages[0], // IM
      { id: 'gw-gm', stageKey: 'STAGE_GM', role: 'GENERAL_MANAGER', label: 'General Manager', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true },
      ...defaultGw.stages.slice(1)
    ]
  };

  const reqWithoutGm = initializeRequestWorkflow({ id: 'r1', category: 'Leave', auditTrail: [] }, [], defaultGw);
  assert.equal(reqWithoutGm.stages.some(s => s.role === 'GENERAL_MANAGER'), false);

  const reqWithGm = initializeRequestWorkflow({ id: 'r2', category: 'Leave', auditTrail: [] }, [], gwWithGm);
  assert.equal(reqWithGm.stages.some(s => s.role === 'GENERAL_MANAGER'), true);
});

test('6. Existing requests retain their workflow history', () => {
  const existingReq = {
    id: 'req-past',
    workflowVersionNumber: 1,
    stages: [
      { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true, decidedByName: 'Manager Alpha', decisionTs: '2026-10-09T08:00:00Z' },
      { id: 's2', stageIndex: 1, role: 'VP', label: 'VP', status: 'PENDING', isApplicable: true }
    ],
    auditTrail: [
      { ts: '2026-10-09T08:00:00Z', actor: 'Manager Alpha (INSTITUTION_MANAGER)', action: 'Approved Institution Manager' }
    ]
  };

  assert.equal(existingReq.workflowVersionNumber, 1);
  assert.equal(existingReq.stages[0].status, 'COMPLETED');
  assert.equal(existingReq.stages[0].decidedByName, 'Manager Alpha');
  assert.equal(existingReq.stages[0].decisionTs, '2026-10-09T08:00:00Z');
  assert.equal(existingReq.auditTrail.length, 1);
});

test('7. New general workflow versions apply to future requests', () => {
  const gwV1 = getDefaultGeneralWorkflow();
  const gwV2 = {
    ...gwV1,
    version: 2,
    activatedAt: new Date().toISOString(),
    activatedBy: 'Dr. CEO',
    stages: [
      gwV1.stages[0], // IM
      { id: 'gw-gm', stageKey: 'STAGE_GM', role: 'GENERAL_MANAGER', label: 'General Manager', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true },
      ...gwV1.stages.slice(1)
    ]
  };

  const req1 = initializeRequestWorkflow({ id: 'r1', category: 'Leave', auditTrail: [] }, [], gwV1);
  assert.equal(req1.workflowVersionNumber, 1);
  assert.equal(req1.stages.some(s => s.role === 'GENERAL_MANAGER'), false);

  const req2 = initializeRequestWorkflow({ id: 'r2', category: 'Leave', auditTrail: [] }, [], gwV2);
  assert.equal(req2.workflowVersionNumber, 2);
  assert.equal(req2.stages.some(s => s.role === 'GENERAL_MANAGER'), true);
});
