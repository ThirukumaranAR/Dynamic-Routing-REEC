"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceCsrfOrigin = exports.requireChairman = exports.requireCEO = exports.requireRole = exports.authenticateJWT = exports.asyncHandler = void 0;
const db_1 = require("../services/db");
const auth_1 = require("../services/auth");
const asyncHandler = (handler) => (req, res, next) => {
    void handler(req, res, next).catch(next);
};
exports.asyncHandler = asyncHandler;
const allowedOrigins = () => new Set([
    ...(process.env.FRONTEND_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
]);
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const token = req.cookies?.flownexus_session || bearerToken;
    if (!token)
        return res.status(401).json({ success: false, message: 'Authentication required' });
    try {
        const claims = (0, auth_1.verifySessionToken)(token);
        const user = await db_1.prisma.user.findFirst({
            where: {
                id: claims.sub,
                email: claims.email,
                isActive: true
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
        if (!user)
            return res.status(401).json({ success: false, message: 'Session user is no longer active' });
        req.user = user;
        return next();
    }
    catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to perform this action' });
    }
    return next();
};
exports.requireRole = requireRole;
exports.requireCEO = (0, exports.requireRole)('CEO', 'CHAIRMAN');
exports.requireChairman = (0, exports.requireRole)('CHAIRMAN');
const enforceCsrfOrigin = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
        return next();
    const origin = req.get('origin') || req.get('referer');
    if (origin) {
        const originUrl = origin.replace(/\/$/, '');
        const isAllowed = Array.from(allowedOrigins()).some(allowed => originUrl.startsWith(allowed.replace(/\/$/, '')));
        if (!isAllowed) {
            return res.status(403).json({ success: false, message: 'Request origin is not allowed' });
        }
    }
    return next();
};
exports.enforceCsrfOrigin = enforceCsrfOrigin;
