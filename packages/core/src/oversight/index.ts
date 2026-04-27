/**
 * Oversight public surface.
 *
 * Closes APTS Tier-1 entries: SC-001 (CIA scoring), HO-001 (pre-approval
 * gates per AL-level), HO-004 (authority delegation matrix), HO-010
 * (mandatory human decision points), HO-011 (unexpected-finding
 * escalation), HO-012 (impact-threshold-breach escalation), HO-013
 * (confidence-based escalation), HO-014 (legal/compliance escalation
 * triggers).
 */
export {
  assignCiaVector,
  evaluateCiaThreshold,
  CWE_CIA_DEFAULTS,
  type CiaThresholdEvaluation,
} from './cia-scoring.js';

export {
  evaluateApprovalGate,
  detectIrreversibleActions,
  PHASE_TO_AUTONOMY_LEVEL,
  type AutonomyLevel,
  type AutonomyLevelPolicy,
  type AutonomyLevelsConfig,
  type ApprovalGateDecision,
} from './approval-gates.js';

export {
  validateDelegationMatrix,
  rolesForAction,
  type DelegationEntry,
  type AuthorityMatrixValidation,
} from './authority-matrix.js';

export {
  escalateOnSeverity,
  escalateOnConfidence,
  escalateOnComplianceTrigger,
  type SeverityEscalationConfig,
  type ConfidencePauseConfig,
  type ComplianceTriggerConfig,
  type EscalationDecision,
} from './escalation.js';
