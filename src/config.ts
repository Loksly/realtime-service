import dotenv from 'dotenv';
import { loadSecret } from './utils/secrets';

dotenv.config();

export interface Config {
  port: number;
  redisUrl: string;
  redisDb: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  /** JWT algorithm: 'HS256' (default) or 'RS256' */
  jwtAlgorithm: string;
  /** RS256 public key as a PEM string (takes priority over jwtPublicKeyFile) */
  jwtPublicKey?: string;
  /** Path to an RS256 public key PEM file */
  jwtPublicKeyFile?: string;
  redisKeyPattern: string;
  logLevel: string;
  auditLogFile: string;
  appLogFile: string;
  /** Sliding window length for the global rate limiter in milliseconds */
  rateLimitWindowMs: number;
  /** Maximum requests per window per IP */
  rateLimitMax: number;
}

export const config: Config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  // Sensitive – loaded from /var/run/secrets/redis_url or REDIS_URL env var
  redisUrl: loadSecret('redis_url', 'REDIS_URL', 'redis://localhost:6379') as string,
  redisDb: parseInt(process.env.REDIS_DB ?? '0', 10),
  // Sensitive – loaded from /var/run/secrets/jwt_secret or JWT_SECRET env var
  jwtSecret: loadSecret('jwt_secret', 'JWT_SECRET', 'default-secret-change-in-production') as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  jwtAlgorithm: process.env.JWT_ALGORITHM ?? 'HS256',
  // Sensitive – loaded from /var/run/secrets/jwt_public_key or JWT_PUBLIC_KEY env var
  jwtPublicKey: loadSecret('jwt_public_key', 'JWT_PUBLIC_KEY'),
  jwtPublicKeyFile: process.env.JWT_PUBLIC_KEY_FILE,
  redisKeyPattern: process.env.REDIS_KEY_PATTERN ?? '*',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  auditLogFile: process.env.AUDIT_LOG_FILE ?? 'logs/audit.log',
  appLogFile: process.env.APP_LOG_FILE ?? 'logs/app.log',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
};

