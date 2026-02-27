import fs from 'fs';

// Provide a mutable config object – the factory runs before any imports thanks
// to jest.mock hoisting, so we reference the literal object directly.
jest.mock('../src/config', () => ({
  config: {
    jwtAlgorithm: 'HS256',
    jwtSecret: 'test-secret',
    jwtPublicKey: undefined as string | undefined,
    jwtPublicKeyFile: undefined as string | undefined,
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

// Import AFTER mocks are declared so they receive the mocked config
import { config } from '../src/config';
import { getJwtAlgorithm, getJwtVerifyKey } from '../src/utils/jwt';

// Typed alias for mutating the mocked config in tests
const cfg = config as {
  jwtAlgorithm: string;
  jwtSecret: string;
  jwtPublicKey: string | undefined;
  jwtPublicKeyFile: string | undefined;
};

beforeEach(() => {
  cfg.jwtAlgorithm = 'HS256';
  cfg.jwtSecret = 'test-secret';
  cfg.jwtPublicKey = undefined;
  cfg.jwtPublicKeyFile = undefined;
});

// ── getJwtAlgorithm ───────────────────────────────────────────────────────────

describe('getJwtAlgorithm', () => {
  it('returns HS256 by default', () => {
    expect(getJwtAlgorithm()).toBe('HS256');
  });

  it('returns RS256 when configured', () => {
    cfg.jwtAlgorithm = 'RS256';
    expect(getJwtAlgorithm()).toBe('RS256');
  });

  it('is case-insensitive', () => {
    cfg.jwtAlgorithm = 'hs256';
    expect(getJwtAlgorithm()).toBe('HS256');
  });

  it('throws for an unsupported algorithm', () => {
    cfg.jwtAlgorithm = 'NONE';
    expect(() => getJwtAlgorithm()).toThrow('Unsupported JWT algorithm');
    expect(() => getJwtAlgorithm()).toThrow('"NONE"');
  });
});

// ── getJwtVerifyKey ───────────────────────────────────────────────────────────

describe('getJwtVerifyKey', () => {
  let readFileSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    readFileSyncSpy.mockRestore();
  });

  it('returns jwtSecret for HS256', () => {
    expect(getJwtVerifyKey()).toBe('test-secret');
    expect(readFileSyncSpy).not.toHaveBeenCalled();
  });

  it('returns the inline public key string for RS256 when jwtPublicKey is set', () => {
    cfg.jwtAlgorithm = 'RS256';
    cfg.jwtPublicKey = '-----BEGIN PUBLIC KEY-----\nMIIBIj...\n-----END PUBLIC KEY-----';

    const key = getJwtVerifyKey();

    expect(key).toBe(cfg.jwtPublicKey);
    expect(readFileSyncSpy).not.toHaveBeenCalled();
  });

  it('reads the public key from file when jwtPublicKeyFile is set (and jwtPublicKey is absent)', () => {
    cfg.jwtAlgorithm = 'RS256';
    cfg.jwtPublicKeyFile = '/run/secrets/pub.pem';
    const fileContent = Buffer.from('-----BEGIN PUBLIC KEY-----\n...');
    readFileSyncSpy.mockReturnValueOnce(fileContent);

    const key = getJwtVerifyKey();

    expect(key).toEqual(fileContent);
    expect(readFileSyncSpy).toHaveBeenCalledWith('/run/secrets/pub.pem');
  });

  it('prefers jwtPublicKey over jwtPublicKeyFile for RS256', () => {
    cfg.jwtAlgorithm = 'RS256';
    cfg.jwtPublicKey = 'inline-key';
    cfg.jwtPublicKeyFile = '/some/file.pem';

    expect(getJwtVerifyKey()).toBe('inline-key');
    expect(readFileSyncSpy).not.toHaveBeenCalled();
  });

  it('throws for RS256 when no public key source is configured', () => {
    cfg.jwtAlgorithm = 'RS256';

    expect(() => getJwtVerifyKey()).toThrow('RS256 requires a public key');
  });
});
