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

import { cookieCheckerScanner } from '../../src/quality/cookie-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-cookie-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('cookieCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await cookieCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no cookie code', async () => {
    createFile(projectPath, 'src/app/api/route.ts', `
      import { NextResponse } from 'next/server';
      export async function GET() {
        return NextResponse.json({ data: [] });
      }
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('cookie-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags missing HttpOnly flag', async () => {
    createFile(projectPath, 'src/app/api/auth/route.ts', `
      import { NextResponse } from 'next/server';
      export async function POST(request: Request) {
        const response = NextResponse.json({ ok: true });
        response.headers.set('Set-Cookie', 'session=abc123; Secure; SameSite=Lax');
        return response;
      }
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const httpOnlyFindings = result.findings.filter((f) => f.title.includes('HttpOnly'));
    expect(httpOnlyFindings.length).toBeGreaterThan(0);
    expect(httpOnlyFindings[0].severity).toBe('high');
    expect(httpOnlyFindings[0].category).toBe('security');
    expect(httpOnlyFindings[0].owasp).toBe('A02:2021');
    expect(httpOnlyFindings[0].cwe).toBe(614);
  });

  it('flags missing Secure flag', async () => {
    createFile(projectPath, 'src/lib/cookies.ts', `
      export function setSessionCookie(res: Response, token: string) {
        res.headers.set('Set-Cookie', 'session=' + token + '; HttpOnly; SameSite=Lax');
      }
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const secureFindings = result.findings.filter((f) => f.title.includes('Secure flag'));
    expect(secureFindings.length).toBeGreaterThan(0);
    expect(secureFindings[0].severity).toBe('high');
  });

  it('flags missing SameSite attribute', async () => {
    createFile(projectPath, 'src/lib/auth.ts', `
      export function createAuthCookie(token: string) {
        return \`session=\${token}; HttpOnly; Secure\`;
      }

      export function setCookieHeader(res: any, token: string) {
        res.setHeader('Set-Cookie', createAuthCookie(token));
      }
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const sameSiteFindings = result.findings.filter((f) => f.title.includes('SameSite'));
    expect(sameSiteFindings.length).toBeGreaterThan(0);
    expect(sameSiteFindings[0].severity).toBe('medium');
  });

  it('flags SameSite=None without Secure flag', async () => {
    createFile(projectPath, 'src/lib/embed.ts', `
      export function setCrossSiteCookie(res: any, value: string) {
        res.setHeader('Set-Cookie', \`embed_token=\${value}; SameSite=None; HttpOnly\`);
      }
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const noneFindings = result.findings.filter((f) => f.title.includes('SameSite=None'));
    expect(noneFindings.length).toBeGreaterThan(0);
    expect(noneFindings[0].severity).toBe('high');
  });

  it('does NOT flag a properly secured cookie', async () => {
    createFile(projectPath, 'src/app/api/login/route.ts', `
      import { NextResponse } from 'next/server';
      export async function POST() {
        const response = NextResponse.json({ ok: true });
        response.headers.set(
          'Set-Cookie',
          'session=abc; HttpOnly; Secure; SameSite=Lax; Path=/'
        );
        return response;
      }
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // Might still flag prefix recommendation (low) but should not have high/medium cookie flag issues
    const highMediumFindings = result.findings.filter(
      (f) => (f.severity === 'high' || f.severity === 'medium') &&
        (f.title.includes('HttpOnly') || f.title.includes('Secure flag') || f.title.includes('SameSite')),
    );
    expect(highMediumFindings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(projectPath, 'src/__tests__/cookie.test.ts', `
      // This is a test file that intentionally lacks security flags
      const badCookie = 'session=test123';
      res.headers.set('Set-Cookie', badCookie);
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('uses COOKIE- prefix for finding IDs', async () => {
    createFile(projectPath, 'src/auth.ts', `
      res.headers.set('Set-Cookie', 'token=abc');
    `);

    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^COOKIE-\d{3}$/);
    }
  });

  it('includes duration and available fields in result', async () => {
    const result = await cookieCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
