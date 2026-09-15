export type UserRole = string;

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'QUERIED' | 'ESCALATED';

export type RequestCategory = 'Leave' | 'Permission' | 'Purchase' | 'Travel' | 'Equipment' | 'Reimbursement' | 'Work From Home' | 'Other';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  dept: string;
  company: string;
  businessUnit: string;
}

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  department: string;
  amount: number;
  date: string;
  status: RequestStatus;
  category: RequestCategory;
  requester: string;
  description: string;
  hoursIdle: number;
  query?: string;
  auditTrail: AuditEntry[];
  company?: string;
  businessUnit?: string;
  requestType?: RequestCategory;
  purpose?: string;
  requestDetails?: Record<string, string>;
  flaggedAt?: string;
  assignedUserId?: string;
  assignedRole?: UserRole;
  createdAt: string;
  updatedAt: string;
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
