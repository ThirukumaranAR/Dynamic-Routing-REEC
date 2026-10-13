import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ApprovalRequest, RequestCategory, User, WorkflowBranch } from '../models/types';
import { prisma, withTransaction, writeAuditEvent } from '../services/db';
import {
  approveWorkflowStep,
  getDefaultGeneralWorkflow,
  getDefaultWorkflowById,
  getDepartmentRoleForRequestType,
  initializeRequestWorkflow,
  rejectWorkflowStep,
  resolveWorkflowIdForRequestType,
  routeRequestToBranch
} from '../services/workflowService';

const timestamp = () => new Date().toISOString();
const formatDate = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const calculateBusinessIdle = (updatedAt: string, storedHours: number) => {
  const start = new Date(updatedAt);
  const end = new Date();
  if (!Number.isFinite(start.getTime()) || start >= end) return storedHours || 0;
  let minutes = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  for (let day = 0; cursor <= end && day < 3660; day++, cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() === 0 || cursor.getDay() === 6) continue;
    const open = new Date(cursor);
    open.setHours(9, 0, 0, 0);
    const close = new Date(cursor);
    close.setHours(17, 0, 0, 0);
    minutes += Math.max(0, Math.min(end.getTime(), close.getTime()) - Math.max(start.getTime(), open.getTime())) / 60000;
  }
  return Math.round((storedHours + minutes / 60) * 10) / 10;
};

const isOwner = (request: ApprovalRequest, user: User) => request.requesterId
  ? request.requesterId === user.id
  : request.requesterEmail?.toLowerCase() === user.email.toLowerCase() || request.requester === user.name;

const isAdmin = (user: User) => user.role === 'CEO' || user.role === 'CHAIRMAN';

const canViewRequest = (request: ApprovalRequest, user: User) => {
  if (isAdmin(user) || isOwner(request, user)) return true;
  if (user.role === 'REQUESTER') return false;
  if (request.status === 'QUERIED') {
    const latestQuery = [...(request.queryThread || [])].reverse().find(message => message.kind === 'QUERY');
    return latestQuery?.authorId === user.id || request.queryRaisedByUserId === user.id;
  }
  return request.assignedUserId === user.id || request.currentStage === user.role ||
    request.approvalHistory?.some(event => event.actorId === user.id) === true ||
    request.stages?.some(s => s.role === user.role && s.isApplicable !== false) === true;
};

const requestForViewer = (request: ApprovalRequest, user: User) => {
  const idleHours = request.status === 'PENDING' ? calculateBusinessIdle(request.updatedAt, request.hoursIdle) : request.hoursIdle;
  const safe = { ...request, hoursIdle: idleHours, businessHoursIdle: idleHours } as ApprovalRequest & { businessHoursIdle: number };
  if (isAdmin(user) || isOwner(request, user)) return safe;
  const latestQuery = [...(request.queryThread || [])].reverse().find(message => message.kind === 'QUERY');
  if (latestQuery?.authorId === user.id || request.queryRaisedByUserId === user.id) return safe;
  return {
    ...safe,
    query: undefined,
    queryRaisedByUserId: undefined,
    queryRaisedByName: undefined,
    queryThread: [],
    auditTrail: safe.auditTrail.filter(entry => !/query|clarification response/i.test(entry.action))
  };
};

const appendAudit = (request: ApprovalRequest, user: User, action: string, ts: string) => ({
  ...request,
  auditTrail: [...(request.auditTrail || []), { ts, actor: `${user.name} (${user.role})`, action }],
  updatedAt: ts
});

