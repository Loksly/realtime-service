import express, { Application } from 'express';
import rateLimit from 'express-rate-limit';
import { PluginManager } from './plugins/plugin-manager';
import { loggerMiddleware } from './middleware/logger.middleware';
import { config } from './config';
import healthRoutes from './modules/health/health.routes';
import redisRoutes from './modules/redis/redis.routes';

export const pluginManager = new PluginManager();

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(loggerMiddleware);

  // Global rate limiter – protects all routes (auth, DB access, etc.)
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/redis', redisRoutes);

  return app;
}
