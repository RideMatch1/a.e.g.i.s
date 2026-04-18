// templates/nextjs-supabase/files/lib/api/require-role.test.ts
import { describe, it, expect } from 'vitest';
import { requireRole, requireRoleOrSelf, isManager } from './require-role';
import { ForbiddenError } from '../errors';

describe('requireRole', () => {
  it('passes when user role is in the allow-list', () => {
    expect(() => requireRole({ userId: 'u1', role: 'admin' }, ['admin', 'manager'])).not.toThrow();
  });

  it('throws ForbiddenError when user role is not in the allow-list', () => {
    expect(() => requireRole({ userId: 'u1', role: 'member' }, ['admin'])).toThrow(ForbiddenError);
  });

  it('throws when context has no role', () => {
    expect(() => requireRole({ userId: 'u1', role: null }, ['admin'])).toThrow(ForbiddenError);
  });
});

describe('requireRoleOrSelf', () => {
  it('passes when role matches', () => {
    expect(() => requireRoleOrSelf({ userId: 'u1', role: 'admin' }, ['admin'], 'u2')).not.toThrow();
  });

  it('passes when userId matches target (self-access)', () => {
    expect(() => requireRoleOrSelf({ userId: 'u1', role: 'member' }, ['admin'], 'u1')).not.toThrow();
  });

  it('throws when neither role nor self match', () => {
    expect(() => requireRoleOrSelf({ userId: 'u1', role: 'member' }, ['admin'], 'u2')).toThrow(ForbiddenError);
  });
});

describe('isManager', () => {
  it('is true for manager / admin roles', () => {
    expect(isManager({ userId: 'u1', role: 'manager' })).toBe(true);
    expect(isManager({ userId: 'u1', role: 'admin' })).toBe(true);
  });

  it('is false for member / null', () => {
    expect(isManager({ userId: 'u1', role: 'member' })).toBe(false);
    expect(isManager({ userId: 'u1', role: null })).toBe(false);
  });
});
