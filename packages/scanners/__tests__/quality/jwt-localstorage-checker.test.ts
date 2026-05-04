import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const path = require('path');

  function walkFiles(dir: string, ignore: string[] = [], extensions: string[] = []): string[] {
    const results: string[] = [];
    function walk(current: string): void {
      let entries: any[];
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (ignore.includes(entry.name)) continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          if (extensions.length === 0 || extensions.some((ext) => entry.name.endsWith(`.${ext}`))) {
            results.push(full);
          }
        }
      }
    }
    walk(dir);
    return results;
  }

  return {
    walkFiles,
    readFileSafe: (p: string) => {
      try {
        return readFileSync(p, 'utf-8');
      } catch {
        return null;
      }
    },
    isTestFile: (filePath: string) =>
      /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) ||
      /[\/\\]__tests__[\/\\]/.test(filePath) ||
      /[\/\\]__mocks__[\/\\]/.test(filePath) ||
      /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
  };
});

import { jwtLocalstorageCheckerScanner } from '../../src/quality/jwt-localstorage-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const CONFIG = {} as unknown as AegisConfig;

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-jwtls-test-'));
}
function createFile(root: string, rel: string, content: string): void {
  const parts = rel.split('/');
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

describe('jwtLocalstorageCheckerScanner', () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeProject();
  });

  it('is always available', async () => {
    expect(await jwtLocalstorageCheckerScanner.isAvailable('')).toBe(true);
  });

  it('has correct metadata', () => {
    expect(jwtLocalstorageCheckerScanner.name).toBe('jwt-localstorage-checker');
    expect(jwtLocalstorageCheckerScanner.category).toBe('security');
  });

  it('TP — flags localStorage.setItem("ne_token", ...) (snake-case _token suffix)', async () => {
    createFile(
      projectPath,
      'src/auth.ts',
      `export function save(t: string) { localStorage.setItem('ne_token', t); }`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(1);
    expect(r.findings[0].cwe).toBe(922);
    expect(r.findings[0].owasp).toBe('A02:2021');
    expect(r.findings[0].severity).toBe('high');
    expect(r.findings[0].title).toContain('ne_token');
  });

  it('TP — flags localStorage.setItem("ne_refresh", ...) (refresh-suffix shape — nanoedge canonical)', async () => {
    createFile(
      projectPath,
      'src/auth.ts',
      `export function saveRefresh(t: string) { localStorage.setItem('ne_refresh', t); }`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    const hits = r.findings.filter((f) => f.title.includes('ne_refresh'));
    expect(hits.length).toBe(1);
  });

  it('TP — flags sessionStorage.setItem with auth_jwt key', async () => {
    createFile(
      projectPath,
      'src/session.ts',
      `export function save(jwt: string) { sessionStorage.setItem('auth_jwt', jwt); }`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(1);
    expect(r.findings[0].title).toContain('sessionStorage');
    expect(r.findings[0].title).toContain('auth_jwt');
  });

  it('TP — flags camelCase "accessToken" (camelCase normalized to access_token)', async () => {
    createFile(
      projectPath,
      'src/store.ts',
      `export function save(t: string) { localStorage.setItem('accessToken', t); }`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(1);
  });

  it('TP — flags multiple calls in same file (counts each)', async () => {
    createFile(
      projectPath,
      'src/auth.ts',
      `
        export function save(a: string, r: string) {
          localStorage.setItem('ne_token', a);
          localStorage.setItem('ne_refresh', r);
        }
      `,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(2);
    expect(r.findings.map((f) => f.id)).toEqual(['JWTLS-001', 'JWTLS-002']);
  });

  it('FP — does NOT flag localStorage.setItem("theme", ...)', async () => {
    createFile(
      projectPath,
      'src/prefs.ts',
      `localStorage.setItem('theme', 'dark');`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings).toEqual([]);
  });

  it('FP — does NOT flag user_preferences / push_prompt_dismissed (no token-suggesting word)', async () => {
    createFile(
      projectPath,
      'src/prefs.ts',
      `
        localStorage.setItem('user_preferences', JSON.stringify({}));
        localStorage.setItem('push_prompt_dismissed', 'true');
        localStorage.setItem('sidebar_state', 'expanded');
        localStorage.setItem('language', 'en');
        localStorage.setItem('preferred_locale', 'en');
      `,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings).toEqual([]);
  });

  it('FP — does NOT flag tokenBalance (camelCase "balance" suffix, not a token-storage)', async () => {
    createFile(
      projectPath,
      'src/balance.ts',
      `localStorage.setItem('tokenBalance', String(42));`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings).toEqual([]);
  });

  it('FP — does NOT flag refreshButton / refresh_interval (UI-state shapes)', async () => {
    createFile(
      projectPath,
      'src/ui.ts',
      `
        localStorage.setItem('refresh_interval', '30');
        localStorage.setItem('refreshButton', 'enabled');
      `,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings).toEqual([]);
  });

  it('FP — skips test files (*.test.ts) even if they look like real token-storage', async () => {
    createFile(
      projectPath,
      'src/auth.test.ts',
      `localStorage.setItem('ne_token', 'fixture');`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings).toEqual([]);
  });

  it('FP — skips files in /scripts/ + /vendor/ + .min.js', async () => {
    createFile(
      projectPath,
      'scripts/seed.ts',
      `localStorage.setItem('ne_token', 'seed');`,
    );
    createFile(
      projectPath,
      'vendor/legacy.js',
      `localStorage.setItem('auth_token', 'x');`,
    );
    createFile(
      projectPath,
      'public/lib.min.js',
      `localStorage.setItem('jwt', 'x');`,
    );
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings).toEqual([]);
  });

  it('TP — flags bare key "token" (worst-case naming)', async () => {
    createFile(projectPath, 'src/x.ts', `localStorage.setItem('token', 'x');`);
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(1);
  });

  it('TP — flags bare key "jwt"', async () => {
    createFile(projectPath, 'src/x.ts', `localStorage.setItem('jwt', 'x');`);
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(1);
  });

  it('TP — flags backtick template-string key', async () => {
    createFile(projectPath, 'src/x.ts', "localStorage.setItem(`refresh_token`, 'x');");
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(r.findings.length).toBe(1);
  });

  it('returns duration + available metadata', async () => {
    const r = await jwtLocalstorageCheckerScanner.scan(projectPath, CONFIG);
    expect(typeof r.duration).toBe('number');
    expect(r.available).toBe(true);
    expect(r.scanner).toBe('jwt-localstorage-checker');
    expect(r.category).toBe('security');
  });
});
