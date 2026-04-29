import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Edge Function Auth Checker — detects Supabase Edge Functions
 * (`supabase/functions/**\/*.ts`) that use SUPABASE_SERVICE_ROLE_KEY
 * (full DB access bypassing RLS) WITHOUT verifying the incoming
 * request's Authorization JWT.
 *
 * v0.17.7 F-EDGE-FUNCTION-AUTH-1 — sourced from 2026-04-29 Round-3
 * dogfood scan (supabase-vector-gmailkb-rag had two Edge Functions
 * exposing service-role-keyed DB queries to any unauthenticated
 * caller of the function URL).
 *
 * Two emission paths:
 *
 *   Path A (CRITICAL — full RLS bypass): file uses SERVICE_ROLE_KEY
 *     AND has a Deno.serve(...) handler AND lacks any
 *     auth.getUser(req.headers.Authorization) / verifyJWT() pattern.
 *     Anyone with the function URL gets full DB access.
 *
 *   Path B (HIGH — quota-burn): file calls a known paid third-party
 *     API host (OpenAI, Anthropic, Crawl4AI, ...) AND lacks an auth
 *     check. Anyone with the function URL drains the developer's
 *     third-party quota — billing-attack class.
 *
 * OWASP A07:2021 (Identification and Authentication Failures)
 * CWE-306 (Missing Authentication for Critical Function)
 */

const EDGE_FUNCTION_PATH_RE = /(?:^|\/)supabase\/functions\/[^/]+\/(?:index|[^/]+)\.[tj]sx?$/i;

