import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendError } from '../lib/response';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  userRole?: string;
}

// Generate dynamic secure secret if process.env.JWT_SECRET is absent
let systemJwtSecret = process.env.JWT_SECRET;
if (!systemJwtSecret) {
  systemJwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️ WARNING: JWT_SECRET environment variable is not defined. Generated a temporary random secret in memory.');
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || systemJwtSecret;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication token is required');
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; username: string; role?: string };
    req.userId = decoded.id;
    req.username = decoded.username;
    req.userRole = decoded.role || 'USER';
    next();
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired authentication token');
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId || req.userRole !== 'ADMIN') {
    return sendError(res, 403, 'Access denied: Administrative privileges required');
  }
  next();
}
