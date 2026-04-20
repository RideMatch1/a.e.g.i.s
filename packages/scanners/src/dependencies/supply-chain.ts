import { readFileSafe, walkFiles } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * v0.15: known lockfile names for Check 8 (lockfile-drift detection).
 * Bun and Yarn v2+ lockfiles are out-of-scope until there's dogfood
 * signal; bun.lockb is binary (different hashing semantics).
 */
const LOCKFILE_NAMES = ['package-lock.json', 'pnpm-lock.yaml'] as const;

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

/**
 * v0.13: packages whose install-script + native-binary shape is an
 * unavoidable consequence of a parent framework, not a supply-chain
 * concern users can act on. Findings on these still emit (pedagogy —
 * the user should know their supply-chain surface) but at `info`
 * severity so they don't deduct from the score.
 *
 * Trust-root: each pattern is anchored to an exact name or a scope
 * owned by a specific upstream vendor on the npm registry. Attackers
 * cannot introduce a malicious package matching these without first
 * compromising the registry-level scope ownership.
 *
 * Drift-risk: if a framework swaps its build-tool vendor in a major
 * version (e.g. Next.js 17 moves from swc to a different compiler),
 * the replacement's platform-native packages would re-surface as
 * MEDIUM until this list is updated. Expected cadence: re-audit per
 * major Next.js / Rollup / esbuild upgrade.
 */
const ECOSYSTEM_INHERENT_PATTERNS: readonly RegExp[] = [
  /^esbuild$/,                       // postinstall — ecosystem-standard build tool
  /^@next\/swc-[a-z0-9-]+$/,         // Next.js SWC platform-native compiler
  /^@rollup\/rollup-[a-z0-9-]+$/,    // Rollup platform-native binary (transitive via Next.js / Vite)
];

function isEcosystemInherent(pkgName: string): boolean {
  return ECOSYSTEM_INHERENT_PATTERNS.some((p) => p.test(pkgName));
}

const ECOSYSTEM_INHERENT_NOTE =
  ' Ecosystem-inherent pattern; unavoidable without removing the parent framework. Informational only.';

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
 *
 * Returns null for:
 *   - Relative/absolute imports: './x', '../x', '/x'
 *   - TypeScript path aliases: '@/x', '~/x', '#x'
 *     (common tsconfig paths conventions — these resolve to local
 *     directories, not npm packages)
 */
function extractPackageName(specifier: string): string | null {
  // Skip relative/absolute imports
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;

  // v0.9 polish: skip TypeScript path aliases — these are tsconfig.paths
  // mappings to local directories (e.g. "@/lib/*" → "./src/lib/*"), not
  // npm package specifiers. Treating them as phantom deps produces a
  // flood of noise in any modern Next.js / TS codebase.
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) return null;
  if (specifier.startsWith('#')) return null;   // Node.js subpath-imports convention
  if (specifier === '@' || specifier === '~') return null;

  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }

  return specifier.split('/')[0];
}

/**
 * v0.9 polish: valid-npm-package-name check. npm names are lowercase-
 * ASCII with dots/underscores/hyphens, optionally scoped. Rejecting
 * non-conforming captures eliminates regex-noise phantom findings like
 * "pkg" (template-literal variable), "vscode" (VS Code runtime module),
 * and multi-line-import garbage.
 *
 * Per npm rules — the name itself matches:
 *   - Unscoped:  [a-z0-9][a-z0-9._-]{0,213}
 *   - Scoped:    @<scope>/<name> with the same char class in both halves
 * No uppercase, no spaces, no punctuation outside the char class.
 */
