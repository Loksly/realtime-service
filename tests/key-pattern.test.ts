import { keyMatchesPattern } from '../src/utils/key-pattern';

describe('keyMatchesPattern', () => {
  describe('wildcard *', () => {
    it('returns true for bare * pattern', () => {
      expect(keyMatchesPattern('anything', '*')).toBe(true);
      expect(keyMatchesPattern('', '*')).toBe(true);
    });

    it('matches prefix patterns', () => {
      expect(keyMatchesPattern('user:123', 'user:*')).toBe(true);
      expect(keyMatchesPattern('order:456', 'user:*')).toBe(false);
    });

    it('matches suffix patterns', () => {
      expect(keyMatchesPattern('session:abc', '*:abc')).toBe(true);
      expect(keyMatchesPattern('session:xyz', '*:abc')).toBe(false);
    });

    it('matches mid-string wildcards', () => {
      expect(keyMatchesPattern('foo:bar:baz', 'foo:*:baz')).toBe(true);
      expect(keyMatchesPattern('foo:bar:qux', 'foo:*:baz')).toBe(false);
    });

    it('matches multiple wildcards', () => {
      expect(keyMatchesPattern('a:b:c', '*:*:*')).toBe(true);
      expect(keyMatchesPattern('a:b', '*:*:*')).toBe(false);
    });
  });

  describe('single-char ?', () => {
    it('matches exactly one character', () => {
      expect(keyMatchesPattern('key1', 'key?')).toBe(true);
      expect(keyMatchesPattern('key12', 'key?')).toBe(false);
      expect(keyMatchesPattern('key', 'key?')).toBe(false);
    });
  });

  describe('character classes [...]', () => {
    it('matches any character in the class', () => {
      expect(keyMatchesPattern('keya', 'key[abc]')).toBe(true);
      expect(keyMatchesPattern('keyd', 'key[abc]')).toBe(false);
    });

    it('supports negation with ^', () => {
      expect(keyMatchesPattern('keyx', 'key[^abc]')).toBe(true);
      expect(keyMatchesPattern('keya', 'key[^abc]')).toBe(false);
    });

    it('supports negation with !', () => {
      expect(keyMatchesPattern('keyx', 'key[!abc]')).toBe(true);
      expect(keyMatchesPattern('keyb', 'key[!abc]')).toBe(false);
    });
  });

  describe('literal special chars', () => {
    it('escapes regex metacharacters in patterns', () => {
      expect(keyMatchesPattern('key.value', 'key.value')).toBe(true);
      expect(keyMatchesPattern('keyXvalue', 'key.value')).toBe(false);
    });

    it('matches exact string with no wildcards', () => {
      expect(keyMatchesPattern('exact', 'exact')).toBe(true);
      expect(keyMatchesPattern('exactx', 'exact')).toBe(false);
    });
  });
});
