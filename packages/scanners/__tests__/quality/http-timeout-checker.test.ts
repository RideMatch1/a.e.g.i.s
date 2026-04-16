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

import { httpTimeoutCheckerScanner } from '../../src/quality/http-timeout-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-timeout-test-'));
}

function createLibFile(projectPath: string, filename: string, content: string): void {
  const libDir = join(projectPath, 'src', 'lib');
  mkdirSync(libDir, { recursive: true });
  writeFileSync(join(libDir, filename), content);
}

function createServiceFile(projectPath: string, filename: string, content: string): void {
  const servicesDir = join(projectPath, 'src', 'services');
  mkdirSync(servicesDir, { recursive: true });
  writeFileSync(join(servicesDir, filename), content);
}

describe('httpTimeoutCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await httpTimeoutCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no lib/services directories', async () => {
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('http-timeout-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for a file with no HTTP calls', async () => {
    createLibFile(projectPath, 'helpers.ts', `
      export function add(a: number, b: number) { return a + b; }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags fetch() without AbortController as MEDIUM', async () => {
    createLibFile(projectPath, 'weather.ts', `
      export async function getWeather(city: string) {
        const res = await fetch(\`https://api.weather.com/v1/\${city}\`);
        return res.json();
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('fetch()'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A05:2021');
    expect(finding!.cwe).toBe(400);
    expect(finding!.id).toBe('TIMEOUT-001');
  });

  it('does not flag fetch() when AbortController is present', async () => {
    createLibFile(projectPath, 'weather.ts', `
      export async function getWeather(city: string) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(\`https://api.weather.com/v1/\${city}\`, {
            signal: controller.signal,
          });
          return res.json();
        } finally {
          clearTimeout(timeout);
        }
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('fetch()'))).toHaveLength(0);
  });

  it('does not flag fetch() when signal: is present', async () => {
    createLibFile(projectPath, 'api.ts', `
      export async function callApi(url: string) {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        return res.json();
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('fetch()'))).toHaveLength(0);
  });

  it('flags axios call without timeout as MEDIUM', async () => {
    createServiceFile(projectPath, 'payment.ts', `
      import axios from 'axios';
      export async function charge(amount: number) {
        const res = await axios.post('https://api.payment.com/charge', { amount });
        return res.data;
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('axios'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('does not flag axios when timeout: is present', async () => {
    createServiceFile(projectPath, 'payment.ts', `
      import axios from 'axios';
      export async function charge(amount: number) {
        const res = await axios.post('https://api.payment.com/charge', { amount }, { timeout: 5000 });
        return res.data;
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('axios'))).toHaveLength(0);
  });

  it('flags got() without timeout as MEDIUM', async () => {
    createServiceFile(projectPath, 'scraper.ts', `
      import got from 'got';
      export async function scrape(url: string) {
        const body = await got(url).json();
        return body;
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('got()'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('does not flag got() when timeout: is present', async () => {
    createServiceFile(projectPath, 'scraper.ts', `
      import got from 'got';
      export async function scrape(url: string) {
        const body = await got(url, { timeout: { request: 5000 } }).json();
        return body;
      }
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('got()'))).toHaveLength(0);
  });

  it('skips test files', async () => {
    const libDir = join(projectPath, 'src', 'lib');
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, 'weather.test.ts'), `
      const res = await fetch('https://api.test.com/data');
    `);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('generates incrementing IDs across multiple findings', async () => {
    createLibFile(projectPath, 'a.ts', `const r = await fetch('https://a.com');`);
    createLibFile(projectPath, 'b.ts', `const r = await fetch('https://b.com');`);
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('TIMEOUT-001');
    expect(ids).toContain('TIMEOUT-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await httpTimeoutCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
