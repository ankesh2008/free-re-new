import { Response } from 'express';

export function sendError(res: Response, statusCode: number, message: string) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: statusCode,
      timestamp: new Date().toISOString(),
    },
  });
}
