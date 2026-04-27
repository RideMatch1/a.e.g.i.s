/**
 * Engagement state snapshot — the durable artifact that supports
 * pause-and-resume.
 *
 * Closes APTS-HO-006 (Graceful Pause Mechanism with State Preservation) +
 * APTS-HO-008 (Immediate Kill Switch with State Dump) jointly with
 * runtime/signals.ts.
 *
 * Snapshot scope (Cluster-2 v1):
 *   - engagement_id (matches the JSONL event stream)
 *   - target + roe_id
 *   - completed_phases — engagement is phase-grained; resume restarts the
 *     next phase, not mid-phase. Simpler than the full mid-phase resume
 *     and sufficient for siege's 4-phase shape.
 *   - findings_so_far — the in-flight findings array
 *   - paused_at — ISO-8601 timestamp
 *   - reason — short rationale (e.g. "operator-SIGUSR1", "temporal-expiry")
 *
 * State-file format (audit-fix 2026-04-27):
 *   - PURE JSONL. Every line is a single-line JSON object.
 *   - Snapshots have a `state_version` field; events have `ts` + `event`.
 *   - Snapshots are APPENDED, not overwritten. `loadEngagementState`
 *     reads the file line-by-line and returns the LAST snapshot.
 *   - Previous behavior (overwriting with pretty-printed JSON) was
 *     destroying events between persistStates and breaking line-oriented
 *     tools like `jq -c`.
 *
 * Mid-phase resume is deferred to a future cluster — it requires
 * scanner-level checkpointing which the orchestrator doesn't expose today.
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { z } from 'zod';
import type { Finding } from '../types.js';

const FindingPassthroughSchema = z.record(z.unknown());

export const EngagementStateSchema = z
  .object({
    state_version: z.literal('0.1.0'),
    engagement_id: z.string().min(1),
    target: z.string().min(1),
    roe_id: z.string().min(1),
    completed_phases: z.array(z.enum(['recon', 'discovery', 'exploitation', 'reporting'])),
    findings_so_far: z.array(FindingPassthroughSchema),
    paused_at: z.string().datetime({ offset: true }),
    reason: z.string().min(1),
  })
  .strict();

export interface EngagementState {
  state_version: '0.1.0';
  engagement_id: string;
  target: string;
  roe_id: string;
  completed_phases: ('recon' | 'discovery' | 'exploitation' | 'reporting')[];
  findings_so_far: Finding[];
  paused_at: string;
  reason: string;
}

/**
 * Append the engagement-state snapshot as a single JSONL line.
 *
 * Was: `writeFileSync(path, JSON.stringify(state, null, 2))` which
 * overwrote the entire state file — destroying every JSONL event that
 * had been appended since the last snapshot. The audit on 2026-04-27
 * flagged this as both a format inconsistency (mixed pretty-JSON +
 * JSONL) AND a data-loss bug (events between persistStates were lost).
 *
 * Now: each call appends one JSONL line. Snapshots and events coexist
 * in the same file. `loadEngagementState` reads the last snapshot.
 */
export function writeEngagementState(path: string, state: EngagementState): void {
  appendFileSync(path, JSON.stringify(state) + '\n');
}

export interface LoadStateOk {
  ok: true;
  state: EngagementState;
}
export interface LoadStateFailure {
  ok: false;
  error: string;
  phase: 'file-missing' | 'json-parse' | 'schema-validation';
}
export type LoadStateResult = LoadStateOk | LoadStateFailure;

/**
 * Load the latest engagement-state snapshot from a JSONL state-file.
 *
 * Reads line-by-line, identifies snapshot lines by the presence of a
 * `state_version` field, schema-validates each, and returns the LAST
 * (most recent) successful match. Event lines (with `ts`+`event`) are
 * skipped. Malformed lines are skipped with a count tracked for the
 * debug error path; only snapshots that pass the strict schema are
 * candidates.
 *
 * Back-compat: also accepts a single-object pretty-JSON file (the
 * pre-audit format). When the entire file parses as one EngagementState
 * object, return that. This preserves resume-from-pre-audit-state
 * functionality during the migration window.
 */
export function loadEngagementState(path: string): LoadStateResult {
  if (!existsSync(path)) {
    return { ok: false, error: `state file not found at ${path}`, phase: 'file-missing' };
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    return {
      ok: false,
      error: `state file unreadable at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      phase: 'file-missing',
    };
  }

  // Back-compat: try parsing the whole file as a single JSON snapshot first.
  // The pre-audit format wrote pretty-printed JSON without JSONL structure.
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const result = EngagementStateSchema.safeParse(parsed);
      if (result.success) {
        return { ok: true, state: result.data as unknown as EngagementState };
      }
      // Fall through to JSONL parse — the file might be JSONL where the
      // first event is a single-line snapshot followed by event lines.
    } catch {
      // Not a single-object file; fall through to JSONL.
    }
  }

  // JSONL: parse line-by-line, return the last successful snapshot.
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  let lastSnapshot: EngagementState | null = null;
  let parseErrors = 0;
  let schemaErrors = 0;
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      parseErrors += 1;
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    if (!('state_version' in parsed)) continue; // event line, skip
    const result = EngagementStateSchema.safeParse(parsed);
    if (result.success) {
      lastSnapshot = result.data as unknown as EngagementState;
    } else {
      schemaErrors += 1;
    }
  }

  if (lastSnapshot) {
    return { ok: true, state: lastSnapshot };
  }

  if (parseErrors > 0 && lines.length === parseErrors) {
    return {
      ok: false,
      error: `state file at ${path}: no parseable JSONL line found (${parseErrors} malformed)`,
      phase: 'json-parse',
    };
  }
  if (schemaErrors > 0) {
    return {
      ok: false,
      error: `state file at ${path}: ${schemaErrors} snapshot-shaped lines failed schema validation`,
      phase: 'schema-validation',
    };
  }
  return {
    ok: false,
    error: `state file at ${path} contains no engagement-state snapshot`,
    phase: 'schema-validation',
  };
}

/**
 * Build a fresh engagement state at engagement start.
 */
export function newEngagementState(args: {
  engagement_id: string;
  target: string;
  roe_id: string;
}): EngagementState {
  return {
    state_version: '0.1.0',
    engagement_id: args.engagement_id,
    target: args.target,
    roe_id: args.roe_id,
    completed_phases: [],
    findings_so_far: [],
    paused_at: new Date().toISOString(),
    reason: 'engagement-start',
  };
}
