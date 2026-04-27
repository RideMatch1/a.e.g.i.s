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
 * Mid-phase resume is deferred to a future cluster — it requires
 * scanner-level checkpointing which the orchestrator doesn't expose today.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

export function writeEngagementState(path: string, state: EngagementState): void {
  writeFileSync(path, JSON.stringify(state, null, 2));
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      error: `state file at ${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      phase: 'json-parse',
    };
  }
  const result = EngagementStateSchema.safeParse(parsed);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`)
      .join('\n');
    return { ok: false, error: `state schema validation failed:\n${formatted}`, phase: 'schema-validation' };
  }
  // result.data preserves the schema shape (`findings_so_far: Record<string, unknown>[]`).
  // We cast to EngagementState because the schema permits arbitrary Finding-shaped
  // objects pass-through (resume must accept any Finding the orchestrator emits).
  return { ok: true, state: result.data as unknown as EngagementState };
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
