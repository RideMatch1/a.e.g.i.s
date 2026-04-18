/**
 * Unit + integration tests for `aegis new`.
 *
 * Integration tests build a minimal fixture template in a tmpdir (same
 * pattern as loader.test.ts) and drive `runNew` with `--skip-install`
 * so we never shell out to npm/aegis during the suite.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runNew,
  validateProjectName,
  resolveTemplateRoot,
  EXIT_OK,
  EXIT_USER_ERROR,
  EXIT_SUBSTITUTION_ERROR,
} from '../src/commands/new.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers

interface FixtureTemplateOptions {
  name?: string;
  placeholders?: string[];
  fileContents?: Record<string, string>;
}

function createFixtureTemplate(
  basesDir: string,
  templateName = 'test-tpl',
  opts: FixtureTemplateOptions = {},
): string {
  const root = join(basesDir, templateName);
  mkdirSync(join(root, 'files'), { recursive: true });
  writeFileSync(
    join(root, 'template.json'),
    JSON.stringify({
      name: opts.name ?? templateName,
      stack: 'test-stack',
      aegisVersion: '0.12.0',
      description: 'unit-test fixture template',
      placeholders: opts.placeholders ?? ['PROJECT_NAME', 'AEGIS_VERSION'],
      postInstall: { scan: false, scanExpectedScore: 1000, scanExpectedGrade: 'A' },
    }),
  );
  const defaultFiles: Record<string, string> = {
    'package.json.tpl': '{"name": "{{PROJECT_NAME}}", "aegis": "{{AEGIS_VERSION}}"}\n',
    'README.md.tpl': '# {{PROJECT_NAME}}\n\nScaffolded by AEGIS {{AEGIS_VERSION}}.\n',
    'src/index.ts': 'export const name = "static-file";\n',
  };
  const files = opts.fileContents ?? defaultFiles;
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, 'files', rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tempdir lifecycle

let tmpBase: string;

beforeEach(() => {
  tmpBase = mkdtempSync(join(tmpdir(), 'aegis-new-test-'));
});

afterEach(() => {
  if (tmpBase && existsSync(tmpBase)) {
    rmSync(tmpBase, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// validateProjectName

describe('validateProjectName', () => {
  it('accepts simple lowercase names', () => {
    expect(validateProjectName('myapp')).toEqual({ ok: true });
  });

  it('accepts names with hyphens and digits', () => {
    expect(validateProjectName('my-app-2')).toEqual({ ok: true });
  });

  it('rejects names starting with a digit', () => {
    const r = validateProjectName('2app');
    expect(r.ok).toBe(false);
  });

  it('rejects uppercase letters', () => {
    const r = validateProjectName('MyApp');
    expect(r.ok).toBe(false);
  });

  it('rejects underscores', () => {
    const r = validateProjectName('my_app');
    expect(r.ok).toBe(false);
  });

  it('rejects reserved names (test, admin, node_modules)', () => {
    expect(validateProjectName('test').ok).toBe(false);
    expect(validateProjectName('admin').ok).toBe(false);
    expect(validateProjectName('node_modules').ok).toBe(false);
  });

  it('rejects names longer than 64 characters', () => {
    const tooLong = 'a'.repeat(65);
    const r = validateProjectName(tooLong);
    expect(r.ok).toBe(false);
  });

  it('accepts exactly 64 characters', () => {
    const atLimit = 'a'.repeat(64);
    expect(validateProjectName(atLimit)).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    const r = validateProjectName('');
    expect(r.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveTemplateRoot

describe('resolveTemplateRoot', () => {
  it('returns ok:true for first candidate that contains template.json', () => {
    const a = mkdtempSync(join(tmpdir(), 'aegis-resolve-a-'));
    const b = mkdtempSync(join(tmpdir(), 'aegis-resolve-b-'));
    try {
      createFixtureTemplate(b, 'foo');
      const result = resolveTemplateRoot('foo', [a, b]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.root).toBe(join(b, 'foo'));
      }
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });

  it('returns ok:false with full candidate list when template is absent', () => {
    const a = mkdtempSync(join(tmpdir(), 'aegis-resolve-a2-'));
    const b = mkdtempSync(join(tmpdir(), 'aegis-resolve-b2-'));
    try {
      const result = resolveTemplateRoot('nope', [a, b]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.tried).toEqual([join(a, 'nope'), join(b, 'nope')]);
      }
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runNew — integration against fixture template

describe('runNew (integration with fixture template)', () => {
  let logs: string[];
  let errs: string[];
  let warns: string[];
  let originalLog: typeof console.log;
  let originalErr: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    logs = [];
    errs = [];
    warns = [];
    originalLog = console.log;
    originalErr = console.error;
    originalWarn = console.warn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log = (...args: any[]) => logs.push(args.map(String).join(' '));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error = (...args: any[]) => errs.push(args.map(String).join(' '));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.warn = (...args: any[]) => warns.push(args.map(String).join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalErr;
    console.warn = originalWarn;
  });

  it('scaffolds a full project, applies substitutions, and strips .tpl suffix', async () => {
    createFixtureTemplate(tmpBase, 'test-tpl');
    const targetDir = join(tmpBase, 'my-new-project');

    const exit = await runNew('my-new-project', {
      template: 'test-tpl',
      target: targetDir,
      skipInstall: true,
      skipScan: true,
      _templateSearchPaths: [tmpBase],
    });

    expect(exit).toBe(EXIT_OK);
    expect(existsSync(targetDir)).toBe(true);

    // .tpl suffix stripped
    const pkgPath = join(targetDir, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);
    expect(existsSync(join(targetDir, 'package.json.tpl'))).toBe(false);

    // substitutions applied
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name: string; aegis: string };
    expect(pkg.name).toBe('my-new-project');
    expect(pkg.aegis).toMatch(/^\d+\.\d+\.\d+$/);

    // static (non-.tpl) file copied verbatim
    const idxPath = join(targetDir, 'src', 'index.ts');
    expect(existsSync(idxPath)).toBe(true);
    expect(readFileSync(idxPath, 'utf-8')).toBe('export const name = "static-file";\n');

    // file-count matches manifest
    const readmePath = join(targetDir, 'README.md');
    expect(existsSync(readmePath)).toBe(true);
    expect(readFileSync(readmePath, 'utf-8')).toContain('# my-new-project');
  });

  it('handles PROJECT_NAME with hyphens correctly', async () => {
    createFixtureTemplate(tmpBase, 'test-tpl');
    const targetDir = join(tmpBase, 'multi-word-name');

    const exit = await runNew('multi-word-name', {
      template: 'test-tpl',
      target: targetDir,
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });

    expect(exit).toBe(EXIT_OK);
    const pkg = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf-8')) as { name: string };
    expect(pkg.name).toBe('multi-word-name');
  });

  it('sets mode 0644 on regular files and 0755 on .sh files', async () => {
    createFixtureTemplate(tmpBase, 'test-tpl', {
      fileContents: {
        'package.json.tpl': '{"name": "{{PROJECT_NAME}}"}\n',
        'scripts/setup.sh': '#!/bin/sh\necho hi\n',
      },
    });
    const targetDir = join(tmpBase, 'modetest');
    const exit = await runNew('modetest', {
      template: 'test-tpl',
      target: targetDir,
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_OK);

    if (process.platform !== 'win32') {
      const pkgMode = statSync(join(targetDir, 'package.json')).mode & 0o777;
      const shMode = statSync(join(targetDir, 'scripts', 'setup.sh')).mode & 0o777;
      expect(pkgMode).toBe(0o644);
      expect(shMode).toBe(0o755);
    }
  });

  it('rejects invalid name with EXIT_USER_ERROR', async () => {
    const exit = await runNew('BadName', {
      template: 'test-tpl',
      target: join(tmpBase, 'ignored'),
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_USER_ERROR);
    expect(errs.join('\n')).toMatch(/name must match|reserved/);
  });

  it('rejects reserved name "test" with EXIT_USER_ERROR', async () => {
    const exit = await runNew('test', {
      template: 'test-tpl',
      target: join(tmpBase, 'ignored'),
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_USER_ERROR);
    expect(errs.join('\n')).toMatch(/reserved/);
  });

  it('rejects non-empty target directory with EXIT_USER_ERROR', async () => {
    createFixtureTemplate(tmpBase, 'test-tpl');
    const targetDir = join(tmpBase, 'occupied');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'something.txt'), 'preexisting');

    const exit = await runNew('occupied', {
      template: 'test-tpl',
      target: targetDir,
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_USER_ERROR);
    expect(errs.join('\n')).toMatch(/not empty/);
    // user's existing file must not be touched
    expect(readFileSync(join(targetDir, 'something.txt'), 'utf-8')).toBe('preexisting');
  });

  it('reuses an empty pre-existing target directory without complaint', async () => {
    createFixtureTemplate(tmpBase, 'test-tpl');
    const targetDir = join(tmpBase, 'empty-preexist');
    mkdirSync(targetDir, { recursive: true });

    const exit = await runNew('empty-preexist', {
      template: 'test-tpl',
      target: targetDir,
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(targetDir, 'package.json'))).toBe(true);
  });

  it('returns EXIT_USER_ERROR when template cannot be found and lists candidates', async () => {
    const exit = await runNew('foo', {
      template: 'does-not-exist',
      target: join(tmpBase, 'foo'),
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_USER_ERROR);
    expect(errs.join('\n')).toMatch(/not found/);
    expect(errs.join('\n')).toMatch(/does-not-exist/);
  });

  it('returns EXIT_SUBSTITUTION_ERROR when template declares an unsupported placeholder', async () => {
    createFixtureTemplate(tmpBase, 'extra-ph', {
      placeholders: ['PROJECT_NAME', 'AEGIS_VERSION', 'UNKNOWN_ONE'],
    });
    const targetDir = join(tmpBase, 'substfail');

    const exit = await runNew('substfail', {
      template: 'extra-ph',
      target: targetDir,
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_SUBSTITUTION_ERROR);
    expect(errs.join('\n')).toMatch(/UNKNOWN_ONE/);
    // dir we created must be cleaned up
    expect(existsSync(targetDir)).toBe(false);
  });

  it('leaves unknown placeholders literal in file content (no crash)', async () => {
    createFixtureTemplate(tmpBase, 'unknown-in-file', {
      placeholders: ['PROJECT_NAME'], // declared subset
      fileContents: {
        'config.txt.tpl': 'project={{PROJECT_NAME}} mystery={{MYSTERY}}\n',
      },
    });
    const targetDir = join(tmpBase, 'unknownfile');
    const exit = await runNew('unknownfile', {
      template: 'unknown-in-file',
      target: targetDir,
      skipInstall: true,
      _templateSearchPaths: [tmpBase],
    });
    expect(exit).toBe(EXIT_OK);
    // substitute() is conservative — unknown keys stay literal
    expect(readFileSync(join(targetDir, 'config.txt'), 'utf-8')).toBe(
      'project=unknownfile mystery={{MYSTERY}}\n',
    );
  });
});
