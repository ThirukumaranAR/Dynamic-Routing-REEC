import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ApprovalWorkflow, PostDeanBranch, User, WorkflowBranch } from '../models/types';
import { prisma, withTransaction, writeAuditEvent } from '../services/db';
import { hashPassword } from '../services/auth';
import {
  getDefaultGeneralWorkflow,
  getRoleDisplayName,
  validateActiveWorkflows,
  validateWorkflow,
  validateWorkflowConfig
} from '../services/workflowService';

const safeUser = (user: Record<string, any>) => {
  const { passwordHash: _, ...result } = user;
  return result;
};

const auditActor = (req: AuthenticatedRequest) => ({
  actorId: req.user!.id,
  actorName: req.user!.name,
  actorRole: req.user!.role
});

const privilegedRoles = ['CEO', 'CHAIRMAN'];

export const listManagementData = async (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const isChairman = currentUser.role === 'CHAIRMAN';

  const [roles, allUsers] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: {
        isActive: true,
        // Chairman sees CEO accounts too (only excludes CHAIRMAN).
        // CEO excludes both CEO and CHAIRMAN.
        role: isChairman ? { not: 'CHAIRMAN' } : { notIn: privilegedRoles }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        dept: true,
        company: true,
        businessUnit: true,
        campus: true,
        institution: true,
        phone: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { name: 'asc' }
    })
  ]);

  // Roles available for assignment:
  // Chairman can assign CEO, but not CHAIRMAN.
  // CEO cannot assign CEO or CHAIRMAN.
  const assignableRoles = roles
    .map(r => r.name)
    .filter(r => isChairman ? r !== 'CHAIRMAN' : !privilegedRoles.includes(r));

  return res.json({
    success: true,
    roles: assignableRoles,
    users: allUsers.map(safeUser)
  });
};

export const listRoles = async (_req: AuthenticatedRequest, res: Response) => {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  return res.json({ success: true, roles });
};

export const createManagedUser = async (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const { name, email, password, role, dept, company, businessUnit, phone, employeeId } = req.body;
  const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!name?.trim() || !normalizedEmail || !password || String(password).length < 12 || !normalizedRole || !dept?.trim()) {
    return res.status(400).json({ success: false, message: 'Name, email, password (12+ characters), role, and department are required' });
  }

  // Security restrictions
  if (normalizedRole === 'CHAIRMAN') {
    return res.status(403).json({ success: false, message: 'Chairman assignment is restricted to secure bootstrap.' });
  }
  if (normalizedRole === 'CEO' && currentUser.role !== 'CHAIRMAN') {
    return res.status(403).json({ success: false, message: 'Only the Chairman may create CEO accounts.' });
  }
  if (privilegedRoles.includes(normalizedRole) && currentUser.role !== 'CHAIRMAN') {
    return res.status(403).json({ success: false, message: 'CEO accounts require Chairman authorization; Chairman assignment is restricted to bootstrap.' });
  }

  const roleRecord = await prisma.role.findUnique({ where: { name: normalizedRole } });
  if (!roleRecord) {
    return res.status(400).json({ success: false, message: 'Create the role before assigning it to a user' });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const created = await withTransaction(async tx => {
      const user = await tx.user.create({
        data: {
          id,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: await hashPassword(String(password)),
          role: normalizedRole,
          dept: dept.trim(),
          company: String(company || 'FlowNexus').trim(),
          businessUnit: String(businessUnit || 'Main').trim(),
          phone: String(phone || '').trim(),
          employeeId: String(employeeId || '').trim(),
          isActive: true,
          createdAt: now,
          updatedAt: now
        }
      });
      await writeAuditEvent({
        ...auditActor(req),
        action: `${normalizedRole === 'CEO' ? 'CEO' : 'Ordinary'} account created`,
        targetType: 'User',
        targetId: id,
        metadata: { role: normalizedRole }
      }, tx);
      return user;
    });

    return res.status(201).json({ success: true, user: safeUser(created) });
  } catch (error: any) {
    if (error?.code === 11000 || error?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    throw error;
  }
};

