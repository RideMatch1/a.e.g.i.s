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
