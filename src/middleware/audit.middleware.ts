import { Response, NextFunction } from 'express';
import { auditLogger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';

export function auditMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  res.on('finish', () => {
    auditLogger.info({
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
      username: req.user?.username,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