export const updateManagedUser = async (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const userId = req.params.userId;
  const role = typeof req.body.role === 'string' ? req.body.role.trim().toUpperCase() : undefined;

  const existing = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
  if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

  // Security restrictions:
  // Chairman accounts can NEVER be updated via ordinary user management
  if (existing.role === 'CHAIRMAN') {
    return res.status(404).json({ success: false, message: 'Ordinary account not found' });
  }
  // CEO accounts can only be updated by Chairman
  if (existing.role === 'CEO' && currentUser.role !== 'CHAIRMAN') {
    return res.status(403).json({ success: false, message: 'CEO and Chairman roles cannot be assigned or updated here' });
  }
  // Role change checks
  if (role && privilegedRoles.includes(role) && currentUser.role !== 'CHAIRMAN') {
    return res.status(403).json({ success: false, message: 'CEO and Chairman roles cannot be assigned here' });
  }
  if (role && role === 'CHAIRMAN') {
    return res.status(403).json({ success: false, message: 'Chairman role cannot be assigned here' });
  }
  if (role && !(await prisma.role.findUnique({ where: { name: role } }))) {
    return res.status(400).json({ success: false, message: 'Unknown role' });
  }

  const updates: Record<string, string> = {};
  for (const key of ['name', 'dept', 'company', 'businessUnit', 'phone', 'employeeId']) {
    if (typeof req.body[key] === 'string') updates[key] = req.body[key].trim();
  }
  if (role) updates.role = role;
  if (typeof req.body.email === 'string') updates.email = req.body.email.trim().toLowerCase();
  if (typeof req.body.password === 'string' && req.body.password.length >= 12) {
    updates.passwordHash = await hashPassword(req.body.password);
  }
  if (!updates.name && !existing.name) return res.status(400).json({ success: false, message: 'Name and department are required' });

  try {
    const updated = await withTransaction(async tx => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date().toISOString()
        }
      });
      await writeAuditEvent({
        ...auditActor(req),
        action: 'Account updated',
        targetType: 'User',
        targetId: userId,
        metadata: { fields: Object.keys(updates).filter(k => k !== 'passwordHash') }
      }, tx);
      return u;
    });
    return res.json({ success: true, user: safeUser(updated) });
  } catch (error: any) {
    if (error?.code === 11000 || error?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    throw error;
  }
};

export const deleteManagedUser = async (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const userId = req.params.userId;
  const existing = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
  if (!existing) return res.status(404).json({ success: false, message: 'Ordinary account not found' });

  // Security restrictions
  if (existing.role === 'CHAIRMAN') {
    return res.status(404).json({ success: false, message: 'Chairman account cannot be deleted' });
  }
  if (existing.role === 'CEO' && currentUser.role !== 'CHAIRMAN') {
    return res.status(404).json({ success: false, message: 'Ordinary account not found' });
  }

  const assigned = await prisma.approvalRequest.findFirst({
    where: { assignedUserId: userId, status: { in: ['PENDING', 'QUERIED', 'ESCALATED'] } }
  });
  if (assigned) {
    return res.status(409).json({ success: false, message: 'Reassign this user’s in-progress approvals before deactivation' });
  }

  const now = new Date().toISOString();
  await withTransaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false, updatedAt: now }
    });
    await writeAuditEvent({
      ...auditActor(req),
      action: `${existing.role} account deactivated`,
      targetType: 'User',
      targetId: userId
    }, tx);
  });

  return res.json({ success: true, message: `${existing.name}'s account was deactivated` });
};

export const createRole = async (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.body.role || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(role)) {
    return res.status(400).json({ success: false, message: 'Role name must be 2-40 letters, numbers, or underscores' });
  }
  if (privilegedRoles.includes(role)) {
    return res.status(403).json({ success: false, message: 'Reserved authority roles cannot be created or assigned here' });
  }

  const existing = await prisma.role.findUnique({ where: { name: role } });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Role already exists' });
  }

  const now = new Date().toISOString();
  await prisma.role.create({
    data: {
      name: role,
      displayName: role,
      canCreateRequests: false,
      systemRole: false,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now
    }
  });

  return res.status(201).json({ success: true, role });
};

export const deleteRole = async (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role).trim().toUpperCase();
  if (privilegedRoles.includes(role) || ['REQUESTER', 'MANAGER', 'CEO'].includes(role)) {
    return res.status(403).json({ success: false, message: 'This system role cannot be deleted' });
  }
  const replacementRole = String(req.body.replacementRole || '').trim().toUpperCase();
  const roleExists = await prisma.role.findUnique({ where: { name: role } });
  if (!roleExists) return res.status(404).json({ success: false, message: 'Role not found' });

  const replacementExists = await prisma.role.findUnique({ where: { name: replacementRole } });
  if (!replacementExists || replacementRole === role || privilegedRoles.includes(replacementRole)) {
    return res.status(400).json({ success: false, message: 'Choose a valid ordinary replacement role' });
  }

  const inUse = await prisma.approvalRequest.findFirst({
    where: {
      status: { in: ['PENDING', 'QUERIED', 'ESCALATED'] },
      OR: [{ assignedRole: role }, { currentStage: role }]
    }
  });
  if (inUse) {
    return res.status(409).json({ success: false, message: 'Role is referenced by an active workflow or in-progress request' });
  }

  const now = new Date().toISOString();
  await withTransaction(async tx => {
    await tx.user.updateMany({
      where: { role, isActive: true },
      data: { role: replacementRole, updatedAt: now }
    });
    await tx.role.delete({ where: { name: role } });
    await writeAuditEvent({
      ...auditActor(req),
      action: 'Organizational role deleted',
      targetType: 'Role',
      targetId: role,
      metadata: { replacementRole }
    }, tx);
  });

  const roles = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name);
  return res.json({ success: true, message: `Role ${role} removed`, roles });
};

