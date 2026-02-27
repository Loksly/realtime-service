import fs from 'fs';
import { Algorithm } from 'jsonwebtoken';
import { config } from '../config';

const SUPPORTED_ALGORITHMS: ReadonlySet<string> = new Set(['HS256', 'RS256']);

/**
 * Return the configured JWT algorithm.
 * Throws for unsupported values so misconfiguration is caught at startup.
 */
export function getJwtAlgorithm(): Algorithm {
  const algo = config.jwtAlgorithm.toUpperCase();
  if (!SUPPORTED_ALGORITHMS.has(algo)) {
    throw new Error(
      `Unsupported JWT algorithm: "${config.jwtAlgorithm}". Supported: ${[...SUPPORTED_ALGORITHMS].join(', ')}`
    );
  }
  return algo as Algorithm;
}

/**
 * Return the key used to *verify* incoming JWTs.
 *
 * - HS256 → the shared secret (`config.jwtSecret`), loaded from
 *            `/var/run/secrets/jwt_secret` or the `JWT_SECRET` env var.
 * - RS256 → the RSA public key, resolved in this order:
 *            1. `config.jwtPublicKey` (PEM string) – from
 *               `/var/run/secrets/jwt_public_key` or `JWT_PUBLIC_KEY` env var.
 *            2. `config.jwtPublicKeyFile` – path to a PEM file on disk
 *               (`JWT_PUBLIC_KEY_FILE` env var).
 */
export function getJwtVerifyKey(): string | Buffer {
  const algo = getJwtAlgorithm();

  if (algo === 'RS256') {
    if (config.jwtPublicKey) {
      return config.jwtPublicKey;
    }
    if (config.jwtPublicKeyFile) {
      return fs.readFileSync(config.jwtPublicKeyFile);
    }
    throw new Error(
      'RS256 requires a public key. ' +
        'Provide it via /var/run/secrets/jwt_public_key, ' +
        'the JWT_PUBLIC_KEY env var, or the JWT_PUBLIC_KEY_FILE env var.'
    );
  }

  // HS256
  return config.jwtSecret;
}
