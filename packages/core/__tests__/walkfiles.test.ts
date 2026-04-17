import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { walkFiles, clearWalkFilesCache } from '../src/utils.js';

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
