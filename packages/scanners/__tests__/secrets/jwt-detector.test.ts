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

import { jwtDetectorScanner } from '../../src/secrets/jwt-detector.js';
import type { AegisConfig, FixGuidance } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-jwt-detector-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('jwtDetectorScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await jwtDetectorScanner.isAvailable(projectPath)).toBe(true);
  });

  it('emits no findings for a project with no JWT content', async () => {
    createFile(projectPath, 'src/lib/util.ts', `
export const greeting = "hello world";
export function add(a: number, b: number): number { return a + b; }
    `);
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('emits CRITICAL SECRET-JWT finding for a hardcoded JWT in a bare double-quoted string (TP-hardcoded-jwt)', async () => {
    createFile(projectPath, 'src/config/secrets.ts', `
export const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";
    `);
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].scanner).toBe('jwt-detector');
    expect(result.findings[0].id).toMatch(/^SECRET-JWT-\d{3}$/);
  });

  it('emits CRITICAL SECRET-JWT finding for a fully-static JWT inside a template-literal without interpolation (TP-hardcoded-template-jwt)', async () => {
    createFile(projectPath, 'src/config/secrets.ts', [
      'export const KEY = `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456`;',
    ].join('\n'));
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].scanner).toBe('jwt-detector');
  });

  it('does NOT emit for an env-var referenced JWT (FP-env-jwt)', async () => {
    createFile(projectPath, 'src/config/env.ts', `
export const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    `);
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT emit for an interpolated template-literal JWT (FP-interpolated-template-jwt, documented v0.15.3 AST-deferral)', async () => {
    createFile(projectPath, 'src/config/composer.ts', [
      'const payload = "eyJyb2xlIjoic2VydmljZV9yb2xlIn0";',
      'const sig = "abc123def456";',
      'export const KEY = `eyJhbGciOiJIUzI1NiJ9.${payload}.${sig}`;',
    ].join('\n'));
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'jwt-detector')).toHaveLength(0);
  });

  it('emits fix-field as canonical FixGuidance object (day-zero structured remediation)', async () => {
    createFile(projectPath, 'src/config/secrets.ts', `
export const KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";
    `);
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    const fix = result.findings[0].fix;
    expect(typeof fix).toBe('object');
    const fixObj = fix as FixGuidance;
    expect(fixObj.description).toEqual(expect.any(String));
    expect(fixObj.description.length).toBeGreaterThan(10);
    expect(Array.isArray(fixObj.links)).toBe(true);
  });

  it('tags findings with CWE 798 (hardcoded credentials)', async () => {
    createFile(projectPath, 'src/config/secrets.ts', `
export const KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";
    `);
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings[0].cwe).toBe(798);
  });

  it('skips test files by convention', async () => {
    createFile(projectPath, 'src/__tests__/secrets.test.ts', `
const mockJwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";
    `);
    createFile(projectPath, 'src/jwt.spec.ts', `
const fixture = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";
    `);
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('records scanner name and category correctly on the ScanResult', async () => {
    const result = await jwtDetectorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('jwt-detector');
    expect(result.category).toBe('security');
    expect(result.available).toBe(true);
  });
});
