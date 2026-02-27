/**
 * Redis Service – business-logic layer.
 * Wraps the provider with key-pattern enforcement and typed read-only operations.
 * No write commands are exposed.
 */
import { Redis } from 'ioredis';
import { getRedisClient } from './redis.provider';
import { config } from '../../config';
import { keyMatchesPattern } from '../../utils/key-pattern';
import { RedisKeyValue } from '../../types';

export class RedisService {
  private client: Redis;
  private keyPattern: string;

  constructor(keyPattern?: string) {
    this.client = getRedisClient();
    this.keyPattern = keyPattern ?? config.redisKeyPattern;
  }

  private assertKeyAllowed(key: string): void {
    if (!keyMatchesPattern(key, this.keyPattern)) {
      throw new Error(`Key "${key}" does not match the allowed pattern`);
    }
  }

  /** Scan Redis for keys matching `searchPattern`, restricted to the allowed pattern. */
  async getKeys(searchPattern?: string): Promise<string[]> {
    const scanPattern = searchPattern ?? this.keyPattern;
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [newCursor, batch] = await this.client.scan(
        cursor,
        'MATCH',
        scanPattern,
        'COUNT',
        100
      );
      cursor = newCursor;

      // When a custom search pattern is supplied, additionally restrict to the
      // allowed key pattern so callers cannot escape the restriction.
      const filtered = searchPattern
        ? batch.filter((k) => keyMatchesPattern(k, this.keyPattern))
        : batch;

      keys.push(...filtered);
    } while (cursor !== '0');

    return keys;
  }

  async get(key: string): Promise<string | null> {
    this.assertKeyAllowed(key);
    return this.client.get(key);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    for (const key of keys) {
      this.assertKeyAllowed(key);
    }
    return this.client.mget(...keys);
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    this.assertKeyAllowed(key);
    return this.client.hgetall(key);
  }

  async hget(key: string, field: string): Promise<string | null> {
    this.assertKeyAllowed(key);
    return this.client.hget(key, field);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this.assertKeyAllowed(key);
    return this.client.lrange(key, start, stop);
  }

  async smembers(key: string): Promise<string[]> {
    this.assertKeyAllowed(key);
    return this.client.smembers(key);
  }

  async type(key: string): Promise<string> {
    this.assertKeyAllowed(key);
    return this.client.type(key);
  }

  async exists(key: string): Promise<number> {
    this.assertKeyAllowed(key);
    return this.client.exists(key);
  }

  async ttl(key: string): Promise<number> {
    this.assertKeyAllowed(key);
    return this.client.ttl(key);
  }

  /** Fetch all key-value pairs for keys matching the (search) pattern. */
  async getKeyValues(searchPattern?: string): Promise<RedisKeyValue[]> {
    const keys = await this.getKeys(searchPattern);
    const results: RedisKeyValue[] = [];

    for (const key of keys) {
      const keyType = await this.client.type(key);
      let value: RedisKeyValue['value'] = null;

      switch (keyType) {
        case 'string':
          value = await this.client.get(key);
          break;
        case 'hash':
          value = await this.client.hgetall(key);
          break;
        case 'list':
          value = await this.client.lrange(key, 0, -1);
          break;
        case 'set':
          value = await this.client.smembers(key);
          break;
      }

      results.push({ key, value, type: keyType });
    }

    return results;
  }
}
