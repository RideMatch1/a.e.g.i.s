import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { walkFiles, clearWalkFilesCache, MAX_FILE_SIZE_BYTES } from '../src/utils.js';

describe('walkFiles — v0.10 Z9 root-only ignore', () => {
  let root: string;

  beforeEach(() => {
    clearWalkFilesCache();
    root = mkdtempSync(join(tmpdir(), 'aegis-walkfiles-z9-'));
  });

  function mkfile(rel: string, content = ''): void {
    const parts = rel.split('/');
    mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }

  it('skips a directory named `public` at the project root when ignore is `/public`', () => {
    mkfile('public/monaco/bundle.js', 'var x;');
    mkfile('src/app/page.ts', 'const x = 1;');

    const files = walkFiles(root, ['/public'], ['ts', 'js']);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
    expect(files.some((f) => f.includes('public/monaco'))).toBe(false);
  });

  it('does NOT skip nested `public` directories when ignore is `/public`', () => {
    // Legitimate route path — pre-Z9 this was silently dropped because
    // `public` at any depth was in DEFAULT_IGNORE.
    mkfile('app/api/public/sync/route.ts', 'export {};');
    mkfile('src/components/public/Widget.tsx', 'export {};');

    const files = walkFiles(root, ['/public'], ['ts', 'tsx']);
    expect(files.some((f) => f.includes('app/api/public/sync/route.ts'))).toBe(true);
    expect(files.some((f) => f.includes('src/components/public/Widget.tsx'))).toBe(true);
  });

  it('still supports any-depth ignore via bare name', () => {
    mkfile('src/node_modules/pkg/index.ts', 'export {};');
    mkfile('src/app/page.ts', 'export {};');

    const files = walkFiles(root, ['node_modules'], ['ts']);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
    expect(files.some((f) => f.includes('src/app/page.ts'))).toBe(true);
  });

  it('handles a mix of root-only + any-depth ignores simultaneously', () => {
    mkfile('public/vendor.js', 'var x;');        // root-only skip via /public
    mkfile('node_modules/pkg/index.ts', '');     // any-depth skip via node_modules
    mkfile('app/api/public/route.ts', '');       // NOT skipped — nested public
    mkfile('src/file.ts', '');                    // scanned

    const files = walkFiles(root, ['/public', 'node_modules'], ['ts', 'js']);
    expect(files.some((f) => f.includes('public/vendor.js'))).toBe(false);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
    expect(files.some((f) => f.includes('app/api/public/route.ts'))).toBe(true);
    expect(files.some((f) => f.includes('src/file.ts'))).toBe(true);
  });
});

