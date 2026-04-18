// templates/nextjs-supabase/files/lib/validation/input.test.ts
import { describe, it, expect } from 'vitest';
import { isValidUUID, sanitizeString, escapePostgrestLike } from './input';

describe('isValidUUID', () => {
  it('accepts canonical v4 UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects strings without dashes', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('rejects obvious non-UUID strings', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('00000000-0000-0000-0000-00000000000')).toBe(false); // 31 chars
  });
});

describe('sanitizeString', () => {
  it('removes control characters', () => {
    expect(sanitizeString('a\x00b\x07c')).toBe('abc');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('enforces maximum length', () => {
    expect(sanitizeString('x'.repeat(100), { maxLength: 10 })).toBe('xxxxxxxxxx');
  });
});

describe('escapePostgrestLike', () => {
  it('escapes percent, underscore, and backslash', () => {
    expect(escapePostgrestLike('100%_done\\')).toBe('100\\%\\_done\\\\');
  });

  it('leaves plain ASCII untouched', () => {
    expect(escapePostgrestLike('hello world')).toBe('hello world');
  });
});
