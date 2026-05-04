import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Webhook Signature Checker — detects HTTP route handlers under
 * `app/api/**` or `pages/api/**` that look like webhook receivers and
 * lack any recognised signature-verification call. A webhook receiver
 * without signature verification is a free state-mutation oracle:
 * anyone who finds the URL can fabricate events and trigger the
 * handler's side effects (database writes, email sends, payment
 * reconciliation, CI re-runs).
 *
 * v0.18.1 F-WEBHOOK-SIG-1 — closes a coverage gap. AEGIS' csrf-checker
 * intentionally excludes `/webhook` paths because csrf-token
 * mitigation does not apply (webhook senders cannot acquire the
 * recipient's csrf token). Signature verification is the
 * webhook-shaped equivalent — and until this scanner there was no
 * AEGIS rule firing on its absence.
 *
 * OWASP A05:2021 (Security Misconfiguration) — webhook endpoints
 *   exposed without origin authentication are a security configuration
 *   gap that creates attacker-controllable side-effects.
 * CWE-345 (Insufficient Verification of Data Authenticity)
 *
 * Scope:
 *   - app/api/**\/route.{ts,js,tsx,jsx} (App Router) and
 *     pages/api/**\/*.{ts,js,tsx,jsx} (Pages Router legacy)
 *   - Path matches a webhook-shape regex (`webhook` / `webhooks` /
 *     `hook` / `callback` segment)
 *   - File exports a POST handler (most webhooks POST; a few PUT)
 *   - File body lacks ALL of the recognised signature-verify patterns
 *
 * Vendor coverage:
 *   - Stripe: stripe.webhooks.constructEvent / constructEventAsync
 *   - GitHub: x-hub-signature-256 + crypto.timingSafeEqual / @octokit
 *     /webhooks-methods verify
 *   - Slack: x-slack-signature + HMAC-SHA256
 *   - Twilio: twilio.validateRequest / validateExpressRequest
 *   - Sanity: parseSignedSanityRequest / verifyRequest
 *   - Clerk / Resend / SendGrid (svix-shaped): svix Webhook.verify
 *   - Generic HMAC: crypto.createHmac + crypto.timingSafeEqual on body
 *   - Vercel / Supabase auth-hook: HMAC over body using webhook secret
 */

/** Path-segment patterns that mark a route as webhook-shaped. The
 *  scanner intentionally does NOT match `/auth/callback` (OAuth
 *  callbacks are origin-validated by the OAuth state-parameter
 *  protocol and have a different threat model) — only segments that
 *  match the literal `webhook` / `webhooks` / `hook` token. */
const WEBHOOK_PATH_RE = /[/\\](?:webhook|webhooks|hooks)[/\\]/i;

// Lazy quantifier + bounded repetition prevents polynomial-redos backtracking
// on inputs like `/app/api/...........` while preserving match semantics.
const ROUTE_FILE_RE =
  /(?:^|[/\\])(?:app|pages)[/\\]api[/\\][^?\n]{0,500}?(?:route\.[tj]sx?|[^/\\?\n]+\.[tj]sx?)$/;

const POST_HANDLER_RE =
  /\bexport\s+(?:async\s+)?function\s+(?:POST|PUT)\b/;

/** Patterns that count as a recognised signature verification. Any one
 *  of these inside the file body suppresses the finding.
 *
 *  Conservative-by-design — false-negatives are acceptable; the cost
 *  of a false-positive on a hand-rolled HMAC scheme is a developer
 *  silencing the rule, not a missed real attack. */
const SIGNATURE_VERIFY_PATTERNS: readonly RegExp[] = [
  // Stripe
  /\bstripe\.webhooks\.constructEvent(?:Async)?\s*\(/,
  /\bStripe\.Webhook\.constructEvent(?:Async)?\s*\(/,
  // svix (Clerk / Resend / SendGrid / many SaaS)
  /\bnew\s+Webhook\s*\([^)]*\)[^;]*\.verify\s*\(/s,
  /\b(?:wh|svix|webhook)\.verify\s*\(/,
  // GitHub / @octokit
  /\b@octokit\/webhooks/,
  /\bverifyWebhookSignature\s*\(/,
  // Twilio
  /\btwilio\.validateRequest\s*\(/,
  /\bvalidateExpressRequest\s*\(/,
  /\bvalidateRequest\s*\(/,
  // Sanity / Contentful
  /\bparseSignedSanityRequest\s*\(/,
  /\bverifyRequest\s*\(/,
  // Slack
  /\bverifySlackRequest\s*\(/,
  /\bx-slack-signature\b/i,
  // Vercel
  /\bverifySignatureAppRouter\s*\(/,
  /\bverifySignatureEdge\s*\(/,
  // Generic Node-crypto HMAC pattern: createHmac + timingSafeEqual.
  // Both must appear; the createHmac alone is not enough (could be
  // computing a hash for some other purpose) and timingSafeEqual
  // alone is not enough (could be comparing tokens unrelated to
  // request authenticity). Co-occurrence is the strong signal.
  /\bcrypto\.createHmac\s*\([^)]*\)/,
  // ^ paired check below: scanner gates final emission on BOTH
  // createHmac AND timingSafeEqual being present in the same file.
];

/** The Node-crypto HMAC pattern needs co-occurrence of createHmac AND
 *  timingSafeEqual. Detected separately; only suppresses the finding
 *  when BOTH are present. */
const HMAC_CREATE_RE = /\bcrypto\.createHmac\s*\(/;
const TIMING_SAFE_RE = /\b(?:crypto\.)?timingSafeEqual\s*\(/;

function findFirstMatchLine(content: string, re: RegExp): number {
  const idx = content.search(re);
  if (idx < 0) return 1;
  return content.slice(0, idx).split('\n').length;
}

function hasSignatureVerification(content: string): boolean {
  // Strong-signal HMAC pattern needs co-occurrence.
  if (HMAC_CREATE_RE.test(content) && TIMING_SAFE_RE.test(content)) return true;
  // Any explicit vendor-call pattern fires.
  for (const p of SIGNATURE_VERIFY_PATTERNS) {
    // Skip the createHmac-only pattern (handled above).
    if (p === SIGNATURE_VERIFY_PATTERNS[SIGNATURE_VERIFY_PATTERNS.length - 1])
      continue;
    if (p.test(content)) return true;
  }
  return false;
}

function deriveVendorHint(filePath: string, content: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('stripe')) return 'Stripe';
  if (lower.includes('github')) return 'GitHub';
  if (lower.includes('clerk') || /\bsvix\b/.test(content)) return 'Clerk / svix';
  if (lower.includes('twilio')) return 'Twilio';
  if (lower.includes('slack')) return 'Slack';
  if (lower.includes('sanity')) return 'Sanity';
  if (lower.includes('contentful')) return 'Contentful';
  if (lower.includes('vercel')) return 'Vercel';
  if (lower.includes('supabase')) return 'Supabase';
  return 'generic';
}

function fixHintForVendor(vendor: string): string {
  switch (vendor) {
    case 'Stripe':
      return 'Use stripe.webhooks.constructEvent(rawBody, req.headers.get("stripe-signature"), STRIPE_WEBHOOK_SECRET) and read the body via req.text() (NOT req.json() — Stripe signs the raw bytes).';
    case 'GitHub':
      return 'Verify x-hub-signature-256 with crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET).update(rawBody).digest("hex") and crypto.timingSafeEqual on the comparison.';
    case 'Clerk / svix':
      return 'Use new Webhook(WEBHOOK_SECRET).verify(rawBody, { "svix-id": ..., "svix-timestamp": ..., "svix-signature": ... }) before parsing the payload.';
    case 'Twilio':
      return 'Use twilio.validateRequest(AUTH_TOKEN, signature, fullUrl, params) before processing the body.';
    case 'Slack':
      return 'Verify x-slack-signature using v0:timestamp:body HMAC-SHA256 with SLACK_SIGNING_SECRET; reject requests with a stale timestamp (>5min) to block replay.';
    default:
      return 'Verify a vendor-specific signature header (constructEvent / svix.verify / HMAC-SHA256 with timingSafeEqual) before processing the body. Read the body via req.text() and parse only after verification succeeds.';
  }
}

export const webhookSignatureCheckerScanner: Scanner = {
  name: 'webhook-signature-checker',
  description:
    'Detects Next.js webhook route handlers (app/api/**, pages/api/**) that lack any recognised signature-verification call (Stripe constructEvent, GitHub HMAC, svix Webhook.verify, generic crypto.createHmac+timingSafeEqual, etc.).',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    const files = await walkFiles(
      projectPath,
      ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'out'],
      ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    );

    let idCounter = 1;
    for (const file of files) {
      if (!ROUTE_FILE_RE.test(file)) continue;
      if (!WEBHOOK_PATH_RE.test(file)) continue;
      const content = await readFileSafe(file);
      if (!content) continue;
      if (!POST_HANDLER_RE.test(content)) continue;
      if (hasSignatureVerification(content)) continue;

      const vendor = deriveVendorHint(file, content);
      const id = `WEBHOOK-SIG-${String(idCounter++).padStart(3, '0')}`;
      findings.push({
        id,
        scanner: 'webhook-signature-checker',
        severity: 'high',
        title: `Webhook handler (${vendor}) missing signature verification`,
        description: `A POST handler at a webhook-shaped path lacks any recognised signature-verification call. Without verification, anyone who discovers the route URL can fabricate webhook events and trigger the handler's side effects (database writes, email sends, payment reconciliation). The handler must verify a vendor-specific signature header (Stripe constructEvent, GitHub x-hub-signature-256 HMAC, svix Webhook.verify, generic crypto.createHmac + timingSafeEqual on the raw body) BEFORE parsing or acting on the payload.`,
        file,
        line: findFirstMatchLine(content, POST_HANDLER_RE),
        category: 'security',
        owasp: 'A05:2021',
        cwe: 345,
        fix: {
          description: fixHintForVendor(vendor),
          links: [
            'https://cwe.mitre.org/data/definitions/345.html',
            'https://docs.stripe.com/webhooks#verify-events',
            'https://docs.github.com/webhooks/using-webhooks/validating-webhook-deliveries',
            'https://docs.svix.com/receiving/verifying-payloads/how',
          ],
        },
      });
    }

    return {
      scanner: 'webhook-signature-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
