/**
 * Continuous boundary monitoring + breach detection.
 *
 * Closes APTS-AL-016 (Continuous Boundary Monitoring and Breach
 * Detection).
 *
 * Design notes:
 *   - Cluster-3 emits a single scope-validation event at engagement
 *     start. AL-016 requires *continuous* monitoring — every scanner
 *     emission re-validates the finding's target against the loaded
 *     RoE.
 *   - Strategy: per finding, validate the finding's location URL (or
 *     its `file` path for SAST). On out-of-scope detection, emit a
 *     scope-validation breach event and return a halt-decision. The
 *     orchestrator caller is responsible for actually halting; this
 *     module is pure-function so it remains test-friendly.
 */
import { validateTargetInScope, type RoE, type ValidationDecision } from '../roe/types.js';

export interface BreachDetectionResult {
  /** True iff the finding's target/location is in-scope. */
  in_scope: boolean;
  decision: ValidationDecision;
  /** The URL or file the finding referred to. */
  inspected: string;
  apts_refs: string[];
}

export interface FindingLike {
  /** Optional finding-emitted target URL (DAST findings). */
  target?: string;
  /** Optional finding-emitted source file (SAST findings). */
  file?: string;
  /** Optional explicit location URL. */
  location?: string;
}

/**
 * Inspect a finding's location/target/file and validate against the RoE.
 * Returns in_scope=true with the underlying decision when allowed, or
 * in_scope=false with the rejection reason.
 *
 * Findings without any URL/path field (purely advisory) skip validation
 * and return in_scope=true so the orchestrator does not halt on
 * intentionally-unsourced findings.
 */
export function detectScopeBreach(
  f: FindingLike,
  roe: RoE,
): BreachDetectionResult {
  const inspect = pickTarget(f);
  if (!inspect) {
    return {
      in_scope: true,
      decision: {
        allowed: true,
        reason: 'finding has no inspectable URL/path; boundary check skipped',
        apts_refs: ['APTS-AL-016'],
      },
      inspected: '',
      apts_refs: ['APTS-AL-016'],
    };
  }
  // For file paths (SAST), we do not URL-parse — boundary check is
  // currently URL-shaped only. Future work: extend RoE.in_scope.repository_paths
  // to gate file-path findings continuously.
  if (!isUrlLike(inspect)) {
    return {
      in_scope: true,
      decision: {
        allowed: true,
        reason: `finding location is a file path ("${inspect}"); URL boundary check not applicable`,
        apts_refs: ['APTS-AL-016'],
      },
      inspected: inspect,
      apts_refs: ['APTS-AL-016'],
    };
  }
  const decision = validateTargetInScope(inspect, roe);
  return {
    in_scope: decision.allowed,
    decision,
    inspected: inspect,
    apts_refs: ['APTS-AL-016', ...(decision.apts_refs ?? [])],
  };
}

function pickTarget(f: FindingLike): string {
  if (f.location && f.location.length > 0) return f.location;
  if (f.target && f.target.length > 0) return f.target;
  if (f.file && f.file.length > 0) return f.file;
  return '';
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\//i.test(s);
}
