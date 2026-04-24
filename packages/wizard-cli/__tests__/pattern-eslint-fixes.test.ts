/**
 * D-OTH-08/09/10 (commit 12) — three eslint fixes in shipped pattern code.
 *
 * Full `npx eslint --stdin` on extracted pattern-code-blocks is the ideal
 * long-form verification, but requires spinning up a next-config + eslint
 * config inside the test-harness (fragile on a pattern-only repo). The
 * textual assertions below are tight enough to catch regression on each
 * of the three specific fix-sites; the long-form verification lives in
 * the dogfood scaffold's own lint run.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const PATTERN_DIR = resolve(__dirname, '..', '..', '..', 'docs', 'patterns');

describe('D-OTH-08 — legal-pages-de datenschutz uses <Link> not <a> for internal link', () => {
  const body = readFileSync(resolve(PATTERN_DIR, 'compliance', 'legal-pages-de.md'), 'utf-8');

  it('imports Link from next/link in the datenschutz page', () => {
    // Heading carries the {{LOCALE_PREFIX}} placeholder added in v0.17.2 H3 fix;
    // resolver emits '[locale]/' when i18n is active, '' otherwise (see
    // pattern-placeholders.test.ts for the substitution integration-tests).
    expect(body).toMatch(
      /### `src\/app\/\{\{LOCALE_PREFIX\}\}datenschutz\/page\.tsx`[\s\S]*?import Link from 'next\/link'/,
    );
  });

  it('Daten-Selbstverwaltung link uses <Link href> instead of <a href>', () => {
    expect(body).toMatch(/<Link href="\/admin\/mein-bereich\/datenschutz">Daten-Selbstverwaltung<\/Link>/);
    expect(body).not.toMatch(/<a href="\/admin\/mein-bereich\/datenschutz">/);
  });
});

describe('D-OTH-09 — cookie-banner defers setState via queueMicrotask', () => {
  const body = readFileSync(resolve(PATTERN_DIR, 'compliance', 'dsgvo-kit.md'), 'utf-8');

  it('setShowBanner(true) is wrapped in queueMicrotask inside the useEffect', () => {
    expect(body).toMatch(/queueMicrotask\(\(\) => setShowBanner\(true\)\)/);
  });

  it('does NOT call setShowBanner(true) synchronously at useEffect top-level', () => {
    // Target: the specific useEffect that opens with const saved = getConsent();
    const effectMatch = body.match(/useEffect\(\(\) => \{\s*const saved = getConsent\(\);[\s\S]*?\}, \[\]\);/);
    expect(effectMatch).not.toBeNull();
    const effectBody = effectMatch![0];
    // Inside this effect, the only setShowBanner call must be via queueMicrotask.
    expect(effectBody).not.toMatch(/^\s*setShowBanner\(true\);\s*$/m);
    expect(effectBody).toMatch(/queueMicrotask\(\(\) => setShowBanner\(true\)\)/);
  });
});

describe('D-OTH-10 — multi-tenant-supabase drops orphan eslint-disable directive', () => {
  const body = readFileSync(resolve(PATTERN_DIR, 'foundation', 'multi-tenant-supabase.md'), 'utf-8');

  it('no orphan eslint-disable-next-line no-restricted-imports directive', () => {
    expect(body).not.toMatch(/eslint-disable-next-line no-restricted-imports/);
  });

  it('still carries a narrative comment explaining service-role usage', () => {
    expect(body).toMatch(/Service role required for admin operations/);
  });
});
