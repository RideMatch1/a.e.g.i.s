/**
 * Engagement event schema (JSONL).
 *
 * Closes APTS-HO-002 (Real-Time Monitoring and Intervention Capability) +
 * APTS-AR-002 (State Transition Logging — partial closure pending Cluster-3
 * hash-chain). Each event is one JSON line, written to stdout (default) or
 * a state-file (when --state-file is set on siege).
 *
 * Event types:
 *   - engagement-start                  — emitted when siege begins (after RoE validated)
 *   - phase-transition                  — emitted before/after each of the 4 siege phases
 *   - finding-emitted                   — per-finding event so live monitors can react
 *   - critical-finding                  — high-severity emission, drives stop-conditions
 *   - intervention                      — operator pause/redirect/kill received via signal
 *   - resume                            — engagement re-started from a serialized state file
 *   - halt                              — engagement stopped (clean termination)
 *   - kill                              — engagement aborted (signal-triggered)
 *   - completion                        — engagement finished, final scoring emitted
 *   - scope-validation                  — target in/out of scope decision (APTS-SE-015)
 *   - operator-acknowledged-loopback    — operator opted in to loopback target (--allow-loopback)
 */
import { writeFileSync, appendFileSync } from 'node:fs';
import type { Finding, Severity } from '../types.js';
import { hashCanonical } from './hash.js';

export interface EngagementEventBase {
  ts: string; // ISO-8601 with offset
  engagement_id: string;
  event: string;
  /** Hash of the previous event in the chain. null on the first event. */
  prev_hash?: string | null;
  /** SHA-256 of this event's canonical form (excluding this_hash itself). */
  this_hash?: string;
}

export type EngagementEvent =
  | (EngagementEventBase & {
      event: 'engagement-start';
      target: string;
      roe_id: string;
      roe_synthesized: boolean;
      mode: string;
    })
  | (EngagementEventBase & {
      event: 'phase-transition';
      phase: 'recon' | 'discovery' | 'exploitation' | 'reporting';
      transition: 'enter' | 'exit';
      duration_ms?: number;
    })
  | (EngagementEventBase & {
      event: 'finding-emitted';
      finding_id: string;
      severity: Severity;
      title: string;
      cwe?: number;
      /** SHA-256 of the finding's canonical form (APTS-AR-010). */
      evidence_hash?: string;
    })
  | (EngagementEventBase & {
      event: 'critical-finding';
      finding_id: string;
      severity: Severity;
      title: string;
      cwe?: number;
      stop_action: 'halt' | 'notify-and-continue' | 'continue';
    })
  | (EngagementEventBase & {
      event: 'intervention';
      kind: 'pause' | 'redirect' | 'kill';
      trigger: 'signal-SIGUSR1' | 'signal-SIGTERM' | 'signal-SIGINT' | 'api';
      reason?: string;
    })
  | (EngagementEventBase & {
      event: 'resume';
      from_state_file: string;
      completed_phases: string[];
      findings_carried: number;
    })
  | (EngagementEventBase & {
      event: 'halt';
      reason: string;
      apts_refs?: string[];
    })
  | (EngagementEventBase & {
      event: 'kill';
      signal: 'SIGTERM' | 'SIGINT' | 'SIGUSR2';
      state_dump_path?: string;
    })
  | (EngagementEventBase & {
      event: 'completion';
      duration_ms: number;
      total_findings: number;
      score: number;
      grade: string;
      blocked: boolean;
    })
  | (EngagementEventBase & {
      event: 'scope-validation';
      target: string;
      action: string;
      allowed: boolean;
      reason: string;
      apts_refs?: string[];
    })
  | (EngagementEventBase & {
      event: 'operator-acknowledged-loopback';
      target: string;
      apts_refs: string[];
      warning: string;
    });

/**
 * Emit an engagement event to a sink. The sink can be:
 *   - undefined → stdout (default; siege already writes to stdout for the
 *     human-readable spinner; emitting JSONL there is risky because the
 *     terminal user would see noisy lines. So we only emit JSONL when an
 *     explicit state-file path is configured.)
 *   - a file path → append the JSON line to that file.
 *   - a callback → in-process consumer (used by tests).
 */
export type EventSink = string | ((event: EngagementEvent) => void) | undefined;

export function emitEvent(event: EngagementEvent, sink: EventSink): void {
  if (sink === undefined) return;
  if (typeof sink === 'function') {
    sink(event);
    return;
  }
  // sink is a file path. Append JSONL — one JSON object per line.
  appendFileSync(sink, JSON.stringify(event) + '\n');
}

export function makeEvent<T extends EngagementEvent['event']>(
  engagementId: string,
  event: T,
  payload: Omit<Extract<EngagementEvent, { event: T }>, 'ts' | 'engagement_id' | 'event'>,
): Extract<EngagementEvent, { event: T }> {
  return {
    ts: new Date().toISOString(),
    engagement_id: engagementId,
    event,
    ...payload,
  } as unknown as Extract<EngagementEvent, { event: T }>;
}

/**
 * Helper: turn a Finding into a finding-emitted event. Caller decides
 * whether to also emit a critical-finding event for high/critical/blocker
 * severities. Includes evidence_hash (SHA-256 of finding's canonical form)
 * per APTS-AR-010.
 */
export function findingEvent(engagementId: string, f: Finding): EngagementEvent {
  const evidence_hash = hashCanonical(f);
  return makeEvent(engagementId, 'finding-emitted', {
    finding_id: f.id,
    severity: f.severity,
    title: f.title,
    ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
    evidence_hash,
  });
}

export function isCriticalSeverity(s: Severity): boolean {
  return s === 'blocker' || s === 'critical' || s === 'high';
}

/**
 * Initialize a state-file: ensure it's empty / not appended onto a stale
 * run. Caller invokes this at engagement start when --state-file is set.
 */
export function initStateFile(path: string): void {
  writeFileSync(path, '');
}
