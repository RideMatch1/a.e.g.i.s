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

import { soc2CheckerScanner } from '../../src/compliance/soc2.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-soc2-test-'));
}

function makeConfig(extra: Record<string, unknown> = {}): AegisConfig {
  return { compliance: ['soc2'], ...extra } as unknown as AegisConfig;
}

function createFile(projectPath: string, relPath: string, content: string): void {
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

describe('soc2CheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await soc2CheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct name and category', () => {
    expect(soc2CheckerScanner.name).toBe('soc2-checker');
    expect(soc2CheckerScanner.category).toBe('compliance');
  });

  it('reports multiple findings for empty project', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.scanner).toBe('soc2-checker');
    expect(result.category).toBe('compliance');
    expect(result.available).toBe(true);
  });

  it('all finding IDs have SOC2- prefix', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^SOC2-\d{3}$/);
    }
  });

  it('all findings have compliance category', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    for (const finding of result.findings) {
      expect(finding.category).toBe('compliance');
    }
  });

  it('result includes duration', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('soc2CheckerScanner — CC6.1: Logical Access Controls', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('SOC2-001: reports HIGH when no auth guards found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-001');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.title).toContain('CC6.1');
  });

  it('SOC2-001: no finding when auth guard exists', async () => {
    createFile(
      projectPath,
      'src/middleware.ts',
      `import { secureApiRouteWithTenant } from '@/lib/auth';
       export async function middleware(req) {
         await secureApiRouteWithTenant(req, { requireAuth: true });
       }`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-001');
    expect(finding).toBeUndefined();
  });

  it('SOC2-001: no finding when getServerSession exists', async () => {
    createFile(
      projectPath,
      'src/lib/auth.ts',
      `export async function getSession() {
         return getServerSession(authOptions);
       }`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-001');
    expect(finding).toBeUndefined();
  });

  it('SOC2-002: reports MEDIUM when no RBAC found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-002');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-002: no finding when requireRole exists', async () => {
    createFile(
      projectPath,
      'src/lib/require-role.ts',
      `export function requireRole(context, roles) {
         if (!roles.includes(context.role)) throw new Error('Forbidden');
       }`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-002');
    expect(finding).toBeUndefined();
  });
});

describe('soc2CheckerScanner — CC6.6: Encryption in Transit', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('SOC2-003: reports MEDIUM when no HSTS found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-003');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-003: no finding when HSTS header configured', async () => {
    createFile(
      projectPath,
      'src/middleware.ts',
      `response.headers.set('Strict-Transport-Security', 'max-age=31536000');`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-003');
    expect(finding).toBeUndefined();
  });

  it('SOC2-003: no finding when HSTS in next.config', async () => {
    createFile(
      projectPath,
      'next.config.js',
      `module.exports = { headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] };`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-003');
    expect(finding).toBeUndefined();
  });
});

describe('soc2CheckerScanner — CC6.7: Encryption at Rest', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('SOC2-005: reports MEDIUM when no encryption utility found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-005');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-005: no finding when encrypt utility exists', async () => {
    createFile(
      projectPath,
      'src/lib/crypto.ts',
      `import { createCipheriv, createDecipheriv } from 'crypto';
       export function encrypt(data) { return createCipheriv('aes-256-gcm', key, iv); }
       export function decrypt(data) { return createDecipheriv('aes-256-gcm', key, iv); }`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-005');
    expect(finding).toBeUndefined();
  });

  it('SOC2-006: reports MEDIUM when migrations have sensitive columns without encryption', async () => {
    createFile(
      projectPath,
      'supabase/migrations/001_create_users.sql',
      `CREATE TABLE users (
        id UUID PRIMARY KEY,
        password TEXT NOT NULL,
        api_key TEXT
      );`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-006');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-006: no finding when sensitive columns have encryption indicators', async () => {
    createFile(
      projectPath,
      'supabase/migrations/001_create_users.sql',
      `CREATE TABLE users (
        id UUID PRIMARY KEY,
        password_encrypted TEXT NOT NULL,
        api_key_cipher TEXT
      );`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-006');
    expect(finding).toBeUndefined();
  });
});

describe('soc2CheckerScanner — CC7.2: Monitoring', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('SOC2-007: reports MEDIUM when no logging found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-007');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-007: no finding when logger utility exists', async () => {
    createFile(
      projectPath,
      'src/lib/logger.ts',
      `export const logger = { info: () => {}, error: () => {}, warn: () => {} };`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-007');
    expect(finding).toBeUndefined();
  });

  it('SOC2-008: reports MEDIUM when no audit log found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-008');
    expect(finding).toBeDefined();
  });

  it('SOC2-008: no finding when audit_log in migrations', async () => {
    createFile(
      projectPath,
      'supabase/migrations/005_audit.sql',
      `CREATE TABLE audit_log (
        id UUID PRIMARY KEY,
        action TEXT NOT NULL,
        user_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-008');
    expect(finding).toBeUndefined();
  });
});

describe('soc2CheckerScanner — CC8.1: Change Management', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('SOC2-009: reports MEDIUM when no CI/CD found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-009');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-009: no finding when GitHub Actions exist', async () => {
    createFile(
      projectPath,
      '.github/workflows/ci.yml',
      'name: CI\non: push\njobs: build',
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-009');
    expect(finding).toBeUndefined();
  });

  it('SOC2-010: reports MEDIUM when no test files found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-010');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('SOC2-010: no finding when test files exist', async () => {
    createFile(
      projectPath,
      'src/utils/helpers.test.ts',
      `describe('helpers', () => { it('works', () => {}) });`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-010');
    expect(finding).toBeUndefined();
  });
});

describe('soc2CheckerScanner — A1.2: Availability', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('SOC2-011: reports LOW when no health check found', async () => {
    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-011');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('SOC2-011: no finding when health endpoint exists', async () => {
    createFile(
      projectPath,
      'src/app/api/health/route.ts',
      `export async function GET() { return Response.json({ status: 'ok' }); }`,
    );

    const result = await soc2CheckerScanner.scan(projectPath, makeConfig());
    const finding = result.findings.find((f) => f.id === 'SOC2-011');
    expect(finding).toBeUndefined();
  });
});
