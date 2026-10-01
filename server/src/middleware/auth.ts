import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'smartfleet360_super_secure_jwt_secret_key_2026';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as any;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  actualRole?: string; // Set when Super Admin is temporarily viewing as another role
  status?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please login.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).json({ error: 'Invalid or expired session. Please login again.' });
      return;
    }
    req.user = decoded as AuthUser;
    next();
  });
}

export function optionalAuthenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.user = decoded as AuthUser;
    }
    next();
  });
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    // Super Admin has universal access
    if (req.user.role === 'Super Admin' || req.user.actualRole === 'Super Admin') {
      return next();
    }
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }
    res.status(403).json({ error: 'Access denied: insufficient permissions for this operation.' });
  };
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role === 'Super Admin' || req.user.actualRole === 'Super Admin') {
    return next();
  }
  res.status(403).json({ error: 'Access denied: Super Admin privilege required.' });
}
