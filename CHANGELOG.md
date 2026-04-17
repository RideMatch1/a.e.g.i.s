# Changelog

All notable changes to AEGIS are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). AEGIS uses
SemVer from v1.0; pre-1.0 (0.x) releases may include breaking changes,
which are called out in the relevant entry below.

Score-honesty convention: each milestone lists the **measured** honest
score, not the originally-targeted score. When they differ, both are
shown with the reason the target wasn't met.

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
  The ROLE_GUARD_PATTERNS set was tuned to spa-app helpers
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
