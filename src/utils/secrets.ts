import fs from 'fs';
import path from 'path';

const DEFAULT_SECRETS_DIR = '/var/run/secrets';

/**
 * Load a secret value with the following priority:
 *   1. File at `<SECRETS_DIR>/<secretName>` — Docker Swarm / Kubernetes secret mount.
 *   2. Environment variable `envVar`.
 *   3. `defaultValue` (if provided).
 *
 * The secrets directory can be overridden by setting the `SECRETS_DIR` environment
 * variable (useful in tests and non-container environments).
 * File contents are trimmed of surrounding whitespace before being returned.
 */
export function loadSecret(
  secretName: string,
  envVar: string,
  defaultValue?: string
): string | undefined {
  const secretsDir = process.env.SECRETS_DIR ?? DEFAULT_SECRETS_DIR;
  const filePath = path.join(secretsDir, secretName);

  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (content.length > 0) return content;
  } catch {
    // File not found or not readable – fall through to env var
  }

  const envValue = process.env[envVar];
  if (envValue !== undefined && envValue.length > 0) return envValue;

  return defaultValue;
}
