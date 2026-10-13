import {
  ApprovalRequest,
  ApprovalWorkflow,
  GeneralWorkflowConfig,
  RequestStageInstance,
  User,
  WorkflowApprovalEntry,
  WorkflowBranch,
  WorkflowMigrationEvent,
  WorkflowSnapshot
} from './types';

export const WORKFLOW_STORAGE_KEY = 'flownexus_approval_workflows_v1';

const roleNames: Record<string, string> = {
  MANAGER: 'Manager',
  HR: 'HR Head',
  IT: 'IT Head',
  FINANCE: 'Finance Head',
  ACCOUNTANT: 'Accountant',
  GENERAL_MANAGER: 'General Manager',
  CEO: 'CEO'
};

export const createDefaultWorkflows = (): ApprovalWorkflow[] => {
  const definitions: { branch: WorkflowBranch; name: string; roles: string[] }[] = [
    { branch: 'HR', name: 'HR Approval', roles: ['MANAGER', 'HR', 'GENERAL_MANAGER', 'CEO'] },
    { branch: 'IT', name: 'IT Approval', roles: ['MANAGER', 'IT', 'GENERAL_MANAGER', 'CEO'] },
    { branch: 'FINANCE', name: 'Finance Approval', roles: ['MANAGER', 'FINANCE', 'ACCOUNTANT', 'GENERAL_MANAGER', 'CEO'] }
  ];

  return definitions.map(({ branch, name, roles }) => ({
    id: `workflow-${branch.toLowerCase()}`,
    name,
    branch,
    version: 1,
    steps: roles.map((role, index) => ({ id: `${branch.toLowerCase()}-${index + 1}`, role })),
    active: true,
    updatedAt: new Date(0).toISOString()
  }));
};

export const toWorkflowSnapshot = (workflow: ApprovalWorkflow): WorkflowSnapshot => ({
  id: workflow.id,
  name: workflow.name,
  branch: workflow.branch,
  version: workflow.version || 1,
  steps: (workflow.steps || []).map(step => ({ ...step }))
});

export const validateWorkflow = (
  workflow: ApprovalWorkflow,
  availableRoles: string[]
): string[] => {
  const errors: string[] = [];
  const normalizedRoles = new Set(availableRoles.map(role => role.trim().toUpperCase()));
  const steps = workflow.steps || [];
  const roles = steps.map(step => step.role.trim().toUpperCase());

  if (!workflow.name.trim()) errors.push('Enter a workflow name.');
  if (!workflow.branch || !['HR', 'IT', 'FINANCE'].includes(workflow.branch)) errors.push('Choose a valid branch.');
  if (steps.length < 4) errors.push('A workflow must contain at least four approval steps.');
  if (roles[0] !== 'MANAGER') errors.push('The Manager must be the first approval step.');
  if (roles[roles.length - 1] !== 'CEO') errors.push('CEO must be the final approval step.');
  if (!roles.includes('GENERAL_MANAGER')) errors.push('The General Manager must remain in the workflow.');

  roles.forEach(role => {
    if (!normalizedRoles.has(role)) errors.push(`Role "${role}" does not exist.`);
    if (role === 'REQUESTER') errors.push('Requester cannot be an approval step.');
  });

  if (workflow.branch === 'HR' && !roles.includes('HR')) errors.push('The HR branch must include HR Head.');
  if (workflow.branch === 'IT' && !roles.includes('IT')) errors.push('The IT branch must include IT Head.');
  if (workflow.branch === 'FINANCE' && !roles.includes('ACCOUNTANT')) {
    errors.push('The Finance branch must include the Accountant.');
  }

  return [...new Set(errors)];
};

export const validateActiveWorkflows = (
  workflows: ApprovalWorkflow[],
  availableRoles: string[]
): string[] => {
  const active = workflows.filter(workflow => workflow.active);
  const errors = active.flatMap(workflow => validateWorkflow(workflow, availableRoles));
  for (const branch of ['HR', 'IT', 'FINANCE'] as WorkflowBranch[]) {
    if (active.filter(workflow => workflow.branch === branch).length > 1) {
      errors.push(`Only one active workflow is allowed for the ${branch} branch.`);
    }
  }
  return [...new Set(errors)];
};

