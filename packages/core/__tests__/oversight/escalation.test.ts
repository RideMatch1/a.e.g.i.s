/**
 * APTS-HO-011 + HO-013 + HO-014 — escalation framework tests.
 */
import { describe, it, expect } from 'vitest';
import {
  escalateOnSeverity,
  escalateOnConfidence,
  escalateOnComplianceTrigger,
} from '../../src/oversight/escalation.js';

describe('escalateOnSeverity', () => {
  it('escalates when severity ≥ default high threshold', () => {
    const r = escalateOnSeverity({ id: 'F-1', severity: 'critical' });
    expect(r.escalate).toBe(true);
    expect(r.action).toBe('halt');
  });

  it('does not escalate below threshold', () => {
    const r = escalateOnSeverity({ id: 'F-1', severity: 'medium' });
    expect(r.escalate).toBe(false);
  });

  it('honors operator-supplied threshold', () => {
    const r = escalateOnSeverity({ id: 'F-1', severity: 'medium' }, { threshold: 'medium' });
    expect(r.escalate).toBe(true);
  });
});

describe('escalateOnConfidence', () => {
  it('returns no escalation when confidence is not low', () => {
    const r = escalateOnConfidence({ id: 'F-1', confidence: 'high' });
    expect(r.escalate).toBe(false);
  });

  it('returns notify when confidence=low and pause_on_low is unset', () => {
    const r = escalateOnConfidence({ id: 'F-1', confidence: 'low' });
    expect(r.escalate).toBe(true);
    expect(r.action).toBe('notify');
  });

  it('returns halt when confidence=low and pause_on_low=true', () => {
    const r = escalateOnConfidence({ id: 'F-1', confidence: 'low' }, { pause_on_low: true });
    expect(r.escalate).toBe(true);
    expect(r.action).toBe('halt');
  });

  it('returns no escalation when confidence is undefined', () => {
    const r = escalateOnConfidence({ id: 'F-1' });
    expect(r.escalate).toBe(false);
  });
});

describe('escalateOnComplianceTrigger', () => {
  it('escalates on PCI match', () => {
    const r = escalateOnComplianceTrigger(
      { id: 'F-1', title: 'PCI-DSS data exposure', description: 'cardholder primary account number leaked' },
      { regulatory_class: ['PCI'] },
    );
    expect(r.escalate).toBe(true);
    expect(r.action).toBe('halt');
  });

  it('respects on_match=notify', () => {
    const r = escalateOnComplianceTrigger(
      { id: 'F-1', title: 'PCI exposure', description: 'cardholder data' },
      { regulatory_class: ['PCI'], on_match: 'notify' },
    );
    expect(r.action).toBe('notify');
  });

  it('escalates on PII / HIPAA / SOX class markers', () => {
    const r1 = escalateOnComplianceTrigger(
      { id: 'F-1', title: 'PII leak', description: 'GDPR data subject' },
      { regulatory_class: ['PII'] },
    );
    expect(r1.escalate).toBe(true);
    const r2 = escalateOnComplianceTrigger(
      { id: 'F-1', title: 'PHI exposure', description: 'HIPAA-controlled record' },
      { regulatory_class: ['HIPAA'] },
    );
    expect(r2.escalate).toBe(true);
  });

  it('returns no escalation when no class is supplied or no match', () => {
    const r = escalateOnComplianceTrigger(
      { id: 'F-1', title: 'XSS in /search', description: 'reflected input' },
      { regulatory_class: ['PCI'] },
    );
    expect(r.escalate).toBe(false);
  });

  it('ignores unknown class names without crashing', () => {
    const r = escalateOnComplianceTrigger(
      { id: 'F-1', title: 'PCI exposure', description: 'cardholder data' },
      { regulatory_class: ['UnknownClass'] },
    );
    expect(r.escalate).toBe(false);
  });
});
