import { Request, Response, NextFunction } from 'express';
import { loggerMiddleware } from '../src/middleware/logger.middleware';

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

jest.mock('../src/config', () => ({
  config: { logLevel: 'info', auditLogFile: 'logs/audit.log', appLogFile: 'logs/app.log' },
}));

import { logger } from '../src/utils/logger';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/api/v1/health',
    ip: '10.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    socket: { remoteAddress: '10.0.0.1' },
    ...overrides,
  } as unknown as Request;
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

describe('loggerMiddleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => (logger.info as jest.Mock).mockClear());

  it('calls next()', () => {
    const res = makeRes();
    loggerMiddleware(makeReq(), res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('logs method, url, status, and ip on response finish', () => {
    const res = makeRes(200);
    loggerMiddleware(makeReq(), res as unknown as Response, next);
    res.emit('finish');

    expect(logger.info as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/v1/health',
        status: 200,
        ip: '10.0.0.1',
      })
    );
  });

  it('includes a duration string in the log entry', () => {
    const res = makeRes();
    loggerMiddleware(makeReq(), res as unknown as Response, next);
    res.emit('finish');

    const entry = (logger.info as jest.Mock).mock.calls[0][0] as { duration: string };
    expect(entry.duration).toMatch(/^\d+ms$/);
  });

  it('falls back to socket.remoteAddress when req.ip is undefined', () => {
    const req = makeReq({ ip: undefined });
    const res = makeRes();
    loggerMiddleware(req, res as unknown as Response, next);
    res.emit('finish');

    expect(logger.info as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '10.0.0.1' })
    );
  });
});
