import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readFileSync } = require('fs');

  return {
    walkFiles: () => [],
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isTestFile: (filePath: string) =>
      /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) ||
      /[\/\\]__tests__[\/\\]/.test(filePath) ||
      /[\/\\]__mocks__[\/\\]/.test(filePath) ||
      /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
  };
});

import { cspEvaluatorScanner } from '../../src/quality/csp-evaluator.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempNextProject(nextConfigBody: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'aegis-csp-eval-test-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'csp-eval-test-project',
      dependencies: { next: '^14.0.0' },
    }),
  );
  writeFileSync(join(dir, 'next.config.js'), nextConfigBody);
  return dir;
}

function buildNextConfig(cspValue: string): string {
  return `module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: ${JSON.stringify(cspValue)} },
        ],
      },
    ];
  },
};
`;
}

describe('csp-evaluator', () => {
  describe('isAvailable', () => {
    it('returns true when next.config.js exists', async () => {
      const dir = makeTempNextProject(buildNextConfig("default-src 'self'"));
      expect(await cspEvaluatorScanner.isAvailable(dir)).toBe(true);
    });

    it('returns false when no Next.js indicators are present', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aegis-csp-eval-non-next-'));
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'plain', dependencies: { express: '^4' } }),
      );
      expect(await cspEvaluatorScanner.isAvailable(dir)).toBe(false);
    });
  });

  describe('TP detection — script-src weakness', () => {
    it("flags 'unsafe-inline' with NO nonce / hash at HIGH severity", async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self'; script-src 'self' 'unsafe-inline'"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      const high = res.findings.filter((f) => f.severity === 'high');
      expect(high.length).toBeGreaterThanOrEqual(1);
      expect(high[0].title).toMatch(/unsafe-inline/);
      expect(high[0].cwe).toBe(693);
    });

    it("flags 'unsafe-inline' WITH nonce (no strict-dynamic) at MEDIUM severity", async () => {
      const dir = makeTempNextProject(
        buildNextConfig(
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'nonce-rGV2OWIwd2syNG5l'",
        ),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      const med = res.findings.filter((f) => f.severity === 'medium');
      expect(med.length).toBe(1);
      expect(med[0].description).toMatch(/neutralized.*nonce/i);
    });

    it("flags 'unsafe-eval' at HIGH severity", async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self'; script-src 'self' 'unsafe-eval'"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      const high = res.findings.filter((f) => f.severity === 'high');
      expect(high.some((f) => /unsafe-eval/.test(f.title))).toBe(true);
    });

    it('flags wildcard `*` in script-src at HIGH severity', async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self'; script-src *"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      expect(res.findings.some((f) => f.severity === 'high' && /\*/.test(f.title))).toBe(true);
    });

    it('flags http:// origin at HIGH severity (TLS-downgrade vector)', async () => {
      const dir = makeTempNextProject(
        buildNextConfig(
          "default-src 'self'; script-src 'self' http://cdn.example.com",
        ),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      const http = res.findings.find((f) => /http:\/\//.test(f.description));
      expect(http?.severity).toBe('high');
    });

    it('flags data: in script-src at HIGH severity', async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self'; script-src 'self' data:"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      expect(res.findings.some((f) => f.severity === 'high' && /data:/.test(f.title + f.description))).toBe(true);
    });

    it('flags blob: in script-src at HIGH severity', async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self'; script-src 'self' blob:"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      expect(res.findings.some((f) => f.severity === 'high' && /blob:/.test(f.title + f.description))).toBe(true);
    });

    it('falls back to default-src when script-src is absent (CSP3 semantics)', async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self' 'unsafe-inline'"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      // Should fire on default-src (the fallback)
      expect(res.findings.some((f) => f.severity === 'high' && /default-src/.test(f.title))).toBe(true);
    });
  });

  describe('CSP3 strict-dynamic FP-trap (advisor 2026-05-01)', () => {
    it("does NOT flag 'unsafe-inline' / wildcard / https: when 'strict-dynamic' + nonce are present", async () => {
      const dir = makeTempNextProject(
        buildNextConfig(
          "default-src 'self'; script-src 'strict-dynamic' 'nonce-rGV2OWIwd2syNG5l' 'unsafe-inline' https:",
        ),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      // Modern CSP3 hardened pattern — must produce ZERO findings.
      expect(res.findings.length).toBe(0);
    });

    it("does NOT flag wildcard host when 'strict-dynamic' + sha256-hash are present", async () => {
      const dir = makeTempNextProject(
        buildNextConfig(
          "default-src 'self'; script-src 'strict-dynamic' 'sha256-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/=' *",
        ),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      expect(res.findings.length).toBe(0);
    });

    it("STILL flags 'unsafe-eval' even when 'strict-dynamic' + nonce neutralize the rest", async () => {
      const dir = makeTempNextProject(
        buildNextConfig(
          "default-src 'self'; script-src 'strict-dynamic' 'nonce-rGV2OWIwd2syNG5l' 'unsafe-eval'",
        ),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      // strict-dynamic does NOT neutralize unsafe-eval — still high-severity
      expect(res.findings.length).toBe(1);
      expect(res.findings[0].severity).toBe('high');
      expect(res.findings[0].title).toMatch(/unsafe-eval/);
    });
  });

  describe('FP regression-guards', () => {
    it("does NOT flag a hardened policy ('self' + https-cdn + object-src 'none')", async () => {
      const dir = makeTempNextProject(
        buildNextConfig(
          "default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none'; base-uri 'self'",
        ),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      expect(res.findings.length).toBe(0);
    });

    it("does NOT flag bare 'self' / 'none' keywords", async () => {
      const dir = makeTempNextProject(
        buildNextConfig("default-src 'self'; script-src 'self'; object-src 'none'"),
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      expect(res.findings.length).toBe(0);
    });

    it("does NOT fire when next.config has security headers but NO Content-Security-Policy", async () => {
      const dir = makeTempNextProject(`module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' }
    ]}];
  },
};`);
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      // Missing CSP is header-checker's job, not csp-evaluator's.
      expect(res.findings.length).toBe(0);
    });
  });

  describe('multi-source-file handling', () => {
    it('scans both next.config.js AND middleware.ts when both define a CSP', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aegis-csp-eval-multi-'));
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'multi', dependencies: { next: '^14' } }),
      );
      writeFileSync(
        join(dir, 'next.config.js'),
        buildNextConfig("default-src 'self'; script-src 'self' 'unsafe-inline'"),
      );
      writeFileSync(
        join(dir, 'middleware.ts'),
        `import { NextResponse } from 'next/server';
export function middleware(req: Request) {
  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', "default-src 'self'; script-src *");
  return res;
}
`,
      );
      const res = await cspEvaluatorScanner.scan(dir, MOCK_CONFIG);
      // 1 finding from next.config.js (unsafe-inline) + 1 from middleware.ts (wildcard)
      expect(res.findings.length).toBeGreaterThanOrEqual(2);
    });
  });
});
