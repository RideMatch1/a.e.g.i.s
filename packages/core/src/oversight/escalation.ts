/**
 * Unexpected-finding + confidence-based + compliance-trigger escalation.
 *
 * Closes APTS-HO-011 (Unexpected Findings Escalation Framework) +
 * APTS-HO-013 (Confidence-Based Escalation) +
 * APTS-HO-014 (Legal/Compliance Escalation Triggers).
 *
 * Design notes:
 *   - HO-011: when a finding's severity ≥ a configurable escalation
 *     threshold, return a halt-pending decision so the orchestrator
 *     emits a critical-finding event with stop_action `halt` and
 *     surfaces the finding for operator review.
 *   - HO-013: when finding.confidence === 'low', return a pause
 *     decision so operators can verify before continuing — extends
 *     the post-hoc `[LOW-CONFIDENCE]` PR badge to in-engagement.
 *   - HO-014: scan finding text for regulatory class markers
 *     (PII, PCI, PHI, GDPR, HIPAA) supplied by the operator's RoE.
 *     `on_match` is `halt` (default) or `notify`.
 */
import type { Finding, Severity, Confidence } from '../types.js';

const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
  blocker: 5,
});

export interface SeverityEscalationConfig {
  /** Severity at which escalation fires. Default 'high'. */
  threshold?: Severity;
}

export interface EscalationDecision {
  escalate: boolean;
  /** Action: 'halt' for halt-pending-approval, 'notify' for soft notify, 'continue' for no-op. */
  action: 'halt' | 'notify' | 'continue';
  reason: string;
  apts_refs: string[];
}

/**
 * HO-011 — escalate findings whose severity meets or exceeds threshold.
 */
export function escalateOnSeverity(
  finding: Pick<Finding, 'severity' | 'id'>,
  config: SeverityEscalationConfig = {},
): EscalationDecision {
  const threshold = config.threshold ?? 'high';
  if (SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[threshold]) {
    return {
      escalate: true,
      action: 'halt',
      reason: `finding ${finding.id} severity ${finding.severity} ≥ escalation threshold ${threshold}`,
      apts_refs: ['APTS-HO-011'],
    };
  }
  return {
    escalate: false,
    action: 'continue',
    reason: `finding ${finding.id} severity ${finding.severity} below threshold ${threshold}`,
    apts_refs: ['APTS-HO-011'],
  };
}

export interface ConfidencePauseConfig {
  /** When true, pause-on-low fires. Default false (operator opt-in). */
  pause_on_low?: boolean;
}

/**
 * HO-013 — pause when finding.confidence === 'low' and the operator
 * has opted into pause_on_low. Otherwise emit a notify (soft) for the
 * audit trail.
 */
export function escalateOnConfidence(
  finding: Pick<Finding, 'confidence' | 'id'>,
  config: ConfidencePauseConfig = {},
): EscalationDecision {
  const c: Confidence | undefined = finding.confidence;
  if (c !== 'low') {
    return {
      escalate: false,
      action: 'continue',
      reason: `finding ${finding.id} confidence "${c ?? 'unset'}" not low`,
      apts_refs: ['APTS-HO-013'],
    };
  }
  if (config.pause_on_low === true) {
    return {
      escalate: true,
      action: 'halt',
      reason: `finding ${finding.id} confidence is low — engagement paused for verification`,
      apts_refs: ['APTS-HO-013'],
    };
  }
  return {
    escalate: true,
    action: 'notify',
    reason: `finding ${finding.id} confidence is low — soft escalation (set pause_on_low to halt)`,
    apts_refs: ['APTS-HO-013'],
  };
}

export interface ComplianceTriggerConfig {
  /** Regulatory class markers operators want flagged. */
  regulatory_class: string[];
  /** Action on match. Default `halt`. */
  on_match?: 'halt' | 'notify';
}

const DEFAULT_REGULATORY_PATTERNS: Readonly<Record<string, RegExp>> = Object.freeze({
  PII: /\b(?:PII|personal[\s-]?identifiable|personally[\s-]?identifiable|GDPR)\b/iu,
  PCI: /\b(?:PCI(?:[\s-]?DSS)?|cardholder[\s-]?data|primary[\s-]?account[\s-]?number|CVV)\b/iu,
  PHI: /\b(?:PHI|protected[\s-]?health|HIPAA|patient[\s-]?record)\b/iu,
  GDPR: /\b(?:GDPR|right[\s-]?to[\s-]?erasure|data[\s-]?subject)\b/iu,
  HIPAA: /\bHIPAA\b/iu,
  SOX: /\b(?:Sarbanes[\s-]?Oxley|SOX[\s-]?compliance|SOX)\b/iu,
});

/**
 * HO-014 — match a finding's text against the operator's regulatory
 * class triggers. Returns escalate=true when any class matches; the
 * action is `halt` or `notify` per the operator's policy.
 */
export function escalateOnComplianceTrigger(
  finding: Pick<Finding, 'title' | 'description' | 'id'>,
  config: ComplianceTriggerConfig,
): EscalationDecision {
  const text = `${finding.title}\n${finding.description ?? ''}`;
  const matched: string[] = [];
  for (const cls of config.regulatory_class) {
    const re = DEFAULT_REGULATORY_PATTERNS[cls.toUpperCase()];
    if (!re) continue;
    if (re.test(text)) matched.push(cls);
  }
  if (matched.length === 0) {
    return {
      escalate: false,
      action: 'continue',
      reason: `finding ${finding.id} did not match any configured regulatory class`,
      apts_refs: ['APTS-HO-014'],
    };
  }
  return {
    escalate: true,
    action: config.on_match ?? 'halt',
    reason: `finding ${finding.id} matched regulatory class(es): ${matched.join(', ')}`,
    apts_refs: ['APTS-HO-014'],
  };
}
