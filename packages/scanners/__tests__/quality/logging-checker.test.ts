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
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { loggingCheckerScanner, isAuthFile } from '../../src/quality/logging-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

// v0.13 dogfood Task 5.5 — basename+parent-only auth-file detection.
// Previous regex `/\/(?:login|logout|...)\b.*\.(ts|js)$/` matched any
// ancestor segment, causing monorepo files like
// `auth-service/admin/errors.ts` to produce phantom LOG findings.
describe('isAuthFile (basename + parent-only matching)', () => {
  describe('positive cases — files that ARE auth handlers', () => {
    it('matches basename auth.ts', () => {
      expect(isAuthFile('auth.ts')).toBe(true);
    });
    it('matches basename login.ts at project root', () => {
      expect(isAuthFile('login.ts')).toBe(true);
    });
    it('matches basename session.js with absolute path', () => {
      expect(isAuthFile('/home/user/project/src/session.js')).toBe(true);
    });
    it('matches when immediate parent dir is auth', () => {
      expect(isAuthFile('api/auth/route.ts')).toBe(true);
    });
    it('matches when immediate parent dir is signin', () => {
      expect(isAuthFile('app/api/signin/page.ts')).toBe(true);
    });
    it('matches camelCase signIn.ts (case-insensitive)', () => {
      expect(isAuthFile('src/lib/signIn.ts')).toBe(true);
    });
    it('matches .js extension (not only .ts)', () => {
      expect(isAuthFile('app/auth.js')).toBe(true);
    });
    it('matches Windows-style backslash paths (normalization)', () => {
      expect(isAuthFile('C:\\project\\api\\auth\\route.ts')).toBe(true);
    });
  });

  describe('negative cases — regression guard against the ancestor-path FP class', () => {
    it('does NOT match when "auth" appears only in an ancestor dir (core FP case)', () => {
      // /tmp/auth-verify/check/lib/errors.ts — the dogfood trigger
      expect(isAuthFile('/tmp/auth-verify/check/lib/errors.ts')).toBe(false);
    });
    it('does NOT match when "auth" is a grandparent segment', () => {
      expect(isAuthFile('auth-service/admin/errors.ts')).toBe(false);
    });
    it('does NOT match when keyword appears 3 ancestors up', () => {
      expect(isAuthFile('apps/auth/shared/tools/random.ts')).toBe(false);
    });
    it('does NOT match deeply-nested non-auth file', () => {
      expect(isAuthFile('deeply/nested/authenticator/foo.ts')).toBe(false);
    });
    it('does NOT match unrelated files', () => {
      expect(isAuthFile('lib/utils/helpers.ts')).toBe(false);
    });
    it('does NOT match basename that only starts with "author" (word-boundary)', () => {
      // ^auth\b — "authors" has \b after "auth"? No, "r" is a word-char.
      // "auth" followed by "o" means no word-boundary at that position.
      // So "authors.ts" is rejected — acceptable per the threat-model
      // analysis. Users with a file genuinely named `authors.ts` that
      // IS an auth handler can rename to `auth.ts` or `auth-handlers.ts`.
      expect(isAuthFile('authors.ts')).toBe(false);
    });
    it('does NOT match non-ts/js extensions', () => {
      expect(isAuthFile('auth.md')).toBe(false);
      expect(isAuthFile('auth.json')).toBe(false);
    });
  });
});

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-logging-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('loggingCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await loggingCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('flags missing centralized logger when no logger package or file exists', async () => {
    // Populated project so the v0.15.4 D-N-001 empty-project skip-guard
    // does not apply — intent is "has source, no logger infrastructure".
    createFile(projectPath, 'src/app.ts', 'export function app() { return "hello"; }');
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('logging-checker');

    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings.length).toBeGreaterThan(0);
    expect(loggerFindings[0].severity).toBe('medium');
    expect(loggerFindings[0].category).toBe('quality');
    expect(loggerFindings[0].owasp).toBe('A09:2021');
    expect(loggerFindings[0].cwe).toBe(778);
  });

  it('does NOT flag LOG-001 when project is empty (0 source files detected)', async () => {
    // v0.15.4 D-N-001 empty-project skip-guard. Previously emitted a
    // spurious project-level MEDIUM finding on directories with zero
    // source to check. Post-fix: scanner early-returns empty findings.
    // Round-4 audit-finding 🟡 D-N-001.
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('logging-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag logger when winston is in package.json', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'winston': '^3.0.0' },
    }));

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings).toHaveLength(0);
  });

  it('does NOT flag logger when pino is in package.json', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'pino': '^8.0.0' },
    }));

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings).toHaveLength(0);
  });

  it('does NOT flag logger when custom logger file exists', async () => {
    createFile(projectPath, 'lib/logger.ts', `
      import winston from 'winston';
      export const logger = winston.createLogger({ level: 'info' });
    `);

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings).toHaveLength(0);
  });

  it('flags mutation route without audit logging', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'winston': '^3.0.0' },
    }));
    // Create many mutation routes without logging to trigger the >50% threshold
    for (let i = 0; i < 5; i++) {
      createFile(projectPath, `src/app/api/bookings${i}/route.ts`, `
        import { NextResponse } from 'next/server';
        export async function POST(request: Request) {
          const body = await request.json();
          // No logging here
          return NextResponse.json({ ok: true });
        }
        export async function DELETE(request: Request) {
          return NextResponse.json({ ok: true });
        }
      `);
    }

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const auditFindings = result.findings.filter((f) => f.title.includes('mutation route'));
    expect(auditFindings.length).toBeGreaterThan(0);
    expect(auditFindings[0].severity).toBe('medium');
  });

  it('does NOT flag mutation route that has logging', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'winston': '^3.0.0' },
    }));
    createFile(projectPath, 'src/app/api/bookings/route.ts', `
      import { logger } from '@/lib/logger';
      export async function POST(request: Request) {
        const body = await request.json();
        logger.info({ action: 'create-booking', userId: 'user-123' });
        return Response.json({ ok: true });
      }
    `);

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // With only 1 route and it has logging, no audit finding
    const highAuditFindings = result.findings.filter(
      (f) => f.title.includes('mutation route') && f.severity === 'medium',
    );
    expect(highAuditFindings).toHaveLength(0);
  });

  it('uses LOG- prefix for finding IDs', async () => {
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^LOG-\d{3}$/);
    }
  });

  it('includes duration and available fields in result', async () => {
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
