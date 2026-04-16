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
    try { entries = readdirSync(dir); } catch { return results; }
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
      } catch { /* skip */ }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) => walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => { try { return readFileSync(path, 'utf-8'); } catch { return null; } },
  };
});

import { taintAnalyzerScanner } from '../../src/ast/taint-analyzer.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-taint-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): void {
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

const MOCK_CONFIG = {} as AegisConfig;

describe('taintAnalyzerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is available when typescript is installed', async () => {
    expect(await taintAnalyzerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct metadata', () => {
    expect(taintAnalyzerScanner.name).toBe('taint-analyzer');
    expect(taintAnalyzerScanner.category).toBe('security');
  });

  it('finds SQL injection via variable indirection', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const id = req.body.id;
      client.query(\`SELECT * FROM users WHERE id = \${id}\`);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    const sqli = result.findings.filter((f) => f.cwe === 89);
    expect(sqli.length).toBeGreaterThan(0);
    expect(sqli[0].severity).toBe('critical');
  });

  it('does NOT flag sanitized input', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const id = parseInt(req.body.id);
      client.query(\`SELECT * FROM users WHERE id = \${id}\`);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('does NOT flag Supabase parameterized queries', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const id = req.body.id;
      supabase.from('users').select('*').eq('id', id);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('does NOT flag constant URLs', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const API_URL = 'https://api.example.com';
      fetch(API_URL);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('skips test files', async () => {
    createFile(projectPath, 'src/api/route.test.ts', `
      const id = req.body.id;
      exec(id);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
  });

  it('returns valid ScanResult shape', async () => {
    createFile(projectPath, 'src/api/route.ts', 'const x = 1;');
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('taint-analyzer');
    expect(result.category).toBe('security');
    expect(result.available).toBe(true);
    expect(typeof result.duration).toBe('number');
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('includes taint path in finding description', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const id = req.body.id;
      const uid = id;
      exec(uid);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].description).toContain('req.body');
    expect(result.findings[0].description).toContain('exec');
  });

  it('finds command injection with correct OWASP/CWE', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const cmd = req.body.command;
      exec(cmd);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].cwe).toBe(78);
    expect(result.findings[0].owasp).toBe('A03:2021');
  });

  it('finds path traversal', async () => {
    createFile(projectPath, 'src/api/route.ts', `
      const filePath = req.query.file;
      fs.readFileSync(filePath);
    `);
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].cwe).toBe(22);
  });

  it('handles empty project', async () => {
    const result = await taintAnalyzerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(0);
    expect(result.available).toBe(true);
  });
});

// Suppression integration tests live at the orchestrator level because
// suppression filtering is now cross-scanner. See:
// packages/core/__tests__/suppression-filter.test.ts

describe('taintAnalyzerScanner — custom rules', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('detects tainted flow into a custom call-sink', async () => {
    createFile(
      projectPath,
      'src/api/route.ts',
      [
        'const raw = req.body.query;',
        'internalDbRaw(raw);',
      ].join('\n'),
    );
    const cfg: AegisConfig = {
      ...MOCK_CONFIG,
      customSinks: [{ pattern: 'internalDbRaw', type: 'call', cwe: 'CWE-89' }],
    };
    const result = await taintAnalyzerScanner.scan(projectPath, cfg);
    const match = result.findings.find((f) => f.title.includes('internalDbRaw'));
    expect(match).toBeDefined();
    expect(match?.cwe).toBe(89);
  });

  it('custom sanitizer neutralizes finding for matching CWE', async () => {
    createFile(
      projectPath,
      'src/api/route.ts',
      [
        'const raw = req.body.cmd;',
        'const safe = validateAndSanitize(raw);',
        'exec(safe);',
      ].join('\n'),
    );
    const cfg: AegisConfig = {
      ...MOCK_CONFIG,
      customSanitizers: [
        { pattern: 'validateAndSanitize', cwes: ['CWE-78'] },
      ],
    };
    const result = await taintAnalyzerScanner.scan(projectPath, cfg);
    // exec(safe) should NOT fire — sanitizer covers CWE-78
    const cmdInjection = result.findings.filter((f) => f.cwe === 78);
    expect(cmdInjection).toHaveLength(0);
  });

  // Config-level suppressions are tested at the orchestrator level — see
  // packages/core/__tests__/suppression-filter.test.ts — because they apply
  // cross-scanner after all findings are aggregated.

  it('restores built-ins after scan — second scan without config is unaffected', async () => {
    // Scan 1 — with custom sink
    const cfg: AegisConfig = {
      ...MOCK_CONFIG,
      customSinks: [{ pattern: 'myTempSink', type: 'call', cwe: 'CWE-89' }],
    };
    createFile(
      projectPath,
      'src/api/scan1.ts',
      ['const x = req.body.a;', 'myTempSink(x);'].join('\n'),
    );
    const r1 = await taintAnalyzerScanner.scan(projectPath, cfg);
    expect(r1.findings.some((f) => f.title.includes('myTempSink'))).toBe(true);

    // Scan 2 — same file, NO custom config. myTempSink must be GONE.
    const proj2 = makeTempProject();
    createFile(
      proj2,
      'src/api/scan2.ts',
      ['const x = req.body.a;', 'myTempSink(x);'].join('\n'),
    );
    const r2 = await taintAnalyzerScanner.scan(proj2, MOCK_CONFIG);
    expect(r2.findings.some((f) => f.title.includes('myTempSink'))).toBe(false);
  });

  it('allowOverrides=false throws AegisConfigError on PARSE_NOT_SANITIZER conflict', async () => {
    createFile(projectPath, 'src/api/route.ts', 'const x = 1;');
    const cfg: AegisConfig = {
      ...MOCK_CONFIG,
      customSanitizers: [{ pattern: 'JSON.parse', cwes: ['CWE-89'] }],
    };
    await expect(taintAnalyzerScanner.scan(projectPath, cfg)).rejects.toThrow(/PARSE_NOT_SANITIZER/);
  });
});
