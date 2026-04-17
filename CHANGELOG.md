# Changelog

All notable changes to AEGIS are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). AEGIS uses
SemVer from v1.0; pre-1.0 (0.x) releases may include breaking changes,
which are called out in the relevant entry below.

Score-honesty convention: each milestone lists the **measured** honest
score, not the originally-targeted score. When they differ, both are
shown with the reason the target wasn't met.

---

## [0.11.1] — 2026-04-17 — "Dogfood-Driven Precision"

**Honest score:** **8.7** (up from 8.6 at v0.11.0). Patch release driven
entirely by empirical dogfood — scanning a real-world Next.js+Supabase
project with v0.11.0 surfaced three distinct auth-enforcer FP classes
(comment-prose match, layout/middleware-unawareness, narrow MIDDLEWARE_AUTH
pattern list) plus two ssrf-checker FPs (non-exported wrapper, env-host
template). None of these were on the v0.11 roadmap as speculative items;
all are empirically measured with canary-pinned RED → GREEN transitions.

**Canary tally:** new phase3-v011x-dogfood harness reaches **23/23 full
green** on first impl-attempt (6 RED baseline → 23 GREEN post-fix, with
the extra 17 being regression pins for edge cases derived from Flag 3's
variant matrix). phase1 + phase2a + phase2b unchanged at 27/27.

**Full test suite:** 1462 → 1498 (+36 regression pins: 31 for the new
`ast/page-context.ts` module across 7 exports, +2 FP #1 + +3 FP #2 in
`ssrf-checker.test.ts`). Benchmark 30/30 unchanged. Self-scan 1000/A/0.

**Real-world corpus (8 projects):** `|Δ|` max = 3 points, 0 grade shifts.
The Spa-style dogfood project driving this release: 940/A → 946/A, 6
false-positive findings eliminated (3 auth-enforcer CWE-306, 3
ssrf-checker CWE-918).

### Fixed — 5 empirical FP classes (Bugs A + B + C + FP #1 + FP #2)

**Bug A — auth-enforcer comment-prose suppression.**

Natural-language prose inside `//` line comments and `/* … */` block
comments was being lexically matched by `DB_ACCESS_PATTERNS` regex
`\bquery\s*\(`. Example: a page with the line comment
`// Stats query (separat, ohne Filter)` triggered a spurious
"Server component with DB access missing auth guard" finding despite
the page having zero actual database calls.

Fix: new `stripComments` utility in `ast/page-context.ts` preserves
line numbers and skips string literals (so SQL hints like
`'SELECT /* comment */ * FROM t'` survive). Applied before regex
scans on page.tsx content.

Reference class: v0.10 Z2 comment-leak applied to a different scanner.

**Bug B — auth-enforcer App-Router layout+middleware awareness.**

`auth-enforcer` scanned each `page.tsx` file in isolation, expecting
an inline auth guard. The modern Next.js App-Router pattern uses
`middleware.ts` + parent `layout.tsx` as the auth boundary — dozens of
FPs per scan on any real App-Router codebase.

Fix: new `ast/page-context.ts` module with layout-chain walking
(`collectAncestorLayouts`), middleware matcher AST parsing
(`parseMiddlewareMatchers`), Next.js matcher-path semantics
(`matcherCoversPath`), first-statement directive check
(`isClientDirective`), and **structural** layout-guard recognition
(`hasLayoutAuthGuard`) — no hardcoded auth-helper names. Custom
helpers like `hasAccessToPath`, `checkAccess`, `requireUser` are all
recognised via the shape
`const { X } = await fn(); if (!X) redirect/throw/notFound`.

Edge-case handling explicitly pinned via canary: `'use client'`
layouts do not count (client-side auth is cosmetic), wrong-direction
checks (`if (user) redirect`) do not count, log-only fail-open
patterns do not count, `try/catch` swallowing auth failures do not
count (top-level walk naturally excludes them), env-conditional
guard wrappers (`process.env.BYPASS_AUTH`) do not count, `export
const runtime = 'edge'` bypasses suppression conservatively.

The composite `pageIsGuardedByContext` check is OR-gated across
layout-chain and middleware sources — any single FAIL-CLOSED source
suffices. Wired into `auth-enforcer`'s `page.tsx` server-component
scan.

**Bug C — MIDDLEWARE_AUTH_PATTERNS data-driven widening.**

Survey of 9 public projects + real-world dogfood surfaced four
dominant middleware auth patterns the original 6-entry list missed:
- `getServerSession` — next-auth v4 (5/9 corpus)
- `getServerAuthSession` — T3-stack convention
- `.auth.(getUser|getSession)` — Supabase SSR
- `currentUser` — Clerk

Added as regex entries in `MIDDLEWARE_AUTH_PATTERNS`; mirror-copy
kept in `ast/page-context.ts` for the guard-check helper (local copy
avoids a cross-scanner import cycle; M1 + M2 canary pins detect any
drift).

**FP #1 — ssrf-checker non-exported wrapper + TS-generics tolerance.**

Z4's Day-1 library-wrapper heuristic gated on the `export` keyword
before `function`. Real-world codebases structure wrappers as
non-exported internal helpers (`async function apiFetch(url) { … }`)
called from exported convenience functions (`apiGet`, `apiPost`).
The SSRF reasoning is identical — wrapper has no user input, the
call site does.

Fix: widened the regex to drop the `export` gate AND tolerate
TypeScript generic parameters between the function name and the
opening paren (`function apiFetch<T>(url)` broke the original
`\w+\s*\(` shape entirely — `\w+[^(]*\(` handles any non-paren
chars between name and `(`).

**FP #2 — ssrf-checker env-assigned template host.**

Template-literal fetches of the shape `fetch(\`${X}/path\`, …)` fired
on every instance, regardless of X's origin. When X is assigned from
`process.env.Y` in the same file (idiomatic config-loaded host), the
host is deployment-fixed and not user-controllable — no SSRF risk.

Fix: new `isTemplateEnvHostFetch` helper extracts the first
interpolation variable and looks for
`const|let|var <X> = process.env.<Y>` (including `?? 'default'`
fallback shape) in the same file. Out of scope for v0.11.1:
destructure-from-env shape (`const { X } = process.env`) — will
still emit (conservative).

### Architecture

- New `ast/page-context.ts` (~700 LoC including 7 exports + JSDoc-
  encoded discipline rules). Mirror-role to v0.11's `ast/guard-flow.ts`
  — shared primitives for cross-file Next.js App-Router analysis.
- 31 unit tests in `__tests__/ast/page-context.test.ts` covering each
  export in isolation (pure-function tests for content-level
  primitives, filesystem-backed tests via `writeFixtures` for the
  layout-chain and middleware-parsing helpers).
- Scope-asymmetry (Bug B design decision): name-list recognition for
  middleware (converged ~10 patterns), STRUCTURAL AST recognition for
  layout (custom helpers divergent per codebase).

### Known limitations (still deferred beyond v0.11.1)

- **FP #3** — tenant-isolation-checker `[slug]` dynamic-route +
  `.eq('slug', param)` + service_role pattern recognition. Defered
  because it's security-sensitive: the suppression must check
  parameter-flow (slug unchanged), scoped-use (no subsequent writes),
  and ideally RLS-policy awareness. Requires canary-first-with-edge-
  cases discipline; scheduled for v0.11.2.
- Bug A block-comment class: SQL hints inside strings survive
  correctly, but if a quoted string happens to contain the literal
  `*/` followed by a `\bquery\s*\(` prose inside another quoted
  region, the stripper's string-skip is simple and may not handle
  pathological cases. Not observed in real-world code; flagged here
  for completeness.
- FP #2 destructure-from-env (`const { X } = process.env`) still
  emits. Conservative by choice — rare shape, and the regex complexity
  to cover it wasn't canary-pinned as necessary.

---

## [0.11.0] — 2026-04-17 — "Recall Honesty Part 2"

**Honest score:** **8.6** (up from 8.5 at v0.10.0). Closes the four
v0.10-deferred canaries (D4, D5, S1, S12) and two precision gaps:
**Z3** (consumer-side guard-flow symmetry — the architectural
consequence of the D4/D5 fix) and **Z4** (ssrf-checker library-wrapper
FP reduction — independent, no canary signal). Canary harness reaches
**27/27 full green** for the first time — the recall-measurement
baseline established in v0.10.0 is now at parity with the ship bar.

**Canary tally: 23/27 → 27/27 pass.** Full test suite **1427 → 1462
(+35 regression pins)** across v0.11: +12 Day-1 scanner/precision
pins, +23 Day-2 analyzer-core work (8 guard-flow unit, 5
function-summary shape, 10 taint-tracker consumer-side suppression).

**Real-world corpus (8 projects): 0 grade shifts, `|Δ|` max = 1
point.** The same code-base drift that closed 4 synthetic canaries
left real-world precision stable — same dual-claim pattern as
v0.10.0 (synthetic-recall-up + real-world-precision-stable).

### Fixed — 4 canary-tracked closures + 2 precision improvements

**D4 / D5 — Consumer-side guard suppression (taint-analyzer).**

v0.9.1 added exporter-side regex-guard recognition in function-summary
(`if (!regex.test(param)) return; sink(param)` inside an exported
function would NOT emit CWE-918 on the cross-file call). v0.11 extends
the same dominator-walk semantics to the *consumer* side: when a
caller writes `if (!isSafeUrl(url)) return; await fetch(url)` with a
local or imported guard function, the sink emission is suppressed.
**Three new recognition shapes** land alongside the v0.9.1
`<regex>.test(param)`:

- `<paramName>.startsWith('<literal>')` — the D5 canary shape
  (protocol / host prefix check).
- `<allowlist>.has(<paramName>)` / `.includes(<paramName>)` — simple
  membership allowlists.
- `<allowlist>.has(new URL(<paramName>).hostname)` — the D4 canary
  shape (host-allowlist with URL parse). Same-function intra-body
  local-var tracking recognises the idiomatic
  `const u = new URL(raw); TRUSTED_HOSTS.has(u.hostname)` form in
  addition to the inline `X.has(new URL(p).hostname)` one-liner.

