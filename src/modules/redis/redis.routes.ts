/**
 * Redis Routes – route definitions only.
 * Applies auth + audit middleware, then delegates to the Redis controller.
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { auditMiddleware } from '../../middleware/audit.middleware';
import * as redisController from './redis.controller';

const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware);

router.get('/keys', redisController.getKeys);
router.get('/keys/:key/ttl', redisController.getKeyTtl);
router.get('/keys/:key/hash/:field', redisController.getHashField);
router.get('/keys/:key', redisController.getKeyByName);
router.get('/data', redisController.getData);

export default router;
