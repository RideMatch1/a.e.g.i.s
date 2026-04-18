// templates/nextjs-supabase/files/lib/security/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, timingSafeStringEqual } from './crypto';

const KEY_HEX = '0'.repeat(64); // 32 bytes of 0x00 — test key only

describe('AES-256-GCM encrypt/decrypt', () => {
  it('round-trips UTF-8 plaintext', () => {
    const enc = encrypt('hello, ümlauts', KEY_HEX);
    expect(decrypt(enc, KEY_HEX)).toBe('hello, ümlauts');
  });

  it('emits distinct ciphertexts for the same plaintext (fresh IV each call)', () => {
    const a = encrypt('same', KEY_HEX);
    const b = encrypt('same', KEY_HEX);
    expect(a).not.toBe(b);
    expect(decrypt(a, KEY_HEX)).toBe('same');
    expect(decrypt(b, KEY_HEX)).toBe('same');
  });

  it('fails authentication when the ciphertext is tampered with', () => {
    const enc = encrypt('secret', KEY_HEX);
    const tampered = enc.slice(0, -4) + '0000';
    expect(() => decrypt(tampered, KEY_HEX)).toThrow();
  });

  it('rejects a key that is not exactly 32 bytes', () => {
    expect(() => encrypt('x', '00')).toThrow(/key/i);
  });
});

describe('timingSafeStringEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeStringEqual('abc', 'abc')).toBe(true);
  });

  it('returns false for unequal strings of equal length', () => {
    expect(timingSafeStringEqual('abc', 'abd')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(timingSafeStringEqual('abc', 'abcd')).toBe(false);
  });
});
