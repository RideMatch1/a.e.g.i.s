// templates/nextjs-supabase/files/lib/security/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * AES-256-GCM symmetric encryption with authentication tag.
 *
 * Output format (base64): <12-byte IV><16-byte tag><ciphertext>.
 * The key must be 32 bytes, supplied as a hex string (64 chars).
 *
 * Use for at-rest encryption of secrets stored in your DB — API keys,
 * OAuth tokens, passwords to external services. Do NOT use for
 * password hashing (use Argon2id / bcrypt with a dedicated library).
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error(`encrypt: key must be 32 bytes (got ${key.length})`);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(ciphertextB64: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error(`decrypt: key must be 32 bytes (got ${key.length})`);
  const buf = Buffer.from(ciphertextB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/**
 * Constant-time string comparison. Use for every secret-vs-secret check
 * (CSRF tokens, HMAC signatures, API-key headers). String-based, not
 * buffer-based, so callers don't accidentally compare hex-encodings of
 * different lengths.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
