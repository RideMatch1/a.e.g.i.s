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

  it('flags .rpc() call without RLS comment as MEDIUM', async () => {
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
    expect(finding.severity).toBe('medium');
    expect(finding.id).toMatch(/^RLS-/);
    expect(finding.owasp).toBe('A01:2021');
    expect(finding.cwe).toBe(863);
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

  it('flags service_role usage as HIGH', async () => {
    createFile(
      projectPath,
      'lib/admin-client.ts',
      `
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, service_role_key);
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find(f => f.title.includes('service_role'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag service_role with RLS comment', async () => {
    createFile(
      projectPath,
      'lib/admin-safe.ts',
      `
import { createClient } from '@supabase/supabase-js';
// RLS bypass needed for cron job — no user context available
const supabase = createClient(url, service_role_key);
`,
    );

    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const serviceRoleFindings = result.findings.filter(f => f.title.includes('service_role'));
    expect(serviceRoleFindings).toHaveLength(0);
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

  // v0.10 Z8 — case-insensitive service_role match (UPPERCASE env var shape).
  it('v0.10 Z8: flags SUPABASE_SERVICE_ROLE_KEY env-var reference (UPPERCASE only)', async () => {
    createFile(projectPath, 'lib/admin.ts', `
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
`);
    const result = await rlsBypassCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter((f) => f.title.includes('service_role'));
    expect(srFindings.length).toBeGreaterThan(0);
    expect(srFindings[0].cwe).toBe(863);
    expect(srFindings[0].severity).toBe('high');
  });
});
