import { Router, Request, Response } from 'express';
import { getRedisClient } from '../redis/redis.client';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
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
});

export default router;
