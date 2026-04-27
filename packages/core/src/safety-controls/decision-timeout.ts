/**
 * Per-phase decision timeout with default-safe halt.
 *
 * Closes APTS-HO-003 (Decision Timeout and Default-Safe Behavior).
 *
 * Design notes:
 *   - HO-003 mandates that an indefinitely-running phase eventually
 *     hits a decision boundary; the default behavior on timeout is
 *     halt (the safe choice for an offensive engagement) rather than
 *     continue.
 *   - `withPhaseTimeout` wraps a phase promise. If the phase resolves
 *     before the deadline it returns its value; otherwise it returns
 *     a structured TimeoutResult so the caller can record the halt
 *     in the audit channel.
 *   - The wrapped promise is signaled via AbortController; whether it
 *     actually terminates is the wrapped function's responsibility.
 *     We always race so the orchestrator is never stuck.
 */

export interface TimeoutOk<T> {
  timed_out: false;
  value: T;
}

export interface TimeoutFailure {
  timed_out: true;
  /** Phase name supplied by caller. */
  phase: string;
  /** Configured timeout in ms. */
  timeout_ms: number;
  /** Default-safe action that fired. Always 'halt' for offensive engagements. */
  default_action: 'halt';
  reason: string;
  apts_refs: string[];
}

export type TimeoutResult<T> = TimeoutOk<T> | TimeoutFailure;

export interface PhaseTimeoutOptions {
  phase: string;
  timeout_ms: number;
  /** AbortController to signal the wrapped phase. Caller wires it through. */
  controller?: AbortController;
}

/**
 * Wrap a phase promise with a default-safe timeout. On timeout, returns
 * { timed_out: true, ... }; the caller emits a halt event and stops.
 */
export async function withPhaseTimeout<T>(
  phasePromise: Promise<T>,
  opts: PhaseTimeoutOptions,
): Promise<TimeoutResult<T>> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<TimeoutFailure>((resolve) => {
    timer = setTimeout(() => {
      if (opts.controller) opts.controller.abort();
      resolve({
        timed_out: true,
        phase: opts.phase,
        timeout_ms: opts.timeout_ms,
        default_action: 'halt',
        reason: `phase "${opts.phase}" exceeded ${opts.timeout_ms} ms decision timeout — default-safe halt`,
        apts_refs: ['APTS-HO-003'],
      });
    }, opts.timeout_ms);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });

  const value = await Promise.race([
    phasePromise.then(
      (v): TimeoutOk<T> => ({ timed_out: false, value: v }),
      (err): never => {
        // Propagate errors so the caller's existing catch handles them.
        throw err;
      },
    ),
    timeoutPromise,
  ]);
  if (timer) clearTimeout(timer);
  return value;
}

/**
 * Compute the per-phase timeout from RoE.stop_conditions when the
 * operator supplies an explicit phase_timeout_minutes. Otherwise
 * derive 1/4 of max_duration_minutes (4 phases) when present, else
 * fall back to the supplied default.
 */
export function derivePhaseTimeoutMs(
  stopConditions: { max_duration_minutes?: number; phase_timeout_minutes?: number },
  defaultMs: number,
): number {
  if (stopConditions.phase_timeout_minutes !== undefined) {
    return stopConditions.phase_timeout_minutes * 60_000;
  }
  if (stopConditions.max_duration_minutes !== undefined) {
    return Math.round((stopConditions.max_duration_minutes * 60_000) / 4);
  }
  return defaultMs;
}
