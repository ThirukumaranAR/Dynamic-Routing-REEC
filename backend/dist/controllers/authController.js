"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrdinaryUser = exports.listOwnUser = exports.getMe = exports.updateProfile = exports.logout = exports.login = void 0;
const node_crypto_1 = require("node:crypto");
const db_1 = require("../services/db");
const auth_1 = require("../services/auth");
const safeUser = (user) => {
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
};
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')),
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
});
const login = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password)
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    const user = await db_1.prisma.user.findFirst({
        where: { email, isActive: true }
    });
    if (!user || !(await (0, auth_1.verifyPassword)(password, user.passwordHash || ''))) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const token = (0, auth_1.createSessionToken)({ id: user.id, email: user.email, role: user.role });
    res.cookie('flownexus_session', token, cookieOptions());
    return res.json({ success: true, user: safeUser(user), token });
};
exports.login = login;
const logout = (_req, res) => {
    res.clearCookie('flownexus_session', { ...cookieOptions(), maxAge: undefined });
    return res.json({ success: true });
};
exports.logout = logout;
const updateProfile = async (req, res) => {
    const user = req.user;
    const allowedFields = ['name', 'dept', 'company', 'businessUnit', 'campus', 'institution', 'phone'];
    const updates = {};
    for (const key of allowedFields) {
        if (typeof req.body[key] === 'string')
            updates[key] = req.body[key].trim();
    }
    if (!updates.name || !updates.dept)
        return res.status(400).json({ success: false, message: 'Name and department are required' });
    try {
        const updated = await db_1.prisma.user.update({
            where: { id: user.id },
            data: {
                ...updates,
                updatedAt: new Date().toISOString()
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
                isActive: true
            }
        });
        return res.json({ success: true, user: safeUser(updated) });
    }
    catch {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
};
exports.updateProfile = updateProfile;
const getMe = (req, res) => res.json({ success: true, user: req.user });
exports.getMe = getMe;
const listOwnUser = async (req, res) => {
    const user = await db_1.prisma.user.findFirst({
        where: { id: req.user.id, isActive: true },
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
            isActive: true
        }
    });
    if (!user)
        return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user: safeUser(user) });
};
exports.listOwnUser = listOwnUser;
const createOrdinaryUser = async (req, res) => {
    const { name, email, password, role, dept, company, businessUnit, phone, employeeId } = req.body;
    const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!name?.trim() || !normalizedEmail || !password || String(password).length < 12 || !normalizedRole || !dept?.trim()) {
        return res.status(400).json({ success: false, message: 'Name, email, password (12+ characters), role, and department are required' });
    }
    if (['CEO', 'CHAIRMAN'].includes(normalizedRole)) {
        return res.status(403).json({ success: false, message: 'Only the Chairman may create CEO accounts; Chairman assignment is restricted to secure bootstrap.' });
    }
    const roleExists = await db_1.prisma.role.findUnique({ where: { name: normalizedRole } });
    if (!roleExists) {
        return res.status(400).json({ success: false, message: 'Create the role before assigning it to a user' });
    }
    const existingEmail = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    try {
        const id = (0, node_crypto_1.randomUUID)();
        const now = new Date().toISOString();
        const created = await db_1.prisma.user.create({
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
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'Ordinary account created',
            targetType: 'User',
            targetId: id,
            metadata: { role: normalizedRole }
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
exports.createOrdinaryUser = createOrdinaryUser;
