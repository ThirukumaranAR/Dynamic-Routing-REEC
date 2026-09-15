import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import requestRoutes from './routes/requestRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

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

export default app;
