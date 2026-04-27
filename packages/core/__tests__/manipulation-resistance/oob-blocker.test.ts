/**
 * APTS-MR-011 — egress-allowlist composition tests.
 */
import { describe, it, expect } from 'vitest';
import {
  composeEgressAllowlist,
  withEgressEnv,
  ORCHESTRATOR_ESSENTIALS,
} from '../../src/manipulation-resistance/oob-blocker.js';
import type { RoE } from '../../src/roe/types.js';

function buildRoE(): RoE {
  return {
    roe_id: 'oob-test',
    spec_version: '0.1.0',
    operator: { organization: 'lab', authorized_by: 'tester', contact: 'tester@example.com' },
    authorization: {
      statement: 'authorized for unit testing of egress allowlist composition',
      signature_method: 'operator-attested',
    },
    in_scope: {
      domains: [
        { pattern: 'target.test', includeSubdomains: true },
        { pattern: 'partner.test', includeSubdomains: false },
      ],
      ip_ranges: ['10.20.30.0/24'],
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

describe('composeEgressAllowlist', () => {
  it('includes RoE in_scope domains', () => {
    const a = composeEgressAllowlist(buildRoE());
    expect(a.hosts).toContain('target.test');
    expect(a.hosts).toContain('*.target.test');
    expect(a.hosts).toContain('partner.test');
  });

  it('includes RoE in_scope IP ranges', () => {
    const a = composeEgressAllowlist(buildRoE());
    expect(a.hosts).toContain('10.20.30.0/24');
  });

  it('includes orchestrator essentials when LLM access is needed', () => {
    const a = composeEgressAllowlist(buildRoE(), { includeLlmEssentials: true });
    expect(a.includes_llm_essentials).toBe(true);
    for (const host of ORCHESTRATOR_ESSENTIALS) {
      expect(a.hosts).toContain(host);
    }
  });

  it('omits orchestrator essentials when LLM access is not needed (subfinder/SAST)', () => {
    const a = composeEgressAllowlist(buildRoE(), { includeLlmEssentials: false });
    expect(a.includes_llm_essentials).toBe(false);
    for (const host of ORCHESTRATOR_ESSENTIALS) {
      expect(a.hosts).not.toContain(host);
    }
  });

  it('includes operator-supplied extras', () => {
    const a = composeEgressAllowlist(buildRoE(), { extras: ['cdn.example.com'] });
    expect(a.hosts).toContain('cdn.example.com');
  });

  it('emits envValue as comma-joined sorted string', () => {
    const a = composeEgressAllowlist(buildRoE());
    expect(a.envValue.split(',')).toEqual(a.hosts);
    const sorted = [...a.hosts].sort();
    expect(a.hosts).toEqual(sorted);
  });
});

describe('withEgressEnv', () => {
  it('merges AEGIS_EGRESS_ALLOWLIST into base env without clobbering', () => {
    const base = { EXISTING: 'value' } as NodeJS.ProcessEnv;
    const merged = withEgressEnv(base, {
      hosts: ['a.test'],
      envValue: 'a.test',
      includes_llm_essentials: false,
    });
    expect(merged.AEGIS_EGRESS_ALLOWLIST).toBe('a.test');
    expect(merged.EXISTING).toBe('value');
  });
});
