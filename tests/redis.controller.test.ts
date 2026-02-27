import { Response } from 'express';
import * as redisController from '../src/modules/redis/redis.controller';
import { RedisService } from '../src/modules/redis/redis.service';
import { AuthenticatedRequest } from '../src/types';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

// Mock the Redis provider so no real connection is made
jest.mock('../src/modules/redis/redis.provider', () => ({
  getRedisClient: jest.fn(() => ({})),
}));

// Spy on RedisService methods
const mockGetKeys = jest.fn();
const mockType = jest.fn();
const mockGet = jest.fn();
const mockHgetall = jest.fn();
const mockLrange = jest.fn();
const mockSmembers = jest.fn();
const mockHget = jest.fn();
const mockTtl = jest.fn();
const mockGetKeyValues = jest.fn();

jest.spyOn(RedisService.prototype, 'getKeys').mockImplementation(mockGetKeys);
jest.spyOn(RedisService.prototype, 'type').mockImplementation(mockType);
jest.spyOn(RedisService.prototype, 'get').mockImplementation(mockGet);
jest.spyOn(RedisService.prototype, 'hgetall').mockImplementation(mockHgetall);
jest.spyOn(RedisService.prototype, 'lrange').mockImplementation(mockLrange);
jest.spyOn(RedisService.prototype, 'smembers').mockImplementation(mockSmembers);
jest.spyOn(RedisService.prototype, 'hget').mockImplementation(mockHget);
jest.spyOn(RedisService.prototype, 'ttl').mockImplementation(mockTtl);
jest.spyOn(RedisService.prototype, 'getKeyValues').mockImplementation(mockGetKeyValues);

function makeRes(): jest.Mocked<Partial<Response>> {
  const res = {} as jest.Mocked<Partial<Response>>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(override: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    query: {},
    params: {},
    user: { id: '1', username: 'alice', roles: ['reader'] },
    ...override,
  } as unknown as AuthenticatedRequest;
}

beforeEach(() => jest.clearAllMocks());

// ── getKeys ──────────────────────────────────────────────────────────────────

describe('getKeys controller', () => {
  it('returns keys from the service', async () => {
    mockGetKeys.mockResolvedValue(['user:1', 'user:2']);
    const res = makeRes();

    await redisController.getKeys(makeReq(), res as Response);

    expect(res.json).toHaveBeenCalledWith({ keys: ['user:1', 'user:2'] });
  });

  it('passes query pattern to the service', async () => {
    mockGetKeys.mockResolvedValue([]);
    const res = makeRes();

    await redisController.getKeys(makeReq({ query: { pattern: 'user:*' } }), res as Response);

    expect(mockGetKeys).toHaveBeenCalledWith('user:*');
  });

  it('returns 500 on service error', async () => {
    mockGetKeys.mockRejectedValue(new Error('redis down'));
    const res = makeRes();

    await redisController.getKeys(makeReq(), res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'redis down' });
  });
});

// ── getKeyByName ─────────────────────────────────────────────────────────────

describe('getKeyByName controller', () => {
  it('returns string value', async () => {
    mockType.mockResolvedValue('string');
    mockGet.mockResolvedValue('hello');
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 'mykey' } }), res as Response);

    expect(res.json).toHaveBeenCalledWith({ key: 'mykey', value: 'hello', type: 'string' });
  });

  it('returns hash value', async () => {
    mockType.mockResolvedValue('hash');
    mockHgetall.mockResolvedValue({ f: 'v' });
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 'h' } }), res as Response);

    expect(res.json).toHaveBeenCalledWith({ key: 'h', value: { f: 'v' }, type: 'hash' });
  });

  it('returns list value', async () => {
    mockType.mockResolvedValue('list');
    mockLrange.mockResolvedValue(['a', 'b']);
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 'l' } }), res as Response);

    expect(res.json).toHaveBeenCalledWith({ key: 'l', value: ['a', 'b'], type: 'list' });
  });

  it('returns set value', async () => {
    mockType.mockResolvedValue('set');
    mockSmembers.mockResolvedValue(['m1']);
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 's' } }), res as Response);

    expect(res.json).toHaveBeenCalledWith({ key: 's', value: ['m1'], type: 'set' });
  });

  it('returns null value for unknown type', async () => {
    mockType.mockResolvedValue('zset');
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 'z' } }), res as Response);

    expect(res.json).toHaveBeenCalledWith({ key: 'z', value: undefined, type: 'zset' });
  });

  it('returns 403 when key is disallowed', async () => {
    mockType.mockRejectedValue(new Error('Key "secret" does not match the allowed pattern'));
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 'secret' } }), res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 on generic service error', async () => {
    mockType.mockRejectedValue(new Error('timeout'));
    const res = makeRes();

    await redisController.getKeyByName(makeReq({ params: { key: 'k' } }), res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── getKeyTtl ─────────────────────────────────────────────────────────────────

describe('getKeyTtl controller', () => {
  it('returns TTL from service', async () => {
    mockTtl.mockResolvedValue(120);
    const res = makeRes();

    await redisController.getKeyTtl(makeReq({ params: { key: 'k' } }), res as Response);

    expect(res.json).toHaveBeenCalledWith({ key: 'k', ttl: 120 });
  });

  it('returns 403 when key is disallowed', async () => {
    mockTtl.mockRejectedValue(new Error('does not match'));
    const res = makeRes();

    await redisController.getKeyTtl(makeReq({ params: { key: 'k' } }), res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 on generic error', async () => {
    mockTtl.mockRejectedValue(new Error('timeout'));
    const res = makeRes();

    await redisController.getKeyTtl(makeReq({ params: { key: 'k' } }), res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── getHashField ──────────────────────────────────────────────────────────────

describe('getHashField controller', () => {
  it('returns hash field value', async () => {
    mockHget.mockResolvedValue('val');
    const res = makeRes();

    await redisController.getHashField(
      makeReq({ params: { key: 'h', field: 'f' } }),
      res as Response
    );

    expect(res.json).toHaveBeenCalledWith({ key: 'h', field: 'f', value: 'val' });
  });

  it('returns 403 when key is disallowed', async () => {
    mockHget.mockRejectedValue(new Error('does not match'));
    const res = makeRes();

    await redisController.getHashField(
      makeReq({ params: { key: 'h', field: 'f' } }),
      res as Response
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ── getData ───────────────────────────────────────────────────────────────────

describe('getData controller', () => {
  it('returns all key-value pairs', async () => {
    const payload = [{ key: 'k1', value: 'v1', type: 'string' }];
    mockGetKeyValues.mockResolvedValue(payload);
    const res = makeRes();

    await redisController.getData(makeReq(), res as Response);

    expect(res.json).toHaveBeenCalledWith({ data: payload });
  });

  it('passes query pattern to the service', async () => {
    mockGetKeyValues.mockResolvedValue([]);
    const res = makeRes();

    await redisController.getData(makeReq({ query: { pattern: 'user:*' } }), res as Response);

    expect(mockGetKeyValues).toHaveBeenCalledWith('user:*');
  });

  it('returns 500 on service error', async () => {
    mockGetKeyValues.mockRejectedValue(new Error('oops'));
    const res = makeRes();

    await redisController.getData(makeReq(), res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
