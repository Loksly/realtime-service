import { Response, NextFunction } from 'express';
import { auditMiddleware } from '../src/middleware/audit.middleware';
import { AuthenticatedRequest } from '../src/types';

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

jest.mock('../src/config', () => ({
  config: { logLevel: 'info', auditLogFile: 'logs/audit.log', appLogFile: 'logs/app.log' },
}));

import { auditLogger } from '../src/utils/logger';

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: '1', username: 'alice', roles: ['reader'] },
    method: 'GET',
    originalUrl: '/api/v1/redis/keys',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeRes(statusCode = 200) {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    statusCode,
    on: (event: string, fn: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(fn);
    },
    emit: (event: string) => listeners[event]?.forEach((fn) => fn()),
  };
}

describe('auditMiddleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => (auditLogger.info as jest.Mock).mockClear());

  it('calls next()', () => {
    const res = makeRes();
    auditMiddleware(makeReq(), res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('logs user, method, url, and status code on response finish', () => {
    const res = makeRes(200);
    auditMiddleware(makeReq(), res as unknown as Response, next);
    res.emit('finish');

    expect(auditLogger.info as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
        username: 'alice',
        method: 'GET',
        url: '/api/v1/redis/keys',
        statusCode: 200,
        ip: '127.0.0.1',
      })
    );
  });

  it('includes an ISO timestamp in the audit entry', () => {
    const res = makeRes();
    auditMiddleware(makeReq(), res as unknown as Response, next);
    res.emit('finish');

    const entry = (auditLogger.info as jest.Mock).mock.calls[0][0] as { timestamp: string };
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('logs undefined userId/username when request has no authenticated user', () => {
    const req = makeReq({ user: undefined });
    const res = makeRes(401);
    auditMiddleware(req, res as unknown as Response, next);
    res.emit('finish');

    expect(auditLogger.info as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined, username: undefined, statusCode: 401 })
    );
  });

  it('uses socket.remoteAddress when req.ip is undefined', () => {
    const req = makeReq({ ip: undefined });
    const res = makeRes();
    auditMiddleware(req, res as unknown as Response, next);
    res.emit('finish');

    expect(auditLogger.info as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '127.0.0.1' })
    );
  });
});
