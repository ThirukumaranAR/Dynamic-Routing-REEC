"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCEO = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../services/db");
const JWT_SECRET = process.env.JWT_SECRET || 'northstar_workflow_secret_2026';
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ success: false, message: 'Invalid or expired token' });
            }
            const user = db_1.db.users.find(u => u.id === decoded.id || u.email === decoded.email);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            req.user = user;
            next();
        });
    }
    else {
        // If no header, allow demo fallback header x-user-email for fast testing
        const demoEmail = req.headers['x-user-email'];
        if (demoEmail) {
            const user = db_1.db.users.find(u => u.email === demoEmail);
            if (user) {
                req.user = user;
                return next();
            }
        }
        res.status(401).json({ success: false, message: 'Authentication required' });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireCEO = (req, res, next) => {
    if (req.user?.role !== 'CEO') {
        return res.status(403).json({ success: false, message: 'Only the CEO can manage users, roles, and reassignment.' });
    }
    next();
};
exports.requireCEO = requireCEO;
