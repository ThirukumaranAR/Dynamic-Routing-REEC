export type StandardRole =
  | 'REQUESTER'
  | 'INSTITUTION_MANAGER'
  | 'FINANCE'
  | 'ACCOUNTANT'
  | 'VP'
  | 'HOI'
  | 'DEAN'
  | 'IT'
  | 'AUDIT'
  | 'HR'
  | 'MMI'
  | 'GENERAL_MANAGER'
  | 'CEO'
  | 'CHAIRMAN';

export type UserRole = StandardRole | string;

export const STANDARD_ROLES: { name: StandardRole; displayName: string; canCreate: boolean }[] = [
  { name: 'REQUESTER', displayName: 'Requester', canCreate: true },
  { name: 'INSTITUTION_MANAGER', displayName: 'Institution Manager', canCreate: true },
  { name: 'FINANCE', displayName: 'Finance', canCreate: true },
  { name: 'ACCOUNTANT', displayName: 'Accountant', canCreate: true },
  { name: 'VP', displayName: 'VP', canCreate: true },
  { name: 'HOI', displayName: 'HOI', canCreate: true },
  { name: 'DEAN', displayName: 'Dean', canCreate: true },
  { name: 'GENERAL_MANAGER', displayName: 'General Manager', canCreate: true },
  { name: 'IT', displayName: 'IT', canCreate: false },
  { name: 'AUDIT', displayName: 'Audit', canCreate: false },
  { name: 'HR', displayName: 'HR', canCreate: false },
  { name: 'MMI', displayName: 'MMI', canCreate: false },
  { name: 'CEO', displayName: 'CEO', canCreate: false },
  { name: 'CHAIRMAN', displayName: 'Chairman', canCreate: false }
];

export const CAN_CREATE_REQUEST_ROLES: string[] = [
  'REQUESTER',
  'INSTITUTION_MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'VP',
  'HOI',
  'DEAN'
];

export const FORBIDDEN_CREATE_REQUEST_ROLES: string[] = [
  'IT',
  'AUDIT',
  'HR',
  'MMI',
  'CEO',
  'CHAIRMAN'
];

export const canCreateRequests = (role?: string): boolean => {
  if (!role) return false;
  return !FORBIDDEN_CREATE_REQUEST_ROLES.includes(role);
};

export type PostDeanBranch = 'IT' | 'AUDIT' | 'HR' | 'MMI';
export const POST_DEAN_BRANCHES: PostDeanBranch[] = ['IT', 'AUDIT', 'HR', 'MMI'];

export type ApprovalStage = string;

export interface User {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  dept: string;
  company: string;
  businessUnit: string;
  campus?: string;
  institution?: string;
  phone?: string;
  employeeId?: string;
  isActive?: boolean;
}

export type UserAccount = User & { password?: string };

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'QUERIED' | 'ESCALATED' | 'COMPLETED';

export type RequestCategory = 'Leave' | 'Permission' | 'Purchase' | 'Travel' | 'Equipment' | 'Reimbursement' | 'Work From Home' | 'Other';
export const REQUEST_CATEGORIES: RequestCategory[] = [
  'Leave',
  'Permission',
  'Purchase',
  'Travel',
  'Equipment',
  'Reimbursement',
  'Work From Home',
  'Other'
];

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
}

export type WorkflowBranch = PostDeanBranch | 'HR' | 'IT' | 'FINANCE';

export interface WorkflowStageConfig {
  id: string;
  stageKey: string;
  role: UserRole;
  label: string;
  stageOrder: number;
  stageType: 'PRE_DEAN' | 'DEAN' | 'BRANCH' | 'POST_BRANCH' | 'CUSTOM';
  isApplicable: boolean;
  isActive: boolean;
}

export interface WorkflowBranchOption {
  id: string;
  branchKey: PostDeanBranch;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  stageOrder: number;
}

export interface WorkflowVersionDetail {
  id: string;
  workflowId: string;
  version: number;
  name: string;
  description?: string | null;
  isPublished: boolean;
  publishedAt: string;
  publishedBy: string;
  stages: WorkflowStageConfig[];
  branches: WorkflowBranchOption[];
}

export interface WorkflowSnapshot {
  id: string;
  name: string;
  branch?: WorkflowBranch;
  version: number;
  steps: { id: string; role: UserRole }[];
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  active?: boolean;
  currentVersion?: number;
  versions?: WorkflowVersionDetail[];
  branch?: WorkflowBranch;
  version?: number;
  steps?: { id: string; role: UserRole }[];
  updatedAt?: string;
}

