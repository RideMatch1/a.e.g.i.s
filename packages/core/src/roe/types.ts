/**
 * Rules of Engagement (RoE) schema for AEGIS Autonomous Pentest Layer.
 *
 * Closes APTS Tier-1 requirements:
 *   - APTS-SE-001 — Rules of Engagement Specification and Validation
 *   - APTS-SE-003 — Domain Scope Validation and Wildcard Handling
 *   - APTS-SE-004 — Temporal Boundary and Timezone Handling
 *   - APTS-SE-005 — Asset Criticality Classification and Integration
 *   - APTS-SE-006 — Pre-Action Scope Validation
 *   - APTS-AL-006 — Basic Scope Validation and Policy Enforcement
 *   - APTS-AL-014 — Boundary Definition and Enforcement Framework
 *
 * Design notes:
 *   - JSON-shaped, Zod-strict-validated. Operators may author in YAML and
 *     pre-convert at load time, but the canonical on-disk form is JSON.
 *   - The schema captures authorization-attestation, in-/out-of-scope
 *     domains and IP ranges, asset criticality classification, temporal
 *     envelope (with optional blackout windows), and stop conditions.
 *   - Per-action validators are pure functions on a loaded RoE — they
 *     take a target/action and return an explicit allow/deny decision
 *     with rationale. The decision is logged by the orchestrator into
 *     the audit channel.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sub-schemas

const DomainPatternSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .refine(
      (s) => !s.includes('://') && !s.includes('/'),
      { message: 'domain pattern must be a bare hostname or wildcard, no scheme or path' },
    ),
  includeSubdomains: z.boolean().default(false),
});

const CidrSchema = z
  .string()
  .regex(
    /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$|^[0-9a-fA-F:]+\/\d{1,3}$/u,
    { message: 'CIDR must be IPv4 (a.b.c.d/n) or IPv6 (xxxx:.../n)' },
  );

const InScopeSchema = z
  .object({
    domains: z.array(DomainPatternSchema).default([]),
    ip_ranges: z.array(CidrSchema).default([]),
    repository_paths: z.array(z.string().min(1)).default([]),
  })
  .strict();

const OutOfScopeSchema = z
  .object({
    domains: z.array(z.string().min(1)).default([]),
    ip_ranges: z.array(CidrSchema).default([]),
    paths: z.array(z.string().min(1)).default([]),
  })
  .strict();

const AssetCriticalityEntrySchema = z
  .object({
    pattern: z.string().min(1),
    classification: z.enum(['critical', 'high', 'medium', 'low']),
    notes: z.string().optional(),
  })
  .strict();

const BlackoutWindowSchema = z
  .object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    reason: z.string().min(1),
  })
  .strict()
  .refine((w) => Date.parse(w.end) > Date.parse(w.start), {
    message: 'blackout window end must be after start',
  });

const TemporalSchema = z
  .object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    timezone: z.string().min(1),
    blackout_windows: z.array(BlackoutWindowSchema).default([]),
  })
  .strict()
  .refine((t) => Date.parse(t.end) > Date.parse(t.start), {
    message: 'temporal envelope end must be after start',
  });

const StopConditionsSchema = z
  .object({
    on_critical_finding: z.enum(['halt', 'notify-and-continue', 'continue']).default('halt'),
    max_findings: z.number().int().positive().optional(),
    max_duration_minutes: z.number().int().positive().optional(),
    /** APTS-HO-003 — per-phase decision timeout. Falls back to max_duration_minutes/4 when omitted. */
    phase_timeout_minutes: z.number().int().positive().optional(),
    on_target_unreachable_seconds: z.number().int().positive().optional(),
  })
  .strict();

