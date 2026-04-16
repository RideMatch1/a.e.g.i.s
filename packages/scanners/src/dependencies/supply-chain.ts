import { readFileSafe, walkFiles } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Top-100 popular npm packages for typosquatting detection
const POPULAR_PACKAGES = [
  'react', 'react-dom', 'next', 'express', 'lodash', 'axios', 'typescript',
  'zod', 'webpack', 'babel', 'eslint', 'prettier', 'jest', 'mocha', 'chai',
  'vue', 'angular', 'svelte', 'jquery', 'moment', 'dayjs', 'date-fns',
  'underscore', 'ramda', 'rxjs', 'redux', 'mobx', 'zustand', 'immer',
  'chalk', 'commander', 'yargs', 'inquirer', 'ora', 'glob', 'minimatch',
  'semver', 'uuid', 'nanoid', 'dotenv', 'cors', 'helmet', 'morgan',
  'passport', 'jsonwebtoken', 'bcrypt', 'bcryptjs', 'mongoose', 'sequelize',
  'prisma', 'knex', 'pg', 'mysql2', 'redis', 'ioredis', 'socket.io',
  'ws', 'http-proxy', 'node-fetch', 'got', 'superagent', 'cheerio',
  'puppeteer', 'playwright', 'cypress', 'vitest', 'esbuild', 'rollup',
  'vite', 'turbo', 'lerna', 'nx', 'tsup', 'tslib', 'core-js', 'regenerator-runtime',
  'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'less', 'styled-components',
  'emotion', 'framer-motion', 'three', 'd3', 'chart.js', 'recharts',
  'formik', 'react-hook-form', 'yup', 'ajv', 'joi', 'superstruct',
  'stripe', 'aws-sdk', 'firebase', 'supabase', 'graphql', 'apollo',
  'fastify', 'koa', 'hapi', 'nestjs', 'debug', 'winston', 'pino',
  'sharp', 'jimp', 'multer',
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
  return dp[m][n];
}

interface PackageDeps {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

interface PkgScripts {
  scripts?: {
    preinstall?: string;
    postinstall?: string;
    [key: string]: string | undefined;
  };
  name?: string;
}

/**
 * Extract package name from an import specifier.
 * Scoped: '@scope/pkg/subpath' -> '@scope/pkg'
 * Regular: 'lodash/fp' -> 'lodash'
 */
function extractPackageName(specifier: string): string | null {
  // Skip relative/absolute imports
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;

  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }

  return specifier.split('/')[0];
}

