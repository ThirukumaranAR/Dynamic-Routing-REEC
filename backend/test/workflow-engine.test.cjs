const assert = require('node:assert/strict');
const test = require('node:test');
const {
  validateWorkflowConfig,
  createRequestStageInstances,
  determineDefaultBranchForCategory,
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

test('Workflow config validation validates required pre-Dean stages and Dean checkpoint', () => {
  const validPayload = {
    name: 'Standard Academic Approval Flow',
    preDeanStages: [
      { stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance', stageOrder: 2, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_VP', role: 'VP', label: 'VP', stageOrder: 4, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_HOI', role: 'HOI', label: 'HOI', stageOrder: 5, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean', stageOrder: 6, isApplicable: true, isActive: true }
    ],
    branchConfigs: [
      { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
      { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
      { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
      { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
    ]
  };

  const errors = validateWorkflowConfig(validPayload, roles);
  assert.deepEqual(errors, [], 'Valid payload should have 0 errors');
});

test('Workflow config validation rejects missing Dean or missing required post-Dean branches', () => {
  const missingDean = {
    name: 'Missing Dean',
    preDeanStages: [
      { stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, isApplicable: true, isActive: true }
    ],
    branchConfigs: [
      { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
      { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
      { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
      { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
    ]
  };
  const errorsMissingDean = validateWorkflowConfig(missingDean, roles);
  assert.ok(errorsMissingDean.some(e => e.includes('Dean stage')), 'Must require Dean checkpoint');

  const missingBranches = {
    name: 'Missing Branches',
    preDeanStages: [
      { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean', stageOrder: 1, isApplicable: true, isActive: true }
    ],
    branchConfigs: [
      { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true }
    ]
  };
  const errorsMissingBranches = validateWorkflowConfig(missingBranches, roles);
  assert.ok(errorsMissingBranches.some(e => e.includes('AUDIT')), 'Must require AUDIT branch');
  assert.ok(errorsMissingBranches.some(e => e.includes('HR')), 'Must require HR branch');
  assert.ok(errorsMissingBranches.some(e => e.includes('MMI')), 'Must require MMI branch');
});

test('Workflow config rejects duplicates and invalid roles', () => {
  const invalidPayload = {
    name: 'Duplicate stages',
    preDeanStages: [
      { stageKey: 'STAGE_IM1', role: 'INSTITUTION_MANAGER', label: 'IM 1', stageOrder: 1, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_IM2', role: 'INSTITUTION_MANAGER', label: 'IM 2', stageOrder: 2, isApplicable: true, isActive: true },
      { stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean', stageOrder: 3, isApplicable: true, isActive: true }
    ],
    branchConfigs: [
      { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
      { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
      { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
      { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
    ]
  };
  const errors = validateWorkflowConfig(invalidPayload, roles);
  assert.ok(errors.some(e => e.includes('Duplicate pre-Dean approval stage')));
});

test('Stage instance generation supports marking Institution Manager as not applicable', () => {
  const workflowVersionWithImNotApplicable = {
    id: 'wf-v2',
    workflowId: 'wf-main',
    version: 2,
    name: 'Flow with IM disabled',
    isPublished: true,
    publishedAt: new Date().toISOString(),
    publishedBy: 'ceo-user-id',
    stages: [
      { id: 's1', stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, stageType: 'PRE_DEAN', isApplicable: false, isActive: true },
      { id: 's2', stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true, isActive: true },
      { id: 's3', stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, stageType: 'PRE_DEAN', isApplicable: true, isActive: true },
      { id: 's4', stageKey: 'STAGE_VP', role: 'VP', label: 'VP', stageOrder: 4, stageType: 'PRE_DEAN', isApplicable: true, isActive: true },
      { id: 's5', stageKey: 'STAGE_HOI', role: 'HOI', label: 'HOI', stageOrder: 5, stageType: 'PRE_DEAN', isApplicable: true, isActive: true },
      { id: 's6', stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean', stageOrder: 6, stageType: 'DEAN', isApplicable: true, isActive: true },
      { id: 's7', stageKey: 'STAGE_CEO', role: 'CEO', label: 'CEO', stageOrder: 7, stageType: 'POST_BRANCH', isApplicable: true, isActive: true },
      { id: 's8', stageKey: 'STAGE_CHAIRMAN', role: 'CHAIRMAN', label: 'Chairman', stageOrder: 8, stageType: 'POST_BRANCH', isApplicable: true, isActive: true }
    ],
    branches: [
      { id: 'b1', branchKey: 'IT', displayName: 'IT', role: 'IT', isActive: true, stageOrder: 1 },
      { id: 'b2', branchKey: 'AUDIT', displayName: 'Audit', role: 'AUDIT', isActive: true, stageOrder: 2 },
      { id: 'b3', branchKey: 'HR', displayName: 'HR', role: 'HR', isActive: true, stageOrder: 3 },
      { id: 'b4', branchKey: 'MMI', displayName: 'MMI', role: 'MMI', isActive: true, stageOrder: 4 }
    ]
  };

  const { stages, initialStage } = createRequestStageInstances(workflowVersionWithImNotApplicable, 'IT');
  assert.equal(initialStage, 'FINANCE', 'When Institution Manager is not applicable, initial stage should be FINANCE');

  const imStage = stages.find(s => s.role === 'INSTITUTION_MANAGER');
  assert.ok(imStage);
  assert.equal(imStage.status, 'SKIPPED');
  assert.equal(imStage.isApplicable, false);

  const financeStage = stages.find(s => s.role === 'FINANCE');
  assert.ok(financeStage);
  assert.equal(financeStage.status, 'PENDING');
  assert.equal(financeStage.isApplicable, true);

  const branchStage = stages.find(s => s.stageKey === 'STAGE_BRANCH');
  assert.ok(branchStage);
  assert.equal(branchStage.role, 'IT');
});

test('Category default branch mapping routes correctly', () => {
  assert.equal(determineDefaultBranchForCategory('Leave'), 'HR');
  assert.equal(determineDefaultBranchForCategory('Permission'), 'HR');
  assert.equal(determineDefaultBranchForCategory('Equipment'), 'IT');
  assert.equal(determineDefaultBranchForCategory('Work From Home'), 'IT');
  assert.equal(determineDefaultBranchForCategory('Purchase'), 'AUDIT');
  assert.equal(determineDefaultBranchForCategory('Reimbursement'), 'AUDIT');
  assert.equal(determineDefaultBranchForCategory('Other'), 'MMI');
});
