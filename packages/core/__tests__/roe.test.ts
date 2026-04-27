/**
 * RoE schema + validators + loader tests.
 *
 * Closes APTS Tier-1 requirements:
 *   SE-001 (RoE Specification + Validation), SE-003 (Domain Scope +
 *   Wildcard), SE-004 (Temporal Boundary), SE-005 (Asset Criticality),
 *   SE-006 (Pre-Action Scope Validation), AL-006 (Basic Scope
 *   Validation), AL-014 (Boundary Definition + Enforcement).
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RoESchema,
  validateTargetInScope,
  validateTemporalEnvelope,
  getAssetCriticality,
  validateAction,
  synthesizeMinimalRoE,
  loadRoE,
  type RoE,
} from '../src/roe/index.js';

// Build a fully-valid RoE fixture to base tests on.
function fullRoE(overrides: Partial<RoE> = {}): RoE {
  const base: RoE = {
    roe_id: 'engagement-2026-04-27-test',
    spec_version: '0.1.0',
    operator: {
      organization: 'Test Org',
      authorized_by: 'CISO Smith',
      contact: 'security@test.example.com',
    },
    authorization: {
      statement:
        'I am authorized by the asset owner to test the in-scope targets per signed contract C-123.',
      signature_method: 'operator-attested',
    },
    in_scope: {
      domains: [{ pattern: 'example.com', includeSubdomains: true }],
      ip_ranges: ['203.0.113.0/24'],
      repository_paths: [],
    },
    out_of_scope: {
      domains: ['payroll.example.com', 'hr.example.com'],
      ip_ranges: ['203.0.113.5/32'],
      paths: [],
    },
    asset_criticality: [
      { pattern: 'api.example.com', classification: 'critical' },
      { pattern: 'staging.example.com', classification: 'low' },
    ],
    temporal: {
      start: '2026-04-27T00:00:00Z',
      end: '2026-04-28T00:00:00Z',
      timezone: 'UTC',
      blackout_windows: [
        {
          start: '2026-04-27T12:00:00Z',
          end: '2026-04-27T13:00:00Z',
          reason: 'production-deploy window',
        },
      ],
    },
    stop_conditions: { on_critical_finding: 'halt' },
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------

describe('RoESchema — Zod validation', () => {
  it('accepts a fully-valid RoE', () => {
    const parsed = RoESchema.safeParse(fullRoE());
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty roe_id', () => {
    const bad = { ...fullRoE(), roe_id: '' };
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a wrong spec_version', () => {
    const bad = { ...fullRoE(), spec_version: '0.2.0' as unknown as '0.1.0' };
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a too-short authorization statement (forces explicit attestation)', () => {
    const bad = {
      ...fullRoE(),
      authorization: { ...fullRoE().authorization, statement: 'ok' },
    };
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a domain pattern that contains a scheme', () => {
    const bad = {
      ...fullRoE(),
      in_scope: {
        ...fullRoE().in_scope,
        domains: [{ pattern: 'https://example.com', includeSubdomains: false }],
      },
    };
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a malformed CIDR', () => {
    const bad = {
      ...fullRoE(),
      in_scope: { ...fullRoE().in_scope, ip_ranges: ['not-a-cidr'] },
    };
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });

  it('rejects temporal envelope where end is before start', () => {
    const bad = {
      ...fullRoE(),
      temporal: {
        start: '2026-04-28T00:00:00Z',
        end: '2026-04-27T00:00:00Z',
        timezone: 'UTC',
        blackout_windows: [],
      },
    };
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown top-level field (strict mode)', () => {
    const bad = { ...fullRoE(), bogus_field: 'rejected' } as unknown as RoE;
    expect(RoESchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('validateTargetInScope — APTS-SE-003 / SE-006 / AL-006', () => {
  const roe = fullRoE();

  it('allows the in-scope bare domain', () => {
    expect(validateTargetInScope('example.com', roe).allowed).toBe(true);
  });

  it('allows a subdomain when includeSubdomains: true', () => {
    expect(validateTargetInScope('api.example.com', roe).allowed).toBe(true);
  });

  it('rejects an out-of-scope domain', () => {
    const decision = validateTargetInScope('attacker.com', roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/not within any in_scope/);
  });

  it('rejects a deny-listed domain even if it is also in_scope', () => {
    // payroll.example.com matches both in_scope (subdomain of example.com)
    // AND out_of_scope (explicit deny). Deny must win.
    const decision = validateTargetInScope('payroll.example.com', roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/out_of_scope/);
  });

  it('allows an IP within the in_scope CIDR', () => {
    expect(validateTargetInScope('203.0.113.10', roe).allowed).toBe(true);
  });

  it('rejects a deny-listed IP even if the broader CIDR is in_scope', () => {
    const decision = validateTargetInScope('203.0.113.5', roe);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/out_of_scope CIDR/);
  });

  it('parses URL targets and extracts the hostname', () => {
    expect(validateTargetInScope('https://api.example.com/v1/foo', roe).allowed).toBe(true);
  });

  it('handles wildcard pattern *.example.com', () => {
    const wildcardRoE = fullRoE({
      in_scope: {
        domains: [{ pattern: '*.example.com', includeSubdomains: false }],
        ip_ranges: [],
        repository_paths: [],
      },
    });
    expect(validateTargetInScope('foo.example.com', wildcardRoE).allowed).toBe(true);
    expect(validateTargetInScope('example.com', wildcardRoE).allowed).toBe(true);
    expect(validateTargetInScope('foo.bar.example.com', wildcardRoE).allowed).toBe(true);
  });

  it('decision.apts_refs include the satisfying requirement IDs', () => {
    const decision = validateTargetInScope('example.com', roe);
    expect(decision.allowed).toBe(true);
    expect(decision.apts_refs).toContain('APTS-SE-003');
  });
});

// ---------------------------------------------------------------------------

describe('validateTemporalEnvelope — APTS-SE-004 / SE-008', () => {
  const roe = fullRoE();

  it('allows a time within the envelope', () => {
    const t = new Date('2026-04-27T08:00:00Z');
    expect(validateTemporalEnvelope(roe, t).allowed).toBe(true);
  });

  it('rejects a time before the envelope start', () => {
    const t = new Date('2026-04-26T23:00:00Z');
    const decision = validateTemporalEnvelope(roe, t);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/before engagement start/);
  });

  it('rejects a time after the envelope end', () => {
    const t = new Date('2026-04-28T01:00:00Z');
    const decision = validateTemporalEnvelope(roe, t);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/after engagement end/);
  });

  it('rejects a time inside a blackout window', () => {
    const t = new Date('2026-04-27T12:30:00Z');
    const decision = validateTemporalEnvelope(roe, t);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/blackout window/);
  });

  it('allows a time outside blackout but inside envelope', () => {
    const t = new Date('2026-04-27T11:00:00Z');
    expect(validateTemporalEnvelope(roe, t).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('getAssetCriticality — APTS-SE-005', () => {
  const roe = fullRoE();

  it('returns the matched classification for a configured pattern', () => {
    expect(getAssetCriticality('api.example.com', roe)).toBe('critical');
    expect(getAssetCriticality('staging.example.com', roe)).toBe('low');
  });

  it('returns unspecified when no entry matches', () => {
    expect(getAssetCriticality('marketing.example.com', roe)).toBe('unspecified');
  });

  it('first-match-wins ordering — critical-asset entry placed first dominates broader entry', () => {
    const layered = fullRoE({
      asset_criticality: [
        { pattern: 'api.example.com', classification: 'critical' },
        { pattern: 'example.com', classification: 'low' },
      ],
    });
    expect(getAssetCriticality('api.example.com', layered)).toBe('critical');
  });
});

// ---------------------------------------------------------------------------

describe('validateAction — APTS-SE-006 composite gate', () => {
  const roe = fullRoE();

  it('rejects when temporal envelope fails (even with valid scope)', () => {
    const t = new Date('2026-04-26T23:00:00Z');
    const decision = validateAction('example.com', 'subfinder', roe, t);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/before engagement start/);
  });

  it('rejects when scope fails (even with valid temporal)', () => {
    const t = new Date('2026-04-27T08:00:00Z');
    const decision = validateAction('attacker.com', 'subfinder', roe, t);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/not within any in_scope/);
  });

  it('allows when both pass and surfaces criticality', () => {
    const t = new Date('2026-04-27T08:00:00Z');
    const decision = validateAction('api.example.com', 'subfinder', roe, t);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toMatch(/criticality: critical/);
  });
});

// ---------------------------------------------------------------------------

describe('synthesizeMinimalRoE — back-compat fallback', () => {
  it('synthesizes a schema-valid RoE from a target URL', () => {
    const roe = synthesizeMinimalRoE('https://example.com/');
    expect(RoESchema.safeParse(roe).success).toBe(true);
    expect(roe.in_scope.domains[0]?.pattern).toBe('example.com');
  });

  it('marks the synthesized RoE in roe_id and authorization statement', () => {
    const roe = synthesizeMinimalRoE('example.com');
    expect(roe.roe_id).toMatch(/^synthesized-/);
    expect(roe.authorization.statement).toMatch(/AEGIS-synthesized/);
  });

  it('honors duration override', () => {
    const roe = synthesizeMinimalRoE('example.com', { durationMinutes: 30 });
    const start = Date.parse(roe.temporal.start);
    const end = Date.parse(roe.temporal.end);
    expect(end - start).toBe(30 * 60_000);
  });

  describe('default-strict hardening (audit fix)', () => {
    it('sets non-trivial safety_controls.health_thresholds (SC-010 active by default)', () => {
      const roe = synthesizeMinimalRoE('example.com');
      expect(roe.safety_controls?.health_thresholds?.max_heap_mb).toBeGreaterThan(0);
      expect(roe.safety_controls?.health_thresholds?.max_error_rate).toBeGreaterThan(0);
      expect(roe.safety_controls?.health_thresholds?.max_target_response_ms).toBeGreaterThan(0);
    });

    it('sets autonomy_levels with L3 approval_required=true (HO-001 active by default)', () => {
      const roe = synthesizeMinimalRoE('example.com');
      expect(roe.autonomy_levels?.L1?.approval_required).toBe(false);
      expect(roe.autonomy_levels?.L2?.approval_required).toBe(false);
      expect(roe.autonomy_levels?.L3?.approval_required).toBe(true);
      expect(roe.autonomy_levels?.L4?.approval_required).toBe(false);
    });

    it('sets escalation thresholds (HO-011/012/013 active by default)', () => {
      const roe = synthesizeMinimalRoE('example.com');
      expect(roe.escalation?.severity_threshold).toBe('critical');
      expect(roe.escalation?.cia_threshold).toEqual({ c: 'high', i: 'high', a: 'high' });
      expect(roe.escalation?.pause_on_low_confidence).toBe(false);
    });

    it('synthesized RoE with default-strict is still schema-valid', () => {
      const roe = synthesizeMinimalRoE('example.com');
      const result = RoESchema.safeParse(roe);
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------

describe('loadRoE — file IO + JSON parse + schema validation', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aegis-roe-test-'));

  it('returns file-missing when path does not exist', () => {
    const result = loadRoE(join(tmp, 'does-not-exist.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.phase).toBe('file-missing');
    }
  });

  it('returns json-parse error on malformed JSON', () => {
    const path = join(tmp, 'bad.json');
    writeFileSync(path, '{ this is not json');
    const result = loadRoE(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.phase).toBe('json-parse');
    }
  });

  it('returns schema-validation error on schema-invalid JSON', () => {
    const path = join(tmp, 'invalid-schema.json');
    writeFileSync(path, JSON.stringify({ roe_id: 'x', spec_version: '0.1.0' })); // missing required fields
    const result = loadRoE(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.phase).toBe('schema-validation');
    }
  });

  it('returns ok+roe on a fully-valid JSON', () => {
    const path = join(tmp, 'valid.json');
    writeFileSync(path, JSON.stringify(fullRoE()));
    const result = loadRoE(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.roe.roe_id).toBe('engagement-2026-04-27-test');
    }
  });
});