export const loadWorkflows = (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  availableRoles: string[] = Object.keys(roleNames)
): ApprovalWorkflow[] => {
  const defaults = createDefaultWorkflows();
  try {
    const saved = storage.getItem(WORKFLOW_STORAGE_KEY);
    if (!saved) return defaults;
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return defaults;
    const workflows = parsed.filter((item): item is ApprovalWorkflow =>
      item && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      ['HR', 'IT', 'FINANCE'].includes(item.branch) &&
      Number.isInteger(item.version) && Array.isArray(item.steps) &&
      typeof item.active === 'boolean' &&
      item.steps.every((step: any) => step && typeof step.id === 'string' && typeof step.role === 'string')
    );
    const activeBranches = new Set<WorkflowBranch>();
    return workflows.map(workflow => {
      if (!workflow.active || !workflow.branch) return workflow;
      const invalid = validateWorkflow(workflow, availableRoles).length > 0 || activeBranches.has(workflow.branch);
      if (invalid) return { ...workflow, active: false };
      activeBranches.add(workflow.branch);
      return workflow;
    });
  } catch {
    return defaults;
  }
};

export const saveWorkflows = (
  workflows: ApprovalWorkflow[],
  storage: Pick<Storage, 'setItem'>
): void => {
  storage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflows));
};

export const captureActiveWorkflowSnapshots = (
  workflows: ApprovalWorkflow[]
): Partial<Record<WorkflowBranch, WorkflowSnapshot>> =>
  Object.fromEntries(workflows.filter(workflow => workflow.active && workflow.branch)
    .map(workflow => [workflow.branch as WorkflowBranch, toWorkflowSnapshot(workflow)])) as Partial<Record<WorkflowBranch, WorkflowSnapshot>>;

export const migrateRequestWorkflow = (
  request: ApprovalRequest,
  legacyWorkflows: ApprovalWorkflow[]
): ApprovalRequest => {
  if (request.workflowSnapshotsByBranch || request.workflowSnapshot) return request;

  const snapshots = captureActiveWorkflowSnapshots(legacyWorkflows);
  const auditBranch = request.auditTrail.find(entry => /routed to (HR|IT|Finance)/i.test(entry.action))?.action.match(/routed to (HR|IT|Finance)/i)?.[1]?.toUpperCase();
  const inferredBranch: WorkflowBranch = auditBranch === 'HR' || request.currentStage === 'HR' ||
    (!auditBranch && (request.category === 'Leave' || request.category === 'Permission'))
    ? 'HR'
    : auditBranch === 'IT' || request.currentStage === 'IT' ||
    (!auditBranch && (request.category === 'Equipment' || request.category === 'Work From Home'))
    ? 'IT'
    : 'FINANCE';
  const snapshot = snapshots[inferredBranch];

  if (request.currentStage === 'MANAGER' || request.currentStage === 'COMPLETED') {
    return { ...request, workflowSnapshotsByBranch: snapshots, approvalHistory: request.approvalHistory || [] };
  }

  if (!snapshot) return { ...request, workflowSnapshotsByBranch: snapshots, approvalHistory: request.approvalHistory || [] };
  const currentStepIndex = snapshot.steps.findIndex((step: any) => step.role === request.currentStage);
  return {
    ...request,
    workflowSnapshotsByBranch: snapshots,
    workflowSnapshot: snapshot,
    currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : 0,
    approvalHistory: request.approvalHistory || []
  };
};

const addApprovalEntry = (
  request: ApprovalRequest,
  user: User,
  action: WorkflowApprovalEntry['action'],
  ts: string,
  stepIndex: number
): WorkflowApprovalEntry[] => [
  ...(request.approvalHistory || []),
  { stepIndex, role: user.role, actorId: user.id, actorName: user.name, action, ts }
];

