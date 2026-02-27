import { Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authMiddleware } from '../src/middleware/auth.middleware';
import { AuthenticatedRequest } from '../src/types';
import * as jwtUtils from '../src/utils/jwt';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

// Prevent real config loading (avoids /var/run/secrets filesystem access)
jest.mock('../src/config', () => ({
  config: {
    jwtAlgorithm: 'HS256',
    jwtSecret: 'test-secret',
    jwtPublicKey: undefined,
    jwtPublicKeyFile: undefined,
  },
}));

// RSA key pair generated once for all RS256 tests in this file
const { privateKey: rsaPrivateKey, publicKey: rsaPublicKey } =
  crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

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

// ── HS256 ─────────────────────────────────────────────────────────────────────

describe('authMiddleware – HS256', () => {
  const HS256_SECRET = 'hs256-test-secret';
  const next = jest.fn();

  function validToken(payload: object = { id: '1', username: 'alice', roles: ['reader'] }) {
    return jwt.sign(payload, HS256_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  }

  beforeEach(() => {
    jest.spyOn(jwtUtils, 'getJwtAlgorithm').mockReturnValue('HS256');
    jest.spyOn(jwtUtils, 'getJwtVerifyKey').mockReturnValue(HS256_SECRET);
    next.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('calls next() and attaches user for a valid HS256 token', () => {
    const req = makeReq(`Bearer ${validToken()}`);
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: '1', username: 'alice' });
  });

  it('returns 401 when the Authorization header is missing', () => {
    const res = makeRes();

    authMiddleware(makeReq(), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the header does not start with "Bearer "', () => {
    const res = makeRes();

    authMiddleware(makeReq(`Token ${validToken()}`), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired HS256 token', () => {
    const expired = jwt.sign({ id: '1', username: 'alice', roles: [] }, HS256_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
    });
    const res = makeRes();

    authMiddleware(makeReq(`Bearer ${expired}`), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a token signed with the wrong HS256 secret', () => {
    const bad = jwt.sign({ id: '1', roles: [] }, 'wrong-secret', { algorithm: 'HS256' });
    const res = makeRes();

    authMiddleware(makeReq(`Bearer ${bad}`), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed token string', () => {
    const res = makeRes();

    authMiddleware(makeReq('Bearer not.a.jwt'), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── RS256 ─────────────────────────────────────────────────────────────────────

describe('authMiddleware – RS256', () => {
  const next = jest.fn();

  function validToken(payload: object = { id: '2', username: 'bob', roles: ['reader'] }) {
    return jwt.sign(payload, rsaPrivateKey, { algorithm: 'RS256', expiresIn: '1h' });
  }

  beforeEach(() => {
    jest.spyOn(jwtUtils, 'getJwtAlgorithm').mockReturnValue('RS256');
    jest.spyOn(jwtUtils, 'getJwtVerifyKey').mockReturnValue(rsaPublicKey);
    next.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('calls next() and attaches user for a valid RS256 token', () => {
    const req = makeReq(`Bearer ${validToken()}`);
    const res = makeRes();

    authMiddleware(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: '2', username: 'bob' });
  });

  it('returns 401 for a token signed with a different RSA private key', () => {
    const { privateKey: otherPrivateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const bad = jwt.sign({ id: '3', roles: [] }, otherPrivateKey, { algorithm: 'RS256' });
    const res = makeRes();

    authMiddleware(makeReq(`Bearer ${bad}`), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when an HS256 token is presented to an RS256 endpoint', () => {
    const hs256Token = jwt.sign({ id: '1', roles: [] }, 'some-secret', { algorithm: 'HS256' });
    const res = makeRes();

    authMiddleware(makeReq(`Bearer ${hs256Token}`), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired RS256 token', () => {
    const expired = jwt.sign({ id: '2', roles: [] }, rsaPrivateKey, {
      algorithm: 'RS256',
      expiresIn: -1,
    });
    const res = makeRes();

    authMiddleware(makeReq(`Bearer ${expired}`), res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