export const mapPrismaRequest = (r: any): ApprovalRequest => {
  let auditTrail: any[] = [];
  if (r.auditTrailJson) {
    try { auditTrail = JSON.parse(r.auditTrailJson); } catch {}
  }

  let stages: any[] = [];
  if (r.stagesJson) {
    try { stages = JSON.parse(r.stagesJson); } catch {}
  } else if (Array.isArray(r.stages)) {
    stages = r.stages.map((s: any) => ({
      id: s.id,
      stageIndex: s.stageIndex,
      stageKey: s.stageKey,
      role: s.role,
      label: s.label,
      status: s.status,
      isApplicable: s.isApplicable !== false,
      decidedByUserId: s.decidedByUserId || undefined,
      decidedByName: s.decidedByName || undefined,
      decidedByRole: s.decidedByRole || undefined,
      decisionAction: s.decisionAction || undefined,
      decisionTs: s.decisionTs || undefined,
      notes: s.notes || undefined
    }));
  }

  return {
    id: r.id,
    title: r.title,
    department: r.department,
    amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : null,
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
    auditTrail,
    stages,
    attachments: (r.attachments || []).map((att: any) => ({
      id: att.id,
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
  };
};

const mutateRequest = async (
  requestId: string,
  user: User,
  action: string,
  mutate: (request: ApprovalRequest, ts: string) => ApprovalRequest
): Promise<ApprovalRequest | null> => {
  return withTransaction(async tx => {
    const raw = await tx.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        stages: { orderBy: { stageIndex: 'asc' } },
        attachments: true,
        queryThread: { orderBy: { ts: 'asc' } },
        approvalHistory: { orderBy: { stepIndex: 'asc' } },
        migrationEvents: { orderBy: { ts: 'asc' } }
      }
    });
    if (!raw) return null;

    const current = mapPrismaRequest(raw);
    const idleRequest = current.status === 'PENDING'
      ? { ...current, hoursIdle: calculateBusinessIdle(current.updatedAt, current.hoursIdle) }
      : current;

    const ts = timestamp();
    const updated = mutate(idleRequest, ts);

    // Synchronize stages table
    if (updated.stages && updated.stages.length) {
      await tx.requestStageInstance.deleteMany({ where: { requestId } });
      for (const stg of updated.stages) {
        await tx.requestStageInstance.create({
          data: {
            id: randomUUID(),
            requestId,
            stageIndex: stg.stageIndex ?? 0,
            stageKey: stg.stageKey || `STAGE_${stg.role}`,
            role: stg.role,
            label: stg.label || stg.role,
            status: stg.status,
            isApplicable: stg.isApplicable !== false,
            decidedByUserId: stg.decidedByUserId || null,
            decidedByName: stg.decidedByName || null,
            decidedByRole: stg.decidedByRole || null,
            decisionAction: stg.decisionAction || null,
            decisionTs: stg.decisionTs || null,
            notes: stg.notes || null
          }
        });
      }
    }

    // Synchronize approval decisions
    if (updated.approvalHistory && updated.approvalHistory.length) {
      await tx.approvalDecision.deleteMany({ where: { requestId } });
      for (const dec of updated.approvalHistory) {
        await tx.approvalDecision.create({
          data: {
            id: randomUUID(),
            requestId,
            stepIndex: dec.stepIndex,
            role: dec.role,
            actorId: dec.actorId || null,
            actorName: dec.actorName,
            actorRole: dec.role,
            action: dec.action,
            ts: dec.ts
          }
        });
      }
    }

    // Synchronize query thread
    if (updated.queryThread && updated.queryThread.length) {
      await tx.queryMessage.deleteMany({ where: { requestId } });
      for (const q of updated.queryThread) {
        await tx.queryMessage.create({
          data: {
            id: q.id || randomUUID(),
            requestId,
            authorId: q.authorId,
            authorName: q.authorName,
            authorRole: q.authorRole,
            kind: q.kind,
            text: q.text,
            ts: q.ts
          }
        });
      }
    }

    await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        title: updated.title,
        amount: updated.amount,
        status: updated.status,
        currentStage: updated.currentStage,
        currentStepIndex: updated.currentStepIndex ?? 0,
        assignedRole: updated.assignedRole || null,
        assignedUserId: updated.assignedUserId || null,
        selectedBranch: updated.selectedBranch || null,
        workflowVersionNumber: updated.workflowVersionNumber ?? 1,
        query: updated.query || null,
        queryRaisedByUserId: updated.queryRaisedByUserId || null,
        queryRaisedByName: updated.queryRaisedByName || null,
        flagged: Boolean(updated.flagged),
        flaggedAt: updated.flaggedAt || null,
        hoursIdle: updated.hoursIdle || 0,
        auditTrailJson: JSON.stringify(updated.auditTrail || []),
        stagesJson: JSON.stringify(updated.stages || []),
        workflowSnapshotJson: updated.workflowSnapshot ? JSON.stringify(updated.workflowSnapshot) : null,
        updatedAt: ts
      }
    });

    await writeAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action,
      targetType: 'Request',
      targetId: requestId
    }, tx);

    return updated;
  });
};

const errorResponse = (res: Response, error: any) => {
  if (error?.name === 'VersionError' || error?.code === 112 || error?.code === 251 || error?.code === 'P2034') {
    return res.status(409).json({ success: false, message: 'The request changed concurrently. Refresh and try again.' });
  }
  const message = error instanceof Error ? error.message : 'The request could not be updated';
  const unauthorized = /not assigned|only (the|current) (current |assigned |requester|owner)?|only higher authority/i.test(message);
  return res.status(unauthorized ? 403 : 400).json({ success: false, message });
};