export interface RequestStageInstance {
  id: string;
  stageIndex: number;
  stageKey: string;
  role: UserRole;
  label: string;
  status: 'PENDING' | 'COMPLETED' | 'SUPERSEDED' | 'SKIPPED' | 'REJECTED' | 'FUTURE';
  isApplicable: boolean;
  decidedByUserId?: string | null;
  decidedByName?: string | null;
  decidedByRole?: string | null;
  decisionAction?: string | null;
  decisionTs?: string | null;
  notes?: string | null;
  completedUnderVersion?: number | null;
}

export interface GeneralWorkflowConfig {
  id: string;
  name: string;
  version: number;
  active: boolean;
  activatedAt: string;
  activatedBy: string;
  stages: Array<{
    id: string;
    stageKey: string;
    role: string;
    label: string;
    stageOrder: number;
    stageType?: string;
    isApplicable: boolean;
  }>;
  branchConfigs: Array<{
    branchKey: PostDeanBranch;
    displayName: string;
    role: string;
    isActive: boolean;
  }>;
  history?: Array<{
    version: number;
    activatedAt: string;
    activatedBy: string;
    reason?: string;
  }>;
}

export interface WorkflowApprovalEntry {
  stepIndex: number;
  role: UserRole;
  actorId?: string;
  actorName: string;
  action: 'APPROVED' | 'REJECTED' | 'ROUTED' | 'OVERRIDDEN' | 'SUPERSEDED';
  notes?: string;
  ts: string;
}

export interface WorkflowMigrationEvent {
  id: string;
  requestId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  reason: string;
  previousWorkflowVersion: number;
  newWorkflowVersion: number;
  oldStage?: string | null;
  newStage?: string | null;
  affectedStagesJson?: string | null;
  ts: string;
}

export interface QueryMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  kind: 'QUERY' | 'RESPONSE';
  text: string;
  ts: string;
}

export interface RequestAttachment {
  id?: string;
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
}

export type OfficialRequestType = 'IT Request' | 'Audit Request' | 'HR Request' | 'MMI Request';
export const OFFICIAL_REQUEST_TYPES: OfficialRequestType[] = [
  'IT Request',
  'Audit Request',
  'HR Request',
  'MMI Request'
];

export interface WorkflowConfigSummary {
  id: string;
  name: string;
  department: string | null;
  description: string;
  version: number;
  active: boolean;
  hasDraft: boolean;
  stageCount: number;
  updatedAt: string;
}

export interface WorkflowConfigDetail {
  id: string;
  name: string;
  department: string | null;
  description?: string;
  version: number;
  active: boolean;
  stages: Array<{
    id: string;
    stageKey: string;
    role: string;
    label: string;
    stageOrder: number;
    stageType?: string;
    isApplicable: boolean;
  }>;
  branchConfigs?: Array<{
    branchKey: PostDeanBranch;
    displayName: string;
    role: string;
    isActive: boolean;
  }>;
  history?: Array<{
    version: number;
    activatedAt: string;
    activatedBy: string;
    reason?: string;
  }>;
  draftStages?: Array<any> | null;
  activatedAt?: string;
  activatedBy?: string;
  updatedAt?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  department: string;
  purpose?: string;
  amount: number | null;
  date: string;
  status: RequestStatus;
  category: RequestCategory;
  requestType?: string | null;
  requester: string;
  requesterId?: string;
  requesterEmail?: string;
  description: string;
  currentStage: ApprovalStage;
  businessHoursIdle: number;
  hoursIdle?: number;
  query?: string;
  queryRaisedByUserId?: string;
  queryRaisedByName?: string;
  company?: string;
  businessUnit?: string;
  campus?: string;
  institution?: string;
  requestDetails?: Record<string, string>;
  flaggedAt?: string;
  flagged?: boolean;
  attachments?: RequestAttachment[];
  queryThread?: QueryMessage[];
  auditTrail: AuditEntry[];
  assignedUserId?: string;
  assignedRole?: string;
  selectedBranch?: PostDeanBranch | WorkflowBranch;
  workflowVersionNumber?: number;
  workflowVersionId?: string;
  currentStepIndex?: number;
  stages?: RequestStageInstance[];
  approvalHistory?: WorkflowApprovalEntry[];
  migrationEvents?: WorkflowMigrationEvent[];
  workflowSnapshotsByBranch?: any;
  workflowSnapshot?: any;
  createdAt?: string;
  updatedAt?: string;
}

export type NavigationTab =
  | 'dashboard'
  | 'all-requests'
  | 'create-request'
  | 'flow-categories'
  | 'queries'
  | 'flagged-requests'
  | 'completion-status'
  | 'my-profile'
  | 'user-management'
  | 'workflow-management'
  | 'ceo-account-management';
