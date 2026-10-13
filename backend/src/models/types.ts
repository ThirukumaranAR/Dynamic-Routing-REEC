export type UserRole = string;

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'QUERIED' | 'ESCALATED';

export type RequestCategory = 'Leave' | 'Permission' | 'Purchase' | 'Travel' | 'Equipment' | 'Reimbursement' | 'Work From Home' | 'Other';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
}

export type PostDeanBranch = 'IT' | 'AUDIT' | 'HR' | 'MMI';
export const POST_DEAN_BRANCHES: PostDeanBranch[] = ['IT', 'AUDIT', 'HR', 'MMI'];

export const normalizeRole = (role?: string): string => {
  if (!role) return '';
  return role.trim().toUpperCase().replace(/[\s-]+/g, '_');
};

export type WorkflowBranch = PostDeanBranch | 'HR' | 'IT' | 'FINANCE';

export interface WorkflowStep {
  id: string;
  role: UserRole;
  label?: string;
  isApplicable?: boolean;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  branch: WorkflowBranch;
  version: number;
  steps: WorkflowStep[];
  active: boolean;
  updatedAt: string;
}

export interface WorkflowSnapshot {
  id: string;
  name: string;
  branch: WorkflowBranch;
  version: number;
  steps: WorkflowStep[];
}

export interface WorkflowApprovalEntry {
  stepIndex: number;
  role: UserRole;
  actorId?: string;
  actorName: string;
  action: 'APPROVED' | 'REJECTED' | 'ROUTED' | 'OVERRIDDEN';
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

export interface RequestStageInstance {
  id: string;
  stageIndex: number;
  stageKey: string;
  role: UserRole;
  label: string;
  status: 'PENDING' | 'COMPLETED' | 'SUPERSEDED' | 'SKIPPED' | 'REJECTED' | 'FUTURE';
  isApplicable: boolean;
  stageType?: string;
  decidedByUserId?: string | null;
  decidedByName?: string | null;
  decidedByRole?: string | null;
  decisionAction?: string | null;
  decisionTs?: string | null;
  notes?: string | null;
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

export interface GeneralWorkflowVersion {
  id: string;
  name: string;
  version: number;
  stages: {
    id: string;
    stageKey: string;
    role: string;
    label: string;
    stageOrder: number;
    stageType?: string;
    isApplicable: boolean;
  }[];
  branchConfigs: {
    branchKey: PostDeanBranch;
    displayName: string;
    role: string;
    isActive: boolean;
  }[];
  active: boolean;
  activatedAt: string;
  activatedBy: string;
  history?: Array<{
    version: number;
    activatedAt: string;
    activatedBy: string;
    reason?: string;
  }>;
}

export type OfficialRequestType = 'IT Request' | 'Audit Request' | 'HR Request' | 'MMI Request';
export const OFFICIAL_REQUEST_TYPES: OfficialRequestType[] = ['IT Request', 'Audit Request', 'HR Request', 'MMI Request'];

export interface ApprovalRequest {
  id: string;
  title: string;
  department: string;
  amount?: number | null;
  date: string;
  status: RequestStatus;
  category: RequestCategory;
  requester: string;
  requesterId?: string;
  requesterEmail?: string;
  description: string;
  hoursIdle: number;
  currentStage: string;
  query?: string;
  queryRaisedByUserId?: string;
  queryRaisedByName?: string;
  auditTrail: AuditEntry[];
  company?: string;
  businessUnit?: string;
  campus?: string;
  institution?: string;
  requestType?: string | null;
  purpose?: string;
  requestDetails?: Record<string, string>;
  flaggedAt?: string;
  assignedUserId?: string;
  assignedRole?: UserRole;
  workflowSnapshotsByBranch?: Partial<Record<WorkflowBranch, WorkflowSnapshot>>;
  workflowSnapshot?: WorkflowSnapshot;
  workflowVersionNumber?: number;
  workflowVersionId?: string;
  stages?: RequestStageInstance[];
  migrationEvents?: WorkflowMigrationEvent[];
  selectedBranch?: WorkflowBranch;
  currentStepIndex?: number;
  approvalHistory?: WorkflowApprovalEntry[];
  attachments?: { name: string; size: string; type: string; dataUrl?: string }[];
  queryThread?: QueryMessage[];
  flagged?: boolean;
  createdAt: string;
  updatedAt: string;
  revision?: number;
}

export interface SOPItem {
  id: string;
  title: string;
  desc: string;
  date: string;
  pdfUrl?: string;
}

export interface DashboardMetrics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  queries: number;
  policies: number;
}
