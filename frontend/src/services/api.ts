import { User, ApprovalRequest, ApprovalStage } from './types';

export function canViewActiveQuery(request: ApprovalRequest, user: User): boolean {
  if (request.status !== 'QUERIED' || user.role === 'CEO' || user.role === 'CHAIRMAN') return true;
  const ownsRequest = request.requesterId
    ? user.id === request.requesterId
    : request.requesterEmail
    ? request.requesterEmail.toLowerCase() === user.email.toLowerCase()
    : request.requester === user.name;
  const latestQuery = [...(request.queryThread || [])].reverse().find(message => message.kind === 'QUERY');
  const authoredQuery = latestQuery?.authorId === user.id || request.queryRaisedByUserId === user.id ||
    (!request.queryRaisedByUserId && latestQuery?.authorName === user.name);
  return ownsRequest || authoredQuery;
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function isCurrentlyBusinessHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours() + now.getMinutes() / 60;
  return day >= 1 && day <= 5 && hours >= 9 && hours < 17;
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'REQUESTER': return 'Requester';
    case 'INSTITUTION_MANAGER': return 'Institution Manager';
    case 'FINANCE': return 'Finance Head';
    case 'ACCOUNTANT': return 'Accountant';
    case 'VP': return 'VP';
    case 'HOI': return 'HOI';
    case 'DEAN': return 'Dean';
    case 'IT': return 'IT';
    case 'AUDIT': return 'Audit';
    case 'HR': return 'HR';
    case 'MMI': return 'MMI';
    case 'CEO': return 'CEO';
    case 'CHAIRMAN': return 'Chairman';
    case 'COMPLETED': return 'Completed & Approved';
    // Legacy support
    case 'MANAGER': return 'Institution Manager';
    case 'GENERAL_MANAGER':
    case 'GM': return 'General Manager';
    default: return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

export function getStageActorName(stage: ApprovalStage): string {
  switch (stage) {
    case 'INSTITUTION_MANAGER': return 'Assigned Institution Manager';
    case 'FINANCE': return 'Assigned Finance Officer';
    case 'ACCOUNTANT': return 'Assigned Accountant';
    case 'VP': return 'Assigned Vice President';
    case 'HOI': return 'Assigned Head of Institution';
    case 'DEAN': return 'Assigned Dean';
    case 'IT': return 'Assigned IT Branch Head';
    case 'AUDIT': return 'Assigned Audit Branch Head';
    case 'HR': return 'Assigned HR Branch Head';
    case 'MMI': return 'Assigned MMI Branch Head';
    case 'CEO': return 'Chief Executive Officer';
    case 'CHAIRMAN': return 'Chairman of the Board';
    case 'COMPLETED': return 'Approved & Finalized';
    case 'STAGE_BRANCH': return 'Assigned Branch Approver';
    case 'MANAGER': return 'Assigned Institution Manager';
    case 'GENERAL_MANAGER':
    case 'GM': return 'Assigned General Manager';
    default: return `Assigned ${getRoleDisplayName(stage)}`;
  }
}