const branchForCategory = (category: ApprovalRequest['category']): WorkflowBranch => {
  if (category === 'Leave' || category === 'Permission') return 'HR';
  if (category === 'Equipment' || category === 'Work From Home') return 'IT';
  return 'FINANCE';
};

export const getNextWorkflowRole = (request: ApprovalRequest): string | null => {
  if (request.stages && request.stages.length > 0) {
    const currentPendingIdx = request.stages.findIndex(s => s.status === 'PENDING');
    if (currentPendingIdx >= 0) {
      for (let i = currentPendingIdx + 1; i < request.stages.length; i++) {
        if (request.stages[i].isApplicable && request.stages[i].status === 'FUTURE') {
          return request.stages[i].role;
        }
      }
      return 'COMPLETED';
    }
  }
  const snapshot = request.workflowSnapshot ||
    (request.currentStage === 'MANAGER' || request.currentStage === 'INSTITUTION_MANAGER' ? request.workflowSnapshotsByBranch?.[branchForCategory(request.category)] : undefined);
  const stepIndex = request.currentStepIndex ?? (request.currentStage === 'MANAGER' || request.currentStage === 'INSTITUTION_MANAGER' ? 0 : -1);
  const nextStep = snapshot?.steps[stepIndex + 1];
  return nextStep?.role || null;
};

export const routeRequestToBranch = (
  request: ApprovalRequest,
  user: User,
  branch: WorkflowBranch,
  ts: string
): ApprovalRequest => {
  if (user.role !== 'MANAGER' || request.status !== 'PENDING' || request.currentStage !== 'MANAGER') {
    throw new Error('Only the current Manager can route this pending request.');
  }
  const snapshot = request.workflowSnapshotsByBranch?.[branch];
  if (!snapshot || snapshot.steps[0]?.role !== 'MANAGER' || snapshot.steps[1] === undefined) {
    throw new Error(`No valid active workflow snapshot is available for ${branch}.`);
  }

  const firstNextStep = snapshot.steps[1];
  const action = `Manager routed request to ${roleNames[firstNextStep.role] || firstNextStep.role} (${branch})`;
  return {
    ...request,
    workflowSnapshot: snapshot,
    currentStepIndex: 1,
    selectedBranch: branch,
    currentStage: firstNextStep.role,
    assignedRole: firstNextStep.role,
    assignedUserId: undefined,
    status: 'PENDING',
    businessHoursIdle: 0,
    approvalHistory: addApprovalEntry(request, user, 'ROUTED', ts, 0),
    auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
  };
};

export const approveWorkflowStep = (
  request: ApprovalRequest,
  user: User,
  ts: string,
  allowHigherAuthorityOverride = false
): ApprovalRequest => {
  const higherAuthority = user.role === 'CEO' || user.role === 'GENERAL_MANAGER';
  const isEscalatedToCeo = request.status === 'ESCALATED' && user.role === 'CEO';
  const overrideAllowed = allowHigherAuthorityOverride && higherAuthority &&
    request.status === 'PENDING' && request.businessHoursIdle >= 6;
  let snapshot = request.workflowSnapshot;
  let stepIndex = request.currentStepIndex;

  if (request.currentStage === 'MANAGER' && overrideAllowed && !snapshot) {
    const branch = branchForCategory(request.category);
    snapshot = request.workflowSnapshotsByBranch?.[branch];
    stepIndex = 0;
  }

  if (isEscalatedToCeo && snapshot) {
    stepIndex = snapshot.steps.findIndex((step: any) => step.role === 'CEO');
  }
  const assignedActor = snapshot?.steps[stepIndex ?? -1]?.role === request.currentStage && request.currentStage === user.role;
  if ((!assignedActor && !overrideAllowed && !isEscalatedToCeo) || !snapshot || stepIndex === undefined ||
      request.status !== 'PENDING' && !isEscalatedToCeo) {
    throw new Error('This approval is not assigned to your role or is no longer pending.');
  }

  const nextIndex = stepIndex + 1;
  const nextStep = snapshot.steps[nextIndex];
  const completed = !nextStep;
  const action = isEscalatedToCeo
    ? `Escalated request approved by ${user.name} (CEO)`
    : overrideAllowed
    ? `Higher authority advanced request to ${nextStep?.role || 'final approval'}`
    : completed
    ? `Final approval granted by ${user.name} (${user.role})`
    : `Approved by ${user.name} (${user.role}) → Forwarded to ${roleNames[nextStep.role] || nextStep.role}`;

  return {
    ...request,
    workflowSnapshot: snapshot,
    selectedBranch: snapshot.branch,
    currentStepIndex: completed ? stepIndex : nextIndex,
    currentStage: completed ? 'COMPLETED' : nextStep.role,
    assignedRole: completed ? undefined : nextStep.role,
    assignedUserId: undefined,
    status: completed ? 'APPROVED' : 'PENDING',
    businessHoursIdle: 0,
    approvalHistory: addApprovalEntry(request, user, overrideAllowed || isEscalatedToCeo ? 'OVERRIDDEN' : 'APPROVED', ts, stepIndex),
    auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
  };
};

