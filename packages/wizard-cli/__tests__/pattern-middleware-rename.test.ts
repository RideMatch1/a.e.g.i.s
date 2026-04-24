/**
 * Commit 5 (D-NX-01) — Next.js 16 middleware → proxy rename.
 *
 * Two layers of assertion:
 *   - pattern body in docs/patterns/foundation/middleware-hardened.md emits
 *     the new `proxy.ts` file-name and `export function proxy` declaration.
 *   - brief-renderer Phase 2 step 1 output references `proxy.ts`, not
 *     `middleware.ts`, in both terse + verbose tones.
 *
 * The framework keeps backward-compat for `middleware.ts`+`export function
 * middleware`, so this is a forward-correctness pass: scaffolds emit the
 * new idiom; existing projects do not need to migrate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderBuildOrder, renderBuildOrderVerbose } from '../src/brief/sections.js';
import type { LoadedPattern } from '../src/patterns/loader.js';

const PATTERN_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'patterns',
  'foundation',
  'middleware-hardened.md',
);

const I18N_PATTERN_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'patterns',
  'foundation',
  'i18n-next-intl.md',
);

function buildPattern(name: string): LoadedPattern {
  return {
    frontmatter: {
      name,
      category: 'foundation',
      title: `foundation/${name}`,
      description: 'Test pattern stub long enough to satisfy frontmatter.',
      version: 1,
      dependencies: { npm: [], shadcn: [], supabase: [] },
      placeholders: [],
      brief_section: 'Foundation',
      tags: [],
      related: [],
      conflicts_with: [],
      aegis_scan_baseline: 960,
      deprecated: false,
    },
    body: '# body',
    sourcePath: `/tmp/${name}.md`,
    relativePath: `foundation/${name}.md`,
  };
}

const SAAS_STARTER: LoadedPattern[] = [
  buildPattern('multi-tenant-supabase'),
  buildPattern('auth-supabase-full'),
  buildPattern('rbac-requirerole'),
  buildPattern('middleware-hardened'),
  buildPattern('logger-pii-safe'),
  buildPattern('i18n-next-intl'),
];

describe('middleware-hardened pattern body — Next.js 16 idiom (D-NX-01)', () => {
  const body = readFileSync(PATTERN_PATH, 'utf-8');

  it('emits the new proxy.ts file-name in the file-section heading', () => {
    expect(body).toMatch(/^### `proxy\.ts` \(project root\)/m);
  });

  it('emits the new export function proxy declaration', () => {
    expect(body).toMatch(/^export async function proxy\(request: NextRequest\)/m);
  });

  it('does NOT contain the legacy export-name declaration', () => {
    expect(body).not.toMatch(/^export async function middleware\(/m);
  });

  it('test-file section uses proxy.test.ts naming', () => {
    expect(body).toMatch(/^### `proxy\.test\.ts` \(test-harness\)/m);
  });

  it('imports proxy from ./proxy in the test file', () => {
    expect(body).toMatch(/import \{ proxy \} from '\.\/proxy'/);
  });

  it('carries the explicit Backward-compat note explaining the rename', () => {
    expect(body).toMatch(/Backward-compat note:.*middleware\.ts.*proxy\.ts/);
  });

  it('keeps both middleware + proxy in the search-discovery tag list', () => {
    expect(body).toMatch(/tags:.*\bmiddleware\b/);
    expect(body).toMatch(/tags:.*\bproxy\b/);
  });

  it('does not retain any await middleware( call sites in the test code', () => {
    expect(body).not.toMatch(/await middleware\(/);
  });
});

describe('brief-renderer Phase 2 step 1 — middleware → proxy rename', () => {
  it('terse Phase-2-step-1 emits proxy.ts, not middleware.ts', () => {
    const out = renderBuildOrder(SAAS_STARTER);
    expect(out).toMatch(/Copy foundation\/middleware-hardened to `proxy\.ts`/);
    expect(out).not.toMatch(/Copy foundation\/middleware-hardened to `middleware\.ts`/);
  });

  it('verbose Phase-2-step-1 emits proxy.ts, not middleware.ts', () => {
    const out = renderBuildOrderVerbose(SAAS_STARTER);
    expect(out).toMatch(/Copy foundation\/middleware-hardened to `proxy\.ts`/);
    expect(out).not.toMatch(/Copy foundation\/middleware-hardened to `middleware\.ts`/);
  });
});

describe('H2 — i18n-next-intl pattern aligned with proxy.ts idiom (audit)', () => {
  const i18nBody = readFileSync(I18N_PATTERN_PATH, 'utf-8');

  it('does not contain export async function middleware', () => {
    expect(i18nBody).not.toMatch(/^export async function middleware\(/m);
  });

  it('does not contain ### `src/middleware.ts` file-section heading', () => {
    expect(i18nBody).not.toMatch(/^### `src\/middleware\.ts`/m);
  });

  it('contains export async function proxy', () => {
    expect(i18nBody).toMatch(/^export async function proxy\(/m);
  });

  it('contains illustrative-only warning referencing v0.2 composition skill', () => {
    expect(i18nBody).toMatch(/illustrative.*v0\.2.*compos/i);
  });
});
