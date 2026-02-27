import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { auditMiddleware } from '../middleware/audit.middleware';
import { RedisService } from '../redis/redis.service';
import { AuthenticatedRequest } from '../types';

const router = Router();
const redisService = new RedisService();

router.use(authMiddleware);
router.use(auditMiddleware);

/** GET /api/v1/redis/keys  – list keys matching the optional ?pattern query param */
router.get('/keys', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pattern } = req.query;
    const keys = await redisService.getKeys(pattern as string | undefined);
    res.json({ keys });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** GET /api/v1/redis/keys/:key  – retrieve value of a specific key */
router.get('/keys/:key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const keyType = await redisService.type(key);
    let value;

    switch (keyType) {
      case 'string':
        value = await redisService.get(key);
        break;
      case 'hash':
        value = await redisService.hgetall(key);
        break;
      case 'list':
        value = await redisService.lrange(key, 0, -1);
        break;
      case 'set':
        value = await redisService.smembers(key);
        break;
      default:
        value = null;
    }

    res.json({ key, value, type: keyType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(message.includes('does not match') ? 403 : 500).json({ error: message });
  }
});

/** GET /api/v1/redis/keys/:key/ttl  – TTL in seconds for a key */
router.get('/keys/:key/ttl', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const ttl = await redisService.ttl(key);
    res.json({ key, ttl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(message.includes('does not match') ? 403 : 500).json({ error: message });
  }
});

/** GET /api/v1/redis/keys/:key/hash/:field  – single hash field value */
router.get(
  '/keys/:key/hash/:field',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { key, field } = req.params;
      const value = await redisService.hget(key, field);
      res.json({ key, field, value });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(message.includes('does not match') ? 403 : 500).json({ error: message });
    }
  }
);

/** GET /api/v1/redis/data  – all key-value pairs matching the optional ?pattern */
router.get('/data', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pattern } = req.query;
    const data = await redisService.getKeyValues(pattern as string | undefined);
    res.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