export const listWorkflows = async (_req: AuthenticatedRequest, res: Response) => {
  const definitions = await prisma.workflowDefinition.findMany({
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  const workflows = definitions.map(def => {
    const latestVersion = def.versions[0];
    let steps: any[] = [];
    let branch: any = undefined;
    if (latestVersion?.stagesJson) {
      try {
        const parsed = JSON.parse(latestVersion.stagesJson);
        steps = parsed.steps || parsed.stages || [];
        branch = parsed.branch || parsed.legacyBranch;
      } catch {
        // empty
      }
    }
    return {
      id: def.id,
      name: def.name,
      branch,
      version: def.currentVersion,
      steps,
      active: def.active,
      updatedAt: def.updatedAt
    };
  });

  return res.json({ success: true, workflows });
};

export const saveWorkflow = async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as Partial<ApprovalWorkflow>;
  const workflowId = req.params.workflowId;
  if (!workflowId || !body.name?.trim() || !['HR', 'IT', 'FINANCE'].includes(String(body.branch)) || !Array.isArray(body.steps) || typeof body.active !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Workflow name, branch, steps, and active status are required' });
  }

  const roles = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name);
  const current = await prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
  const newVersion = (current?.currentVersion || 0) + 1;
  const now = new Date().toISOString();

  const workflow: ApprovalWorkflow = {
    id: workflowId,
    name: body.name.trim(),
    branch: body.branch as WorkflowBranch,
    version: newVersion,
    steps: body.steps.map((step, index) => ({
      id: String(step.id || `${workflowId}-${index + 1}`),
      role: String(step.role || '').trim().toUpperCase()
    })),
    active: body.active,
    updatedAt: now
  };

  if (workflow.active) {
    const errors = validateWorkflow(workflow, roles);
    if (errors.length) return res.status(400).json({ success: false, errors });
    const otherActive = await prisma.workflowDefinition.findFirst({
      where: {
        id: { not: workflowId },
        active: true,
        // Check if other branch is active
        name: { contains: workflow.branch }
      }
    });
    if (otherActive && otherActive.id.toLowerCase().includes(workflow.branch.toLowerCase())) {
      return res.status(409).json({ success: false, message: `Another active ${workflow.branch} workflow already exists` });
    }
  }

  const stagesJson = JSON.stringify({ steps: workflow.steps, branch: workflow.branch });
  await withTransaction(async tx => {
    await tx.workflowDefinition.upsert({
      where: { id: workflowId },
      update: {
        name: workflow.name,
        active: workflow.active,
        currentVersion: newVersion,
        updatedAt: now
      },
      create: {
        id: workflowId,
        name: workflow.name,
        active: workflow.active,
        currentVersion: newVersion,
        createdAt: now,
        updatedAt: now
      }
    });

    await tx.workflowVersion.create({
      data: {
        id: `ver-${workflowId}-${newVersion}`,
        workflowId,
        version: newVersion,
        name: `${workflow.name} v${newVersion}`,
        isPublished: true,
        publishedAt: now,
        publishedBy: req.user!.id,
        stagesJson
      }
    });

    await writeAuditEvent({
      ...auditActor(req),
      action: 'Approval workflow version saved',
      targetType: 'Workflow',
      targetId: workflow.id,
      metadata: { branch: workflow.branch, version: newVersion, active: workflow.active }
    }, tx);
  });

  return res.json({ success: true, workflow });
};

export const listCeoAccounts = async (_req: AuthenticatedRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: 'CEO' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      dept: true,
      company: true,
      businessUnit: true,
      campus: true,
      institution: true,
      phone: true,
      employeeId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { name: 'asc' }
  });
  return res.json({ success: true, users: users.map(safeUser) });
};

export const createCeoAccount = async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, dept, company, businessUnit } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!name?.trim() || !normalizedEmail || !password || String(password).length < 12 || !dept?.trim()) {
    return res.status(400).json({ success: false, message: 'Name, email, password (12+ characters), and department are required' });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const user = await withTransaction(async tx => {
      const created = await tx.user.create({
        data: {
          id,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: await hashPassword(String(password)),
          role: 'CEO',
          dept: dept.trim(),
          company: String(company || 'FlowNexus').trim(),
          businessUnit: String(businessUnit || 'Executive Office').trim(),
          isActive: true,
          createdAt: now,
          updatedAt: now
        }
      });
      await writeAuditEvent({ ...auditActor(req), action: 'CEO account created', targetType: 'User', targetId: id }, tx);
      return created;
    });

    return res.status(201).json({ success: true, user: safeUser(user) });
  } catch (error: any) {
    if (error?.code === 11000 || error?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    throw error;
  }
};

