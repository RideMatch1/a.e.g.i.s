/**
 * Post-test system integrity validation.
 *
 * Closes APTS-SC-015 (Post-Test System Integrity Validation).
 *
 * Design notes:
 *   - Run after the engagement's reporting phase. Confirms the target
 *     service is still responsive and records a final state-snapshot
 *     for the audit trail. A non-responsive target after engagement is
 *     a regression signal — record it explicitly.
 *   - Uses safeFetch for the probe (same SSRF defenses as the rest of
 *     orchestrator HTTP egress).
 *   - The pre-engagement baseline is optional; when supplied, the
 *     verdict includes a response-time delta so spikes are visible.
 */
import { safeFetch, isSafeFetchRejection } from '../manipulation-resistance/redirect-policy.js';

export interface IntegrityProbeBaseline {
  /** Pre-engagement target response time in ms. */
  baseline_response_ms: number;
  /** Pre-engagement HTTP status. */
  baseline_status: number;
}

export interface IntegrityProbeResult {
  ok: boolean;
  reason?: string;
  observed?: {
    status: number;
    response_ms: number;
    response_delta_ms?: number;
  };
  apts_refs: string[];
}

export interface IntegrityProbeOptions {
  /** Optional baseline captured at engagement-start. */
  baseline?: IntegrityProbeBaseline;
  /** Maximum acceptable response-time delta vs baseline in ms. Default 5000. */
  max_response_delta_ms?: number;
  /** Probe timeout in ms. Default 10_000. */
  timeout_ms?: number;
  /** Operator opt-in to permit loopback probe. Mirrors siege --allow-loopback. */
  allowLoopback?: boolean;
  /** Override safeFetch — for tests. */
  fetchImpl?: typeof safeFetch;
}

/**
 * Probe the target with HEAD via safeFetch. Returns ok=false if the
 * probe rejects, the status is 5xx, or the response-time delta vs
 * baseline exceeds the threshold.
 */
export async function probeTargetIntegrity(
  target: string,
  opts: IntegrityProbeOptions = {},
): Promise<IntegrityProbeResult> {
  const fetchImpl = opts.fetchImpl ?? safeFetch;
  const timeoutMs = opts.timeout_ms ?? 10_000;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetchImpl(target, {
      method: 'HEAD',
      signal: controller.signal,
      allowLoopback: opts.allowLoopback === true,
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    const observed: IntegrityProbeResult['observed'] = {
      status: res.status,
      response_ms: elapsed,
    };
    if (opts.baseline) {
      observed.response_delta_ms = elapsed - opts.baseline.baseline_response_ms;
    }
    if (res.status >= 500) {
      return {
        ok: false,
        reason: `target returned ${res.status} (server-side fault) after engagement`,
        observed,
        apts_refs: ['APTS-SC-015'],
      };
    }
    if (
      opts.baseline &&
      observed.response_delta_ms !== undefined &&
      observed.response_delta_ms > (opts.max_response_delta_ms ?? 5_000)
    ) {
      return {
        ok: false,
        reason: `target response time spiked by ${observed.response_delta_ms} ms vs pre-engagement baseline (${opts.baseline.baseline_response_ms} → ${elapsed} ms)`,
        observed,
        apts_refs: ['APTS-SC-015'],
      };
    }
    return { ok: true, observed, apts_refs: ['APTS-SC-015'] };
  } catch (err) {
    if (isSafeFetchRejection(err)) {
      return {
        ok: false,
        reason: `post-test integrity probe rejected by safeFetch policy: ${err.reason}`,
        apts_refs: ['APTS-SC-015', 'APTS-MR-009'],
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `post-test integrity probe failed: ${msg}`,
      apts_refs: ['APTS-SC-015'],
    };
  }
}
