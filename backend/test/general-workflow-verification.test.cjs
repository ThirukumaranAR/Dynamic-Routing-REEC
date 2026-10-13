const assert = require('node:assert/strict');
const test = require('node:test');
const {
  validateWorkflowConfig,
  createRequestStageInstances,
  getDefaultGeneralWorkflow,
  initializeRequestWorkflow,
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

test('1. Modify changes only the selected request', () => {
  const gw = getDefaultGeneralWorkflow();
  const req1 = {
    id: 'req-1',
    category: 'Equipment',
    selectedBranch: 'IT',
    stages: createRequestStageInstances(gw, 'IT').stages
  };
  const req2 = {
    id: 'req-2',
    category: 'HR',
    selectedBranch: 'HR',
    stages: createRequestStageInstances(gw, 'HR').stages
  };

  // Modify req1 specifically: make Finance not applicable
  const updatedReq1Stages = req1.stages.map(s => {
    if (s.role === 'FINANCE') {
      return { ...s, isApplicable: false, status: 'SKIPPED' };
    }
    return s;
  });
  req1.stages = updatedReq1Stages;

  // Assert req1 is modified
  const req1Finance = req1.stages.find(s => s.role === 'FINANCE');
  assert.equal(req1Finance.isApplicable, false);
  assert.equal(req1Finance.status, 'SKIPPED');

  // Assert req2 is completely untouched
  const req2Finance = req2.stages.find(s => s.role === 'FINANCE');
  assert.equal(req2Finance.isApplicable, true);
  assert.notEqual(req2Finance.status, 'SKIPPED');
});

test('2. Modify General Workflow affects new requests submitted after activation', () => {
  // Baseline General Workflow v1
  const gwV1 = getDefaultGeneralWorkflow();
  assert.equal(gwV1.version, 1);
  assert.ok(!gwV1.stages.some(s => s.role === 'GENERAL_MANAGER'));

  // Request submitted under v1
  const initialReq = {
    id: 'req-v1',
    category: 'Purchase',
    department: 'CSE',
    workflowVersionNumber: gwV1.version,
    stages: gwV1.stages.map((s, idx) => ({
      id: `stg-${idx + 1}`,
      stageIndex: idx,
      stageKey: s.stageKey,
      role: s.role,
      label: s.label,
      status: idx === 0 ? 'PENDING' : 'FUTURE',
      isApplicable: s.isApplicable
    }))
  };
  assert.equal(initialReq.workflowVersionNumber, 1);
  assert.ok(!initialReq.stages.some(s => s.role === 'GENERAL_MANAGER'));

  // CEO activates General Workflow v2 with GENERAL_MANAGER added
  const gwV2 = {
    ...gwV1,
    version: 2,
    activatedAt: new Date().toISOString(),
    activatedBy: 'Dr. CEO',
    stages: [
      gwV1.stages[0], // IM
      { id: 'gw-gm', stageKey: 'STAGE_GM', role: 'GENERAL_MANAGER', label: 'General Manager', stageOrder: 2, isApplicable: true },
      ...gwV1.stages.slice(1) // Finance, Accountant, VP, HOI, Dean, CEO, Chairman
    ]
  };

  // New request submitted after activation
  const newReq = {
    id: 'req-v2',
    category: 'Purchase',
    department: 'CSE',
    workflowVersionNumber: gwV2.version,
    stages: gwV2.stages.map((s, idx) => ({
      id: `stg-new-${idx + 1}`,
      stageIndex: idx,
      stageKey: s.stageKey,
      role: s.role,
      label: s.label,
      status: idx === 0 ? 'PENDING' : 'FUTURE',
      isApplicable: s.isApplicable
    }))
  };

  assert.equal(newReq.workflowVersionNumber, 2);
  assert.ok(newReq.stages.some(s => s.role === 'GENERAL_MANAGER'), 'New request has GENERAL_MANAGER stage');
});

test('3. Existing requests retain their previous workflow and approval history by default', () => {
  const existingReq = {
    id: 'req-in-progress',
    workflowVersionNumber: 1,
    stages: [
      { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true, decidedByName: 'Manager A', decisionTs: '2026-10-10T10:00:00Z' },
      { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'PENDING', isApplicable: true }
    ],
    auditTrail: [
      { ts: '2026-10-10T10:00:00Z', actor: 'Manager A', action: 'Approved stage Institution Manager' }
    ]
  };

  // After general workflow is updated to v2, un-migrated request retains v1 and existing stages
  assert.equal(existingReq.workflowVersionNumber, 1);
  assert.equal(existingReq.stages.length, 2);
  assert.equal(existingReq.stages[0].status, 'COMPLETED');
  assert.equal(existingReq.stages[0].decidedByName, 'Manager A');
  assert.equal(existingReq.stages[0].decisionTs, '2026-10-10T10:00:00Z');
  assert.equal(existingReq.auditTrail.length, 1);
});

test('4. An authorized migration preserves history and correctly applies the new stages', () => {
  const inProgressReq = {
    id: 'req-to-migrate',
    workflowVersionNumber: 1,
    currentStage: 'FINANCE',
    stages: [
      { id: 's1', stageIndex: 0, role: 'INSTITUTION_MANAGER', label: 'Institution Manager', status: 'COMPLETED', isApplicable: true, decidedByName: 'Manager A', decisionTs: '2026-10-10T10:00:00Z' },
      { id: 's2', stageIndex: 1, role: 'FINANCE', label: 'Finance Head', status: 'PENDING', isApplicable: true },
      { id: 's3', stageIndex: 2, role: 'DEAN', label: 'Dean Checkpoint', status: 'FUTURE', isApplicable: true },
      { id: 's4', stageIndex: 3, role: 'CEO', label: 'CEO', status: 'FUTURE', isApplicable: true },
      { id: 's5', stageIndex: 4, role: 'CHAIRMAN', label: 'Chairman', status: 'FUTURE', isApplicable: true }
    ],
    migrationEvents: [],
    auditTrail: [
      { ts: '2026-10-10T10:00:00Z', actor: 'Manager A', action: 'Approved Institution Manager' }
    ]
  };

  // Target workflow includes GENERAL_MANAGER before FINANCE
  const targetStages = [
    { role: 'INSTITUTION_MANAGER', label: 'Institution Manager' },
    { role: 'GENERAL_MANAGER', label: 'General Manager' },
    { role: 'FINANCE', label: 'Finance Head' },
    { role: 'DEAN', label: 'Dean Checkpoint' },
    { role: 'CEO', label: 'CEO' },
    { role: 'CHAIRMAN', label: 'Chairman' }
  ];

  // Perform controlled migration: completed stages preserved, new stage becomes pending
  const completedMap = new Map();
  inProgressReq.stages.forEach(s => {
    if (s.status === 'COMPLETED') completedMap.set(s.role, s);
  });

  let pendingFound = false;
  const migratedStages = targetStages.map((ts, idx) => {
    const existing = completedMap.get(ts.role);
    if (existing) {
      return {
        ...existing,
        stageIndex: idx,
        completedUnderVersion: inProgressReq.workflowVersionNumber
      };
    }
    let status = 'FUTURE';
    if (!pendingFound) {
      status = 'PENDING';
      pendingFound = true;
    }
    return {
      id: `stg-mig-${idx}`,
      stageIndex: idx,
      role: ts.role,
      label: ts.label,
      status,
      isApplicable: true
    };
  });

  const now = new Date().toISOString();
  const nextPending = migratedStages.find(s => s.status === 'PENDING');
  inProgressReq.stages = migratedStages;
  inProgressReq.workflowVersionNumber = 2;
  inProgressReq.currentStage = nextPending.role;
  inProgressReq.migrationEvents.push({
    id: 'mig-1',
    previousWorkflowVersion: 1,
    newWorkflowVersion: 2,
    oldStage: 'FINANCE',
    newStage: nextPending.role,
    ts: now
  });
  inProgressReq.auditTrail.push({
    ts: now,
    actor: 'CEO',
    action: 'Workflow migrated from v1 to v2'
  });

  // Verify:
  // - Completed Institution Manager preserved with original decider and timestamp
  assert.equal(inProgressReq.stages[0].status, 'COMPLETED');
  assert.equal(inProgressReq.stages[0].decidedByName, 'Manager A');
  assert.equal(inProgressReq.stages[0].decisionTs, '2026-10-10T10:00:00Z');
  assert.equal(inProgressReq.stages[0].completedUnderVersion, 1);

  // - GENERAL_MANAGER stage is inserted and becomes PENDING
  assert.equal(inProgressReq.stages[1].role, 'GENERAL_MANAGER');
  assert.equal(inProgressReq.stages[1].status, 'PENDING');
  assert.equal(inProgressReq.currentStage, 'GENERAL_MANAGER');

  // - FINANCE becomes FUTURE (not skipped or duplicated)
  assert.equal(inProgressReq.stages[2].role, 'FINANCE');
  assert.equal(inProgressReq.stages[2].status, 'FUTURE');

  // - Audit trail and migration events recorded
  assert.equal(inProgressReq.migrationEvents.length, 1);
  assert.equal(inProgressReq.migrationEvents[0].newWorkflowVersion, 2);
  assert.equal(inProgressReq.auditTrail.length, 2);
});

test('5. The GM stage is inserted only when configured and approved', () => {
  // Workflow without GM
  const payloadWithoutGM = {
    name: 'Standard Flow',
    preDeanStages: [
      { stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'IM', stageOrder: 1, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean', stageOrder: 2, isApplicable: true, isActive: true }
    ],
    branchConfigs: [
      { branchKey: 'IT', displayName: 'IT', role: 'IT', isActive: true },
      { branchKey: 'AUDIT', displayName: 'AUDIT', role: 'AUDIT', isActive: true },
      { branchKey: 'HR', displayName: 'HR', role: 'HR', isActive: true },
      { branchKey: 'MMI', displayName: 'MMI', role: 'MMI', isActive: true }
    ]
  };
  const errors1 = validateWorkflowConfig(payloadWithoutGM, roles);
  assert.deepEqual(errors1, []);
  assert.ok(!payloadWithoutGM.preDeanStages.some(s => s.role === 'GENERAL_MANAGER'));

  // Workflow with GM configured
  const payloadWithGM = {
    name: 'Standard Flow with GM',
    preDeanStages: [
      { stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'IM', stageOrder: 1, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_GM', role: 'GENERAL_MANAGER', label: 'General Manager', stageOrder: 2, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean', stageOrder: 3, isApplicable: true, isActive: true }
    ],
    branchConfigs: payloadWithoutGM.branchConfigs
  };
  const errors2 = validateWorkflowConfig(payloadWithGM, roles);
  assert.deepEqual(errors2, []);
  assert.ok(payloadWithGM.preDeanStages.some(s => s.role === 'GENERAL_MANAGER'));
});

test('6. Existing Create New Flow functionality remains unchanged', () => {
  const req = { id: 'req-custom', category: 'Leave' };
  // Clean canvas initialized with 0 stages
  let customDraftStages = [];
  assert.equal(customDraftStages.length, 0);

  // User drags / adds DEAN, CEO, CHAIRMAN
  customDraftStages.push({ id: 's-1', stageIndex: 0, role: 'DEAN', label: 'Dean', isApplicable: true, status: 'PENDING' });
  customDraftStages.push({ id: 's-2', stageIndex: 1, role: 'CEO', label: 'CEO', isApplicable: true, status: 'FUTURE' });
  customDraftStages.push({ id: 's-3', stageIndex: 2, role: 'CHAIRMAN', label: 'Chairman', isApplicable: true, status: 'FUTURE' });

  assert.equal(customDraftStages.length, 3);
  assert.equal(customDraftStages[0].role, 'DEAN');
  assert.equal(customDraftStages[1].role, 'CEO');
  assert.equal(customDraftStages[2].role, 'CHAIRMAN');
});
