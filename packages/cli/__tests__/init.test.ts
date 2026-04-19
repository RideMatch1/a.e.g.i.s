/**
 * Unit + integration tests for `aegis init` — v0.12 extension.
 *
 * Covers:
 *   - Baseline: empty dir → 4 files written (config + workflow + CLAUDE.md + pre-push)
 *   - Skip-if-exists default + per-file --force overwrite
 *   - Per-file --skip-ci / --skip-claude / --skip-husky flags
 *   - Husky pre-push mode 0o755 (POSIX only)
 *   - AEGIS_VERSION + PROJECT_NAME substitution in workflow + CLAUDE.md
 *   - Partial-write preserves successful writes (no rollback of user files)
 *   - Pre-existing aegis.config.json generation path is unregressed
 *
 * We build a minimal fixture template tree in a tmpdir and inject its
 * parent into `runInit` via the `_templateSearchPaths` internal option —
 * same pattern used by `new.test.ts`, so the test never touches the
 * real `templates/nextjs-supabase/` payload.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  statSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit, EXIT_OK, EXIT_WRITE_FAILURE } from '../src/commands/init.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers

/**
 * Build a minimal "nextjs-supabase" fixture template under `basesDir`
 * containing only the 3 files init consumes. Returns the template root.
 */
function createInitFixtureTemplate(basesDir: string): string {
  const root = join(basesDir, 'nextjs-supabase');
  const filesDir = join(root, 'files');
  mkdirSync(join(filesDir, '.github', 'workflows'), { recursive: true });

  // template.json — required by resolveTemplateRoot + schema-minimal.
  writeFileSync(
    join(root, 'template.json'),
    JSON.stringify({
      name: 'nextjs-supabase',
      stack: 'nextjs-supabase',
      aegisVersion: '0.12.0',
      description: 'init-test fixture template',
      placeholders: ['PROJECT_NAME', 'AEGIS_VERSION'],
      postInstall: { scan: false, scanExpectedScore: 1000, scanExpectedGrade: 'A' },
    }),
  );

  // Workflow with a unique sentinel line so we can prove the init write
  // actually went through the template path (and not some inline fallback).
  writeFileSync(
    join(filesDir, '.github', 'workflows', 'aegis.yml'),
    [
      'name: AEGIS',
      '# fixture-sentinel: workflow',
      'jobs:',
      '  aegis:',
      '    uses: RideMatch1/a.e.g.i.s/ci/github-action@v{{AEGIS_VERSION}}',
      '    # version-echo: {{AEGIS_VERSION}}',
      '',
    ].join('\n'),
  );

  // CLAUDE.md with both placeholders (primary source has these — see task brief).
  writeFileSync(
    join(filesDir, 'CLAUDE.md'),
    [
      '# {{PROJECT_NAME}} — Project Instructions',
      '',
      'Scaffolded with AEGIS v{{AEGIS_VERSION}}.',
      '',
      'fixture-sentinel: claude-md',
      '',
    ].join('\n'),
  );

  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tempdir lifecycle

let tmpBase: string;
let templateBases: string;
let targetDir: string;

/**
 * v0.13 N1: init now requires husky setup (devDep + prepare-script) before
 * writing `.husky/pre-push`. The baseline tests below assume both signals
 * are present; individual tests that exercise the skip/hint path overwrite
 * this package.json to simulate an un-set-up project.
 */
function seedHuskyReadyPackageJson(dir: string): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'my-project',
      devDependencies: { husky: '^9.0.0' },
      scripts: { prepare: 'husky install' },
    }),
  );
}

beforeEach(() => {
  tmpBase = mkdtempSync(join(tmpdir(), 'aegis-init-test-'));
  templateBases = join(tmpBase, 'templates-base');
  mkdirSync(templateBases, { recursive: true });
  createInitFixtureTemplate(templateBases);
  targetDir = join(tmpBase, 'my-project');
  mkdirSync(targetDir, { recursive: true });
  seedHuskyReadyPackageJson(targetDir);
});

