"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCustomRequestWorkflow = exports.migrateRequestWorkflow = exports.customizeRequestWorkflow = exports.validateGeneralWorkflow = exports.publishWorkflowVersion = exports.activateGeneralWorkflow = exports.getGeneralWorkflow = exports.getAuditHistory = exports.setCeoAccountActive = exports.updateCeoAccount = exports.createCeoAccount = exports.listCeoAccounts = exports.saveWorkflow = exports.listWorkflows = exports.deleteRole = exports.createRole = exports.deleteManagedUser = exports.updateManagedUser = exports.createManagedUser = exports.listRoles = exports.listManagementData = void 0;
const node_crypto_1 = require("node:crypto");
const db_1 = require("../services/db");
const auth_1 = require("../services/auth");
const workflowService_1 = require("../services/workflowService");
const safeUser = (user) => {
    const { passwordHash: _, ...result } = user;
    return result;
};
const auditActor = (req) => ({
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role
});
const privilegedRoles = ['CEO', 'CHAIRMAN'];
const listManagementData = async (req, res) => {
    const currentUser = req.user;
    const isChairman = currentUser.role === 'CHAIRMAN';
    const [roles, allUsers] = await Promise.all([
        db_1.prisma.role.findMany({ orderBy: { name: 'asc' } }),
        db_1.prisma.user.findMany({
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
exports.listManagementData = listManagementData;
const listRoles = async (_req, res) => {
    const roles = await db_1.prisma.role.findMany({ orderBy: { name: 'asc' } });
    return res.json({ success: true, roles });
};
exports.listRoles = listRoles;
const createManagedUser = async (req, res) => {
    const currentUser = req.user;
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
    const roleRecord = await db_1.prisma.role.findUnique({ where: { name: normalizedRole } });
    if (!roleRecord) {
        return res.status(400).json({ success: false, message: 'Create the role before assigning it to a user' });
    }
    const existingEmail = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    const id = (0, node_crypto_1.randomUUID)();
    const now = new Date().toISOString();
    try {
        const created = await (0, db_1.withTransaction)(async (tx) => {
            const user = await tx.user.create({
                data: {
                    id,
                    name: name.trim(),
                    email: normalizedEmail,
                    passwordHash: await (0, auth_1.hashPassword)(String(password)),
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
            await (0, db_1.writeAuditEvent)({
                ...auditActor(req),
                action: `${normalizedRole === 'CEO' ? 'CEO' : 'Ordinary'} account created`,
                targetType: 'User',
                targetId: id,
                metadata: { role: normalizedRole }
            }, tx);
            return user;
        });
        return res.status(201).json({ success: true, user: safeUser(created) });
    }
    catch (error) {
        if (error?.code === 11000 || error?.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }
        throw error;
    }
};
exports.createManagedUser = createManagedUser;
const updateManagedUser = async (req, res) => {
    const currentUser = req.user;
    const userId = req.params.userId;
    const role = typeof req.body.role === 'string' ? req.body.role.trim().toUpperCase() : undefined;
    const existing = await db_1.prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!existing)
        return res.status(404).json({ success: false, message: 'User not found' });
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
    if (role && !(await db_1.prisma.role.findUnique({ where: { name: role } }))) {
        return res.status(400).json({ success: false, message: 'Unknown role' });
    }
    const updates = {};
    for (const key of ['name', 'dept', 'company', 'businessUnit', 'phone', 'employeeId']) {
        if (typeof req.body[key] === 'string')
            updates[key] = req.body[key].trim();
    }
    if (role)
        updates.role = role;
    if (typeof req.body.email === 'string')
        updates.email = req.body.email.trim().toLowerCase();
    if (typeof req.body.password === 'string' && req.body.password.length >= 12) {
        updates.passwordHash = await (0, auth_1.hashPassword)(req.body.password);
    }
    if (!updates.name && !existing.name)
        return res.status(400).json({ success: false, message: 'Name and department are required' });
    try {
        const updated = await (0, db_1.withTransaction)(async (tx) => {
            const u = await tx.user.update({
                where: { id: userId },
                data: {
                    ...updates,
                    updatedAt: new Date().toISOString()
                }
            });
            await (0, db_1.writeAuditEvent)({
                ...auditActor(req),
                action: 'Account updated',
                targetType: 'User',
                targetId: userId,
                metadata: { fields: Object.keys(updates).filter(k => k !== 'passwordHash') }
            }, tx);
            return u;
        });
        return res.json({ success: true, user: safeUser(updated) });
    }
    catch (error) {
        if (error?.code === 11000 || error?.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }
        throw error;
    }
};
exports.updateManagedUser = updateManagedUser;
const deleteManagedUser = async (req, res) => {
    const currentUser = req.user;
    const userId = req.params.userId;
    const existing = await db_1.prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!existing)
        return res.status(404).json({ success: false, message: 'Ordinary account not found' });
    // Security restrictions
    if (existing.role === 'CHAIRMAN') {
        return res.status(404).json({ success: false, message: 'Chairman account cannot be deleted' });
    }
    if (existing.role === 'CEO' && currentUser.role !== 'CHAIRMAN') {
        return res.status(404).json({ success: false, message: 'Ordinary account not found' });
    }
    const assigned = await db_1.prisma.approvalRequest.findFirst({
        where: { assignedUserId: userId, status: { in: ['PENDING', 'QUERIED', 'ESCALATED'] } }
    });
    if (assigned) {
        return res.status(409).json({ success: false, message: 'Reassign this user’s in-progress approvals before deactivation' });
    }
    const now = new Date().toISOString();
    await (0, db_1.withTransaction)(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { isActive: false, updatedAt: now }
        });
        await (0, db_1.writeAuditEvent)({
            ...auditActor(req),
            action: `${existing.role} account deactivated`,
            targetType: 'User',
            targetId: userId
        }, tx);
    });
    return res.json({ success: true, message: `${existing.name}'s account was deactivated` });
};
exports.deleteManagedUser = deleteManagedUser;
const createRole = async (req, res) => {
    const role = String(req.body.role || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(role)) {
        return res.status(400).json({ success: false, message: 'Role name must be 2-40 letters, numbers, or underscores' });
    }
    if (privilegedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: 'Reserved authority roles cannot be created or assigned here' });
    }
    const existing = await db_1.prisma.role.findUnique({ where: { name: role } });
    if (existing) {
        return res.status(409).json({ success: false, message: 'Role already exists' });
    }
    const now = new Date().toISOString();
    await db_1.prisma.role.create({
        data: {
            name: role,
            displayName: role,
            canCreateRequests: false,
            systemRole: false,
            createdBy: req.user.id,
            createdAt: now,
            updatedAt: now
        }
    });
    return res.status(201).json({ success: true, role });
};
exports.createRole = createRole;
const deleteRole = async (req, res) => {
    const role = String(req.params.role).trim().toUpperCase();
    if (privilegedRoles.includes(role) || ['REQUESTER', 'MANAGER', 'CEO'].includes(role)) {
        return res.status(403).json({ success: false, message: 'This system role cannot be deleted' });
    }
    const replacementRole = String(req.body.replacementRole || '').trim().toUpperCase();
    const roleExists = await db_1.prisma.role.findUnique({ where: { name: role } });
    if (!roleExists)
        return res.status(404).json({ success: false, message: 'Role not found' });
    const replacementExists = await db_1.prisma.role.findUnique({ where: { name: replacementRole } });
    if (!replacementExists || replacementRole === role || privilegedRoles.includes(replacementRole)) {
        return res.status(400).json({ success: false, message: 'Choose a valid ordinary replacement role' });
    }
    const inUse = await db_1.prisma.approvalRequest.findFirst({
        where: {
            status: { in: ['PENDING', 'QUERIED', 'ESCALATED'] },
            OR: [{ assignedRole: role }, { currentStage: role }]
        }
    });
    if (inUse) {
        return res.status(409).json({ success: false, message: 'Role is referenced by an active workflow or in-progress request' });
    }
    const now = new Date().toISOString();
    await (0, db_1.withTransaction)(async (tx) => {
        await tx.user.updateMany({
            where: { role, isActive: true },
            data: { role: replacementRole, updatedAt: now }
        });
        await tx.role.delete({ where: { name: role } });
        await (0, db_1.writeAuditEvent)({
            ...auditActor(req),
            action: 'Organizational role deleted',
            targetType: 'Role',
            targetId: role,
            metadata: { replacementRole }
        }, tx);
    });
    const roles = (await db_1.prisma.role.findMany({ select: { name: true } })).map(r => r.name);
    return res.json({ success: true, message: `Role ${role} removed`, roles });
};
exports.deleteRole = deleteRole;
const listWorkflows = async (_req, res) => {
    const definitions = await db_1.prisma.workflowDefinition.findMany({
        include: {
            versions: {
                orderBy: { version: 'desc' },
                take: 1
            }
        }
    });
    const workflows = definitions.map(def => {
        const latestVersion = def.versions[0];
        let steps = [];
        let branch = undefined;
        if (latestVersion?.stagesJson) {
            try {
                const parsed = JSON.parse(latestVersion.stagesJson);
                steps = parsed.steps || parsed.stages || [];
                branch = parsed.branch || parsed.legacyBranch;
            }
            catch {
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
exports.listWorkflows = listWorkflows;
const saveWorkflow = async (req, res) => {
    const body = req.body;
    const workflowId = req.params.workflowId;
    if (!workflowId || !body.name?.trim() || !['HR', 'IT', 'FINANCE'].includes(String(body.branch)) || !Array.isArray(body.steps) || typeof body.active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Workflow name, branch, steps, and active status are required' });
    }
    const roles = (await db_1.prisma.role.findMany({ select: { name: true } })).map(r => r.name);
    const current = await db_1.prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    const newVersion = (current?.currentVersion || 0) + 1;
    const now = new Date().toISOString();
    const workflow = {
        id: workflowId,
        name: body.name.trim(),
        branch: body.branch,
        version: newVersion,
        steps: body.steps.map((step, index) => ({
            id: String(step.id || `${workflowId}-${index + 1}`),
            role: String(step.role || '').trim().toUpperCase()
        })),
        active: body.active,
        updatedAt: now
    };
    if (workflow.active) {
        const errors = (0, workflowService_1.validateWorkflow)(workflow, roles);
        if (errors.length)
            return res.status(400).json({ success: false, errors });
        const otherActive = await db_1.prisma.workflowDefinition.findFirst({
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
    await (0, db_1.withTransaction)(async (tx) => {
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
                publishedBy: req.user.id,
                stagesJson
            }
        });
        await (0, db_1.writeAuditEvent)({
            ...auditActor(req),
            action: 'Approval workflow version saved',
            targetType: 'Workflow',
            targetId: workflow.id,
            metadata: { branch: workflow.branch, version: newVersion, active: workflow.active }
        }, tx);
    });
    return res.json({ success: true, workflow });
};
exports.saveWorkflow = saveWorkflow;
const listCeoAccounts = async (_req, res) => {
    const users = await db_1.prisma.user.findMany({
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
exports.listCeoAccounts = listCeoAccounts;
const createCeoAccount = async (req, res) => {
    const { name, email, password, dept, company, businessUnit } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!name?.trim() || !normalizedEmail || !password || String(password).length < 12 || !dept?.trim()) {
        return res.status(400).json({ success: false, message: 'Name, email, password (12+ characters), and department are required' });
    }
    const existingEmail = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    const id = (0, node_crypto_1.randomUUID)();
    const now = new Date().toISOString();
    try {
        const user = await (0, db_1.withTransaction)(async (tx) => {
            const created = await tx.user.create({
                data: {
                    id,
                    name: name.trim(),
                    email: normalizedEmail,
                    passwordHash: await (0, auth_1.hashPassword)(String(password)),
                    role: 'CEO',
                    dept: dept.trim(),
                    company: String(company || 'FlowNexus').trim(),
                    businessUnit: String(businessUnit || 'Executive Office').trim(),
                    isActive: true,
                    createdAt: now,
                    updatedAt: now
                }
            });
            await (0, db_1.writeAuditEvent)({ ...auditActor(req), action: 'CEO account created', targetType: 'User', targetId: id }, tx);
            return created;
        });
        return res.status(201).json({ success: true, user: safeUser(user) });
    }
    catch (error) {
        if (error?.code === 11000 || error?.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }
        throw error;
    }
};
exports.createCeoAccount = createCeoAccount;
const updateCeoAccount = async (req, res) => {
    const { userId } = req.params;
    const existing = await db_1.prisma.user.findFirst({ where: { id: userId, role: 'CEO' } });
    if (!existing)
        return res.status(404).json({ success: false, message: 'CEO account not found' });
    const allowed = ['name', 'dept', 'company', 'businessUnit', 'phone', 'employeeId'];
    const updates = {};
    for (const key of allowed)
        if (typeof req.body[key] === 'string')
            updates[key] = req.body[key].trim();
    if (typeof req.body.email === 'string')
        updates.email = req.body.email.trim().toLowerCase();
    if (typeof req.body.password === 'string') {
        if (req.body.password.length < 12)
            return res.status(400).json({ success: false, message: 'Password must contain at least 12 characters' });
        updates.passwordHash = await (0, auth_1.hashPassword)(req.body.password);
    }
    try {
        const updated = await (0, db_1.withTransaction)(async (tx) => {
            const u = await tx.user.update({
                where: { id: userId },
                data: { ...updates, updatedAt: new Date().toISOString() }
            });
            await (0, db_1.writeAuditEvent)({ ...auditActor(req), action: 'CEO account modified', targetType: 'User', targetId: userId }, tx);
            return u;
        });
        return res.json({ success: true, user: safeUser(updated) });
    }
    catch (error) {
        if (error?.code === 11000 || error?.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }
        throw error;
    }
};
exports.updateCeoAccount = updateCeoAccount;
const setCeoAccountActive = async (req, res) => {
    const active = req.body.active;
    if (typeof active !== 'boolean')
        return res.status(400).json({ success: false, message: 'active must be a boolean' });
    const { userId } = req.params;
    const existing = await db_1.prisma.user.findFirst({ where: { id: userId, role: 'CEO' } });
    if (!existing)
        return res.status(404).json({ success: false, message: 'CEO account not found' });
    if (!active) {
        const inProgress = await db_1.prisma.approvalRequest.findFirst({
            where: { assignedUserId: userId, status: { in: ['PENDING', 'QUERIED', 'ESCALATED'] } }
        });
        if (inProgress) {
            return res.status(409).json({ success: false, message: 'Reassign this CEO’s in-progress approvals before deactivation' });
        }
    }
    const updated = await (0, db_1.withTransaction)(async (tx) => {
        const u = await tx.user.update({
            where: { id: userId },
            data: { isActive: active, updatedAt: new Date().toISOString() }
        });
        await (0, db_1.writeAuditEvent)({
            ...auditActor(req),
            action: active ? 'CEO account restored' : 'CEO account deactivated',
            targetType: 'User',
            targetId: userId
        }, tx);
        return u;
    });
    return res.json({ success: true, user: safeUser(updated) });
};
exports.setCeoAccountActive = setCeoAccountActive;
const getAuditHistory = async (req, res) => {
    const targetId = String(req.query.targetId || '');
    const filter = {};
    if (targetId)
        filter.targetId = targetId;
    const events = await db_1.prisma.auditLog.findMany({
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
exports.getAuditHistory = getAuditHistory;
const getGeneralWorkflow = async (_req, res) => {
    const existingVersion = await db_1.prisma.workflowVersion.findFirst({
        where: { workflowId: 'workflow-general' },
        orderBy: { version: 'desc' }
    });
    if (!existingVersion) {
        const defaultGw = (0, workflowService_1.getDefaultGeneralWorkflow)();
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
    }
    catch {
        const defaultGw = (0, workflowService_1.getDefaultGeneralWorkflow)();
        return res.json({ success: true, generalWorkflow: defaultGw });
    }
};
exports.getGeneralWorkflow = getGeneralWorkflow;
const activateGeneralWorkflow = async (req, res) => {
    const { name, stages, branchConfigs, reason } = req.body;
    const roles = (await db_1.prisma.role.findMany({ select: { name: true } })).map(r => r.name);
    const validationPayload = {
        name: name || 'General Approval Workflow',
        stages: stages || [],
        branchConfigs: branchConfigs || []
    };
    const errors = (0, workflowService_1.validateWorkflowConfig)(validationPayload, roles);
    const stageRoles = (stages || []).map((s) => s.role);
    if (!stageRoles.includes('CEO'))
        errors.push('Workflow must include CEO approval.');
    if (stageRoles[stageRoles.length - 1] !== 'CHAIRMAN')
        errors.push('Chairman must remain the final authority stage.');
    if (errors.length) {
        return res.status(400).json({ success: false, errors });
    }
    const existingDef = await db_1.prisma.workflowDefinition.findUnique({
        where: { id: 'workflow-general' },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });
    const currentVersion = existingDef?.currentVersion || existingDef?.versions[0]?.version || 1;
    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();
    let history = [];
    if (existingDef?.versions[0]?.stagesJson) {
        try {
            history = JSON.parse(existingDef.versions[0].stagesJson).history || [];
        }
        catch {
            // empty
        }
    }
    history.push({
        version: newVersion,
        activatedAt: now,
        activatedBy: req.user.name,
        reason: reason || 'General workflow activated by executive authority'
    });
    const formattedStages = (stages || []).map((s, idx) => ({
        id: s.id || `gw-${idx + 1}`,
        stageKey: s.stageKey || `STAGE_${s.role}`,
        role: s.role,
        label: s.label || (0, workflowService_1.getRoleDisplayName)(s.role),
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
    await (0, db_1.withTransaction)(async (tx) => {
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
                publishedBy: req.user.name,
                stagesJson
            }
        });
        await (0, db_1.writeAuditEvent)({
            ...auditActor(req),
            action: `General workflow v${newVersion} activated`,
            targetType: 'GeneralWorkflow',
            targetId: 'workflow-general',
            metadata: { version: newVersion, activatedBy: req.user.name, reason }
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
            activatedBy: req.user.name,
            updatedAt: now
        }
    });
};
exports.activateGeneralWorkflow = activateGeneralWorkflow;
const publishWorkflowVersion = async (req, res) => {
    const { name, description, preDeanStages, branchConfigs } = req.body;
    const roles = (await db_1.prisma.role.findMany({ select: { name: true } })).map(r => r.name);
    const validationPayload = {
        name: name || 'Configured Workflow',
        preDeanStages: preDeanStages || [],
        branchConfigs: branchConfigs || []
    };
    const errors = (0, workflowService_1.validateWorkflowConfig)(validationPayload, roles);
    if (errors.length) {
        return res.status(400).json({ success: false, errors });
    }
    const highestVersion = await db_1.prisma.workflowVersion.findFirst({
        where: { workflowId: 'workflow-general' },
        orderBy: { version: 'desc' }
    });
    const existingDef = await db_1.prisma.workflowDefinition.findUnique({
        where: { id: 'workflow-general' },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });
    const currentVersion = Math.max(highestVersion?.version || 0, existingDef?.currentVersion || 0, existingDef?.versions[0]?.version || 0, 1);
    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();
    // Construct complete ordered stages
    const preStages = (preDeanStages || []).map((s, idx) => ({
        id: `gw-${idx + 1}`,
        stageKey: s.stageKey || `STAGE_${s.role}`,
        role: s.role,
        label: s.label || (0, workflowService_1.getRoleDisplayName)(s.role),
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
    const fullBranchConfigs = (branchConfigs || []).map((b) => ({
        branchKey: b.branchKey,
        displayName: b.displayName || `${b.branchKey} Branch`,
        role: b.role || b.branchKey,
        isActive: b.isActive !== false
    }));
    const stagesJson = JSON.stringify({
        stages: fullStages,
        branchConfigs: fullBranchConfigs,
        history: []
    });
    const published = await (0, db_1.withTransaction)(async (tx) => {
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
                id: `ver-workflow-general-${newVersion}-${(0, node_crypto_1.randomUUID)().slice(0, 8)}`,
                workflowId: 'workflow-general',
                version: newVersion,
                name: (name || `Workflow v${newVersion}`).trim(),
                description: description || null,
                isPublished: true,
                publishedAt: now,
                publishedBy: req.user.name,
                stagesJson
            }
        });
        await (0, db_1.writeAuditEvent)({
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
exports.publishWorkflowVersion = publishWorkflowVersion;
const validateGeneralWorkflow = async (req, res) => {
    const { name, stages, branchConfigs } = req.body;
    const roles = (await db_1.prisma.role.findMany({ select: { name: true } })).map(r => r.name);
    const validationPayload = {
        name: name || 'General Approval Workflow',
        stages: stages || [],
        branchConfigs: branchConfigs || []
    };
    const errors = (0, workflowService_1.validateWorkflowConfig)(validationPayload, roles);
    const stageRoles = (stages || []).map((s) => s.role);
    if (stageRoles.length > 0 && stageRoles[stageRoles.length - 1] !== 'CHAIRMAN')
        errors.push('Chairman must remain the final authority stage.');
    return res.json({ success: true, valid: errors.length === 0, errors });
};
exports.validateGeneralWorkflow = validateGeneralWorkflow;
const customizeRequestWorkflow = async (req, res) => {
    const { requestId } = req.params;
    const { stages, selectedBranch, reason, expectedUpdatedAt } = req.body;
    const request = await db_1.prisma.approvalRequest.findUnique({
        where: { id: requestId },
        include: {
            stages: { orderBy: { stageIndex: 'asc' } },
            migrationEvents: true,
            approvalHistory: true,
            attachments: true,
            queryThread: true
        }
    });
    if (!request)
        return res.status(404).json({ success: false, message: 'Request not found' });
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
    existingStages.forEach((s) => {
        if (s.status === 'COMPLETED' || s.status === 'SKIPPED') {
            resolvedStagesMap.set(s.role, s);
        }
    });
    const now = new Date().toISOString();
    let firstPendingFound = false;
    const updatedStages = (stages || []).map((s, idx) => {
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
        }
        else if (!firstPendingFound) {
            status = 'PENDING';
            firstPendingFound = true;
        }
        return {
            id: s.id || (0, node_crypto_1.randomUUID)(),
            requestId,
            stageIndex: idx,
            stageKey: s.stageKey || `STAGE_${s.role}`,
            role: s.role,
            label: s.label || (0, workflowService_1.getRoleDisplayName)(s.role),
            status,
            isApplicable,
            notes: s.notes || null
        };
    });
    // Preserve any replaced pending stage as SUPERSEDED so history is not lost
    existingStages.forEach((oldS) => {
        if (oldS.status === 'PENDING') {
            const isStillPending = updatedStages.some((u) => u.role === oldS.role && u.status === 'PENDING');
            if (!isStillPending) {
                const alreadyInUpdated = updatedStages.some((u) => u.role === oldS.role);
                if (!alreadyInUpdated) {
                    updatedStages.push({
                        ...oldS,
                        status: 'SUPERSEDED'
                    });
                }
            }
        }
    });
    const nextPendingStage = updatedStages.find((s) => s.status === 'PENDING');
    const currentAuditTrail = request.auditTrailJson ? JSON.parse(request.auditTrailJson) : [];
    currentAuditTrail.push({
        ts: now,
        actor: `${req.user.name} (${req.user.role})`,
        action: `Workflow customized for request #${request.id}${reason ? `: ${reason}` : ''}`
    });
    const migrationEvent = {
        id: (0, node_crypto_1.randomUUID)(),
        requestId: request.id,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        reason: reason || 'Request workflow customized',
        previousWorkflowVersion: request.workflowVersionNumber || 1,
        newWorkflowVersion: request.workflowVersionNumber || 1,
        oldStage: request.currentStage,
        newStage: nextPendingStage?.role || request.currentStage,
        affectedStagesJson: JSON.stringify(updatedStages),
        ts: now
    };
    const updatedRequest = await (0, db_1.withTransaction)(async (tx) => {
        // Delete old stage instances and re-insert updated ones
        await tx.requestStageInstance.deleteMany({ where: { requestId } });
        for (const stg of updatedStages) {
            await tx.requestStageInstance.create({
                data: {
                    id: (0, node_crypto_1.randomUUID)(),
                    requestId,
                    stageIndex: stg.stageIndex ?? 0,
                    stageKey: stg.stageKey || `STAGE_${stg.role}`,
                    role: stg.role,
                    label: stg.label || (0, workflowService_1.getRoleDisplayName)(stg.role),
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
        await (0, db_1.writeAuditEvent)({
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
exports.customizeRequestWorkflow = customizeRequestWorkflow;
const migrateRequestWorkflow = async (req, res) => {
    const { requestId } = req.params;
    const { targetWorkflowVersion, reason, oldStage, newStage, stages, selectedBranch } = req.body;
    const request = await db_1.prisma.approvalRequest.findUnique({
        where: { id: requestId },
        include: {
            stages: { orderBy: { stageIndex: 'asc' } },
            migrationEvents: true,
            approvalHistory: true,
            attachments: true,
            queryThread: true
        }
    });
    if (!request)
        return res.status(404).json({ success: false, message: 'Request not found' });
    const now = new Date().toISOString();
    const prevVersion = request.workflowVersionNumber || 1;
    const newVersion = targetWorkflowVersion || (prevVersion + 1);
    const existingStages = request.stagesJson ? JSON.parse(request.stagesJson) : request.stages;
    const resolvedStagesMap = new Map();
    existingStages.forEach((s) => {
        if (s.status === 'COMPLETED' || s.status === 'SKIPPED')
            resolvedStagesMap.set(s.role, s);
    });
    let updatedStages = [];
    if (Array.isArray(stages) && stages.length > 0) {
        let firstPendingFound = false;
        updatedStages = stages.map((s, idx) => {
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
            }
            else if (!firstPendingFound) {
                status = 'PENDING';
                firstPendingFound = true;
            }
            return {
                id: s.id || (0, node_crypto_1.randomUUID)(),
                requestId,
                stageIndex: idx,
                stageKey: s.stageKey || `STAGE_${s.role}`,
                role: s.role,
                label: s.label || (0, workflowService_1.getRoleDisplayName)(s.role),
                status,
                isApplicable,
                notes: s.notes || null
            };
        });
    }
    else {
        updatedStages = existingStages.map((s) => {
            if (oldStage && s.role === oldStage && s.status === 'PENDING') {
                return { ...s, status: 'SUPERSEDED' };
            }
            return s;
        });
        if (newStage) {
            const existingNewIdx = updatedStages.findIndex((s) => s.role === newStage);
            if (existingNewIdx >= 0) {
                updatedStages[existingNewIdx].status = 'PENDING';
                updatedStages[existingNewIdx].isApplicable = true;
            }
            else {
                const ceoIdx = updatedStages.findIndex((s) => s.role === 'CEO');
                const insertIdx = ceoIdx >= 0 ? ceoIdx : Math.max(0, updatedStages.length - 1);
                updatedStages.splice(insertIdx, 0, {
                    id: (0, node_crypto_1.randomUUID)(),
                    requestId,
                    stageIndex: insertIdx,
                    stageKey: `STAGE_${newStage}`,
                    role: newStage,
                    label: (0, workflowService_1.getRoleDisplayName)(newStage),
                    status: 'PENDING',
                    isApplicable: true
                });
                updatedStages.forEach((s, idx) => { s.stageIndex = idx; });
            }
        }
    }
    const nextPendingStage = updatedStages.find((s) => s.status === 'PENDING');
    const currentAuditTrail = request.auditTrailJson ? JSON.parse(request.auditTrailJson) : [];
    currentAuditTrail.push({
        ts: now,
        actor: `${req.user.name} (${req.user.role})`,
        action: `Workflow migrated from v${prevVersion} to v${newVersion}${reason ? `: ${reason}` : ''}`
    });
    const migrationEvent = {
        id: (0, node_crypto_1.randomUUID)(),
        requestId: request.id,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        reason: reason || `Migrated workflow from v${prevVersion} to v${newVersion}`,
        previousWorkflowVersion: prevVersion,
        newWorkflowVersion: newVersion,
        oldStage: oldStage || null,
        newStage: nextPendingStage?.role || newStage || null,
        affectedStagesJson: JSON.stringify(updatedStages),
        ts: now
    };
    const updatedRequest = await (0, db_1.withTransaction)(async (tx) => {
        await tx.requestStageInstance.deleteMany({ where: { requestId } });
        for (const stg of updatedStages) {
            await tx.requestStageInstance.create({
                data: {
                    id: (0, node_crypto_1.randomUUID)(),
                    requestId,
                    stageIndex: stg.stageIndex ?? 0,
                    stageKey: stg.stageKey || `STAGE_${stg.role}`,
                    role: stg.role,
                    label: stg.label || (0, workflowService_1.getRoleDisplayName)(stg.role),
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
        await (0, db_1.writeAuditEvent)({
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
exports.migrateRequestWorkflow = migrateRequestWorkflow;
const validateCustomRequestWorkflow = async (req, res) => {
    const { stages } = req.body;
    const errors = [];
    const roles = (stages || []).map((s) => s.role);
    const seen = new Set();
    for (const r of roles) {
        if (seen.has(r)) {
            errors.push(`Duplicate role assignment ${r} is not permitted.`);
        }
        seen.add(r);
    }
    if (!roles.includes('DEAN'))
        errors.push('Workflow must include the Dean stage as the branch checkpoint.');
    if (roles.length > 0 && roles[roles.length - 1] !== 'CHAIRMAN')
        errors.push('Chairman must remain the final authority stage.');
    return res.json({ success: true, valid: errors.length === 0, errors });
};
exports.validateCustomRequestWorkflow = validateCustomRequestWorkflow;