const validCategories: RequestCategory[] = ['Leave', 'Permission', 'Purchase', 'Travel', 'Equipment', 'Reimbursement', 'Work From Home', 'Other'];

export const getAllRequests = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const rawRequests = await prisma.approvalRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      stages: { orderBy: { stageIndex: 'asc' } },
      attachments: true,
      queryThread: true,
      approvalHistory: true,
      migrationEvents: true
    }
  });

  let requests = rawRequests.map(mapPrismaRequest).filter(request => canViewRequest(request, user));
  if (req.query.status && req.query.status !== 'ALL') requests = requests.filter(request => request.status === req.query.status);
  if (req.query.category && req.query.category !== 'ALL') requests = requests.filter(request => request.category === req.query.category);
  return res.json({ success: true, count: requests.length, requests: requests.map(request => requestForViewer(request, user)) });
};

export const getRequestById = async (req: AuthenticatedRequest, res: Response) => {
  const raw = await prisma.approvalRequest.findUnique({
    where: { id: req.params.id },
    include: {
      stages: { orderBy: { stageIndex: 'asc' } },
      attachments: true,
      queryThread: true,
      approvalHistory: true,
      migrationEvents: true
    }
  });
  if (!raw) {
    console.error('[DEBUG getRequestById] NOT FOUND in db. id:', req.params.id, 'user:', req.user?.role, req.user?.email);
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  const request = mapPrismaRequest(raw);
  if (!canViewRequest(request, req.user!)) {
    console.error('[DEBUG getRequestById] canViewRequest returned FALSE. id:', req.params.id, 'user:', req.user?.role);
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  return res.json({ success: true, request: requestForViewer(request, req.user!) });
};

const normalizeRequestType = (raw: string | undefined): string => {
  if (!raw) return 'IT Request';
  const s = String(raw).trim();
  if (/^it(\s+request)?$/i.test(s)) return 'IT Request';
  if (/^audit(\s+request)?$/i.test(s)) return 'Audit Request';
  if (/^hr(\s+request)?$/i.test(s)) return 'HR Request';
  if (/^mmi(\s+request)?$/i.test(s)) return 'MMI Request';
  return s;
};

export const createRequest = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (!user || user.isActive === false) return res.status(403).json({ success: false, message: 'Active account required to submit requests' });

  // Explicit role-based request creation permission check:
  // Allowed: REQUESTER, INSTITUTION_MANAGER, MANAGER, FINANCE, ACCOUNTANT, VP, HOI, DEAN
  // Strictly Forbidden: IT, AUDIT, HR, MMI, CEO, CHAIRMAN
  const forbiddenRoles = ['IT', 'AUDIT', 'HR', 'MMI', 'CEO', 'CHAIRMAN'];
  if (forbiddenRoles.includes(user.role)) {
    return res.status(403).json({ success: false, message: `Request creation is strictly rejected for ${user.role}` });
  }

  const allowedRoles = ['REQUESTER', 'INSTITUTION_MANAGER', 'MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ success: false, message: `Role ${user.role} is not permitted to create requests` });
  }

  const { title, category, requestType, amount, description, purpose, requestDetails, attachments } = req.body;

  // Resolve Request Type: IT Request | Audit Request | HR Request | MMI Request (or legacy category)
  const canonicalRequestType = normalizeRequestType(requestType || category);

  // Cost / Amount is strictly optional. If provided, validate as non-negative number.
  let numericAmount: number | null = null;
  if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ success: false, message: 'Cost must be a valid non-negative number if specified' });
    }
    numericAmount = parsed;
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, message: 'A request title is required' });
  }

  const validCategory: RequestCategory = (category && validCategories.includes(category))
    ? category
    : 'Purchase';

  const safeDescription = (typeof description === 'string' && description.trim()) || (typeof purpose === 'string' && purpose.trim()) || '';
  if (!safeDescription) return res.status(400).json({ success: false, message: 'Purpose and description are required' });
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  if (safeAttachments.some(file => !file || typeof file.name !== 'string' || typeof file.type !== 'string')) {
    return res.status(400).json({ success: false, message: 'Attachments must include valid file metadata' });
  }

  const activeWorkflows = await prisma.workflowDefinition.findMany({ where: { active: true } });
  if (!activeWorkflows.length) return res.status(409).json({ success: false, message: 'No active approval workflow is available' });

  // Resolve target workflow definition for the selected request type
  const targetWorkflowId = resolveWorkflowIdForRequestType(canonicalRequestType);
  const targetDef = await prisma.workflowDefinition.findUnique({
    where: { id: targetWorkflowId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  let resolvedWorkflow = getDefaultWorkflowById(targetWorkflowId);
  if (targetDef?.versions[0]?.stagesJson) {
    try {
      const parsed = JSON.parse(targetDef.versions[0].stagesJson);
      resolvedWorkflow = {
        id: targetDef.id,
        name: targetDef.name,
        version: targetDef.currentVersion,
        stages: parsed.stages || [],
        branchConfigs: parsed.branchConfigs || [],
        history: parsed.history || [],
        active: true,
        activatedAt: targetDef.versions[0].publishedAt,
        activatedBy: targetDef.versions[0].publishedBy
      };
    } catch {}
  }

  // Verify that all active approvers in the workflow stages exist and are active in the system
  const activeUsers = await prisma.user.findMany({ where: { isActive: true }, select: { role: true } });
  const userRoles = new Set(activeUsers.map(u => u.role));
  const stagesToVerify = (resolvedWorkflow.stages || []).filter((s: any) => s.isApplicable !== false);
  const missingRoles = stagesToVerify.filter((s: any) => s.role && !userRoles.has(s.role));
  if (missingRoles.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Workflow cannot be initiated: missing active authorized approver for role(s): ${missingRoles.map((s: any) => s.role).join(', ')}`
    });
  }

  const generalDef = await prisma.workflowDefinition.findUnique({
    where: { id: 'workflow-general' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  let generalWorkflow = getDefaultGeneralWorkflow();
  if (generalDef?.versions[0]?.stagesJson) {
    try {
      const parsed = JSON.parse(generalDef.versions[0].stagesJson);
      generalWorkflow = {
        id: generalDef.id,
        name: generalDef.name,
        version: generalDef.currentVersion,
        stages: parsed.stages || [],
        branchConfigs: parsed.branchConfigs || [],
        history: parsed.history || [],
        active: true,
        activatedAt: generalDef.versions[0].publishedAt,
        activatedBy: generalDef.versions[0].publishedBy
      };
    } catch {}
  }

  const ts = timestamp();
  const reqId = `REQ-${randomUUID().slice(0, 8).toUpperCase()}`;
  const request = initializeRequestWorkflow({
    id: reqId,
    title: title.trim(),
    department: user.dept,
    amount: numericAmount,
    date: formatDate(),
    status: 'PENDING',
    currentStage: 'INSTITUTION_MANAGER',
    category: validCategory,
    requestType: canonicalRequestType,
    requester: user.name,
    requesterId: user.id,
    requesterEmail: user.email,
    description: safeDescription,
    purpose: safeDescription,
    requestDetails,
    hoursIdle: 0,
    company: user.company,
    businessUnit: user.businessUnit,
    attachments: safeAttachments.map((file: any) => ({
      id: randomUUID(),
      name: file.name,
      size: file.size || '',
      type: file.type,
      dataUrl: file.dataUrl
    })),
    auditTrail: [
      { ts, actor: user.name, action: `Request submitted (${canonicalRequestType}) with ${safeAttachments.length} attachment(s)` },
      { ts, actor: 'System', action: 'Assigned for approval workflow' }
    ],
    createdAt: ts,
    updatedAt: ts
  }, activeWorkflows as any, generalWorkflow, resolvedWorkflow);

  await withTransaction(async tx => {
    await tx.approvalRequest.create({
      data: {
        id: request.id,
        title: request.title,
        department: request.department,
        amount: request.amount ?? null,
        date: request.date,
        status: request.status,
        category: request.category,
        requestType: request.requestType || request.category,
        requester: request.requester,
        requesterId: request.requesterId || null,
        requesterEmail: request.requesterEmail || null,
        description: request.description,
        purpose: request.purpose || null,
        requestDetailsJson: request.requestDetails ? JSON.stringify(request.requestDetails) : null,
        company: request.company || 'FlowNexus',
        businessUnit: request.businessUnit || 'Main',
        campus: request.campus || null,
        institution: request.institution || null,
        hoursIdle: 0,
        currentStage: request.currentStage,
        currentStepIndex: request.currentStepIndex || 0,
        assignedRole: request.assignedRole || request.currentStage,
        assignedUserId: request.assignedUserId || null,
        selectedBranch: request.selectedBranch || null,
        workflowVersionNumber: request.workflowVersionNumber || 1,
        workflowSnapshotJson: request.workflowSnapshot ? JSON.stringify(request.workflowSnapshot) : null,
        query: null,
        flagged: false,
        auditTrailJson: JSON.stringify(request.auditTrail || []),
        stagesJson: JSON.stringify(request.stages || []),
        createdAt: ts,
        updatedAt: ts
      }
    });

    if (request.stages && request.stages.length) {
      for (const stg of request.stages) {
        await tx.requestStageInstance.create({
          data: {
            id: randomUUID(),
            requestId: request.id,
            stageIndex: stg.stageIndex ?? 0,
            stageKey: stg.stageKey || `STAGE_${stg.role}`,
            role: stg.role,
            label: stg.label || stg.role,
            status: stg.status,
            isApplicable: stg.isApplicable !== false,
            decidedByUserId: stg.decidedByUserId || null,
            decidedByName: stg.decidedByName || null,
            decidedByRole: stg.decidedByRole || null,
            decisionAction: stg.decisionAction || null,
            decisionTs: stg.decisionTs || null,
            notes: stg.notes || null
          }
        });
      }
    }

    if (request.attachments && request.attachments.length) {
      for (const att of request.attachments) {
        await tx.requestAttachment.create({
          data: {
            id: randomUUID(),
            requestId: request.id,
            name: att.name,
            size: att.size || '',
            type: att.type,
            dataUrl: att.dataUrl || null
          }
        });
      }
    }

    await writeAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'Request created',
      targetType: 'Request',
      targetId: request.id
    }, tx);
  });

  return res.status(201).json({
    success: true,
    message: 'Request submitted successfully',
    request: requestForViewer(request, user)
  });
};

export const routeRequest = async (req: AuthenticatedRequest, res: Response) => {
  const branch = String(req.body.branch || '').toUpperCase() as WorkflowBranch;
  const validBranches = ['IT', 'AUDIT', 'HR', 'MMI', 'FINANCE'];
  if (!validBranches.includes(branch)) {
    return res.status(400).json({ success: false, message: 'Choose IT, Audit, HR, or MMI branch' });
  }
  try {
    const request = await mutateRequest(
      req.params.id,
      req.user!,
      'Request routed',
      (current, ts) => routeRequestToBranch(current, req.user!, branch, ts)
    );
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const approveRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await mutateRequest(req.params.id, req.user!, 'Request approval', (current, ts) => {
      if (req.body.override === 'direct') {
        if (!isAdmin(req.user!) && req.user!.role !== 'GENERAL_MANAGER') throw new Error('Only higher authority may directly clear a request.');
        if (current.status !== 'PENDING' || current.hoursIdle < 6) throw new Error('Direct clearance is only allowed after the six-hour SLA threshold.');
        return {
          ...appendAudit(
            { ...current, status: 'APPROVED', currentStage: 'COMPLETED', assignedUserId: undefined, assignedRole: undefined, hoursIdle: 0 },
            req.user!,
            'Direct executive clearance granted',
            ts
          ),
          approvalHistory: [
            ...(current.approvalHistory || []),
            { stepIndex: current.currentStepIndex ?? -1, role: req.user!.role, actorId: req.user!.id, actorName: req.user!.name, action: 'OVERRIDDEN', ts }
          ]
        };
      }
      return approveWorkflowStep(current, req.user!, ts, req.body.override === 'advance', req.body.branch);
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const rejectRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await mutateRequest(
      req.params.id,
      req.user!,
      'Request rejected',
      (current, ts) => rejectWorkflowStep(current, req.user!, ts, req.body.reason)
    );
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const raiseQuery = async (req: AuthenticatedRequest, res: Response) => {
  const text = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  if (!text) return res.status(400).json({ success: false, message: 'Query text is required' });
  try {
    const request = await mutateRequest(req.params.id, req.user!, 'Clarification query raised', (current, ts) => {
      if (current.status !== 'PENDING' || current.currentStage !== req.user!.role || (current.assignedUserId && current.assignedUserId !== req.user!.id)) {
        throw new Error('Only the current assigned approver can raise a query');
      }
      const message = { id: randomUUID(), authorId: req.user!.id, authorName: req.user!.name, authorRole: req.user!.role, kind: 'QUERY' as const, text, ts };
      return appendAudit(
        { ...current, status: 'QUERIED', query: text, queryRaisedByUserId: req.user!.id, queryRaisedByName: req.user!.name, queryThread: [...(current.queryThread || []), message], hoursIdle: 0 },
        req.user!,
        `Query raised: "${text}"`,
        ts
      );
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const respondToQuery = async (req: AuthenticatedRequest, res: Response) => {
  const text = typeof req.body.response === 'string' ? req.body.response.trim() : '';
  if (!text) return res.status(400).json({ success: false, message: 'Response text is required' });
  try {
    const request = await mutateRequest(req.params.id, req.user!, 'Requester responded to query', (current, ts) => {
      if (req.user!.role !== 'REQUESTER' || !isOwner(current, req.user!) || current.status !== 'QUERIED') {
        throw new Error('Only the owner of an active query can respond');
      }
      const message = { id: randomUUID(), authorId: req.user!.id, authorName: req.user!.name, authorRole: req.user!.role, kind: 'RESPONSE' as const, text, ts };
      const revisedAmount = req.body.amount === undefined
        ? current.amount
        : (req.body.amount === null || req.body.amount === '' ? null : Number(req.body.amount));
      if (revisedAmount !== null && revisedAmount !== undefined && (!Number.isFinite(revisedAmount) || revisedAmount < 0)) {
        throw new Error('Revised amount must be non-negative');
      }
      const resumed = {
        ...current,
        title: typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : current.title,
        amount: revisedAmount,
        description: typeof req.body.description === 'string' && req.body.description.trim() ? req.body.description.trim() : current.description,
        status: 'PENDING' as const,
        query: undefined,
        queryRaisedByUserId: undefined,
        queryRaisedByName: undefined,
        queryThread: [...(current.queryThread || []), message],
        hoursIdle: 0
      };
      return appendAudit(resumed, req.user!, `Requester responded: "${text}"`, ts);
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const setRequestFlag = async (req: AuthenticatedRequest, res: Response) => {
  if (!isAdmin(req.user!)) return res.status(403).json({ success: false, message: 'Only CEO or Chairman may flag requests' });
  const flagged = req.method !== 'DELETE' && req.body.flagged !== false;
  try {
    const request = await mutateRequest(
      req.params.id,
      req.user!,
      flagged ? 'Request flagged for oversight' : 'Request flag cleared',
      (current, ts) => appendAudit({ ...current, flagged, flaggedAt: flagged ? ts : undefined }, req.user!, flagged ? 'Request flagged for oversight' : 'Request flag cleared', ts)
    );
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const escalateRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await mutateRequest(req.params.id, req.user!, 'Request escalated', (current, ts) => {
      const assignedApprover = current.status === 'PENDING' && current.currentStage === req.user!.role;
      const higherAuthority = req.user!.role === 'CEO' || req.user!.role === 'CHAIRMAN' || req.user!.role === 'GENERAL_MANAGER';
      if (!assignedApprover && !higherAuthority) throw new Error('Only the assigned approver or higher authority can escalate');
      if (current.status !== 'PENDING' || current.hoursIdle < 6) throw new Error('Only pending requests idle at least six business hours can be escalated');
      return appendAudit(
        { ...current, status: 'ESCALATED', currentStage: 'CEO', assignedRole: 'CEO', assignedUserId: undefined, hoursIdle: 0 },
        req.user!,
        'Escalated to CEO after SLA breach',
        ts
      );
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const reassignRequest = async (req: AuthenticatedRequest, res: Response) => {
  if (!isAdmin(req.user!)) return res.status(403).json({ success: false, message: 'Only CEO or Chairman can reassign escalated requests' });
  const target = await prisma.user.findFirst({
    where: {
      id: req.body.targetUserId,
      isActive: true,
      role: { notIn: ['CEO', 'CHAIRMAN', 'REQUESTER'] }
    }
  });
  if (!target) return res.status(400).json({ success: false, message: 'Choose a valid active approver' });
  try {
    const request = await mutateRequest(req.params.id, req.user!, 'Escalated request reassigned', (current, ts) => {
      if (current.status !== 'ESCALATED') throw new Error('Only escalated requests can be reassigned');
      return appendAudit(
        { ...current, status: 'PENDING', currentStage: target.role, assignedUserId: target.id, assignedRole: target.role, hoursIdle: 0 },
        req.user!,
        `Escalated request reassigned to ${target.name} (${target.role})`,
        ts
      );
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, request: requestForViewer(request, req.user!) });
  } catch (error) {
    return errorResponse(res, error);
  }
};