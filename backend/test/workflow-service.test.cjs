const assert = require('node:assert/strict');
const test = require('node:test');
const {
  approveWorkflowStep,
  createDefaultWorkflows,
  initializeRequestWorkflow,
  rejectWorkflowStep,
  routeRequestToBranch,
  validateWorkflow
} = require('../dist/services/workflowService.js');

const roles = ['REQUESTER', 'MANAGER', 'HR', 'IT', 'FINANCE', 'ACCOUNTANT', 'GENERAL_MANAGER', 'CEO', 'LEGAL_REVIEWER'];
const manager = { id: 'manager-1', name: 'Manager', role: 'MANAGER' };
const now = '2026-10-09 10:00';

const requestDraft = (category = 'Leave') => ({
  id: 'REQ-TEST',
  title: 'Test request',
  department: 'Operations',
  amount: 100,
  date: '09/10/2026',
  status: 'PENDING',
  category,
  requester: 'Requester',
  requesterId: 'requester-1',
  requesterEmail: 'requester@example.test',
  description: 'Test',
  hoursIdle: 0,
  currentStage: 'MANAGER',
  auditTrail: [],
  createdAt: now,
  updatedAt: now
});

test('defaults preserve the HR, IT, and Finance approval chains', () => {
  const workflows = createDefaultWorkflows();
  assert.deepEqual(workflows.map(workflow => workflow.steps.map(step => step.role)), [
    ['MANAGER', 'HR', 'GENERAL_MANAGER', 'CEO'],
    ['MANAGER', 'IT', 'GENERAL_MANAGER', 'CEO'],
    ['MANAGER', 'FINANCE', 'ACCOUNTANT', 'GENERAL_MANAGER', 'CEO']
  ]);
  assert.deepEqual(workflows.flatMap(workflow => validateWorkflow(workflow, roles)), []);
});

test('custom roles can be inserted and receive approvals without engine changes', () => {
  const workflows = createDefaultWorkflows();
  const hrWorkflow = workflows.find(workflow => workflow.branch === 'HR');
  hrWorkflow.version = 2;
  hrWorkflow.steps.splice(1, 0, { id: 'hr-legal', role: 'LEGAL_REVIEWER' });
  assert.deepEqual(validateWorkflow(hrWorkflow, roles), []);

  const request = initializeRequestWorkflow(requestDraft(), workflows);
  const routed = routeRequestToBranch(request, manager, 'HR', now);
  assert.equal(routed.currentStage, 'LEGAL_REVIEWER');
  const legalReviewer = { id: 'legal-1', name: 'Legal Reviewer', role: 'LEGAL_REVIEWER' };
  const forwarded = approveWorkflowStep(routed, legalReviewer, now);
  assert.equal(forwarded.currentStage, 'HR');
  assert.equal(forwarded.currentStepIndex, 2);
});

test('requests keep their captured workflow version after an administrator changes it', () => {
  const workflows = createDefaultWorkflows();
  const existingRequest = initializeRequestWorkflow(requestDraft(), workflows);
  workflows.find(workflow => workflow.branch === 'HR').version = 8;
  workflows.find(workflow => workflow.branch === 'HR').steps.splice(1, 0, { id: 'hr-legal', role: 'LEGAL_REVIEWER' });

  const routed = routeRequestToBranch(existingRequest, manager, 'HR', now);
  assert.equal(routed.workflowSnapshot.version, 1);
  assert.equal(routed.currentStage, 'HR');
});

test('Finance workflow cannot be saved without the Accountant step', () => {
  const financeWorkflow = createDefaultWorkflows().find(workflow => workflow.branch === 'FINANCE');
  financeWorkflow.steps = financeWorkflow.steps.filter(step => step.role !== 'ACCOUNTANT');
  assert.ok(validateWorkflow(financeWorkflow, roles).some(error => error.includes('Accountant')));
});

test('unauthorized, out-of-order, and duplicate approvals are rejected', () => {
  const request = initializeRequestWorkflow(requestDraft(), createDefaultWorkflows());
  assert.throws(() => routeRequestToBranch(request, { ...manager, role: 'HR' }, 'HR', now));

  const routed = routeRequestToBranch(request, manager, 'HR', now);
  assert.throws(() => approveWorkflowStep(routed, manager, now));
  const hrUser = { id: 'hr-1', name: 'HR', role: 'HR' };
  const advanced = approveWorkflowStep(routed, hrUser, now);
  assert.equal(advanced.currentStage, 'GENERAL_MANAGER');
  assert.throws(() => approveWorkflowStep(advanced, hrUser, now));
});

test('Manager can reject before branch selection without losing the audit trail', () => {
  const request = initializeRequestWorkflow(requestDraft(), createDefaultWorkflows());
  const rejected = rejectWorkflowStep(request, manager, now, 'Insufficient details');
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.auditTrail.length, 1);
  assert.match(rejected.auditTrail[0].action, /Insufficient details/);
});