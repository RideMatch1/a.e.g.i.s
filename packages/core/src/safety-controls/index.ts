/**
 * Safety Controls public surface.
 *
 * Closes APTS Tier-1 entries: SC-009 (multi-path kill switch), SC-010
 * (health monitoring + auto-halt), SC-015 (post-test integrity), AL-016
 * (continuous boundary monitoring), HO-003 (decision timeout).
 */
export {
  startKillRequestWatcher,
  requestKill,
  startDeadManHeartbeat,
  type KillRequestWatcherOptions,
  type KillRequestWatcherHandle,
  type HeartbeatOptions,
  type HeartbeatHandle,
} from './kill-switch.js';

export {
  runHealthCheck,
  newHealthCounters,
  currentHeapMb,
  errorRate,
  type HealthThresholds,
  type HealthCounters,
  type HealthCheckResult,
} from './health-monitor.js';

export {
  probeTargetIntegrity,
  type IntegrityProbeBaseline,
  type IntegrityProbeResult,
  type IntegrityProbeOptions,
} from './post-test-integrity.js';

export {
  detectScopeBreach,
  type FindingLike,
  type BreachDetectionResult,
} from './boundary-monitor.js';

export {
  withPhaseTimeout,
  derivePhaseTimeoutMs,
  type TimeoutResult,
  type TimeoutOk,
  type TimeoutFailure,
  type PhaseTimeoutOptions,
} from './decision-timeout.js';
