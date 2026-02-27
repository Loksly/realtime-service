import fs from 'fs';
import path from 'path';
import { loadSecret } from '../src/utils/secrets';

describe('loadSecret', () => {
  const originalEnv = process.env;
  let readFileSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    readFileSyncSpy.mockRestore();
    process.env = originalEnv;
  });

  // ── file takes priority ───────────────────────────────────────────────────

  it('returns file content when the secret file exists', () => {
    process.env.SECRETS_DIR = '/var/run/secrets';
    readFileSyncSpy.mockReturnValueOnce('my-secret-value\n');

    const result = loadSecret('jwt_secret', 'JWT_SECRET');

    expect(result).toBe('my-secret-value');
    expect(readFileSyncSpy).toHaveBeenCalledWith(
      path.join('/var/run/secrets', 'jwt_secret'),
      'utf8'
    );
  });

  it('file value takes priority over the env var', () => {
    process.env.JWT_SECRET = 'env-value';
    readFileSyncSpy.mockReturnValueOnce('file-value');

    const result = loadSecret('jwt_secret', 'JWT_SECRET');

    expect(result).toBe('file-value');
  });

  it('trims surrounding whitespace and newlines from file content', () => {
    readFileSyncSpy.mockReturnValueOnce('  secret-value  \n');

    expect(loadSecret('jwt_secret', 'JWT_SECRET')).toBe('secret-value');
  });

  it('skips a file that contains only whitespace and falls through to env var', () => {
    readFileSyncSpy.mockReturnValueOnce('   \n  ');
    process.env.JWT_SECRET = 'env-fallback';

    expect(loadSecret('jwt_secret', 'JWT_SECRET')).toBe('env-fallback');
  });

  // ── env-var fallback ──────────────────────────────────────────────────────

  it('falls back to the env var when the secret file does not exist', () => {
    readFileSyncSpy.mockImplementationOnce(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    process.env.JWT_SECRET = 'env-secret';

    expect(loadSecret('jwt_secret', 'JWT_SECRET')).toBe('env-secret');
  });

  it('falls back to the env var when the file is unreadable', () => {
    readFileSyncSpy.mockImplementationOnce(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });
    process.env.JWT_SECRET = 'env-secret';

    expect(loadSecret('jwt_secret', 'JWT_SECRET')).toBe('env-secret');
  });

  // ── default value ─────────────────────────────────────────────────────────

  it('returns the default when neither file nor env var is set', () => {
    readFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    delete process.env.JWT_SECRET;

    expect(loadSecret('jwt_secret', 'JWT_SECRET', 'my-default')).toBe('my-default');
  });

  it('returns undefined when there is no source and no default', () => {
    readFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    delete process.env.JWT_PUBLIC_KEY;

    expect(loadSecret('jwt_public_key', 'JWT_PUBLIC_KEY')).toBeUndefined();
  });

  // ── SECRETS_DIR override ──────────────────────────────────────────────────

  it('uses the SECRETS_DIR env var to override the default directory', () => {
    process.env.SECRETS_DIR = '/custom/secrets';
    readFileSyncSpy.mockReturnValueOnce('custom-secret');

    loadSecret('jwt_secret', 'JWT_SECRET');

    expect(readFileSyncSpy).toHaveBeenCalledWith(
      path.join('/custom/secrets', 'jwt_secret'),
      'utf8'
    );
  });

  it('defaults to /var/run/secrets when SECRETS_DIR is not set', () => {
    delete process.env.SECRETS_DIR;
    readFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });

    loadSecret('jwt_secret', 'JWT_SECRET');

    expect(readFileSyncSpy).toHaveBeenCalledWith(
      path.join('/var/run/secrets', 'jwt_secret'),
      'utf8'
    );
  });
});
