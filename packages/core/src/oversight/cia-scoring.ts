/**
 * CIA impact classification + threshold-breach escalation.
 *
 * Closes APTS-SC-001 (Impact Classification + CIA Scoring) +
 * APTS-HO-012 (Impact Threshold Breach Escalation).
 *
 * Design notes:
 *   - Each finding gets a `cia_vector` with three ordinal axes
 *     (confidentiality, integrity, availability), each in
 *     `none | low | medium | high`. Per-CWE default mappings map
 *     OWASP/CWE classes to the impact axes most directly affected.
 *   - Operators override per-finding via the existing suppression
 *     pipeline (out-of-scope here — pipeline is in
 *     `packages/core/src/suppression-filter.ts`).
 *   - HO-012 reuses the same vector: when any axis ≥ threshold the
 *     orchestrator halts pending operator approval.
 */
import type { CiaImpact, Finding } from '../types.js';

/**
 * Per-CWE default CIA mapping. Conservative: unmapped CWEs return
 * `default-low` so the orchestrator never silently misses an issue.
 */
export const CWE_CIA_DEFAULTS: Readonly<Record<number, { c: CiaImpact; i: CiaImpact; a: CiaImpact }>> = Object.freeze({
  // SQL Injection — direct DB access, full triad impact
  89: { c: 'high', i: 'high', a: 'medium' },
  // Cross-Site Scripting — confidentiality (cookie/storage exfil) + integrity (DOM tamper)
  79: { c: 'high', i: 'medium', a: 'low' },
  // CSRF — operator-driven state change
  352: { c: 'medium', i: 'high', a: 'medium' },
  // Path Traversal — direct file-read + occasional write
  22: { c: 'high', i: 'medium', a: 'medium' },
  // OS Command Injection — full RCE class
  78: { c: 'high', i: 'high', a: 'high' },
  // SSRF — internal-network reach + downstream confidentiality
  918: { c: 'high', i: 'medium', a: 'medium' },
  // Hardcoded Credentials — confidentiality + integrity
  798: { c: 'high', i: 'high', a: 'low' },
  // Information Exposure / Sensitive Disclosure
  200: { c: 'high', i: 'low', a: 'low' },
  // XML External Entity (XXE) — file-read + DoS
  611: { c: 'high', i: 'low', a: 'high' },
  // Insecure Deserialization
  502: { c: 'high', i: 'high', a: 'high' },
  // Improper Authentication
  287: { c: 'high', i: 'high', a: 'medium' },
  // Improper Authorization
  285: { c: 'high', i: 'high', a: 'low' },
  // Privilege Escalation
  269: { c: 'high', i: 'high', a: 'medium' },
  // Open Redirect — phishing-class confidentiality
  601: { c: 'medium', i: 'low', a: 'low' },
  // Cryptographic Issues — confidentiality + integrity
  327: { c: 'high', i: 'high', a: 'low' },
  // Race Condition / TOCTOU
  362: { c: 'medium', i: 'high', a: 'medium' },
  // Resource Exhaustion / DoS
  400: { c: 'low', i: 'low', a: 'high' },
  // Improper Input Validation — generic
  20: { c: 'medium', i: 'medium', a: 'low' },
  // Use of Hardcoded Cryptographic Key
  321: { c: 'high', i: 'high', a: 'low' },
  // CRLF / HTTP Response Splitting
  113: { c: 'medium', i: 'medium', a: 'low' },
});

const SEVERITY_TO_DEFAULT_CIA: Readonly<Record<Finding['severity'], { c: CiaImpact; i: CiaImpact; a: CiaImpact }>> = Object.freeze({
  blocker: { c: 'high', i: 'high', a: 'high' },
  critical: { c: 'high', i: 'high', a: 'medium' },
  high: { c: 'high', i: 'medium', a: 'low' },
  medium: { c: 'medium', i: 'medium', a: 'low' },
  low: { c: 'low', i: 'low', a: 'low' },
  info: { c: 'low', i: 'low', a: 'none' },
});

/**
 * Assign a CIA vector to a finding. Per-CWE default if mapped;
 * otherwise fall back to severity-based default.
 */
export function assignCiaVector(f: Pick<Finding, 'cwe' | 'severity'>): { c: CiaImpact; i: CiaImpact; a: CiaImpact } {
  if (f.cwe !== undefined && CWE_CIA_DEFAULTS[f.cwe]) {
    return { ...CWE_CIA_DEFAULTS[f.cwe] };
  }
  return { ...SEVERITY_TO_DEFAULT_CIA[f.severity] };
}

const IMPACT_RANK: Readonly<Record<CiaImpact, number>> = Object.freeze({
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
});

export interface CiaThresholdEvaluation {
  breach: boolean;
  axes_breached: Array<'c' | 'i' | 'a'>;
  rationale: string;
  apts_refs: string[];
}

/**
 * Evaluate a CIA vector against a threshold. Returns breach=true if
 * ANY axis equals-or-exceeds the configured threshold for that axis.
 */
export function evaluateCiaThreshold(
  vector: { c: CiaImpact; i: CiaImpact; a: CiaImpact },
  threshold: { c?: CiaImpact; i?: CiaImpact; a?: CiaImpact },
): CiaThresholdEvaluation {
  const breached: Array<'c' | 'i' | 'a'> = [];
  for (const axis of ['c', 'i', 'a'] as const) {
    const t = threshold[axis];
    if (t !== undefined && IMPACT_RANK[vector[axis]] >= IMPACT_RANK[t]) {
      breached.push(axis);
    }
  }
  if (breached.length === 0) {
    return {
      breach: false,
      axes_breached: [],
      rationale: 'CIA vector below all configured thresholds',
      apts_refs: ['APTS-SC-001'],
    };
  }
  return {
    breach: true,
    axes_breached: breached,
    rationale: `CIA threshold breached on ${breached.join(', ')} axis (${breached.map((a) => `${a}=${vector[a]}`).join(', ')})`,
    apts_refs: ['APTS-SC-001', 'APTS-HO-012'],
  };
}
