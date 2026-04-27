/**
 * APTS-SC-001 + HO-012 — CIA scoring + threshold evaluation tests.
 */
import { describe, it, expect } from 'vitest';
import {
  assignCiaVector,
  evaluateCiaThreshold,
  CWE_CIA_DEFAULTS,
} from '../../src/oversight/cia-scoring.js';

describe('assignCiaVector', () => {
  it('returns the per-CWE mapping when CWE is known', () => {
    const v = assignCiaVector({ cwe: 89, severity: 'medium' });
    expect(v).toEqual(CWE_CIA_DEFAULTS[89]);
  });

  it('falls back to severity-based default when CWE is unknown', () => {
    const v = assignCiaVector({ cwe: 99999, severity: 'high' });
    expect(v.c).toBe('high');
    expect(v.i).toBe('medium');
    expect(v.a).toBe('low');
  });

  it('falls back to severity when CWE is undefined', () => {
    const v = assignCiaVector({ severity: 'critical' });
    expect(v.c).toBe('high');
    expect(v.i).toBe('high');
    expect(v.a).toBe('medium');
  });

  it('info severity → all-low / a:none', () => {
    const v = assignCiaVector({ severity: 'info' });
    expect(v.a).toBe('none');
  });

  it('blocker severity → all high', () => {
    const v = assignCiaVector({ severity: 'blocker' });
    expect(v).toEqual({ c: 'high', i: 'high', a: 'high' });
  });

  it('returns a new object (no shared reference for mutation safety)', () => {
    const v1 = assignCiaVector({ cwe: 89, severity: 'medium' });
    const v2 = assignCiaVector({ cwe: 89, severity: 'medium' });
    expect(v1).toEqual(v2);
    expect(v1).not.toBe(v2);
  });
});

describe('evaluateCiaThreshold', () => {
  it('returns no breach when no axes are above threshold', () => {
    const r = evaluateCiaThreshold({ c: 'low', i: 'low', a: 'low' }, { c: 'high' });
    expect(r.breach).toBe(false);
    expect(r.axes_breached).toEqual([]);
  });

  it('returns breach when an axis equals the threshold (≥, not >)', () => {
    const r = evaluateCiaThreshold({ c: 'high', i: 'low', a: 'low' }, { c: 'high' });
    expect(r.breach).toBe(true);
    expect(r.axes_breached).toEqual(['c']);
  });

  it('returns multiple axes when several breach', () => {
    const r = evaluateCiaThreshold({ c: 'high', i: 'high', a: 'low' }, { c: 'high', i: 'medium' });
    expect(r.breach).toBe(true);
    expect(r.axes_breached.sort()).toEqual(['c', 'i']);
  });

  it('skips axes with no threshold', () => {
    const r = evaluateCiaThreshold({ c: 'high', i: 'high', a: 'high' }, {});
    expect(r.breach).toBe(false);
  });

  it('apts_refs include both SC-001 and HO-012 on breach', () => {
    const r = evaluateCiaThreshold({ c: 'high', i: 'low', a: 'low' }, { c: 'medium' });
    expect(r.apts_refs).toContain('APTS-SC-001');
    expect(r.apts_refs).toContain('APTS-HO-012');
  });
});
