/**
 * APTS-MR-001 — instruction-boundary enforcement tests.
 */
import { describe, it, expect } from 'vitest';
import {
  enforceInstructionBoundary,
  WRAPPER_ACTION_ALLOWLIST,
  type WrapperAction,
} from '../../src/manipulation-resistance/instruction-boundary.js';
import type { RoE } from '../../src/roe/types.js';

function buildRoE(overrides: Partial<RoE> = {}): RoE {
  const base: RoE = {
    roe_id: 'mr001-test',
    spec_version: '0.1.0',
    operator: { organization: 'lab', authorized_by: 'tester', contact: 'tester@example.com' },
    authorization: {
      statement: 'authorized by mr001 test fixture for unit testing',
      signature_method: 'operator-attested',
    },
    in_scope: {
      domains: [{ pattern: 'example.com', includeSubdomains: true }],
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
  return { ...base, ...overrides };
}

describe('enforceInstructionBoundary', () => {
  const roe = buildRoE();

  it('allows a known action type on an in-scope target', () => {
    const action: WrapperAction = { type: 'scan', target: 'https://example.com' };
    const decision = enforceInstructionBoundary('strix', action, roe);
    expect(decision.allowed).toBe(true);
    expect(decision.apts_refs).toContain('APTS-MR-001');
  });

  it('rejects an unknown wrapper outright (deny-all default)', () => {
    const action: WrapperAction = { type: 'scan', target: 'https://example.com' };
    const decision = enforceInstructionBoundary('unknown-wrapper', action, roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('no action allowlist registered');
  });

  it('rejects an action type not in the wrapper allowlist', () => {
    const action: WrapperAction = { type: 'install-rootkit', target: 'https://example.com' };
    const decision = enforceInstructionBoundary('strix', action, roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/outside its allowlist/);
  });

  it('rejects a target outside the RoE in_scope', () => {
    const action: WrapperAction = { type: 'scan', target: 'https://evil.test' };
    const decision = enforceInstructionBoundary('strix', action, roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/instruction-boundary breach/);
  });

  it('rejects when a payload embeds an out-of-scope URL', () => {
    const action: WrapperAction = {
      type: 'scan',
      target: 'https://example.com',
      payload: { callback: 'https://evil.test/exfil' },
    };
    const decision = enforceInstructionBoundary('strix', action, roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/payload includes out-of-scope URL/);
  });

  it('allows an in-scope URL embedded deeply in a payload', () => {
    const action: WrapperAction = {
      type: 'scan',
      target: 'https://example.com',
      payload: { extras: ['https://foo.example.com/path'] },
    };
    const decision = enforceInstructionBoundary('strix', action, roe);
    expect(decision.allowed).toBe(true);
  });

  it('exposes the per-wrapper allowlist for orchestrator introspection', () => {
    expect(WRAPPER_ACTION_ALLOWLIST.strix).toContain('scan');
    expect(WRAPPER_ACTION_ALLOWLIST.subfinder).toEqual(['recon']);
  });
});
