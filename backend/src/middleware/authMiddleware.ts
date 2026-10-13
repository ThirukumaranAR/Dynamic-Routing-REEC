import { NextFunction, Request, Response } from 'express';
import { User } from '../models/types';
import { prisma } from '../services/db';
import { verifySessionToken } from '../services/auth';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const asyncHandler = (handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };

const allowedOrigins = () => new Set([
  ...(process.env.FRONTEND_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

export const authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const token = (req.cookies?.flownexus_session as string | undefined) || bearerToken;
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const claims = verifySessionToken(token);
    const user = await prisma.user.findFirst({
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
    if (!user) return res.status(401).json({ success: false, message: 'Session user is no longer active' });
    req.user = user as unknown as User;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

export const requireRole = (...roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to perform this action' });
  }
  return next();
};

export const requireCEO = requireRole('CEO', 'CHAIRMAN');
export const requireChairman = requireRole('CHAIRMAN');

export const enforceCsrfOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
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