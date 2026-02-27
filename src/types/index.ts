import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  username: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface RedisKeyValue {
  key: string;
  value: string | Record<string, string> | string[] | null;
  type?: string;
}

export interface AuditEntry {
  timestamp: string;
  userId?: string;
  username?: string;
  method: string;
  url: string;
  statusCode: number;
  ip: string | undefined;
  userAgent?: string;
}
