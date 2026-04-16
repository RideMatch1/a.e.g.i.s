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

import { sqlConcatCheckerScanner } from '../../src/quality/sql-concat-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-sqli-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('sqlConcatCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await sqlConcatCheckerScanner.isAvailable()).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('sql-concat-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags .rpc() with template literal interpolation as BLOCKER', async () => {
    createFile(
      projectPath,
      'lib/db.ts',
      `
      const result = await supabase.rpc(\`get_user_\${userId}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('blocker');
    expect(finding.id).toBe('SQLI-001');
    expect(finding.category).toBe('security');
    expect(finding.owasp).toBe('A03:2021');
    expect(finding.cwe).toBe(89);
    expect(finding.title).toContain('rpc');
  });

  it('flags .execute() with template literal interpolation as BLOCKER', async () => {
    createFile(
      projectPath,
      'services/query.ts',
      `
      await db.execute(\`SELECT * FROM users WHERE id = \${userId}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('query.ts'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags SQL string concatenation with + operator as BLOCKER', async () => {
    createFile(
      projectPath,
      'api/search.ts',
      `
      const query = 'SELECT * FROM products WHERE name = ' + userInput;
      await db.execute(query);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('search.ts'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('flags .raw() with template literal interpolation as BLOCKER', async () => {
    createFile(
      projectPath,
      'lib/raw-query.ts',
      `
      const result = await knex.raw(\`SELECT * FROM \${tableName}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('raw-query.ts'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
    expect(finding!.title).toContain('.raw()');
  });

  it('does NOT flag safe Supabase .from().select().eq() chains', async () => {
    createFile(
      projectPath,
      'services/bookings.ts',
      `
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag Prisma.sql tagged template literals', async () => {
    createFile(
      projectPath,
      'lib/prisma-query.ts',
      `
      import { Prisma } from '@prisma/client';
      const result = await prisma.$queryRaw(Prisma.sql\`SELECT * FROM users WHERE id = \${userId}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag files using escapePostgrestLike', async () => {
    createFile(
      projectPath,
      'services/search.ts',
      `
      import { escapePostgrestLike } from '@/lib/utils';
      const safe = escapePostgrestLike(userInput);
      const { data } = await supabase.rpc(\`search_\${safe}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'lib/__tests__/db.test.ts',
      `
      // Testing patterns — this is intentional
      await supabase.rpc(\`test_fn_\${testId}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes correct line number', async () => {
    createFile(
      projectPath,
      'lib/line-test.ts',
      `// line 1
// line 2
// line 3
const result = await supabase.rpc(\`fn_\${id}\`);
`,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].line).toBe(4);
  });

  it('generates incrementing IDs across multiple violations', async () => {
    createFile(
      projectPath,
      'lib/a.ts',
      `await db.execute(\`SELECT \${col}\`);`,
    );
    createFile(
      projectPath,
      'lib/b.ts',
      `await db.raw(\`UPDATE \${table}\`);`,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('SQLI-001');
    expect(ids).toContain('SQLI-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // ── v0.6.1 — placeholder-idiom false-positive fix ──
  // Dogfood run on dub/cal-com found that every template-literal match was
  // a parameterized query (`.execute(sql, values)` with placeholder-generation
  // idiom inside). See docs/dogfood-2026-04-16-multi.md.

  it('v0.6.1 Gate A: does NOT flag execute(sql, values) with two positional arguments', async () => {
    // The canonical parameterized-query signature. Even if the template
    // contains a bare identifier inside ${}, the value is bound through the
    // second argument, not interpolated into SQL.
    createFile(
      projectPath,
      'lib/dub-style-execute.ts',
      `
      const response = await conn.execute(
        \`SELECT * FROM Link WHERE id = \${userId}\`,
        [userId],
      );
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('v0.6.1 Gate B: does NOT flag IN (?,?,?) placeholder-generation idiom (dub bulk-delete pattern)', async () => {
    // The exact pattern that generated 3 FPs on dub in v0.6.0 dogfood.
    createFile(
      projectPath,
      'lib/bulk-delete.ts',
      `
      await conn.execute(
        \`DELETE FROM Partner WHERE id IN (\${partnerIds.map(() => "?").join(",")})\`,
        partnerIds,
      );
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('v0.6.1 Gate B: does NOT flag pure-literal ternary interpolation', async () => {
    // The value of \${expr} cannot leak user input — every branch is a hardcoded
    // string literal. Common pattern in query-builder helpers.
    createFile(
      projectPath,
      'lib/analytics.ts',
      `
      const aggregateColumns =
        event === "composite"
          ? "SUM(clicks) as clicks, SUM(sales) as sales"
          : "SUM(clicks) as clicks";
      await conn.execute(\`SELECT \${event === "sales" ? "SUM(a)" : "SUM(b)"} FROM T\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('v0.6.1 regression guard: STILL flags execute() with bare-identifier interpolation (single arg)', async () => {
    // This is the actual SQLi pattern — user input directly interpolated into
    // SQL with no parameterization. Must still fire.
    createFile(
      projectPath,
      'lib/unsafe-execute.ts',
      `
      await db.execute(\`SELECT * FROM users WHERE name = '\${req.body.name}'\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('unsafe-execute.ts'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });

  it('v0.6.1 regression guard: STILL flags .rpc() with bare-identifier interpolation (single arg)', async () => {
    // Supabase .rpc() takes (functionName, args) — if the function name is
    // interpolated, the user controls which stored procedure runs. No gate
    // should allow this.
    createFile(
      projectPath,
      'lib/unsafe-rpc.ts',
      `
      const fn = req.body.fn;
      const result = await supabase.rpc(\`get_user_\${fn}\`);
    `,
    );

    const result = await sqlConcatCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('unsafe-rpc.ts'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('blocker');
  });
});
