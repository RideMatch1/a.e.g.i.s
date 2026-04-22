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

import { redosCheckerScanner } from '../../src/quality/redos-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-redos-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('redosCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await redosCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('redos-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags nested quantifiers near user input as HIGH', async () => {
    createFile(
      projectPath,
      'lib/validator.ts',
      `
export function validateInput(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('q') ?? '';
  const regex = /(a+)+$/;
  return regex.test(input);
}
`,
    );

    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.id).toMatch(/^REDOS-/);
    expect(finding.owasp).toBe('A05:2021');
    expect(finding.cwe).toBe(1333);
  });

  it('does NOT flag regex without user input context', async () => {
    createFile(
      projectPath,
      'lib/internal.ts',
      `
const regex = /(a+)+$/;
const result = regex.test('some static string');
`,
    );

    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags quantified group with greedy wildcard near user input', async () => {
    createFile(
      projectPath,
      'lib/search.ts',
      `
export function search(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const pattern = /(.*match){3}/;
  return pattern.test(query);
}
`,
    );

    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].title).toContain('ReDoS');
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'lib/__tests__/regex.test.ts',
      `
const input = searchParams.get('q');
const regex = /(a+)+$/;
`,
    );

    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});

describe('redosCheckerScanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('N1-class: flags catastrophic-backtrack regex under /api/test/ route path (regression-guard for v0.16.3 fix)', async () => {
    createFile(
      projectPath,
      'src/app/api/test/route.ts',
      ["const input = searchParams.get('q');", 'const regex = /^(a+)+$/;', 'regex.test(input);'].join('\n'),
    );
    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'redos-checker' && f.cwe === 1333);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('P1-class: skips catastrophic-backtrack regex in *.test.ts basename (canonical isTestFile extension-match)', async () => {
    createFile(
      projectPath,
      'src/foo.test.ts',
      ["const input = searchParams.get('q');", 'const regex = /^(a+)+$/;', 'regex.test(input);'].join('\n'),
    );
    const result = await redosCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'redos-checker')).toHaveLength(0);
  });
});
