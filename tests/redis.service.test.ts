import { RedisService } from '../src/modules/redis/redis.service';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

// Mock the Redis provider so no real Redis connection is made
const mockRedis = {
  scan: jest.fn(),
  get: jest.fn(),
  mget: jest.fn(),
  hgetall: jest.fn(),
  hget: jest.fn(),
  lrange: jest.fn(),
  smembers: jest.fn(),
  type: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
};

jest.mock('../src/modules/redis/redis.provider', () => ({
  getRedisClient: jest.fn(() => mockRedis),
}));

describe('RedisService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── pattern enforcement ────────────────────────────────────────────────────

  describe('key-pattern enforcement', () => {
    it('throws when key does not match the allowed pattern', async () => {
      const svc = new RedisService('user:*');
      mockRedis.get.mockResolvedValue('value');

      await expect(svc.get('order:123')).rejects.toThrow('does not match the allowed pattern');
    });

    it('allows key that matches the pattern', async () => {
      const svc = new RedisService('user:*');
      mockRedis.get.mockResolvedValue('alice');

      await expect(svc.get('user:42')).resolves.toBe('alice');
    });

    it('throws in mget when any key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.mget(['user:1', 'order:99'])).rejects.toThrow(
        'does not match the allowed pattern'
      );
    });

    it('throws in hgetall when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.hgetall('session:x')).rejects.toThrow('does not match the allowed pattern');
    });

    it('throws in hget when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.hget('session:x', 'field')).rejects.toThrow(
        'does not match the allowed pattern'
      );
    });

    it('throws in lrange when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.lrange('queue:x', 0, -1)).rejects.toThrow(
        'does not match the allowed pattern'
      );
    });

    it('throws in smembers when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.smembers('tags:x')).rejects.toThrow('does not match the allowed pattern');
    });

    it('throws in type when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.type('secret')).rejects.toThrow('does not match the allowed pattern');
    });

    it('throws in exists when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.exists('secret')).rejects.toThrow('does not match the allowed pattern');
    });

    it('throws in ttl when key is disallowed', async () => {
      const svc = new RedisService('user:*');
      await expect(svc.ttl('secret')).rejects.toThrow('does not match the allowed pattern');
    });
  });

  // ── getKeys ───────────────────────────────────────────────────────────────

  describe('getKeys', () => {
    it('returns all keys from a single scan page', async () => {
      const svc = new RedisService('*');
      mockRedis.scan.mockResolvedValueOnce(['0', ['key1', 'key2']]);

      const keys = await svc.getKeys();
      expect(keys).toEqual(['key1', 'key2']);
    });

    it('paginates across multiple scan pages', async () => {
      const svc = new RedisService('*');
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['a', 'b']])
        .mockResolvedValueOnce(['0', ['c']]);

      const keys = await svc.getKeys();
      expect(keys).toEqual(['a', 'b', 'c']);
    });

    it('filters search results against the allowed pattern', async () => {
      const svc = new RedisService('user:*');
      // scan returns mixed keys
      mockRedis.scan.mockResolvedValueOnce(['0', ['user:1', 'order:99', 'user:2']]);

      const keys = await svc.getKeys('user:*');
      expect(keys).toEqual(['user:1', 'user:2']);
    });
  });

  // ── read operations ───────────────────────────────────────────────────────

  describe('read operations', () => {
    const svc = () => new RedisService('*');

    it('get – delegates to client.get', async () => {
      mockRedis.get.mockResolvedValue('hello');
      expect(await svc().get('mykey')).toBe('hello');
    });

    it('mget – delegates to client.mget', async () => {
      mockRedis.mget.mockResolvedValue(['v1', 'v2']);
      expect(await svc().mget(['k1', 'k2'])).toEqual(['v1', 'v2']);
    });

    it('hgetall – delegates to client.hgetall', async () => {
      mockRedis.hgetall.mockResolvedValue({ f: 'v' });
      expect(await svc().hgetall('hash')).toEqual({ f: 'v' });
    });

    it('hget – delegates to client.hget', async () => {
      mockRedis.hget.mockResolvedValue('field-value');
      expect(await svc().hget('hash', 'f')).toBe('field-value');
    });

    it('lrange – delegates to client.lrange', async () => {
      mockRedis.lrange.mockResolvedValue(['item1', 'item2']);
      expect(await svc().lrange('list', 0, -1)).toEqual(['item1', 'item2']);
    });

    it('smembers – delegates to client.smembers', async () => {
      mockRedis.smembers.mockResolvedValue(['m1', 'm2']);
      expect(await svc().smembers('myset')).toEqual(['m1', 'm2']);
    });

    it('type – delegates to client.type', async () => {
      mockRedis.type.mockResolvedValue('string');
      expect(await svc().type('k')).toBe('string');
    });

    it('exists – delegates to client.exists', async () => {
      mockRedis.exists.mockResolvedValue(1);
      expect(await svc().exists('k')).toBe(1);
    });

    it('ttl – delegates to client.ttl', async () => {
      mockRedis.ttl.mockResolvedValue(300);
      expect(await svc().ttl('k')).toBe(300);
    });
  });

  // ── getKeyValues ──────────────────────────────────────────────────────────

  describe('getKeyValues', () => {
    it('returns string values', async () => {
      const svc = new RedisService('*');
      mockRedis.scan.mockResolvedValueOnce(['0', ['s:1']]);
      mockRedis.type.mockResolvedValueOnce('string');
      mockRedis.get.mockResolvedValueOnce('hello');

      const result = await svc.getKeyValues();
      expect(result).toEqual([{ key: 's:1', value: 'hello', type: 'string' }]);
    });

    it('returns hash values', async () => {
      const svc = new RedisService('*');
      mockRedis.scan.mockResolvedValueOnce(['0', ['h:1']]);
      mockRedis.type.mockResolvedValueOnce('hash');
      mockRedis.hgetall.mockResolvedValueOnce({ a: '1' });

      const result = await svc.getKeyValues();
      expect(result).toEqual([{ key: 'h:1', value: { a: '1' }, type: 'hash' }]);
    });

    it('returns list values', async () => {
      const svc = new RedisService('*');
      mockRedis.scan.mockResolvedValueOnce(['0', ['l:1']]);
      mockRedis.type.mockResolvedValueOnce('list');
      mockRedis.lrange.mockResolvedValueOnce(['x', 'y']);

      const result = await svc.getKeyValues();
      expect(result).toEqual([{ key: 'l:1', value: ['x', 'y'], type: 'list' }]);
    });

    it('returns set values', async () => {
      const svc = new RedisService('*');
      mockRedis.scan.mockResolvedValueOnce(['0', ['z:1']]);
      mockRedis.type.mockResolvedValueOnce('set');
      mockRedis.smembers.mockResolvedValueOnce(['m1']);

      const result = await svc.getKeyValues();
      expect(result).toEqual([{ key: 'z:1', value: ['m1'], type: 'set' }]);
    });

    it('returns null value for unsupported types', async () => {
      const svc = new RedisService('*');
      mockRedis.scan.mockResolvedValueOnce(['0', ['z:sorted']]);
      mockRedis.type.mockResolvedValueOnce('zset');

      const result = await svc.getKeyValues();
      expect(result).toEqual([{ key: 'z:sorted', value: null, type: 'zset' }]);
    });
  });
});
