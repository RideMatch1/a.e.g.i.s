import crypto from 'crypto';

// S11 canary — MD5 used to hash a password. MD5 is cryptographically
// broken (collision-vulnerable) and too fast for password hashing
// regardless. Bcrypt / scrypt / argon2 are the correct choices.

export function hashPassword(plain: string): string {
  return crypto.createHash('md5').update(plain).digest('hex');
}

export function verifyPassword(plain: string, stored: string): boolean {
  return hashPassword(plain) === stored;
}
