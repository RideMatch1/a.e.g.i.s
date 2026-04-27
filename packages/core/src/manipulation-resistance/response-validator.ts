/**
 * Wrapper response validation + authority-claim detection.
 *
 * Closes APTS-MR-002 (Response Validation and Sanitization) +
 * APTS-MR-005 (Authority Claim Detection and Rejection).
 *
 * Design notes:
 *   - LLM-pentest wrappers return JSON-ish output that flows into AEGIS
 *     Findings. Untrusted output may contain (a) malformed structure,
 *     (b) HTML/script payloads in finding text, (c) over-long fields
 *     designed to exhaust memory, (d) authority claims like "I have root
 *     access" that should not be propagated as fact without verification.
 *   - validateWrapperResponse runs a per-wrapper Zod schema +
 *     sanitization. Schemas are intentionally lenient on field
 *     presence to tolerate the variation in upstream output shapes
 *     (Strix emits findings | vulnerabilities | results); strict on
 *     field types where present.
 *   - detectAuthorityClaim scans finding text for phrases that assert
 *     orchestrator-relevant authority (admin, root, RCE, reverse-shell)
 *     and returns a structured claim record. Caller decides whether to
 *     halt-pending-operator-confirmation or reject outright.
 */
import { z } from 'zod';

const MAX_FIELD_LEN = 16_384;

const LooseFindingSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    severity: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    cwe: z.union([z.number(), z.string()]).optional(),
    cvss: z.number().optional(),
    vulnerability: z.string().optional(),
    evidence: z.string().optional(),
  })
  .passthrough();

const StrixOutputSchema = z
  .object({
    findings: z.array(LooseFindingSchema).optional(),
    vulnerabilities: z.array(LooseFindingSchema).optional(),
    results: z.array(LooseFindingSchema).optional(),
  })
  .passthrough();

const PtaiOutputSchema = z
  .object({
    runs: z
      .array(
        z
          .object({
            results: z.array(z.unknown()).optional(),
          })
          .passthrough(),
      )
      .optional(),
    findings: z.array(LooseFindingSchema).optional(),
  })
  .passthrough();

const PentestswarmOutputSchema = z
  .object({
    findings: z.array(LooseFindingSchema).optional(),
    issues: z.array(LooseFindingSchema).optional(),
    report: z.unknown().optional(),
  })
  .passthrough();

const SubfinderEntrySchema = z
  .object({
    host: z.string().optional(),
    input: z.string().optional(),
    source: z.string().optional(),
  })
  .passthrough();

/**
 * Per-wrapper output schema. Unknown wrappers fall back to deny — the
 * caller must register a schema before AEGIS will trust the output.
 */
const WRAPPER_SCHEMAS: Readonly<Record<string, z.ZodTypeAny>> = {
  strix: StrixOutputSchema,
  ptai: PtaiOutputSchema,
  pentestswarm: PentestswarmOutputSchema,
  subfinder: SubfinderEntrySchema,
};

export interface ResponseValidation {
  ok: boolean;
  cleaned?: unknown;
  reason?: string;
  apts_refs?: string[];
}

/**
 * Validate + sanitize a wrapper's structured output before propagating
 * to Findings. Returns { ok: true, cleaned } on success or
 * { ok: false, reason } with an APTS reference on rejection.
 */
export function validateWrapperResponse(
  wrapperName: string,
  raw: unknown,
): ResponseValidation {
  const schema = WRAPPER_SCHEMAS[wrapperName];
  if (!schema) {
    return {
      ok: false,
      reason: `no validation schema registered for wrapper "${wrapperName}"`,
      apts_refs: ['APTS-MR-002'],
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `wrapper "${wrapperName}" output failed schema validation: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
      apts_refs: ['APTS-MR-002'],
    };
  }
  return {
    ok: true,
    cleaned: sanitize(parsed.data, MAX_FIELD_LEN),
    apts_refs: ['APTS-MR-002'],
  };
}

/**
 * Recursively HTML-encode angle brackets + ampersands inside string
 * leaves and cap field lengths. Defends against HTML/script payloads
 * embedded in finding titles + descriptions and against
 * memory-exhaustion via finding-flood.
 */
function sanitize(value: unknown, maxLen: number): unknown {
  if (typeof value === 'string') {
    const truncated = value.length > maxLen ? value.slice(0, maxLen) + '…[truncated]' : value;
    return truncated.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, maxLen));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v, maxLen);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Authority-claim detector (APTS-MR-005)

export type AuthorityClaim = 'none' | 'admin' | 'root' | 'rce' | 'reverse-shell';

export interface AuthorityClaimResult {
  claim: AuthorityClaim;
  rationale: string;
  matched_phrase?: string;
  suggested_action: 'pass' | 'verify' | 'reject';
  apts_refs: string[];
}

const AUTHORITY_PATTERNS: ReadonlyArray<{
  re: RegExp;
  claim: AuthorityClaim;
  action: 'verify' | 'reject';
}> = [
  // RCE / reverse-shell — strongest claims, reject outright pending operator review
  { re: /\breverse[\s-]?shell\b/iu, claim: 'reverse-shell', action: 'reject' },
  { re: /\b(?:remote code execution|RCE)\b/iu, claim: 'rce', action: 'reject' },
  { re: /\barbitrary code execution\b/iu, claim: 'rce', action: 'reject' },
  // Root / system-level — strong but possibly legitimate finding text
  { re: /\b(?:root access|root shell|root-level)\b/iu, claim: 'root', action: 'verify' },
  { re: /\b(?:superuser|system-level access)\b/iu, claim: 'root', action: 'verify' },
  // Admin — often a legitimate finding ("admin endpoint exposed"); only flag
  // assertive forms ("I have admin", "have gained admin").
  {
    re: /\b(?:I have|have gained|have obtained|have achieved|have full)[\s\w]{0,40}\badmin(?:istrator)?\b/iu,
    claim: 'admin',
    action: 'verify',
  },
  {
    re: /\b(?:I have|have gained|have obtained)[\s\w]{0,40}\bcompromised\b/iu,
    claim: 'admin',
    action: 'verify',
  },
];

/**
 * Detect authority claims in finding text. Returns the strongest match
 * (RCE > root > admin) or `claim: 'none'` if no pattern fires.
 *
 * Suggested-action policy:
 *   - 'reject' for RCE / reverse-shell — these are high-impact assertions
 *     that AEGIS must not propagate without operator confirmation.
 *   - 'verify' for root/admin — pause for operator confirmation via
 *     SIGUSR1 resume, then proceed if confirmed.
 *   - 'pass' when no claim detected.
 */
export function detectAuthorityClaim(findingText: string): AuthorityClaimResult {
  for (const pattern of AUTHORITY_PATTERNS) {
    const match = pattern.re.exec(findingText);
    if (match) {
      return {
        claim: pattern.claim,
        rationale: `finding text asserts ${pattern.claim} authority claim`,
        matched_phrase: match[0],
        suggested_action: pattern.action,
        apts_refs: ['APTS-MR-005'],
      };
    }
  }
  return {
    claim: 'none',
    rationale: 'no authority-claim phrase detected',
    suggested_action: 'pass',
    apts_refs: ['APTS-MR-005'],
  };
}
