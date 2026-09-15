export type UserRole = string;

export type ApprovalStage = string;

export interface User {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  dept: string;
  company: string;
  businessUnit: string;
}

export type UserAccount = User & { password?: string };

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'QUERIED' | 'ESCALATED';

export type RequestCategory = 'Leave' | 'Permission' | 'Purchase' | 'Travel' | 'Equipment' | 'Reimbursement' | 'Work From Home' | 'Other';

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
}

export interface RequestAttachment {
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  department: string;
  purpose?: string;
  amount: number;
  date: string;
  status: RequestStatus;
  category: RequestCategory;
  requestType?: RequestCategory;
  requester: string;
  description: string;
  currentStage: ApprovalStage;
  businessHoursIdle: number; // 8-hour SLA clock (9 AM - 5 PM, Mon-Fri)
  query?: string;
  company?: string;
  businessUnit?: string;
  requestDetails?: Record<string, string>;
  flaggedAt?: string;
  attachments?: RequestAttachment[];
  auditTrail: AuditEntry[];
  assignedUserId?: string;
  assignedRole?: string;
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
  | 'user-management';
