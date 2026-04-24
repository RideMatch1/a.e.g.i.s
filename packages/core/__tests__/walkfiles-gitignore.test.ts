/**
 * v0.17.3 SC-1 — walkFiles honors .gitignore (dogfood-paradox structural fix).
 *
 * walkFiles(dir, ignore, extensions, opts = { respectGitignore: true }):
 *   - loads rootDir/.gitignore and treats its patterns per gitignore(5) spec
 *     via the `ignore` npm package
 *   - composes child .gitignore files encountered during walk (a file is
 *     filtered if the root OR any ancestor matcher ignores it)
 *   - honors negation rules (`!pattern`)
 *   - directory-only patterns (trailing `/`) prune the walk early for dirs
 *   - opts.respectGitignore = false preserves full-walk behavior for
 *     scanner-internal tests that rely on it
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { walkFiles, clearWalkFilesCache } from '../src/utils.js';

describe('walkFiles — .gitignore awareness (v0.17.3 SC-1)', () => {
  let root: string;

  beforeEach(() => {
    clearWalkFilesCache();
    root = mkdtempSync(join(tmpdir(), 'aegis-walkfiles-gitignore-'));
  });

  function mkfile(rel: string, content = ''): void {
    const parts = rel.split('/');
    mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }

  it('skips gitignored files at root (directory pattern)', () => {
    mkfile('.gitignore', 'aegis-precision/\n');
    mkfile('aegis-precision/ark676-engagement-2026-04/bundle.js', 'var x;');
    mkfile('src/app/page.ts', 'const x = 1;');

    const files = walkFiles(root, [], ['ts', 'js']);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
    expect(files.some((f) => f.includes('aegis-precision'))).toBe(false);
  });

  it('skips gitignored files at root (file glob pattern)', () => {
    mkfile('.gitignore', '*.log\n');
    mkfile('debug.log', 'LOG');
    mkfile('src/app/page.ts', 'const x = 1;');

    const files = walkFiles(root, [], ['ts', 'log']);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('debug.log'))).toBe(false);
  });

  it('honors negation rules (!pattern)', () => {
    mkfile('.gitignore', '*.log\n!important.log\n');
    mkfile('trash.log', 'TRASH');
    mkfile('important.log', 'IMPORTANT');

    const files = walkFiles(root, [], ['log']);
    expect(files.some((f) => f.endsWith('important.log'))).toBe(true);
    expect(files.some((f) => f.endsWith('trash.log'))).toBe(false);
  });

  it('composes child .gitignore with root .gitignore', () => {
    // root ignores *.tmp everywhere; subdir additionally ignores foo.txt
    mkfile('.gitignore', '*.tmp\n');
    mkfile('subdir/.gitignore', 'foo.txt\n');
    mkfile('subdir/foo.txt', 'FOO');
    mkfile('subdir/bar.txt', 'BAR');
    mkfile('subdir/junk.tmp', 'TMP');
    mkfile('root.ok.ts', 'ok');

    const files = walkFiles(root, [], ['txt', 'tmp', 'ts']);
    expect(files.some((f) => f.endsWith('root.ok.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('bar.txt'))).toBe(true);
    expect(files.some((f) => f.endsWith('foo.txt'))).toBe(false);
    expect(files.some((f) => f.endsWith('junk.tmp'))).toBe(false);
  });

  it('opts.respectGitignore = false walks everything regardless of .gitignore', () => {
    mkfile('.gitignore', 'aegis-precision/\n');
    mkfile('aegis-precision/should-be-seen.ts', 'const x = 1;');
    mkfile('src/app/page.ts', 'const y = 1;');

    const files = walkFiles(root, [], ['ts'], { respectGitignore: false });
    expect(files.some((f) => f.includes('aegis-precision/should-be-seen.ts'))).toBe(true);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
  });

  it('default behavior (no opts) respects .gitignore (BC-safe default)', () => {
    mkfile('.gitignore', 'aegis-precision/\n');
    mkfile('aegis-precision/x.ts', 'const x = 1;');
    mkfile('src/app/page.ts', 'const y = 1;');

    // Call without 4th arg — mirrors all existing call-sites
    const files = walkFiles(root, [], ['ts']);
    expect(files.some((f) => f.includes('aegis-precision'))).toBe(false);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
  });

  it('gracefully handles missing .gitignore (no-op, no throw)', () => {
    // No .gitignore at all
    mkfile('src/app/page.ts', 'const x = 1;');

    const files = walkFiles(root, [], ['ts']);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
  });

  it('gracefully handles empty .gitignore (no-op)', () => {
    mkfile('.gitignore', '');
    mkfile('src/app/page.ts', 'const x = 1;');
    mkfile('debug.log', 'LOG');

    const files = walkFiles(root, [], ['ts', 'log']);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('debug.log'))).toBe(true);
  });

  it('cache-key separates respectGitignore=true vs =false (no cross-contamination)', () => {
    mkfile('.gitignore', 'secret/\n');
    mkfile('secret/x.ts', 'const x = 1;');
    mkfile('src/app/page.ts', 'const y = 1;');

    const respected = walkFiles(root, [], ['ts']);
    const unrespected = walkFiles(root, [], ['ts'], { respectGitignore: false });

    expect(respected.some((f) => f.includes('secret'))).toBe(false);
    expect(unrespected.some((f) => f.includes('secret/x.ts'))).toBe(true);
  });
});
