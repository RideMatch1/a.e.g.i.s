/**
 * Authority delegation matrix.
 *
 * Closes APTS-HO-004 (Authority Delegation Matrix).
 *
 * Design notes:
 *   - Operator-supplied delegation matrix in RoE.authorization
 *     declares which roles can approve which action classes. The
 *     orchestrator validates the matrix at engagement start and
 *     emits it into the audit trail; runtime enforcement of the
 *     specific role↔action mapping is deferred to the operator's
 *     own approval workflow (e.g. PagerDuty/Slack approver matching).
 *   - This module focuses on validation + the action-class lookup
 *     used by the escalation framework when it needs to attribute
 *     a halt-pending event to the role that can lift it.
 */

export interface DelegationEntry {
  role: string;
  can_approve: string[];
}

export interface AuthorityMatrixValidation {
  ok: boolean;
  errors: string[];
  matrix?: DelegationEntry[];
  apts_refs: string[];
}

/**
 * Validate the matrix shape: non-empty role + at least one
 * can_approve entry, no duplicate roles, no empty action class
 * strings. Returns ok=true with the (deduplicated) matrix.
 */
export function validateDelegationMatrix(matrix: unknown): AuthorityMatrixValidation {
  if (!Array.isArray(matrix)) {
    return {
      ok: false,
      errors: ['delegation_matrix must be an array'],
      apts_refs: ['APTS-HO-004'],
    };
  }
  const errors: string[] = [];
  const seenRoles = new Set<string>();
  const out: DelegationEntry[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const e = matrix[i];
    if (!e || typeof e !== 'object') {
      errors.push(`entry [${i}]: must be an object`);
      continue;
    }
    const entry = e as Record<string, unknown>;
    const role = entry.role;
    const canApprove = entry.can_approve;
    if (typeof role !== 'string' || role.trim().length === 0) {
      errors.push(`entry [${i}]: role must be a non-empty string`);
      continue;
    }
    if (seenRoles.has(role)) {
      errors.push(`entry [${i}]: duplicate role "${role}"`);
      continue;
    }
    if (!Array.isArray(canApprove) || canApprove.length === 0) {
      errors.push(`entry [${i}]: can_approve must be a non-empty array`);
      continue;
    }
    const approvals = canApprove.filter((a) => typeof a === 'string' && a.length > 0) as string[];
    if (approvals.length !== canApprove.length) {
      errors.push(`entry [${i}]: can_approve contains non-string or empty entries`);
      continue;
    }
    seenRoles.add(role);
    out.push({ role, can_approve: approvals });
  }
  if (errors.length > 0) {
    return { ok: false, errors, apts_refs: ['APTS-HO-004'] };
  }
  return { ok: true, errors: [], matrix: out, apts_refs: ['APTS-HO-004'] };
}

/**
 * Find roles that can approve a given action class. Returns an empty
 * array when no role can — escalation framework treats this as
 * "halt cannot be lifted" and surfaces a different audit message.
 */
export function rolesForAction(matrix: DelegationEntry[], actionClass: string): string[] {
  return matrix.filter((e) => e.can_approve.includes(actionClass)).map((e) => e.role);
}
