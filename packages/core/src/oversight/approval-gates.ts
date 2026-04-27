/**
 * Pre-approval gates per autonomy level + mandatory human decision points.
 *
 * Closes APTS-HO-001 (Pre-Approval Gates per AL-level) +
 * APTS-HO-010 (Mandatory Human Decision Points).
 *
 * Design notes:
 *   - APTS recognizes 4 autonomy levels (L1-L4). AEGIS scanner
 *     phases map onto these: recon = L1, discovery = L2, exploitation
 *     = L3, reporting = L4. RoE.autonomy_levels declares whether
 *     each level requires an explicit approval before its phase
 *     dispatches.
 *   - HO-010 reuses the same machinery for irreversible-action
 *     classes (auth-bypass, data-modify, config-modify, ddos) — the
 *     orchestrator pauses at phase entry when the corresponding
 *     class is in the per-phase policy.
 *   - Approval semantics: pre-engagement consent (operator-attested
 *     in RoE.authorization.statement) authorizes L1+L2 by default;
 *     L3+L4 require explicit per-engagement opt-in via the
 *     `aegis siege --approve <level>` flow (or RoE.autonomy_levels.LX.pre_approved).
 */

export type AutonomyLevel = 'L1' | 'L2' | 'L3' | 'L4';

export const PHASE_TO_AUTONOMY_LEVEL: Readonly<Record<string, AutonomyLevel>> = Object.freeze({
  recon: 'L1',
  discovery: 'L2',
  exploitation: 'L3',
  reporting: 'L4',
});

export interface AutonomyLevelPolicy {
  approval_required?: boolean;
  pre_approved?: boolean;
  irreversible_action_classes?: string[];
}

export interface AutonomyLevelsConfig {
  L1?: AutonomyLevelPolicy;
  L2?: AutonomyLevelPolicy;
  L3?: AutonomyLevelPolicy;
  L4?: AutonomyLevelPolicy;
}

export interface ApprovalGateDecision {
  allowed: boolean;
  reason: string;
  level: AutonomyLevel;
  apts_refs: string[];
}

/**
 * Decide whether a phase entry is authorized. Returns allowed=true
 * when (a) no approval is required, (b) approval is pre-approved, or
 * (c) the operator has confirmed engagement-wide consent.
 */
export function evaluateApprovalGate(
  phase: string,
  autonomyLevels: AutonomyLevelsConfig | undefined,
  engagementConfirmed: boolean,
): ApprovalGateDecision {
  const level = PHASE_TO_AUTONOMY_LEVEL[phase];
  if (!level) {
    return {
      allowed: true,
      reason: `phase "${phase}" has no AL mapping; allowing by default`,
      level: 'L1',
      apts_refs: ['APTS-HO-001'],
    };
  }
  const policy = autonomyLevels?.[level];
  if (!policy || policy.approval_required !== true) {
    return {
      allowed: true,
      reason: `${level}: approval not required per RoE`,
      level,
      apts_refs: ['APTS-HO-001'],
    };
  }
  if (policy.pre_approved === true) {
    return {
      allowed: true,
      reason: `${level}: pre-approved per RoE.autonomy_levels.${level}.pre_approved`,
      level,
      apts_refs: ['APTS-HO-001'],
    };
  }
  // Engagement-wide consent (--confirm) authorizes L1+L2 by default.
  if (engagementConfirmed && (level === 'L1' || level === 'L2')) {
    return {
      allowed: true,
      reason: `${level}: authorized via engagement-wide --confirm`,
      level,
      apts_refs: ['APTS-HO-001'],
    };
  }
  return {
    allowed: false,
    reason: `${level}: approval required but not pre-approved — engagement halts pending operator confirmation`,
    level,
    apts_refs: ['APTS-HO-001', 'APTS-HO-010'],
  };
}

/**
 * Identify whether a phase invocation includes an irreversible action
 * class that requires HO-010 mandatory human-decision-point gating.
 *
 * Returns the matched classes (empty array means no gate required).
 */
export function detectIrreversibleActions(
  phase: string,
  autonomyLevels: AutonomyLevelsConfig | undefined,
): string[] {
  const level = PHASE_TO_AUTONOMY_LEVEL[phase];
  if (!level || !autonomyLevels?.[level]?.irreversible_action_classes) return [];
  return [...(autonomyLevels[level]?.irreversible_action_classes ?? [])];
}
