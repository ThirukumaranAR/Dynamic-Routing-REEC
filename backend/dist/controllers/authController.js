"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDemoUsers = exports.getMe = exports.updateProfile = exports.register = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../services/db");
const JWT_SECRET = process.env.JWT_SECRET || 'northstar_workflow_secret_2026';
const login = (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = db_1.db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userSafe } = user;
    res.json({
        success: true,
        token,
        user: userSafe
    });
};
exports.login = login;
const register = (req, res) => {
    const { name, email, password, role, dept, company, businessUnit } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
    }
    const existing = db_1.db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }
    const newUser = {
        id: `usr-${db_1.db.users.length + 1}`,
        email: email.trim(),
        password,
        name: name.trim(),
        role: role || 'REQUESTER',
        dept: dept ? dept.trim() : 'General',
        company: company ? company.trim() : 'Northstar Group',
        businessUnit: businessUnit ? businessUnit.trim() : 'Head Office'
    };
    db_1.db.users.push(newUser);
    const token = jsonwebtoken_1.default.sign({ id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userSafe } = newUser;
    res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        user: userSafe
    });
};
exports.register = register;
const updateProfile = (req, res) => {
    const currentUser = req.user;
    const { name, dept, company, businessUnit, role } = req.body;
    const user = db_1.db.users.find(u => u.id === currentUser.id || u.email === currentUser.email);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (name)
        user.name = name.trim();
    if (dept)
        user.dept = dept.trim();
    if (company)
        user.company = company.trim();
    if (businessUnit)
        user.businessUnit = businessUnit.trim();
    if (role)
        user.role = role;
    const { password: _, ...userSafe } = user;
    res.json({
        success: true,
        message: 'Profile updated successfully',
        user: userSafe
    });
};
exports.updateProfile = updateProfile;
const getMe = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { password: _, ...userSafe } = req.user;
    res.json({
        success: true,
        user: userSafe
    });
};
exports.getMe = getMe;
const getDemoUsers = (req, res) => {
    const demoUsers = db_1.db.users.map(({ password, ...u }) => u);
    res.json({
        success: true,
        users: demoUsers
    });
};
exports.getDemoUsers = getDemoUsers;
