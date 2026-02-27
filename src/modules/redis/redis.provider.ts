/**
 * Redis Provider – infrastructure layer.
 * Owns the single shared Redis connection. No business logic lives here.
 */
import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../../utils/logger';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, {
      db: config.redisDb,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    client.on('connect', () => logger.info('Redis client connected'));
    client.on('error', (err) => logger.error('Redis client error:', err));
    client.on('close', () => logger.warn('Redis client connection closed'));
  }
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
