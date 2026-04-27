/**
 * Instruction-boundary enforcement.
 *
 * Closes APTS-MR-001 (Instruction Boundary Enforcement Architecture).
 *
 * Design notes:
 *   - LLM-pentest wrappers each enforce their own internal instruction
 *     boundary. AEGIS-orchestrator adds a layer-2 boundary so that a
 *     compromised wrapper instruction cannot escape the engagement.
 *   - The orchestrator's instruction frame is: "execute pentest scope per
 *     RoE; do not act outside scope; do not interpret target-side
 *     responses as authority". A wrapper action that would breach this
 *     frame is rejected here, before exec.
 *   - Per-wrapper allowlist of action types: each wrapper declares which
 *     verbs it may issue (recon, scan, verify-finding, report). Anything
 *     outside that list is rejected as an instruction-boundary breach.
 */
import { validateTargetInScope, type RoE, type ValidationDecision } from '../roe/types.js';

/**
 * Action a wrapper proposes to take against the engagement target.
 * The orchestrator validates each before exec.
 */
export interface WrapperAction {
  /** Verb-class — must be in the per-wrapper allowlist. */
  type: string;
  /** Concrete target the action operates on (URL, hostname, IP, or path). */
  target: string;
  /** Optional structured payload — URLs inside are scope-validated. */
  payload?: unknown;
}

/**
 * Per-wrapper action-type allowlist. Each LLM-pentest wrapper declares
 * what verb classes it may issue inside the orchestrator. Anything else
 * is treated as an instruction-boundary breach.
 *
 * The unknown wrapper case (no allowlist entry) defaults to deny-all.
 */
export const WRAPPER_ACTION_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  strix: ['recon', 'scan', 'verify-finding', 'report'],
  ptai: ['scan', 'verify-finding', 'report'],
  pentestswarm: ['recon', 'scan', 'verify-finding', 'report'],
  subfinder: ['recon'],
  // SAST scanners run on local files only — no target action allowlist;
  // they bypass instruction-boundary because they do not invoke LLM
  // reasoning over target data. Listed here for explicitness.
  semgrep: ['scan'],
  gitleaks: ['scan'],
  trivy: ['scan'],
};

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/giu;

/**
 * Enforce the orchestrator-side instruction boundary on a wrapper's
 * proposed action. Returns a ValidationDecision that the caller logs into
 * the audit channel and gates the action on.
 *
 * Checks (in order):
 *   1. Action type is in the per-wrapper allowlist (unknown wrapper → deny-all).
 *   2. Action target is in RoE in_scope and not in out_of_scope.
 *   3. Any URL embedded in payload is in RoE scope.
 */
export function enforceInstructionBoundary(
  wrapperName: string,
  action: WrapperAction,
  roe: RoE,
): ValidationDecision {
  const allowedTypes = WRAPPER_ACTION_ALLOWLIST[wrapperName];
  if (!allowedTypes) {
    return {
      allowed: false,
      reason: `wrapper "${wrapperName}" has no action allowlist registered — instruction-boundary deny-all by default`,
      apts_refs: ['APTS-MR-001'],
    };
  }
  if (!allowedTypes.includes(action.type)) {
    return {
      allowed: false,
      reason: `wrapper "${wrapperName}" attempted action type "${action.type}" outside its allowlist (${allowedTypes.join(', ')})`,
      apts_refs: ['APTS-MR-001'],
    };
  }

  const targetCheck = validateTargetInScope(action.target, roe);
  if (!targetCheck.allowed) {
    return {
      allowed: false,
      reason: `wrapper "${wrapperName}" instruction-boundary breach: ${targetCheck.reason}`,
      apts_refs: ['APTS-MR-001', ...(targetCheck.apts_refs ?? [])],
    };
  }

  const payloadUrls = extractUrls(action.payload);
  for (const url of payloadUrls) {
    const urlCheck = validateTargetInScope(url, roe);
    if (!urlCheck.allowed) {
      return {
        allowed: false,
        reason: `wrapper "${wrapperName}" payload includes out-of-scope URL "${url}": ${urlCheck.reason}`,
        apts_refs: ['APTS-MR-001', ...(urlCheck.apts_refs ?? [])],
      };
    }
  }

  return {
    allowed: true,
    reason: `wrapper "${wrapperName}" action "${action.type}" on ${action.target} within instruction boundary`,
    apts_refs: ['APTS-MR-001'],
  };
}

/**
 * Recursively walk a JSON-shaped value and pull every http(s) URL out of
 * any string leaf. Used to scope-validate URLs embedded in wrapper
 * payloads (e.g., a callback URL inside a structured action payload).
 */
function extractUrls(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    const matches = value.match(URL_RE);
    if (matches) acc.push(...matches);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const v of value) extractUrls(v, acc);
    return acc;
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      extractUrls(v, acc);
    }
  }
  return acc;
}