export const updateCeoAccount = async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const existing = await prisma.user.findFirst({ where: { id: userId, role: 'CEO' } });
  if (!existing) return res.status(404).json({ success: false, message: 'CEO account not found' });

  const allowed = ['name', 'dept', 'company', 'businessUnit', 'phone', 'employeeId'];
  const updates: Record<string, string> = {};
  for (const key of allowed) if (typeof req.body[key] === 'string') updates[key] = req.body[key].trim();
  if (typeof req.body.email === 'string') updates.email = req.body.email.trim().toLowerCase();
  if (typeof req.body.password === 'string') {
    if (req.body.password.length < 12) return res.status(400).json({ success: false, message: 'Password must contain at least 12 characters' });
    updates.passwordHash = await hashPassword(req.body.password);
  }

  try {
    const updated = await withTransaction(async tx => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { ...updates, updatedAt: new Date().toISOString() }
      });
      await writeAuditEvent({ ...auditActor(req), action: 'CEO account modified', targetType: 'User', targetId: userId }, tx);
      return u;
    });
    return res.json({ success: true, user: safeUser(updated) });
  } catch (error: any) {
    if (error?.code === 11000 || error?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    throw error;
  }
};

export const setCeoAccountActive = async (req: AuthenticatedRequest, res: Response) => {
  const active = req.body.active;
  if (typeof active !== 'boolean') return res.status(400).json({ success: false, message: 'active must be a boolean' });
  const { userId } = req.params;
  const existing = await prisma.user.findFirst({ where: { id: userId, role: 'CEO' } });
  if (!existing) return res.status(404).json({ success: false, message: 'CEO account not found' });

  if (!active) {
    const inProgress = await prisma.approvalRequest.findFirst({
      where: { assignedUserId: userId, status: { in: ['PENDING', 'QUERIED', 'ESCALATED'] } }
    });
    if (inProgress) {
      return res.status(409).json({ success: false, message: 'Reassign this CEO’s in-progress approvals before deactivation' });
    }
  }

  const updated = await withTransaction(async tx => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { isActive: active, updatedAt: new Date().toISOString() }
    });
    await writeAuditEvent({
      ...auditActor(req),
      action: active ? 'CEO account restored' : 'CEO account deactivated',
      targetType: 'User',
      targetId: userId
    }, tx);
    return u;
  });

  return res.json({ success: true, user: safeUser(updated) });
};

export const getAuditHistory = async (req: AuthenticatedRequest, res: Response) => {
  const targetId = String(req.query.targetId || '');
  const filter: any = {};
  if (targetId) filter.targetId = targetId;
  const events = await prisma.auditLog.findMany({
    where: filter,
    orderBy: { ts: 'desc' },
    take: 500
  });
  return res.json({
    success: true,
    events: events.map(e => ({
      id: e.id,
      actorId: e.actorId,
      actorName: e.actorName,
      actorRole: e.actorRole,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      metadata: e.metadataJson ? JSON.parse(e.metadataJson) : {},
      ts: e.ts
    }))
  });
};

export const getGeneralWorkflow = async (_req: AuthenticatedRequest, res: Response) => {
  const existingVersion = await prisma.workflowVersion.findFirst({
    where: { workflowId: 'workflow-general' },
    orderBy: { version: 'desc' }
  });

  if (!existingVersion) {
    const defaultGw = getDefaultGeneralWorkflow();
    return res.json({ success: true, generalWorkflow: defaultGw });
  }

  try {
    const parsed = JSON.parse(existingVersion.stagesJson);
    return res.json({
      success: true,
      generalWorkflow: {
        id: 'workflow-general',
        name: existingVersion.name,
        version: existingVersion.version,
        active: true,
        stages: parsed.stages || [],
        branchConfigs: parsed.branchConfigs || [],
        history: parsed.history || [],
        activatedAt: existingVersion.publishedAt,
        activatedBy: existingVersion.publishedBy
      }
    });
  } catch {
    const defaultGw = getDefaultGeneralWorkflow();
    return res.json({ success: true, generalWorkflow: defaultGw });
  }
};