describe('walkFiles — v0.15.4 picomatch-based glob-support (D-C-001)', () => {
  let root: string;

  beforeEach(() => {
    clearWalkFilesCache();
    root = mkdtempSync(join(tmpdir(), 'aegis-walkfiles-v0154-'));
  });

  function mkfile(rel: string, content = ''): void {
    const parts = rel.split('/');
    mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }

  it('matches directory basename via wildcard glob (Templates* → Templates1, Templates2, Templates99)', () => {
    mkfile('Templates1/demo.ts', 'export {};');
    mkfile('Templates2/a.ts', 'export {};');
    mkfile('Templates99/b.ts', 'export {};');
    mkfile('src/keep.ts', 'export {};');

    const files = walkFiles(root, ['Templates*'], ['ts']);
    expect(files.some((f) => f.includes('Templates1/'))).toBe(false);
    expect(files.some((f) => f.includes('Templates2/'))).toBe(false);
    expect(files.some((f) => f.includes('Templates99/'))).toBe(false);
    expect(files.some((f) => f.includes('src/keep.ts'))).toBe(true);
  });

  it('preserves case-sensitivity — Templates* does NOT match lowercase templates', () => {
    mkfile('templates/email.ts', 'export {};');
    mkfile('Templates1/demo.ts', 'export {};');

    const files = walkFiles(root, ['Templates*'], ['ts']);
    expect(files.some((f) => f.includes('templates/email.ts'))).toBe(true);
    expect(files.some((f) => f.includes('Templates1/'))).toBe(false);
  });

  it('matches file-level globs via **/*.ext pattern (**/*.min.js ignores minified bundles)', () => {
    mkfile('vendor-assets/bundle.min.js', 'var x;');
    mkfile('a/b/c/lib.min.js', 'var y;');
    mkfile('src/app.js', 'var z;');

    const files = walkFiles(root, ['**/*.min.js'], ['js', 'ts']);
    expect(files.some((f) => f.includes('bundle.min.js'))).toBe(false);
    expect(files.some((f) => f.includes('lib.min.js'))).toBe(false);
    expect(files.some((f) => f.includes('src/app.js'))).toBe(true);
  });

  it('treats literal-string patterns exactly (no behavior change from pre-v0.15.4 Set.has semantic)', () => {
    mkfile('node_modules/pkg/index.ts', 'export {};');
    mkfile('.next/cache/entry.ts', 'export {};');
    mkfile('src/file.ts', 'export {};');

    const files = walkFiles(root, ['node_modules', '.next'], ['ts']);
    expect(files.some((f) => f.includes('node_modules/'))).toBe(false);
    expect(files.some((f) => f.includes('.next/'))).toBe(false);
    expect(files.some((f) => f.includes('src/file.ts'))).toBe(true);
  });

  it('matches any-depth nested glob — Templates* at depth > 1', () => {
    mkfile('packages/pkg-a/Templates1/foo.ts', 'export {};');
    mkfile('apps/web/Templates7/bar.ts', 'export {};');
    mkfile('src/real.ts', 'export {};');

    const files = walkFiles(root, ['Templates*'], ['ts']);
    expect(files.some((f) => f.includes('packages/pkg-a/Templates1/'))).toBe(false);
    expect(files.some((f) => f.includes('apps/web/Templates7/'))).toBe(false);
    expect(files.some((f) => f.includes('src/real.ts'))).toBe(true);
  });

  it('supports mixed literal + glob patterns in a single ignore-list', () => {
    mkfile('node_modules/pkg.ts', 'export {};');       // literal
    mkfile('Templates1/demo.ts', 'export {};');         // glob: Templates*
    mkfile('vendor-assets/lib.min.js', 'var x;');       // glob: **/*.min.js
    mkfile('third_party/cfg.ts', 'export {};');         // literal
    mkfile('src/keep.ts', 'export {};');                 // kept

    const files = walkFiles(
      root,
      ['node_modules', 'Templates*', '**/*.min.js', 'third_party'],
      ['ts', 'js'],
    );
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
    expect(files.some((f) => f.includes('Templates1/'))).toBe(false);
    expect(files.some((f) => f.includes('lib.min.js'))).toBe(false);
    expect(files.some((f) => f.includes('third_party/'))).toBe(false);
    expect(files.some((f) => f.includes('src/keep.ts'))).toBe(true);
  });
});

describe('walkFiles — v0.15.4 size-cap (D-N-004)', () => {
  let root: string;

  beforeEach(() => {
    clearWalkFilesCache();
    root = mkdtempSync(join(tmpdir(), 'aegis-walkfiles-sizecap-'));
  });

  function mkfileSized(rel: string, sizeBytes: number): void {
    const parts = rel.split('/');
    mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(root, rel), Buffer.alloc(sizeBytes));
  }

  it('skips files larger than MAX_FILE_SIZE_BYTES (2 MiB)', () => {
    mkfileSized('src/huge-bundle.js', MAX_FILE_SIZE_BYTES + 1);
    mkfileSized('src/app.ts', 100);

    const files = walkFiles(root, [], ['ts', 'js']);
    expect(files.some((f) => f.includes('huge-bundle.js'))).toBe(false);
    expect(files.some((f) => f.includes('app.ts'))).toBe(true);
  });

  it('includes files exactly at the MAX_FILE_SIZE_BYTES boundary', () => {
    mkfileSized('src/boundary.js', MAX_FILE_SIZE_BYTES);

    const files = walkFiles(root, [], ['js']);
    expect(files.some((f) => f.includes('boundary.js'))).toBe(true);
  });

  it('includes typical source files well below the cap', () => {
    mkfileSized('src/small.ts', 10 * 1024);
    mkfileSized('src/medium.ts', 500 * 1024);

    const files = walkFiles(root, [], ['ts']);
    expect(files.some((f) => f.includes('small.ts'))).toBe(true);
    expect(files.some((f) => f.includes('medium.ts'))).toBe(true);
  });

  it('scope-guard — size-cap does not affect ignore-pattern logic', () => {
    mkfileSized('node_modules/huge.js', MAX_FILE_SIZE_BYTES + 1);
    mkfileSized('src/app.ts', 100);

    const files = walkFiles(root, ['node_modules'], ['ts', 'js']);
    // node_modules skipped via ignore-filter before size-check ever runs
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
    expect(files.some((f) => f.includes('app.ts'))).toBe(true);
  });
});
