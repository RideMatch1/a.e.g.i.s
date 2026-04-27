/**
 * APTS-HO-004 — authority delegation matrix tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validateDelegationMatrix,
  rolesForAction,
} from '../../src/oversight/authority-matrix.js';

describe('validateDelegationMatrix', () => {
  it('rejects non-array inputs', () => {
    const r = validateDelegationMatrix({ role: 'lead' });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/must be an array/);
  });

  it('rejects entries with missing role', () => {
    const r = validateDelegationMatrix([{ can_approve: ['phase-3'] }]);
    expect(r.ok).toBe(false);
  });

  it('rejects entries with empty can_approve', () => {
    const r = validateDelegationMatrix([{ role: 'lead', can_approve: [] }]);
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate roles', () => {
    const r = validateDelegationMatrix([
      { role: 'lead', can_approve: ['phase-3'] },
      { role: 'lead', can_approve: ['phase-4'] },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/duplicate role/);
  });

  it('rejects non-string entries inside can_approve', () => {
    const r = validateDelegationMatrix([{ role: 'lead', can_approve: [42] }]);
    expect(r.ok).toBe(false);
  });

  it('accepts a valid matrix', () => {
    const r = validateDelegationMatrix([
      { role: 'lead', can_approve: ['phase-3', 'data-modify'] },
      { role: 'reviewer', can_approve: ['phase-4'] },
    ]);
    expect(r.ok).toBe(true);
    expect(r.matrix?.length).toBe(2);
  });
});

describe('rolesForAction', () => {
  const matrix = [
    { role: 'lead', can_approve: ['phase-3', 'data-modify'] },
    { role: 'reviewer', can_approve: ['phase-4', 'data-modify'] },
  ];

  it('returns all roles that can approve the action', () => {
    const r = rolesForAction(matrix, 'data-modify');
    expect(r.sort()).toEqual(['lead', 'reviewer']);
  });

  it('returns only matching roles', () => {
    expect(rolesForAction(matrix, 'phase-3')).toEqual(['lead']);
  });

  it('returns empty when no role can approve', () => {
    expect(rolesForAction(matrix, 'nonexistent')).toEqual([]);
  });
});
