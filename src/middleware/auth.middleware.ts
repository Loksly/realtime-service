import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtAlgorithm, getJwtVerifyKey } from '../utils/jwt';
import { AuthenticatedRequest, AuthenticatedUser } from '../types';

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, getJwtVerifyKey(), {
      algorithms: [getJwtAlgorithm()],
    }) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