export const rejectWorkflowStep = (
  request: ApprovalRequest,
  user: User,
  ts: string,
  reason?: string
): ApprovalRequest => {
  const snapshot = request.workflowSnapshot;
  const stepIndex = request.currentStepIndex;
  const isManagerBeforeBranch = request.currentStage === 'MANAGER' && !snapshot && user.role === 'MANAGER';
  if (request.status !== 'PENDING' || request.currentStage !== user.role ||
      (!isManagerBeforeBranch && (!snapshot || stepIndex === undefined || snapshot.steps[stepIndex]?.role !== request.currentStage))) {
    throw new Error('Only the assigned approver can reject this pending request.');
  }
  const action = `Request rejected by ${user.name} (${user.role})${reason ? ` — ${reason}` : ''}`;
  return {
    ...request,
    status: 'REJECTED',
    businessHoursIdle: 0,
    approvalHistory: addApprovalEntry(request, user, 'REJECTED', ts, stepIndex ?? 0),
    auditTrail: [...request.auditTrail, { ts, actor: `${user.name} (${user.role})`, action }]
  };
};

export const getRoleLabel = (role: string): string => roleNames[role] || role;

export const isFinanceCategory = (category?: string, requestType?: string): boolean => {
  const c = String(category || '').trim().toLowerCase();
  const rt = String(requestType || '').trim().toLowerCase();
  return c === 'purchase' || c === 'reimbursement' || c === 'finance' ||
         rt === 'purchase' || rt === 'reimbursement' || rt === 'finance';
};

export const GENERAL_WORKFLOW_STORAGE_KEY = 'flownexus_general_workflow_v1';

