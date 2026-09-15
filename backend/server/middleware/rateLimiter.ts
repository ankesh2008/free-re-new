import { Request, Response, NextFunction } from 'express';
import { sendError } from '../lib/response';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const stores = new Map<string, Map<string, RateLimitStore>>();

export function createRateLimiter(options: { windowMs: number; max: number; keyPrefix?: string }) {
  const { windowMs, max, keyPrefix = 'default' } = options;
  if (!stores.has(keyPrefix)) {
    stores.set(keyPrefix, new Map());
  }
  const store = stores.get(keyPrefix)!;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = store.get(ip);
    if (!record || now > record.resetTime) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      return sendError(res, 429, 'Too many requests. Please try again later.');
    }

    record.count++;
    next();
  };
}

const socketLimits = new Map<string, { count: number; resetTime: number }>();

export function checkSocketRateLimit(socketId: string, max: number = 20, windowMs: number = 10000): boolean {
  const now = Date.now();
  const record = socketLimits.get(socketId);

  if (!record || now > record.resetTime) {
    socketLimits.set(socketId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= max) {
    return false;
  }

  record.count++;
  return true;
}
