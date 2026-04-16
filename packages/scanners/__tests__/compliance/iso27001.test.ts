import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
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
  };
});

import { iso27001CheckerScanner } from '../../src/compliance/iso27001.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-iso27001-test-'));
}

function makeConfig(extra: Record<string, unknown> = {}): AegisConfig {
  return { compliance: ['iso27001'], ...extra } as unknown as AegisConfig;
}

function createFile(projectPath: string, relPath: string, content: string): void {
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

describe('iso27001CheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await iso27001CheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct name and category', () => {
    expect(iso27001CheckerScanner.name).toBe('iso27001-checker');
    expect(iso27001CheckerScanner.category).toBe('compliance');
  });

  it('reports multiple findings for empty project', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.scanner).toBe('iso27001-checker');
    expect(result.category).toBe('compliance');
    expect(result.available).toBe(true);
  });

  it('all finding IDs have ISO- prefix', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^ISO-\d{3}$/);
    }
  });

  it('all findings have compliance category', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    for (const finding of result.findings) {
      expect(finding.category).toBe('compliance');
    }
  });

  it('result includes duration', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    expect(typeof result.duration).toBe('number');
  });
});

describe('iso27001CheckerScanner — A.8.24: Cryptography', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('ISO-001: reports HIGH when MD5 is used', async () => {
    createFile(
      projectPath,
      'src/lib/hash.ts',
      `import crypto from 'crypto';
       export function hash(data: string) { return crypto.createHash('md5').update(data).digest('hex'); }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-001');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.title).toContain('A.8.24');
  });

  it('ISO-001: reports HIGH when SHA1 is used', async () => {
    createFile(
      projectPath,
      'src/lib/hash.ts',
      `import crypto from 'crypto';
       export function hash(data: string) { return crypto.createHash('sha1').update(data).digest('hex'); }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-001');
    expect(finding).toBeDefined();
  });

  it('ISO-001: no finding when SHA-256 is used', async () => {
    createFile(
      projectPath,
      'src/lib/hash.ts',
      `import crypto from 'crypto';
       export function hash(data: string) { return crypto.createHash('sha256').update(data).digest('hex'); }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-001');
    expect(finding).toBeUndefined();
  });

  it('ISO-002: reports HIGH when hardcoded secret found', async () => {
    createFile(
      projectPath,
      'src/lib/config.ts',
      `const secret = 'abcdefghijklmnopqrstuvwxyz123456';`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-002');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('ISO-002: no finding when using env vars for secrets', async () => {
    createFile(
      projectPath,
      'src/lib/config.ts',
      `const secret = process.env.SECRET_KEY;`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-002');
    expect(finding).toBeUndefined();
  });
});

describe('iso27001CheckerScanner — A.8.9: Configuration Management', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('ISO-003: reports HIGH when .env not in .gitignore', async () => {
    createFile(projectPath, '.gitignore', 'node_modules\ndist');

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-003');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('ISO-003: no finding when .env is in .gitignore', async () => {
    createFile(projectPath, '.gitignore', 'node_modules\n.env\ndist');

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-003');
    expect(finding).toBeUndefined();
  });

  it('ISO-004: reports MEDIUM when no env var usage found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-004');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('ISO-004: no finding when process.env is used', async () => {
    createFile(
      projectPath,
      'src/lib/config.ts',
      `export const dbUrl = process.env.DATABASE_URL;`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-004');
    expect(finding).toBeUndefined();
  });
});

describe('iso27001CheckerScanner — A.8.25: Secure Development Lifecycle', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('ISO-005: reports MEDIUM when no tests found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-005');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('ISO-005: no finding when test files exist', async () => {
    createFile(
      projectPath,
      'src/utils/helper.test.ts',
      `describe('helper', () => { it('works', () => { expect(true).toBe(true); }); });`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-005');
    expect(finding).toBeUndefined();
  });

  it('ISO-006: reports MEDIUM when no CI/CD found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-006');
    expect(finding).toBeDefined();
  });

  it('ISO-006: no finding when GitHub Actions exist', async () => {
    createFile(
      projectPath,
      '.github/workflows/ci.yml',
      'name: CI\non: push',
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-006');
    expect(finding).toBeUndefined();
  });

  it('ISO-007: reports LOW when no linting config found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-007');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('ISO-007: no finding when eslint config exists', async () => {
    createFile(projectPath, 'eslint.config.js', 'module.exports = {};');

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-007');
    expect(finding).toBeUndefined();
  });
});

describe('iso27001CheckerScanner — A.8.28: Secure Coding', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('ISO-008: reports HIGH when eval() is used', async () => {
    createFile(
      projectPath,
      'src/lib/dynamic.ts',
      `export function run(code: string) { return eval(code); }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-008');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('ISO-008: no finding when eval is not used', async () => {
    createFile(
      projectPath,
      'src/lib/safe.ts',
      `export function run(code: string) { return JSON.parse(code); }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-008');
    expect(finding).toBeUndefined();
  });

  it('ISO-009: reports HIGH when dangerouslySetInnerHTML used without sanitize', async () => {
    createFile(
      projectPath,
      'src/components/RawHtml.tsx',
      `export function RawHtml({ html }: { html: string }) {
        return <div dangerouslySetInnerHTML={{ __html: html }} />;
      }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-009');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('ISO-009: no finding when DOMPurify is used', async () => {
    createFile(
      projectPath,
      'src/components/SafeHtml.tsx',
      `import DOMPurify from 'dompurify';
       export function SafeHtml({ html }: { html: string }) {
         return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
       }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-009');
    expect(finding).toBeUndefined();
  });

  it('ISO-010: reports MEDIUM when no validation library found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-010');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('ISO-010: no finding when Zod is used', async () => {
    createFile(
      projectPath,
      'src/lib/schemas.ts',
      `import { z } from 'zod';
       export const userSchema = z.object({ name: z.string(), email: z.string().email() });`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-010');
    expect(finding).toBeUndefined();
  });
});

describe('iso27001CheckerScanner — A.5.34: Privacy & PII', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('ISO-011: reports MEDIUM when no privacy page found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-011');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('ISO-011: no finding when privacy page exists', async () => {
    createFile(
      projectPath,
      'src/app/privacy/page.tsx',
      `export default function Privacy() { return <h1>Privacy Policy</h1>; }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-011');
    expect(finding).toBeUndefined();
  });

  it('ISO-012: reports MEDIUM when no consent mechanism found', async () => {
    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-012');
    expect(finding).toBeDefined();
  });

  it('ISO-012: no finding when cookie consent exists', async () => {
    createFile(
      projectPath,
      'src/components/CookieConsent.tsx',
      `export function CookieConsent() { return <div>Cookie Consent Banner</div>; }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-012');
    expect(finding).toBeUndefined();
  });

  it('ISO-013: reports HIGH when PII found in logs', async () => {
    createFile(
      projectPath,
      'src/lib/user.ts',
      `export function createUser(email: string) {
        console.log('Creating user with email: ' + email);
      }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-013');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('ISO-013: no finding when logs are clean', async () => {
    createFile(
      projectPath,
      'src/lib/user.ts',
      `export function createUser(id: string) {
        console.log('Creating user:', id);
      }`,
    );

    const result = await iso27001CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'ISO-013');
    expect(finding).toBeUndefined();
  });
});
