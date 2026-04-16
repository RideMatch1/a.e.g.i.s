import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join: pathJoin } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return results; }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = pathJoin(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch { /* skip */ }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) => walkFilesSync(dir, ignore, exts),
    readFileSafe: (p: string) => { try { return readFileSync(p, 'utf-8'); } catch { return null; } },
  };
});

import { nextPublicLeakScanner } from '../../src/quality/next-public-leak.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeProj(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-npl-'));
}
function write(proj: string, rel: string, content: string): void {
  const parts = rel.split('/');
  if (parts.length > 1) mkdirSync(join(proj, parts.slice(0, -1).join('/')), { recursive: true });
  writeFileSync(join(proj, rel), content);
}

describe('nextPublicLeakScanner — secret-in-public-prefix', () => {
  let proj: string;
  beforeEach(() => { proj = makeProj(); });

  it('flags NEXT_PUBLIC_*_SECRET as leak', async () => {
    write(proj, 'src/api/route.ts', "export const x = process.env.NEXT_PUBLIC_API_SECRET;");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].title).toContain('NEXT_PUBLIC_API_SECRET');
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].cwe).toBe(200);
  });

  it('flags NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (catastrophic if public)', async () => {
    write(proj, 'src/api/route.ts', "const x = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].title).toContain('SERVICE_ROLE_KEY');
  });

  it('flags NEXT_PUBLIC_DATABASE_PASSWORD', async () => {
    write(proj, 'src/x.ts', "process.env.NEXT_PUBLIC_DATABASE_PASSWORD");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag NEXT_PUBLIC_SUPABASE_ANON_KEY (allowlisted)', async () => {
    write(proj, 'src/x.ts', "const x = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('does NOT flag NEXT_PUBLIC_APP_URL (URL, not secret)', async () => {
    write(proj, 'src/x.ts', "const x = process.env.NEXT_PUBLIC_APP_URL;");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('does NOT flag NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_, public-by-design)', async () => {
    write(proj, 'src/x.ts', "process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('handles bracket-syntax: process.env["NEXT_PUBLIC_X_SECRET"]', async () => {
    write(proj, 'src/x.ts', `const x = process.env['NEXT_PUBLIC_FOO_SECRET'];`);
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe('nextPublicLeakScanner — server-secret in client component', () => {
  let proj: string;
  beforeEach(() => { proj = makeProj(); });

  it('flags DATABASE_PASSWORD access in client component', async () => {
    write(proj, 'src/component.tsx', [
      "'use client';",
      "import { useState } from 'react';",
      "export function C() {",
      "  const pwd = process.env.DATABASE_PASSWORD;",
      "  return null;",
      "}",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    const clientFinding = result.findings.find((f) => f.title.includes('client component'));
    expect(clientFinding).toBeDefined();
    expect(clientFinding!.severity).toBe('high');
  });

  it('does NOT flag the same access in a server component', async () => {
    write(proj, 'src/page.tsx', [
      "// server component (no 'use client')",
      "export default function Page() {",
      "  const pwd = process.env.DATABASE_PASSWORD;",
      "  return null;",
      "}",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('flags JWT_SECRET in client utility', async () => {
    write(proj, 'src/util.ts', [
      "'use client';",
      "export const secret = process.env.JWT_SECRET;",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag NEXT_PUBLIC_ env in client (that is the legitimate use case)', async () => {
    write(proj, 'src/component.tsx', [
      "'use client';",
      "export function C() {",
      "  const url = process.env.NEXT_PUBLIC_APP_URL;",
      "  return null;",
      "}",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });
});

describe('nextPublicLeakScanner — connection-string secrets (v0.6)', () => {
  let proj: string;
  beforeEach(() => { proj = makeProj(); });

  it('flags DATABASE_URL access in client component', async () => {
    write(proj, 'src/component.tsx', [
      "'use client';",
      "export function C() {",
      "  const u = process.env.DATABASE_URL;",
      "  return null;",
      "}",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    const leak = result.findings.find((f) => f.title.includes('DATABASE_URL'));
    expect(leak).toBeDefined();
    expect(leak!.title).toContain('client component');
  });

  it('flags NEXT_PUBLIC_DATABASE_URL as Class-1 leak', async () => {
    write(proj, 'src/x.ts', "const x = process.env.NEXT_PUBLIC_DATABASE_URL;");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].title).toContain('NEXT_PUBLIC_DATABASE_URL');
  });

  it('flags REDIS_URL in client utility', async () => {
    write(proj, 'src/util.ts', [
      "'use client';",
      "export const r = process.env.REDIS_URL;",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].title).toContain('REDIS_URL');
  });

  it('flags MONGODB_URI in client component', async () => {
    write(proj, 'src/component.tsx', [
      "'use client';",
      "export function C() {",
      "  const m = process.env.MONGODB_URI;",
      "  return null;",
      "}",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('flags AWS_ACCESS_KEY_ID in client component', async () => {
    write(proj, 'src/x.tsx', [
      "'use client';",
      "export const k = process.env.AWS_ACCESS_KEY_ID;",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('flags AWS_SECRET_ACCESS_KEY in client component', async () => {
    write(proj, 'src/x.tsx', [
      "'use client';",
      "export const s = process.env.AWS_SECRET_ACCESS_KEY;",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('flags non-public SENTRY_DSN in client component (matches _DSN)', async () => {
    write(proj, 'src/x.tsx', [
      "'use client';",
      "export const d = process.env.SENTRY_DSN;",
    ].join('\n'));
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag NEXT_PUBLIC_SENTRY_DSN (allowlisted — legitimate public Sentry)', async () => {
    write(proj, 'src/x.ts', "const d = process.env.NEXT_PUBLIC_SENTRY_DSN;");
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });
});

describe('nextPublicLeakScanner — basic plumbing', () => {
  it('has correct metadata', () => {
    expect(nextPublicLeakScanner.name).toBe('next-public-leak');
    expect(nextPublicLeakScanner.category).toBe('security');
  });

  it('is always available (no external tool dep)', async () => {
    expect(await nextPublicLeakScanner.isAvailable('/tmp')).toBe(true);
  });

  it('returns empty findings for empty project', async () => {
    const proj = makeProj();
    const result = await nextPublicLeakScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
    expect(result.available).toBe(true);
  });
});
