/**
 * Signal handlers for siege engagements.
 *
 * Closes APTS-HO-008 (Immediate Kill Switch with State Dump) +
 * APTS-AL-012 (Kill Switch and Pause Capability) jointly with state.ts.
 *
 * Signal contract:
 *   - SIGINT  (Ctrl+C)        → kill, dump state, exit code 130
 *   - SIGTERM (kill <pid>)    → kill, dump state, exit code 143
 *   - SIGUSR1                 → graceful pause: dump state, exit code 0
 *                               so the operator can later --resume
 *   - SIGUSR2                 → reserved for future redirect (no-op v0.1)
 *
 * Handlers are installed once per engagement and cleared on completion.
 * In-process tests can use a synchronous shim to verify the dump-state
 * callback fires without actually emitting OS signals.
 */
import type { EngagementState } from './state.js';
import { writeEngagementState } from './state.js';
import type { EngagementEvent, EventSink } from './events.js';
import { emitEvent, makeEvent } from './events.js';

export type DumpReason = 'SIGINT' | 'SIGTERM' | 'SIGUSR1' | 'SIGUSR2';

export interface SignalHandlerOptions {
  /** Path to write the state-dump on signal. */
  stateFilePath: string | null;
  /** Provider of the current engagement state to dump. */
  getState: () => EngagementState;
  /** Sink to record the kill/intervention event. Same channel as the JSONL event-stream. */
  eventSink: EventSink;
  /** Engagement-id used by emit helpers. */
  engagementId: string;
  /**
   * Optional: process.exit hook (defaults to real process.exit). Tests
   * inject a no-op to verify the cleanup path without halting the test.
   */
  exit?: (code: number) => void;
  /**
   * Optional: process.on registrar (defaults to real process.on). Tests
   * inject an in-memory registrar to drive handler callbacks deterministically.
   */
  on?: (signal: string, handler: () => void) => void;
}

interface InstalledHandlers {
  /** Removes all installed signal handlers. Call on engagement completion. */
  uninstall(): void;
}

export function installSignalHandlers(opts: SignalHandlerOptions): InstalledHandlers {
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  const on = opts.on ?? ((sig: string, h: () => void) => process.on(sig as NodeJS.Signals, h));

  const handlers: Array<{ sig: string; handler: () => void }> = [];

  const dumpAndEvent = (reason: DumpReason, exitCode: number, kind: 'kill' | 'pause'): void => {
    let dumpPath: string | undefined;
    try {
      const state = opts.getState();
      // Update the snapshot's pause-reason and timestamp before flushing.
      const stamped: EngagementState = {
        ...state,
        paused_at: new Date().toISOString(),
        reason: `signal-${reason}`,
      };
      if (opts.stateFilePath) {
        writeEngagementState(opts.stateFilePath, stamped);
        dumpPath = opts.stateFilePath;
      }
    } catch {
      // Dump is best-effort; never let a state-write failure mask the exit.
    }

    const ev: EngagementEvent =
      kind === 'kill'
        ? makeEvent(opts.engagementId, 'kill', { signal: reason as 'SIGTERM' | 'SIGINT' | 'SIGUSR2', ...(dumpPath ? { state_dump_path: dumpPath } : {}) })
        : makeEvent(opts.engagementId, 'intervention', {
            kind: 'pause',
            trigger: `signal-${reason}` as 'signal-SIGUSR1' | 'signal-SIGTERM' | 'signal-SIGINT',
            reason: 'operator-paused',
          });
    try {
      emitEvent(ev, opts.eventSink);
    } catch {
      // best-effort
    }
    exit(exitCode);
  };

  const sigint = () => dumpAndEvent('SIGINT', 130, 'kill');
  const sigterm = () => dumpAndEvent('SIGTERM', 143, 'kill');
  const sigusr1 = () => dumpAndEvent('SIGUSR1', 0, 'pause');

  on('SIGINT', sigint);
  handlers.push({ sig: 'SIGINT', handler: sigint });
  on('SIGTERM', sigterm);
  handlers.push({ sig: 'SIGTERM', handler: sigterm });
  on('SIGUSR1', sigusr1);
  handlers.push({ sig: 'SIGUSR1', handler: sigusr1 });

  return {
    uninstall(): void {
      for (const { sig, handler } of handlers) {
        try {
          process.removeListener(sig as NodeJS.Signals, handler);
        } catch {
          // Tests may inject a stub on() that never registers in the real
          // process — removeListener is a no-op then.
        }
      }
    },
  };
}
