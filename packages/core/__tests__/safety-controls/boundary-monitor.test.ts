/**
 * APTS-AL-016 — continuous boundary monitoring tests.
 */
import { describe, it, expect } from 'vitest';
import { detectScopeBreach } from '../../src/safety-controls/boundary-monitor.js';
import type { RoE } from '../../src/roe/types.js';

function buildRoE(): RoE {
  return {
    roe_id: 'al016-test',
    spec_version: '0.1.0',
    operator: { organization: 'lab', authorized_by: 'tester', contact: 'tester@example.com' },
    authorization: {
      statement: 'authorized for unit testing of boundary monitoring',
      signature_method: 'operator-attested',
    },
    in_scope: {
      domains: [{ pattern: 'target.test', includeSubdomains: true }],
      ip_ranges: [],
      repository_paths: [],
    },
    out_of_scope: { domains: [], ip_ranges: [], paths: [] },
    asset_criticality: [],
    temporal: {
      start: new Date(Date.now() - 1_000).toISOString(),
      end: new Date(Date.now() + 60_000).toISOString(),
      timezone: 'UTC',
      blackout_windows: [],
    },
    stop_conditions: { on_critical_finding: 'halt' },
    sandboxing: { mode: 'none' },
  };
}

describe('detectScopeBreach', () => {
  const roe = buildRoE();

  it('passes findings without inspectable URL/path', () => {
    const r = detectScopeBreach({}, roe);
    expect(r.in_scope).toBe(true);
    expect(r.decision.reason).toMatch(/no inspectable URL/);
  });

  it('passes findings whose URL is inside the RoE in_scope', () => {
    const r = detectScopeBreach({ target: 'https://target.test/login' }, roe);
    expect(r.in_scope).toBe(true);
  });

  it('flags findings whose URL is outside the RoE in_scope', () => {
    const r = detectScopeBreach({ target: 'https://evil.test/path' }, roe);
    expect(r.in_scope).toBe(false);
    expect(r.decision.allowed).toBe(false);
    expect(r.apts_refs).toContain('APTS-AL-016');
  });

  it('passes file paths (URL boundary not applicable)', () => {
    const r = detectScopeBreach({ file: 'src/foo.ts' }, roe);
    expect(r.in_scope).toBe(true);
    expect(r.decision.reason).toMatch(/file path/);
  });

  it('prefers location over target when both are present', () => {
    const r = detectScopeBreach({
      location: 'https://target.test/legit',
      target: 'https://evil.test/should-not-be-inspected',
    }, roe);
    expect(r.in_scope).toBe(true);
    expect(r.inspected).toContain('target.test');
  });
});
