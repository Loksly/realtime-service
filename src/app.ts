import express, { Application } from 'express';
import { PluginManager } from './plugins/plugin-manager';
import { loggerMiddleware } from './middleware/logger.middleware';
import healthRoutes from './routes/health.routes';
import redisRoutes from './routes/redis.routes';

export const pluginManager = new PluginManager();

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(loggerMiddleware);

  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/redis', redisRoutes);

  return app;
}