export const activateGeneralWorkflow = async (req: AuthenticatedRequest, res: Response) => {
  const { name, stages, branchConfigs, reason } = req.body;
  const roles = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name);

  const validationPayload = {
    name: name || 'General Approval Workflow',
    stages: stages || [],
    branchConfigs: branchConfigs || []
  };

  const errors = validateWorkflowConfig(validationPayload, roles);
  const stageRoles = (stages || []).map((s: any) => s.role);
  if (!stageRoles.includes('CEO')) errors.push('Workflow must include CEO approval.');
  if (stageRoles[stageRoles.length - 1] !== 'CHAIRMAN') errors.push('Chairman must remain the final authority stage.');

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  const existingDef = await prisma.workflowDefinition.findUnique({
    where: { id: 'workflow-general' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  const currentVersion = existingDef?.currentVersion || existingDef?.versions[0]?.version || 1;
  const newVersion = currentVersion + 1;
  const now = new Date().toISOString();

  let history: any[] = [];
  if (existingDef?.versions[0]?.stagesJson) {
    try {
      history = JSON.parse(existingDef.versions[0].stagesJson).history || [];
    } catch {
      // empty
    }
  }

  history.push({
    version: newVersion,
    activatedAt: now,
    activatedBy: req.user!.name,
    reason: reason || 'General workflow activated by executive authority'
  });

  const formattedStages = (stages || []).map((s: any, idx: number) => ({
    id: s.id || `gw-${idx + 1}`,
    stageKey: s.stageKey || `STAGE_${s.role}`,
    role: s.role,
    label: s.label || getRoleDisplayName(s.role),
    stageOrder: idx + 1,
    stageType: s.stageType || (s.role === 'DEAN' ? 'DEAN' : (s.role === 'CEO' || s.role === 'CHAIRMAN') ? 'POST_BRANCH' : 'PRE_DEAN'),
    isApplicable: s.isApplicable !== false
  }));

  const formattedBranchConfigs = branchConfigs || [
    { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
    { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
    { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
    { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
  ];

  const stagesJson = JSON.stringify({
    stages: formattedStages,
    branchConfigs: formattedBranchConfigs,
    history
  });

  await withTransaction(async tx => {
    await tx.workflowDefinition.upsert({
      where: { id: 'workflow-general' },
      update: {
        name: (name || 'General Approval Workflow').trim(),
        active: true,
        currentVersion: newVersion,
        updatedAt: now
      },
      create: {
        id: 'workflow-general',
        name: (name || 'General Approval Workflow').trim(),
        active: true,
        currentVersion: newVersion,
        createdAt: now,
        updatedAt: now
      }
    });

    await tx.workflowVersion.create({
      data: {
        id: `ver-workflow-general-${newVersion}`,
        workflowId: 'workflow-general',
        version: newVersion,
        name: `${name || 'General Approval Workflow'} v${newVersion}`,
        description: reason || 'Activated workflow version',
        isPublished: true,
        publishedAt: now,
        publishedBy: req.user!.name,
        stagesJson
      }
    });

    await writeAuditEvent({
      ...auditActor(req),
      action: `General workflow v${newVersion} activated`,
      targetType: 'GeneralWorkflow',
      targetId: 'workflow-general',
      metadata: { version: newVersion, activatedBy: req.user!.name, reason }
    }, tx);
  });

  return res.json({
    success: true,
    generalWorkflow: {
      id: 'workflow-general',
      name: (name || 'General Approval Workflow').trim(),
      version: newVersion,
      active: true,
      stages: formattedStages,
      branchConfigs: formattedBranchConfigs,
      history,
      activatedAt: now,
      activatedBy: req.user!.name,
      updatedAt: now
    }
  });
};

export const publishWorkflowVersion = async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, preDeanStages, branchConfigs } = req.body;
  const roles = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name);

  const validationPayload = {
    name: name || 'Configured Workflow',
    preDeanStages: preDeanStages || [],
    branchConfigs: branchConfigs || []
  };

  const errors = validateWorkflowConfig(validationPayload, roles);
  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  const highestVersion = await prisma.workflowVersion.findFirst({
    where: { workflowId: 'workflow-general' },
    orderBy: { version: 'desc' }
  });

  const existingDef = await prisma.workflowDefinition.findUnique({
    where: { id: 'workflow-general' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  const currentVersion = Math.max(
    highestVersion?.version || 0,
    existingDef?.currentVersion || 0,
    existingDef?.versions[0]?.version || 0,
    1
  );
  const newVersion = currentVersion + 1;
  const now = new Date().toISOString();

  // Construct complete ordered stages
  const preStages = (preDeanStages || []).map((s: any, idx: number) => ({
    id: `gw-${idx + 1}`,
    stageKey: s.stageKey || `STAGE_${s.role}`,
    role: s.role,
    label: s.label || getRoleDisplayName(s.role),
    stageOrder: idx + 1,
    stageType: 'PRE_DEAN',
    isApplicable: s.isApplicable !== false
  }));

  const fullStages = [
    ...preStages,
    {
      id: `gw-${preStages.length + 1}`,
      stageKey: 'STAGE_CEO',
      role: 'CEO',
      label: 'CEO Approval',
      stageOrder: preStages.length + 1,
      stageType: 'POST_BRANCH',
      isApplicable: true
    },
    {
      id: `gw-${preStages.length + 2}`,
      stageKey: 'STAGE_CHAIRMAN',
      role: 'CHAIRMAN',
      label: 'Chairman Final Authority',
      stageOrder: preStages.length + 2,
      stageType: 'POST_BRANCH',
      isApplicable: true
    }
  ];

  const fullBranchConfigs = (branchConfigs || []).map((b: any) => ({
    branchKey: b.branchKey as PostDeanBranch,
    displayName: b.displayName || `${b.branchKey} Branch`,
    role: b.role || b.branchKey,
    isActive: b.isActive !== false
  }));

  const stagesJson = JSON.stringify({
    stages: fullStages,
    branchConfigs: fullBranchConfigs,
    history: []
  });

  const published = await withTransaction(async tx => {
    await tx.workflowDefinition.upsert({
      where: { id: 'workflow-general' },
      update: {
        name: (name || 'General Workflow').trim(),
        active: true,
        currentVersion: newVersion,
        updatedAt: now
      },
      create: {
        id: 'workflow-general',
        name: (name || 'General Workflow').trim(),
        active: true,
        currentVersion: newVersion,
        createdAt: now,
        updatedAt: now
      }
    });

    const wv = await tx.workflowVersion.create({
      data: {
        id: `ver-workflow-general-${newVersion}-${randomUUID().slice(0, 8)}`,
        workflowId: 'workflow-general',
        version: newVersion,
        name: (name || `Workflow v${newVersion}`).trim(),
        description: description || null,
        isPublished: true,
        publishedAt: now,
        publishedBy: req.user!.name,
        stagesJson
      }
    });

    await writeAuditEvent({
      ...auditActor(req),
      action: `Workflow version ${newVersion} published`,
      targetType: 'GeneralWorkflow',
      targetId: 'workflow-general',
      metadata: { version: newVersion, name }
    }, tx);

    return wv;
  });

  return res.status(201).json({
    success: true,
    workflowVersion: {
      id: published.id,
      version: published.version,
      name: published.name,
      stagesJson: published.stagesJson,
      isPublished: true,
      publishedAt: published.publishedAt
    }
  });
};

export const validateGeneralWorkflow = async (req: AuthenticatedRequest, res: Response) => {
  const { name, stages, branchConfigs } = req.body;
  const roles = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name);
  const validationPayload = {
    name: name || 'General Approval Workflow',
    stages: stages || [],
    branchConfigs: branchConfigs || []
  };
  const errors = validateWorkflowConfig(validationPayload, roles);
  const stageRoles = (stages || []).map((s: any) => s.role);
  if (stageRoles.length > 0 && stageRoles[stageRoles.length - 1] !== 'CHAIRMAN') errors.push('Chairman must remain the final authority stage.');
  return res.json({ success: true, valid: errors.length === 0, errors });
};

export const customizeRequestWorkflow = async (req: AuthenticatedRequest, res: Response) => {
  const { requestId } = req.params;
  const { stages, selectedBranch, reason, expectedUpdatedAt } = req.body;

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      stages: { orderBy: { stageIndex: 'asc' } },
      migrationEvents: true,
      approvalHistory: true,
      attachments: true,
      queryThread: true
    }
  });
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (request.status === 'APPROVED' || request.status === 'REJECTED') {
    return res.status(400).json({ success: false, message: 'Finalized requests cannot have their workflow sequence altered.' });
  }

  // Concurrency check
  if (expectedUpdatedAt && request.updatedAt !== expectedUpdatedAt) {
    return res.status(409).json({
      success: false,
      message: 'Request was modified by another session. Please refresh and try again.'
    });
  }

  // Preserve existing completed/skipped stages
  const existingStages = request.stagesJson ? JSON.parse(request.stagesJson) : request.stages;
  const resolvedStagesMap = new Map();
  existingStages.forEach((s: any) => {
    if (s.status === 'COMPLETED' || s.status === 'SKIPPED') {
      resolvedStagesMap.set(s.role, s);
    }
  });

  const now = new Date().toISOString();
  let firstPendingFound = false;

  const updatedStages = (stages || []).map((s: any, idx: number) => {
    const resolved = resolvedStagesMap.get(s.role);
    if (resolved) {
      return {
        ...resolved,
        stageIndex: idx
      };
    }

    const isApplicable = s.isApplicable !== false;
    let status = 'FUTURE';
    if (!isApplicable) {
      status = 'SKIPPED';
    } else if (!firstPendingFound) {
      status = 'PENDING';
      firstPendingFound = true;
    }

    return {
      id: s.id || randomUUID(),
      requestId,
      stageIndex: idx,
      stageKey: s.stageKey || `STAGE_${s.role}`,
      role: s.role,
      label: s.label || getRoleDisplayName(s.role),
      status,
      isApplicable,
      notes: s.notes || null
    };
  });

  // Preserve any replaced pending stage as SUPERSEDED so history is not lost
  existingStages.forEach((oldS: any) => {
    if (oldS.status === 'PENDING') {
      const isStillPending = updatedStages.some((u: any) => u.role === oldS.role && u.status === 'PENDING');
      if (!isStillPending) {
        const alreadyInUpdated = updatedStages.some((u: any) => u.role === oldS.role);
        if (!alreadyInUpdated) {
          updatedStages.push({
            ...oldS,
            status: 'SUPERSEDED'
          });
        }
      }
    }
  });

  const nextPendingStage = updatedStages.find((s: any) => s.status === 'PENDING');
  const currentAuditTrail = request.auditTrailJson ? JSON.parse(request.auditTrailJson) : [];
  currentAuditTrail.push({
    ts: now,
    actor: `${req.user!.name} (${req.user!.role})`,
    action: `Workflow customized for request #${request.id}${reason ? `: ${reason}` : ''}`
  });

  const migrationEvent = {
    id: randomUUID(),
    requestId: request.id,
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    reason: reason || 'Request workflow customized',
    previousWorkflowVersion: request.workflowVersionNumber || 1,
    newWorkflowVersion: request.workflowVersionNumber || 1,
    oldStage: request.currentStage,
    newStage: nextPendingStage?.role || request.currentStage,
    affectedStagesJson: JSON.stringify(updatedStages),
    ts: now
  };

  const updatedRequest = await withTransaction(async tx => {
    // Delete old stage instances and re-insert updated ones
    await tx.requestStageInstance.deleteMany({ where: { requestId } });
    for (const stg of updatedStages) {
      await tx.requestStageInstance.create({
        data: {
          id: randomUUID(),
          requestId,
          stageIndex: stg.stageIndex ?? 0,
          stageKey: stg.stageKey || `STAGE_${stg.role}`,
          role: stg.role,
          label: stg.label || getRoleDisplayName(stg.role),
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

    await tx.workflowMigrationEvent.create({ data: migrationEvent });

    const updated = await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        stagesJson: JSON.stringify(updatedStages),
        selectedBranch: selectedBranch || request.selectedBranch,
        currentStage: nextPendingStage ? nextPendingStage.role : request.currentStage,
        assignedRole: nextPendingStage ? nextPendingStage.role : request.assignedRole,
        assignedUserId: null,
        auditTrailJson: JSON.stringify(currentAuditTrail),
        updatedAt: now
      },
      include: {
        stages: { orderBy: { stageIndex: 'asc' } },
        migrationEvents: true,
        approvalHistory: true,
        attachments: true,
        queryThread: true
      }
    });

    await writeAuditEvent({
      ...auditActor(req),
      action: `Workflow customized for request #${request.id}`,
      targetType: 'Request',
      targetId: request.id,
      metadata: { reason }
    }, tx);

    return updated;
  });

  return res.json({
    success: true,
    request: {
      ...updatedRequest,
      amount: Number(updatedRequest.amount),
      auditTrail: currentAuditTrail,
      stages: updatedStages,
      migrationEvents: updatedRequest.migrationEvents
    }
  });
};

export const migrateRequestWorkflow = async (req: AuthenticatedRequest, res: Response) => {
  const { requestId } = req.params;
  const { targetWorkflowVersion, reason, oldStage, newStage, stages, selectedBranch } = req.body;

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      stages: { orderBy: { stageIndex: 'asc' } },
      migrationEvents: true,
      approvalHistory: true,
      attachments: true,
      queryThread: true
    }
  });
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  const now = new Date().toISOString();
  const prevVersion = request.workflowVersionNumber || 1;
  const newVersion = targetWorkflowVersion || (prevVersion + 1);

  const existingStages = request.stagesJson ? JSON.parse(request.stagesJson) : request.stages;
  const resolvedStagesMap = new Map();
  existingStages.forEach((s: any) => {
    if (s.status === 'COMPLETED' || s.status === 'SKIPPED') resolvedStagesMap.set(s.role, s);
  });

  let updatedStages: any[] = [];
  if (Array.isArray(stages) && stages.length > 0) {
    let firstPendingFound = false;
    updatedStages = stages.map((s: any, idx: number) => {
      const resolved = resolvedStagesMap.get(s.role);
      if (resolved) {
        return {
          ...resolved,
          stageIndex: idx,
          completedUnderVersion: resolved.completedUnderVersion || prevVersion
        };
      }

      const isApplicable = s.isApplicable !== false;
      let status = 'FUTURE';
      if (!isApplicable) {
        status = 'SKIPPED';
      } else if (!firstPendingFound) {
        status = 'PENDING';
        firstPendingFound = true;
      }

      return {
        id: s.id || randomUUID(),
        requestId,
        stageIndex: idx,
        stageKey: s.stageKey || `STAGE_${s.role}`,
        role: s.role,
        label: s.label || getRoleDisplayName(s.role),
        status,
        isApplicable,
        notes: s.notes || null
      };
    });
  } else {
    updatedStages = existingStages.map((s: any) => {
      if (oldStage && s.role === oldStage && s.status === 'PENDING') {
        return { ...s, status: 'SUPERSEDED' };
      }
      return s;
    });

    if (newStage) {
      const existingNewIdx = updatedStages.findIndex((s: any) => s.role === newStage);
      if (existingNewIdx >= 0) {
        updatedStages[existingNewIdx].status = 'PENDING';
        updatedStages[existingNewIdx].isApplicable = true;
      } else {
        const ceoIdx = updatedStages.findIndex((s: any) => s.role === 'CEO');
        const insertIdx = ceoIdx >= 0 ? ceoIdx : Math.max(0, updatedStages.length - 1);
        updatedStages.splice(insertIdx, 0, {
          id: randomUUID(),
          requestId,
          stageIndex: insertIdx,
          stageKey: `STAGE_${newStage}`,
          role: newStage,
          label: getRoleDisplayName(newStage),
          status: 'PENDING',
          isApplicable: true
        });
        updatedStages.forEach((s: any, idx: number) => { s.stageIndex = idx; });
      }
    }
  }

  const nextPendingStage = updatedStages.find((s: any) => s.status === 'PENDING');
  const currentAuditTrail = request.auditTrailJson ? JSON.parse(request.auditTrailJson) : [];
  currentAuditTrail.push({
    ts: now,
    actor: `${req.user!.name} (${req.user!.role})`,
    action: `Workflow migrated from v${prevVersion} to v${newVersion}${reason ? `: ${reason}` : ''}`
  });

  const migrationEvent = {
    id: randomUUID(),
    requestId: request.id,
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    reason: reason || `Migrated workflow from v${prevVersion} to v${newVersion}`,
    previousWorkflowVersion: prevVersion,
    newWorkflowVersion: newVersion,
    oldStage: oldStage || null,
    newStage: nextPendingStage?.role || newStage || null,
    affectedStagesJson: JSON.stringify(updatedStages),
    ts: now
  };

  const updatedRequest = await withTransaction(async tx => {
    await tx.requestStageInstance.deleteMany({ where: { requestId } });
    for (const stg of updatedStages) {
      await tx.requestStageInstance.create({
        data: {
          id: randomUUID(),
          requestId,
          stageIndex: stg.stageIndex ?? 0,
          stageKey: stg.stageKey || `STAGE_${stg.role}`,
          role: stg.role,
          label: stg.label || getRoleDisplayName(stg.role),
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

    await tx.workflowMigrationEvent.create({ data: migrationEvent });

    const updated = await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        stagesJson: JSON.stringify(updatedStages),
        workflowVersionNumber: newVersion,
        currentStage: nextPendingStage ? nextPendingStage.role : request.currentStage,
        assignedRole: nextPendingStage ? nextPendingStage.role : request.assignedRole,
        selectedBranch: selectedBranch || request.selectedBranch,
        auditTrailJson: JSON.stringify(currentAuditTrail),
        updatedAt: now
      },
      include: {
        stages: { orderBy: { stageIndex: 'asc' } },
        migrationEvents: true,
        approvalHistory: true,
        attachments: true,
        queryThread: true
      }
    });

    await writeAuditEvent({
      ...auditActor(req),
      action: `Workflow migrated for request #${request.id}`,
      targetType: 'Request',
      targetId: request.id,
      metadata: { previousWorkflowVersion: prevVersion, newWorkflowVersion: newVersion, reason, oldStage, newStage: nextPendingStage?.role || newStage }
    }, tx);

    return updated;
  });

  return res.json({
    success: true,
    request: {
      ...updatedRequest,
      amount: Number(updatedRequest.amount),
      auditTrail: currentAuditTrail,
      stages: updatedStages,
      migrationEvents: [...request.migrationEvents, migrationEvent]
    }
  });
};

export const validateCustomRequestWorkflow = async (req: AuthenticatedRequest, res: Response) => {
  const { stages } = req.body;
  const errors: string[] = [];
  const roles = (stages || []).map((s: any) => s.role);

  const seen = new Set<string>();
  for (const r of roles) {
    if (seen.has(r)) {
      errors.push(`Duplicate role assignment ${r} is not permitted.`);
    }
    seen.add(r);
  }

  if (!roles.includes('DEAN')) errors.push('Workflow must include the Dean stage as the branch checkpoint.');
  if (roles.length > 0 && roles[roles.length - 1] !== 'CHAIRMAN') errors.push('Chairman must remain the final authority stage.');
  return res.json({ success: true, valid: errors.length === 0, errors });
};