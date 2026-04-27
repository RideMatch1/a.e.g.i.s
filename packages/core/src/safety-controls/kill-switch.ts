/**
 * Multi-path kill switch.
 *
 * Closes APTS-SC-009 (Kill Switch).
 *
 * Design notes:
 *   - Signals (SIGINT, SIGTERM, SIGUSR1) are already wired in
 *     `runtime/signals.ts` from Cluster-2. SC-009 requires *more than*
 *     signals — a multi-path kill so a stuck or unreachable engagement
 *     can be terminated by alternate channels.
 *   - Path 1 (signals): existing.
 *   - Path 2 (file-based kill request): operator runs
 *     `aegis siege --kill <state-file>`, which writes a
 *     `<state-file>.killreq` marker. The running engagement polls for
 *     the marker every `pollIntervalMs` (default 2 s) and halts on
 *     detection. Decoupled from process IPC so it works across hosts
 *     (e.g. operator on a separate ssh session).
 *   - Path 3 (dead-man-switch): operator-provided heartbeat URL.
 *     Engagement POSTs a heartbeat every `intervalMs`; consecutive
 *     missed heartbeats (default 3) trigger halt. Defends against the
 *     case where the operator's monitoring infra is the canary.
 */
import { existsSync, writeFileSync } from 'node:fs';

export interface KillRequestWatcherOptions {
  /** Path to watch for a `.killreq` marker (typically `<state-file>.killreq`). */
  markerPath: string;
  /** Poll interval in ms. Default 2000. */
  pollIntervalMs?: number;
  /** Callback fired when the marker is detected. */
  onKillRequest: (markerPath: string) => void;
}

export interface KillRequestWatcherHandle {
  /** Stop polling — call on engagement completion. */
  stop: () => void;
}

/**
 * Start a kill-request watcher. Polls for `markerPath` every
 * `pollIntervalMs` ms and fires `onKillRequest` on first detection.
 * The handle's `stop()` clears the interval.
 */
export function startKillRequestWatcher(
  opts: KillRequestWatcherOptions,
): KillRequestWatcherHandle {
  const interval = opts.pollIntervalMs ?? 2_000;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const tick = (): void => {
    if (stopped) return;
    if (existsSync(opts.markerPath)) {
      stopped = true;
      if (timer) clearInterval(timer);
      opts.onKillRequest(opts.markerPath);
    }
  };
  timer = setInterval(tick, interval);
  // unref so the timer doesn't keep the event loop alive.
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}

/**
 * Write the kill-request marker. Used by the `--kill` CLI subcommand.
 */
export function requestKill(stateFilePath: string, reason = 'operator-requested'): string {
  const markerPath = `${stateFilePath}.killreq`;
  writeFileSync(
    markerPath,
    JSON.stringify({ requested_at: new Date().toISOString(), reason }) + '\n',
  );
  return markerPath;
}

// ---------------------------------------------------------------------------
// Dead-man-switch heartbeat

export interface HeartbeatOptions {
  /** Operator endpoint to POST a heartbeat to (HTTPS only, public IP). */
  url: string;
  /** Heartbeat interval in ms. Default 30 s. */
  intervalMs?: number;
  /** Consecutive missed heartbeats before halt. Default 3. */
  maxConsecutiveFailures?: number;
  /** Callback fired when the failure threshold is hit. */
  onMissedThreshold: (consecutiveFailures: number) => void;
  /** Override fetch — for tests. */
  fetchImpl?: typeof fetch;
}

export interface HeartbeatHandle {
  stop: () => void;
}

/**
 * Start a dead-man-switch heartbeat. Posts an empty body to `url` every
 * `intervalMs` ms; counts consecutive failures (network error, non-2xx
 * status, timeout) and fires `onMissedThreshold` when the count crosses
 * `maxConsecutiveFailures`.
 */
export function startDeadManHeartbeat(opts: HeartbeatOptions): HeartbeatHandle {
  const interval = opts.intervalMs ?? 30_000;
  const threshold = opts.maxConsecutiveFailures ?? 3;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let consecutive = 0;
  let stopped = false;
  let fired = false;
  let timer: NodeJS.Timeout | null = null;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const res = await fetchImpl(opts.url, {
        method: 'POST',
        body: JSON.stringify({ ts: new Date().toISOString() }),
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) {
        consecutive += 1;
      } else {
        consecutive = 0;
      }
    } catch {
      consecutive += 1;
    }
    if (consecutive >= threshold && !fired) {
      fired = true;
      stopped = true;
      if (timer) clearInterval(timer);
      opts.onMissedThreshold(consecutive);
    }
  };
  timer = setInterval(() => {
    void tick();
  }, interval);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}