export function isValidNpmPackageName(name: string): boolean {
  if (name.length === 0 || name.length > 214) return false;
  // Scoped
  if (name.startsWith('@')) {
    const m = name.match(/^@([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)$/);
    return m !== null;
  }
  // Unscoped
  return /^[a-z0-9][a-z0-9._-]*$/.test(name);
}

/**
 * v0.9 polish: discover workspace package names from pnpm-workspace.yaml
 * (or package.json workspaces field). Returns both the `name` of each
 * workspace sub-package AND every declared dep in each sub-package, so
 * a monorepo root scan does not flag sub-package runtime deps (ora,
 * chalk, etc. declared in packages/cli/package.json) as phantoms.
 *
 * Supports:
 *   - pnpm-workspace.yaml with packages: [ 'packages/*', 'apps/*' ]
 *   - package.json "workspaces": [ ... ] (npm / yarn classic)
 *   - package.json "workspaces.packages": [ ... ] (yarn berry)
 */
function discoverWorkspaceDeps(projectPath: string): {
  workspaceNames: Set<string>;
  subPackageDeps: Set<string>;
} {
  const workspaceNames = new Set<string>();
  const subPackageDeps = new Set<string>();
  const globs: string[] = [];

  const wsYaml = readFileSafe(join(projectPath, 'pnpm-workspace.yaml'));
  if (wsYaml !== null) {
    const lines = wsYaml.split('\n');
    let inPkg = false;
    for (const raw of lines) {
      const ln = raw.replace(/#.*$/, '');
      if (/^packages\s*:/.test(ln.trim())) { inPkg = true; continue; }
      if (inPkg) {
        if (/^\S/.test(ln) && ln.trim() !== '') break;
        const m = ln.match(/^\s*-\s*['"]?([^'"\s]+)['"]?/);
        if (m) globs.push(m[1]);
      }
    }
  }

  const rootPkg = readFileSafe(join(projectPath, 'package.json'));
  if (rootPkg !== null) {
    try {
      const parsed = JSON.parse(rootPkg) as {
        workspaces?: string[] | { packages?: string[] };
      };
      const ws = parsed.workspaces;
      if (Array.isArray(ws)) globs.push(...ws);
      else if (ws && Array.isArray(ws.packages)) globs.push(...ws.packages);
    } catch {
      // ignore malformed package.json
    }
  }

  for (const glob of globs) {
    const parts = glob.split('/');
    if (parts.length !== 2 || parts[1] !== '*') continue;
    const dir = join(projectPath, parts[0]);
    if (!existsSync(dir)) continue;
    try {
      for (const child of readdirSync(dir)) {
        const childPkgPath = join(dir, child, 'package.json');
        const childPkg = readFileSafe(childPkgPath);
        if (childPkg === null) continue;
        try {
          const j = JSON.parse(childPkg) as {
            name?: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
          };
          if (j.name) workspaceNames.add(j.name);
          for (const depKey of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
            const deps = j[depKey];
            if (deps) for (const dep of Object.keys(deps)) subPackageDeps.add(dep);
          }
        } catch {
          // ignore malformed sub package.json
        }
      }
    } catch {
      // ignore unreadable dir
    }
  }

  return { workspaceNames, subPackageDeps };
}

/** Legacy alias kept for any external callers that relied on the prior export-less helper shape. */
function discoverWorkspacePackages(projectPath: string): Set<string> {
  return discoverWorkspaceDeps(projectPath).workspaceNames;
}

/**
 * v0.15: exact-pin detection for `scanners.supplyChain.criticalDeps`.
 *
 * Returns true only when the version string denotes a single specific
 * release — `"16.0.0"`, `"16.0.0-rc.1"`, `"=16.0.0"`, or an npm-alias
 * whose target is itself exact (`"npm:other@16.0.0"`). Everything else
 * is a range / selector and counts as non-exact: caret, tilde,
 * comparator-range, hyphen-range, x-range, `"latest"`, `"*"`, empty
 * string, disjunction (`||`), etc.
 *
 * The alias-discriminator is the version after the last `@`, not the
 * alias target. `"npm:other@16.0.0"` IS exact (aliased-exact); the
 * compromise risk is bounded by the exact pin regardless of which
 * package name is used at install time. `"npm:other@^16.0.0"` is NOT.
 */
function isExactVersion(raw: string): boolean {
  let version = raw.trim();
  if (version.startsWith('npm:')) {
    const atIdx = version.lastIndexOf('@');
    if (atIdx > 4) return isExactVersion(version.slice(atIdx + 1));
    return false;
  }
  // Leading '=' is explicit-equality; still exact if the rest is exact.
  if (version.startsWith('=')) version = version.slice(1).trim();
  if (version === '' || version === '*' || version === 'latest') return false;
  // Any other leading comparator → range, non-exact
  if (/^[\^~><]/.test(version)) return false;
  // Whitespace → hyphen-range ("1.0.0 - 2.0.0") or alternation
  if (/\s/.test(version)) return false;
  if (version.includes('||')) return false;
  // x-ranges: "16.x" / "16.*" / leading x/*
  if (/[.\-][xX*]/.test(version) || /^[xX*]/.test(version)) return false;
  // Fully-specified N.N.N with optional prerelease/build metadata
  return /^\d+\.\d+\.\d+(?:[-+][0-9a-zA-Z.+-]+)?$/.test(version);
}

/**
 * v0.15: read `scanners.supplyChain.criticalDeps` defensively.
 *
 * Zod validation already strips malformed data at config-load (see
 * `packages/core/src/config.ts` — SupplyChainScannerConfigSchema with
 * `.strict()`). This runtime read is defensive for callers that build
 * an `AegisConfig` in-memory without going through the Zod pipeline
 * (benchmark harnesses, direct-programmatic-use, tests).
 */
function readCriticalDeps(config: AegisConfig): readonly string[] {
  const rec = config.scanners?.supplyChain;
  if (!rec || typeof rec !== 'object') return [];
  const raw = (rec as Record<string, unknown>).criticalDeps;
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is string => typeof d === 'string' && d.length > 0);
}

export const supplyChainScanner: Scanner = {
  name: 'supply-chain',
  description: 'Supply chain security analysis — typosquatting, install scripts, phantom dependencies, and more',
  category: 'dependencies',

  async isAvailable(_projectPath: string): Promise<boolean> {
    // Pure file-based scanner — always available
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
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

    // --- Check 7: criticalDeps enforcement (v0.15) ---
    // Packages listed in scanners.supplyChain.criticalDeps must use an
    // exact-pin version in package.json. Non-exact versions (caret,
    // tilde, ranges, "latest", "*", empty, x-ranges) emit HIGH/CWE-494.
    // CWE-494 is distinct from CWE-829 used by Check 4 so both can
    // coexist on "latest"-style values without colliding in canary
    // RED-baseline interpretation.
    if (pkgJson) {
      const criticalDeps = readCriticalDeps(config);
      for (const critDep of criticalDeps) {
        const version = allDeps[critDep];
        if (version === undefined) continue; // dep not installed
        if (isExactVersion(version)) continue;
        addFinding(
          'high',
          `Non-exact version on critical dep: "${critDep}" (${version || '(empty)'})`,
          `Dependency "${critDep}" is declared in scanners.supplyChain.criticalDeps but package.json uses a non-exact version "${version || '(empty)'}". An unpinned critical dep can resolve to a future upstream publish — including one pushed via a compromised publish-token — without triggering any in-repo review. Pin exactly (e.g. "${critDep}": "16.0.0") or drop from criticalDeps if this dep does not warrant pin-enforcement.`,
          494,
        );
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
        const inherent = isEcosystemInherent(pkgName);
        for (const entry of entries) {
          for (const ext of binaryExtensions) {
            if (entry.endsWith(ext)) {
              addFinding(
                inherent ? 'info' : 'medium',
                `Native binary in dependency: "${pkgName}/${entry}"`,
                `Package "${pkgName}" contains a native binary file "${entry}". Native binaries can execute arbitrary code and bypass JavaScript sandboxing.${inherent ? ECOSYSTEM_INHERENT_NOTE : ''}`,
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
      // v0.9 polish: merge user's config.ignore with the built-in walker
      // ignore list. Previously the scanner walked into directories the
      // user had explicitly excluded (e.g. benchmark/vulnerable-app) and
      // produced phantom findings for their private deps.
      const walkerIgnore = [
        ...new Set([
          'node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage',
          ...(config.ignore ?? []),
        ]),
      ];
      const sourceFiles = walkFiles(
        projectPath,
        walkerIgnore,
        ['ts', 'tsx', 'js', 'jsx'],
      );

      const declaredDeps = new Set(Object.keys(allDeps));
      // v0.9 polish: include workspace-provided packages AND the deps
      // declared inside each workspace sub-package.json in the declared
      // set, so monorepo cross-package imports (@aegis-scan/core) and
      // sub-package runtime deps (ora, chalk, commander declared in
      // packages/cli/package.json) do not register as phantoms.
      const { workspaceNames, subPackageDeps } = discoverWorkspaceDeps(projectPath);
      for (const name of workspaceNames) declaredDeps.add(name);
      for (const dep of subPackageDeps) declaredDeps.add(dep);
      const importedPackages = new Set<string>();

      const importPatterns = [
        // import ... from 'pkg' or import 'pkg'
        /(?:import\s+(?:[\s\S]*?\s+from\s+)?['"])([^'"./][^'"]*)['"]/g,
        // require('pkg')
        /require\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
      ];

      for (const file of sourceFiles) {
        const rawContent = readFileSafe(file);
        if (!rawContent) continue;

        // v0.9 polish: strip line comments before running the import
        // regex. Without this, documentation comments inside AEGIS's
        // own supply-chain scanner (e.g. `// require('pkg')`) are
        // captured as phantom-dep imports. Block comments stripped
        // best-effort; import-like strings inside intentional block
        // comments remain a minor edge case.
        const content = rawContent
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');

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

      // Built-in Node.js modules + host-provided ambient runtimes to exclude
      const builtins = new Set([
        // v0.9 polish: common ambient modules provided by host runtimes
        // (not npm packages; resolved by the host at runtime).
        'vscode',       // VS Code Extension API
        'electron',     // Electron main/renderer
        'atom',         // Atom editor API (legacy but still shipped in some codebases)
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
        // v0.9 polish: reject captures that aren't valid npm package
        // names — these come from multi-line import regex false-matches
        // ("pkg" as template-literal variable, "vscode" ambient runtime,
        // concat fragments like ") || line.includes(").
        if (!isValidNpmPackageName(imported)) continue;

        addFinding(
          'medium',
          `Phantom dependency: "${imported}"`,
          `Package "${imported}" is imported in source code but not declared in package.json. It may be accidentally resolved from a parent node_modules. Add it explicitly or remove the import.`,
          829,
        );
      }
    }

    // --- Check 8: Lockfile-drift detection (v0.15) ---
    // Compare sha256 of each present lockfile (package-lock.json /
    // pnpm-lock.yaml) against the baseline stored at
    // `.aegis/lockfile-hash`. Emits MEDIUM on drift, INFO when the
    // baseline is missing but a lockfile exists (recommend seeding),
    // and MEDIUM when the baseline itself is malformed. No-op when
    // neither a lockfile nor a baseline exist — projects without an
    // npm-lockfile workflow don't get spurious findings.
    //
    // Baseline format: one `sha256:<64-hex>  <filename>` per line.
    // Lines starting with `#` and blank lines are skipped. The format
    // is `shasum -a 256` output-compatible so users can seed the
    // baseline via `shasum -a 256 package-lock.json > .aegis/lockfile-hash`.
    //
    // CWE-353 (Missing Support for Integrity Check) is distinct from
    // CWE-494 (criticalDeps, Check 7) and CWE-829 (wildcard, Check 4)
    // so the three coexist without canary-RED-baseline collision.
    //
    // v0.15 P1 scope: baseline-entry → disk-file-hash comparison only.
    // Out-of-scope (v0.16): baseline-references-missing-file,
    // disk-lockfile-not-in-baseline. Both are silently tolerated here.
    const presentLockfiles: Array<{ name: string; content: string }> = [];
    for (const lockName of LOCKFILE_NAMES) {
      const lockContent = readFileSafe(join(projectPath, lockName));
      if (lockContent !== null) {
        presentLockfiles.push({ name: lockName, content: lockContent });
      }
    }
    const baselineContent = readFileSafe(join(projectPath, '.aegis', 'lockfile-hash'));

    if (presentLockfiles.length === 0 && baselineContent === null) {
      // No-op: project has no lockfile workflow.
    } else if (baselineContent === null) {
      // Lockfile(s) present but no baseline: recommend seeding.
      addFinding(
        'info',
        'Lockfile-drift baseline not seeded',
        `Lockfile(s) found (${presentLockfiles.map((l) => l.name).join(', ')}) but .aegis/lockfile-hash is missing. Seed the baseline by committing the sha256 digest of each lockfile (one "sha256:<64-hex>  <filename>" line per file; shasum -a 256 output is compatible). Subsequent scans will detect tampering or unreviewed dep-updates. Blank lines and lines starting with "#" are skipped.`,
        353,
      );
    } else {
      const malformedLines: string[] = [];
      const entries: Array<{ hex: string; filename: string }> = [];
      for (const rawLine of baselineContent.split('\n')) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;
        const match = line.match(/^sha256:([0-9a-f]{64})\s+(\S.*)$/i);
        if (!match) {
          malformedLines.push(line);
          continue;
        }
        entries.push({
          hex: match[1].toLowerCase(),
          filename: match[2].trim(),
        });
      }

      if (malformedLines.length > 0) {
        const preview = malformedLines.slice(0, 3).join(' | ');
        const more =
          malformedLines.length > 3
            ? ` (+${malformedLines.length - 3} more)`
            : '';
        addFinding(
          'medium',
          'Malformed .aegis/lockfile-hash baseline entry',
          `Found ${malformedLines.length} unparseable line(s) in .aegis/lockfile-hash. Expected format per line: "sha256:<64-hex>  <filename>". Unparseable: ${preview}${more}. Regenerate the baseline (e.g. shasum -a 256 package-lock.json > .aegis/lockfile-hash) or delete .aegis/lockfile-hash to disable drift-detection.`,
          353,
        );
      }

      for (const entry of entries) {
        const lock = presentLockfiles.find((l) => l.name === entry.filename);
        if (!lock) continue; // v0.15 P1: missing-file tolerated silently
        const currentHex = createHash('sha256').update(lock.content).digest('hex');
        if (currentHex !== entry.hex) {
          addFinding(
            'medium',
            `Lockfile-drift detected: "${entry.filename}"`,
            `The current sha256 of ${entry.filename} (${currentHex}) does not match the baseline recorded in .aegis/lockfile-hash (${entry.hex}). Typical cause: the lockfile was modified since the baseline-commit. Review dep-changes, then re-seed the baseline when confirmed safe (e.g. shasum -a 256 ${entry.filename} > .aegis/lockfile-hash). A compromised publish-token silently bumping a dep would fire this check on the next scan.`,
            353,
          );
        }
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
    const inherent = isEcosystemInherent(pkgName);
    addFinding(
      inherent ? 'info' : 'medium',
      `Install script detected: "${pkgName}" (${scriptType})`,
      `Package "${pkgName}" has a ${scriptType} script that runs automatically during installation. This is a common supply chain attack vector. Script: "${pkg.scripts[scriptType]}".${inherent ? ECOSYSTEM_INHERENT_NOTE : ''}`,
      829,
    );
  }
}
