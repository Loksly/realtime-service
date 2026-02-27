import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  redisUrl: string;
  redisDb: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  redisKeyPattern: string;
  logLevel: string;
  auditLogFile: string;
  appLogFile: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  redisDb: parseInt(process.env.REDIS_DB ?? '0', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'default-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  redisKeyPattern: process.env.REDIS_KEY_PATTERN ?? '*',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  auditLogFile: process.env.AUDIT_LOG_FILE ?? 'logs/audit.log',
  appLogFile: process.env.APP_LOG_FILE ?? 'logs/app.log',
};
