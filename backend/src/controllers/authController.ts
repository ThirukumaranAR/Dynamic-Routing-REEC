import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../services/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { User } from '../models/types';

const JWT_SECRET = process.env.JWT_SECRET || 'northstar_workflow_secret_2026';

export const login = (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password: _, ...userSafe } = user;

  res.json({
    success: true,
    token,
    user: userSafe
  });
};

export const register = (req: Request, res: Response) => {
  const { name, email, password, role, dept, company, businessUnit } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  const newUser: User = {
    id: `usr-${db.users.length + 1}`,
    email: email.trim(),
    password,
    name: name.trim(),
    role: role || 'REQUESTER',
    dept: dept ? dept.trim() : 'General',
    company: company ? company.trim() : 'Northstar Group',
    businessUnit: businessUnit ? businessUnit.trim() : 'Head Office'
  };

  db.users.push(newUser);

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password: _, ...userSafe } = newUser;

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    user: userSafe
  });
};

export const updateProfile = (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const { name, dept, company, businessUnit, role } = req.body;

  const user = db.users.find(u => u.id === currentUser.id || u.email === currentUser.email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (name) user.name = name.trim();
  if (dept) user.dept = dept.trim();
  if (company) user.company = company.trim();
  if (businessUnit) user.businessUnit = businessUnit.trim();
  if (role) user.role = role;

  const { password: _, ...userSafe } = user;

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: userSafe
  });
};

export const getMe = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { password: _, ...userSafe } = req.user;
  res.json({
    success: true,
    user: userSafe
  });
};

export const getDemoUsers = (req: Request, res: Response) => {
  const demoUsers = db.users.map(({ password, ...u }) => u);
  res.json({
    success: true,
    users: demoUsers
  });
};
