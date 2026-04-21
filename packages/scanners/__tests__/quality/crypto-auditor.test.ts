import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { cryptoAuditorScanner } from '../../src/quality/crypto-auditor.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-crypto-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const fullPath = join(projectPath, relPath);
  mkdirSync(join(projectPath, relPath.split('/').slice(0, -1).join('/')), { recursive: true });
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('cryptoAuditorScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await cryptoAuditorScanner.isAvailable()).toBe(true);
  });

  it('flags Math.random() in api/ directory as HIGH', async () => {
    createFile(
      projectPath,
      'api/tokens.ts',
      `
      export function generateToken() {
        return Math.random().toString(36).slice(2);
      }
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Weak RNG'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('security');
    expect(finding!.file).toContain('tokens.ts');
  });

  it('does NOT flag Math.random() outside security dirs', async () => {
    createFile(
      projectPath,
      'components/slider.ts',
      `
      const offset = Math.random() * 100;
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Weak RNG'));
    expect(finding).toBeUndefined();
  });

  it('flags MD5 hash as MEDIUM', async () => {
    createFile(
      projectPath,
      'lib/hash.ts',
      `
      import { createHash } from 'crypto';
      const hash = createHash('md5').update(data).digest('hex');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Weak hash'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags SHA-1 hash as MEDIUM', async () => {
    createFile(
      projectPath,
      'lib/legacy.ts',
      `
      const h = createHash('sha1').update(value).digest('hex');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Weak hash'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags sha256 without HMAC as LOW', async () => {
    createFile(
      projectPath,
      'lib/token.ts',
      `
      import { createHash } from 'crypto';
      const token = createHash('sha256').update(secret).digest('hex');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('HMAC'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('does NOT flag sha256 when createHmac is also present', async () => {
    createFile(
      projectPath,
      'lib/mac.ts',
      `
      import { createHash, createHmac } from 'crypto';
      const mac = createHmac('sha256', secret).update(data).digest('hex');
      const h = createHash('sha256').update(data).digest('hex');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('HMAC'));
    expect(finding).toBeUndefined();
  });

  it('flags hardcoded Stripe live key as BLOCKER', async () => {
    createFile(
      projectPath,
      'lib/payments.ts',
      `
      const stripe = new Stripe('sk_live_abc123XYZ');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('API key'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags hardcoded Stripe test key as HIGH (not blocker — test keys are less critical)', async () => {
    createFile(
      projectPath,
      'utils/payment-config.ts',
      `
      const key = "sk_test_myTestKey12345";
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('test API key'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags hardcoded Stripe LIVE key as BLOCKER', async () => {
    createFile(
      projectPath,
      'utils/payment-config.ts',
      `
      const key = "sk_live_realProductionKey123";
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('LIVE API key'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags eval() as BLOCKER', async () => {
    createFile(
      projectPath,
      'utils/unsafe.ts',
      `
      const result = eval(userInput);
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('injection'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('does NOT flag redis.eval() — method calls are not JS eval()', async () => {
    createFile(
      projectPath,
      'lib/rate-limit.ts',
      `
      const result = await redis.eval(luaScript, { keys: [key], arguments: [limit] });
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const evalFindings = result.findings.filter((f) => f.title.includes('injection'));
    expect(evalFindings).toHaveLength(0);
  });

  it('does NOT flag evalite() — substring match false positive', async () => {
    createFile(
      projectPath,
      'evals/tool-selection.eval.ts',
      `
      import { evalite } from "evalite";
      evalite("tool-selection", { data: async () => fixtures, task: async (input) => run(input) });
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const evalFindings = result.findings.filter((f) => f.title.includes('injection'));
    expect(evalFindings).toHaveLength(0);
  });

  it('does NOT flag eval in comment prose — "bun run eval (watch mode)"', async () => {
    createFile(
      projectPath,
      'scripts/run.ts',
      `
      /**
       * Run: bun run eval        (watch mode)
       * Run: bun run eval:run    (single run)
       */
      export function runEvals() { return true; }
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const evalFindings = result.findings.filter((f) => f.title.includes('injection'));
    expect(evalFindings).toHaveLength(0);
  });

  it('includes correct line number for findings', async () => {
    createFile(
      projectPath,
      'lib/bad.ts',
      `// line 1
// line 2
const stripe = new Stripe('sk_live_lineThreeKey');
// line 4
`,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('API key'));
    expect(finding).toBeDefined();
    expect(finding!.line).toBe(3);
  });

  it('generates incrementing IDs', async () => {
    createFile(projectPath, 'api/a.ts', `Math.random(); eval('x');`);

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    expect(result.findings[0].id).toBe('CRYPTO-001');
    expect(result.findings[1].id).toBe('CRYPTO-002');
  });

  it('flags jwt.sign() without explicit algorithm as MEDIUM', async () => {
    createFile(
      projectPath,
      'lib/auth.ts',
      `
      import jwt from 'jsonwebtoken';
      const token = jwt.sign({ userId: 123 }, secret);
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('JWT'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags JWT.sign() (uppercase) as MEDIUM', async () => {
    createFile(
      projectPath,
      'utils/token.ts',
      `
      const token = JWT.sign(payload, key);
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('JWT'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags Buffer.from with short base64 secret as MEDIUM', async () => {
    createFile(
      projectPath,
      'lib/crypto.ts',
      `
      const key = Buffer.from('shortkey', 'base64');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Short Base64'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('does NOT flag Buffer.from with long base64 secret', async () => {
    createFile(
      projectPath,
      'lib/crypto-ok.ts',
      `
      const key = Buffer.from('aVeryLongSecretKeyThatIs32CharsXX', 'base64');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Short Base64'));
    expect(finding).toBeUndefined();
  });

  it('flags process.env used directly as HMAC key as MEDIUM', async () => {
    createFile(
      projectPath,
      'lib/hmac.ts',
      `
      import { createHmac } from 'crypto';
      const mac = createHmac('sha256', process.env.SECRET_KEY).update(data).digest('hex');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('HMAC key'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  // --- New checks: JWT none, cookie security flags, hardcoded session secret ---

  it('flags JWT algorithm: none as BLOCKER', async () => {
    createFile(
      projectPath,
      'lib/jwt-bad.ts',
      `
      const token = jwt.sign(payload, '', { algorithm: 'none' });
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes("'none' algorithm"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags verify: false in JWT as BLOCKER', async () => {
    createFile(
      projectPath,
      'lib/jwt-noverify.ts',
      `
      const decoded = jwt.decode(token, { verify: false });
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes("'none' algorithm"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags algorithms array with none as BLOCKER', async () => {
    createFile(
      projectPath,
      'lib/jwt-alglist.ts',
      `
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256', 'none'] });
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes("'none' algorithm"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags cookie without security flags as HIGH', async () => {
    createFile(
      projectPath,
      'api/auth.ts',
      `
      res.setHeader('Set-Cookie', 'session=abc123; Path=/');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Cookie missing security flags'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag cookie with all security flags', async () => {
    createFile(
      projectPath,
      'api/auth-ok.ts',
      `
      res.setHeader('Set-Cookie', 'session=abc123; Path=/; httpOnly; secure; SameSite=Strict');
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Cookie missing security flags'));
    expect(finding).toBeUndefined();
  });

  it('flags hardcoded session secret as HIGH', async () => {
    createFile(
      projectPath,
      'lib/session.ts',
      `
      const session_secret = 'my-super-secret';
    `,
    );

    const result = await cryptoAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Hardcoded session secret'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });
});