const DENO_SERVE_RE = /\bDeno\.serve\s*\(/;

const SERVICE_ROLE_KEY_RE =
  /(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key|serviceRoleKey|service_role\b)/;

/** Patterns that indicate the incoming request's JWT is verified
 *  before the service-role-key DB call. Any of these inside the
 *  Deno.serve handler scope counts as auth boundary.
 *
 *  v0.17.8 HIGH-008 — broader library coverage + user-authored-helper
 *  heuristic. Mere `req.headers.get('Authorization')` extraction was
 *  removed: extracting the header without verifying the token is the
 *  classic extract-and-ignore bypass (audit-fixture adv-12). The new
 *  patterns require an actual verification CALL or a CamelCase auth-
 *  helper invocation that takes the request. */
const JWT_VERIFY_PATTERNS = [
  // Supabase
  /\bauth\.getUser\s*\(/,                          // supabase.auth.getUser(...)
  /\.auth\.getSession\s*\(/,                       // supabase.auth.getSession(...)
  // jose (camelCase)
  /\bverifyJWT\s*\(/,                              // custom verifyJWT
  /\bjwtVerify\s*\(/,                              // jose
  // jsonwebtoken (most popular Node JWT lib) — v0.17.8 HIGH-008
  /\bjwt\.verify\s*\(/,
  // Clerk — v0.17.8 HIGH-008
  /\bclerkClient\.users\.getUser\s*\(/,
  /\bclerkClient\.sessions\.verifySession\s*\(/,
  /\bgetAuth\s*\(\s*(?:req|request)\b/,
  // Lucia v3 — v0.17.8 HIGH-008
  /\blucia\.validateSession\s*\(/,
  /\b\.lucia\.validateSession\s*\(/,
  // Better-Auth — v0.17.8 HIGH-008
  /\bauth\.api\.getSession\s*\(/,
  // Custom verifiers (preserved)
  /\bverifyAccessToken\s*\(/,
  // User-authored auth helpers — v0.17.8 HIGH-008
  // Matches `await requireUser(req)`, `await assertAuthed(req, role)`,
  // `await verifyTokenForRequest(req)`, `await checkAuth(request, role)`,
  // `await ensureAuthenticated(req)`, `await validateSession(req)`,
  // `await authenticateRequest(req)`. Restricted to `await` form +
  // `req`/`request` as a passed argument so it does not match unrelated
  // utility calls.
  /\bawait\s+(?:require|assert|verify|check|ensure|validate|authenticate)\w*\s*\(\s*[^)]*\b(?:req|request)\b/i,
];

/** Patterns that indicate the function calls a known paid third-party
 *  API. Each of these hosts charges per-request — unauthenticated
 *  Edge Function = quota-burn billing-attack. */
const PAID_API_HOST_PATTERNS = [
  /api\.openai\.com/,
  /api\.anthropic\.com/,
  /api\.mistral\.ai/,
  /api\.together\.xyz/,
  /api\.x\.ai/,
  /generativelanguage\.googleapis\.com/,
  /api\.cohere\.ai/,
  /api\.replicate\.com/,
  /api\.helius-rpc\.com/,
  /\.helius\.xyz/,
  /quicknode\.com/,
  /alchemy\.com/,
  /infura\.io/,
  /api\.crawl4ai\.com/,
  /firecrawl\.dev/,
  /api\.scrapingbee\.com/,
  /api\.serpapi\.com/,
  /api\.brave\.com/,
  /api\.exa\.ai/,
  /api\.tavily\.com/,
];

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

function findFirstMatchLine(content: string, pattern: RegExp): number {
  const m = pattern.exec(content);
  return m ? findLineNumber(content, m.index) : 1;
}

export const edgeFunctionAuthCheckerScanner: Scanner = {
  name: 'edge-function-auth-checker',
  description:
    'Detects Supabase Edge Functions using service-role-key without verifying the caller\'s JWT (full RLS bypass) or invoking paid third-party APIs without auth (quota-burn class).',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx']);
    const edgeFiles = files.filter((f) => EDGE_FUNCTION_PATH_RE.test(f));

    for (const file of edgeFiles) {
      const content = readFileSafe(file);
      if (content === null) continue;

      // Must be a real Deno.serve handler — skip type-decl files etc.
      if (!DENO_SERVE_RE.test(content)) continue;

      const usesServiceRole = SERVICE_ROLE_KEY_RE.test(content);
      const hasJwtVerify = JWT_VERIFY_PATTERNS.some((p) => p.test(content));
      const callsPaidApi = PAID_API_HOST_PATTERNS.some((p) => p.test(content));

      // Path A — CRITICAL: service-role-key without JWT verification.
      // Full RLS bypass available to any caller of the function URL.
      if (usesServiceRole && !hasJwtVerify) {
        const id = `EDGE-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'edge-function-auth-checker',
          severity: 'critical',
          title:
            'Supabase Edge Function uses service-role-key without verifying caller JWT — full RLS bypass',
          description:
            'A Supabase Edge Function uses SUPABASE_SERVICE_ROLE_KEY for DB access but does not verify the incoming request\'s Authorization header. The service-role-key bypasses all Row-Level Security policies — any caller with the function URL can read/write any row in any table the role can touch. Verify the caller\'s JWT BEFORE any service-role DB call: extract `Authorization` header, instantiate a user-scoped supabase client with the anon-key, call `supabase.auth.getUser()`, and reject the request when the user is null. Use the service-role-key only AFTER the user identity is verified, and only for operations that legitimately need to bypass RLS (audit logs, cross-user reconciliation, etc.).',
          file,
          line: findFirstMatchLine(content, DENO_SERVE_RE),
          category: 'security',
          owasp: 'A07:2021',
          cwe: 306,
          fix: {
            description:
              'Verify the caller\'s JWT BEFORE invoking the service-role client. Pattern: const userClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }); const { data: { user } } = await userClient.auth.getUser(); if (!user) return new Response("Unauthorized", { status: 401 }); — only after this point use service-role-key.',
            code: "import { createClient } from \"jsr:@supabase/supabase-js@2.39.7\";\nconst supabaseUrl = Deno.env.get(\"SUPABASE_URL\")!;\nconst anonKey = Deno.env.get(\"SUPABASE_ANON_KEY\")!;\nconst serviceKey = Deno.env.get(\"SUPABASE_SERVICE_ROLE_KEY\")!;\n\nDeno.serve(async (req) => {\n  const userClient = createClient(supabaseUrl, anonKey, {\n    global: { headers: { Authorization: req.headers.get(\"Authorization\") ?? \"\" } },\n  });\n  const { data: { user }, error } = await userClient.auth.getUser();\n  if (error || !user) return new Response(JSON.stringify({ error: \"Unauthorized\" }), { status: 401 });\n  const admin = createClient(supabaseUrl, serviceKey);\n  // ... use admin only AFTER user is verified ...\n});",
            links: [
              'https://cwe.mitre.org/data/definitions/306.html',
              'https://supabase.com/docs/guides/functions/auth',
            ],
          },
        });
        // Skip Path B for the same file — Path A already fires CRITICAL.
        continue;
      }

      // Path B — HIGH: paid-API call without auth check.
      // Quota-burn / billing-attack class.
      if (callsPaidApi && !hasJwtVerify) {
        const id = `EDGE-${String(idCounter++).padStart(3, '0')}`;
        const paidPattern = PAID_API_HOST_PATTERNS.find((p) => p.test(content));
        findings.push({
          id,
          scanner: 'edge-function-auth-checker',
          severity: 'high',
          title:
            'Supabase Edge Function calls paid third-party API without verifying caller JWT — quota-burn risk',
          description:
            'A Supabase Edge Function makes calls to a known paid third-party API (OpenAI / Anthropic / Crawl4AI / Helius / etc.) without verifying the incoming request\'s Authorization header. Anyone with the function URL can repeatedly invoke it and drain the developer\'s third-party quota — billing-attack class. Verify the caller\'s JWT before initiating the upstream call, and add per-user rate-limiting (e.g., per-user-id token bucket via Redis or Supabase rate-limit middleware).',
          file,
          line: paidPattern
            ? findFirstMatchLine(content, paidPattern)
            : findFirstMatchLine(content, DENO_SERVE_RE),
          category: 'security',
          owasp: 'A04:2021',
          cwe: 306,
          fix: {
            description:
              'Verify the caller\'s JWT and apply per-user rate-limiting before invoking the paid API. The Edge Function URL is essentially world-callable; treat every invocation as untrusted until proven otherwise.',
            code: "Deno.serve(async (req) => {\n  const auth = req.headers.get(\"Authorization\");\n  if (!auth) return new Response(\"Unauthorized\", { status: 401 });\n  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });\n  const { data: { user } } = await userClient.auth.getUser();\n  if (!user) return new Response(\"Unauthorized\", { status: 401 });\n  // optional: rate-limit per user.id before upstream call\n  const upstream = await fetch(\"https://api.openai.com/v1/embeddings\", { /* ... */ });\n  return new Response(await upstream.text(), { headers: { \"Content-Type\": \"application/json\" } });\n});",
            links: [
              'https://cwe.mitre.org/data/definitions/306.html',
              'https://owasp.org/Top10/A04_2021-Insecure_Design/',
            ],
          },
        });
      }
    }

    return {
      scanner: 'edge-function-auth-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