afterEach(() => {
  if (tmpBase && existsSync(tmpBase)) {
    // chmod-restore anything we may have 0000'd for partial-write tests
    // (best effort — rmSync({force:true}) handles the rest).
    try {
      chmodSync(join(targetDir, '.husky'), 0o755);
    } catch {
      /* ignore */
    }
    rmSync(tmpBase, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Console capture — suppresses init's chatty output + lets tests assert
// specific log lines.

let logs: string[];
let errs: string[];
let originalLog: typeof console.log;
let originalErr: typeof console.error;

beforeEach(() => {
  logs = [];
  errs = [];
  originalLog = console.log;
  originalErr = console.error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log = (...args: any[]) => logs.push(args.map(String).join(' '));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => errs.push(args.map(String).join(' '));
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalErr;
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests

describe('runInit — baseline behavior', () => {
  it('writes config + workflow + CLAUDE.md + husky pre-push into an empty target', async () => {
    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);

    // All 4 files exist
    expect(existsSync(join(targetDir, 'aegis.config.json'))).toBe(true);
    expect(existsSync(join(targetDir, '.github', 'workflows', 'aegis.yml'))).toBe(true);
    expect(existsSync(join(targetDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(true);

    // Config still has the pre-existing shape (detectStack output)
    const cfg = JSON.parse(readFileSync(join(targetDir, 'aegis.config.json'), 'utf-8')) as {
      stack: unknown;
      ignore: string[];
    };
    expect(cfg.stack).toBeTruthy();
    expect(cfg.ignore).toContain('node_modules/**');

    // Husky hook is the exact expected inline payload
    expect(readFileSync(join(targetDir, '.husky', 'pre-push'), 'utf-8')).toBe(
      '#!/bin/sh\nnpx aegis scan --fail-on-blocker\n',
    );
  });

  it('substitutes AEGIS_VERSION into the workflow file (no literal {{...}})', async () => {
    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);

    const wf = readFileSync(join(targetDir, '.github', 'workflows', 'aegis.yml'), 'utf-8');
    // Literal placeholder must NOT survive
    expect(wf).not.toMatch(/\{\{AEGIS_VERSION\}\}/);
    // Must contain the real semver from @aegis-scan/cli package.json
    expect(wf).toMatch(/@v\d+\.\d+\.\d+/);
    // Fixture sentinel still present — proves we copied from the template
    expect(wf).toContain('fixture-sentinel: workflow');
  });

  it('substitutes PROJECT_NAME=basename(targetDir) + AEGIS_VERSION into CLAUDE.md', async () => {
    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);

    const claude = readFileSync(join(targetDir, 'CLAUDE.md'), 'utf-8');
    // basename of `<tmp>/my-project` is `my-project`
    expect(claude).toContain('# my-project — Project Instructions');
    expect(claude).not.toMatch(/\{\{PROJECT_NAME\}\}/);
    expect(claude).not.toMatch(/\{\{AEGIS_VERSION\}\}/);
    expect(claude).toMatch(/Scaffolded with AEGIS v\d+\.\d+\.\d+/);
  });

  it('existing behavior preserved — aegis.config.json still written even without flags', async () => {
    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);
    const cfg = readFileSync(join(targetDir, 'aegis.config.json'), 'utf-8');
    expect(cfg).toContain('"stack"');
    expect(cfg).toContain('"ignore"');
    expect(cfg).toContain('"scanners"');
  });
});

describe('runInit — skip-if-exists default + --force', () => {
  it('skips an existing CLAUDE.md without --force + logs an informational warning', async () => {
    const sentinel = '# hand-written — do not touch\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), sentinel);

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);

    // Sentinel content unchanged — user-owned file preserved.
    expect(readFileSync(join(targetDir, 'CLAUDE.md'), 'utf-8')).toBe(sentinel);
    // Skip log surfaced
    expect(logs.join('\n')).toMatch(/Skipping .*CLAUDE\.md.*exists/);
  });

  it('overwrites an existing CLAUDE.md when --force is set + logs a warning', async () => {
    writeFileSync(join(targetDir, 'CLAUDE.md'), '# old content\n');

    const exit = await runInit(targetDir, {
      force: true,
      _templateSearchPaths: [templateBases],
    });
    expect(exit).toBe(EXIT_OK);

    const claude = readFileSync(join(targetDir, 'CLAUDE.md'), 'utf-8');
    // Rewritten from the template
    expect(claude).toContain('# my-project — Project Instructions');
    expect(claude).not.toContain('# old content');
    // Warning log surfaced
    expect(logs.join('\n')).toMatch(/Overwrote existing .*CLAUDE\.md.*--force/);
  });
});

describe('runInit — per-file skip flags', () => {
  it('--skip-ci does not write .github/workflows/aegis.yml', async () => {
    const exit = await runInit(targetDir, {
      skipCi: true,
      _templateSearchPaths: [templateBases],
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.github', 'workflows', 'aegis.yml'))).toBe(false);
    // But the other two still wrote
    expect(existsSync(join(targetDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(true);
  });

  it('--skip-claude does not write CLAUDE.md', async () => {
    const exit = await runInit(targetDir, {
      skipClaude: true,
      _templateSearchPaths: [templateBases],
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(targetDir, '.github', 'workflows', 'aegis.yml'))).toBe(true);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(true);
  });

  it('--skip-husky does not write .husky/pre-push', async () => {
    const exit = await runInit(targetDir, {
      skipHusky: true,
      _templateSearchPaths: [templateBases],
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);
    expect(existsSync(join(targetDir, '.github', 'workflows', 'aegis.yml'))).toBe(true);
    expect(existsSync(join(targetDir, 'CLAUDE.md'))).toBe(true);
  });
});

describe('runInit — husky pre-push mode', () => {
  it('sets mode 0o755 on .husky/pre-push (POSIX)', async () => {
    if (process.platform === 'win32') return;

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);

    const mode = statSync(join(targetDir, '.husky', 'pre-push')).mode & 0o777;
    expect(mode).toBe(0o755);
  });
});

describe('runInit — partial-write preserves successful files', () => {
  it('does not roll back on a mid-loop write failure', async () => {
    if (process.platform === 'win32') return;

    // Pre-create `.husky` as an unwritable directory — pre-push write will
    // fail with EACCES, but workflow + CLAUDE.md + config should have
    // written successfully before that.
    mkdirSync(join(targetDir, '.husky'), { recursive: true });
    chmodSync(join(targetDir, '.husky'), 0o000);

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });

    // Restore perms so afterEach rmSync can proceed.
    chmodSync(join(targetDir, '.husky'), 0o755);

    expect(exit).toBe(EXIT_WRITE_FAILURE);

    // Successful writes left on disk — no rollback
    expect(existsSync(join(targetDir, 'aegis.config.json'))).toBe(true);
    expect(existsSync(join(targetDir, '.github', 'workflows', 'aegis.yml'))).toBe(true);
    expect(existsSync(join(targetDir, 'CLAUDE.md'))).toBe(true);
    // Failed write is absent
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);

    // Error log surfaced
    expect(errs.join('\n')).toMatch(/partially failed|Failed to write/);
  });
});

describe('runInit — template resolution failure', () => {
  it('returns EXIT_WRITE_FAILURE when nextjs-supabase template is absent', async () => {
    const emptyBase = mkdtempSync(join(tmpdir(), 'aegis-init-emptybase-'));
    try {
      const exit = await runInit(targetDir, { _templateSearchPaths: [emptyBase] });
      expect(exit).toBe(EXIT_WRITE_FAILURE);
      expect(errs.join('\n')).toMatch(/not found/);
    } finally {
      rmSync(emptyBase, { recursive: true, force: true });
    }
  });

  it('does not need the template when all template-backed files are skipped', async () => {
    const emptyBase = mkdtempSync(join(tmpdir(), 'aegis-init-emptybase2-'));
    try {
      const exit = await runInit(targetDir, {
        skipCi: true,
        skipClaude: true,
        _templateSearchPaths: [emptyBase],
      });
      expect(exit).toBe(EXIT_OK);
      // husky hook still wrote — inline payload needs no template
      expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(true);
      expect(existsSync(join(targetDir, 'aegis.config.json'))).toBe(true);
    } finally {
      rmSync(emptyBase, { recursive: true, force: true });
    }
  });
});

// v0.13 N1: retrofit-dogfood discovered that init blind-wrote .husky/pre-push
// even when the target project had no husky installed. The hook sat on disk
// as dead code (git's default hooksPath is .git/hooks/), giving the user
// false-confidence that a scan-gate was active when none was.
describe('runInit — husky-aware detection (v0.13 N1)', () => {
  it('skips .husky/pre-push when package.json is missing entirely', async () => {
    // Simulate a pre-configuration project root — no package.json at all.
    rmSync(join(targetDir, 'package.json'));

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);
    expect(logs.join('\n')).toMatch(/Skipping .*pre-push.*Husky not detected/);
    // Other files still wrote
    expect(existsSync(join(targetDir, 'aegis.config.json'))).toBe(true);
    expect(existsSync(join(targetDir, 'CLAUDE.md'))).toBe(true);
  });

  it('skips .husky/pre-push when husky is absent from deps (even if prepare-script mentions husky)', async () => {
    writeFileSync(
      join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'my-project',
        devDependencies: { 'lint-staged': '^15.0.0' },
        scripts: { prepare: 'husky install' }, // aspirational but no dep
      }),
    );

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);
    expect(logs.join('\n')).toMatch(/Husky not detected/);
  });

  it('skips .husky/pre-push when prepare-script is missing', async () => {
    writeFileSync(
      join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'my-project',
        devDependencies: { husky: '^9.0.0' },
        scripts: { build: 'tsc' }, // no prepare script at all
      }),
    );

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);
    expect(logs.join('\n')).toMatch(/Husky not detected/);
  });

  it('skips .husky/pre-push when prepare-script does not mention husky', async () => {
    writeFileSync(
      join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'my-project',
        devDependencies: { husky: '^9.0.0' },
        scripts: { prepare: 'lint-staged' }, // prepare exists but wrong tool
      }),
    );

    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);
    expect(logs.join('\n')).toMatch(/Husky not detected/);
  });

  it('writes .husky/pre-push when BOTH husky dep and prepare-script with "husky" are present', async () => {
    // beforeEach seeded husky-ready state — this asserts the positive path.
    const exit = await runInit(targetDir, { _templateSearchPaths: [templateBases] });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(true);
    // Hint must NOT appear when husky is ready
    expect(logs.join('\n')).not.toMatch(/Husky not detected/);
  });

  it('--force does not bypass husky detection — precondition still applies', async () => {
    // Even with --force, writing a dead-code hook is silent-bad.
    rmSync(join(targetDir, 'package.json'));

    const exit = await runInit(targetDir, {
      force: true,
      _templateSearchPaths: [templateBases],
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, '.husky', 'pre-push'))).toBe(false);
    expect(logs.join('\n')).toMatch(/Husky not detected/);
  });
});
