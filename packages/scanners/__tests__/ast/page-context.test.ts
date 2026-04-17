/**
 * Tests for packages/scanners/src/ast/page-context.ts.
 *
 * Scope: unit tests covering each exported function in isolation.
 * Pure-content functions (`stripComments`, `isClientDirective`,
 * `matcherCoversPath`, `hasLayoutAuthGuard`) are driven by inline
 * strings. Filesystem-consuming functions (`collectAncestorLayouts`,
 * `parseMiddlewareMatchers`, `pageIsGuardedByContext`) use the shared
 * `writeFixtures` helper that writes into the vulnerable-app fixture
 * tree under a per-test-file namespace so parallel workers don't
 * clobber each other.
 *
 * These pin individual-export semantics so that a future maintainer
 * editing one branch of one function gets immediate red-test feedback
 * rather than waiting for a full canary integration run to catch
 * the regression.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'node:path';
import {
  stripComments,
  isClientDirective,
  matcherCoversPath,
  collectAncestorLayouts,
  parseMiddlewareMatchers,
  hasLayoutAuthGuard,
  pageIsGuardedByContext,
} from '../../src/ast/page-context.js';
import {
  writeFixtures as _writeFixtures,
  cleanup as _cleanup,
  fixtureDir,
} from '../__helpers__/multi-file-fixtures.js';

const NS = 'page-context';
const writeFixtures = (files: Record<string, string>): string[] =>
  _writeFixtures(files, NS);
const cleanup = (): void => _cleanup(NS);
const projectRoot = (): string => fixtureDir(NS);

afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────
// stripComments (Bug A primitive)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — stripComments', () => {
  it('strips line comments and preserves line numbers', () => {
    const input = 'const x = 1;\n// stats query (separat)\nconst y = 2;\n';
    const out = stripComments(input);
    expect(out).not.toMatch(/query\s*\(/);
    // Line count preserved so downstream line-reporting stays accurate.
    expect(out.split('\n').length).toBe(input.split('\n').length);
  });

  it('strips block comments and preserves embedded newlines', () => {
    const input = 'const x = 1;\n/** comment with\n * query(...) prose\n */\nconst y = 2;\n';
    const out = stripComments(input);
    expect(out).not.toMatch(/query\s*\(/);
    expect(out.split('\n').length).toBe(input.split('\n').length);
  });

  it('does NOT strip comment-like tokens inside string literals', () => {
    // SQL hints and URLs contain /* … */ or // — these must survive.
    const input = "const sql = 'SELECT /* hint */ * FROM t'; const u = \"http://x\";\n";
    const out = stripComments(input);
    expect(out).toContain('/* hint */');
    expect(out).toContain('http://x');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// isClientDirective (Q4)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — isClientDirective', () => {
  it("returns true when first statement is 'use client'", () => {
    expect(isClientDirective("'use client';\n\nexport default function F() {}")).toBe(true);
  });

  it('returns false when directive is absent', () => {
    expect(isClientDirective('export default async function F() { return null; }')).toBe(false);
  });

  it('returns false when directive is not the first statement (per Next.js rules)', () => {
    // 'use client' after any other statement is a no-op string literal.
    const src = 'const x = 1;\n"use client";\nexport default function F() {}';
    expect(isClientDirective(src)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// matcherCoversPath (Q2 semantic core)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — matcherCoversPath', () => {
  it('exact literal matcher requires exact path equality', () => {
    expect(matcherCoversPath('/admin', '/admin')).toBe(true);
    expect(matcherCoversPath('/admin', '/admin/reports')).toBe(false);
  });

  it('`:path*` wildcard matches prefix and everything beneath it', () => {
    expect(matcherCoversPath('/admin/:path*', '/admin')).toBe(true);
    expect(matcherCoversPath('/admin/:path*', '/admin/reports')).toBe(true);
    expect(matcherCoversPath('/admin/:path*', '/admin/reports/42')).toBe(true);
    expect(matcherCoversPath('/admin/:path*', '/public')).toBe(false);
  });

  it('`/:slug` single-segment matches exactly one segment after prefix', () => {
    expect(matcherCoversPath('/admin/:id', '/admin/42')).toBe(true);
    expect(matcherCoversPath('/admin/:id', '/admin')).toBe(false);
    expect(matcherCoversPath('/admin/:id', '/admin/42/sub')).toBe(false);
  });

  it('root `/` matches only the root path', () => {
    expect(matcherCoversPath('/', '/')).toBe(true);
    expect(matcherCoversPath('/', '/admin')).toBe(false);
  });

  it('regex-bearing matchers (lookahead / alternation) fall closed — no coverage', () => {
    // Complex regex matchers can't be evaluated confidently without full
    // regex semantics — the helper deliberately returns false to force
    // conservative emit on the consumer side.
    expect(matcherCoversPath('/((?!public).*)', '/admin')).toBe(false);
    expect(matcherCoversPath('/(admin|api)/:path*', '/admin/x')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// collectAncestorLayouts (Q1)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — collectAncestorLayouts', () => {
  it('returns a single direct-parent layout when only one exists', () => {
    const [pagePath] = writeFixtures({
      'app/admin/layout.tsx': 'export default function L(){ return null; }',
      'app/admin/page.tsx': 'export default function P(){ return null; }',
    });
    // Writing in dict order: layout first then page. The page path is
    // the LAST fixture written — pick it explicitly.
    const pages = writeFixtures({
      'app/admin/page.tsx': 'export default function P(){ return null; }',
    });
    const result = collectAncestorLayouts(pages[0], projectRoot());
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toMatch(/app\/admin\/layout\.tsx$/);
    // Suppress unused-var warning on the first batch's binding.
    void pagePath;
  });

  it('walks multi-level chain up to the app root, innermost first', () => {
    writeFixtures({
      'app/layout.tsx': 'export default function L(){ return null; }',
      'app/admin/layout.tsx': 'export default function L(){ return null; }',
      'app/admin/reports/[id]/page.tsx': 'export default function P(){ return null; }',
    });
    const pagePath = path.join(projectRoot(), 'app/admin/reports/[id]/page.tsx');
    const result = collectAncestorLayouts(pagePath, projectRoot());
    // Expected order: admin/layout (closer) first, then root layout.
    expect(result.length).toBe(2);
    expect(result[0]).toMatch(/app\/admin\/layout\.tsx$/);
    expect(result[1]).toMatch(/app\/layout\.tsx$/);
  });

  it('returns empty array when no layouts exist in the chain', () => {
    writeFixtures({
      'app/admin/reports/page.tsx': 'export default function P(){ return null; }',
    });
    const pagePath = path.join(projectRoot(), 'app/admin/reports/page.tsx');
    const result = collectAncestorLayouts(pagePath, projectRoot());
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// parseMiddlewareMatchers (Q2 extraction)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — parseMiddlewareMatchers', () => {
  it('extracts string-literal matcher shorthand', () => {
    const [mwPath] = writeFixtures({
      'middleware.ts':
        "export const config = { matcher: '/admin/:path*' };\n",
    });
    expect(parseMiddlewareMatchers(mwPath)).toEqual(['/admin/:path*']);
  });

  it('extracts array-of-string-literal matchers', () => {
    const [mwPath] = writeFixtures({
      'middleware.ts':
        "export const config = { matcher: ['/admin/:path*', '/api/:path*'] };\n",
    });
    expect(parseMiddlewareMatchers(mwPath)).toEqual([
      '/admin/:path*',
      '/api/:path*',
    ]);
  });

  it('returns null for dynamic / non-static matcher values (fail-closed)', () => {
    const [mwPath] = writeFixtures({
      'middleware.ts':
        "const m = '/admin/:path*';\nexport const config = { matcher: m };\n",
    });
    // Variable reference → ambiguous, caller treats null as "no suppression".
    expect(parseMiddlewareMatchers(mwPath)).toBeNull();
  });

  it('returns null when no `export const config` is present', () => {
    const [mwPath] = writeFixtures({
      'middleware.ts': 'export function middleware() {}\n',
    });
    expect(parseMiddlewareMatchers(mwPath)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// hasLayoutAuthGuard (Q3 structural recognition)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — hasLayoutAuthGuard', () => {
  it('recognises destructure + redirect on negative branch', () => {
    const src = `
      import { redirect } from 'next/navigation';
      import { getServerSession } from 'next-auth';
      export default async function Layout({ children }) {
        const { user } = await getServerSession();
        if (!user) redirect('/login');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(true);
  });

  it('recognises plain-assign + redirect on negative branch', () => {
    const src = `
      import { redirect } from 'next/navigation';
      import { getServerSession } from 'next-auth';
      export default async function Layout({ children }) {
        const session = await getServerSession();
        if (!session) redirect('/login');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(true);
  });

  it('recognises throw as a fail-closed primitive', () => {
    const src = `
      import { requireAuth } from '@/lib/auth';
      export default async function Layout({ children }) {
        const user = await requireAuth();
        if (!user) throw new Error('unauthorised');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(true);
  });

  it('recognises notFound() as a fail-closed primitive', () => {
    const src = `
      import { notFound } from 'next/navigation';
      import { auth } from '@/lib/auth';
      export default async function Layout({ children }) {
        const user = await auth();
        if (!user) notFound();
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(true);
  });

  it('recognises nested destructure (Supabase SSR shape) + redirect', () => {
    const src = `
      import { redirect } from 'next/navigation';
      export default async function Layout({ children }) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) redirect('/login');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(true);
  });

  it("returns false when 'use client' directive is present", () => {
    const src = `
      'use client';
      import { redirect } from 'next/navigation';
      export default async function Layout({ children }) {
        const session = await getServerSession();
        if (!session) redirect('/login');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(false);
  });

  it('returns false when auth call has no redirect/throw (log-only fail-open)', () => {
    const src = `
      import { getServerSession } from 'next-auth';
      export default async function Layout({ children }) {
        const session = await getServerSession();
        if (!session) console.warn('no session');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(false);
  });

  it('returns false on wrong-direction check (redirect on authenticated user)', () => {
    const src = `
      import { redirect } from 'next/navigation';
      import { getServerSession } from 'next-auth';
      export default async function Layout({ children }) {
        const session = await getServerSession();
        if (session) redirect('/dashboard');
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(false);
  });

  it('returns false when guard sits inside a try/catch (top-level walk skips try-block)', () => {
    // L11 canary shape — throw is swallowed, layout renders regardless.
    const src = `
      import { requireAuth } from '@/lib/auth';
      export default async function Layout({ children }) {
        try {
          await requireAuth();
        } catch {}
        return children;
      }
    `;
    expect(hasLayoutAuthGuard(src)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// pageIsGuardedByContext (Q5 composite)
// ─────────────────────────────────────────────────────────────────────────

describe('page-context — pageIsGuardedByContext', () => {
  it('returns true when an ancestor layout has a FAIL-CLOSED auth guard', () => {
    writeFixtures({
      'app/admin/layout.tsx': `
        import { redirect } from 'next/navigation';
        import { getServerSession } from 'next-auth';
        export default async function Layout({ children }) {
          const session = await getServerSession();
          if (!session) redirect('/login');
          return children;
        }
      `,
      'app/admin/reports/page.tsx':
        "import { supabase } from '@/lib/supabase';\nexport default async function P() { return supabase.from('x').select('*'); }\n",
    });
    const pagePath = path.join(projectRoot(), 'app/admin/reports/page.tsx');
    expect(pageIsGuardedByContext(pagePath, projectRoot())).toBe(true);
  });

  it('returns true when middleware with matching matcher + auth pattern protects the page', () => {
    writeFixtures({
      'middleware.ts': `
        import { getServerSession } from 'next-auth';
        import { NextResponse } from 'next/server';
        export async function middleware() {
          const s = await getServerSession();
          if (!s) return NextResponse.redirect('/login');
          return NextResponse.next();
        }
        export const config = { matcher: ['/admin/:path*'] };
      `,
      'app/admin/reports/page.tsx':
        "import { supabase } from '@/lib/supabase';\nexport default async function P() { return supabase.from('x').select('*'); }\n",
    });
    const pagePath = path.join(projectRoot(), 'app/admin/reports/page.tsx');
    expect(pageIsGuardedByContext(pagePath, projectRoot())).toBe(true);
  });

  it('returns false when no layout guards AND no middleware', () => {
    writeFixtures({
      'app/admin/reports/page.tsx':
        "import { supabase } from '@/lib/supabase';\nexport default async function P() { return supabase.from('x').select('*'); }\n",
    });
    const pagePath = path.join(projectRoot(), 'app/admin/reports/page.tsx');
    expect(pageIsGuardedByContext(pagePath, projectRoot())).toBe(false);
  });

  it("returns false when page opts into Edge runtime even if layout has guard (conservative)", () => {
    writeFixtures({
      'app/admin/layout.tsx': `
        import { redirect } from 'next/navigation';
        import { getServerSession } from 'next-auth';
        export default async function Layout({ children }) {
          const session = await getServerSession();
          if (!session) redirect('/login');
          return children;
        }
      `,
      'app/admin/reports/page.tsx': `
        import { supabase } from '@/lib/supabase';
        export const runtime = 'edge';
        export default async function P() { return supabase.from('x').select('*'); }
      `,
    });
    const pagePath = path.join(projectRoot(), 'app/admin/reports/page.tsx');
    expect(pageIsGuardedByContext(pagePath, projectRoot())).toBe(false);
  });
});
