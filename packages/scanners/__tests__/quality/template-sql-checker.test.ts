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

import { templateSqlCheckerScanner } from '../../src/quality/template-sql-checker.js';
import type { AegisConfig, FixGuidance } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-template-sql-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('templateSqlCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await templateSqlCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('emits no findings for a project with no SQL calls', async () => {
    createFile(projectPath, 'src/util.ts', `
export function add(a: number, b: number): number { return a + b; }
    `);
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('emits CRITICAL SQLI-TMPL finding when .rpc() takes a template-literal with interpolation (TP-rpc-template)', async () => {
    createFile(projectPath, 'src/api/users.ts', [
      'export async function getUser(id: string, supabase: any) {',
      '  return await supabase.rpc("raw", { q: `SELECT * FROM users WHERE id = \'${id}\'` });',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].scanner).toBe('template-sql-checker');
    expect(result.findings[0].id).toMatch(/^SQLI-TMPL-\d{3}$/);
  });

  it('emits CRITICAL SQLI-TMPL finding when .execute() takes a template-literal with interpolation (TP-execute-template)', async () => {
    createFile(projectPath, 'src/db/mutations.ts', [
      'export async function setName(name: string, db: any) {',
      '  return await db.execute(`UPDATE users SET name = \'${name}\'`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
  });

  it('emits CRITICAL SQLI-TMPL finding when .query() takes a template-literal with interpolation', async () => {
    createFile(projectPath, 'src/db/reads.ts', [
      'export async function findByEmail(email: string, db: any) {',
      '  return await db.query(`SELECT * FROM users WHERE email = \'${email}\'`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
  });

  it('emits CRITICAL SQLI-TMPL finding when .$queryRawUnsafe() takes a template-literal with interpolation (TP-prisma-queryRawUnsafe, v0.15.3 C-001)', async () => {
    createFile(projectPath, 'src/api/users.ts', [
      'export async function findById(id: string, prisma: any) {',
      '  return await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${id}`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].scanner).toBe('template-sql-checker');
    expect(result.findings[0].id).toMatch(/^SQLI-TMPL-\d{3}$/);
  });

  it('emits CRITICAL SQLI-TMPL finding when .$executeRawUnsafe() takes a template-literal with interpolation (TP-prisma-executeRawUnsafe, v0.15.3 C-001)', async () => {
    createFile(projectPath, 'src/db/mutations.ts', [
      'export async function deleteById(id: string, prisma: any) {',
      '  return await prisma.$executeRawUnsafe(`DELETE FROM t WHERE x = ${id}`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
  });

  it('emits CRITICAL SQLI-TMPL finding when .raw() takes a template-literal with interpolation (TP-knex-raw, v0.15.3 M-001)', async () => {
    createFile(projectPath, 'src/db/queries.ts', [
      'export async function dynamicSelect(table: string, id: string, knex: any) {',
      '  return await knex.raw(`SELECT * FROM ${table} WHERE id = \'${id}\'`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
  });

  it('does NOT emit for parameterized .rpc() calls with no template-literal (FP-static-rpc)', async () => {
    createFile(projectPath, 'src/api/users.ts', [
      'export async function getUser(id: string, supabase: any) {',
      '  return await supabase.rpc("get_user", { id: id });',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT emit for .query() with backticks but no ${} interpolation (FP-template-no-interp)', async () => {
    createFile(projectPath, 'src/db/reads.ts', [
      'export async function listAll(db: any) {',
      '  return await db.query(`SELECT * FROM users`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT emit for plain string-concat SQL — existing sql-concat-checker owns that class (Edge-static-literal-concat)', async () => {
    createFile(projectPath, 'src/db/reads.ts', [
      'export async function findById(id: string, db: any) {',
      '  return await db.query("SELECT * FROM users WHERE id = " + id);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT emit for .raw() with backticks but no ${} interpolation (FP-raw-no-interp, v0.15.3 no-interp-guard holds on expanded sinks)', async () => {
    createFile(projectPath, 'src/db/listings.ts', [
      'export async function listAllUsers(knex: any) {',
      '  return await knex.raw(`SELECT * FROM users`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT emit for postgres.js safe tagged-template — no .method( call-site (FP-postgres-tagged-template, v0.15.3 structural-guard)', async () => {
    createFile(projectPath, 'src/db/reads.ts', [
      'export async function findById(id: string, sql: any) {',
      '  return await sql`SELECT * FROM t WHERE id = ${id}`;',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT emit for prisma.$queryRaw safe tagged-template — dual-guard Unsafe-vs-Safe distinction (FP-prisma-queryRaw-safe, v0.15.3 trust-signal)', async () => {
    createFile(projectPath, 'src/db/safe-reads.ts', [
      'export async function findById(id: string, prisma: any) {',
      '  return await prisma.$queryRaw`SELECT * FROM t WHERE id = ${id}`;',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('emits fix-field as canonical FixGuidance object (day-zero structured remediation)', async () => {
    createFile(projectPath, 'src/api/users.ts', [
      'export async function getUser(id: string, supabase: any) {',
      '  return await supabase.rpc("raw", { q: `SELECT * FROM users WHERE id = \'${id}\'` });',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    const fix = result.findings[0].fix;
    expect(typeof fix).toBe('object');
    const fixObj = fix as FixGuidance;
    expect(fixObj.description).toEqual(expect.any(String));
    expect(fixObj.description.length).toBeGreaterThan(10);
    expect(Array.isArray(fixObj.links)).toBe(true);
  });

  it('tags findings with CWE 89 (SQL injection)', async () => {
    createFile(projectPath, 'src/api/users.ts', [
      'export async function getUser(id: string, supabase: any) {',
      '  return await supabase.rpc("raw", { q: `SELECT * FROM users WHERE id = \'${id}\'` });',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings[0].cwe).toBe(89);
  });

  it('does not fire on template-literal SQL shape when the call sits inside a // line-comment or /* */ block-comment', async () => {
    createFile(projectPath, 'src/db/docs.ts', [
      '// Historical example — kept for reference:',
      '// db.execute(`UPDATE users SET name = \'${name}\'`);',
      '/*',
      ' * Legacy snippet we migrated away from:',
      ' *   supabase.rpc("raw", { q: `DELETE FROM users WHERE id = \'${id}\'` })',
      ' */',
      'export const docsTitle = "Reference";',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('skips test files by convention', async () => {
    createFile(projectPath, 'src/__tests__/api.test.ts', [
      'it("does something", async () => {',
      '  await supabase.rpc("raw", { q: `SELECT * WHERE id = \'${id}\'` });',
      '});',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('records scanner name and category correctly on the ScanResult', async () => {
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('template-sql-checker');
    expect(result.category).toBe('security');
    expect(result.available).toBe(true);
  });
});
