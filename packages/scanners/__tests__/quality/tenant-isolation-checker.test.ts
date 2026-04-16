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

import { tenantIsolationCheckerScanner } from '../../src/quality/tenant-isolation-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-tenant-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('tenantIsolationCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
    // Create a file referencing tenant_id so the scanner detects a multi-tenant project
    createFile(projectPath, 'lib/tenant.ts', 'export const TENANT_COL = "tenant_id";');
  });

  it('is always available', async () => {
    expect(await tenantIsolationCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('tenant-isolation-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags .from() without tenant_id filter in route file as HIGH', async () => {
    createFile(
      projectPath,
      'app/api/users/route.ts',
      `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient('url', 'key');
  const { data } = await supabase.from('users').select('*');
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings.find(f => f.title.includes('missing tenant_id'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.id).toMatch(/^TENANT-/);
    expect(finding!.owasp).toBe('A01:2021');
    expect(finding!.cwe).toBe(639);
  });

  it('does NOT flag .from() with .eq(tenant_id) in query chain', async () => {
    createFile(
      projectPath,
      'app/api/users/route.ts',
      `
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient('url', 'key');
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId);
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.title.includes('missing tenant_id'));
    expect(tenantFindings).toHaveLength(0);
  });

  it('skips files that use secureApiRouteWithTenant', async () => {
    createFile(
      projectPath,
      'app/api/users/route.ts',
      `
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';

export async function GET(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  const { data } = await supabase.from('users').select('*');
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags service_role usage as CRITICAL', async () => {
    createFile(
      projectPath,
      'app/api/admin/route.ts',
      `
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient('url', process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('users').select('*').eq('tenant_id', tid);
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find(f => f.severity === 'critical');
    expect(finding).toBeDefined();
    expect(finding!.title).toContain('Service role key');
  });

  it('only checks route.ts/route.js files', async () => {
    createFile(
      projectPath,
      'lib/helper.ts',
      `
const { data } = await supabase.from('users').select('*');
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'app/api/__tests__/route.ts',
      `
const { data } = await supabase.from('users').select('*');
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
