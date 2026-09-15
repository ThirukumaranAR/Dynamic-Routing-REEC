"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRole = exports.createRole = exports.deleteManagedUser = exports.createManagedUser = exports.listManagementData = void 0;
const db_1 = require("../services/db");
const safeUser = ({ password, ...user }) => user;
const timestamp = () => new Date().toLocaleString('en-IN');
const listManagementData = (_req, res) => {
    res.json({
        success: true,
        roles: db_1.db.roles,
        users: db_1.db.users.map(safeUser)
    });
};
exports.listManagementData = listManagementData;
const createManagedUser = (req, res) => {
    const { name, email, password, role, dept, company, businessUnit } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
    }
    if (db_1.db.users.some(user => user.email.toLowerCase() === String(email).trim().toLowerCase())) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    if (!db_1.db.roles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Create the role before assigning it to a user' });
    }
    const newUser = {
        id: `usr-${Date.now()}`,
        email: String(email).trim(),
        password: String(password),
        name: String(name).trim(),
        role: String(role),
        dept: dept ? String(dept).trim() : 'General',
        company: company ? String(company).trim() : 'Northstar Group',
        businessUnit: businessUnit ? String(businessUnit).trim() : 'Head Office'
    };
    db_1.db.users.push(newUser);
    res.status(201).json({ success: true, user: safeUser(newUser) });
};
exports.createManagedUser = createManagedUser;
const deleteManagedUser = (req, res) => {
    const userId = req.params.userId;
    if (userId === req.user?.id) {
        return res.status(400).json({ success: false, message: 'The CEO account cannot be removed by itself' });
    }
    const index = db_1.db.users.findIndex(user => user.id === userId);
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const [removed] = db_1.db.users.splice(index, 1);
    res.json({ success: true, message: `${removed.name}'s account was removed` });
};
exports.deleteManagedUser = deleteManagedUser;
const createRole = (req, res) => {
    const role = String(req.body.role || '').trim().toUpperCase();
    if (!role) {
        return res.status(400).json({ success: false, message: 'Role name is required' });
    }
    if (db_1.db.roles.includes(role)) {
        return res.status(409).json({ success: false, message: 'Role already exists' });
    }
    db_1.db.roles.push(role);
    res.status(201).json({ success: true, role, roles: db_1.db.roles });
};
exports.createRole = createRole;
const deleteRole = (req, res) => {
    const role = String(req.params.role).trim().toUpperCase();
    if (role === 'CEO') {
        return res.status(400).json({ success: false, message: 'The CEO role cannot be removed' });
    }
    const replacementRole = String(req.body.replacementRole || '').trim().toUpperCase();
    if (!db_1.db.roles.includes(role)) {
        return res.status(404).json({ success: false, message: 'Role not found' });
    }
    if (!db_1.db.roles.includes(replacementRole) || replacementRole === role) {
        return res.status(400).json({ success: false, message: 'Choose a valid replacement role' });
    }
    db_1.db.users.forEach(user => {
        if (user.role === role)
            user.role = replacementRole;
    });
    db_1.db.requests.forEach(request => {
        if (request.assignedRole === role) {
            request.assignedRole = replacementRole;
            request.auditTrail.push({
                ts: timestamp(),
                actor: req.user.name,
                action: `Role ${role} removed; responsibility transferred to ${replacementRole}`
            });
        }
    });
    db_1.db.roles = db_1.db.roles.filter(existingRole => existingRole !== role);
    res.json({ success: true, message: `Role ${role} removed and responsibilities transferred`, roles: db_1.db.roles });
};
exports.deleteRole = deleteRole;