export const DEFAULT_GENERAL_WORKFLOW: GeneralWorkflowConfig = {
  id: 'workflow-general',
  name: 'General Approval Workflow',
  version: 1,
  active: true,
  activatedAt: '2026-01-01T00:00:00.000Z',
  activatedBy: 'System',
  stages: [
    { id: 'gw-1', stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-2', stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance Head', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-3', stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-4', stageKey: 'STAGE_VP', role: 'VP', label: 'Vice President', stageOrder: 4, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-5', stageKey: 'STAGE_HOI', role: 'HOI', label: 'Head of Institution', stageOrder: 5, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-6', stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean Checkpoint', stageOrder: 6, stageType: 'DEAN', isApplicable: true },
    { id: 'gw-7', stageKey: 'STAGE_CEO', role: 'CEO', label: 'Chief Executive Officer', stageOrder: 7, stageType: 'POST_BRANCH', isApplicable: true },
    { id: 'gw-8', stageKey: 'STAGE_CHAIRMAN', role: 'CHAIRMAN', label: 'Chairman', stageOrder: 8, stageType: 'POST_BRANCH', isApplicable: true }
  ],
  branchConfigs: [
    { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
    { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
    { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
    { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
  ],
  history: [
    { version: 1, activatedAt: '2026-01-01T00:00:00.000Z', activatedBy: 'System', reason: 'Initial baseline workflow configuration' }
  ]
};

export const loadGeneralWorkflow = (storage?: Pick<Storage, 'getItem' | 'setItem'>): GeneralWorkflowConfig => {
  try {
    const raw = storage ? storage.getItem(GENERAL_WORKFLOW_STORAGE_KEY) : (typeof localStorage !== 'undefined' ? localStorage.getItem(GENERAL_WORKFLOW_STORAGE_KEY) : null);
    if (!raw) return DEFAULT_GENERAL_WORKFLOW;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.stages)) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_GENERAL_WORKFLOW;
};

export const saveGeneralWorkflow = (config: GeneralWorkflowConfig, storage?: Pick<Storage, 'setItem'>): void => {
  try {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (target) {
      target.setItem(GENERAL_WORKFLOW_STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // ignore
  }
};

export const applyGeneralWorkflowToRequest = (
  request: ApprovalRequest,
  generalWorkflow: GeneralWorkflowConfig,
  user: User,
  reason?: string
): ApprovalRequest => {
  const ts = new Date().toISOString();
  const prevVersion = request.workflowVersionNumber || 1;
  const newVersion = generalWorkflow.version;

  // Preserve all completed stages with their original timestamps and decisions
  const existingStages = (request.stages || []) as RequestStageInstance[];
  const completedStages = existingStages.filter(s => s.status === 'COMPLETED');
  const completedRoles = new Set(completedStages.map(s => s.role));

  const newStages: RequestStageInstance[] = [];

  // Add the completed stages first or in order
  completedStages.forEach((s, idx) => {
    newStages.push({
      ...s,
      stageIndex: idx,
      completedUnderVersion: s.completedUnderVersion || prevVersion
    });
  });

  // Next, map remaining stages from the new general workflow
  let pendingSet = false;
  generalWorkflow.stages.forEach((gwStage) => {
    // If already completed in past, skip re-adding
    if (completedRoles.has(gwStage.role)) return;

    const isApplicable = gwStage.isApplicable !== false;
    let status: RequestStageInstance['status'] = 'FUTURE';

    if (!isApplicable) {
      status = 'SKIPPED';
    } else if (!pendingSet) {
      status = 'PENDING';
      pendingSet = true;
    }

    newStages.push({
      id: `stg-migrated-${gwStage.role.toLowerCase()}-${Date.now()}`,
      stageIndex: newStages.length,
      stageKey: gwStage.stageKey || `STAGE_${gwStage.role}`,
      role: gwStage.role,
      label: gwStage.label,
      status,
      isApplicable,
      notes: null
    });
  });

  // Re-index all stages
  newStages.forEach((s, i) => { s.stageIndex = i; });

  const activePendingStage = newStages.find(s => s.status === 'PENDING');

  const migrationEvent: WorkflowMigrationEvent = {
    id: `mig-${Date.now()}`,
    requestId: request.id,
    actorId: user.id || 'usr-ceo',
    actorName: user.name,
    actorRole: user.role,
    reason: reason || `Migrated to General Workflow v${newVersion}`,
    previousWorkflowVersion: prevVersion,
    newWorkflowVersion: newVersion,
    oldStage: request.currentStage,
    newStage: activePendingStage?.role || request.currentStage,
    ts
  };

  return {
    ...request,
    workflowVersionNumber: newVersion,
    stages: newStages,
    currentStage: activePendingStage?.role || request.currentStage,
    assignedRole: activePendingStage?.role || request.assignedRole,
    migrationEvents: [...(request.migrationEvents || []), migrationEvent],
    updatedAt: ts,
    auditTrail: [
      ...request.auditTrail,
      {
        ts,
        actor: `${user.name} (${user.role})`,
        action: `Workflow updated to v${newVersion}${reason ? `: ${reason}` : ''}`
      }
    ]
  };
};