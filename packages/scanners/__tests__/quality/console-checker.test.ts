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

import { consoleCheckerScanner } from '../../src/quality/console-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-console-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const fullPath = join(projectPath, relPath);
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('consoleCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await consoleCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns empty findings for clean project', async () => {
    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect(result.scanner).toBe('console-checker');
    expect(result.category).toBe('quality');
  });
});

describe('consoleCheckerScanner — console statements', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags console.log() in source code as LOW', async () => {
    createFile(
      projectPath,
      'src/utils.ts',
      `export function doStuff() {
  console.log('debug info');
  return true;
}`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('flags console.debug() as LOW', async () => {
    createFile(
      projectPath,
      'src/service.ts',
      `console.debug('trace value:', x);`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.debug'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('does NOT flag console.log in test files', async () => {
    createFile(
      projectPath,
      'src/utils.test.ts',
      `console.log('test debug');`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag console.log in __tests__ directory', async () => {
    createFile(
      projectPath,
      '__tests__/helper.ts',
      `console.log('test helper');`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeUndefined();
  });

  // v0.6.1 — extended test-path exclusion (dogfood FP-fix)
  // Dogfood on cal-com + dub found 44 FPs in apps/web/playwright/**.
  // The following tests pin the extended isTestFile heuristic.

  it('does NOT flag console.log in playwright/ directory (v0.6.1)', async () => {
    createFile(
      projectPath,
      'apps/web/playwright/availability.e2e.ts',
      `await page.click('button'); console.log('debug trace');`,
    );
    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag console.log in cypress/ directory (v0.6.1)', async () => {
    createFile(
      projectPath,
      'cypress/integration/auth.cy.ts',
      `cy.log('bla'); console.log('debug');`,
    );
    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag console.log in e2e/ directory (v0.6.1)', async () => {
    createFile(
      projectPath,
      'e2e/checkout.ts',
      `console.log('checkout-flow debug');`,
    );
    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeUndefined();
  });

  it('STILL flags console.log in production src/ (regression guard, v0.6.1)', async () => {
    // The exclusion must not over-match — console.log in real production
    // code paths must still be flagged.
    createFile(
      projectPath,
      'src/api/route.ts',
      `export async function GET() { console.log('debug'); return new Response(); }`,
    );
    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.log'));
    expect(finding).toBeDefined();
  });

  it('flags console.error with sensitive data as MEDIUM', async () => {
    createFile(
      projectPath,
      'src/auth.ts',
      `try { login(); } catch(e) {
  console.error('Failed with password:', password);
}`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.error'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('does NOT flag console.error without sensitive data', async () => {
    createFile(
      projectPath,
      'src/handler.ts',
      `try { process(); } catch(e) {
  console.error('Request failed:', e.message);
}`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('console.error'));
    expect(finding).toBeUndefined();
  });
});

describe('consoleCheckerScanner — debugger statement', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags debugger statement as HIGH', async () => {
    createFile(
      projectPath,
      'src/component.tsx',
      `export function Widget() {
  debugger;
  return <div>Hello</div>;
}`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Debugger statement'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });
});

describe('consoleCheckerScanner — TODO/FIXME/HACK/XXX comments', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags TODO comment as INFO', async () => {
    createFile(
      projectPath,
      'src/api.ts',
      `// TODO implement rate limiting\nexport function handler() {}`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('TODO'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('flags FIXME comment as INFO', async () => {
    createFile(
      projectPath,
      'src/db.ts',
      `// FIXME race condition on concurrent writes\nexport function save() {}`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('FIXME'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('flags HACK comment as INFO', async () => {
    createFile(
      projectPath,
      'src/parser.ts',
      `// HACK workaround for upstream bug\nconst x = 1;`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('HACK'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('flags XXX comment as INFO', async () => {
    createFile(
      projectPath,
      'src/helper.ts',
      `// XXX needs refactoring\nconst y = 2;`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('XXX'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('does NOT flag TODO in test files', async () => {
    createFile(
      projectPath,
      'src/api.test.ts',
      `// TODO add more test cases`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('TODO'));
    expect(finding).toBeUndefined();
  });

  it('all finding IDs are DEBUG-0xx format', async () => {
    createFile(
      projectPath,
      'src/main.ts',
      `console.log('hi');\ndebugger;\n// TODO fix\n`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^DEBUG-\d{3}$/);
    }
  });

  it('includes correct line numbers', async () => {
    createFile(
      projectPath,
      'src/code.ts',
      `const a = 1;\nconst b = 2;\ndebugger;\nconst c = 3;\n`,
    );

    const result = await consoleCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Debugger'));
    expect(finding).toBeDefined();
    expect(finding!.line).toBe(3);
  });
});
