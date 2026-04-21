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

import { pathTraversalCheckerScanner } from '../../src/quality/path-traversal-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-pathtrv-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('pathTraversalCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await pathTraversalCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('path-traversal-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags path.join with request params as HIGH', async () => {
    createFile(
      projectPath,
      'api/files/route.ts',
      `
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('file');
  const filePath = path.join('/uploads', searchParams.get('path')!);
  return new Response(readFileSync(filePath));
}
`,
    );

    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings.find(f => f.title.includes('path.join'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.id).toMatch(/^PATHTRV-/);
    expect(finding!.owasp).toBe('A01:2021');
    expect(finding!.cwe).toBe(22);
  });

  it('flags readFileSync with variable path', async () => {
    createFile(
      projectPath,
      'api/download/route.ts',
      `
export async function GET(request: NextRequest) {
  const filePath = getFilePathFromRequest(request);
  const content = readFileSync(filePath);
  return new Response(content);
}
`,
    );

    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find(f => f.title.includes('readFileSync'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag when path.normalize is used', async () => {
    createFile(
      projectPath,
      'api/safe-files/route.ts',
      `
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const normalized = path.normalize(searchParams.get('path')!);
  const filePath = path.join('/uploads', searchParams.get('path')!);
  return new Response(readFileSync(filePath));
}
`,
    );

    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('only checks files in api/lib/services directories', async () => {
    createFile(
      projectPath,
      'components/FileViewer.ts',
      `
const filePath = path.join('/uploads', searchParams.get('path')!);
const content = readFileSync(filePath);
`,
    );

    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'api/__tests__/files.test.ts',
      `
const filePath = path.join('/uploads', searchParams.get('path')!);
`,
    );

    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await pathTraversalCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
