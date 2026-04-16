import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  };
});

import { headerCheckerScanner } from '../../src/quality/header-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-header-test-'));
}

const ALL_HEADERS = [
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-XSS-Protection',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Resource-Policy',
  'Cross-Origin-Opener-Policy',
];

describe('headerCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  // v0.8 Phase 8: gated on Next.js project signal to avoid structural
  // FPs when scanning non-web-framework codebases (scanner OSS, pure
  // libraries). Presence of next.config.*, middleware.*, or a 'next'
  // dependency in package.json all qualify.
  it('is NOT available on an empty project (no Next.js signal)', async () => {
    expect(await headerCheckerScanner.isAvailable(projectPath)).toBe(false);
  });

  it('is available when next.config.ts exists', async () => {
    writeFileSync(join(projectPath, 'next.config.ts'), 'export default {};');
    expect(await headerCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('is available when package.json lists "next" as a dependency', async () => {
    writeFileSync(
      join(projectPath, 'package.json'),
      JSON.stringify({ dependencies: { next: '^14.0.0' } }),
    );
    expect(await headerCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('is available when package.json lists "next" as a devDependency', async () => {
    writeFileSync(
      join(projectPath, 'package.json'),
      JSON.stringify({ devDependencies: { next: '^14.0.0' } }),
    );
    expect(await headerCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('is available when middleware.ts exists', async () => {
    writeFileSync(join(projectPath, 'middleware.ts'), 'export function middleware() {}');
    expect(await headerCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('reports all 10 headers missing when no config file exists', async () => {
    const result = await headerCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(10);
    for (const header of ALL_HEADERS) {
      const finding = result.findings.find((f) => f.title.includes(header));
      expect(finding, `Expected finding for ${header}`).toBeDefined();
      expect(finding!.severity).toBe('medium');
      expect(finding!.category).toBe('security');
    }
  });

  it('reports no findings when all headers are present in next.config.ts', async () => {
    const config = `
      const nextConfig = {
        async headers() {
          return [{
            source: '/(.*)',
            headers: [
              { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
              { key: 'Content-Security-Policy', value: "default-src 'self'" },
              { key: 'X-Frame-Options', value: 'DENY' },
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
              { key: 'Permissions-Policy', value: 'camera=()' },
              { key: 'X-XSS-Protection', value: '1; mode=block' },
              { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
              { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
              { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            ],
          }];
        },
      };
      export default nextConfig;
    `;
    writeFileSync(join(projectPath, 'next.config.ts'), config);

    const result = await headerCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('reports only missing headers when some are present', async () => {
    const config = `
      const securityHeaders = [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ];
    `;
    writeFileSync(join(projectPath, 'next.config.js'), config);

    const result = await headerCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // Should be missing: CSP, Referrer-Policy, Permissions-Policy, X-XSS-Protection, COEP, CORP, COOP
    expect(result.findings).toHaveLength(7);
    expect(result.findings.find((f) => f.title.includes('Content-Security-Policy'))).toBeDefined();
    expect(result.findings.find((f) => f.title.includes('Referrer-Policy'))).toBeDefined();
    expect(result.findings.find((f) => f.title.includes('Cross-Origin-Embedder-Policy'))).toBeDefined();
    expect(result.findings.find((f) => f.title.includes('Cross-Origin-Resource-Policy'))).toBeDefined();
    expect(result.findings.find((f) => f.title.includes('Cross-Origin-Opener-Policy'))).toBeDefined();
  });

  it('detects headers configured in middleware.ts', async () => {
    const middleware = `
      import { NextResponse } from 'next/server';
      export function middleware(request) {
        const response = NextResponse.next();
        response.headers.set('Strict-Transport-Security', 'max-age=31536000');
        response.headers.set('Content-Security-Policy', "default-src 'self'");
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('Referrer-Policy', 'no-referrer');
        response.headers.set('Permissions-Policy', 'camera=()');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
        response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        return response;
      }
    `;
    writeFileSync(join(projectPath, 'middleware.ts'), middleware);

    const result = await headerCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('generates HDR-xxx IDs', async () => {
    const result = await headerCheckerScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^HDR-\d{3}$/);
    }
  });

  it('detects frameOptions (camelCase Next.js style) as X-Frame-Options', async () => {
    const config = `
      const nextConfig = {
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'Content-Security-Policy', value: "default-src 'self'" },
          // Using frameOptions keyword instead of header name
          { key: 'frameOptions', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ]
      };
    `;
    writeFileSync(join(projectPath, 'next.config.ts'), config);

    const result = await headerCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.find((f) => f.title.includes('X-Frame-Options'))).toBeUndefined();
  });
});
