import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import requestRoutes from './routes/requestRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import adminRoutes from './routes/adminRoutes';
import { connectDatabase, databaseIsReady } from './services/db';
import { getJwtSecret } from './services/auth';
import { enforceCsrfOrigin } from './middleware/authMiddleware';

dotenv.config();
getJwtSecret();

const app = express();
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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) callback(null, true);
    else callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '16mb' }));
app.use(cookieParser());
app.use('/api', enforceCsrfOrigin);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const databaseReady = connectDatabase();

app.use('/api', async (_req, res, next) => {
  try {
    await databaseReady;
    next();
  } catch {
    res.status(503).json({ success: false, message: 'Database is unavailable; no in-memory fallback is enabled.' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  const ready = databaseIsReady();
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable', database: ready ? 'connected' : 'disconnected', timestamp: new Date().toISOString(), system: 'FlowNexus' });
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
  if (error?.code === 11000 || error?.code === 'P2002') return res.status(409).json({ success: false, message: 'A record with these unique fields already exists' });
  console.error('API request failed:', error instanceof Error ? error.message : error);
  return res.status(500).json({ success: false, message: 'The server could not complete the request' });
});

if (process.env.VERCEL !== '1') {
  const startServer = async () => {
    getJwtSecret();
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

export default app;
