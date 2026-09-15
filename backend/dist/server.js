"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const requestRoutes_1 = __importDefault(require("./routes/requestRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
}));
app.use(express_1.default.json());
// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/requests', requestRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), system: 'Smart Approval System' });
});
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 Smart Approval Backend Server Running!`);
        console.log(`📡 Listening on http://localhost:${PORT}`);
        console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`====================================================`);
    });
}
exports.default = app;
