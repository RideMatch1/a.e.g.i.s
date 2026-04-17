import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readFileSync } = require('fs');
  return {
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    walkFiles: () => [],
  };
});

import { middlewareAuthCheckerScanner } from '../../src/quality/middleware-auth-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-mwauth-test-'));
}

function writeMiddleware(projectPath: string, content: string, sub = false): void {
  const dir = sub ? join(projectPath, 'src') : projectPath;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'middleware.ts'), content);
}

describe('middlewareAuthCheckerScanner — CVE-2025-29927', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags middleware.ts with auth logic and no subrequest guard', async () => {
    writeMiddleware(
      projectPath,
      `
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
export async function middleware(req) {
  const token = await getToken({ req });
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
`,
    );
    const result = await middlewareAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].cwe).toBe(285);
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].title).toContain('CVE-2025-29927');
  });

  it('does NOT flag middleware with explicit headers.get guard', async () => {
    writeMiddleware(
      projectPath,
      `
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
export async function middleware(req) {
  if (req.headers.get('x-middleware-subrequest')) {
    return new NextResponse('forbidden', { status: 403 });
  }
  const token = await getToken({ req });
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
`,
    );
    const result = await middlewareAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag middleware with no auth logic (pure rewrite)', async () => {
    writeMiddleware(
      projectPath,
      `
import { NextResponse } from 'next/server';
export function middleware(req) {
  return NextResponse.rewrite(new URL('/static-page', req.url));
}
`,
    );
    const result = await middlewareAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('also inspects src/middleware.ts (not only project root)', async () => {
    writeMiddleware(
      projectPath,
      `
import { getServerSession } from 'next-auth/next';
export async function middleware(req) {
  const session = await getServerSession();
  if (!session) return new Response('401', { status: 401 });
  return undefined;
}
`,
      true,
    );
    const result = await middlewareAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('prose mention of the header in a comment does NOT satisfy the guard (tight-pattern regression)', async () => {
    // Pre-v0.11 this was a loose `/x[-_]middleware[-_]subrequest/i`
    // pattern that matched the prose mention → falsely silenced the
    // finding. Tightened to require the `headers.get(...)` call shape.
    writeMiddleware(
      projectPath,
      `
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
// NOTE: the x-middleware-subrequest header is CVE-2025-29927 relevant;
// we intend to add a guard but haven't yet.
export async function middleware(req) {
  const token = await getToken({ req });
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
`,
    );
    const result = await middlewareAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
