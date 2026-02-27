import { Request, Response } from 'express';
import * as healthController from '../src/modules/health/health.controller';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

// Mock the Redis provider
const mockPing = jest.fn();
jest.mock('../src/modules/redis/redis.provider', () => ({
  getRedisClient: jest.fn(() => ({ ping: mockPing })),
}));

function makeRes(): jest.Mocked<Partial<Response>> {
  const res = {} as jest.Mocked<Partial<Response>>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('healthController.getHealth', () => {
  const req = {} as Request;

  beforeEach(() => mockPing.mockReset());

  it('returns status ok when Redis is reachable', async () => {
    mockPing.mockResolvedValue('PONG');
    const res = makeRes();

    await healthController.getHealth(req, res as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', redis: 'connected' })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 when Redis ping fails', async () => {
    mockPing.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = makeRes();

    await healthController.getHealth(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', redis: 'disconnected' })
    );
  });

  it('includes an ISO timestamp in the response', async () => {
    mockPing.mockResolvedValue('PONG');
    const res = makeRes();

    await healthController.getHealth(req, res as Response);

    const arg = (res.json as jest.Mock).mock.calls[0][0] as { timestamp: string };
    expect(new Date(arg.timestamp).toISOString()).toBe(arg.timestamp);
  });
});
