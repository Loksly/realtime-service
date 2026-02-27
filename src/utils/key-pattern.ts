/**
 * Converts a Redis glob-style pattern into a RegExp and tests the key against it.
 * Supports: * (any chars), ? (single char), [abc] / [^abc] character classes.
 */
export function keyMatchesPattern(key: string, pattern: string): boolean {
  if (pattern === '*') return true;

  let regexStr = '^';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      regexStr += '.*';
    } else if (char === '?') {
      regexStr += '.';
    } else if (char === '[') {
      let j = i + 1;
      let charClass = '[';

      if (j < pattern.length && pattern[j] === '^') {
        charClass += '^';
        j++;
      } else if (j < pattern.length && pattern[j] === '!') {
        charClass += '^';
        j++;
      }

      while (j < pattern.length && pattern[j] !== ']') {
        charClass += pattern[j].replace(/[.+^${}()|\\]/g, '\\$&');
        j++;
      }
      charClass += ']';
      regexStr += charClass;
      i = j;
    } else {
      regexStr += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    i++;
  }

  regexStr += '$';
  return new RegExp(regexStr).test(key);
}
