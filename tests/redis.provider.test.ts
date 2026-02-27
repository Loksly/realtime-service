jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

jest.mock('../src/config', () => ({
  config: { redisUrl: 'redis://localhost:6379', redisDb: 0 },
}));

const mockQuit = jest.fn().mockResolvedValue('OK');
const mockOn = jest.fn().mockReturnThis();
const MockRedis = jest.fn().mockImplementation(() => ({ on: mockOn, quit: mockQuit }));

jest.mock('ioredis', () => MockRedis);

// Import after mocks so the module receives the mocked Redis constructor
import { getRedisClient, closeRedisClient } from '../src/modules/redis/redis.provider';

describe('RedisProvider', () => {
  beforeEach(async () => {
    await closeRedisClient(); // reset singleton between tests
    MockRedis.mockClear();
    mockQuit.mockClear();
    mockOn.mockClear();
  });

  it('creates a Redis client with the configured url and db', () => {
    getRedisClient();

    expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379', {
      db: 0,
      lazyConnect: true,
      enableReadyCheck: true,
    });
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    const c1 = getRedisClient();
    const c2 = getRedisClient();

    expect(c1).toBe(c2);
    expect(MockRedis).toHaveBeenCalledTimes(1);
  });

  it('registers connect, error, and close event listeners', () => {
    getRedisClient();

    const events = mockOn.mock.calls.map(([event]: [string]) => event);
    expect(events).toContain('connect');
    expect(events).toContain('error');
    expect(events).toContain('close');
  });

  it('calls quit() and clears the singleton on closeRedisClient', async () => {
    getRedisClient();
    await closeRedisClient();

    expect(mockQuit).toHaveBeenCalledTimes(1);

    // Creating a client again should instantiate a new one
    MockRedis.mockClear();
    getRedisClient();
    expect(MockRedis).toHaveBeenCalledTimes(1);
  });

  it('does nothing when closeRedisClient is called without an open client', async () => {
    await expect(closeRedisClient()).resolves.toBeUndefined();
    expect(mockQuit).not.toHaveBeenCalled();
  });
});
