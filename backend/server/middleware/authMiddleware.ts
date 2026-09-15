import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../lib/response';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication token is required');
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'freere_secret_key_12345';

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; username: string };
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired authentication token');
  }
}
