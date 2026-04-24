/**
 * H4 audit closure — prod-check evidence artifact must ship AND be
 * scrub-clean (no internal codenames leaking from the operator-local
 * planning tree the sanitized version was built from).
 *
 * The v0.17.1 CHANGELOG originally referenced the prod-check by an
 * internal shorthand. That shorthand lived only in a gitignored tree,
 * so external reviewers could not independently verify the "closed
 * dev-only" claim. This test asserts the shipped evidence file is
 * present, contains the concrete curl-output signatures the narrative
 * relies on, and does not carry any of the internal shorthand forward.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const EVIDENCE_PATH = resolve(REPO_ROOT, 'docs', 'security', 'prod-check-2026-04-23.md');

describe('H4 — prod-check evidence is shipped + scrub-clean (audit)', () => {
  it('docs/security/prod-check-2026-04-23.md exists', () => {
    expect(existsSync(EVIDENCE_PATH)).toBe(true);
  });

  const body = readFileSync(EVIDENCE_PATH, 'utf-8');

  it('contains verbatim CSP header with strict-dynamic in curl output', () => {
    expect(body).toMatch(/content-security-policy:[^\n]*strict-dynamic/i);
  });

  it('contains 401 Unauthorized status for unauth /api/admin probe', () => {
    expect(body).toMatch(/HTTP\/1\.1 401 Unauthorized/i);
  });

  it('contains x-frame-options DENY', () => {
    expect(body).toMatch(/x-frame-options:\s*DENY/i);
  });

  it('does not contain internal shorthand from the planning tree', () => {
    expect(body).not.toMatch(/F-MAJ-1/);
    expect(body).not.toMatch(/aegis-precision\//);
    expect(body).not.toMatch(/dogfood-saas-build/);
  });
});

describe('B2 — prod-check evidence ships inside the published tarball (audit v0.17.2 L)', () => {
  // v0.17.2 L finding: the evidence doc existed in the repo but NOT in the
  // tarball, so external consumers couldn't verify the dev-only closure
  // claim without visiting GitHub. v0.17.3 B2 fix: extend copy-wizard-assets.mjs
  // to copy docs/security/*.md → dist/docs/security/. The package.json
  // `files` array already includes "dist", so the evidence now ships via
  // that entry without needing an `../../docs/` path in files-array (which
  // npm rejects — files must be package-root-relative).
  const DIST_EVIDENCE_PATH = resolve(
    __dirname,
    '..',
    'dist',
    'docs',
    'security',
    'prod-check-2026-04-23.md',
  );

  it('prod-check doc is copied into packages/wizard-cli/dist/docs/security/ at build time', () => {
    expect(existsSync(DIST_EVIDENCE_PATH)).toBe(true);
  });

  it('dist-copy body matches the source-repo body byte-identically (no drift)', () => {
    const src = readFileSync(EVIDENCE_PATH, 'utf-8');
    const dst = readFileSync(DIST_EVIDENCE_PATH, 'utf-8');
    expect(dst).toBe(src);
  });
});
