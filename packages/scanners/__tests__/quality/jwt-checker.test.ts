import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) =>
      walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
  };
});

import { jwtCheckerScanner } from '../../src/quality/jwt-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-jwt-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('jwtCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await jwtCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no JWT usage', async () => {
    createFile(projectPath, 'src/lib/auth.ts', `
      import bcrypt from 'bcrypt';
      export async function hashPassword(password: string) {
        return bcrypt.hash(password, 10);
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('jwt-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags jwt.sign() without expiresIn as HIGH', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function createToken(userId: string) {
        return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string);
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const expiryFindings = result.findings.filter((f) => f.title.includes('expiry'));
    expect(expiryFindings.length).toBeGreaterThan(0);
    expect(expiryFindings[0].severity).toBe('high');
    expect(expiryFindings[0].category).toBe('security');
    expect(expiryFindings[0].owasp).toBe('A02:2021');
    expect(expiryFindings[0].cwe).toBe(347);
  });

  it('does NOT flag jwt.sign() with expiresIn option', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function createToken(userId: string) {
        return jwt.sign(
          { sub: userId },
          process.env.JWT_SECRET as string,
          { expiresIn: '15m', algorithm: 'HS256' }
        );
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const expiryFindings = result.findings.filter((f) => f.title.includes('expiry'));
    expect(expiryFindings).toHaveLength(0);
  });

  it('flags jwt.sign() without explicit algorithm as MEDIUM', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function createToken(userId: string) {
        return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const algorithmFindings = result.findings.filter((f) => f.title.includes('algorithm'));
    expect(algorithmFindings.length).toBeGreaterThan(0);
    expect(algorithmFindings[0].severity).toBe('medium');
  });

  it('flags short hardcoded JWT secret as HIGH', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function createToken(userId: string) {
        return jwt.sign({ sub: userId }, 'mysecret', { expiresIn: '1h' });
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const shortSecretFindings = result.findings.filter((f) => f.title.includes('secret too short'));
    expect(shortSecretFindings.length).toBeGreaterThan(0);
    expect(shortSecretFindings[0].severity).toBe('high');
  });

  it('does NOT flag long environment variable secrets (process.env.JWT_SECRET)', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      const secret = process.env.JWT_SECRET;
      export function createToken(userId: string) {
        return jwt.sign({ sub: userId }, secret, { expiresIn: '15m', algorithm: 'HS256' });
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const shortSecretFindings = result.findings.filter((f) => f.title.includes('secret too short'));
    expect(shortSecretFindings).toHaveLength(0);
  });

  it('flags jwt.decode() without jwt.verify() as CRITICAL', async () => {
    createFile(projectPath, 'src/middleware/auth.ts', `
      import jwt from 'jsonwebtoken';
      export function getUserFromToken(token: string) {
        const payload = jwt.decode(token);
        return payload;
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const decodeFindings = result.findings.filter((f) => f.title.includes('decoded without signature verification'));
    expect(decodeFindings.length).toBeGreaterThan(0);
    expect(decodeFindings[0].severity).toBe('critical');
  });

  it('flags LOW when jwt.decode() used alongside jwt.verify() in same file', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function verifyToken(token: string) {
        jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      }
      // Used for non-auth purposes (e.g. reading claims for display)
      export function readTokenClaims(token: string) {
        return jwt.decode(token);
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // Should not be CRITICAL since verify is also present
    const criticalDecodeFindings = result.findings.filter(
      (f) => f.title.includes('decoded without signature') && f.severity === 'critical',
    );
    expect(criticalDecodeFindings).toHaveLength(0);
    // But should flag LOW informational
    const lowDecodeFindings = result.findings.filter(
      (f) => f.title.includes('jwt.decode()') && f.severity === 'low',
    );
    expect(lowDecodeFindings.length).toBeGreaterThan(0);
  });

  it('flags JWT "none" algorithm as CRITICAL', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function verifyToken(token: string) {
        return jwt.verify(token, '', { algorithms: ['none'] });
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const noneFindings = result.findings.filter((f) => f.title.includes('"none" algorithm'));
    expect(noneFindings.length).toBeGreaterThan(0);
    expect(noneFindings[0].severity).toBe('critical');
  });

  it('skips test files', async () => {
    createFile(projectPath, 'src/__tests__/tokens.test.ts', `
      import jwt from 'jsonwebtoken';
      describe('token tests', () => {
        it('creates a token', () => {
          // Intentionally insecure for test purposes
          const token = jwt.sign({ sub: 'user' }, 'test');
          expect(token).toBeDefined();
        });
      });
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('uses JWT- prefix for finding IDs', async () => {
    createFile(projectPath, 'src/lib/tokens.ts', `
      import jwt from 'jsonwebtoken';
      export function createToken(userId: string) {
        return jwt.sign({ sub: userId }, process.env.JWT_SECRET);
      }
    `);

    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^JWT-\d{3}$/);
    }
  });

  it('includes duration and available fields in result', async () => {
    const result = await jwtCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
