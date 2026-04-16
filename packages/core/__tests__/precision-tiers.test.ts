import { describe, it, expect } from 'vitest';
import {
  PRECISION_GATES,
  SCANNER_TIERS,
  tierOf,
  gateFor,
  passesPrecisionGate,
  type PrecisionTier,
} from '../src/precision-tiers.js';

describe('PRECISION_GATES', () => {
  it('defines exactly five tiers', () => {
    const expected: PrecisionTier[] = ['definitive', 'pattern', 'taint', 'heuristic', 'quarantine'];
    expect(Object.keys(PRECISION_GATES).sort()).toEqual(expected.sort());
  });

  it('orders gates from strict to permissive', () => {
    expect(PRECISION_GATES.definitive).toBeGreaterThan(PRECISION_GATES.pattern);
    expect(PRECISION_GATES.pattern).toBeGreaterThan(PRECISION_GATES.taint);
    expect(PRECISION_GATES.taint).toBeGreaterThan(PRECISION_GATES.heuristic);
    expect(PRECISION_GATES.heuristic).toBeGreaterThan(PRECISION_GATES.quarantine);
  });

  it('quarantine gate is 0 (anything passes — but ships --experimental only)', () => {
    expect(PRECISION_GATES.quarantine).toBe(0);
  });
});

describe('tierOf / gateFor', () => {
  it('returns the configured tier for taint-analyzer', () => {
    expect(tierOf('taint-analyzer')).toBe('taint');
    expect(gateFor('taint-analyzer')).toBe(0.70);
  });

  it('classifies pattern scanners correctly', () => {
    expect(tierOf('cookie-checker')).toBe('pattern');
    expect(gateFor('cookie-checker')).toBe(0.75);
  });

  it('classifies heuristic scanners correctly', () => {
    expect(tierOf('auth-enforcer')).toBe('heuristic');
    expect(gateFor('auth-enforcer')).toBe(0.60);
  });

  it('classifies definitive scanners correctly', () => {
    expect(tierOf('entropy-scanner')).toBe('definitive');
    expect(gateFor('entropy-scanner')).toBe(0.80);
  });

  it('returns undefined for unclassified scanners (forces explicit decision)', () => {
    expect(tierOf('not-a-real-scanner')).toBeUndefined();
    expect(gateFor('not-a-real-scanner')).toBeUndefined();
  });

  it('returns undefined for external tools (npm-audit, semgrep, …)', () => {
    // These inherit precision from the tool itself, not internally tiered
    expect(tierOf('npm-audit')).toBeUndefined();
    expect(tierOf('semgrep')).toBeUndefined();
    expect(tierOf('trivy')).toBeUndefined();
  });

  it('returns undefined for runtime probes', () => {
    expect(tierOf('auth-probe')).toBeUndefined();
    expect(tierOf('race-probe')).toBeUndefined();
  });

  it('returns undefined for compliance meta-scanners', () => {
    expect(tierOf('gdpr-engine')).toBeUndefined();
    expect(tierOf('iso27001-checker')).toBeUndefined();
  });
});

describe('passesPrecisionGate', () => {
  it('passes when precision is at or above the tier gate', () => {
    expect(passesPrecisionGate('taint-analyzer', 0.70)).toBe(true);
    expect(passesPrecisionGate('taint-analyzer', 0.85)).toBe(true);
  });

  it('fails when precision is below the tier gate', () => {
    expect(passesPrecisionGate('taint-analyzer', 0.69)).toBe(false);
    expect(passesPrecisionGate('cookie-checker', 0.74)).toBe(false);
  });

  it('fails for unclassified scanners (no implicit pass)', () => {
    expect(passesPrecisionGate('mystery-scanner', 0.99)).toBe(false);
  });

  it('different tiers have different thresholds', () => {
    // 65% precision: passes heuristic (gate 60%), fails taint (gate 70%)
    expect(passesPrecisionGate('auth-enforcer', 0.65)).toBe(true);
    expect(passesPrecisionGate('taint-analyzer', 0.65)).toBe(false);
  });
});

describe('SCANNER_TIERS — completeness', () => {
  it('every tier classification is a valid PrecisionTier', () => {
    const validTiers = new Set(Object.keys(PRECISION_GATES));
    for (const [, tier] of Object.entries(SCANNER_TIERS)) {
      expect(validTiers.has(tier!)).toBe(true);
    }
  });

  it('contains the v0.6 new scanner registrations', () => {
    expect(tierOf('next-public-leak')).toBe('pattern');
  });
});
