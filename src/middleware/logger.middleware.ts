import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
