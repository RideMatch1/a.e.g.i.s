/**
 * APTS-HO-001 + HO-010 — pre-approval gate tests.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateApprovalGate,
  detectIrreversibleActions,
  PHASE_TO_AUTONOMY_LEVEL,
} from '../../src/oversight/approval-gates.js';

describe('evaluateApprovalGate', () => {
  it('allows when no policy declares approval_required', () => {
    const r = evaluateApprovalGate('recon', undefined, false);
    expect(r.allowed).toBe(true);
  });

  it('allows when approval_required=false', () => {
    const r = evaluateApprovalGate('discovery', { L2: { approval_required: false } }, false);
    expect(r.allowed).toBe(true);
  });

  it('allows when policy says pre_approved', () => {
    const r = evaluateApprovalGate(
      'exploitation',
      { L3: { approval_required: true, pre_approved: true } },
      false,
    );
    expect(r.allowed).toBe(true);
  });

  it('allows L1/L2 with engagement-wide --confirm', () => {
    const r = evaluateApprovalGate(
      'discovery',
      { L2: { approval_required: true } },
      true,
    );
    expect(r.allowed).toBe(true);
  });

  it('denies L3 with --confirm but no per-level pre-approval', () => {
    const r = evaluateApprovalGate(
      'exploitation',
      { L3: { approval_required: true } },
      true,
    );
    expect(r.allowed).toBe(false);
    expect(r.apts_refs).toContain('APTS-HO-010');
  });

  it('allows when phase has no AL mapping', () => {
    const r = evaluateApprovalGate('unknown-phase', { L1: { approval_required: true } }, false);
    expect(r.allowed).toBe(true);
  });
});

describe('detectIrreversibleActions', () => {
  it('returns empty when no policy is set', () => {
    expect(detectIrreversibleActions('recon', undefined)).toEqual([]);
  });

  it('returns empty when policy has no irreversible_action_classes', () => {
    expect(detectIrreversibleActions('recon', { L1: {} })).toEqual([]);
  });

  it('returns the per-level irreversible action classes', () => {
    const r = detectIrreversibleActions('exploitation', {
      L3: { irreversible_action_classes: ['data-modify', 'auth-bypass'] },
    });
    expect(r).toEqual(['data-modify', 'auth-bypass']);
  });
});

describe('PHASE_TO_AUTONOMY_LEVEL', () => {
  it('maps the canonical phase names', () => {
    expect(PHASE_TO_AUTONOMY_LEVEL.recon).toBe('L1');
    expect(PHASE_TO_AUTONOMY_LEVEL.discovery).toBe('L2');
    expect(PHASE_TO_AUTONOMY_LEVEL.exploitation).toBe('L3');
    expect(PHASE_TO_AUTONOMY_LEVEL.reporting).toBe('L4');
  });
});
