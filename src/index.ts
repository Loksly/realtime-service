import http from 'http';
import { createApp, pluginManager } from './app';
import { config } from './config';
import { SocketService } from './socket/socket.service';
import { logger } from './utils/logger';
import { closeRedisClient } from './redis/redis.client';

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  const socketService = new SocketService(server);

  await pluginManager.initializeAll(app, server);

  server.listen(config.port, () => {
    logger.info(`Realtime service started on port ${config.port}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    await socketService.close();
    await closeRedisClient();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
