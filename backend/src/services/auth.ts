import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'northstar_workflow_secret_2026') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  return secret;
};

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export const createSessionToken = (user: { id: string; email: string; role: string }): string =>
  jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '8h', issuer: 'flownexus' });

export const verifySessionToken = (token: string): { sub: string; email: string } =>
  jwt.verify(token, getJwtSecret(), { issuer: 'flownexus' }) as { sub: string; email: string };