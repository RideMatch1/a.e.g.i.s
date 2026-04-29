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

describe('templateSqlCheckerScanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  const TEMPLATE_QUERY = [
    'export async function POST(request: Request) {',
    '  const body = await request.json();',
    '  const supabase = (globalThis as any).supabase;',
    "  const { data } = await supabase.rpc('exec_raw', {",
    '    sql: `SELECT * FROM users WHERE id = \'${body.id}\'`,',
    '  });',
    '  return new Response(JSON.stringify(data));',
    '}',
  ].join('\n');

  it('N1-class: flags template-interpolated query under /api/test/ route path (regression-guard for v0.16.3 fix)', async () => {
    mkdirSync(join(projectPath, 'src/app/api/test'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/api/test/route.ts'), TEMPLATE_QUERY);
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'template-sql-checker' && f.cwe === 89);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('P1-class: skips template-interpolated query in *.test.ts basename (canonical isTestFile extension-match)', async () => {
    mkdirSync(join(projectPath, 'src'), { recursive: true });
    writeFileSync(join(projectPath, 'src/foo.test.ts'), TEMPLATE_QUERY);
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });
});

describe('templateSqlCheckerScanner — v0.17.5 F1.1 handler-shape filter', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('does NOT fire on tRPC `.query(async (opts) => { ... fetch(`url/${x}`) })` (openstatus-class regression)', async () => {
    createFile(projectPath, 'src/router/domain.ts', [
      'declare const protectedProcedure: any;',
      'declare const z: any;',
      'declare const env: { PROJECT_ID: string };',
      'export const domainRouter = protectedProcedure',
      '  .input(z.object({ domain: z.string() }))',
      '  .query(async (opts: { input: { domain: string } }) => {',
      '    const data = await fetch(',
      '      `https://api.example.com/v1/projects/${env.PROJECT_ID}/domains/${opts.input.domain}`,',
      '    );',
      '    return data.json();',
      '  });',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT fire on `.query((opts) => { ... `template${x}` })` (non-async arrow handler)', async () => {
    createFile(projectPath, 'src/handler.ts', [
      'declare const trpc: { query: (h: unknown) => unknown };',
      'export const userQuery = trpc.query((opts: { input: { id: string } }) => {',
      '  console.log(`Resolving ${opts.input.id}`);',
      '  return { id: opts.input.id };',
      '});',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT fire on `.query(function (opts) { ... `template${x}` })` (function-expression handler)', async () => {
    createFile(projectPath, 'src/legacy-handler.ts', [
      'declare const trpc: { query: (h: unknown) => unknown };',
      'export const legacy = trpc.query(function (opts: { input: { id: string } }) {',
      '  console.log(`Resolving ${opts.input.id}`);',
      '  return { id: opts.input.id };',
      '});',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('DOES fire when first arg is a direct backtick template (handler-shape filter must not over-suppress)', async () => {
    createFile(projectPath, 'src/dangerous.ts', [
      'declare const db: { execute: (sql: string) => Promise<unknown> };',
      'export async function unsafe(name: string) {',
      '  return db.execute(`UPDATE users SET name = \'${name}\'`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'template-sql-checker');
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('templateSqlCheckerScanner — v0.17.5 F1.2 tagged-template detection', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('does NOT fire on Drizzle `db.execute(sql`...${x}`)` (tagged template — safe parameterization)', async () => {
    createFile(projectPath, 'src/drizzle-queries.ts', [
      'declare const db: { execute: (chunk: unknown) => Promise<unknown> };',
      'declare const sql: (s: TemplateStringsArray, ...v: unknown[]) => unknown;',
      'export async function findById(id: string) {',
      '  return await db.execute(sql`SELECT * FROM users WHERE id = ${id}`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('does NOT fire on Prisma `Prisma.sql`...${x}`` tagged template', async () => {
    createFile(projectPath, 'src/prisma-fragment.ts', [
      'declare const Prisma: { sql: (s: TemplateStringsArray, ...v: unknown[]) => unknown };',
      'declare const prisma: { $executeRaw: (chunk: unknown) => Promise<unknown> };',
      'export async function adjust(uid: string, delta: number) {',
      '  return await prisma.$executeRaw(',
      '    Prisma.sql`UPDATE wallets SET balance = balance + ${delta} WHERE user_id = ${uid}`,',
      '  );',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'template-sql-checker')).toHaveLength(0);
  });

  it('DOES fire on UNTAGGED `db.execute(`...${x}`)` (no preceding tag identifier)', async () => {
    createFile(projectPath, 'src/raw-execute.ts', [
      'declare const db: { execute: (sql: string) => Promise<unknown> };',
      'export async function raw(name: string) {',
      '  return db.execute(`UPDATE users SET name = \'${name}\'`);',
      '}',
    ].join('\n'));
    const result = await templateSqlCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'template-sql-checker');
    expect(hits.length).toBeGreaterThan(0);
  });
});
