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

import { ssrfCheckerScanner } from '../../src/quality/ssrf-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-ssrf-test-'));
}

function writeFile(projectPath: string, relPath: string, content: string): void {
  const parts = relPath.split('/');
  mkdirSync(join(projectPath, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

describe('ssrfCheckerScanner — Z4 library-wrapper heuristic', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('v0.11 Z4: suppresses fetch(url) inside `export function f(url)` library wrapper', async () => {
    // D10-shape library wrapper — url is a parameter, fetch(url) is internal.
    // Consumers are responsible for passing safe URLs; the wrapper itself is
    // not a CWE-918 risk.
    writeFile(
      projectPath,
      'lib/api.ts',
      `
export async function rateLimitCall(url, opts) {
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(opts.body),
  });
}
`,
    );
    const result = await ssrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 918)).toHaveLength(0);
  });

  it('v0.11 Z4: still flags fetch(url) when url is a LOCAL variable, not a parameter', async () => {
    // Positive control — the wrapper heuristic must NOT silence route
    // handlers where the fetched URL is a local variable derived from
    // user input.
    writeFile(
      projectPath,
      'app/api/handler/route.ts',
      `
export async function POST(req) {
  const { url } = await req.json();  // url is a LOCAL, not a param
  const res = await fetch(url);
  return Response.json(await res.json());
}
`,
    );
    const result = await ssrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 918).length).toBeGreaterThan(0);
  });

  it('v0.11 Z4: still flags when wrapper has different param name than fetched var', async () => {
    // If the function parameter is `target` but the code fetches `url`
    // (derived elsewhere), the heuristic should not silence — the fetched
    // name is not in the param list.
    writeFile(
      projectPath,
      'lib/service.ts',
      `
export async function callTarget(target) {
  const url = target + '/api';
  return fetch(url);
}
`,
    );
    const result = await ssrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 918).length).toBeGreaterThan(0);
  });

  it('flags fetch with interpolation-first template URL', async () => {
    // Scanner's template pattern requires `fetch(` followed by `` ` ``
    // then `${`; URLs that start with a literal prefix (e.g.
    // `\`https://\${tenant}.foo\``) don't match that specific pattern.
    // Use the interpolation-first shape for this positive control.
    writeFile(
      projectPath,
      'app/api/proxy/route.ts',
      `
export async function POST(req) {
  const target = req.headers.get('x-target');
  return fetch(\`\${target}/api\`);
}
`,
    );
    const result = await ssrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 918).length).toBeGreaterThan(0);
  });

  it('does NOT flag files that use safeFetch wrapper', async () => {
    writeFile(
      projectPath,
      'app/api/proxy/route.ts',
      `
import { safeFetch } from '@/lib/safe';
export async function POST(req) {
  const { url } = await req.json();
  return safeFetch(url);
}
`,
    );
    const result = await ssrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 918)).toHaveLength(0);
  });
});
