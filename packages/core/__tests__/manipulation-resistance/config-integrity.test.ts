/**
 * APTS-MR-004 + MR-012 — config integrity verification tests.
 */
import { describe, it, expect } from 'vitest';
import {
  pinConfig,
  verifyConfig,
} from '../../src/manipulation-resistance/config-integrity.js';

describe('pinConfig + verifyConfig', () => {
  const fixture = {
    roe_id: 'integrity-fixture',
    in_scope: { domains: ['example.com'] },
    nested: { array: [1, 2, 3] },
  };

  it('pin returns SHA-256 hex hash plus timestamp + label', () => {
    const pin = pinConfig('roe', fixture);
    expect(pin.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pin.label).toBe('roe');
    expect(typeof pin.pinned_at).toBe('string');
  });

  it('verify returns ok on identical config', () => {
    const pin = pinConfig('roe', fixture);
    const result = verifyConfig(fixture, pin);
    expect(result.ok).toBe(true);
    expect(result.observed_hash).toBe(pin.hash);
    expect(result.apts_refs).toContain('APTS-MR-004');
    expect(result.apts_refs).toContain('APTS-MR-012');
  });

  it('verify reports mismatch when a single field is mutated', () => {
    const pin = pinConfig('roe', fixture);
    const tampered = { ...fixture, roe_id: 'tampered' };
    const result = verifyConfig(tampered, pin);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/integrity check failed/);
    expect(result.observed_hash).not.toBe(pin.hash);
  });

  it('verify is canonical-form aware (key order does not break match)', () => {
    const pin = pinConfig('roe', { a: 1, b: 2 });
    const result = verifyConfig({ b: 2, a: 1 }, pin);
    expect(result.ok).toBe(true);
  });

  it('verify reports mismatch when a deeply-nested array element changes', () => {
    const pin = pinConfig('roe', fixture);
    const tampered = {
      ...fixture,
      nested: { array: [1, 2, 99] },
    };
    const result = verifyConfig(tampered, pin);
    expect(result.ok).toBe(false);
  });
});