Architecture: a new `ast/guard-flow.ts` module owns the shared
dominator walk used by both the exporter-side check (v0.9.1) and the
new consumer-side `isSinkGuardedByKnownPredicate` helper — single
source of truth for "does an ancestor-then or preceding-early-exit
if-stmt dominate this sink call?". The field
`guardsCwes: number[]` on `FunctionSummary` mirrors `sanitizesCwes`
but with caller-side dominance semantics (initial CWE scope: 918
only; broader classes expand as canary data demands).

CWE-specificity is strict: a guard that narrows CWE-918 does NOT
suppress a CWE-89 or CWE-78 sink on the same identifier. Value-
capture does NOT count as a guard (D1 lesson from v0.10 auth-enforcer
full-flow: a boolean-returning call that isn't used in an if /
ternary / short-circuit doesn't narrow anything — `const ok =
isSafeUrl(x)` followed by `fetch(x)` is still an SSRF sink). Pinned
by a regression test.

**D4 — ssrf-checker structural SAFE_PATTERN for typed URL guards.**

ssrf-checker runs in parallel to the taint-analyzer. Silencing
taint-analyzer alone left ssrf-checker firing its own regex-based
CWE-918 on D4. A new narrow SAFE_PATTERN
`\bfunction\s+\w*(Url|URL|Host|Origin)\w*\(.+\)\s*:\s*boolean\b`
recognises user-defined typed boolean guards — narrow by convention
(name token + typed return together distinguish URL guards from
generic boolean helpers like `isAdmin`). Both scanners now fall
silent in tandem on the same structural shape.

**S1 — middleware-auth-checker: CVE-2025-29927 (new scanner, 41st).**

Next.js middleware-auth bypass via crafted `x-middleware-subrequest`
header. New scanner `middleware-auth-checker` fires on
`middleware.ts` / `middleware.js` that checks the header and returns
a bypass path (`NextResponse.next()` / redirect-to-same-path) — the
CVE shape. Bumps AEGIS scanner count from 40 → 41.

**S12 — timing-safe-checker: UPPERCASE env-var name allowlist.**

Pre-v0.11: timing-safe-checker's UPPERCASE detection matched
`STATIC_TOKEN` and `WEBHOOK_SECRET` but missed the idiomatic
`process.env.SECRET` match because the regex did not allow
`UPPERCASE_WITH_UNDERSCORES` fully. Widened the allowlist regex; S12
canary flips RED → PASS.

**Z4 — ssrf-checker library-wrapper heuristic (FP reduction, no
canary flip).** Exported functions whose first parameter is the
variable passed to `fetch` are library HTTP wrappers — SSRF exposure
materialises at the consumer's call site, not inside the wrapper.
Regex-scoped parameter capture (`\(([^)]*)\)`) avoids the body-bleed
over-match that an early draft hit.

**Z3 — Cross-file consumer-side guard resolution (symmetry with
v0.9.1 exporter-side).** The same consumer-side helper that handles
D4 / D5 resolves named-function guards cross-file via the module
graph, reading `guardsCwes` from the imported function's summary.
`resolveSymbolOrigin` → `findExportedFunction` → `buildSummary`
pipeline reused from the existing cross-file-sink path — no new
graph-traversal logic.

### Architecture

- **New module `packages/scanners/src/ast/guard-flow.ts` (~400 LoC
  inclusive of JSDoc-encoded discipline rules** — e.g.
  `detectGuard MUST NOT call isCallGuardedByRegexTest` as an
  abstraction-boundary warning embedded in-code, not just in review
  comments; Flag-1-style enforcement that survives reviewer
  turnover). Shared between `function-summary` (builder-side) and
  `taint-tracker` (consumer-side). Exports
  `isSinkDominatedByNarrowingCondition` (generic dominator walk),
  `isCallGuardedByRegexTest` (v0.9.1 API preserved, now delegates),
  `detectGuard` (v0.11 new, summary-side).
- **New helpers in `taint-tracker.ts`**: `enclosingFunctionBody`,
  `findSameFileSummarizable`, `resolveGuardsCwesForCallee`,
  `callSatisfiesGuardShape`, `conditionHasKnownGuardOn`,
  `isSinkGuardedByKnownPredicate`. Wired into three sink-emission
  call sites: `checkCallSink`, `checkCrossFileCallSink`,
  `checkCrossFileMethodCall`. Each with per-CWE strict match.
- **Built-in scanner count 40 → 41** (38 → 39 regex + 1 AST + 1 RPC)
  via `middleware-auth-checker`.

### Known limitations (still deferred beyond v0.11)

- **Guard shapes not yet recognised**: non-typed arrow-function
  guards (`const isSafeUrl = (u) => u.startsWith('https://')`) work
  for taint-analyzer via summary detectGuard but ssrf-checker's
  SAFE_PATTERN requires the `function <Name>(): boolean` form.
- **Value-disjunction guards**: `url.startsWith('https://a') ||
  url.startsWith('https://b')` does NOT count as a guard (one
  recognised shape per return; disjunction requires multi-return
  merge which is post-v0.11 scope).
- **Non-918 guard CWEs**: `detectGuard` returns `[918]` only.
  Real-world use of startsWith / regex.test on paramName is
  overwhelmingly URL-narrowing; SQL / path-traversal guard CWEs
  expand when canary data demands.
- **Overloaded method symbols** in `checkCrossFileMethodCall` still
  brittle when the TypeChecker finds multiple declarations — fail-
  open today, no regression from v0.10 but known weakness.

---

## [0.10.0] — 2026-04-17 — "Recall Honesty"

**Honest score:** **8.5** (up from 8.4 at v0.9.6). First release
shaped by a canary-based recall-measurement harness rather than by
ad-hoc precision improvements. A 27-canary fixture suite
(`packages/benchmark/canary-fixtures/`) now measures: 5 harness-
validation canaries, 10 deferred-item targets (from v0.9.x backlog),
and 12 blind-spot stressors covering scanners untouched by previous
releases. Each canary is authored against POST-v0.10.0 expected
behaviour — first-run RED *is* the FN/FP measurement. Every v0.10
fix is paired to a canary that was RED before the fix and is GREEN
after it.

**Canary tally: 16/27 → 23/27 pass.** The remaining 4 are explicit
v0.11 scope (see "Known limitations" below). Full test suite
1408 → 1427 green.

**Real-world corpus (8 projects): 0 grade shifts, `|Δ|` max = 5.**
README corpus table updated with post-v0.10.0 scores. Precision on
real-world codebases held stable while synthetic recall on
documented gaps improved — the dual view is intentional. A
precision-only interpretation of "scores stable = good" would be
circular; recall improvement is the real signal.

### Fixed — 9 scanner-precision and -recall fixes across 7 scanners

**Tenant-isolation-checker — AST rewrite with Prisma awareness (Z2 + D8).**

Pre-v0.10: regex-only `.from(` detection. Two problems — (a) regex
matched inside comment prose (`// uses supabase .from(...)`) and
produced spurious CWE-639 findings; (b) Prisma codebases had 0%
coverage. Post-v0.10: AST-based detection parses each route file
with the TypeScript Compiler API, identifies Supabase `.from(`
chains and recognised Prisma query-method calls (findFirst,
findUnique, findMany, their OrThrow variants, create, update,
upsert, delete, their plural variants, count, aggregate, groupBy).
Checks the chain / where-clause for any tenant-boundary
discriminant (tenant_id, tenantId, workspaceId, teamId, orgId,
organizationId). Activation gate widened — scan if ANY discriminant
literal OR Prisma / Supabase client usage is present.

Calibration from dub-corpus sanity: admin routes (`/admin/` path
component) skipped by design — auth-enforcer's role-guard check is
the right gate, not tenant-isolation. `@cross-tenant` /
`@admin-only` JSDoc annotations honoured as explicit opt-outs for
routes that deliberately serve cross-tenant data outside the
`/admin/` convention. Prisma findings emit at MEDIUM
(audit-required) not HIGH (IDOR) because ORM relationships often
scope implicitly via FK chains.

**Auth-enforcer — full-flow gating analysis (D1) + `@self-only`
annotation (D3) + word-bounded `/authorize/` (Z1).**

ROLE_GUARD_PATTERNS split into two semantic buckets:

- CALL patterns (`requireRole`, `hasRole`, `isAdmin`, Clerk
  `has({role:…})`, taxonomy-style `verifyCurrent…` and
  `userHasAccess` helpers) — throw on missing role, presence
  anywhere in file is accepted as a guard.
- COMPARISON patterns (`session.user.id [!=]== X`, Clerk
  `publicMetadata.role`, reversed-operand + snake_case variants) —
  only count when the expression appears in a GATING position
  (if-condition, ternary-condition, while/do/for-condition, left
  operand of `&&` / `||` / `??`). A comparison assigned to a
  variable (`const isOwn = session.user.id === params.id`) never
  gates the subsequent write; pre-v0.10 it did silence CWE-285 FPs
  despite not being an actual gate.

`@self-only` is a new JSDoc / line-comment suppression distinct
from `@public`. `@public` suppresses both CWE-306 (auth) and
CWE-285 (role). `@self-only` requires auth (CWE-306 still fires if
missing) and suppresses only CWE-285 — intended for authenticated
self-service routes where every user manages their own resources.

Z1: `/authorize/` → `/\bauthorize\s*\(/`. The bare regex
substring-matched inside any `"unauthorized"` / `"authorization"`
string literal — every route returning `{ error: 'unauthorized' }`
silenced CWE-285. The word-bounded function-call shape eliminates
the substring leak.

**Mass-assignment-checker — balanced-brace Prisma regex (Z5).**

Pre-v0.10: `[^}]*data:body` could not cross `}`, so the realistic
nested shape `{ where: { id }, data: body }` — the standard Prisma
mutation call — escaped detection. Replaced with
`(?:[^{}]|\{[^{}]*\})*` which allows one level of nested objects.

**RSC-data-checker — Prisma full-record detection (Z6).**

Pre-v0.10: SELECT_ALL_PATTERN only matched Supabase `.select('*')`.
Prisma codebases had 0% RSC-leak coverage — `prisma.user.findUnique`
returns every scalar field (incl. password_hash, resetToken,
mfaSecret) by default. Added PRISMA_FULL_RECORD_PATTERN alongside
SELECT_ALL_PATTERN; widened DATA_TO_JSX detection to recognise props
whose value is a single-variable expression matching a likely
full-record identifier (user / post / profile / account /
subscription / organization / team / workspace / document / …).

**Prompt-injection-checker — direct-variable shape (Z7).**

Pre-v0.10 patterns all required template-literal `${…}`
interpolation. The idiomatic OpenAI / Anthropic SDK shape
(`content: userMessage` directly, no template literal) escaped
detection despite identical risk. Two new patterns — one for LLM
messages arrays, one for direct `prompt: userVariable` — both use
negative lookaheads to exclude string-literal / array / object
values.

**RLS-bypass-checker — case-insensitive service_role (Z8).**

Pre-v0.10: `/service_role/` without /i flag + dynamic
`RegExp(source, 'g')` dropped any pattern flags. The canonical
Supabase env-var `SUPABASE_SERVICE_ROLE_KEY` (UPPERCASE) did NOT
match — codebases referencing only the env-var without lowercase
prose escaped detection. Fix: pattern + dynamic regex composition
both explicit `'gi'`.

**walkFiles — root-only ignore encoding (Z9).**

v0.9.5's DEFAULT_IGNORE entries `public` / `static` / `assets` were
aimed at the Next.js project-root `public/` directory but matched
at ANY depth — legitimate nested paths (`app/api/public/…`,
`src/components/public/…`) were silently dropped. walkFiles now
accepts ignore entries prefixed with `/` as "root-only" shape.
DEFAULT_IGNORE entries migrated to `/public`, `/static`,
`/assets`. Bare names (used by scanner-internal skip lists and user
configs) retain any-depth semantics — backwards-compatible.

### Added

- **Canary harness** (`packages/benchmark/canary-run.mjs`, 155 LoC)
  — iterates a given phase directory, invokes the Orchestrator per
  fixture, asserts expected `{scanner, cwe}` pairs. Supports TP
  mode (ANY declared pair matched = pass; single vuln class can
  emit under equivalent CWEs) and FP mode (no declared pair fires).
  OR-scanner support (scanner can be a string or string[]).
- **27 canary fixtures** across three phases.
- **+19 unit-test regression pins** — covering Prisma tenant
  detection, comment-strip, @self-only, full-flow gating, word-
  bounded `/authorize/`, nested mass-assignment regex,
  Prisma-to-JSX, direct-variable prompt injection, UPPERCASE
  service-role, walkFiles root-only.

### Changed

- 5 `@aegis-scan/*` packages bumped 0.9.6 → 0.10.0.
- `ci/github-action/action.yml` default `aegis-version` pinned to
  `v0.10.0`. README example + pinning note updated.

### Known limitations (explicit v0.11 scope)

- **Cluster B + Z3** (D4 / D5 canaries) — `taint-analyzer`
  consumer-side cross-file guard-flow. v0.9.1 covered exporter-side
  guard-then-sink; consumer-side `if (guard(x)) sink(x)` with a
  lib-imported boolean validator is a separate pattern. Planned
  analyzer-core upgrade for v0.11.
- **Z4** — `ssrf-checker` regex fires inside library wrappers
  (`export function rateLimitCall(url, opts) { return fetch(url,
  ...) }`) regardless of whether consumers pass user input.
  Heuristic or engine-overlap resolution deferred.
- **S1** — CVE-2025-29927 Next.js middleware auth-bypass pattern.
  No middleware-specific scanner exists today; auth-enforcer's
  scope is `/api/` route handlers only. New scanner category for
  v0.11.
- **S12** — `timing-safe-checker` variable-name allowlist is narrow
  (token, secret, apiKey, signature, webhookSecret, CRON_SECRET).
  Custom names escape. Allowlist expansion deferred.

### Honesty notes

- `|Δ|` max 5 on dub reflects real Prisma findings surfaced at
  MEDIUM (audit-required), absorbed by the per-scanner 50-point
  cap. Users who want HIGH severity can override in
  `aegis.config.json`.
- cal-com +22 findings (906 → 911 → 928 across the R1-R3 sequence;
  final 911 in public README). The delta is from Z9 unskipping
  nested `apps/*/public/` dirs in the monorepo structure. Users
  who prefer the pre-v0.10 behaviour can add a bare `public` entry
  (no leading slash) to their `aegis.config.json` `ignore` list.
- The 22-canary harness is intentionally synthetic and
  small-sample. Canary recall is not corpus recall — published
  FN/FP numbers are per-canary, with the sample size reported
  alongside. Corpus scanning remains the authoritative real-world
  signal.

---

## [0.9.6] — 2026-04-17 — "Sanitization + Consistency Hotfix"

**Honest score:** unchanged **8.4**. No behavior change. This release
exists because v0.9.5 shipped four comments that named a specific
originating codebase (the word appeared in two source comments in
`packages/scanners/src/quality/auth-enforcer.ts`, one test comment in
`packages/scanners/__tests__/quality/auth-enforcer.test.ts`, and one
sentence in the v0.9.2 CHANGELOG entry). The project's sanitization
policy is that repository history, published artifacts, and release
notes never name internal project/company contexts — so these four
lines are a policy violation, even though they are non-functional and
low-risk. This release replaces them with neutral wording ("a narrow
helper family") and deprecates the affected v0.9.5 publish on npm.

### Fixed

- **Scrubbed four comments naming the originating codebase** — two in
  `auth-enforcer.ts` (JSDoc + inline), one in the corresponding test,
  one in the `[0.9.2]` CHANGELOG entry. Technical meaning preserved
  ("the set was narrow, now extended"), originating project name
  removed.

- **Corpus table — added `documenso` row** to the `Real-world corpus`
  section of README.md. The v0.9.5 README claimed an 8-project corpus
  but the table listed only 7 (documenso was missing). Re-scanned with
  the v0.9.5-post-fix code: **documenso 956 / A / HARDENED** (stack:
  Next.js + Prisma). The README + v0.9.5 CHANGELOG 8-project counts
  were correct; the table was simply under-rendered.

### Deprecated

- **npm packages `@aegis-scan/{core,scanners,reporters,cli,mcp-server}@0.9.5`**
  via `npm deprecate`. Users should upgrade to 0.9.6. No functional
  change — the deprecation reason is the un-scrubbed comments only.
  The `dist/quality/auth-enforcer.js` shipped in the 0.9.5 scanners
  tarball contains the leak; other tarballs are clean.

### Release-hygiene note

The non-neutral wording was introduced in `0bcb3c1` (v0.9.2 validator
response) and persisted across tags v0.9.2 / v0.9.3 / v0.9.4 / v0.9.5.
A full sweep of the v0.9.5 tarballs against the project's internal
sanitization scrub list confirmed that (a) only the `scanners` tarball
was affected, (b) exactly four occurrences existed, (c) all four were
non-functional comments. Core / cli / reporters / mcp-server tarballs
were already clean.

### Validation

Gates unchanged from v0.9.5 (this release is comment-only):

- Self-scan: **1000 / A / 0 findings**
- Taint benchmark: **30 / 30 strict**
- Test suite: **1408 passing**
- `pnpm build`: exit 0 across all 5 packages
- Scrub-list grep on shipped v0.9.6 tarball: **0 hits**

---

## [0.9.5] — 2026-04-17 — "Corpus-Driven Precision Fixes"

**Honest score:** 8.3 → **8.4**. First release shaped primarily by real-world
corpus findings rather than validator / dogfood feedback. Eight public
Next.js projects (midday, supabase-studio, dub, cal.com, documenso,
formbricks, trigger.dev, shadcn/taxonomy) were scanned with v0.9.3, each
finding was manually annotated TP/FP, and the four most impactful FP
patterns were fixed and pinned with regression tests. Corpus scores
recovered from four F-grades to A-grade on well-maintained codebases,
with the lone remaining F — supabase-studio — correctly retained because
its two BLOCKERs are legitimate SQL-concat findings in shipping source.

### Fixed

- **`public/`, `static/`, `assets/` added to `DEFAULT_IGNORE`** (corpus
  fix 1; `packages/core/src/config.ts`). Supabase-studio went from 483
  findings to 249 after this change: the removed 234 FPs were all
  Monaco Editor + vendor-bundle `eval()` matches in `public/monaco/`.
  Rationale: projects do not own the source inside `public/`; scanning
  minified vendor bundles produces no actionable signal. Opt out via
  explicit `ignore: ['!public']` in `aegis.config.json` if needed.

- **Per-scanner-per-category scoring cap (50 pts max)** (corpus fix 2;
  `packages/core/src/scoring.ts`). A single quality scanner accumulating
  400+ low-severity findings was collapsing well-maintained projects to
  F/0. Any one scanner can now contribute at most 50 deduction points per
  category; high / critical / blocker findings from different scanners
  still stack normally. Corpus recovery:

  | Project | Before | After | Stack |
  |---------|--------|-------|-------|
  | formbricks | 0/F | 968/A | Next.js + Prisma |
  | trigger.dev | 0/F | 953/A | Next.js + Prisma |
  | midday | 0/F | 957/A | Next.js + Supabase |
  | dub | 933/A | 956/A | Next.js + Prisma |
  | cal.com | 899/A | 947/A | Next.js + Prisma |

- **`eval()` pattern hardened — three sub-fixes** (corpus fix 3;
  `packages/scanners/src/quality/crypto-auditor.ts`). The prior pattern
  `\beval\s*\(` had three FP classes:
  - Word-boundary end: `\beval\b` (not `\beval`) now required, so
    `evalite()` and `evaluate()` no longer substring-match.
  - No whitespace between `eval` and `(`: `bun run eval (watch mode)` in
    prose comments no longer matches.
  - Negative lookbehind `(?<!\.)` excludes method calls: `redis.eval()`
    (Lua API), `someLib.eval()`, etc. no longer flag.

  Midday's `evalite()` AI-eval-framework BLOCKER, formbricks's
  `redis.eval()` Lua-API BLOCKER, and several comment-prose FPs across
  the corpus are eliminated.

- **`innerHTML` flags only variable writes** (corpus fix 4;
  `packages/scanners/src/quality/xss-checker.ts`). Pattern tightened to
  `/\.innerHTML\s*=\s*(?!["'\`])(?=\w|\${)/` — safe clears
  (`element.innerHTML = ""`) and comparisons (`x.innerHTML === y`) no
  longer match; only assignments of bare identifiers or template
  expressions do. Midday's `innerHTML = ""` safe-clear FP eliminated.

### Added

- **+6 corpus regression pins** — three in
  `packages/scanners/src/quality/__tests__/crypto-auditor.test.ts`
  (evalite word-boundary, comment-prose, `redis.eval()` method-call) and
  three in `packages/scanners/src/quality/__tests__/xss-checker.test.ts`
  (safe clear, comparison, templated write). Test count: 1402 → **1408**.

### Release-hygiene note

The code changes in this release were in fact already published to npm
under `0.9.4` — the `pnpm publish -r` command published from the current
HEAD after the v0.9.4 tag was cut, so the corpus-fix commit was bundled
into the 0.9.4 tarballs alongside the release-workflow bootstrap. This
release tags the code under its correct version with a CHANGELOG that
matches what is actually shipped. Users on `@aegis-scan/*@0.9.4` already
have these fixes; users on `@aegis-scan/*@0.9.5` have the fixes **and**
documentation that accurately describes them.

### Known FP patterns deferred to v0.10

- `tenant-isolation-checker` fires on Prisma apps using `workspaceId`
  instead of `tenant_id` — dub gets 17 high-severity FPs. Fix requires
  teaching the checker to detect Prisma-based multi-tenancy conventions.
- `ssrf-checker` doesn't recognize guard functions (`if (isSafeUrl(x))
  fetch(x)`). Fix requires taint-flow guard-awareness.
- `supabase-studio` retains 2 SQL-concat BLOCKERs in
  `Reports.constants.ts` and `Logs.utils.ts`. These are **real** findings
  in shipping source code and remain correctly flagged.

### Self-scan / benchmark

- Self-scan on `~/Developer/projects/aegis`: **1000 / A / 0 findings**.
- Taint benchmark: **30 / 30 strict**.
- Test suite: **1408 passing** (165 core + 1050 scanners + 92 reporters
  + 14 mcp-server + 87 CLI).
- `pnpm build`: exit 0 across all five packages.

---

## [0.9.4] — 2026-04-17 — "Release-Workflow Bootstrap"

**Honest score:** unchanged **8.3**. No code changes. Release-hygiene-only
bump that puts the `@types/node` devDependency + Node16 tsconfig into a
tagged commit, so the `release.yml` workflow can build the VS Code
`.vsix` end-to-end from CI without manual local upload. Closes a process
gap carried over from v0.9.2 and v0.9.3 (in both releases the CI fix
landed one commit *after* the tag, so the `.vsix` was built locally and
attached by hand; user-impact was zero, but the workflow had never been
proven end-to-end).

### Changed

- **5 `@aegis-scan/*` packages** bumped 0.9.3 → 0.9.4.
- **`ci/github-action/action.yml`** default `aegis-version` pinned to
  `v0.9.4`. README example + pinning note updated to match.
- **`aegis-vscode`** stays at 0.2.0 (independent versioning; the `.vsix`
  filename reflects extension version, not release version).

### Not changed

- `packages/scanners` logic — no scanner edits.
- `packages/core`, `reporters`, `cli`, `mcp-server` — version bump only.
- Self-scan, benchmark, and test suite: **unchanged** from 0.9.3 (1402
  tests green, benchmark 30/30 strict, self-scan 1000/A/0-findings).

### Rationale

Release hygiene matters for an OSS project. If the CI release workflow
has never produced its primary artifact successfully from an actual
tag, the project can't claim that workflow is trustworthy. This release
is the proof-of-life attempt: the tagged commit already contains the
`@types/node` devDep + `moduleResolution: Node16` tsconfig that the
extension's isolated install needs. On publish, `release.yml` checks
out at `v0.9.4`, builds cleanly, and attaches the `.vsix` automatically.

If the workflow succeeds, this process gap is closed for good. If it
fails, the diagnostic output points at whatever is still broken — the
point is exercising the path.

---

## [0.9.3] — 2026-04-17 — "Validator Residual + README Slimdown"

**Honest score:** 8.2 → **8.3**. Closes the remaining v0.9.2 validator
residuals (auth-enforcer optional-chaining / reversed-operand /
tRPC-context gaps; stale suppression entry) and slims the README to
a tool-reference document instead of a release-history narrative.

### Fixed

- **Auth-enforcer next-auth residual FPs (validator MAJOR-02 residual).**
  The v0.9.2 ROLE_GUARD_PATTERNS used literal `session\.user\.` which
  does NOT match `session?.user.` under optional chaining. Every post-
  null-check ownership comparison in a vanilla next-auth codebase was
  still being flagged (low-severity "missing role guard"). Two
  additional FP classes also unfixed: reversed operand order
  (`params.userId !== session?.user.id`) and tRPC-style
  `ctx.session.user.id` — neither matched the v0.9.2 patterns.

  New unified patterns handle all three:
  - Optional chaining on session and/or .user accepted uniformly:
    `session\??\.user\??\.(id|role|email)`.
  - Both `===` and `!==` accepted in one pattern via `[!=]==`.
  - Either operand order accepted (session on left OR resource on left).
  - `ctx.session` prefix accepted for tRPC / Hono / Elysia procedures.
  - snake_case resource columns (`user_id`, canonical Supabase /
    Postgres convention) added to the ownership-ID list.

  `ctx.session` / `ctx.user` added to AUTH_GUARD_PATTERNS so a
  tRPC procedure that destructures from `ctx.session` is correctly
  recognized as authenticated without an explicit `getServerSession`
  call.

  +5 regression tests: optional-chaining ownership, reversed-operand,
  tRPC `ctx.session.user.id`, double-optional (`session?.user?.id`),
  snake_case `user_id`.

- **Stale redos-probe.ts suppression removed (validator NIT-02).**
  `aegis.config.json` contained an entry for
  `packages/scanners/src/attacks/redos-probe.ts` which does not exist
  (only `packages/scanners/src/quality/redos-checker.ts` does; that
  entry is retained). The dead suppression taught users that stale
  entries are acceptable.

- **README slimdown.** The release-history narrative block
  ("Current release: v0.9.2 — validator hotfix + world-class-OSS
  polish", "Prior release: v0.9.1 — cross-file precision", etc.)
  removed; the "Independently validated (v0.9.1 stress-test)"
  section removed; all "since v0.7" / "since v0.9" version-tag
  annotations in the scanner table removed; the GitHub Action
  example pinned to `@v0.9.3` (from the stale `@v0.7.2`). README
  is now a capability-reference document for someone who finds
  the repo fresh — no knowledge of prior releases required. Release
  history remains in full detail here in CHANGELOG.md.

### Test counts

- Tests: **1397 → 1402 green** (+5 auth-enforcer regressions).
- Benchmark: **30/30 strict unchanged**.
- Self-scan: **1000/A/0-findings unchanged**.

### Cross-file precision

Unchanged from v0.9.2. n=0 on 6-corpus dogfood.
`confidence: 'medium'` retained on cross-file findings.

---

## [0.9.2] — 2026-04-17 — "Validator Hotfix + World-Class-OSS Polish"

**Honest score:** 7.8 → **8.2** (MAJORs from an independent external
stress-test all closed in the same cycle; world-class-OSS polish pass
adds npm-metadata quality, community health templates, README
architecture + honest-limitations sections, VS Code .vsix release-
asset build, and a validator-attested PASS summary; cross-file
precision hedge unchanged — still `confidence: 'medium'` on same
n<20 unmeasurable basis).

**Summary:** An external adversarial stress-test of v0.9.1 delivered
5 MAJOR + 5 MINOR findings. Every MAJOR is closed here; four MINORs
are closed; the fifth (display-layer LOW-CONFIDENCE badge hedge) is
now committed rather than deferred. In parallel, a world-class-OSS
polish sprint lifts the repo to production-adoption quality:
discoverable npm metadata, structured issue / PR templates,
architecture-in-README, honest limitations codified in the README,
independently-validated PASS summary with reproducible citations, and
a pre-built `.vsix` attached to every Release.

### Fixed — validator findings closed

- **MAJOR-01: mass-assignment-checker `req.json()` silent FN**
  (`packages/scanners/src/quality/mass-assignment-checker.ts`).
  The scanner hardcoded `request.json()` in four regexes, so any
  Next.js codebase using the common `req` handler-parameter
  abbreviation silently bypassed detection — a SAST emitting a
  false safety signal, same bug class as the v0.8 `path.normalize`
  sanitiser-registry bug. All four patterns generalised to
  `(?:req|request)\.json`; kept symmetric with the taint-analyzer's
  TAINT_SOURCES which already handles both aliases (v0.7.1 hotfix).
  +3 regression tests.

- **MAJOR-02: auth-enforcer misses next-auth / Clerk ownership
  + role guards** (`packages/scanners/src/quality/auth-enforcer.ts`).
  The ROLE_GUARD_PATTERNS set was tuned to a narrow helper family
  (requireRole, isManager, …). Validator reproduced 3 FPs on
  shadcn-ui/taxonomy. Extended with dominant community shapes:
  `session.user.id === post.userId` ownership comparisons,
  `verifyCurrentUser*` / `userHasAccess*` / `canEdit*` helper
  families, Clerk `has({ role })` / `publicMetadata.role` / `auth()
  .protect()` / `currentUser()`. Matches guard SHAPES where
  possible, not mere keywords. +6 regression tests.

- **MAJOR-03: CHANGELOG v0.9.1 test-count format switch**
  (`CHANGELOG.md`). v0.9.1 silently switched from the v0.9.0
  all-packages-total format (1379) to a scanners-only delta (1030)
  without annotation — sequential readers saw an apparent 349-test
  regression. Amended in place with both numbers + a format-note.

- **MAJOR-04: GETTING-STARTED §1 stale example output**
  (`docs/GETTING-STARTED.md`). The first-scan example showed a
  completely different format than the actual CLI emits (7/10
  scanners vs 47 scanners, no ASCII box, no category bars, no
  Confidence line). Rewrote the code block to faithfully reproduce
  the current terminal output with illustrative findings; added a
  forward-link to the v0.9.2 LOW-CONFIDENCE badge hedge.

- **MAJOR-05: README scanner-count reconciliation** (`README.md`).
  Three conflicting counts ("39 built-in", "37+1+1=39", "59 total")
  and a missing row (`nextPublicLeakScanner`). Authoritative count
  from `getAllScanners()` in `packages/scanners/src/index.ts`:
  40 built-in + 16 external + 5 attack probes = **60 total**. Added
  the missing row. Replaced the flat table with a CWE-annotated
  reference so users can filter by the CWE class they care about.

- **MINOR-01: HARDENED badge visually dominates on LOW-confidence
  runs** (`packages/reporters/src/terminal.ts`,
  `ci/github-action/action.yml`). Empty or thinly-scanned projects
  reach `1000/A` because there's nothing to fail on; the LOW-
  confidence hedge is a separate line that casual readers miss.
  Display-layer fix: badge gets a yellow `[LOW-CONFIDENCE]` prefix
  in the terminal + in CI PR comments; a dim sub-line explains what
  LOW confidence means and how to raise it. Grade enum, numeric
  score, and machine-readable JSON all unchanged. +2 regression
  tests.

- **MINOR-02: GH Action `aegis-version` default pin drift**
  (`ci/github-action/action.yml`). Release-checklist item missed at
  v0.9.1; default bumped 0.9.0 → **0.9.2** in the release prep
  commit.

- **MINOR-04: inline-suppression placement docs for taint flows**
  (`docs/suppressions.md`). New subsection explaining that the
  `// aegis-ignore` comment for a taint-analyzer finding must go on
  the sink line (which the finding's `file:line` points at), not
  the source line. Incorrect + correct side-by-side examples.

- **MINOR-05: GH Action silently swallows scan errors**
  (`ci/github-action/action.yml`). Removed `2>/dev/null` from the
  three scan invocations; stderr captured to `aegis-stderr.log`;
  post-scan validation gate emits a clear `::error::` with the
  stderr contents if the JSON is empty or unparseable, so the
  previous cryptic `Cannot find module` / `Unexpected token` errors
  are replaced with actionable diagnostics.

### Deferred with analysis (validator MINOR-03 → v0.10+)

- **MINOR-03: VS Code `.vsix` pre-build** — closed differently than
  originally listed as deferred. A new `.github/workflows/release.yml`
  triggers on `release: published`, builds the extension, runs
  `vsce package`, and uploads the .vsix as a release asset. So the
  README's `code --install-extension aegis-vscode-X.Y.Z.vsix`
  instruction now works out-of-box for every published release.
  VS Code Marketplace publication remains v0.10 scope (separate
  review process).

### Added — world-class-OSS polish

- **Package metadata across 5 public packages** (author, bugs URL,
  homepage, engines.node, corrected repository.directory to
  `packages/<name>`, extended per-package keywords, richer
  descriptions) — improves npm search, package-page experience,
  and repository linkage for all consumers.

- **Community health** — `.github/ISSUE_TEMPLATE/` (bug report,
  feature request, **dedicated false-positive template**,
  **dedicated false-negative template**, config.yml routing
  security-vulns to GitHub Security Advisories + general questions
  to Discussions + disabling blank issues),
  `.github/PULL_REQUEST_TEMPLATE.md` (scope checkboxes, coverage
  delta, breaking-change flag, merge checklist), `.github/CODEOWNERS`
  (path-level routing ready for future per-area owner additions).

- **README Architecture section** — ASCII pipeline diagram
  (config → walker → scanners → findings → suppressions →
  score/grade/badge/confidence → reporters) so first-time readers
  orient without cloning.

- **README Honest Limitations section** — explicit list of what
  AEGIS does NOT do well: cross-file precision unmeasured at n≥20,
  not a general SAST replacement, compliance checks are pattern-
  based rules not audit-grade, single-maintainer bus-factor,
  TS/JS only, external wrappers require tool on PATH. Codifies
  honest-score discipline in the README so it survives ownership
  changes.

- **README Independently Validated section** — bullets of what the
  v0.9.1 external stress-test reviewer confirmed reproducibly
  (self-scan 1000/A, benchmark 30/30, 1386 tests green, adversarial
  input resilience <2s, prompt-injection hardening held,
  prototype-pollution blocked, real TP captured on the vercel/
  next.js with-supabase example). Honest-score discipline applied
  to the positive side.

- **aegis.config.json schema accepts `description` + `$schema`**
  (v0.9.0 preceded, documented here) — so users can annotate their
  configs for future readers without the strict schema rejecting
  the typical `$comment` / `$description` escape hatches.

### Test counts

- Tests: **1386 → 1397 green** (scanners package 1030 → 1039 +9:
  3 mass-assignment req.json regressions, 6 auth-enforcer next-auth
  patterns; reporters package 90 → 92 +2: LOW-CONFIDENCE badge
  prefix regressions).
- Benchmark: **30/30 strict unchanged**.
- Self-scan (AEGIS-on-AEGIS): **1000/A/0-findings unchanged**.

### Independently validated (v0.9.1 stress-test findings)

These items were confirmed reproducibly by the external reviewer
and remain true at v0.9.2 — no regressions were introduced:

- Self-scan on the AEGIS repo produces 1000/A/HARDENED, 0 findings.
- Benchmark 30/30 strict (21 planted vulnerabilities + 9 clean-file
  FP checks).
- 1386 tests green across the 5 public packages (1397 after v0.9.2's
  regression additions).
- Adversarial inputs — 10k-line import file, 1 MB template literal,
  BOM + RTL override chars, symlink loop — all complete in <2 s
  without crash.
- Prompt-injection hardening on `aegis fix` holds (per-invocation
  random hex sentinel).
- Prototype-pollution via config rejected by the Zod-strict schema.
- JSON-only config parser immune to arbitrary code execution.
- Real TP captured externally on the official vercel/next.js
  with-supabase example (open-redirect via `searchParams.get('next')`).
- Forensic leak check — `git log` + `git grep` on `main` + all
  published tarballs — clean of any private-identity references.

### Cross-file precision

Unchanged from v0.9.1 §Cross-file precision. n=0 observed on 6-corpus
dogfood post-FP-close. `confidence: 'medium'` retained on cross-file
findings. Yellow / Green zone classification awaits n≥20 validated
measurement.

### Known limitations — scoped to v0.10+

- Compliance framework depth audit (GDPR / SOC2 / ISO27001 / PCI-DSS
  scanners are pattern-based, not audit-grade). v1.0 scope.
- External-benchmark integration (OWASP Benchmark Project, NIST
  SAMATE Juliet subset) — enables recognised precision/recall claims.
  v1.0 credibility sprint.
- Full-flow AST auth-enforcer replacing the v0.9.2 extended pattern
  list with taint-tracker-integrated flow analysis. v0.10.
- VS Code Marketplace publication (v0.9.2 ships the `.vsix` as a
  release asset; Marketplace submission has its own review cycle).
- Web dashboard / Grafana integration — **not** scheduled; out of
  Festung-Mode-B per D3/D5 (no SaaS, no remote calls).

---

## [0.9.1] — 2026-04-17 — "Cross-File Precision"

**Honest score:** 8.0 (was 7.9 at v0.9.0 — the two cross-file FPs
observed in the v0.8 dogfood delta are closed with AST-precise
filters, not text-suppression; precision on cross-file CWE-918 is
now 100% on the observed corpus, though n=0 post-fix means "no false
safety signal" rather than a validated measurement).

**Summary:** Closes the two v0.8-corpus cross-file false positives
flagged in the Phase-7 delta memo (cal-com intercom isValidCalURL +
dub bitly rate-limit). Both fixes are AST-precise post-filters on
`paramReachesSink` in function-summary.ts; no text-suppression, no
new false-negative classes introduced.

### Fixed

- **Cross-file regex-guard filter (cal-com isValidCalURL pattern).**
  `paramReachesSink` previously credited CWE-918 on any SSRF-class
  sink call mentioning the param, regardless of whether the call was
  protected by `<regex>.test(param)`. New helper walks the fn body
  AST to find SSRF sink calls on `paramName`, then for each checks
  two guard shapes:
    1. Ancestor `if (<x>.test(param)) { … sink(param) }` — positive
       wrap; call must be in the then-branch.
    2. Preceding `if (!<x>.test(param)) return | throw;` — negated
       early-exit; siblings after it are guarded.
  Any unguarded sink call defeats the filter and the CWE stays.
  Symmetric to v0.8 Phase 6's single-file URL-regex-whitelist; the
  cross-file version lives in function-summary.ts so cross-file
  callers see a clean summary.

- **Cross-file SSRF URL-position filter (dub bitly rate-limit pattern).**
  CWE-918 (SSRF) requires the tainted value to reach the URL argument
  of fetch / axios / etc. A param that only flows into the options-
  object (`{ headers, body, method }`) is a different concern —
  credential leak, header injection — not SSRF. The new filter walks
  fn.body for SSRF-class CallExpressions and checks whether
  paramName appears in the FIRST argument's source text. Zero URL-
  position hits → CWE-918 dropped. URL-position hits present →
  regex-guard filter is also required to pass.

### Test counts

- Tests: **1023 → 1030 scanners-package** (+7: 4 regex-guard, 3
  URL-position); **total across all 5 packages 1379 → 1386 green**.
  _(Format note amended in v0.9.2 to match the v0.9.0 all-packages-
  total reporting and avoid the apparent regression caused by the
  scanners-only delta — validator MAJOR-03.)_
- Benchmark: **30/30 strict unchanged**.
- Self-scan: **1000/A/0-findings unchanged**.

### Cross-file precision — n=0 post-fix

- v0.8 corpus: 2 cross-file findings, both FP upon manual annotation.
- v0.9.1 re-scan: 0 cross-file findings across all 6 corpora. Both
  annotated FPs are now closed at the source.
- **Honest implication**: cross-file emissions at v0.9.1 have 0
  observed false positives — but also 0 observed true positives on
  this corpus. Cross-file detection is high-precision / unknown-
  recall. The patterns AEGIS detects (HOC binding, method-call
  cross-file, generic pass-through, bare-identifier cross-file) are
  apparently rare in the production Next.js codebases scanned
  (cal-com / dub / openstatus / taxonomy / documenso / nextjs-
  commerce).
- **Hedge retention**: v0.7 `confidence: 'medium'` on cross-file
  findings remains — same threshold basis (n<20 valid-measurement
  floor) that justified it at v0.7 and v0.8. If anything the
  post-fix n=0 strengthens the case that we can't yet validate the
  cross-file precision claim in either direction.

---

## [0.9.0] — 2026-04-16 — "Precision Polish"

**Honest score:** 7.9 (was 7.8 at v0.8.1 — small bump reflecting
self-scan precision wins plus monorepo-usability fix; cross-file
precision measurement remains unmeasurable so the v0.7 hedge stays).

**Summary:** Scanner precision pass targeting the false-positive
classes that made AEGIS awkward to use on real codebases. Self-scan
on the AEGIS repo now reaches **1000/1000 A** with **0 findings** —
up from 973/A/55-findings at v0.8.1. The wins translate to every
monorepo / TS-alias codebase, not just AEGIS itself: the
phantom-dependency checker was producing ~38 noise findings on any
modern Next.js monorepo and that flood is now fully closed.

### Added

- **`aegis.config.json` accepts `description` + `$schema`.** JSON
  doesn't support comments and the strict config schema previously
  rejected the usual `$comment` / `$description` escape hatches,
  leaving users with no way to annotate their config for future
  readers. Two optional NOP fields added — accepted by validation,
  ignored by the scanner.

### Fixed

- **Supply-chain phantom-dependency precision (five FP classes).**
  Previously the checker produced 38 noise findings on AEGIS's own
  scan and a similar flood on every modern Next.js/TS monorepo.
  Each FP class fixed at the source:
    1. **TypeScript path aliases.** `@/lib`, `~/utils`, `#node-internal`
       are tsconfig.paths / Node subpath-imports, not npm package
       specifiers. `extractPackageName` now returns null for these
       prefixes.
    2. **Workspace package names.** `@aegis-scan/core` imported in
       a monorepo root is provided by a workspace member, not a top-
       level npm package. `pnpm-workspace.yaml` packages-list and
       `package.json` workspaces field are parsed; each sub-package's
       `name` field is registered as a declared dep.
    3. **Sub-package runtime deps.** `ora` / `chalk` / `commander`
       etc. declared in `packages/cli/package.json` are not phantom
       at the monorepo root. The same workspace walk aggregates every
       sub-package's `dependencies` / `devDependencies` /
       `peerDependencies` / `optionalDependencies` into the declared
       set.
    4. **Comment false-matches.** The import-regex captured strings
       inside documentation comments (e.g. `// require('pkg')`).
       Source is now line-comment and block-comment stripped before
       the regex runs.
    5. **Regex garbage.** A new `isValidNpmPackageName` guard filters
       captures to the npm-name format (lowercase `[a-z0-9._-]`
       optionally scoped). Closes multi-line-import artefacts like
       `") || line.includes("`.
  Plus: `vscode` / `electron` / `atom` added to the builtins set as
  host-provided ambient runtimes. Plus: supply-chain now respects
  `config.ignore` in its file walker.

- **logging-checker "no centralized logger" skipped on CLI tools.**
  Previously any project without winston/pino/bunyan got a project-
  level `medium` finding. CLI tools correctly use console as their
  interface. New detection: if the root `package.json` has a `bin`
  field, OR the root is a monorepo whose workspace children expose
  `bin`, the project-level finding is suppressed at the source.
  Per-file log-hygiene findings (mutation audit logs, auth event
  logs) still fire — only the project-shape false positive is
  gated. Also removes the brutal-review-M5 concern: AEGIS's own
  `aegis.config.json` no longer needs a blanket `**/*` suppression.

- **Scanner-precision tune (brutal-review NI1 + NI2).**
    - `setTimeout` / `setInterval` skip emission when arg 0 is an
      arrow or function expression — modern `setTimeout(fn, delay)`
      usage is not code-injection regardless of delay taint. Only
      arg 0 is inspected when they do fire (legacy string-eval
      form). Removes a FP flood on every codebase passing a user-
      configured delay to a callback.
    - `encodeURIComponent` / `encodeURI` no longer credit CWE-22
      (path traversal). Frameworks that accept URL-encoded path
      parameters decode before filesystem access, so the
      `%2F%2E%2E` sequence is restored to `../` at the fs layer.
      Kept as sanitizer for CWE-918 (SSRF) and CWE-79 (XSS) where
      the encoded form is consumed directly.

- **self-scan `aegis.config.json` scope expansion (brutal-review M5
  partial fix).** The blanket `**/*` logging-checker suppression is
  removed — replaced with scoped per-package rules (cli, scanners,
  mcp-server, reporters, core). Also closes residual structural
  self-matches on ast/sinks.ts / ast/taint-tracker.ts (xss + ssrf),
  function-summary.ts (crypto-auditor), redos-checker.ts, and DAST
  probe modules (ssrf — purpose-built to fetch target URLs).

- **GitHub Action default `aegis-version` pinned (brutal-review M3).**
  Previously `main` — a floating ref that silently broke every CI
  pipeline when AEGIS regressed. Now `v0.9.0`. Description expanded
  with pinning rationale. Release checklist: bump this per tag.

- **CI workflow step name stale (brutal-review N1).** "Benchmark (15
  planted vulnerabilities)" → "Benchmark (21 planted vulnerabilities
  + 9 clean-file FP checks)". Matches `expected.json` actual.

### Explicitly deferred (brutal-review M6 analysis)

- `detectHocSinkPropagation` text-match: on reconsideration, the
  concern does NOT manifest as practical FPs. The consume-side
  check in `checkCrossFileCallSink` HOC branch gates emission on
  `collectSinkCwesInFunction(arg, ctx.checker)` returning a non-
  empty set — i.e. the INLINE argument must call a known taint
  sink. Summary `returnsFunctionThatCallsSink=true` is a pre-gate,
  not a trigger. A text-match FP on the summary (withLogging that
  merely calls its param without reaching a sink) is neutralized
  by the inline-arg sink-reach check. No fix shipped in v0.9; the
  analysis is recorded here for future reviewers.

### Test counts

- Tests: **1374 → 1379 green** (+5: 3 `setTimeout`/`setInterval`
  first-arg-fn regression pins, 2 `encodeURIComponent` CWE-22 /
  CWE-918 regression pins).
- Benchmark: **30/30 strict unchanged**.
- Self-scan (AEGIS-on-AEGIS): **973/A (55 findings) → 1000/A
  (0 findings)**.

### Cross-file precision

Unchanged from v0.8.x §Measurement. n=2 across n=6 corpora. v0.7
`confidence: 'medium'` hedge retained on the same unmeasurable-
threshold basis.

---

## [0.8.1] — 2026-04-16 — "Brutal-Review Hotfix"

**Honest score:** 7.8 (unchanged — correctness hotfix closing three
brutal-review MAJORs, not a capability release).

**Summary:** Closes three MAJORs surfaced by the v0.8.0 post-ship
cold-read review: a false-negative-producing sanitizer-registry bug
on `path.*`, stale MCP tool names in the tutorial that broke first-
contact for every MCP user, and a scope gap in the Phase 5
conditional-import confidence downgrade that left the if/else form
at full confidence. M3 / M5 / M6 from the same review deferred to
v0.9 scope with rationale (see Known limitations below).

### Fixed

- **`path.normalize` / `path.resolve` / `path.basename` removed from
  TAINT_SANITIZER_DEFS (brutal-review M1).** They were listed as
  CWE-22 neutralizers. They are not sanitizers on their own:
    path.normalize('../../../../etc/passwd') === '../../../../etc/passwd'
    path.resolve('/srv/app', '../../etc/passwd') === '/etc/passwd'
    path.basename('../evil') === 'evil'
  normalize only collapses `./..` sequences relative to the string;
  does not strip a leading `..` chain without an absolute base.
  resolve escapes the intended base when the caller does not assert
  `resolved.startsWith(base)`. basename drops one leading segment —
  the trust decision belongs to the caller, not the call. The safe
  pattern (`resolve(base, input)` + `startsWith(base)` check) is not
  a call-name pattern; it does not belong in a call-name sanitizer
  registry. Effect: real path-traversal findings downstream of these
  calls were previously silent false negatives. Fix restores them.
  +3 regression tests pin the corrected behaviour.

- **`docs/GETTING-STARTED.md` §5 MCP tool names corrected
  (brutal-review M2).** The tutorial listed three names
  (`scan_project`, `scan_file`, `audit_project`) that do not exist
  in `packages/mcp-server/src/index.ts`. Any first-time MCP user
  following the guide and calling one of those from Claude Code /
  Cursor / an agent got a "tool not found" error. Replaced with the
  five tools actually registered: `aegis_scan`, `aegis_findings`,
  `aegis_score`, `aegis_compliance`, `aegis_fix_suggestion`.

- **Conditional-import downgrade extended to if/else form
  (brutal-review M4).** Phase 5 (v0.8.0) covered only the ternary
  form (`cond ? await import(a) : await import(b)`). The equivalent
  if/else assignment pattern

    let db;
    if (cond) db = await import('./a');
    else      db = await import('./b');
    db.query(tainted);

  bypassed the confidence-downgrade and emitted at full confidence.
  Adds `handleConditionalImportIfStatement` alongside the existing
  VariableDeclaration path. Both branches must reduce to an
  `ident = <rhs>` assignment to the same identifier, with at least
  one rhs being an `(await)? import(...)` call. +3 regression
  tests: if/else fires downgrade, ternary still works, non-import
  if/else does NOT fire.

### Known limitations — explicitly deferred to v0.9

- **Brutal-review M3 — GitHub Action `aegis-version: main` default.**
  Contradicts the README's pin-to-tag guidance. Pre-existing from
  v0.7 era; not a new regression. Scoped to v0.9 + a release-
  checklist item that bumps the default per tag.
- **Brutal-review M5 — blanket `**/*` logging-checker suppression in
  the self-scan aegis.config.json.** The scope is correct for AEGIS
  (it's a scanner CLI, not a web app), but as a published config
  template it teaches users to disable logging-checker globally.
  v0.9 will replace with scoped paths (cli + scanners + mcp-server).
- **Brutal-review M6 — `detectHocSinkPropagation` text-match on any
  outer-param call.** Pre-existing v0.7 code; flags HOCs that call
  ANY outer param, not specifically sink-calling outer params. FP
  risk on `withLogging` / `withRetry` patterns. v0.9 will extend
  the helper to verify the inner-call actually reaches a known
  sink before setting `returnsFunctionThatCallsSink = true`.

### Test counts

- Tests: **1368 → 1374 green** (+6: 3 path.* sanitizer regressions,
  3 conditional-import-form regressions).
- Benchmark: **30/30 strict unchanged**.
- Self-scan (AEGIS-on-AEGIS): unchanged at **973/A/not-blocked**.

### Cross-file precision

Unchanged from v0.8.0 §Measurement. n=2 across n=6 corpora. v0.7
`confidence: 'medium'` hedge retained on the same unmeasurable-
threshold basis. Zone decision still deferred.

---

## [0.8.0] — 2026-04-16 — "Type-Aware Expansion"

**Honest score:** 7.8 (target was 8.5, reduced because the cross-file
precision measurement remains unmeasurable — see §Measurement below).

**Summary:** Closes the four type-aware gaps the v0.7 post-ship review
flagged (HOC binding, generic pass-through return-taint, method-call
cross-file via TypeChecker, conditional-import confidence downgrade).
Extends the typed-sink-module foundation beyond `child_process` to
fs / path / crypto / http / https. Adds Date.parse to the
parse-not-sanitizer blocklist and a URL-regex-whitelist sanitizer
class that closes the v0.7 dogfood cal-com intercom false positive.
Doubles the dogfood corpus (3 → 6 OSS Next.js projects) toward the
n≥20 cross-file precision threshold. Refines structural self-match
false positives so AEGIS-on-AEGIS moves from 0/F/CRITICAL to
973/A-grade. Ships a 260-line GETTING-STARTED tutorial.

### Added

- **Type-aware sink-module foundation (Phase 1).** `TYPED_SINK_MODULES`
  now covers fs, fs/promises, path, crypto, http, https beyond the
  v0.7 child_process baseline. Locally-shadowed `readFile`,
  `writeFile`, `request`, `createSign`, etc. correctly resolve as
  non-sinks via `resolveSinkSymbol`.
- **HOC cross-file consumption (Phase 2).** When an exported function
  returns an inner function that calls one of its own parameters
  (`summary.returnsFunctionThatCallsSink = true`), binding sites that
  pass an inline sink-calling arrow as the wrapped argument now emit
  a cross-file finding at the binding line — policy §9. Benchmark
  fixture VULN-19.
- **Generic pass-through return-taint cross-file (Phase 3).** The
  v0.7-populated `summary.params[i].returnsTainted` field is now
  consumed in `resolveTaint`. Identity-style imported functions
  propagate taint with an origin-annotated path; sanitizer wrappers
  (summaries with non-empty `sanitizesCwes`) are suppressed to
  prevent a silent FP class. Benchmark fixture VULN-20.
- **Method-call cross-file via TypeChecker (Phase 4).** For
  `obj.method(x)` where the method's declaration lives in another
  user-land file (PropertyAssignment with function initializer or
  MethodDeclaration shorthand), TypeChecker resolves the symbol,
  `buildSummary` analyses the method body, and per-argument sink-CWE
  propagation fires. Confidence fixed at `'medium'` per gap #4
  policy. Benchmark fixture VULN-21.
- **Conditional-import confidence downgrade (Phase 5).** Variables
  initialized via `condition ? await import(a) : await import(b)`
  are tracked in `TaintContext.conditionalImports`; sinks whose
  callee object is such a variable emit with `confidence: 'medium'`
  rather than the scanner default. Benchmark runner gains an
  optional `maxTolerated` field on CLEAN-* fixtures for this class.
  Benchmark fixture CLEAN-09.
- **URL-regex-whitelist sanitizer (Phase 6).** Suppresses CWE-918
  (SSRF) findings when the sink is inside an if-guard whose condition
  contains `<regex>.test(<tainted-id>)` with the same bare identifier
  passed to the sink. Closes the cal-com intercom FP from v0.7
  dogfood.
- **Corpus expansion (Phase 7).** `scripts/dogfood-corpus.sh` now
  clones taxonomy, documenso, and nextjs-commerce alongside the
  existing cal-com / dub / openstatus. Six OSS Next.js projects
  covering production SaaS, storefront, and starter patterns.
- **`docs/GETTING-STARTED.md` (Phase 9).** 260-line walk-through
  from zero-install to first scan, config, false-positive handling,
  MCP setup, and GitHub Actions integration. Linked from README.

### Fixed

- **Date.parse blocklist (Phase 6).** Added to `PARSE_NOT_SANITIZER`
  alongside JSON.parse / URL.parse / qs.parse. `Date.parse` returns a
  timestamp number or NaN without validating the input string; the
  raw tainted value continues to flow.
- **header-checker isAvailable gate (Phase 8).** Returns false when
  the project shows no Next.js signal (no next.config.*, no
  middleware.*, no `next` in package.json deps). Eliminates the
  structural 10-header-missing FP on non-Next.js codebases (scanner
  OSS, pure libraries, CLI tooling).
- **rls-bypass-checker tightening (Phase 8).** Requires an actual
  database-client usage signal in the same file (createClient call,
  supabase member access, imports from postgres / pg / drizzle-orm /
  @prisma, `new Pool()` / `new PrismaClient()`) before firing on
  `service_role` or `.rpc(` text. Eliminates one self-match class.
- **Self-scan scoping via `aegis.config.json` (Phase 8).** Repo-root
  config scopes AEGIS-on-itself for the structural realities of a
  scanner CLI (console output IS the interface; detection-pattern
  literals self-match the regex that defines them; the repo is not a
  Next.js web app). Self-scan score: **0/F/CRITICAL → 973/A** with
  211 → 55 findings, the remaining 55 being legitimate non-self-match
  signal (supply-chain CVEs etc).

### Measurement (cross-file precision — v0.7 hedge)

- Corpus scanned at n=6 OSS projects (cal-com, dub, openstatus,
  taxonomy, documenso, nextjs-commerce).
- Cross-file findings total: **2** across 2951 total findings. Below
  the plan §3 TBD-3 statistical-validity threshold of n≥20.
- Manual annotation of both findings concluded FP at v0.8 — one is
  suppressed by a regex-guard inside the cross-file callee's body
  (not yet AST-aware in function-summary.ts), the other has the
  tainted value in a request header while the fetch URL is a
  hardcoded literal (not SSRF). Both are candidate v0.9 narrowings.
- **The v0.7 `confidence: 'medium'` cross-file hedge is retained at
  v0.8 on the same basis it was introduced — the statistical
  threshold is still unmet, not because a valid measurement landed
  Yellow or Red.** Green / Yellow / Red zone decision deferred to
  the first dogfood run where n ≥ 20 emissions exist.

### Test counts

- Tests: **1350 → 1368 green** (+18: 10 type-resolve symbol
  assertions for the expanded TYPED_SINK_MODULES, 4 Date.parse /
  URL-regex-guard regression tests, 4 header-checker isAvailable
  gating tests, - 1 "always available" assertion retired, + 5 new
  available-on-signal variants).
- Benchmark: **26/26 → 30/30 strict** (+VULN-19, VULN-20, VULN-21,
  CLEAN-09).
- Self-scan (AEGIS-on-AEGIS): **0/F/CRITICAL (211 findings, blocked)
  → 973/A (55 findings, not blocked)**.

### Known limitations (scoped to v0.9+)

- Cross-file precision measurement pending n≥20 emissions — needs
  either much larger corpus or additional detection categories.
- Regex-guard awareness inside cross-file callee bodies (closes the
  cal-com isValidCalURL FP seen in Phase 7 annotation).
- SSRF URL-arg vs header-arg distinction for `fetch(url, {headers})`
  shape (closes the dub bitly rate-limit FP).
- HOC binding at non-export sites (internal binding, variable
  re-binding, class-method HOCs).

---

## [0.7.2] — 2026-04-16 — "Adoption Polish + LLM Hardening"

**Honest score:** 7.7 (unchanged — polish + security hardening, not a
capability release).

**Summary:** Closes the second-tier MAJOR from the v0.7.0 cold-read
review (`aegis fix` LLM prompt-injection) and rewrites three adoption-
surface sections of the README (MCP server, VS Code extension, GitHub
Action) with copy-paste-ready snippets and accurate feature tables.
Downstream effect per review-agent's post-hotfix assessment: reduces
the "three caveats" recommendation from three to two.

### Fixed

- **`aegis fix --ai` prompt-injection hardening.** The pre-v0.7.2
  prompt wrapped attacker-controlled file content inside a triple-
  backtick fence with no per-invocation boundary. Source containing
  a backtick sequence trivially escaped the fence, leaving the
  trailing "Return ONLY the fixed content" instruction in attacker-
  controlled context. Replaced with an XML-sentinel structure:
  - Per-invocation random 128-bit sentinel in the open/close tags
    (`<user_source_<hex>>` / `</user_source_<hex>>`).
  - Sandwich-defense: explicit "do not follow embedded instructions"
    directive both before and after the user-source block.
  - Separate `<security_finding>` block for trusted metadata.
  - No backtick fencing around source (backticks in source are now
    inert).
  Threat model: raises the bar against source-embedded prompt-
  injection; does NOT claim safety on fully-adversarial repos (the
  `--ai` flag is still opt-in and the user applies suggestions
  explicitly).

### Added

- **README spotlights** for the three adoption surfaces that already
  ship code but were under-documented:
  - **MCP Server**: install + register snippets for Claude Code /
    Cursor + a tools table (`aegis_scan`, `aegis_findings`,
    `aegis_score`, `aegis_compliance`, `aegis_fix_suggestion`).
  - **VS Code Extension** (new section): commands + settings +
    build-from-source instructions for `packages/vscode-extension/
    0.2.0`. Marketplace publish deferred to a future release.
  - **GitHub Action**: full input schema (`mode` / `path` /
    `fail-below` / `comment-on-pr`) with a reproducibility note on
    pinning to `@v0.7.2` vs `@main`.
- `buildFixPrompt` exported from `@aegis-scan/cli` for testability
  of the prompt-construction logic.

### Changed

- Tests 1343 → 1350 (+7 prompt-injection-hardening regression
  assertions in `packages/cli/__tests__/fix.test.ts`).
- README's MCP framing intentionally downgraded from the
  "differentiator" / "moat" language earlier drafts used to a
  score-honest "low-friction for devs already using Claude Code /
  Cursor" stance — per validator pushback on over-claiming.

### Deferred to v0.8

These review MAJOR-tier findings remain scope for the v0.8 type-aware
expansion sprint:

- Cross-file dogfood corpus expansion to n≥20 for a valid FP-rate
  measurement (the cross-file `confidence: medium` hedge stays
  until the measurement lands).
- Structural self-match FPs on AEGIS's own production code —
  `header-checker` / `logging-checker` / `zod-enforcer` self-match
  on the scanners' own source, driving the self-scan F/0 result.
  Fix requires scanner-level `isLibrary` / `isNonRouteFile`
  awareness, not a patch.
- Getting-Started tutorial (separate docs PR, not tied to a tag).
- VS Code Extension Marketplace publish (separate vsce-credential
  release event).

### Credits

Review-agent's post-v0.7.1 reassessment noted "10 LOC fix — I would
have hotfixed it" about the prompt-injection issue. Accepted; shipped.

---

## [0.7.1] — 2026-04-16 — "Review-Hotfix"

**Honest score:** 7.7 (unchanged — hotfix patch, not a capability release).

**Summary:** Two v0.7.0 BLOCKERs surfaced by an external cold-read
review agent. Shipped as a same-day patch.

### Fixed

- **`req.json` / `req.text` / `req.formData` / `request.params`
  now recognised as taint sources.** Pre-v0.7.1 a byte-identical
  Next.js handler with `request` renamed to `req` silently dropped
  cross-file SSRF / SQLi / XSS findings — the `request.*` alias was
  fully covered but `req.*` was missing the body-parser methods and
  `request.params` was missing too. `req` and `request` are now
  fully symmetric in `TAINT_SOURCES`. Also added `req.nextUrl.search
  Params` for Next.js middleware completeness.
- **Test + benchmark fixture dirs now in `DEFAULT_IGNORE`.** Pre-
  v0.7.1 `aegis scan` on any project with `__tests__/`, `benchmark/`,
  `fixtures/`, `__mocks__/`, `test/`, or `tests/` folders flooded
  findings with intentionally-vulnerable fixture code and mocked
  test data. The default ignore list now excludes these conventional
  names; users can override via `aegis.config.json` if they
  explicitly want to scan tests.

### Added

- **Benchmark fixture VULN-18**: byte-identical to VULN-01 except the
  handler argument is named `req` instead of `request`. Locks the
  `TAINT_SOURCES` symmetry into the benchmark — removing any of the
  new sources flips 26/26 red. Benchmark now 25/25 → 26/26 strict.

### Changed

- Tests 1339 → 1343 (+4 regression assertions: 3 for the
  `TAINT_SOURCES` symmetry fix, 1 for the `DEFAULT_IGNORE` fix).
- README clarifies the two distinct scores (**"Internal Maturity
  7.7/10"** for AEGIS's own maturity vs **"0-1000"** for the score
  AEGIS outputs about scanned projects).

### Deferred to v0.8

These review findings (MAJOR-tier) are scope for the v0.8 type-aware
expansion sprint, not a patch:

- `aegis fix` LLM prompt-injection hardening (triple-backtick fence
  is attacker-controllable when source contains a backtick sequence).
- Cross-file dogfood corpus expansion to n≥20 for a valid FP-rate
  measurement (the v0.7.0 `confidence: medium` hedge stays).
- Structural self-match FPs on AEGIS's own production code
  (`header-checker` self-flags, `logging-checker` wants
  winston/pino, `zod-enforcer` wants coercion on every
  `searchParams.get`). Scanner refinement, not a hotfix.
- Getting-Started tutorial (separate docs PR, not tied to a tag).

### Credits

Review findings surfaced by an external cold-read review agent; the
specific confounder-isolated repro (`request` → `req` rename drops
the finding from 1 to 0) pinned the exact attack surface for
BLOCKER #1. Full report at `/tmp/aegis-review/REVIEW.md` on the
maintainer's machine (not included in repo).

---

## [0.7.0] — 2026-04-16 — "Cross-File Taint Foundation"

**Honest score:** 7.7 (unchanged from 0.6.1 — see "Known Limitations"
below for why the cross-file capability ship did not move the measured
score yet).

**Summary:** Whole-program cross-file taint propagation on top of the
v0.6 module-graph foundation. Taint tracks across imported function
calls via a function-summary cache; cross-file findings emit as SARIF
2.1.0 `locations` + `relatedLocations` pointing from the caller to the
cross-module origin.

### Added

- **Cross-file taint propagation** — taint now tracks across imported
  function calls using a function-summary cache and the v0.6 module
  graph. Supported patterns:
  - Bare-identifier callees (`import { fn }; fn(tainted);`)
  - Arrow-function-variable exports (`export const fn = (x) => ...`)
  - Default exports (`export default function (x) {...}`)
  - Declaration-style exports: `export { foo };` and `export { foo as bar };`
  - Barrel re-exports up to depth 5
  - Cross-file sanitizer recognition via `summary.sanitizesCwes`
- **SARIF 2.1.0 `relatedLocations`** — cross-file findings emit the
  primary location at the caller plus a related location at the
  cross-file origin. GitHub Code Scanning, GitLab, and Azure DevOps
  consumers can jump between the two. Non-cross-file findings do not
  emit spurious `relatedLocations`.
- **`Finding` type extensions**:
  - `crossFile?: boolean`
  - `crossFileOrigin?: string`
  - `confidence?: Confidence` — per-finding confidence tier (distinct
    from the scan-level `AuditResult.confidence`).
- **Benchmark 21/21 → 25/25 strict**. New fixtures in
  `packages/benchmark/vulnerable-app/`:
  - VULN-16 cross-file SQLi (tainted body → imported wrapper → `db.query()`)
  - VULN-17 cross-file XSS (tainted searchParam → imported renderer → `new Response(HTML)`)
  - CLEAN-07 cross-file sanitized (`parseInt()` wrap before sink — no finding)
  - CLEAN-08 re-exported identity (barrel-exported no-sink function — no finding)
- **Community-health files**: `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1) added to lay the
  contribution path.

### Changed

- Tests 1283 → 1339 (+56) covering function-summary machinery, cross-file
  taint, SARIF round-trip, and module-graph integration.
- `function-summary.ts` and `taint-tracker.ts` now consult the shared
  `TAINT_SINKS` / `TAINT_SANITIZER_DEFS` / `PARSE_NOT_SANITIZER`
  registries as the single source of truth — earlier drafts had a
  drifted hand-maintained list.
- Cross-file findings ship at `confidence: 'medium'` as a calibration
  hedge; single-file findings retain the scanner default (see "Known
  Limitations" for the sample-size rationale).
- Package versions bumped 0.5.0 → 0.7.0 for all published workspace
  packages (`@aegis-scan/{core,scanners,reporters,cli,mcp-server}`) to
  align npm with the git tag.

### Fixed

- `JSON.parse`, `URL.parse`, `qs.parse`, `cookie.parse`, `path.parse`,
  `JSON5.parse` are no longer credited as sanitizers. They deserialize
  data; they do not validate it. Pre-fix, the cross-file check could
  silently suppress real findings that passed through these.
- CI flake on the `does NOT credit deserializers in PARSE_NOT_SANITIZER`
  test: a single shared `ts.Program` now amortises TypeChecker build
  cost across the 5 assertions (was per-assertion and timing out on
  Linux CI despite passing on macOS local).
- `findExportedFunction` previously skipped `export { foo };` and
  `export { foo as bar };` declaration-style exports, producing silent
  false negatives on any cross-file flow that used that pattern.
- `checkCrossFileCallSink` previously bailed on any callee whose bare
  name matched a `TAINT_SINKS` key (e.g. imported `fetch` or `exec`
  wrappers). Custom wrappers are now analysed correctly; reporter-side
  dedup handles the overlap between same-file and cross-file emissions.
- Per-CWE emission loop dropped subsequent CWEs after the first match;
  when a single param reached multiple sink classes, only one finding
  fired. All applicable CWEs now emit.

### Known Limitations

**Cross-file FP-rate is unmeasurable at current sample size.** The
initial 4-corpus dogfood produced n=2 cross-file findings (1 TP, 1 FP,
50% face-value precision). This is **below** the n≥20 threshold needed
for a statistically valid zone classification — each classification
shifts the rate by 50 percentage points at this sample size, so
"Red-zone" on face value is not a validated measurement. Cross-file
findings ship at `confidence: 'medium'` as a conservative hedge
pending a larger-corpus measurement. Single-file findings retain
their established scanner-default confidence.

**Four cross-file patterns deferred** — all require TypeChecker-based
symbol resolution that a future minor release will introduce. Syntax-
level handling in v0.7 would be fragile:

1. HOC / curry patterns wrapping a sink (`withAuth(sinkFn)`).
2. Generic pass-through return-taint (`const r = identityFn(x); sink(r);`).
3. Method-call cross-file callees (`obj.method(x)` where `obj` is imported).
4. Conditional-import confidence downgrade beyond the cross-file-global
   `medium` downgrade that ships here.

**Single-file refinement targets** (also deferred):

- URL-regex-whitelist recognition as a CWE-918 sanitizer.
- `Date.parse` added to the `PARSE_NOT_SANITIZER` blocklist.
- Type-aware sink resolution beyond `child_process` (`fs`, `path`,
  `crypto`, network modules).

### Migration Note

No breaking changes. `Finding.confidence`, `Finding.crossFile`, and
`Finding.crossFileOrigin` are all optional; consumers that ignore
these fields see the same `Finding` shape as before. SARIF consumers
that parse `relatedLocations` get richer output; those that ignore
it are unaffected.

---

## Prior releases (0.3 — 0.6.1)

Pre-v0.7 history exists on the git tag refs (`v0.6.0`, `v0.6.1`,
`v0.5.0`, etc.) but is consolidated here at the v0.7 cut to keep the
CHANGELOG narrative linear. Tag messages carry the per-release details
for anyone who needs the pre-0.7 commit-level trail.

Major capability milestones in the 0.3 → 0.6.1 arc:

- **0.3**: Initial public scanner suite.
- **0.5**: Precision CLI, Custom Rules DSL, type-aware `child_process`
  sink resolution, SARIF 2.1.0 conformance. Honest score 7.7.
- **0.6.0**: Foundation + 4 quick-win scanners + precision-tier gates.
  Multi-project OSS dogfood corpus introduced.
- **0.6.1**: Dogfood follow-through patch — three QUARANTINE scanners
  resolved via file-level-fingerprint stability, playwright-test-file
  exclusion, and parameterized-query FP elimination in the
  `sql-concat-checker`.
