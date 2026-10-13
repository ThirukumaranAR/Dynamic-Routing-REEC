import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../services/db';
import { ApprovalRequest, User } from '../models/types';

const canSeeStats = (request: ApprovalRequest, user: User) => {
  if (user.role === 'CEO' || user.role === 'CHAIRMAN') return true;
  if (user.role === 'REQUESTER') return request.requesterId === user.id || request.requesterEmail === user.email;
  return request.currentStage === user.role || request.assignedUserId === user.id ||
    request.approvalHistory?.some(entry => entry.actorId === user.id) === true ||
    request.stages?.some(s => s.role === user.role && s.isApplicable !== false) === true;
};

const mapPrismaRequest = (r: any): ApprovalRequest => ({
  id: r.id,
  title: r.title,
  department: r.department,
  amount: Number(r.amount),
  date: r.date,
  status: r.status as any,
  category: r.category as any,
  requestType: (r.requestType || r.category) as any,
  requester: r.requester,
  requesterId: r.requesterId || undefined,
  requesterEmail: r.requesterEmail || undefined,
  description: r.description,
  purpose: r.purpose || r.description,
  requestDetails: r.requestDetailsJson ? JSON.parse(r.requestDetailsJson) : undefined,
  company: r.company || 'FlowNexus',
  businessUnit: r.businessUnit || 'Main',
  campus: r.campus || undefined,
  institution: r.institution || undefined,
  hoursIdle: r.hoursIdle || 0,
  currentStage: r.currentStage,
  currentStepIndex: r.currentStepIndex || 0,
  assignedRole: r.assignedRole || undefined,
  assignedUserId: r.assignedUserId || undefined,
  selectedBranch: r.selectedBranch || undefined,
  workflowVersionNumber: r.workflowVersionNumber || 1,
  workflowVersionId: r.workflowVersionId || undefined,
  workflowSnapshot: r.workflowSnapshotJson ? JSON.parse(r.workflowSnapshotJson) : undefined,
  query: r.query || undefined,
  queryRaisedByUserId: r.queryRaisedByUserId || undefined,
  queryRaisedByName: r.queryRaisedByName || undefined,
  flagged: Boolean(r.flagged),
  flaggedAt: r.flaggedAt || undefined,
  auditTrail: r.auditTrailJson ? JSON.parse(r.auditTrailJson) : [],
  stages: r.stagesJson ? JSON.parse(r.stagesJson) : (r.stages || []),
  attachments: (r.attachments || []).map((att: any) => ({
    name: att.name,
    size: att.size,
    type: att.type,
    dataUrl: att.dataUrl || undefined
  })),
  queryThread: (r.queryThread || []).map((qm: any) => ({
    id: qm.id,
    authorId: qm.authorId,
    authorName: qm.authorName,
    authorRole: qm.authorRole,
    kind: qm.kind as any,
    text: qm.text,
    ts: qm.ts
  })),
  approvalHistory: (r.approvalHistory || []).map((ah: any) => ({
    stepIndex: ah.stepIndex,
    role: ah.role,
    actorId: ah.actorId || undefined,
    actorName: ah.actorName,
    action: ah.action as any,
    ts: ah.ts
  })),
  migrationEvents: (r.migrationEvents || []).map((me: any) => ({
    id: me.id,
    requestId: me.requestId,
    actorId: me.actorId,
    actorName: me.actorName,
    actorRole: me.actorRole,
    reason: me.reason,
    previousWorkflowVersion: me.previousWorkflowVersion,
    newWorkflowVersion: me.newWorkflowVersion,
    oldStage: me.oldStage || null,
    newStage: me.newStage || null,
    ts: me.ts
  })),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt
});

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const [allDbRequests, policies] = await Promise.all([
    prisma.approvalRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        stages: true,
        attachments: true,
        queryThread: true,
        approvalHistory: true,
        migrationEvents: true
      }
    }),
    prisma.sOP.count()
  ]);

  const requests = allDbRequests.map(mapPrismaRequest).filter(request => canSeeStats(request, user));
  const total = requests.length;
  const approved = requests.filter(request => request.status === 'APPROVED').length;
  const rejected = requests.filter(request => request.status === 'REJECTED').length;
  const pending = requests.filter(request => request.status === 'PENDING').length;
  const queries = requests.filter(request => request.status === 'QUERIED').length;
  const escalated = requests.filter(request => request.status === 'ESCALATED').length;
  const completionRate = total ? Math.round(approved / total * 100) : 0;
  const rejectionRate = total ? Math.round(rejected / total * 100) : 0;

  return res.json({
    success: true,
    metrics: { total, pending, approved, rejected, queries, escalated, policies },
    completionAnalytics: {
      completionRate: `${completionRate}%`,
      approvedRatio: `${approved} of ${total} requests approved`,
      pendingResolution: pending + queries,
      rejectionRate: `${rejectionRate}%`,
      rejectedCount: `${rejected} requests rejected`,
      avgResolutionTime: 'Not enough history',
      slaThreshold: '6 business hours'
    },
    statusBreakdown: ['APPROVED', 'PENDING', 'QUERIED', 'REJECTED', 'ESCALATED'].map(status => {
      const count = requests.filter(request => request.status === status).length;
      return { status, count, percentage: total ? Math.round(count / total * 100) : 0 };
    }),
    recentRequests: requests.slice(0, 5)
  });
};

export const getFlowCategories = async (_req: AuthenticatedRequest, res: Response) => {
  const categories = ['Leave', 'Permission', 'Purchase', 'Travel', 'Equipment', 'Reimbursement', 'Work From Home', 'Other'];
  const counts = await prisma.approvalRequest.groupBy({
    by: ['category'],
    _count: { id: true }
  });
  const countMap = new Map(counts.map(item => [item.category, item._count.id]));
  return res.json({
    success: true,
    categories: categories.map(category => ({
      category,
      count: countMap.get(category) || 0,
      description: 'Requests in this category'
    }))
  });
};

export const getSOPs = async (_req: AuthenticatedRequest, res: Response) => {
  const sops = await prisma.sOP.findMany({ orderBy: { id: 'asc' } });
  return res.json({ success: true, sops });
};