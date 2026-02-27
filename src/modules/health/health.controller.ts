/**
 * Health Controller – HTTP layer.
 * Verifies Redis connectivity and returns a structured status payload.
 */
import { Request, Response } from 'express';
import { getRedisClient } from '../redis/redis.provider';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    res.json({
      status: 'ok',
      redis: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'error',
      redis: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
}
