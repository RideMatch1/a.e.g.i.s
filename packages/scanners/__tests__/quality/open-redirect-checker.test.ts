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

import { openRedirectCheckerScanner } from '../../src/quality/open-redirect-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-redir-test-'));
}

function createApiFile(projectPath: string, relPath: string, content: string): string {
  const fullDir = join(projectPath, 'src', 'app', 'api', ...relPath.split('/').slice(0, -1));
  mkdirSync(fullDir, { recursive: true });
  const fullPath = join(projectPath, 'src', 'app', 'api', relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('openRedirectCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await openRedirectCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('open-redirect-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags redirect(searchParams.get(...)) as MEDIUM', async () => {
    createApiFile(
      projectPath,
      'login/route.ts',
      `
      import { redirect } from 'next/navigation';
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        redirect(searchParams.get('returnTo'));
      }
    `,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('medium');
    expect(finding.id).toBe('REDIR-001');
    expect(finding.category).toBe('security');
    expect(finding.owasp).toBe('A01:2021');
    expect(finding.cwe).toBe(601);
  });

  it('flags redirect(query.returnUrl) as MEDIUM', async () => {
    createApiFile(
      projectPath,
      'auth/callback/route.ts',
      `
      export async function GET(req: any) {
        return redirect(query.returnUrl);
      }
    `,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('callback'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags res.redirect(req.query.next) as MEDIUM', async () => {
    createApiFile(
      projectPath,
      'legacy/route.ts',
      `
      export function GET(req: any, res: any) {
        res.redirect(req.query.next);
      }
    `,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('legacy'));
    expect(finding).toBeDefined();
  });

  it('flags res.redirect(req.body.redirectTo) as MEDIUM', async () => {
    createApiFile(
      projectPath,
      'checkout/route.ts',
      `
      export async function POST(req: any, res: any) {
        const { redirectTo } = await req.json();
        res.redirect(req.body.redirectTo);
      }
    `,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('checkout'));
    expect(finding).toBeDefined();
  });

  it('does NOT flag when startsWith("/") validation is present', async () => {
    createApiFile(
      projectPath,
      'safe-redirect/route.ts',
      `
      import { redirect } from 'next/navigation';
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        const returnTo = searchParams.get('returnTo') ?? '/';
        if (!returnTo.startsWith('/')) throw new Error('Invalid redirect');
        redirect(returnTo);
      }
    `,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag when allowlist validation is present', async () => {
    createApiFile(
      projectPath,
      'external/route.ts',
      `
      import { redirect } from 'next/navigation';
      const allowlist = ['https://example.com', 'https://trusted.com'];
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        if (!allowlist.includes(url)) throw new Error('Forbidden');
        redirect(url);
      }
    `,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes a line number pointing to the redirect call', async () => {
    createApiFile(
      projectPath,
      'line-test/route.ts',
      `// line 1
// line 2
import { redirect } from 'next/navigation';
// line 4
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  redirect(searchParams.get('to'));
}
`,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].line).toBe(7);
  });

  it('generates incrementing IDs', async () => {
    createApiFile(
      projectPath,
      'a/route.ts',
      `export async function GET(req: any) { redirect(req.query.url); }`,
    );
    createApiFile(
      projectPath,
      'b/route.ts',
      `export async function GET(req: any) { redirect(query.target); }`,
    );

    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('REDIR-001');
    expect(ids).toContain('REDIR-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await openRedirectCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
