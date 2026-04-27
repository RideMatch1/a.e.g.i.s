/**
 * Manipulation Resistance public surface.
 *
 * Closes APTS Tier-1 Manipulation Resistance domain (MR-001/002/004/005/
 * 007/008/009/010/011/012/018). Each module documents its individual
 * APTS coverage; this barrel re-exports everything operator/orchestrator
 * code needs.
 */
export {
  enforceInstructionBoundary,
  WRAPPER_ACTION_ALLOWLIST,
  type WrapperAction,
} from './instruction-boundary.js';

export {
  validateWrapperResponse,
  detectAuthorityClaim,
  type ResponseValidation,
  type AuthorityClaim,
  type AuthorityClaimResult,
} from './response-validator.js';

export {
  pinConfig,
  verifyConfig,
  type ConfigPin,
  type ConfigVerifyResult,
} from './config-integrity.js';

export {
  safeFetch,
  classifyIp,
  isSafeFetchRejection,
  type SafeFetchOptions,
  type SafeFetchRejection,
  type SafeFetchRejectReason,
} from './redirect-policy.js';

export {
  detectScopeExpansion,
  type ScopeExpansionKind,
  type ScopeExpansionResult,
} from './scope-expansion-detector.js';

export {
  composeEgressAllowlist,
  withEgressEnv,
  ORCHESTRATOR_ESSENTIALS,
  type EgressAllowlist,
  type ComposeEgressAllowlistOptions,
} from './oob-blocker.js';

export {
  validateSandboxMode,
  wrapForSandbox,
  SANDBOX_MODES,
  DEFAULT_WRAPPER_IMAGES,
  type SandboxMode,
  type SandboxModeValidation,
  type WrapForSandboxOptions,
  type WrappedExec,
} from './ai-io-boundary.js';
