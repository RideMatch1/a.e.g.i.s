// templates/nextjs-supabase/files/lib/api/require-role.ts
import { ForbiddenError } from '../errors';

export interface AuthContext {
  userId: string;
  role: string | null;
}

/**
 * Throw ForbiddenError unless `context.role` is one of `allowedRoles`.
 * Use at the top of every route handler that has role-restricted
 * semantics. The scanner's auth-enforcer treats `requireRole` as a
 * recognised guard — its presence suppresses the "missing auth"
 * finding for the route.
 */
export function requireRole(context: AuthContext, allowedRoles: readonly string[]): void {
  if (context.role === null || !allowedRoles.includes(context.role)) {
    throw new ForbiddenError(
      `role '${context.role ?? 'none'}' not in [${allowedRoles.join(', ')}]`,
    );
  }
}

/**
 * Authorise the request if EITHER the user has a privileged role OR
 * the resource belongs to them (self-access pattern). Use for routes
 * that operate on a user-id-scoped resource where managers can read
 * any row but members can only read their own.
 */
export function requireRoleOrSelf(
  context: AuthContext,
  allowedRoles: readonly string[],
  targetUserId: string,
): void {
  if (context.userId === targetUserId) return;
  requireRole(context, allowedRoles);
}

/** Convenience predicate for manager-or-above. */
export function isManager(context: AuthContext): boolean {
  return context.role === 'manager' || context.role === 'admin';
}