export const supplyChainScanner: Scanner = {
  name: 'supply-chain',
  description: 'Supply chain security analysis — typosquatting, install scripts, phantom dependencies, and more',
  category: 'dependencies',

  async isAvailable(_projectPath: string): Promise<boolean> {
    // Pure file-based scanner — always available
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    function addFinding(
      severity: Finding['severity'],
      title: string,
      description: string,
      cwe: number,
    ): void {
      findings.push({
        id: `SUPPLY-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'supply-chain',
        severity,
        title,
        description,
        category: 'dependencies',
        owasp: 'A06:2021',
        cwe,
      });
    }

    // Read project's package.json
    const pkgContent = readFileSafe(join(projectPath, 'package.json'));
    let pkgJson: PackageDeps | null = null;
    if (pkgContent) {
      try {
        pkgJson = JSON.parse(pkgContent) as PackageDeps;
      } catch {
        pkgJson = null;
      }
    }

    const allDeps: Record<string, string> = {
      ...(pkgJson?.dependencies ?? {}),
      ...(pkgJson?.devDependencies ?? {}),
    };

    // --- Check 1: Typosquatting Detection ---
    if (pkgJson) {
      const popularSet = new Set(POPULAR_PACKAGES);
      const depNames = Object.keys(allDeps);
      // Well-known packages that look like typos but are legitimate
      const KNOWN_SAFE = new Set([
        'tsx', 'tsup', 'tslib', 'tsnode', 'tsc-watch',
        'preact', 'reacts', 'lodash-es', 'vitest', 'bun',
        'esbuild', 'unbuild', 'vite', 'vites', 'nuxt',
      ]);
      for (const dep of depNames) {
        if (popularSet.has(dep)) continue;
        if (KNOWN_SAFE.has(dep)) continue;
        // Skip very short names — too many false matches
        if (dep.length < 4) continue;
        for (const popular of POPULAR_PACKAGES) {
          if (popular.length < 4) continue;
          const dist = levenshtein(dep, popular);
          if (dist >= 1 && dist <= 2) {
            addFinding(
              'high',
              `Possible typosquatting: "${dep}" (similar to "${popular}")`,
              `Dependency "${dep}" has a Levenshtein distance of ${dist} from popular package "${popular}". This may indicate a typosquatting attack. Verify this is the intended package.`,
              1357,
            );
          }
        }
      }
    }

    // --- Check 2: Install Scripts ---
    const nodeModulesPath = join(projectPath, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      let topLevelDirs: string[];
      try {
        topLevelDirs = readdirSync(nodeModulesPath);
      } catch {
        topLevelDirs = [];
      }

      for (const dir of topLevelDirs) {
        if (dir.startsWith('.')) continue;

        if (dir.startsWith('@')) {
          // Scoped packages
          const scopeDir = join(nodeModulesPath, dir);
          let scopedPkgs: string[];
          try {
            scopedPkgs = readdirSync(scopeDir);
          } catch {
            continue;
          }
          for (const scopedPkg of scopedPkgs) {
            checkInstallScripts(join(scopeDir, scopedPkg), `${dir}/${scopedPkg}`, addFinding);
          }
          continue;
        }

        checkInstallScripts(join(nodeModulesPath, dir), dir, addFinding);
      }
    }

    // --- Check 3: Git/URL Dependencies ---
    if (pkgJson) {
      for (const [dep, version] of Object.entries(allDeps)) {
        if (
          version.startsWith('git+') ||
          version.startsWith('git://') ||
          version.startsWith('http://') ||
          version.startsWith('https://')
        ) {
          addFinding(
            'high',
            `Git/URL dependency: "${dep}"`,
            `Dependency "${dep}" is installed from a URL (${version}) instead of the npm registry. This bypasses npm's integrity checks and could be tampered with.`,
            829,
          );
        }
      }
    }

    // --- Check 4: Wildcard Versions ---
    if (pkgJson) {
      for (const [dep, version] of Object.entries(allDeps)) {
        if (version === '*' || version === '' || version === 'latest') {
          addFinding(
            'high',
            `Wildcard version: "${dep}" (${version || '(empty)'})`,
            `Dependency "${dep}" uses an unpinned version "${version || '(empty)'}". This allows arbitrary version resolution and could pull in a compromised release.`,
            829,
          );
        }
      }
    }

    // --- Check 5: Binary Detection ---
    if (existsSync(nodeModulesPath)) {
      const binaryExtensions = ['.node', '.so', '.dll', '.dylib'];
      let topLevelDirs: string[];
      try {
        topLevelDirs = readdirSync(nodeModulesPath);
      } catch {
        topLevelDirs = [];
      }

      /** Check a single package dir for binaries */
      function checkBinaries(pkgDir: string, pkgName: string): void {
        let entries: string[];
        try {
          entries = readdirSync(pkgDir);
        } catch {
          return;
        }
        for (const entry of entries) {
          for (const ext of binaryExtensions) {
            if (entry.endsWith(ext)) {
              addFinding(
                'medium',
                `Native binary in dependency: "${pkgName}/${entry}"`,
                `Package "${pkgName}" contains a native binary file "${entry}". Native binaries can execute arbitrary code and bypass JavaScript sandboxing.`,
                829,
              );
            }
          }
        }
      }

      for (const dir of topLevelDirs) {
        if (dir.startsWith('.')) continue;
        const dirPath = join(nodeModulesPath, dir);
        try {
          const stat = statSync(dirPath);
          if (!stat.isDirectory()) continue;
        } catch {
          continue;
        }

        // Handle scoped packages (@scope/pkg)
        if (dir.startsWith('@')) {
          let scopedDirs: string[];
          try {
            scopedDirs = readdirSync(dirPath);
          } catch {
            continue;
          }
          for (const scopedPkg of scopedDirs) {
            checkBinaries(join(dirPath, scopedPkg), `${dir}/${scopedPkg}`);
          }
        } else {
          checkBinaries(dirPath, dir);
        }
      }
    }

    // --- Check 6: Phantom Dependencies ---
    if (pkgJson) {
      const sourceFiles = walkFiles(
        projectPath,
        ['node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage'],
        ['ts', 'tsx', 'js', 'jsx'],
      );

      const declaredDeps = new Set(Object.keys(allDeps));
      const importedPackages = new Set<string>();

      const importPatterns = [
        // import ... from 'pkg' or import 'pkg'
        /(?:import\s+(?:[\s\S]*?\s+from\s+)?['"])([^'"./][^'"]*)['"]/g,
        // require('pkg')
        /require\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
      ];

      for (const file of sourceFiles) {
        const content = readFileSafe(file);
        if (!content) continue;

        for (const pattern of importPatterns) {
          // Reset lastIndex for global regexps
          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(content)) !== null) {
            const pkgName = extractPackageName(match[1]);
            if (pkgName) importedPackages.add(pkgName);
          }
        }
      }

      // Built-in Node.js modules to exclude
      const builtins = new Set([
        'fs', 'path', 'os', 'url', 'http', 'https', 'crypto', 'stream', 'util',
        'events', 'buffer', 'child_process', 'cluster', 'dgram', 'dns', 'net',
        'readline', 'tls', 'zlib', 'assert', 'querystring', 'string_decoder',
        'timers', 'tty', 'v8', 'vm', 'worker_threads', 'perf_hooks',
        'node:fs', 'node:path', 'node:os', 'node:url', 'node:http', 'node:https',
        'node:crypto', 'node:stream', 'node:util', 'node:events', 'node:buffer',
        'node:child_process', 'node:cluster', 'node:dgram', 'node:dns', 'node:net',
        'node:readline', 'node:tls', 'node:zlib', 'node:assert', 'node:querystring',
        'node:string_decoder', 'node:timers', 'node:tty', 'node:v8', 'node:vm',
        'node:worker_threads', 'node:perf_hooks', 'node:test',
      ]);

      for (const imported of importedPackages) {
        if (builtins.has(imported)) continue;
        if (declaredDeps.has(imported)) continue;

        addFinding(
          'medium',
          `Phantom dependency: "${imported}"`,
          `Package "${imported}" is imported in source code but not declared in package.json. It may be accidentally resolved from a parent node_modules. Add it explicitly or remove the import.`,
          829,
        );
      }
    }

    return {
      scanner: 'supply-chain',
      category: 'dependencies',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};

function checkInstallScripts(
  pkgPath: string,
  pkgName: string,
  addFinding: (severity: Finding['severity'], title: string, description: string, cwe: number) => void,
): void {
  const content = readFileSafe(join(pkgPath, 'package.json'));
  if (!content) return;

  let pkg: PkgScripts;
  try {
    pkg = JSON.parse(content) as PkgScripts;
  } catch {
    return;
  }

  if (pkg.scripts?.preinstall || pkg.scripts?.postinstall) {
    const scriptType = pkg.scripts.preinstall ? 'preinstall' : 'postinstall';
    addFinding(
      'medium',
      `Install script detected: "${pkgName}" (${scriptType})`,
      `Package "${pkgName}" has a ${scriptType} script that runs automatically during installation. This is a common supply chain attack vector. Script: "${pkg.scripts[scriptType]}".`,
      829,
    );
  }
}
