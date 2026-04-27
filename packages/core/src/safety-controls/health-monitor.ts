/**
 * Per-engagement health probe with auto-halt thresholds.
 *
 * Closes APTS-SC-010 (Health Check Monitoring with Threshold-Based
 * Automatic Halt).
 *
 * Design notes:
 *   - Three independent thresholds: heap memory, error rate, target
 *     response time. Each is checked at every phase boundary; any
 *     breach returns a halt-decision with the specific threshold that
 *     fired.
 *   - The orchestrator caller increments `record*` counters as events
 *     flow through; the snapshot reflects the rolling window.
 *   - Defaults are operator-friendly (1 GB heap, 50% error rate, 10 s
 *     response). RoE.safety_controls overrides per engagement.
 */

export interface HealthThresholds {
  /** Maximum heap-used in MB before halt. Default 1024. */
  max_heap_mb?: number;
  /** Maximum error rate (0..1) over the rolling window before halt. Default 0.5. */
  max_error_rate?: number;
  /** Maximum target HEAD response time in ms before halt. Default 10_000. */
  max_target_response_ms?: number;
}

export interface HealthCounters {
  /** Total event-emit attempts. Includes both ok + error paths. */
  total_events: number;
  /** Subset of total_events that errored. */
  error_events: number;
  /** Most recent target HEAD response time in ms (or null if not measured). */
  last_target_response_ms: number | null;
}

export interface HealthCheckResult {
  ok: boolean;
  reason?: string;
  observed?: {
    heap_mb: number;
    error_rate: number;
    target_response_ms: number | null;
  };
  apts_refs: string[];
}

const DEFAULTS: Required<HealthThresholds> = {
  max_heap_mb: 1024,
  max_error_rate: 0.5,
  max_target_response_ms: 10_000,
};

/**
 * Read process heap memory in MB.
 */
export function currentHeapMb(): number {
  return Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 100) / 100;
}

/**
 * Compute the rolling error rate from counters.
 */
export function errorRate(c: HealthCounters): number {
  if (c.total_events === 0) return 0;
  return c.error_events / c.total_events;
}

/**
 * Run a health-check snapshot. Returns ok=true if every threshold is
 * within bounds; otherwise ok=false with the specific reason and
 * observed values for the audit trail.
 */
export function runHealthCheck(
  counters: HealthCounters,
  thresholds: HealthThresholds = {},
): HealthCheckResult {
  const t = { ...DEFAULTS, ...thresholds };
  const heapMb = currentHeapMb();
  const er = errorRate(counters);
  const trMs = counters.last_target_response_ms;
  const observed = { heap_mb: heapMb, error_rate: er, target_response_ms: trMs };

  if (heapMb > t.max_heap_mb) {
    return {
      ok: false,
      reason: `heap memory ${heapMb} MB exceeds threshold ${t.max_heap_mb} MB`,
      observed,
      apts_refs: ['APTS-SC-010'],
    };
  }
  if (er > t.max_error_rate) {
    return {
      ok: false,
      reason: `error rate ${(er * 100).toFixed(1)}% exceeds threshold ${(t.max_error_rate * 100).toFixed(1)}%`,
      observed,
      apts_refs: ['APTS-SC-010'],
    };
  }
  if (trMs !== null && trMs > t.max_target_response_ms) {
    return {
      ok: false,
      reason: `target response time ${trMs} ms exceeds threshold ${t.max_target_response_ms} ms`,
      observed,
      apts_refs: ['APTS-SC-010'],
    };
  }
  return { ok: true, observed, apts_refs: ['APTS-SC-010'] };
}

/**
 * Allocate a fresh counters object. Caller mutates as events flow.
 */
export function newHealthCounters(): HealthCounters {
  return { total_events: 0, error_events: 0, last_target_response_ms: null };
}
