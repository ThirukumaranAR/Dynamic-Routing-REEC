"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const requestRoutes_1 = __importDefault(require("./routes/requestRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const db_1 = require("./services/db");
const auth_1 = require("./services/auth");
const authMiddleware_1 = require("./middleware/authMiddleware");
dotenv_1.default.config();
(0, auth_1.getJwtSecret)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
    ...(process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(origin => origin.trim()).filter(Boolean),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o)))
            callback(null, true);
        else
            callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express_1.default.json({ limit: '16mb' }));
app.use((0, cookie_parser_1.default)());
app.use('/api', authMiddleware_1.enforceCsrfOrigin);
// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
const databaseReady = (0, db_1.connectDatabase)();
app.use('/api', async (_req, res, next) => {
    try {
        await databaseReady;
        next();
    }
    catch {
        res.status(503).json({ success: false, message: 'Database is unavailable; no in-memory fallback is enabled.' });
    }
});
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/requests', requestRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.get('/api/health', (req, res) => {
    const ready = (0, db_1.databaseIsReady)();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable', database: ready ? 'connected' : 'disconnected', timestamp: new Date().toISOString(), system: 'FlowNexus' });
});
app.use((error, _req, res, _next) => {
    if (error?.name === 'ValidationError')
        return res.status(400).json({ success: false, message: error.message });
    if (error?.code === 11000 || error?.code === 'P2002')
        return res.status(409).json({ success: false, message: 'A record with these unique fields already exists' });
    console.error('API request failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, message: 'The server could not complete the request' });
});
if (process.env.VERCEL !== '1') {
    const startServer = async () => {
        (0, auth_1.getJwtSecret)();
        await databaseReady;
        app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`====================================================`);
            console.log(`FlowNexus API server running.`);
            console.log(`📡 Listening on http://localhost:${PORT}`);
            console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
            console.log(`====================================================`);
        });
    };
    startServer().catch(error => {
        console.error('Backend startup failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
exports.default = app;
