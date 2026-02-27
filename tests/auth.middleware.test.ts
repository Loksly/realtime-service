import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/middleware/auth.middleware';
import { AuthenticatedRequest } from '../src/types';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

// Use a deterministic secret for test tokens
process.env.JWT_SECRET = 'test-secret';

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(authHeader?: string): AuthenticatedRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as AuthenticatedRequest;
}

describe('authMiddleware', () => {
  const next = jest.fn();
  const secret = 'test-secret';

  function validToken(payload: object = { id: '1', username: 'alice', roles: ['reader'] }) {
    return jwt.sign(payload, secret, { expiresIn: '1h' });
  }

  beforeEach(() => next.mockClear());

  it('calls next() with a valid Bearer token', () => {
    const req = makeReq(`Bearer ${validToken()}`);
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: '1', username: 'alice' });
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq();
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with "Bearer "', () => {
    const req = makeReq(`Token ${validToken()}`);
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const expired = jwt.sign({ id: '1', username: 'alice', roles: [] }, secret, {
      expiresIn: -1,
    });
    const req = makeReq(`Bearer ${expired}`);
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a token signed with the wrong secret', () => {
    const bad = jwt.sign({ id: '1', username: 'alice', roles: [] }, 'wrong-secret');
    const req = makeReq(`Bearer ${bad}`);
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed token string', () => {
    const req = makeReq('Bearer not.a.jwt');
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
