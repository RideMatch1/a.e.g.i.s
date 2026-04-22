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

import { rlsBypassCheckerScanner } from '../../src/quality/rls-bypass-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-rls-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('rlsBypassCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await rlsBypassCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('rls-bypass-checker');
    expect(result.findings).toHaveLength(0);
  });

  // v0.14: generic .rpc() calls downgrade MEDIUM → INFO. Without SQL
  // function-body parsing, the scanner cannot verify whether
  // caller-passed args are validated inside the function — MEDIUM
  // over-weighted the conservative-truth pedagogy. INFO keeps the
  // finding visible without score-deduction.
  it('flags generic .rpc() call without RLS comment as INFO (v0.14 severity-downgrade)', async () => {
    createFile(
      projectPath,
      'lib/data.ts',
      `
export async function fetchStats(supabase: any) {
  const { data } = await supabase.rpc('get_dashboard_stats');
  return data;
}
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('info');
    expect(finding.id).toMatch(/^RLS-/);
    expect(finding.owasp).toBe('A01:2021');
    expect(finding.cwe).toBe(863);
  });

  it('generic .rpc() finding description notes that AEGIS does not yet parse SQL function bodies', async () => {
    createFile(
      projectPath,
      'lib/data.ts',
      `
export async function fetchStats(supabase: any) {
  const { data } = await supabase.rpc('get_dashboard_stats');
  return data;
}
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('rpc'));
    expect(finding).toBeDefined();
    expect(finding!.description).toContain('does not yet parse SQL function bodies');
  });

  it('flags security-sensitive .rpc() call as HIGH', async () => {
    createFile(
      projectPath,
      'lib/admin.ts',
      `
export async function deleteAllUsers(supabase: any) {
  const { data } = await supabase.rpc('admin_delete_users');
  return data;
}
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find(f => f.severity === 'high' && f.title.includes('rpc'));
    expect(finding).toBeDefined();
  });

  it('does NOT flag .rpc() when RLS comment is nearby', async () => {
    createFile(
      projectPath,
      'lib/safe-rpc.ts',
      `
export async function fetchStats(supabase: any) {
  // RLS: This function uses SECURITY INVOKER — safe
  const { data } = await supabase.rpc('get_dashboard_stats');
  return data;
}
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const rpcFindings = result.findings.filter(f => f.title.includes('rpc'));
    expect(rpcFindings).toHaveLength(0);
  });

  // v0.14 dedup: service_role detection moved to tenant-isolation-checker
  // as the authoritative emitter (scope-aware AST analysis + critical severity).
  // rls-bypass-checker no longer emits parallel findings on the same pattern.
  // Regression-pin: if someone re-introduces the regex here, the dedup is broken.
  it('v0.14 dedup: does NOT flag service_role usage (moved to tenant-isolation-checker)', async () => {
    createFile(
      projectPath,
      'lib/admin-client.ts',
      `
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, service_role_key);
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const serviceRoleFindings = result.findings.filter((f) =>
      f.title.toLowerCase().includes('service_role'),
    );
    expect(serviceRoleFindings).toHaveLength(0);
  });

  it('v0.14 dedup: does NOT flag SUPABASE_SERVICE_ROLE_KEY env-var reference', async () => {
    createFile(
      projectPath,
      'lib/admin.ts',
      `
import { createClient } from '@supabase/supabase-js';
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
`,
    );
    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const serviceRoleFindings = result.findings.filter((f) =>
      f.title.toLowerCase().includes('service_role'),
    );
    expect(serviceRoleFindings).toHaveLength(0);
  });

  // v0.14 dedup contract — rls-bypass-side assertion. A multi-scanner
  // project run on a file with service_role MUST see zero emissions
  // from this scanner. (Authoritative emission from
  // tenant-isolation-checker is verified independently in that
  // scanner's own test file — keeping the cross-scanner coupling out
  // of this file avoids brittle dependence on the peer's AST pipeline.)
  it('v0.14 dedup contract: rls-bypass emits zero service_role findings on an api/route.ts with admin client', async () => {
    const routeDir = join(projectPath, 'src', 'app', 'api', 'admin');
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(
      join(routeDir, 'route.ts'),
      `
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { data } = await supabaseAdmin.from('users').select('*');
  return Response.json(data);
}
`,
    );

    const rlsResult = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const rlsServiceRole = rlsResult.findings.filter((f) =>
      f.title.toLowerCase().includes('service_role'),
    );
    expect(rlsServiceRole).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'lib/__tests__/rpc.test.ts',
      `
const { data } = await supabase.rpc('admin_delete_all');
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

});

describe('rlsBypassCheckerScanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  const SUPABASE_RPC_NO_RLS = [
    'export async function fetchStats(supabase: any) {',
    "  const { data } = await supabase.rpc('get_dashboard_stats');",
    '  return data;',
    '}',
  ].join('\n');

  it('N1-class: flags supabase.rpc under /api/test/ route path (regression-guard for v0.16.3 fix)', async () => {
    mkdirSync(join(projectPath, 'src/app/api/test'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/api/test/route.ts'), SUPABASE_RPC_NO_RLS);
    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'rls-bypass-checker' && f.cwe === 863);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('P1-class: skips supabase.rpc in *.test.ts basename (canonical isTestFile extension-match)', async () => {
    mkdirSync(join(projectPath, 'src'), { recursive: true });
    writeFileSync(join(projectPath, 'src/foo.test.ts'), SUPABASE_RPC_NO_RLS);
    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'rls-bypass-checker')).toHaveLength(0);
  });
});
