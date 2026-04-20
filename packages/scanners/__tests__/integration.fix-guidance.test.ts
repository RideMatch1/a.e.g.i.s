/**
 * v0.15.2 Item-3 regression-guard — FixGuidance bulk-migration contract.
 *
 * Each of the ten scanner output-classes locked by the Advisor's Flag-A
 * clarification must emit `fix` as a canonical FixGuidance object on
 * its high-severity-or-above findings (severity in {blocker, critical,
 * high}). This test file is the consolidated assertion surface for
 * that contract — one parameterized case per scanner.
 *
 * RED baseline before Item-3 c9 lands: scanners still emit `fix:
 * string` or undefined, so `typeof fix === 'object' && fix.description`
 * fails for every case. GREEN post-c9: all ten cases pass with the
 * canonical `{description, code?, links?}` shape and at least one
 * reference link per finding.
 */

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

import { tenantIsolationCheckerScanner } from '../src/quality/tenant-isolation-checker.js';
import { authEnforcerScanner } from '../src/quality/auth-enforcer.js';
import { csrfCheckerScanner } from '../src/quality/csrf-checker.js';
import { zodEnforcerScanner } from '../src/quality/zod-enforcer.js';
import { sqlConcatCheckerScanner } from '../src/quality/sql-concat-checker.js';
import { entropyScanner } from '../src/quality/entropy-scanner.js';
import { ssrfCheckerScanner } from '../src/quality/ssrf-checker.js';
import { rlsBypassCheckerScanner } from '../src/quality/rls-bypass-checker.js';
import { xssCheckerScanner } from '../src/quality/xss-checker.js';
import { cryptoAuditorScanner } from '../src/quality/crypto-auditor.js';
import type { AegisConfig, Finding, FixGuidance, Scanner } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-fix-guidance-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): void {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

interface ScannerCase {
  name: string;
  scanner: Scanner;
  setup: (projectPath: string) => void;
  pickFinding: (findings: Finding[]) => Finding | undefined;
}

const CASES: ScannerCase[] = [
  {
    name: 'tenant-isolation-checker',
    scanner: tenantIsolationCheckerScanner,
    setup: (p) => createFile(p, 'app/api/users/route.ts', `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export async function GET() {
  const supabase = createClient('url', 'key');
  const { data } = await supabase.from('users').select('*');
  return NextResponse.json(data);
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'tenant-isolation-checker' && (f.severity === 'high' || f.severity === 'critical' || f.severity === 'blocker')),
  },
  {
    name: 'auth-enforcer',
    scanner: authEnforcerScanner,
    setup: (p) => createFile(p, 'app/api/bookings/route.ts', `
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ data: [] });
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'auth-enforcer' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'csrf-checker',
    scanner: csrfCheckerScanner,
    setup: (p) => createFile(p, 'app/api/bookings/route.ts', `
import { NextResponse } from 'next/server';
export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ ok: true });
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'csrf-checker' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'zod-enforcer',
    scanner: zodEnforcerScanner,
    setup: (p) => createFile(p, 'app/api/bookings/route.ts', `
export async function POST(request) {
  const body = await request.json();
  return Response.json({ ok: true });
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'zod-enforcer' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'sql-concat-checker',
    scanner: sqlConcatCheckerScanner,
    setup: (p) => createFile(p, 'lib/db.ts', 'const result = await supabase.rpc(`get_user_${userId}`);\n'),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'sql-concat-checker' && (f.severity === 'blocker' || f.severity === 'critical' || f.severity === 'high')),
  },
  {
    name: 'entropy-scanner',
    scanner: entropyScanner,
    setup: (p) => createFile(p, 'src/config.ts', 'const API_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc8kR3Xm2nQ9zB";\n'),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'entropy-scanner' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'ssrf-checker',
    scanner: ssrfCheckerScanner,
    setup: (p) => createFile(p, 'app/api/handler/route.ts', `
export async function POST(req) {
  const { url } = await req.json();
  const res = await fetch(url);
  return Response.json(await res.json());
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'ssrf-checker' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'rls-bypass-checker',
    scanner: rlsBypassCheckerScanner,
    setup: (p) => createFile(p, 'lib/admin.ts', `
export async function deleteAllUsers(supabase: any) {
  const { data } = await supabase.rpc('admin_delete_users');
  return data;
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'rls-bypass-checker' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'xss-checker',
    scanner: xssCheckerScanner,
    setup: (p) => createFile(p, 'components/RichText.tsx', `
export function RichText({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'xss-checker' && (f.severity === 'high' || f.severity === 'critical')),
  },
  {
    name: 'crypto-auditor',
    scanner: cryptoAuditorScanner,
    setup: (p) => createFile(p, 'api/tokens.ts', `
export function generateToken() {
  return Math.random().toString(36).slice(2);
}
`),
    pickFinding: (fs) =>
      fs.find((f) => f.scanner === 'crypto-auditor' && (f.severity === 'high' || f.severity === 'critical')),
  },
];

describe('FixGuidance bulk-migration contract (Item-3, top-10 scanner-classes)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  for (const c of CASES) {
    it(`${c.name}: high-or-above finding carries canonical FixGuidance object with non-empty description and links`, async () => {
      c.setup(projectPath);
      const result = await c.scanner.scan(projectPath, MOCK_CONFIG);
      const target = c.pickFinding(result.findings);
      expect(target, `${c.name} produced no high-or-above finding`).toBeDefined();
      expect(typeof target!.fix, `${c.name} fix is not an object (still string-arm or undefined)`).toBe('object');
      const fix = target!.fix as FixGuidance;
      expect(typeof fix.description, `${c.name} fix.description is not a string`).toBe('string');
      expect(fix.description.length, `${c.name} fix.description is empty`).toBeGreaterThan(10);
      expect(Array.isArray(fix.links), `${c.name} fix.links is not an array`).toBe(true);
      expect(fix.links!.length, `${c.name} fix.links is empty`).toBeGreaterThan(0);
    });
  }
});
