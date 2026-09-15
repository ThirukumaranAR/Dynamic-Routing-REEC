import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../services/db';
import { User } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

const JWT_SECRET = process.env.JWT_SECRET || 'northstar_workflow_secret_2026';

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }

      const user = db.users.find(u => u.id === decoded.id || u.email === decoded.email);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      req.user = user;
      next();
    });
  } else {
    // If no header, allow demo fallback header x-user-email for fast testing
    const demoEmail = req.headers['x-user-email'] as string;
    if (demoEmail) {
      const user = db.users.find(u => u.email === demoEmail);
      if (user) {
        req.user = user;
        return next();
      }
    }

    res.status(401).json({ success: false, message: 'Authentication required' });
  }
};

export const requireCEO = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'CEO') {
    return res.status(403).json({ success: false, message: 'Only the CEO can manage users, roles, and reassignment.' });
  }

  next();
};
