/**
 * APTS-HO-001 + HO-010 — pre-approval gate tests.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateApprovalGate,
  detectIrreversibleActions,
  evaluateIrreversibleGate,
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

describe('evaluateIrreversibleGate (HO-010 hard gate)', () => {
  it('allows when no irreversible classes are declared', () => {
    const r = evaluateIrreversibleGate('recon', { L1: { approval_required: false } });
    expect(r.allowed).toBe(true);
    expect(r.classes).toEqual([]);
    expect(r.apts_refs).toContain('APTS-HO-010');
  });

  it('allows when policy is undefined', () => {
    const r = evaluateIrreversibleGate('exploitation', undefined);
    expect(r.allowed).toBe(true);
    expect(r.classes).toEqual([]);
  });

  it('allows when irreversible classes are pre-approved per RoE', () => {
    const r = evaluateIrreversibleGate('exploitation', {
      L3: { irreversible_action_classes: ['data-modify', 'auth-bypass'], pre_approved: true },
    });
    expect(r.allowed).toBe(true);
    expect(r.classes).toEqual(['data-modify', 'auth-bypass']);
    expect(r.reason).toContain('pre-approved');
  });

  it('denies when irreversible classes declared but pre_approved is missing', () => {
    const r = evaluateIrreversibleGate('exploitation', {
      L3: { irreversible_action_classes: ['data-modify'] },
    });
    expect(r.allowed).toBe(false);
    expect(r.classes).toEqual(['data-modify']);
    expect(r.reason).toContain('not pre-approved');
    expect(r.apts_refs).toContain('APTS-HO-010');
  });

  it('denies when irreversible classes declared but pre_approved is false', () => {
    const r = evaluateIrreversibleGate('discovery', {
      L2: { irreversible_action_classes: ['data-modify'], pre_approved: false },
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('--confirm is INSUFFICIENT');
  });

  it('denies even on L1 when irreversible classes are declared without pre_approved', () => {
    // This is the key HO-010 semantic: --confirm cannot bypass irreversible-action gating
    // even on L1 phases. Operator must explicitly opt-in via pre_approved.
    const r = evaluateIrreversibleGate('recon', {
      L1: { irreversible_action_classes: ['config-modify'] },
    });
    expect(r.allowed).toBe(false);
    expect(r.classes).toEqual(['config-modify']);
  });

  it('returns level=null and allows when phase has no AL mapping', () => {
    const r = evaluateIrreversibleGate('unknown-phase', { L1: { irreversible_action_classes: ['x'] } });
    expect(r.allowed).toBe(true);
    expect(r.level).toBeNull();
    expect(r.classes).toEqual([]);
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
