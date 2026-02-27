import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import * as jwtUtils from '../src/utils/jwt';
import { RedisService } from '../src/modules/redis/redis.service';

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

jest.mock('../src/config', () => ({
  config: {
    jwtAlgorithm: 'HS256',
    jwtSecret: 'test-secret',
    jwtPublicKey: undefined,
    jwtPublicKeyFile: undefined,
    redisKeyPattern: '*',
    rateLimitWindowMs: 60000,
    rateLimitMax: 100,
  },
}));

const mockPing = jest.fn();
jest.mock('../src/modules/redis/redis.provider', () => ({
  getRedisClient: jest.fn(() => ({ ping: mockPing })),
}));

// Auto-mock the service so no real Redis calls are made
jest.mock('../src/modules/redis/redis.service');

const TEST_SECRET = 'hs256-integration-secret';

function validToken(payload: object = { id: '1', username: 'alice', roles: ['reader'] }) {
  return jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

describe('App – HTTP integration', () => {
  const app = createApp();

  beforeEach(() => {
    mockPing.mockReset();
    jest.spyOn(jwtUtils, 'getJwtAlgorithm').mockReturnValue('HS256');
    jest.spyOn(jwtUtils, 'getJwtVerifyKey').mockReturnValue(TEST_SECRET);
  });

  afterEach(() => jest.restoreAllMocks());

  // ── health ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns 200 with status ok when Redis responds', async () => {
      mockPing.mockResolvedValue('PONG');

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', redis: 'connected' });
    });

    it('returns 503 when Redis is unreachable', async () => {
      mockPing.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: 'error', redis: 'disconnected' });
    });
  });

  // ── redis routes – auth guard ─────────────────────────────────────────────

  describe('GET /api/v1/redis/keys – auth guard', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      const res = await request(app).get('/api/v1/redis/keys');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/redis/keys')
        .set('Authorization', 'Bearer bad.token');
      expect(res.status).toBe(401);
    });
  });

  // ── redis routes – authenticated ──────────────────────────────────────────

  describe('GET /api/v1/redis/keys – authenticated', () => {
    it('returns 200 with the list of keys', async () => {
      (RedisService.prototype.getKeys as jest.Mock).mockResolvedValue(['user:1', 'user:2']);

      const res = await request(app)
        .get('/api/v1/redis/keys')
        .set('Authorization', `Bearer ${validToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.keys).toEqual(['user:1', 'user:2']);
    });
  });

  describe('GET /api/v1/redis/data – authenticated', () => {
    it('returns 200 with key-value data', async () => {
      const data = [{ key: 'user:1', value: 'alice', type: 'string' }];
      (RedisService.prototype.getKeyValues as jest.Mock).mockResolvedValue(data);

      const res = await request(app)
        .get('/api/v1/redis/data')
        .set('Authorization', `Bearer ${validToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(data);
    });
  });
});
