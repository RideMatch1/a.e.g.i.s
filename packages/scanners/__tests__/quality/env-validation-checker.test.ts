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
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { envValidationCheckerScanner } from '../../src/quality/env-validation-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-env-test-'));
}

function createSrcFile(projectPath: string, filename: string, content: string): void {
  const srcDir = join(projectPath, 'src');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, filename), content);
}

/** Write content with >5 unique env vars to trigger the validation finding */
const MANY_ENV_VARS = `
  const a = process.env.DATABASE_URL;
  const b = process.env.NEXTAUTH_SECRET;
  const c = process.env.SMTP_HOST;
  const d = process.env.STRIPE_SECRET_KEY;
  const e = process.env.REDIS_URL;
  const f = process.env.S3_BUCKET;
`;

describe('envValidationCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await envValidationCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no source files', async () => {
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('env-validation-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings when <=5 env vars are used', async () => {
    createSrcFile(projectPath, 'config.ts', `
      const url = process.env.DATABASE_URL;
      const secret = process.env.NEXTAUTH_SECRET;
    `);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('No central'))).toHaveLength(0);
  });

  it('flags >5 unique env vars without central validation as MEDIUM', async () => {
    createSrcFile(projectPath, 'config.ts', MANY_ENV_VARS);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('No central'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
    expect(finding!.category).toBe('quality');
    expect(finding!.owasp).toBe('A05:2021');
    expect(finding!.cwe).toBe(1188);
    expect(finding!.id).toBe('ENV-001');
  });

  it('lists the env var names in the description', async () => {
    createSrcFile(projectPath, 'config.ts', MANY_ENV_VARS);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('No central'));
    expect(finding!.description).toContain('DATABASE_URL');
    expect(finding!.description).toContain('STRIPE_SECRET_KEY');
  });

  it('does not flag >5 env vars when env.ts with Zod exists', async () => {
    createSrcFile(projectPath, 'config.ts', MANY_ENV_VARS);
    // Create a central env.ts with Zod validation
    writeFileSync(join(projectPath, 'src', 'env.ts'), `
      import { z } from 'zod';
      const schema = z.object({
        DATABASE_URL: z.string().url(),
        NEXTAUTH_SECRET: z.string(),
      }).strict();
      export const env = schema.parse(process.env);
    `);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('No central'))).toHaveLength(0);
  });

  it('does not flag >5 env vars when @t3-oss/env-nextjs is in package.json', async () => {
    createSrcFile(projectPath, 'config.ts', MANY_ENV_VARS);
    writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
      dependencies: {
        '@t3-oss/env-nextjs': '^0.9.0',
      },
    }));
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('No central'))).toHaveLength(0);
  });

  it('flags process.env.FOO || "" pattern as LOW', async () => {
    createSrcFile(projectPath, 'mailer.ts', `
      const host = process.env.SMTP_HOST || '';
      const port = process.env.SMTP_PORT || '';
    `);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const emptyFindings = result.findings.filter((f) =>
      f.title.includes('silently defaults to empty string')
    );
    expect(emptyFindings.length).toBeGreaterThanOrEqual(2);
    emptyFindings.forEach((f) => {
      expect(f.severity).toBe('low');
      expect(f.category).toBe('quality');
    });
  });

  it('identifies the correct env var name in empty-default findings', async () => {
    createSrcFile(projectPath, 'config.ts', `
      const secret = process.env.JWT_SECRET || '';
    `);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) =>
      f.title.includes('JWT_SECRET')
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('flags process.env.FOO ?? "" (nullish coalescing) as LOW', async () => {
    createSrcFile(projectPath, 'config.ts', `
      const host = process.env.SMTP_HOST ?? '';
      const port = process.env.SMTP_PORT ?? '';
    `);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const emptyFindings = result.findings.filter((f) =>
      f.title.includes('silently defaults to empty string')
    );
    expect(emptyFindings.length).toBeGreaterThanOrEqual(2);
    emptyFindings.forEach((f) => {
      expect(f.severity).toBe('low');
      expect(f.category).toBe('quality');
    });
  });

  it('does not flag process.env.FOO || "default-value" (non-empty default)', async () => {
    createSrcFile(projectPath, 'config.ts', `
      const env = process.env.NODE_ENV || 'development';
    `);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const emptyFindings = result.findings.filter((f) =>
      f.title.includes('silently defaults to empty string')
    );
    expect(emptyFindings).toHaveLength(0);
  });

  it('does not include test files in env var collection', async () => {
    const testDir = join(projectPath, 'src', '__tests__');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'config.test.ts'), MANY_ENV_VARS);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('No central'))).toHaveLength(0);
  });

  it('generates incrementing IDs', async () => {
    createSrcFile(projectPath, 'config.ts', MANY_ENV_VARS);
    createSrcFile(projectPath, 'smtp.ts', `const h = process.env.SMTP_HOST || '';`);
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const ids = result.findings.map((f) => f.id);
    expect(ids[0]).toBe('ENV-001');
    if (ids.length > 1) expect(ids[1]).toBe('ENV-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await envValidationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
