/**
 * Hash-chained event emitter + chain verifier.
 *
 * Closes APTS-AR-012 (Tamper-Evident Logging with Hash Chains) +
 * APTS-AL-005 (Mandatory Logging + Human-Reviewable Audit Trail).
 *
 * Each emitted event carries:
 *   - prev_hash: hash of the immediately-preceding event (null on first)
 *   - this_hash: SHA-256 of this event's canonical form (excluding this_hash)
 *
 * Verification: re-canonicalize each event without this_hash, recompute
 * the hash, compare against this_hash. Compare prev_hash with the
 * previous event's this_hash. Any tamper anywhere in the chain breaks
 * verification at that line.
 */
import { readFileSync, existsSync } from 'node:fs';
import type { EngagementEvent, EventSink } from './events.js';
import { emitEvent } from './events.js';
import { hashCanonical } from './hash.js';

export interface ChainedEmitterOpts {
  sink: EventSink;
  /** Initial prev-hash. null = chain starts here. Use the prior chain's tail when continuing across resume. */
  initialPrevHash?: string | null;
}

/**
 * Stateful emitter that maintains the running prev_hash → this_hash chain.
 * Each `emit` call pours the chain forward by one link. The current chain
 * tail is exposed via `getTail()` so a resume operation can pick up where
 * the prior session left off.
 */
export class ChainedEmitter {
  private prevHash: string | null;
  constructor(private readonly opts: ChainedEmitterOpts) {
    this.prevHash = opts.initialPrevHash ?? null;
  }

  emit(event: EngagementEvent): EngagementEvent {
    // Build the chained event. Strip any caller-supplied this_hash —
    // the emitter is the sole source of truth for the hash field.
    const { this_hash: _ignored, ...rest } = event;
    void _ignored;
    const withPrev: EngagementEvent = { ...rest, prev_hash: this.prevHash } as EngagementEvent;
    // Hash without this_hash so the field can't be part of its own preimage.
    const this_hash = hashCanonical(withPrev);
    const final: EngagementEvent = { ...withPrev, this_hash };
    emitEvent(final, this.opts.sink);
    this.prevHash = this_hash;
    return final;
  }

  getTail(): string | null {
    return this.prevHash;
  }
}

export interface ChainVerifyOk {
  ok: true;
  total_events: number;
  tail_hash: string | null;
}
export interface ChainVerifyFailure {
  ok: false;
  error: string;
  /** 0-indexed line number where the chain broke. */
  broken_at: number;
  total_events_processed: number;
}
export type ChainVerifyResult = ChainVerifyOk | ChainVerifyFailure;

/**
 * Verify the integrity of a JSONL audit-log file. Each EVENT line must:
 *   - parse as JSON
 *   - carry this_hash + prev_hash fields
 *   - have a this_hash that matches the canonical hash of its other fields
 *   - have a prev_hash that matches the previous line's this_hash (null on line 0)
 *
 * Snapshot lines (those with `state_version` but no `event` field) are
 * SKIPPED — they exist alongside events in the same JSONL file (audit-fix
 * 2026-04-27 made writeEngagementState append-not-overwrite).
 *
 * KNOWN SCOPE LIMIT (audit-fix-2 2026-04-27):
 *   Snapshot lines are NOT part of the hash chain. An attacker with
 *   write access to the state-file can post-hoc tamper with snapshot
 *   fields (`completed_phases`, `findings_so_far`, `paused_at`,
 *   `reason`) without breaking chain verification. The EVENT timeline
 *   remains tamper-evident — every state transition emits an event,
 *   so a tampered snapshot is contradicted by the unchanged event
 *   stream. Resume-from-snapshot consumers MUST cross-check snapshot
 *   contents against the event chain before trusting them. Closing
 *   this gap fully would require chaining snapshot writes through
 *   ChainedEmitter (snapshot becomes an event with prev_hash +
 *   this_hash); deferred to a future cluster.
 *
 * Returns ok-with-tail-hash on success, or failure-at-line-N with reason.
 */
export function verifyAuditChain(path: string): ChainVerifyResult {
  if (!existsSync(path)) {
    return { ok: false, error: `audit-log not found at ${path}`, broken_at: 0, total_events_processed: 0 };
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    return {
      ok: false,
      error: `audit-log unreadable at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      broken_at: 0,
      total_events_processed: 0,
    };
  }
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  let prevExpectedHash: string | null = null;
  let eventsProcessed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch (err) {
      return {
        ok: false,
        error: `line ${i}: not valid JSON (${err instanceof Error ? err.message : String(err)})`,
        broken_at: i,
        total_events_processed: eventsProcessed,
      };
    }
    // Skip snapshot lines — they have state_version but no event.
    if ('state_version' in parsed && !('event' in parsed)) {
      continue;
    }
    const lineThisHash = parsed.this_hash;
    const linePrevHash = parsed.prev_hash;
    if (typeof lineThisHash !== 'string') {
      return {
        ok: false,
        error: `line ${i}: missing or non-string this_hash`,
        broken_at: i,
        total_events_processed: eventsProcessed,
      };
    }
    if (linePrevHash !== null && typeof linePrevHash !== 'string') {
      return {
        ok: false,
        error: `line ${i}: prev_hash must be string or null`,
        broken_at: i,
        total_events_processed: eventsProcessed,
      };
    }
    // Recompute the canonical hash of the event without this_hash.
    const withoutHash: Record<string, unknown> = { ...parsed };
    delete withoutHash.this_hash;
    const recomputed = hashCanonical(withoutHash);
    if (recomputed !== lineThisHash) {
      return {
        ok: false,
        error: `line ${i}: this_hash mismatch (event tampered or canonicalization mismatch)`,
        broken_at: i,
        total_events_processed: eventsProcessed,
      };
    }
    // Check the chain link to the previous event.
    if ((linePrevHash ?? null) !== prevExpectedHash) {
      return {
        ok: false,
        error: `line ${i}: prev_hash chain break (expected ${prevExpectedHash ?? 'null'}, got ${linePrevHash ?? 'null'})`,
        broken_at: i,
        total_events_processed: eventsProcessed,
      };
    }
    prevExpectedHash = lineThisHash;
    eventsProcessed += 1;
  }
  return { ok: true, total_events: eventsProcessed, tail_hash: prevExpectedHash };
}
