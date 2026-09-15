import { Response } from 'express';
import { db } from '../services/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { User } from '../models/types';

const safeUser = ({ password, ...user }: User) => user;

const timestamp = () => new Date().toLocaleString('en-IN');

export const listManagementData = (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    roles: db.roles,
    users: db.users.map(safeUser)
  });
};

export const createManagedUser = (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, role, dept, company, businessUnit } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
  }

  if (db.users.some(user => user.email.toLowerCase() === String(email).trim().toLowerCase())) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  if (!db.roles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Create the role before assigning it to a user' });
  }

  const newUser: User = {
    id: `usr-${Date.now()}`,
    email: String(email).trim(),
    password: String(password),
    name: String(name).trim(),
    role: String(role),
    dept: dept ? String(dept).trim() : 'General',
    company: company ? String(company).trim() : 'Northstar Group',
    businessUnit: businessUnit ? String(businessUnit).trim() : 'Head Office'
  };

  db.users.push(newUser);
  res.status(201).json({ success: true, user: safeUser(newUser) });
};

export const deleteManagedUser = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.userId;
  if (userId === req.user?.id) {
    return res.status(400).json({ success: false, message: 'The CEO account cannot be removed by itself' });
  }

  const index = db.users.findIndex(user => user.id === userId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const [removed] = db.users.splice(index, 1);
  res.json({ success: true, message: `${removed.name}'s account was removed` });
};

export const createRole = (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.body.role || '').trim().toUpperCase();
  if (!role) {
    return res.status(400).json({ success: false, message: 'Role name is required' });
  }
  if (db.roles.includes(role)) {
    return res.status(409).json({ success: false, message: 'Role already exists' });
  }

  db.roles.push(role);
  res.status(201).json({ success: true, role, roles: db.roles });
};

export const deleteRole = (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role).trim().toUpperCase();
  if (role === 'CEO') {
    return res.status(400).json({ success: false, message: 'The CEO role cannot be removed' });
  }

  const replacementRole = String(req.body.replacementRole || '').trim().toUpperCase();
  if (!db.roles.includes(role)) {
    return res.status(404).json({ success: false, message: 'Role not found' });
  }
  if (!db.roles.includes(replacementRole) || replacementRole === role) {
    return res.status(400).json({ success: false, message: 'Choose a valid replacement role' });
  }

  db.users.forEach(user => {
    if (user.role === role) user.role = replacementRole;
  });
  db.requests.forEach(request => {
    if (request.assignedRole === role) {
      request.assignedRole = replacementRole;
      request.auditTrail.push({
        ts: timestamp(),
        actor: req.user!.name,
        action: `Role ${role} removed; responsibility transferred to ${replacementRole}`
      });
    }
  });
  db.roles = db.roles.filter(existingRole => existingRole !== role);

  res.json({ success: true, message: `Role ${role} removed and responsibilities transferred`, roles: db.roles });
};