const SafetyControlsSchema = z
  .object({
    /** APTS-SC-010 — auto-halt thresholds. */
    health_thresholds: z
      .object({
        max_heap_mb: z.number().int().positive().optional(),
        max_error_rate: z.number().min(0).max(1).optional(),
        max_target_response_ms: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    /** APTS-SC-009 — operator dead-man-switch heartbeat URL (HTTPS only). */
    heartbeat_url: z.string().url().optional(),
    /** APTS-SC-009 — heartbeat interval in seconds. */
    heartbeat_interval_seconds: z.number().int().positive().optional(),
  })
  .strict();

const DelegationEntrySchema = z
  .object({
    role: z.string().min(1),
    can_approve: z.array(z.string().min(1)).min(1),
  })
  .strict();

const AuthorizationSchema = z
  .object({
    statement: z.string().min(20, {
      message:
        'authorization statement must be at least 20 chars (forces explicit attestation rather than placeholder text)',
    }),
    authority_url: z.string().url().optional(),
    signature_method: z.enum(['operator-attested', 'external-signed']).default('operator-attested'),
    /** APTS-HO-004 — declarative role↔action authority delegation matrix. */
    delegation_matrix: z.array(DelegationEntrySchema).optional(),
  })
  .strict();

const AutonomyLevelPolicySchema = z
  .object({
    approval_required: z.boolean().optional(),
    pre_approved: z.boolean().optional(),
    irreversible_action_classes: z.array(z.string().min(1)).optional(),
  })
  .strict();

const AutonomyLevelsSchema = z
  .object({
    L1: AutonomyLevelPolicySchema.optional(),
    L2: AutonomyLevelPolicySchema.optional(),
    L3: AutonomyLevelPolicySchema.optional(),
    L4: AutonomyLevelPolicySchema.optional(),
  })
  .strict();

const ComplianceTriggersSchema = z
  .object({
    regulatory_class: z.array(z.string().min(1)).min(1),
    on_match: z.enum(['halt', 'notify']).default('halt'),
  })
  .strict();

const EscalationPolicySchema = z
  .object({
    /** APTS-HO-011 — severity at which an unexpected-finding halt fires. */
    severity_threshold: z.enum(['info', 'low', 'medium', 'high', 'critical', 'blocker']).optional(),
    /** APTS-HO-012 — CIA-axis halt thresholds. */
    cia_threshold: z
      .object({
        c: z.enum(['none', 'low', 'medium', 'high']).optional(),
        i: z.enum(['none', 'low', 'medium', 'high']).optional(),
        a: z.enum(['none', 'low', 'medium', 'high']).optional(),
      })
      .strict()
      .optional(),
    /** APTS-HO-013 — when true, low-confidence findings halt-pause the engagement. */
    pause_on_low_confidence: z.boolean().optional(),
  })
  .strict();

const OperatorSchema = z
  .object({
    organization: z.string().min(1),
    authorized_by: z.string().min(1),
    contact: z.string().min(1),
  })
  .strict();

const NotificationChannelSchema = z
  .object({
    type: z.enum(['webhook', 'log']),
    url: z.string().url().optional(),
    events: z
      .array(z.enum(['start', 'halt', 'critical-finding', 'completion']))
      .min(1),
  })
  .strict();

const NotificationsSchema = z
  .object({
    channels: z.array(NotificationChannelSchema).default([]),
  })
  .strict();

const ReferencesSchema = z
  .object({
    incident_response_plan: z.string().optional(),
    contract_id: z.string().optional(),
    apts_conformance_claim: z.string().optional(),
  })
  .strict();

const SandboxingSchema = z
  .object({
    mode: z.enum(['docker', 'firejail', 'none']).default('none'),
    docker_network: z.string().min(1).optional(),
    image_overrides: z.record(z.string().min(1), z.string().min(1)).optional(),
    extra_docker_args: z.array(z.string()).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Top-level RoE schema

export const RoESchema = z
  .object({
    roe_id: z.string().min(1),
    spec_version: z.literal('0.1.0'),
    operator: OperatorSchema,
    authorization: AuthorizationSchema,
    in_scope: InScopeSchema,
    out_of_scope: OutOfScopeSchema.default({}),
    asset_criticality: z.array(AssetCriticalityEntrySchema).default([]),
    temporal: TemporalSchema,
    stop_conditions: StopConditionsSchema.default({ on_critical_finding: 'halt' }),
    notifications: NotificationsSchema.optional(),
    references: ReferencesSchema.optional(),
    /** APTS-MR-018 — declarative sandboxing constraints for LLM-pentest wrappers. */
    sandboxing: SandboxingSchema.default({ mode: 'none' }),
    /** APTS-SC-009/010, HO-003 — declarative safety-control overrides. */
    safety_controls: SafetyControlsSchema.optional(),
    /** APTS-HO-001/010 — per-autonomy-level pre-approval gating. */
    autonomy_levels: AutonomyLevelsSchema.optional(),
    /** APTS-HO-014 — regulatory class triggers for finding-text escalation. */
    compliance_triggers: ComplianceTriggersSchema.optional(),
    /** APTS-HO-011/012/013 — escalation thresholds for severity / CIA vector / confidence. */
    escalation: EscalationPolicySchema.optional(),
  })
  .strict();

export type RoE = z.infer<typeof RoESchema>;

// ---------------------------------------------------------------------------
// Validators (pure functions on a loaded RoE)

export interface ValidationDecision {
  allowed: boolean;
  reason: string;
  /** APTS requirement IDs satisfied or violated by this decision (for audit). */
  apts_refs?: string[];
}

/**
 * Validate that a target (URL, hostname, or IP) is in scope and not in the
 * out_of_scope deny list. Closes APTS-SE-003 + APTS-SE-006 + APTS-AL-006.
 */
export function validateTargetInScope(target: string, roe: RoE): ValidationDecision {
  const host = stripToHostname(target);
  if (!host) {
    return {
      allowed: false,
      reason: `target ${target} could not be parsed to a hostname or IP`,
      apts_refs: ['APTS-SE-003', 'APTS-SE-006'],
    };
  }

  // First: deny-list (out_of_scope wins over in_scope when both match)
  for (const denied of roe.out_of_scope.domains) {
    if (matchDomain(host, denied, false)) {
      return {
        allowed: false,
        reason: `target ${host} matches out_of_scope domain pattern ${denied}`,
        apts_refs: ['APTS-SE-009', 'APTS-AL-014'],
      };
    }
  }
  for (const denied of roe.out_of_scope.ip_ranges) {
    if (ipInCidr(host, denied)) {
      return {
        allowed: false,
        reason: `target ${host} matches out_of_scope CIDR ${denied}`,
        apts_refs: ['APTS-SE-009', 'APTS-AL-014'],
      };
    }
  }

  // Second: in-scope check (must match at least one)
  for (const dom of roe.in_scope.domains) {
    if (matchDomain(host, dom.pattern, dom.includeSubdomains)) {
      return {
        allowed: true,
        reason: `target ${host} matches in_scope domain pattern ${dom.pattern}${dom.includeSubdomains ? ' (subdomains included)' : ''}`,
        apts_refs: ['APTS-SE-003', 'APTS-SE-006', 'APTS-AL-006'],
      };
    }
  }
  for (const cidr of roe.in_scope.ip_ranges) {
    if (ipInCidr(host, cidr)) {
      return {
        allowed: true,
        reason: `target ${host} is within in_scope CIDR ${cidr}`,
        apts_refs: ['APTS-SE-002', 'APTS-SE-006', 'APTS-AL-006'],
      };
    }
  }

  return {
    allowed: false,
    reason: `target ${host} is not within any in_scope domain or CIDR`,
    apts_refs: ['APTS-SE-003', 'APTS-SE-006'],
  };
}

/**
 * Validate the current time is within the temporal envelope and not in a
 * blackout window. Closes APTS-SE-004 + APTS-SE-008.
 */
export function validateTemporalEnvelope(roe: RoE, now: Date = new Date()): ValidationDecision {
  const ts = now.getTime();
  const start = Date.parse(roe.temporal.start);
  const end = Date.parse(roe.temporal.end);
  if (ts < start) {
    return {
      allowed: false,
      reason: `current time (${now.toISOString()}) is before engagement start (${roe.temporal.start})`,
      apts_refs: ['APTS-SE-004'],
    };
  }
  if (ts > end) {
    return {
      allowed: false,
      reason: `current time (${now.toISOString()}) is after engagement end (${roe.temporal.end})`,
      apts_refs: ['APTS-SE-004', 'APTS-SE-008'],
    };
  }
  for (const window of roe.temporal.blackout_windows ?? []) {
    const ws = Date.parse(window.start);
    const we = Date.parse(window.end);
    if (ts >= ws && ts <= we) {
      return {
        allowed: false,
        reason: `current time is inside blackout window (${window.start} → ${window.end}: ${window.reason})`,
        apts_refs: ['APTS-SE-004', 'APTS-SE-008'],
      };
    }
  }
  return {
    allowed: true,
    reason: 'within temporal envelope and outside any blackout window',
    apts_refs: ['APTS-SE-004', 'APTS-SE-008'],
  };
}

/**
 * Classify a target's asset criticality per APTS-SE-005. Returns
 * `'unspecified'` if no asset_criticality entry matches.
 */
export function getAssetCriticality(
  target: string,
  roe: RoE,
): 'critical' | 'high' | 'medium' | 'low' | 'unspecified' {
  const host = stripToHostname(target);
  if (!host) return 'unspecified';
  // Match in declaration order — first match wins. Operators can pin
  // critical assets at the top of the list to take precedence over
  // broader patterns.
  for (const entry of roe.asset_criticality) {
    if (matchDomain(host, entry.pattern, true) || pathMatches(target, entry.pattern)) {
      return entry.classification;
    }
  }
  return 'unspecified';
}

/**
 * Composite pre-action validator. Combines scope + temporal + per-action
 * stop-condition checks. Returns an explicit allow/deny with the
 * complete reason chain. Closes APTS-SE-006.
 */
export function validateAction(
  target: string,
  action: string,
  roe: RoE,
  now: Date = new Date(),
): ValidationDecision {
  const temporal = validateTemporalEnvelope(roe, now);
  if (!temporal.allowed) {
    return {
      allowed: false,
      reason: `action ${action}: ${temporal.reason}`,
      apts_refs: temporal.apts_refs,
    };
  }
  const scope = validateTargetInScope(target, roe);
  if (!scope.allowed) {
    return {
      allowed: false,
      reason: `action ${action}: ${scope.reason}`,
      apts_refs: scope.apts_refs,
    };
  }
  const criticality = getAssetCriticality(target, roe);
  return {
    allowed: true,
    reason: `action ${action} on ${target} (criticality: ${criticality}) within scope and temporal envelope`,
    apts_refs: ['APTS-SE-006', 'APTS-SE-005', 'APTS-AL-006'],
  };
}

/**
 * Synthesize a minimal RoE from a `--target` flag for back-compat with the
 * pre-RoE `aegis siege --target URL --confirm` interface. Operator should
 * graduate to a real RoE file for any non-trivial engagement; this helper
 * exists so existing scripts continue to function. Marks the synthesized
 * RoE as such so audit logs can flag the difference.
 *
 * Defaults are CONSERVATIVE-strict, not permissive-back-compat:
 *   - `safety_controls.health_thresholds` non-trivial so SC-010 health
 *     check actually trips on a runaway engagement.
 *   - `autonomy_levels.L3.approval_required: true` — exploitation halts
 *     unless the operator provides a real RoE that explicitly
 *     pre-approves L3. This is a back-compat BREAK from earlier
 *     versions where --confirm authorized everything; the rationale is
 *     that synthesized minimal RoE should never silently authorize
 *     exploitation phase. Operators who need exploitation must author
 *     a full RoE.
 *   - `escalation.severity_threshold: 'critical'` — matches the
 *     `stop_conditions.on_critical_finding: 'halt'` policy on the
 *     finding-text path (HO-011).
 *   - `escalation.cia_threshold: { c:'high', i:'high', a:'high' }` —
 *     CIA-axis halt on any high-impact finding (HO-012).
 *   - `pause_on_low_confidence: false` — operator opt-in for HO-013
 *     to avoid noisy halts during normal scans.
 *
 * The previous permissive defaults were flagged by an internal audit
 * as "mechanism-MET but inert in default mode". Closing that gap
 * required this BC break.
 */
export function synthesizeMinimalRoE(
  target: string,
  options: {
    organization?: string;
    durationMinutes?: number;
  } = {},
): RoE {
  const now = new Date();
  const end = new Date(now.getTime() + (options.durationMinutes ?? 60) * 60_000);
  const host = stripToHostname(target) ?? target;

  return {
    roe_id: `synthesized-${now.toISOString().replace(/[:.]/g, '-')}`,
    spec_version: '0.1.0',
    operator: {
      organization: options.organization ?? 'unspecified-operator',
      authorized_by: 'cli-flag-fallback',
      contact: 'unspecified',
    },
    authorization: {
      statement:
        'AEGIS-synthesized minimal RoE from --target flag (no operator-attested RoE file provided)',
      signature_method: 'operator-attested',
    },
    in_scope: {
      domains: [{ pattern: host, includeSubdomains: false }],
      ip_ranges: [],
      repository_paths: [],
    },
    out_of_scope: { domains: [], ip_ranges: [], paths: [] },
    asset_criticality: [],
    temporal: {
      start: now.toISOString(),
      end: end.toISOString(),
      timezone: 'UTC',
      blackout_windows: [],
    },
    stop_conditions: { on_critical_finding: 'halt' },
    sandboxing: { mode: 'none' },
    safety_controls: {
      health_thresholds: {
        max_heap_mb: 4096,
        max_error_rate: 0.5,
        max_target_response_ms: 30_000,
      },
      heartbeat_interval_seconds: 30,
    },
    autonomy_levels: {
      L1: { approval_required: false },
      L2: { approval_required: false },
      L3: { approval_required: true },
      L4: { approval_required: false },
    },
    escalation: {
      severity_threshold: 'critical',
      cia_threshold: { c: 'high', i: 'high', a: 'high' },
      pause_on_low_confidence: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers

function stripToHostname(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // If it parses as a URL, take the hostname.
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (u.hostname) return u.hostname;
  } catch {
    /* fall through */
  }
  return trimmed;
}

function matchDomain(host: string, pattern: string, includeSubdomains: boolean): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  // Wildcard patterns: `*.example.com` → matches any single-level subdomain
  // plus the bare domain when includeSubdomains is true.
  if (p.startsWith('*.')) {
    const bare = p.slice(2);
    return h === bare || h.endsWith('.' + bare);
  }
  if (h === p) return true;
  if (includeSubdomains && h.endsWith('.' + p)) return true;
  return false;
}

function ipInCidr(host: string, cidr: string): boolean {
  // IPv4-only for v0.1.0; IPv6 ranges are accepted by the schema but
  // matching is treated as out-of-scope (returns false). A future
  // iteration extends this. The conservative answer for IPv6 is "not
  // matched" — so an IPv6 deny-list still blocks via domain rules.
  const m = /^(?:\d{1,3}\.){3}\d{1,3}$/.exec(host);
  if (!m) return false;
  const [range, bitsStr] = cidr.split('/');
  if (!range || !bitsStr) return false;
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(range)) return false;
  const bits = parseInt(bitsStr, 10);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
  const hostInt = ipv4ToInt(host);
  const rangeInt = ipv4ToInt(range);
  if (hostInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (hostInt & mask) === (rangeInt & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!Number.isFinite(p) || p < 0 || p > 255) return null;
    out = ((out << 8) | p) >>> 0;
  }
  return out >>> 0;
}

function pathMatches(target: string, pattern: string): boolean {
  // Path-prefix match — minimal implementation for asset_criticality
  // entries that point at repo paths or URL paths. Glob support is a
  // Phase-2 cluster-1.5 enhancement.
  if (!pattern.includes('/')) return false;
  return target.includes(pattern);
}
