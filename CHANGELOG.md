# Changelog

All notable changes to AEGIS are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). AEGIS uses
SemVer from v1.0; pre-1.0 (0.x) releases may include breaking changes,
which are called out in the relevant entry below.

Score-honesty convention: each milestone lists the **measured** honest
score, not the originally-targeted score. When they differ, both are
shown with the reason the target wasn't met.

---

## [Unreleased]

## [0.17.0] — 2026-04-23 — "wizard-cli-initial"

First release of a new sibling package, `@aegis-wizard/cli`, the AEGIS
Wizard. The AEGIS Scan family (`@aegis-scan/*`) is unchanged at
`0.16.4`; this cycle ships only the new wizard-cli package at version
`0.17.0`. Tag-namespace for this release is `wizard-v0.17.0` so the
`v*` namespace remains reserved for future @aegis-scan ship-cycles.

### Added

- New npm package `@aegis-wizard/cli` at version `0.17.0` (first
  release). Binary `aegis-wizard` with a single `new <project-name>`
  command.
- Interactive mode via `@clack/prompts` asks 15 Tier-1 essential
  questions about a user's project (identity, compliance, i18n,
  deployment, email-provider, etc.) and emits a validated
  `aegis.config.json`.
- Non-interactive mode consumes an existing `aegis.config.json` via
  `--config <file>` for CI-driven re-runs.
- Brief-generator composes the config + selected patterns into an
  agent-consumable Markdown brief (`<project-name>-brief.md`) at the
  target output directory. The brief structures installation commands,
  database migrations, API-route conventions, build-order with
  gate-checks, quality-gates, DSGVO checklist, env-vars template, and
  a post-build-report template.
- Pattern-loader walks `docs/patterns/<category>/*.md`, parses
  gray-matter frontmatter, and validates via Zod. 8 patterns shipped
  in v0.17.0: `multi-tenant-supabase`, `auth-supabase-full`,
  `rbac-requirerole`, `middleware-hardened`, `logger-pii-safe`,
  `i18n-next-intl` (foundation), plus `dsgvo-kit` and `legal-pages-de`
  (compliance).
- `saas-starter` preset manifest at `presets/saas-starter.yaml`
  bundling all 8 patterns for the default new-project path.
- `--verbose-brief` flag emits a prose + rationale expansion of the
  brief (~1.5x terse length, ~600-900 lines on a saas-starter fixture).
  Every section keeps the terse skeleton and adds alternatives-considered
  paragraphs and why-this-matters rationale.
- `--lang=en|de` flag switches the brief's static strings between
  English (default) and German via a new i18n translation-layer
  backed by `src/brief/i18n/{en,de}.json` message catalogs. Dynamic
  interpolations (file paths, command names, pattern references, URLs)
  stay language-agnostic.
- `--output-mode=brief|scaffold|both` (default `both`) controls
  emission: `scaffold` writes only the config, `brief` writes only
  the brief, `both` writes both.
- Auto-generated pattern-catalog index at `docs/patterns/index.md`,
  regeneratable via `node scripts/gen-pattern-index.mjs`.
- Package-level README.md for the npm-page landing + root-README
  pointer-section directing users to the wizard-cli package.
- New GitHub Actions workflow `.github/workflows/publish-wizard.yml`
  triggered on `wizard-v*` tags, publishing `@aegis-wizard/cli` with
  SLSA v1 provenance attestation scoped to the new package only.

### Unchanged

- `@aegis-scan/*` family stays at `0.16.4`. No behavior change, no
  re-publish. The 5-consecutive-release SLSA-preservation streak for
  `@aegis-scan` continues unaffected — the new publish-workflow
  filters on `@aegis-wizard/cli` only via pnpm-filter and does not
  touch existing packages.
- Existing `.github/workflows/publish.yml` untouched. AEGIS Scan
  release-cycles continue independently on the `v*` tag-namespace.

### Architecture notes

- Tag-namespace split: `v*` → `@aegis-scan` ship-cycles;
  `wizard-v*` → `@aegis-wizard` ship-cycles. The two families are
  versioned independently so neither gates the other.
- Two-org npm architecture: users install AEGIS Scan and AEGIS Wizard
  independently depending on their needs. The brief emitted by
  Wizard recommends running `aegis scan` post-build as a quality
  gate — the two tools are co-calibrated.
- The wizard-cli package ships without external runtime scanners. It
  is a pure scaffold + brief-generator; security verification remains
  the responsibility of `@aegis-scan/cli` in a separate invocation.

### Known limitations

- Legal-page templates (Impressum, Datenschutzerklärung, AGB) for DE
  jurisdiction are starting-points, not attorney-reviewed. The
  templates cite correct statutes but binding compliance requires
  review by a qualified German lawyer. Consult counsel before
  production deployment.
- DSGVO-kit compliance depends on the operator's actual data flows.
  The schema plus audit-log structure is defensible; real-world
  compliance is a function of how the application uses them.
- IP-anonymization is implemented at ingest in the middleware pattern
  (/24 IPv4, /48 IPv6). If the ingest path is modified, verify
  anonymization still applies before shipping.
- SHA-pinned GitHub Actions in `publish-wizard.yml` are current as of
  the release date. Periodic re-pin may be needed as upstream actions
  update.
- `publish.yml` does not yet carry the install-time lifecycle-script
  CI gate that `publish-wizard.yml` now enforces; the scanner-side
  workflow is byte-locked to preserve the existing SLSA attestation
  streak and the same gate will land on the next `@aegis-scan` ship
  cycle via a dedicated commit.

## [0.16.4] — 2026-04-22 — "Scanner-Precision"

Patch-release closing two audit-tracked scanner-precision findings
surfaced by a representative Next.js + Supabase SaaS dogfood corpus.
Both fixes reduce false-positive noise in file-level scanner emission
without loosening security semantics. Benchmark 30/30 preserved.
Self-scan 1000/A/0 preserved. Canary-runner 168/168 across 18 phases
(13 new in two v017-prefixed phases). Scanner unit-tests 1322/1322.
SLSA v1 provenance across all five published packages — fifth-
consecutive-release preservation milestone since the v0.16.0
provenance-integrity fix.

### zod-enforcer body-consumption gate (closes D-S-001)

Previously, `zod-enforcer` flagged any mutation-method route handler
(`POST` / `PUT` / `PATCH` / `DELETE`) that did not contain a Zod schema
parse in or near the handler body. On dogfood corpora with real-world
App Router layouts, this produced a high false-positive rate on
handlers that do not consume a request body at all — session-only
mark-as-read endpoints, cron-reminder handlers, path-param-only
writers, form-data-only handlers outside the Zod validation scope.

The fix introduces a file-level body-consumption gate in
`zod-enforcer.ts`. If no mutation handler in the file reads
`request.json()`, `request.formData()`, `request.text()`, or
`request.body`, the scanner's HIGH finding is suppressed for that file.
Handlers that do consume a body and still lack Zod validation continue
to fire.

Measured empirical delta on the dogfood corpus: `zod-enforcer` HIGH
findings drop from 17 to 1. The remaining HIGH is a genuine true
positive on a Stripe webhook handler that reads the raw request
payload without Zod validation — this is the canonical
webhook-signature-verification pattern and the scanner is correctly
flagging it.

Known scope-limit: the gate is file-level, matching the existing
Zod-detection granularity. A file that defines an unused
`z.object({ … })` in a body-less handler will no longer emit the
MEDIUM `.strict()`-warning for that dead schema. Dead-schema warnings
are noise-class; the trade-off is documented inline in the scanner
source. Per-handler gate-granularity is deferred to a future
scanner-precision cycle.

### tenant-isolation-checker write-payload recognition + public-route downgrade (closes D-S-002)

Two-part fix for `tenant-isolation-checker`:

**Part A — write-payload recognition.** The scanner now recognises
tenant-boundary discriminants passed inside `.insert({ … })`,
`.update({ … })`, and `.upsert({ … })` payload objects — not only in
the surrounding `.eq()` filter chain. Previously, a route that passed
`{ tenant_id: ctx.tenantId, … }` in an insert-payload without a
separate `.eq('tenant_id', …)` filter was flagged HIGH despite being
scoped through the insert-payload itself. The extended recognition
covers the Supabase idiomatic insert-scoped-write pattern and
eliminates a structural false-positive class.

**Part B — public-route severity downgrade.** Service-role-key usage
on routes matching the `/api/public/<param>/…` path-pattern — where
`<param>` is a configured tenant-discriminant parameter like `slug` /
`tenant` / `workspace` — now downgrades from CRITICAL to INFO with a
context-note prompting operator-review. These routes are
public-by-architecture and rely on the downstream
`.eq('<param>', <param>)` scope-filter for tenant-scoping. The
heuristic is path-pattern-only and does not verify the downstream
filter is present; AST-taint extension for that verification is
queued for a future release.

Measured empirical delta on the dogfood corpus: `tenant-isolation`
HIGH findings drop from 8 to 0. One finding moves from CRITICAL to
INFO via the public-route downgrade (INFO-band 25 → 26).

### Cumulative empirical impact

Measured end-to-end on the dogfood corpus:

- score 959 → 969 (grade A preserved)
- total findings 646 → 618 (−28)
- HIGH-band across all scanners: 82 → 59 (−23)
- zero regressions on benchmark, canaries, self-scan, or unit-tests

### Known scope-limits (transparent disclosure)

- `zod-enforcer` body-consumption gate is file-level. Dead-schema
  `.strict()`-warnings in body-less handlers are suppressed.
- `tenant-isolation` write-payload recognition covers single-object
  payloads. Array-payload `insert([{ … }, …])` is not yet recognised
  (zero occurrences in the measured corpus).
- `tenant-isolation` multi-statement flow-tracking (SELECT-scoped-id
  → UPDATE-by-id) is out-of-scope for this release. Public-route
  downgrade covers the architectural pattern; full AST-taint
  extension is queued.

### Discipline

Two Rule codifications operationalised against a ship-class event for
the first time this cycle:

- Rule #13 (pre-commit HEREDOC scrub-gate) caught a scrub-leak
  pre-ship. Two initial commits embedded an internal project-name
  codename in narrative paragraphs describing the empirical corpus;
  the full-list scrub-gate flagged six occurrences across both
  commits before push. Remediation was `git reset --hard` plus two
  cherry-pick-with-amended-message cycles on the unpushed branch.
  The rule is now referenced against an authoritative scrub-term list
  rather than a per-session chosen subset.
- Rule #14 (canary-fixture comment hygiene) held — all fifteen new
  fixtures passed canary-runner first-authoring without the
  scanner-trigger-keyword-proximity issue surfaced in the v0164 arc.

## [0.16.3] — 2026-04-22 — "Coverage-Integrity"

Emergency patch-release closing a 🔴 ship-stopper-class systemic
silent-skip surfaced by a comprehensive external audit of the
v0.15.6 → v0.16.2 release-trio on 2026-04-21. Nineteen of the 55
built-in scanners — including jwt-detector, taint-analyzer,
tenant-isolation-checker, sql-concat-checker, xss-checker,
prompt-injection-checker, rls-bypass-checker, path-traversal-checker,
and every file with a local `isTestFile()` or `shouldSkipFile()`
helper — silently skipped any file whose path contained `/test/` or
`/tests/` as a substring. The `walkFiles()` traversal layer in
`packages/core/src/config.ts` compounded this with bare `'test'` and
`'tests'` entries in `DEFAULT_IGNORE` that excluded those directory
names at any depth. Empirical reproduction documented in the audit
report: identical source at `src/app/api/test/route.ts` produced
zero findings while the same source at `src/app/api/vuln/route.ts`
produced six findings, including CRITICAL tenant-isolation and HIGH
jwt-detector emissions. Any operator who named a Next.js App Router
route `test` / `tests` was silently shipping unscanned code while
seeing a green badge — the exact anti-pattern the tool was supposed
to prevent.

The fix closes the class systemically. A new canonical
`packages/core/src/is-test-path.ts` exports `isTestFile()` with
precise semantic — `.test.ts` / `.spec.ts` / `.e2e.ts` file-name
extensions, plus `__tests__/` / `__mocks__/` / `playwright/` /
`cypress/` / `e2e/` directory segments — and deliberately omits the
ambiguous `/test/` and `/tests/` substring matches. Every one of
the 19 affected scanners imports the canonical helper; the 13
narrow-variant files (`isTestFile()` stubs) replace their local
copies entirely, and the 6 wider-variant files (`shouldSkipFile()`
with additional vendor / minified / generated / admin predicates)
prepend `if (isTestFile(filePath)) return true;` at function-top
while preserving the rest of their scanner-specific skip-logic.
The `DEFAULT_IGNORE` list in `packages/core/src/config.ts` is
narrowed to remove `'test'` and `'tests'` while retaining the
unambiguous conventions (`__tests__`, `__test__`, `__mocks__`,
`__fixtures__`, `fixtures`, `benchmark`, `benchmarks`).

Honest grade-delta on a real-world operator-SaaS reference target
previously baselined across v0.15.6 / v0.16.0 / v0.16.1 / v0.16.2
— pre-fix `score=958 grade=A findings=645` with severity-split
`{low:21, medium:35, info:506, high:83}`, post-fix `score=959
grade=A findings=646` with severity-split `{low:21, medium:35,
info:506, high:84}`. One previously silent-skipped HIGH-severity
finding now surfaces. Grade remains A; score fluctuation is within
normal scoring-noise tolerance. Operators who have `/test/`-named
routes in their own codebases may see similar additional findings
emerge — those are real vulnerabilities that were masked
pre-v0.16.3, not v0.16.3-introduced regressions.

D-CA-004 (duplicated skip-logic across 19 scanner files) closes
naturally via the helper-extraction — the single canonical source
of truth in `@aegis-scan/core` replaces the copy-paste-propagated
local variants and their drift-risk. Scanner-behavior on every
other axis is preserved: self-scan 1000 / A / HARDENED / zero
findings, vulnerable-app benchmark 30 of 30, canary total 115 of
115 across 15 phases (up from 110 of 110 across 14 — new
v0163-test-path-semantic-skip phase adds 1 TP fixture for
route-named-test scanning and 4 FP scope-guards for `.test.ts` /
`__tests__/` / `__mocks__/` / `playwright/` correct-ignores). Per-
package tests all green (190/190 core · 1272/1272 scanners ·
110/110 reporters · 381/381 cli · 14/14 mcp-server). Provenance
attestations carry forward from v0.16.0 / v0.16.1 / v0.16.2 — this
release touches no publish-path config.

### Fixed

- **D-CA-002 `pnpm lint` NO-OP replaced with real type-drift gate
  (v0.16.3, quality-gate-theater fix):** Round-7 comprehensive
  audit flagged that the root `pnpm lint` script was a facade —
  `package.json` invoked `turbo lint`, the turbo pipeline had
  `"lint": {}` declared, and every one of the five shipped
  packages (cli, core, scanners, reporters, mcp-server) had **no**
  `lint` script at all. Empirical pre-fix output: `pnpm lint`
  produced `Tasks: 0 successful, 0 total` in 26ms with the
  warning `No tasks were executed as part of this run` and
  nonetheless exited 0 — CI watched a green checkmark for a gate
  that verified nothing. Users reading the README line about
  quality-gates got the impression of enforcement that did not
  exist. Post-fix: each shipped package gains a
  `"lint": "tsc --noEmit"` entry, the turbo pipeline is updated
  to `{ "dependsOn": ["^build"], "outputs": [] }` so lint waits
  on inter-package dist-artifacts being produced, and the CI
  `ci.yml` workflow replaces its ad-hoc four-package
  `cd-and-tsc` step with a single `pnpm lint` invocation.
  Empirical post-fix output: `pnpm lint` now produces
  `Tasks: 8 successful, 8 total` in ~2.5s on a cold cache. Gate-
  proof via injection — writing
  `export const BROKEN: string = 123;` into
  `packages/core/src/lint-probe.ts` produced
  `error TS2322: Type 'number' is not assignable to type 'string'`
  and exited non-zero (probe then removed). Rule #12-extended
  identifier-verify applied: the gate was not just declared but
  empirically invoked with both a passing (clean-tree) and a
  failing (injected-error) probe before commit. `tsc --noEmit`
  chosen over ESLint because (a) type-drift is the highest-value
  check for a TypeScript-strict codebase, (b) zero new dev-deps,
  (c) each package already had `build: tsc` proving the tsconfig
  is in good shape. ESLint-adoption remains available as a
  separate follow-on cycle if operator-requested.

- **D-CA-003 GitHub Actions SHA-pinned — self-advice-followed
  (v0.16.3, credibility-fix):** The Round-7 comprehensive audit
  flagged a self-contradiction in the AEGIS CI — `.github/workflows/
  publish.yml`, `release.yml`, and `ci.yml` all used floating
  version-tagged Actions (`actions/checkout@v4`,
  `pnpm/action-setup@v4`, `actions/setup-node@v4`) while AEGIS's
  own `supply-chain` scanner warns operators about exactly this
  C2-threat-class pattern (floating tags let a compromised
  publish-token re-point a previously-trusted Action to malicious
  code without any in-repo review). All 8 unpinned usages across
  the 3 workflows are now replaced with 40-character commit-SHAs
  plus a trailing `# vX.Y.Z` comment for human-readable version
  tracking. Canonical SHAs empirically resolved via `gh api
  repos/<org>/<repo>/git/refs/tags/<tag>` and its annotated-tag
  dereference where applicable — `actions/checkout@v4` →
  `34e114876b0b11c390a56381ad16ebd13914f8d5` (= v4.3.1),
  `pnpm/action-setup@v4` →
  `b906affcce14559ad1aafd4ab0e942779e9f58b1` (= v4.3.0 per the v4
  floating-tag resolution at fix-time; v4.4.0 is a later release
  the maintainer has not yet moved the floating v4-tag to),
  `actions/setup-node@v4` →
  `49933ea5288caeca8642d1e84afbd3f7d6820020` (= v4.4.0). Pre-fix
  grep-gate: `grep -rnE 'uses: [^@]+@v?[0-9]+(\.[0-9]+)*$'
  .github/workflows/` returned 8 hits; post-fix returns 0.
  Complementary gate: `grep -rnE 'uses: [^@]+@[a-f0-9]{40}'
  .github/workflows/` returns 8 hits. CI-only change — scanner
  behavior, runtime behavior, and published-package behavior are
  unchanged by this commit.

- **D-CA-001 systemic silent-skip coverage-gap (v0.16.3 ship-stopper
  first-item, Round-7 audit finding):** Canonical
  `packages/core/src/is-test-path.ts` helper replaces 19 copies of
  local `isTestFile()` / `shouldSkipFile()` skip-logic in scanners.
  The new semantic deliberately drops `/test/` and `/tests/`
  substring matches that were the root cause of the silent-skip —
  `filePath.includes('/test/')` matched `app/api/test/route.ts` as
  a legitimate App Router route, same as it would have matched
  `test/helpers.ts`, and the scanner couldn't distinguish the two.
  The 19 files split into 13 narrow-variant files (each with its
  own local `isTestFile()` — replaced by the canonical import
  outright) and 6 wider-variant files (each with a local
  `shouldSkipFile()` that combined test-file-detection with
  scanner-specific predicates like `/vendor/`, `.min.js`,
  `/generated/`, `/scripts/`, `/cron/`, `/webhooks/`, `/admin/`;
  these replace only the test-related lines with a call to the
  canonical helper and retain the scanner-specific extras). The
  `walkFiles()` traversal layer's `DEFAULT_IGNORE` in
  `packages/core/src/config.ts` is narrowed to remove bare `'test'`
  and `'tests'` — those matched at any depth via picomatch and
  compounded the silent-skip. Unambiguous test-framework
  conventions (`__tests__`, `__test__`, `__mocks__`, `__fixtures__`,
  `fixtures`, `benchmark`, `benchmarks`) remain in the default
  ignore-list. Users who want their own top-level `test/` directory
  ignored can add it via `aegis.config.json` `ignore` (which unions
  with defaults). New canary phase
  `v0163-test-path-semantic-skip` with 5 fixtures (1 TP + 4 FPs)
  gates the semantic — TP `src/app/api/test/route.ts` now emits
  jwt-detector/CWE-798 (previously silent-skipped), FPs for
  `.test.ts` / `__tests__/` / `__mocks__/` / `playwright/` confirm
  the preserved-skip behavior for real test-files. The
  `packages/core/__tests__/config.test.ts` v0.7.1 BLOCKER-gate is
  updated with a positive assertion for the retained unambiguous
  dirs and a regression-guard negative assertion that `'test'` and
  `'tests'` are NOT in the default ignore-list (to prevent D-CA-001
  re-introduction). D-CA-004 duplicated-skip-logic closes naturally
  via the single-source-of-truth helper. Class-lesson: the same-
  class slip as v0.15.5 D-A-002 phantom `aegis doctor` (surface-
  reference without empirical-probe) displaced to a different
  pattern-semantic dimension (path-substring-match vs identifier-
  reference). Rule #12-extension (2026-04-21 codification) did not
  prevent this because it scoped to identifier-classes (CLI-
  subcommands, install-commands, URLs, filepaths) rather than
  pattern-semantics; D-CA-001 adds the pattern-semantic-class to
  the list of audit-surfaced extension-classes.

## [0.16.2] — 2026-04-21 — "UX-Truth"

Single-item patch-release closing D-R7-001 — a Rule #12
discipline-miss surfaced by a fresh Round-7 external audit of the
v0.15.6 → v0.16.1 release-trio on 2026-04-21. The v0.15.6
cold-install-UX banner shipped a curated map of per-scanner
install-hints with a JSDoc header claiming "Empirically verified
per Rule #12 — every command listed here was run on a clean
machine to confirm it resolves." One of the 16 hints,
`brew install bearer`, did not in fact resolve: `brew info
--formula bearer` returns "No available formula with the name
'bearer'" on current homebrew-core (no `bearer/tap` exists
either). The Bearer SAST project itself is alive and actively
maintained at github.com/Bearer/bearer; it just is not distributed
via Homebrew. A user reading the v0.15.6 banner on a clean machine
would copy-paste the brew command and receive an error — the same
broken-promise trust-class that the v0.15.6 D-B-001 fix was meant
to eliminate, displaced to an adjacent identifier-class (external
install-commands rather than AEGIS-native CLI subcommands). The
Rule #12 codification had specified CLI-subcommand-verify as the
canonical example but did not explicitly enumerate external
install-commands as in-scope; the Round-7 audit surfaced this
extension-class, which this release codifies alongside the
one-line source-fix.

Scanner behavior, scoring, canary-results, attestation-flow, and
published-package runtime behavior are all unchanged — v0.16.2
touches only a single string-literal in
`packages/cli/src/commands/scan.ts`, a new regression-guard test
case in `scan-banner.test.ts`, and the Rule #12 feedback-file
codification. Provenance attestations carry forward from v0.16.0
and v0.16.1; this is the third consecutive release with non-empty
SLSA v1 predicates on all 5 tarballs (first, second, and third
sequential-preservation-gate passes of the D-P-001 closure).

### Fixed

- **D-R7-001 bearer banner-hint brew→docker (v0.16.2 first-item,
  Rule #12-extended):** `packages/cli/src/commands/scan.ts:42`
  `EXTERNAL_INSTALL_HINTS.bearer` changed from
  `'brew install bearer'` (dead-end) to `'docker pull bearer/bearer'`
  (bearer's canonical Docker Hub image — `docker manifest inspect
  bearer/bearer` returns a valid v2 manifest at fix-time,
  pull_count 277,938 per `hub.docker.com/v2/repositories/bearer/
  bearer/`). The choice of docker-over-curl-script matches the
  existing precedent for `zap: 'docker pull
  owasp/zap2docker-stable'` in the same map, keeps the map's
  one-command-per-hint ergonomics, and avoids the pipe-to-sh
  pattern that a subset of security-minded operators refuse to
  execute. The JSDoc header on `EXTERNAL_INSTALL_HINTS` is updated
  to replace the overclaim ("every command listed here was run on
  a clean machine") with an accurate description of the ongoing
  Rule #12-extended discipline applied to external install-command
  references, plus an explicit pointer to the v0.16.2 D-R7-001
  incident-narrative. A new regression-guard test case in
  `packages/cli/__tests__/scan-banner.test.ts` asserts the runtime
  banner never again contains the literal string
  `brew install bearer` and always contains either
  `docker pull bearer/bearer` or a curl-install-script pattern.
  The Rule #12 codification in
  `feedback_verify_referenced_identifiers.md` has been extended
  with explicit coverage of external install-commands (brew, pip,
  docker, npm, go, apt) and URLs inside user-facing strings — not
  only in-repo CLI subcommands as the original v0.15.6 codification
  specified. The class-lesson codified this cycle: rule-codifications
  cover the incident-class they were written against; fresh
  external-audits surface extension-classes. Round-7 findings are
  reproducible via `brew info --formula bearer` (exits non-zero with
  "No available formula") and `docker manifest inspect
  bearer/bearer` (returns a valid v2 manifest).

## [0.16.1] — 2026-04-21 — "Test-Reliability"

Single-item patch-release closing the D-T-001 turbo-parallel AST-test
flake discovered during v0.16.0 pre-commit empirical-verify and
queued for this cycle per Rule #10 defensive-execution. Six AST
tests in `@aegis-scan/scanners` that build ts-morph `Program`
instances (`function-summary`, `module-graph`, `program`,
`taint-analyzer`, `taint-tracker`, `type-resolve`) timed out at
vitest's default 5000ms per-test budget when `pnpm turbo test
--force` ran all 10 packages' test-suites concurrently on multi-core
developer hosts — an environmental flake driven by CPU contention
during parallel ts-morph `Program` construction rather than a logic
regression. The flake was proven pre-existing by stash-reverting to
`a00e9a9` (pre-v0.16.0) under pnpm@9.15.0 where the same six tests
reproduced identical 5000ms timeouts. Isolated per-package runs
(`pnpm --filter @aegis-scan/scanners test`) were unaffected — 77 of
77 test files / 1272 of 1272 tests green. Scanner-behavior, scoring,
canary-results, and published-package-behavior are all unchanged by
this release. Provenance attestations carry forward from v0.16.0
(the fix in this release does not touch any publish-path config or
scanner logic).

### Fixed

- **D-T-001 turbo-parallel AST-test flake (v0.16.1 first-item):**
  New `packages/scanners/vitest.config.ts` sets `test.testTimeout`
  to 15000ms (up from vitest's default 5000ms). Empirical sizing:
  the six affected tests complete in 7-8 seconds each in isolation
  (session-measurement: function-summary 8057ms, module-graph 7951ms,
  program 7627ms, taint-analyzer 8002ms, taint-tracker 7405ms,
  type-resolve 8210ms) and take ~10-12 seconds under turbo-parallel
  CPU contention. 15000ms provides ~1.5× headroom above both the
  isolation-time and the observed parallel-time without making the
  timeout so loose that a real performance regression could hide
  behind it. The config is scoped to the `scanners` package only —
  the other four shipped packages (cli, core, reporters, mcp-server)
  have no ts-morph-Program-building tests and continue to use
  vitest's 5000ms default unchanged. RED-baseline captured pre-fix
  (`pnpm turbo test --force` produced 6 × `FAIL __tests__/ast/` with
  12 × `Error: Test timed out in 5000ms`) and GREEN-baseline
  verified post-fix (0 timeout-hits, 10 of 10 turbo tasks
  successful, 77 of 77 scanners test files and 1272 of 1272
  scanners tests green, individual per-package isolated
  test-counts unchanged). No test-file edits and no source-code
  edits in this release — the fix is config-level only.

## [0.16.0] — 2026-04-21 — "Provenance-Integrity"

Single-item minor-release closing the SLSA provenance soft-gap that
has shipped unresolved across every @aegis-scan tarball since
v0.15.2. Root-cause pinned to upstream pnpm#6607 (open since
2023-05-29) — the recursive-publish path silently drops the
top-level `--provenance` flag during the per-package npm-invocation.
Two-layer remediation: root `packageManager` bumps from pnpm@9.15.0
to pnpm@10.33.0 (post-libnpmpublish migration per pnpm#10591 merged
2026-02-12), and each of the five shipped `packages/*/package.json`
files (cli, core, scanners, reporters, mcp-server) gains
`publishConfig.provenance=true` alongside the existing
`access=public`. The publishConfig layer is independent of which
publish-backend pnpm uses because npm reads
`publishConfig.provenance` directly from each packed manifest.
Scanner-behavior unchanged — self-scan 1000 / A / HARDENED / 0
preserved, canary total 110 of 110 across 14 phases, full
test-suite clean per-package (1272 of 1272 scanners, 190 of 190
core, 110 of 110 reporters, 380 of 380 cli, 14 of 14 mcp-server;
pre-existing turbo-parallel-CPU-contention flake on six AST tests
documented at D-T-001 queued for v0.16.1), pnpm release:smoke PASS
(34 files scaffolded, 0 moderate+ vulnerabilities), and `pnpm -r
publish --dry-run --no-git-checks --force` reaches `npm notice
Publishing` for all five packages with zero silently-dropped or
warn or error output. Final empirical seal is post-tag-push —
`npm view @aegis-scan/cli@0.16.0 dist.attestations` must return a
non-empty SLSA predicate for D-P-001 to be confirmed closed
end-to-end.

### Fixed

- **D-P-001 SLSA provenance soft-gap closed
  (v0.16 first-item, multi-cycle deferred since v0.15.2):** Every
  `@aegis-scan/*` tarball since v0.15.2 shipped with empty
  `dist.attestations` on the npm registry despite the publish workflow
  invoking `pnpm -r publish --provenance`. Root cause nailed to
  upstream pnpm — the recursive-publish path in
  `releasing/commands/src/publish/recursivePublish.ts` lines 99-111
  (current `main` branch) constructs the per-package npm-invocation
  with a hand-rolled `appendedArgs` list that includes `--access`,
  `--dry-run`, `--force`, `--otp` and nothing else. The
  top-level `--provenance` flag parsed into `opts.cliOptions` is
  never forwarded to the per-package publish call and is silently
  dropped. Confirmed-OPEN at pnpm#6607 since 2023-05-29 (contributor
  hi-ogawa diagnosis with SHA-pinned source-reference). The pnpm team
  replaced the `spawn(npm)` approach with `libnpmpublish` in
  pnpm#10591 (merged 2026-02-12, shipped pnpm 10.8+), but the
  recursive-path arg-delegation bug was not closed — issue #6607
  remains open as of this release. AEGIS's CI ran pnpm@9.15.0 pinned
  via the root `packageManager` field read by
  `pnpm/action-setup@v4` via Corepack; that path uses the legacy
  spawn-npm delegation where `--provenance` is dropped. Two-layer
  remediation lands in this release:
  (1) root `packageManager` bump from `pnpm@9.15.0` to `pnpm@10.33.0`
  (latest stable) — post-libnpmpublish path where
  `releasing/commands/src/publish/publishPackedPkg.ts` lines 125-139
  honors `options.provenance != null` once it arrives from the
  per-package manifest;
  (2) `"publishConfig": { "provenance": true }` added to each of the
  five shipped `packages/*/package.json` files (cli, core, scanners,
  reporters, mcp-server) alongside the existing `"access": "public"`.
  This is the canonical community-endorsed workaround documented in
  the pnpm#6607 thread (andrskr + ndom91 comments; Nuxt's
  `.github/workflows/release-main.yaml` references the same pattern)
  and is layer-independent of which publish-backend pnpm uses —
  npm reads `publishConfig.provenance` from each package's manifest
  directly during publish. The existing `--provenance` CLI flag in
  `.github/workflows/publish.yml` is deliberately kept as
  defense-in-depth: if pnpm#6607 is eventually patched in a future
  release the flag becomes authoritative; if not the publishConfig
  keeps the contract whole. Empirical pre-R3 verification: scratch
  two-package pnpm@10 workspace with `publishConfig.provenance: true`
  per package, `pnpm -r publish --dry-run --no-git-checks` completes
  both packages through to `npm notice Publishing to ... with tag
  latest and public access (dry-run)` with no "silently-dropped"
  warning. Final empirical seal is post-tag-push: `npm view
  @aegis-scan/cli@0.16.0 dist.attestations` must return a non-empty
  SLSA predicate. The `v0.15.3` CHANGELOG's documented-known-gap
  bullet (N-001 from Round-3 external review) is now the historical
  record of the bug that v0.16 closes. Self-scan 1000/A/HARDENED/0
  preserved across this commit; scanner-behavior unchanged.

## [0.15.6] — 2026-04-21 — "Trust-Fixes"

Emergency hotfix closing two post-v0.15.5-ship defects surfaced by the
Round-6 external-review audit run immediately after the v0.15.5
tarballs landed on npm. 🔴 D-B-001 is a user-facing trust-erosion
defect: the v0.15.5 cold-install-UX banner referenced `aegis doctor`
as an install-hint, but that subcommand does not exist in the CLI —
a user who typed the referenced command got `error: too many
arguments` and lost trust in the tool's own output. Root cause: the
v0.15.5 D-A-002 hotfix at commit 45adc7c edited the banner string
without running the referenced command empirically. Codified as
Rule #12 (`feedback_verify_referenced_identifiers.md`) — any edit
touching a string that references a CLI command / option / URL /
filepath must invoke / fetch / load the identifier before commit.
Textual grep-sweep (Rule #9) finds the references; Rule #12 demands
each hit be invoked to prove it is not a broken-promise.

### Fixed

- **D-M-001 npm package descriptions aligned with README scanner-count
  claims (v0.15.6 hotfix):** Two of the five public package
  descriptions carried stale scanner-counts that drifted from the
  README's canonical inventory after the v0.15.4 D-M-005 full-closure.
  `@aegis-scan/cli` description said "41 built-in checkers" — README
  L12 says 42. `@aegis-scan/scanners` description said "40 built-in
  regex/AST checkers + 1 AST cross-file taint analyzer" — README L336
  says "42 scanners: 41 regex + 1 AST taint analyzer". Operators
  searching npmjs.com for AEGIS see the package descriptions before
  the README; the drift implied the scanner suite was smaller than
  documented and undermined the v0.15.4 D-M-005 close. Both
  descriptions now read "42 built-in checkers" / "41 built-in regex
  checkers + 1 AST cross-file taint analyzer + 16 external-tool
  wrappers" — exact match with README L12 and L336. The other three
  package descriptions (`core`, `reporters`, `mcp-server`) carried no
  scanner-count claims and are unchanged. Empirical baseline check
  via `npm view @aegis-scan/cli@0.15.5 description` confirmed the
  drift was indeed shipped on the v0.15.5 tarballs (publish-immutable
  per the same v0.15.4 D-A-001 erratum-boundary documented for the
  CHANGELOG correction).

- **D-B-001 cold-install-UX banner phantom-command reference
  (v0.15.6 hotfix, user-trust-erosion):** `packages/cli/src/commands/
  scan.ts` cold-install-UX banner rewritten to emit concrete
  per-scanner install-hints instead of pointing at the non-existent
  `aegis doctor` subcommand. A new `EXTERNAL_INSTALL_HINTS` map maps
  each of the 16 external-tool wrappers to its empirically-verified
  install command — `brew install semgrep`, `brew install gitleaks`,
  `pip install checkov`, `docker pull owasp/zap2docker-stable`,
  `npm i -g license-checker`, `npx -y react-doctor@latest .`, etc.
  Only the scanners that are actually unavailable on the current run
  are listed, one per line with the tool-name padded and followed by
  the install command. The banner's closing lines reference `aegis
  init` (which writes `.github/workflows/aegis.yml` per
  `packages/cli/src/commands/init.ts:93-94`) and `aegis --help`
  (the standard CLI reference command, confirmed via `npx -y -p
  @aegis-scan/cli@0.15.5 aegis --help`). The `scan-banner.test.ts`
  regression-guard was updated to assert the new contract: banner
  must emit a concrete install-command pattern (`brew install` /
  `npm i -g` / `pip install` / `docker pull` / `npx -y`), must
  reference `aegis --help` and `aegis init` (both real subcommands),
  and must never again contain the phantom `aegis doctor`.
  Grep-sweep against all other `aegis <subcommand>` string-literal
  references in shipped source confirmed every remaining referent is
  a real subcommand per `aegis --help` output (scan, audit, pentest,
  siege, fix, history, init, new, precision, diff-deps, version).

## [0.15.5] — 2026-04-21 — "Fertig-Patches hotfix"

Hotfix for three defects surfaced by a brutal-audit run immediately
after the v0.15.4 tarballs landed on npm. Originally planned and
dispatched as v0.15.4.1 — renamed to v0.15.5 at the R2 version-bump
gate for semver-2.0 compliance (4-part version-strings like
`0.15.4.1` are invalid per the semver 2.0 spec and the npm semver
parser returns `null` for them). The three hotfix commits
(97202cc, ad69602, 45adc7c) reference "v0.15.4.1" in their bodies
as historical documentation of the intent at commit-time — the
actual shipping version is v0.15.5. Closes 🔴 D-R-001 Templates
basename-silent-skip regression, 🟠 D-A-001 D-M-001 CHANGELOG
honesty erratum, and 🟡 D-A-002 stale install-hint plus pre-publish
grep-gate.

Patch-release closing three post-v0.15.4-ship findings surfaced by a
brutal-audit run immediately after the v0.15.4 tarballs landed on
npm. The 🔴 D-R-001 regression introduced by v0.15.4's own D-C-001
DEFAULT_IGNORE expansion was the ship-stopper class — component-
named source files like `TemplatesTab.tsx`, `TemplatesGrid.tsx`,
and `TemplatesList.tsx` were silently skipped by walkFiles because
the `Templates*` picomatch pattern matched basenames as well as
directory names, letting a hardcoded JWT in a component-named file
go completely unreported. v0.15.5 narrows the pattern to
`Templates[0-9]*` so the vendor-template directory naming
convention (`Templates1/`, `Templates2/`, `Templates99/` — Larkon
/ dashboard-UI starter-kit class) is still matched while
component-names are preserved. Self-scan 1000/A/HARDENED/0
maintained; canary total 110 of 110 across 14 phases (v0.15.4's
108 + 2 new hotfix fixtures); full scanners test-suite
1272 of 1272 green.

### Fixed

- **D-R-001 Templates* basename-silent-skip regression (v0.15.5
  hotfix, ship-stopper class):** `packages/core/src/config.ts`
  DEFAULT_IGNORE pattern `'Templates*'` narrowed to
  `'Templates[0-9]*'`. The numeric-first-character guard prevents
  silent-skip of component-named source files whose basenames
  happen to start with "Templates". Empirical repro pre-fix: a
  synthetic probe with identical JWT content in
  `src/components/TemplatesTab.tsx` and
  `src/components/NormalFile.tsx` produced jwt-detector CRITICAL
  on the latter but ZERO findings on the former — the silent-skip
  masked a real hardcoded secret. Two canary fixtures added under
  `packages/benchmark/canary-fixtures/v0155-templates-basename-skip/`
  codify the flip — `TP-templates-named-component-scanned` flips
  from RED to GREEN post-fix, `FP-templates-dir-vendor-ignored`
  stays GREEN both sides as the narrowed pattern still matches the
  canonical `Templates1/` vendor-dir convention. Picomatch
  empirical testing rejected the first-attempt fix
  `'Templates*/'` (matches nothing, would break D-C-001's original
  vendor-dir intent) and confirmed `'Templates[0-9]*'` matches
  `Templates1` / `Templates99` directory names while correctly
  not-matching `TemplatesTab.tsx` / `TemplatesGrid.tsx` /
  `TemplatesList.tsx` component basenames.

- **D-A-002 stale cold-install-UX banner version-pin + publish-gate
  (v0.15.5 hotfix):** `packages/cli/src/commands/scan.ts` banner-
  text at line 109 dropped the `(v0.15.3)` parenthesized install-hint
  version-pin — tool names like `aegis doctor` are stable across
  releases and do not need a version anchor in user-facing strings.
  The v0.15.4 tarballs shipped with the stale-by-one-version
  `(v0.15.3)` pin as a visible example of the failure-mode. To
  prevent recurrence, `.github/workflows/publish.yml` gains a
  pre-publish grep-gate step that blocks install-hint-style
  version-pins (`(v0.15.X)` embedded in string-literals) from any
  shipped source tree. The gate is intentionally narrow — historical
  references in comments (`// v0.15.4 D-N-003`, `* introduced in
  v0.15.2`) are real documentation of when each change landed and
  remain allowed. Two JSDoc historical references to v0.15.3 in
  `template-sql-checker.ts` and `jwt-detector.ts` are preserved
  unchanged.

- **D-A-001 CHANGELOG [0.15.4] D-M-001 honesty erratum:** the
  v0.15.4 D-M-001 entry originally framed the FixGuidance work as
  "full-closure 12-of-12 Round-4-flagged scanners". Empirical
  post-ship verification (grep matrix on every scanner emission-
  site cross-referenced against fix-block presence) shows the
  framing was wrong — only 7 of 12 Round-4-flagged scanners were
  actually populated; 4 remain null-fix (`supply-chain`,
  `rate-limit-checker`, `error-leakage-checker`,
  `prompt-injection-checker`) and queue v0.15.5. The remaining 5
  scanners populated in Phase-2 (`crypto-auditor`,
  `config-auditor`, `header-checker`, `next-public-leak`,
  `mass-assignment-checker`) are valuable adjacent-improvements
  but were not on Round-4's flagged list. The v0.15.4 [0.15.4]
  block in this CHANGELOG carries the corrected framing — the
  v0.15.4-on-npm tarballs and the v0.15.4 GitHub release-notes
  ship with the original (incorrect) framing because those are
  immutable post-publish; the v0.15.5 tarballs and onwards
  carry the corrected text. Operators consuming v0.15.4 CHANGELOG
  via `npm view ... CHANGELOG` see the original; everything from
  v0.15.5 forward sees the corrected. No code change required —
  CHANGELOG.md only.

## [0.15.4] — 2026-04-21 — "Fertig-Patches"

Round-4 external-review close-out for v0.15.3. Nine audit-findings
closed end-to-end across four execution phases plus two Items-6+7
bundle scope-bound edits (D-M-005 README-debt + D-N-003 Scanner
classification) surfaced during brutal-audit. Cumulative vs v0.15.3:
new `walkFiles` picomatch-glob-support + 2 MiB size-cap on
candidate files, `DEFAULT_IGNORE` expansion for vendor-template /
third-party / minified patterns, `tenant-isolation-checker`
path-param-as-tenant-discriminant public-route heuristic,
`Scanner.isExternal` classification field correcting the cold-
install-UX banner, `logging-checker` empty-project skip, and
FixGuidance populated on 12 total scanner-classes (top-3 in Item-3
plus the remaining 9 in Phase 2) plus match-specific title
differentiation on 8 scanners. 6 scanner-count claims across README
and docs/GETTING-STARTED re-aligned with the ground-truth 58+5=63
inventory. CHANGELOG retro-migration-notes added to v0.15.0 through
v0.15.3 documenting scanner-activation / scoring-policy / scanner-
expansion deltas. Self-scan 1000/A/HARDENED/0 maintained across all
commits; canary total 108 of 108 across 13 phases; full scanners
test-suite 1272 of 1272 across 77 files.

### Added

- **walkFiles picomatch-based glob-support (v0.15.4 D-C-001
  capability):** `packages/core/src/utils.ts` walkFiles now evaluates
  ignore-patterns via picomatch, enabling glob-syntax in
  `DEFAULT_IGNORE` and `aegis.config.json` `ignore: [...]`. Existing
  30+ exact-string entries remain literal-match — picomatch handles
  patterns-without-wildcards as literal, so `node_modules`, `.next`,
  `/public`, etc. behave identically to the pre-v0.15.4 Set.has
  implementation. New: wildcard patterns like `Templates*` match
  directories by basename and relative-path; path-globs like
  `**/*.min.js` match at file-level (pre-v0.15.4 walkFiles filtered
  only directories). File-level filtering applies ONLY to patterns
  containing glob-wildcards — literal-filename ignore-entries remain
  silent no-ops on files, preserving backward-compat with the
  pre-v0.15.4 semantic. Dependency: `picomatch@^4` (Apache-2.0, used
  by tsc, prettier, eslint, chokidar). 8 canary fixtures under
  `packages/benchmark/canary-fixtures/v0154-default-ignore-expansion/`
  (5 FP + 3 TP) including `FP-templates-numeric-variants`
  (glob-class-completeness across Templates2/Templates99) and
  `TP-templates-lowercase-scanned` (case-sensitivity scope-guard
  preserving legit lowercase `templates/` source).

### Changed

- **D-N-002 scanner title specificity — per-finding differentiation
  (v0.15.4 Fertig-Patches, Round-4 audit-finding):** Eight scanner
  emission-sites that previously emitted an identical title across
  every finding of the class now include match-specific context in
  the title so multi-finding reports differentiate findings by the
  route, pattern, or token-prefix that triggered the detection.
  `csrf-checker`, `rate-limit-checker`, `mass-assignment-checker`,
  and `timing-safe-checker` append the `/api/<path>` route identifier
  extracted from the file path. `open-redirect-checker`,
  `error-leakage-checker`, and `ssrf-checker` append the matched
  code fragment (sanitized to a 60-80 char snippet) so the specific
  dangerous construct is visible in the title. `rate-limit-checker`
  additionally prefixes the title with the route category (auth /
  payment / admin / export / sensitive) derived from the matched
  sensitive-path pattern. `jwt-detector` appends the first 12
  characters of the matched token (always the fixed header prefix,
  never the signature) so a repo with multiple hardcoded tokens
  surfaces them distinctly instead of under a single generic line.
  Descriptions remain unchanged — the specificity is carried in the
  title so terminal and HTML reporter summaries differentiate at a
  glance without requiring operators to expand each finding.
  `pagination-checker` already differentiated between Supabase
  `.from().select()` and Prisma `findMany()` via separate titles, so
  no change was needed there — the 8 scanners above close the
  audit-flagged class end-to-end alongside the Phase 2
  FixGuidance-description specificity.

- **D-M-001 FixGuidance-fill on 9 additional scanners (v0.15.4
  Fertig-Patches, Round-4 audit-finding partial-close):** Populates
  structured `fix: { description, code?, links? }` on nine
  scanner-classes — `crypto-auditor` (14 RULES + 1 COMPOUND_RULE
  + HMAC-truncation + prototype-pollution, ~17 emission-sites),
  `config-auditor` (3 Docker + 1 Docker-Compose + 3 Next.js + 2
  Firebase + 3 inline env-file findings, ~12 sites),
  `http-timeout-checker` (3 sites — fetch/axios/got), `upload-validator`
  (2 sites — magic-byte missing + Supabase contentType missing),
  `header-checker` (2 emission paths — no-config and config-present),
  `next-public-leak` (2 sites — NEXT_PUBLIC_ secret + server-secret
  in client component), `pagination-checker` (2 sites — Supabase .from
  and Prisma findMany), `mass-assignment-checker` (1 site — raw-body to
  DB), and `env-validation-checker` (2 sites — no central validation
  + empty-string default). Combined with Item-3's `i18n-quality` /
  `console-checker` / `auth-enforcer` populate (commit bc120d0),
  total empirical FixGuidance coverage at v0.15.4 ship = 12
  scanner-classes with structured `fix` on at least one high+
  severity emission-site (verified post-hoc via grep matrix).
  **Honest scope-correction (v0.15.5 D-A-001 erratum):** an
  earlier framing of this entry as "full-closure 12-of-12
  Round-4-flagged" was incorrect — empirical post-ship verification
  shows four Round-4-flagged scanners with high+ emissions remain
  null-fix and queue v0.15.5: `supply-chain` (its `addFinding` helper
  doesn't accept a fix parameter at all — needs signature-change),
  `rate-limit-checker`, `error-leakage-checker`, and
  `prompt-injection-checker`. Of the nine scanners populated in this
  commit, four match Round-4's flagged list (http-timeout-checker,
  upload-validator, pagination-checker, env-validation-checker) and
  five are adjacent quality-improvements (crypto-auditor,
  config-auditor, header-checker, next-public-leak,
  mass-assignment-checker) — all twelve add real operator-value but
  the Round-4 closure is partial (7 of 12 flagged) rather than the
  originally-claimed full. Total ~40 new FixGuidance objects across
  the 9 scanners, each with actionable description plus canonical
  CWE/OWASP/vendor references. Code-snippets follow the Item-3
  discipline — pseudo-code or literal-URL examples only, no framework
  imports or variable-URL fetches, to prevent self-scan collateral
  (the five supply-chain phantom-dep / SSRF / jwt-checker self-matches
  surfaced during mid-populate verify-loop were sanitized before
  commit). Self-scan 1000/A/HARDENED/0 preserved; full scanners
  test-suite 1272 of 1272 green; all 108 canaries across 13 phases
  green.

- **D-C-001 DEFAULT_IGNORE expansion for vendor-template /
  third-party / minified patterns (Round-4 audit-finding):** Added
  five new entries to `packages/core/src/config.ts` DEFAULT_IGNORE —
  `Templates*`, `third_party`, `third-party`, `**/*.min.js`,
  `**/*.min.css`. Closes Round-4 audit-finding 🔴 D-C-001 where 27%
  of Sonnenhof-class (`Templates1/Larkon-*_v1.0/`) findings were
  vendor-template-noise including six spurious JWT-detector
  criticals on template-demo-code. Case-sensitive `Templates*`
  deliberately preserves lowercase `templates/` as legit-source
  (common email / handlebars convention). User-config merge-semantics
  preserved — operators override via `ignore: [...]` in
  `aegis.config.json` per existing merge-logic; additions union with
  DEFAULT_IGNORE. The `**/*.min.js` / `**/*.min.css` file-level
  patterns rely on the new picomatch capability introduced above —
  pre-v0.15.4 walkFiles did not filter files against ignore-patterns
  at all.

- **D-C-002 tenant-isolation-checker public-route-heuristic (Round-4
  audit-finding):** `tenant-isolation-checker` now recognizes
  `/api/public/**` routes with path-param-as-tenant-discriminant
  (default allowlist `[slug]`, `[tenant]`, `[workspace]`, `[org]`,
  `[handle]`) and downgrades service-role-use findings from CRITICAL
  to INFO with an actionable context-note on the finding's
  description. Closes Round-4 audit-finding 🔴 D-C-002 where
  Operator-SaaS-class `/api/public/spa/[slug]/{booking, chat, rating,
  treatments, checkout, [token]/cancel}` routes were F-blocking
  first-scans despite `[slug]` being the architectural
  tenant-discriminant. Heuristic is **path-pattern-only** — does NOT
  verify the downstream `.eq('slug', slug)` scope-filter is actually
  present (AST-taint extension deferred to v0.15.5+). The
  context-note explicitly prompts operator-review of the scope-filter
  so the severity-downgrade is an INVITATION to verify rather than a
  silent pass. User-configurable via
  `scanners.tenantIsolation.publicRoutePrefixes: string[]` (default
  `['/api/public/']`) and
  `scanners.tenantIsolation.tenantDiscriminantParams: string[]`
  (default `['slug', 'tenant', 'workspace', 'org', 'handle']`) in
  `aegis.config.json`. New structured Zod schema
  `TenantIsolationScannerConfigSchema` added to
  `packages/core/src/config.ts` alongside the existing
  `SupplyChainScannerConfigSchema` pattern — typos in sub-keys now
  surface as ZodError rather than silent no-ops.

  Test-coverage note: correctness is unit-test-verified at
  scanner-level (seven `scanResult.findings[0].severity` assertions
  on three TP-downgrade-paths and four preserve-critical
  scope-guards). Canary-fixtures omitted because
  `packages/benchmark/canary-run.mjs` matches only scanner and CWE
  (not severity-field) — canary-runner severity/field-assertion
  extension is queued for v0.16+ as an orthogonal capability-gap.

- **D-M-001 FixGuidance-fill on top-3 gap-scanners (Round-4
  audit-finding):** Populated structured `fix: { description,
  code?, links? }` field on the three scanner-classes identified in
  Round-4 audit section 5.3 as contributing the most
  nulls-on-high-or-above findings — `i18n-quality` (2676 null
  fix-fields pre-v0.15.4), `console-checker` (192 nulls), and
  `auth-enforcer` (183 nulls at the role-guard-missing
  emission-site; the authentication-guard-missing site already had
  fix since v0.15.2 Item-3). Eight emission-sites gain fix-field
  total — three across `i18n-quality` (accent/umlaut substitution,
  hardcoded JSX text, missing lang attribute), two across
  `console-checker` (severity-specific console.error path + general
  console-pattern path), and three across `auth-enforcer`
  (role-guard-missing, server-component-with-DB-access-missing-auth,
  middleware-missing-auth). Each fix carries an actionable
  description and where applicable a compact code-snippet (example
  pattern, not literal-framework-imports to avoid supply-chain
  phantom-dep self-match) plus canonical links to CWE/OWASP
  references. Unit-test-verified by three new failing-then-green
  tests, one per scanner, asserting `finding.fix.description` is
  truthy with keyword-match on the remediation-shape. Partial close
  of 🟠 D-M-001 — remaining 13 scanner-classes with null-fix gaps
  queued for v0.16+ extension.

### Fixed

- **D-N-004 walkFiles 2 MiB file-size cap (v0.15.4 Fertig-Patches,
  Round-4 audit-finding):** `packages/core/src/utils.ts` walkFiles
  now skips any file larger than `MAX_FILE_SIZE_BYTES` (2 MiB) via
  a `fs.statSync` check after the extension + ignore-pattern
  filters resolve. Closes Round-4 audit-finding 🟡 D-N-004 where a
  50 MB concatenated vendor bundle with a `.js` extension (slipped
  past `DEFAULT_IGNORE` because it wasn't `.min.js`-named and didn't
  live under a `Templates*/` / `third_party/` dir) took >15 s of
  scanner time on a single-file read. The 2 MiB default comfortably
  clears hand-written source (typical <100 KiB) and standard
  minified bundles (typical 100 KiB to ~1 MiB) while catching the
  vendor-mega-bundle failure mode. Stat failures are treated as
  skip (matches `readFileSafe`'s any-error-returns-null contract).
  4 new unit-tests under `walkfiles.test.ts` — oversized-file skip,
  exact-boundary inclusion, typical-source-file inclusion, and an
  ignore-pattern-precedes-size-check scope-guard.
  `MAX_FILE_SIZE_BYTES` is exported so tests and downstream
  consumers can reference the threshold rather than hardcoding it.

- **D-N-003 Scanner.isExternal classification + cold-install-UX
  banner accuracy (v0.15.4 Fertig-Patches, Round-4 audit-finding):**
  `Scanner` interface in `packages/core/src/types.ts` gains an
  optional `isExternal?: boolean` field. All 16 external-tool
  wrappers are marked `isExternal: true` at source (semgrep, bearer,
  gitleaks, trufflehog, osv-scanner, npm-audit, license-checker,
  nuclei, zap, trivy, hadolint, checkov, testssl, react-doctor,
  axe-lighthouse, lighthouse-performance), and `header-checker`
  carries an explicit `isExternal: false` to pin its classification
  against the forthcoming default-ignore default. The cold-install-UX
  banner emission path in `packages/cli/src/commands/scan.ts` now
  filters the unavailable-scanner list by `isExternal === true`
  rather than the prior `!s.available` heuristic, so internal
  stack-gated scanners are no longer mis-attributed to the
  "external scanners unavailable" bucket. Closes Round-4
  audit-finding 🟡 D-N-003 where scanning a non-Next.js project
  surfaced `header-checker` in the banner's unavailable-list and
  flipped the count between 5/16 and 6/16 depending on project
  shape; post-fix the banner count is stable at the genuine
  external-binary-absence count. The `TOTAL_EXTERNAL_TOOLS = 16`
  inline comment was also corrected — the phantom `supply-chain`
  entry (internal, reads lockfiles directly) was removed and the
  previously-omitted `license-checker` was added, preserving the
  16-count by fixing both sides of the pre-v0.15.4 arithmetic
  accident.

- **D-N-001 logging-checker empty-project skip (v0.15.4
  Fertig-Patches, Round-4 audit-finding):** `logging-checker` no
  longer fires the project-level LOG-001 "No centralized logging
  infrastructure detected" MEDIUM finding on empty projects — defined
  as directories where the scanner's walkFiles sweep returns zero
  source files under the ts/tsx/js/jsx/mjs extension set. Closes
  Round-4 audit-finding 🟡 D-N-001 where `aegis scan <empty-dir>`
  produced a spurious MEDIUM finding despite having zero source-code
  to assess. Guard is scope-minimal — a single source file with even
  a bare `console.log` is enough to take the scanner through its
  normal logger-detection path and still fire LOG-001 when no
  centralized logger is found. Two canary fixtures under
  `packages/benchmark/canary-fixtures/v0154-empty-dir-skip/` codify
  the flip (FP-empty-dir-no-log001 pre-impl-RED flips GREEN, plus
  the TP-populated-dir-still-log001 scope-guard that must stay GREEN
  both sides of the change). One new unit-test asserts
  `findings.length === 0` on empty-project scans; the existing
  flags-missing-centralized-logger test's setup was updated to seed
  a source file so the test continues to cover the has-source-but-
  no-logger path that the guard intentionally does NOT silence.

### 🔮 Multi-Version Stability Policy (new in v0.15.4)

Starting this release, every minor-release that adds a new built-in
scanner OR changes severity-assignment logic includes a **📦 Scanner
Activation — Migration Impact** (or **📦 Scanner Expansion** /
**📦 Scoring Policy**) sub-section documenting expected score-delta
classes and recommended migration actions. This closes the
CI-pipeline-operator UX-gap exposed in v0.15.2, where silent
jwt-detector activation on vendor-template-containing codebases
caused grade-regressions (A/909 → F/0 on repositories with large
`Templates*/` vendored UI starter-kits) without any forward-looking
warning in the CHANGELOG block. Retro-migration-notes for v0.15.0 /
v0.15.1 / v0.15.2 / v0.15.3 land alongside this policy (D-M-004,
Round-4 audit-finding).

The `--baseline <version>` CLI flag that would let operators defer
new-scanner activation by one minor-version is tracked as a v0.16+
capability (non-blocking — the current mechanism is
CHANGELOG-narrative guidance, the future mechanism is programmatic
opt-in).

---

## [0.15.3] — 2026-04-21 — "Credibility Patches"

Fast-hotfix driven by the 2026-04-21 Round-3 external review of
v0.15.2. Four scope-locked items close the 1 CRITICAL + 3 MAJOR + 4
MINOR findings the review surfaced — a credibility-critical Prisma
`$queryRawUnsafe()` detection-gap, the shared `.raw()` ORM sink
miss, a silent-pass regression-guard miss on `aegis diff-deps
--since=<ref>` for shape-valid-but-absent 40-hex SHAs, a
SOFT-MENTIONED transparency gap on v0.15.2's empty
`dist.attestations`, and three adversarial-bypass classes now
explicitly documented on the jwt-detector. The v0.15.2 SLSA
provenance soft-gap (pnpm@9.15.0 still swallows `--provenance`) is
NOT closed in this release — remediation is the v0.15.4 first-item.
Self-scan 1000 / A / HARDENED / 0 maintained across all commits;
canary total 98 of 98 across 11 phases; full test-suite 1945 of
1945.

### Added

- **Template-SQL-checker sink-list expansion (C-001 + M-001 from Round-3
  external review):** `CALL_SITE_REGEX` extended from
  `/\.(rpc|execute|query)\s*\(/g` to
  `/\.(rpc|execute|query|\$queryRawUnsafe|\$executeRawUnsafe|raw)\s*\(/g`
  at `packages/scanners/src/quality/template-sql-checker.ts:52`. Closes
  the credibility-critical Prisma `$queryRawUnsafe()` / `$executeRawUnsafe()`
  detection-gap plus the shared `.raw()` method across knex, mysql2,
  mongoose, sequelize. The safe Prisma sibling `$queryRaw` (tagged-template
  form) is deliberately NOT in the sink-list — the Unsafe-vs-Safe
  distinction is load-bearing for trust. 6 new canary fixtures under
  `packages/benchmark/canary-fixtures/v0153-sink-expansion/` (3 TP + 3
  FP, including the dual-guard `FP-prisma-queryRaw-safe` credibility
  test). JSDoc header and runtime scanner-description updated to list
  the expanded sinks.

- **`aegis diff-deps --since=<ref>` ref-existence-guard (M-002 from
  Round-3 external review):** `validateGitRef` now uses
  `git cat-file -t <ref>` instead of `git rev-parse --verify --quiet`.
  The rev-parse variant accepted any shape-valid 40-hex SHA as a true
  ref at exit 0 without actually resolving the object, letting bogus
  SHAs fall through to `git show` which silently produced empty content
  and rendered every dep as NEW with exit 0 — indistinguishable from
  a clean diff against a real historical ref. `cat-file -t`
  dereferences the object and exits 128 when absent. Regression-guard
  integration-test added under the invalid-ref cluster in
  `packages/cli/__tests__/diff-deps.integration.test.ts`.

### Changed

- **Self-scan config — inverse-mirror of v0.15.2 commit 56df297.** The
  v0.15.3 sink-list expansion now matches on the literal `.raw(`…${…}`)`
  documentation-comment and regex-literal inside the sibling
  `sql-concat-checker.ts` source (line 45-46). `aegis.config.json`
  grows one new suppression entry for rule `template-sql-checker` on
  file `packages/scanners/src/quality/sql-concat-checker.ts`,
  structurally identical to the existing mirror-class suppressions
  (crypto-auditor, jwt-checker, xss-checker, ssrf-checker,
  redos-checker, logging-checker, and the v0.15.2
  template-sql-checker.ts → sql-concat-checker entry). Root-cause:
  `stripComments` utility lacks regex-literal-awareness and treats the
  `"` inside a regex char-class as opening a string-mode, leaving
  subsequent comment-text visible to the scan. Second recurrence of
  this class within two cycles — proper `stripComments`
  regex-literal-tokenization refactor tracked for v0.16.

### Documentation

- **JWT-detector known-limitations expanded (M-003 from Round-3
  external review):** the JSDoc header at
  `packages/scanners/src/secrets/jwt-detector.ts` now documents three
  adversarial-bypass classes surfaced by Round-3 probe A1 (graded D):
  string-concat (`"eyJ…" + "…" + "…"` — continuous-match broken by
  quote-boundary), unicode-homoglyph prefix (fullwidth Latin small e
  U+FF45, Cyrillic е U+0435, Greek е U+03B5 — ASCII-exact regex
  cannot match), and multi-line `+`-concat (sub-class of
  string-concat, line-wrap makes single-line-continuity-requirement
  even more obviously broken). Two new FP-canary fixtures in
  `packages/benchmark/canary-fixtures/v0153-jwt-known-limitations/`
  codify the first two classes as silent-non-detection — they flip to
  RED as the canary-signal when the limitations are eventually closed.
  Scanner source (regex, scan function) unchanged. AST-pass for
  concat-reconstruction and NFKD-plus-homoglyph-folding normalization
  both tracked for v0.16.

- **v0.15.2 Infrastructure section — empty `dist.attestations`
  Known-gap bullet added (N-001 from Round-3 external review).** The
  v0.15.2 CHANGELOG describes the SLSA provenance mechanism and the
  manual-publish fallback but did not explicitly document that the
  automated publish workflow shipped with empty `dist.attestations`
  because pnpm@9.15.0 silently discarded the `--provenance` flag during
  `pnpm -r publish`. The new bullet frames this as
  workflow-path-success-minus-provenance-outcome, distinct from the
  manual-fallback case. GitHub release-body for v0.15.2 mirrored via
  `gh release edit`.

### Discipline notes

CHANGELOG-inline-per-phase (established in v0.15.2) held partially
this cycle — Items A and B landed without `## [Unreleased]` entries
because the advisor-side dispatch-specs did not include the
inline-instruction, and a retro catch-up commit (7e01351) then
populated the Unreleased section before Items C and D landed.
Acknowledged as advisor-slip in 7e01351's commit-body; remaining
Item-D commits and the release-cycle applied inline-Unreleased
on-commit.

Eager-self-scan (established in v0.15.2) held — the Item-A
template-sql-checker sink-list expansion self-matched the `.raw(`
documentation and regex-literal text inside the sibling
`sql-concat-checker.ts` source. Caught pre-release by the post-impl
self-scan gate, diagnosed as the inverse-mirror of v0.15.2 commit
56df297's stripComments-class self-match, and closed surgically via
an `aegis.config.json` suppression entry (Commit `fd9204c`). Proper
`stripComments` regex-literal-tokenization refactor is v0.16 scope.

### 📦 Scanner Expansion — Migration Impact

**Changed in v0.15.3:** `template-sql-checker` sink-list expanded
from `(rpc|execute|query)` to
`(rpc|execute|query|$queryRawUnsafe|$executeRawUnsafe|raw)`, covering
Prisma's unsafe raw-query siblings plus the shared `.raw()` method
across knex, mysql2, mongoose, and sequelize. The safe Prisma
`$queryRaw` tagged-template form is deliberately NOT in the sink-list.

**Expected impact on upgrade:** Projects using Prisma
`$queryRawUnsafe()` / `$executeRawUnsafe()` or any ORM `.raw()`
method with template-literal interpolation will see new CRITICAL
findings under the existing rule `SQLI-TMPL-NNN` (CWE-89). This is
a detection-gap closure within an existing scanner, not a new
scanner activation — the rule-id and CWE are unchanged from v0.15.2.
Because v0.15.1 auto-promotes critical-severity to blocker-tier,
each new finding forces grade F / blocked until resolved.

**Recommended migration:** Audit usage of unsafe raw-query variants.
Prisma: migrate `$queryRawUnsafe` / `$executeRawUnsafe` to the
tagged-template `$queryRaw` / `$executeRaw` siblings. Knex / mysql2
/ mongoose / sequelize: use parameterized-binding forms
(`knex.raw("? = ?", [val])`, `pool.query(sql, [val])`). For
intentional unsafe-with-trusted-source call-sites: add a file-scoped
suppression in `aegis.config.json` with an architectural reason.

---

## [0.15.2] — 2026-04-20 — "Detection Hardening"

Detection-hardening hotfix driven by the 2026-04-20 Round-2 external
review of v0.15.1. Seven scope-locked items close the credibility-
critical detection-gap the review surfaced (a crafted fixture with a
literal service-role JWT plus template-literal SQLi scanned clean at
grade A) plus the ergonomics and supply-chain gaps around fix-guidance,
path-format stability, and artifact provenance.

### Added

- **Built-in JWT-format hardcoded-credential detector** at
  `packages/scanners/src/secrets/jwt-detector.ts`. CRITICAL severity,
  rule-id `SECRET-JWT-NNN`, CWE-798, OWASP A02:2021. Regex pattern
  `eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{5,}` catches
  the canonical HS256-minimal JWT header literal plus longer shapes.
  Comment-awareness comes free by reusing the existing `stripComments`
  utility at `packages/scanners/src/ast/page-context.ts`. Five canary
  fixtures in `packages/benchmark/canary-fixtures/v0152-jwt-detector/`
  cover TP-hardcoded, TP-hardcoded-template, FP-env, FP-interpolated-
  template (documented v0.15.3 AST deferral), and FP-comment regression-
  guard. The detector ships with a canonical `FixGuidance` fix-field
  from day zero.

- **Template-literal SQL-injection detector** at
  `packages/scanners/src/quality/template-sql-checker.ts`. CRITICAL
  severity, rule-id `SQLI-TMPL-NNN`, CWE-89, OWASP A03:2021. Locates
  `.rpc(...)` / `.execute(...)` / `.query(...)` call-sites via regex,
  then walks the balanced-paren arg-span with string-aware skipping to
  detect any template-literal carrying a `${...}` interpolation. Does
  not double-fire with the older `sql-concat-checker` on plain string-
  concat SQL — explicit non-overlap contract documented in the Edge-
  static-literal-concat canary fixture.

- **`FixGuidance` canonical remediation type** on `Finding.fix`. New
  shape `{ description: string; code?: string; links?: string[] }` in
  `packages/core/src/types.ts`. Replaces the legacy bare-string `fix`
  field as the v0.15.2+ canonical form; the string arm is retained
  through v0.15.x for backward compatibility with external scanner
  consumers and slated for removal in v0.16 as an intentional breaking
  change. The terminal, HTML, and Markdown reporters render all three
  fields uniformly via a shared `normalizeFix` helper in
  `packages/reporters/src/util.ts`; the MCP-server fix-suggestion tool
  output flattens FixGuidance to its description string for MCP client-
  schema stability.

- **FixGuidance populated on ten top scanner-classes** — tenant-
  isolation-checker, auth-enforcer, csrf-checker, zod-enforcer,
  sql-concat-checker, entropy-scanner, ssrf-checker, rls-bypass-checker,
  xss-checker, and crypto-auditor. Every high-severity-or-above finding
  from these classes now carries a description, a short code snippet
  illustrating the fix, and at least the CWE-MITRE plus OWASP-Top-10
  reference URLs. The `integration.fix-guidance.test.ts` parameterized
  suite locks the contract and flips cleanly from 10-of-10 RED baseline
  to 10-of-10 green once the bulk populate lands.

- **Cold-install-UX banner** in `aegis scan`. When one or more external-
  tool wrapper scanners fail their `isAvailable` check because the
  underlying binary is not on PATH, the scan command emits a stderr-only
  diagnostic banner of the shape
  `⚠️  N/16 external scanners unavailable (...). Built-in coverage is
  partial. Install for full audit: aegis doctor (v0.15.3). See
  .github/workflows/aegis.yml for CI-ready setup.` The routing contract
  is non-negotiable stderr-only — `--format json` stdout remains a pure
  parseable payload so consumers piping to jq see no banner interference.
  The `scan-banner.test.ts` subprocess-spawn suite asserts the stdout-
  purity guarantee alongside the banner-on-stderr contract.

### Fixed

- **JSON reporter file-paths normalize to scan-root relative.** The
  Round-2 review flagged a Vercel-target scan with 25 absolute paths,
  1 relative path, and 11 no-file entries in a single output, which
  breaks PR-comment dedup across CI runners with different checkout
  locations. `packages/reporters/src/json.ts` now collapses absolute
  paths under `scanRoot` to relative form via `path.relative`, produces
  a node-standard negative-relative walk (`../outer/file.ts`) for files
  outside the scan-root, leaves already-relative paths untouched, and
  emits an explicit `"file": null` literal for project-level findings
  rather than omitting the key. The new `AuditResult.scanRoot` field
  carries the absolute project-path from the orchestrator; reporters
  fall back to `process.cwd()` when the field is absent. Terminal, HTML,
  and Markdown reporters render `(project-level)` in the file-location
  slot when the finding carries no file anchor.

- **`aegis diff-deps --since=<bogus-ref>` exits 2, not 0** (regression-
  guard coverage added). The exit-2 user-error contract has been in
  place since the v0.15 P1 landing; this release extends the integration
  suite with a fully-qualified-ref case (`refs/heads/does-not-exist`)
  and an empty-string case so a future refactor of `validateGitRef` or
  the CLI exit-code propagation cannot regress the contract silently.

### Infrastructure

- **SLSA Level-2 provenance via GitHub Actions OIDC**. New
  `.github/workflows/publish.yml` triggers on tag-push matching `v*`,
  uses `id-token: write` to obtain a GitHub OIDC attestation, and runs
  `pnpm -r publish --provenance --access public --no-git-checks`.
  Consumers can verify with `npm audit signatures` or
  `npm view @aegis-scan/<pkg>@0.15.2 dist.attestations`. Manual-publish
  fallback remains documented — a maintainer can still publish from
  their laptop if the workflow fails at release time, at the cost of
  shipping that version without provenance (documented known-gap,
  completion moves to the next release cycle).

- **Known-gap — v0.15.2 published with empty `dist.attestations`.**
  The automated publish workflow on 2026-04-20 fired correctly on
  tag-push, authenticated via OIDC, and invoked `pnpm -r publish
  --provenance --access public --no-git-checks` to publish all five
  `@aegis-scan/*@0.15.2` tarballs. Workflow concluded success. But
  pnpm@9.15.0 silently discarded the `--provenance` flag during the
  recursive-publish path — no warning, no error, no indication in
  the workflow log. `npm view @aegis-scan/cli@0.15.2 dist.attestations`
  returns empty; no SLSA Level-2 attestation is attached to any of
  the five shipped tarballs. Workflow-path-success-minus-provenance-
  outcome is the accurate framing, distinct from the manual-publish-
  fallback case described in the bullet above. Round-3 external
  review on 2026-04-21 classified this as N-001 SOFT-MENTIONED.
  Remediation is the v0.15.3 first-item — switch `publish.yml` to
  `npm publish --workspaces --provenance`, or upgrade pnpm to a
  version where the flag round-trips through the workspace-publish
  path.

### Discipline notes

Three retrospective-fix cluster rules from v0.15.0 R7 held verbatim
this cycle — `source .env.local ; npm config set ...` chain uses
semicolons not pipes so env-vars persist in the parent shell, BSD-
compatible `sed '$d'` for CHANGELOG-notes extraction, and `find -type f
| wc -l` for scaffold file-count rather than the BSD-ls-dotfile-hiding
pattern.

Two new disciplines proved out this cycle — CHANGELOG inline per-phase
(this very entry) rather than deferred to tag time, and eager self-
scan after every scanner-source or config-touching commit. The eager-
self-scan gate caught a sibling-scanner self-match on the new
`template-sql-checker.ts` source line 35 JSDoc and forced the c7
suppression before Item-2 could close prematurely.

### 📦 Scanner Activation — Migration Impact

**New in v0.15.2:** `jwt-detector` (rule `SECRET-JWT-NNN`, CWE-798,
OWASP A02) plus `template-sql-checker` (rule `SQLI-TMPL-NNN`, CWE-89,
OWASP A03).

**Expected impact on upgrade:** Projects containing hardcoded
JWT-format strings in source — including vendor-template demo-code
(e.g. dashboard-UI starter kits shipping with literal demo-tokens)
or legitimately-hardcoded tokens — will see new CRITICAL findings.
Projects using template-literal interpolation inside `.rpc()`,
`.execute()`, or `.query()` call-sites will see new CRITICAL SQLI
findings. Because v0.15.1 auto-promotes critical-severity to
blocker-tier, these findings force `grade: 'F'` and `blocked: true`
until resolved or suppressed.

**Recommended migration:** Re-scan post-upgrade and triage new
CRITICALs by source:

- **Vendor-template directories** (e.g. `Templates*/`, `third_party/`,
  vendored starter-kits with demo-tokens): v0.15.4 auto-ignores
  these via the expanded `DEFAULT_IGNORE` patterns (D-C-001). On
  v0.15.2 / v0.15.3, add the directory pattern to `ignore: [...]`
  in `aegis.config.json`.
- **env-var-loaded tokens that match the JWT regex by accident**
  (e.g. an `.env.example` with a real-shape demo value): add a
  file-scoped suppression with an architectural reason.
- **True positives** (hardcoded tokens in production source, unsafe
  template-literal SQL): migrate to environment-variable loading or
  parameterized-query patterns before the CI gate runs.

(The `Known-gap — empty dist.attestations` bullet above describes a
separate provenance concern, not a detection-behavior change — no
migration action needed beyond tracking the v0.15.3+ provenance
remediation.)

---

## [0.15.1] — 2026-04-20 — "Hotfix: Trust Fixes"

Trust-fixes driven by the 2026-04-20 external-review pass. Four
scope-locked items, no feature-expansion:

### Fixed

- **Scaffold ships with 0 npm audit vulnerabilities on day 0.** Bumped
  `vitest` in `templates/nextjs-supabase/files/package.json.tpl` from
  `^2.1.0` to `^3.1.0` to pull `esbuild >= 0.24.3`, closing
  GHSA-67mh-4wv8-2f99 (esbuild dev-server request-origin check).
  `npm audit --audit-level=moderate` on a fresh scaffold: 5 moderate
  → 0. Release-smoke now runs `npm audit` on the scaffolded project
  as a mandatory release-gate — any future transitive-CVE regression
  fails the gate before publish.

- **`severity: 'critical'` is now treated identically to `severity: 'blocker'`
  in scoring.** Prior behavior: a scan with one critical finding could
  return grade S / badge FORTRESS / `blocked: false` because only
  `blocker` hit the grade-0 path. The external review flagged this as
  a cognitive-leak — users skimming grade S would miss the critical
  finding, eroding trust when discovered. v0.15.1 expands the
  blocker-check to `['blocker', 'critical'].includes(severity)` so
  either severity forces `score: 0`, `grade: 'F'`, `blocked: true`,
  and a `blockerReason` banner in the terminal output. Scanner authors
  continue to emit whichever label fits the finding class (scanners
  currently emit both); the scoring engine unifies their treatment.

- **Scaffold CI workflow comment refreshed** for v0.13+ external-tool
  behavior. `templates/nextjs-supabase/files/.github/workflows/aegis.yml`
  had a stale v0.12-era comment claiming audit runs built-ins only;
  accurate text now describes the unified pipeline (Semgrep /
  OSV-Scanner / Gitleaks / TruffleHog auto-invoked when on PATH).

### Added

- **`@aegis-scan/mcp-server` ships with a README.** The v0.15.0 npm
  release of the MCP server landed with an empty landing page on
  npmjs.com. New `packages/mcp-server/README.md` covers: the five
  `aegis_*` tools exposed, install via `npx`, Claude Desktop config
  snippet, connect-from-other-MCP-clients guidance, and the
  thin-wrapper scope boundary relative to `@aegis-scan/core` +
  `/scanners`.

### 📦 Scoring Policy — Migration Impact

**Changed in v0.15.1:** `severity: 'critical'` now scored identically
to `severity: 'blocker'`. Any critical finding forces `score: 0`,
`grade: 'F'`, and `blocked: true`.

**Expected impact on upgrade:** Projects that previously scored A/B/C
despite pre-existing CRITICAL findings (e.g. hardcoded service-role
secrets, critical-severity XSS) now flip to F / `blocked: true` until
those findings are resolved or explicitly suppressed. This is an
intended trust-fix surfacing findings that were always there, not a
regression in detection or a new scanner activation.

**Recommended migration:** Pre-v0.15.1 grade-A projects should
re-scan after upgrade to surface any previously-masked CRITICAL
findings. For each surfaced finding, either remediate at source or
add a file-scoped suppression in `aegis.config.json` with an
architectural reason.

---

---

## [0.15.0] — 2026-04-20 — "Supply-Chain Foundation"

Three defense-in-depth features against upstream-compromise of critical
deps (Vercel/ShinyHunters incident-class). v0.15 does NOT claim
malicious-package detection — that's Socket.dev's niche. What it does:
force users to see risky version-resolution surface in their own
lockfile + package.json reviews, so a compromised publish-token cannot
silently land a malicious upstream release via caret-bumps. Cumulative
vs v0.14.0: +64 tests (1811 → 1875), +12 canaries (67 → 79), self-scan
unchanged 1000/A/HARDENED/0.

### Added

- `scanners.supplyChain.criticalDeps` config field (Zod-validated,
  strict). Declare packages whose version must be exact-pinned in
  `package.json` — no caret (`^`), tilde (`~`), comparator range, or
  `"latest"`. Empty-string entries are rejected at schema-parse time
  so a typo cannot silently disable an intended pin. Example:

  ```jsonc
  {
    "scanners": {
      "supplyChain": {
        "criticalDeps": ["next", "@supabase/ssr", "stripe"]
      }
    }
  }
  ```

- `supply-chain-scanner` emits a HIGH-severity finding with CWE-494
  ("Download of Code Without Integrity Check") for any package listed
  in `scanners.supplyChain.criticalDeps` whose `package.json` version
  is non-exact. Exact counts: `"16.0.0"`, `"=16.0.0"`, pre-release /
  build tags (`"16.0.0-rc.1"`, `"16.0.0+build.1"`), and aliased-exact
  (`"npm:other@16.0.0"`). Non-exact emits: caret (`^`), tilde (`~`),
  comparator-range (`>=`, `<`), hyphen-range (`"1.0.0 - 2.0.0"`),
  x-range (`"16.x"`), `"latest"`, `"*"`, empty string, disjunctions
  (`||`), and aliased-non-exact (`"npm:other@^16.0.0"`). CWE-494 is
  distinct from CWE-829 used by the existing wildcard-version check
  so `"latest"` cleanly fires both — the two checks surface different
  defense-in-depth concerns (unpinned-critical vs general-unpinned).

- `supply-chain-scanner` detects lockfile-drift by comparing the
  current sha256 of `package-lock.json` / `pnpm-lock.yaml` against
  a committed baseline at `.aegis/lockfile-hash`. Emits MEDIUM
  CWE-353 ("Missing Support for Integrity Check") on mismatch, INFO
  CWE-353 when a lockfile is present without a baseline (recommends
  seeding), and MEDIUM CWE-353 if the baseline itself is malformed.
  No-op for projects without a lockfile-workflow.

  Baseline format: one `sha256:<64-hex>  <filename>` per line.
  `shasum -a 256` output is directly compatible, so seeding is a
  one-liner:

  ```sh
  shasum -a 256 package-lock.json > .aegis/lockfile-hash
  # or for both:
  shasum -a 256 package-lock.json pnpm-lock.yaml > .aegis/lockfile-hash
  ```

  Blank lines and `#`-comments are parser-skipped so the file can
  carry a note about when/why it was seeded. v0.15 P1 scope is
  entry-in-baseline → disk-file comparison; silent tolerance of
  baseline-references-missing-file and disk-lockfile-not-in-baseline
  is intentional and documented as v0.16-queued polish.

- `aegis diff-deps [--since=<git-ref>]` CLI command. Compares the
  current working-tree lockfile (`package-lock.json` and/or
  `pnpm-lock.yaml`) against the version stored at a git ref
  (default `HEAD~1`). Reports added / removed deps and classifies
  version-bumps as major / minor / patch / other. Major bumps on
  packages listed in `scanners.supplyChain.criticalDeps` are flagged
  risky and drive exit code 1.

  Example CI usage:

  ```sh
  aegis diff-deps --since=origin/main --format=json
  # exit 0 → no risky changes
  # exit 1 → major bump on a criticalDep — review before merging
  # exit 2 → user-error (no lockfile, invalid ref)
  ```

  Options: `--since <ref>` (default `HEAD~1`) · `--format text|json`
  (default `text`) · `--lockfile <path>` (explicit override) ·
  `--no-color`.

  Scope bounds for v0.15 P1 (deferred to v0.15.1 / v0.16): no
  network-calls — npm-registry age-detection, postinstall-script
  sniffing, and GHSA advisory-crossref belong in a separate
  breach-check architecture. Aliased-deps / git-URL-deps / file-URL-
  deps fall through as `kind: "other"` without classification.
  Non-critical major bumps are reported but NOT flagged risky
  (risky-flagging is opt-in via `criticalDeps` config).

### Internal

- `scanners` block in `aegis.config.json` now has partial structured
  schema. Known-scanner keys (currently only `supplyChain`) validate
  strictly; unknown keys continue to pass through as
  `Record<string, unknown>` for backward-compat with v0.14 scanner
  configs that haven't been migrated (tenantIsolation, authEnforcer,
  csrf, etc.). Migration of the remaining scanners to the structured
  shape is queued for the v0.16 polish bundle.

### 📦 Scanner Activation — Migration Impact

**New in v0.15.0:** `supply-chain-scanner` with `criticalDeps`
enforcement plus lockfile-drift detection.

**Expected impact on upgrade:** Projects without exact-version pins
on declared `criticalDeps` packages will see new HIGH-severity
CWE-494 findings. Projects with a lockfile but without a seeded
`.aegis/lockfile-hash` baseline emit an INFO CWE-353 baseline-seeding
message; projects whose working-tree lockfile has drifted from the
committed baseline emit MEDIUM CWE-353 findings.

**Recommended migration:** (1) Populate
`scanners.supplyChain.criticalDeps` in `aegis.config.json` with the
dep-list your release-security-model relies on. (2) Pin each entry
to an exact version in `package.json`. (3) Seed the lockfile baseline
once via `shasum -a 256 package-lock.json > .aegis/lockfile-hash` (or
`pnpm-lock.yaml` as applicable) and commit the file. The INFO seeding
path is a one-time nudge — subsequent scans treat the baseline as
authoritative.

---

## [0.14.0] — 2026-04-19 — "Architecture-Awareness"

Broadens AEGIS scanner recognition beyond scaffold-convention to
multiple valid real-world architectures. Six dogfood-driven fixes
close systematic FP-classes discovered during content-inspection of
a user-scoped multi-tenancy production codebase. Projects can now
declare their conventions via `scanners.*` config in
`aegis.config.json`: custom boundary-columns (tenant_id / user_id /
workspace_id / organization_id), custom role-guard helpers,
non-standard middleware-file-names. SameSite-cookie awareness
downgrades csrf findings where the compensating-control is present.
Service-role finding deduplicated across scanners. Generic `.rpc()`
findings downgraded to INFO absent SQL body-parsing (deferred to
v0.15). Scaffold baseline unchanged (1000/S/FORTRESS) — v0.14 helps
existing heterogeneous codebases, not the scaffold ceiling.

### Fixed

- `auth-enforcer` accepts project-specific role-guard helpers via
  `aegis.config.json`. Projects using a custom role-guard convention
  (e.g. `requirePermission`, `assertRole`, `checkAccess`) can declare
  the names so the scanner recognises the call and suppresses the
  low-severity "missing role/authorisation guard" finding. The config
  extends, never replaces, the built-in `ROLE_GUARD_CALL_PATTERNS`
  — typos in custom-helper names cannot silently suppress recognition
  of the well-known built-ins. Example:

  ```jsonc
  {
    "scanners": {
      "authEnforcer": {
        "customRoleGuards": ["requirePermission", "assertRole"]
      }
    }
  }
  ```

  Invalid helper names (non-JS-identifier shape) are warn-logged and
  dropped, not silent-dropped — config typos remain debuggable. Custom
  helpers are matched in call-shape only (`\bname\s*\(`), so a mere
  string literal or comment containing the helper name doesn't qualify.

- `csrf-checker` now recognises `SameSite=Lax|Strict` cookie
  declarations in the project's middleware-file. When detected,
  per-route "missing CSRF protection" findings are severity-downgraded
  from `high` to `info` — SameSite already blocks cross-site mutations
  at the browser layer, so the absence of an explicit per-route CSRF
  token is pedagogy rather than an actionable high-severity gap. The
  finding itself is preserved (users remain aware; adding explicit
  tokens is still best-practice for defense-in-depth), but the score
  no longer deducts. `SameSite=None` is NOT recognized (it provides
  no cross-site protection).

- `csrf-checker` `middlewareFiles` config option allows projects using
  a non-standard middleware filename (e.g., `gateway.ts`) to be
  recognized. Defaults — `["middleware.ts", "middleware.js",
  "src/middleware.ts", "src/middleware.js"]` — match the Next.js
  convention at root and src/ level. Example:

  ```jsonc
  {
    "scanners": {
      "csrf": {
        "middlewareFiles": ["gateway.ts"]
      }
    }
  }
  ```

- `tenant-isolation-checker` accepts per-project boundary-column
  configuration via `aegis.config.json`. Projects using a multi-tenancy
  model other than the built-in six discriminants (`tenant_id` /
  `tenantId` / `workspaceId` / `teamId` / `orgId` / `organizationId`)
  can now declare their own boundary columns without being drowned in
  false-positives. Default semantics is MERGE (declared columns are
  ADDED to the built-ins); set `replaceBoundaryColumns: true` to use
  only the declared list. Invalid column names (non-SQL-identifier
  shape) are warn-logged and dropped — config typos remain debuggable
  instead of turning into silent FPs.

  Example — user-scoped multi-tenancy (rows belong to users, RLS
  policies use `auth.uid() = user_id`):

  ```jsonc
  {
    "scanners": {
      "tenantIsolation": {
        "additionalBoundaryColumns": ["user_id"]
      }
    }
  }
  ```

  With no config set, behavior is byte-identical to v0.13 — the six
  built-in discriminants only. Activation-gate, AST analysis, emit
  sites, and severity distribution are all unchanged beyond the column
  list that feeds them. Dogfood on a production user-scoped codebase
  cleared a dominant portion of tenant-isolation false-positives with
  a single line of config.

- `auth-enforcer` now recognises the Supabase-SSR route-level auth
  primitive (`supabase.auth.getUser()` / `supabase.auth.getSession()`).
  The middleware-level shape was already matched by
  `MIDDLEWARE_AUTH_PATTERNS`; this symmetric extension to
  `AUTH_GUARD_PATTERNS` covers route handlers and server components
  using the canonical `@supabase/ssr` pattern
  (`const { data: { user } } = await supabase.auth.getUser()`).
  Empirical dogfood on a real-world Next.js + Supabase production
  codebase revealed that this recognition gap dominated the
  auth-enforcer false-positive class on Supabase-SSR codebases.

### Changed

- `rls-bypass-checker` generic `.rpc()` findings downgraded from
  `medium` to `info` severity. Sensitive-named calls (matching
  `admin_*`, `delete_*`, `grant_*`, etc.) continue to emit at `high`.
  Rationale: without SQL function-body parsing, the scanner cannot
  verify whether SECURITY DEFINER functions validate caller-passed
  arguments — so flagging every `.rpc()` at `medium` over-weighted
  conservative-truth pedagogy. `info` keeps the finding visible
  (user remains aware; description now explicitly notes the
  limitation) without score-deduction. A future release may add
  SQL body-inspection to reclassify specific findings as `high`
  when verified vulnerable.

- Scanner-dedup: `tenant-isolation-checker` is now the authoritative
  emitter for `service_role`-key usage in route handlers.
  `rls-bypass-checker` previously emitted a parallel `high`-severity
  finding on the same source lines, producing ~20 duplicated findings
  per production-scale codebase. `tenant-isolation-checker` stays —
  it runs scope-aware AST analysis (v0.11.2 Part C scope-aware
  suppression) and emits at `critical` severity, which is the stronger
  signal. `rls-bypass-checker` retains its `.rpc()` SECURITY-DEFINER
  detection, which is a distinct risk class (caller-passed argument
  may bypass RLS inside the function body).

---

## [0.13.0] — 2026-04-19 — "Dogfood Precision"

Every item in this release was discovered through empirical dogfood,
not roadmap speculation: four scanner FPs surfaced during the Phase-4
exit-criterion scan and the Task-3 auth-verify trigger, one UX-bug
surfaced during retrofit-dogfood on a real production project, one
packaging ship-blocker surfaced during the v0.12 publish sequence,
and the release discipline gate codifies the lessons of the three
v0.12 publish attempts. Scaffold baseline moves from 997/A/5-MEDIUM
(v0.12.2) to **1000/S/0-BLOCKER/0-MEDIUM + 3 INFO** (v0.13.0).

### Fixed

- `header-checker` no longer flags missing `X-XSS-Protection`. The
  header is deprecated per MDN (modern browsers ignore it, legacy
  implementations carried XSS bugs) and its job is better served by
  Content-Security-Policy, which the AEGIS scaffold already sets. The
  rule therefore fired as a false-positive on every AEGIS-scaffolded
  project. Closes scaffold finding `HDR-001`.
- Scaffold empirical baseline moves 997/A/5-MEDIUM → **998/S/4-MEDIUM**
  (verified by local-build audit of a fresh `aegis new` scaffold with
  deps installed). Grade crosses the A→S boundary at 998; the
  4 remaining MEDIUM are `AUTH-001` + `SUPPLY-001..003`, all tracked
  for v0.13 follow-up work.
- `.gitignore` packaging — template source renamed to `_gitignore`;
  scaffold write-pipeline translates on emit. `npm pack` strips
  `.gitignore` from tarballs by convention, which caused v0.12.x
  scaffolds to ship without one, leading users to commit
  `node_modules/`, `.next/`, and `.env.local` secrets on first
  `git add`. Pack-install-smoke verifies the emitted scaffold now
  contains a real `.gitignore` with the expected ignore-patterns.

- `auth-enforcer` now recognises per-route auth as a compensating
  control and suppresses the middleware-missing-auth finding when
  ≥1 route handler / server component / express handler uses a
  known auth primitive (`secureApiRouteWithTenant`, `getServerSession`,
  `auth()`, `currentUser()`, layout-level guards via
  `pageIsGuardedByContext`, etc.). Closes scaffold finding `AUTH-001`.
- Scaffold empirical baseline moves 998/S/4-MEDIUM → **999/S/3-MEDIUM**
  (verified by local-build audit of a fresh `aegis new` scaffold with
  deps installed). Security category now 1000/1000. The 3 remaining
  MEDIUM are `SUPPLY-001..003` (Next.js ecosystem native binaries +
  esbuild postinstall), all tracked for the supply-chain allowlist
  work in the remaining v0.13 scope.
- Threat-model Pass-2: over-suppression regression-test confirms that
  unprotected route handlers are still flagged HIGH (CWE-306) even
  when another route's auth primitive triggers middleware suppression
  — per-route findings continue to fire independently.
- `logging-checker` `isAuthFile` now matches the auth-keyword
  (`login`/`logout`/`signin`/`signout`/`auth`/`session`/`password`)
  only against the file's own basename OR the immediate parent
  directory segment — never an ancestor further up the tree. The
  previous regex `/\/(?:login|logout|…)\b.*\.(ts|js)$/` matched any
  ancestor segment, so monorepo files like `auth-service/admin/errors.ts`
  or a scratch path under `/tmp/auth-verify/` produced phantom
  LOG-001/002/003 findings on files that have nothing to do with
  authentication. The new matcher is case-insensitive and normalises
  Windows-style backslashes; word-boundary `\b` after the keyword
  rejects coincidental prefixes (`authentication.ts`, `authors.ts`).
  Dogfood-discovered during Task-3 verification when the scratch
  directory name alone caused three spurious findings on scaffold
  lib files. Regression-tests pin both positive (`auth.ts`,
  `api/auth/route.ts`, camelCase `signIn.ts`) and negative
  (ancestor-only, FP-class) cases.
- `aegis init` now detects whether the target project has `husky`
  installed (dep + `prepare` script referencing husky) before writing
  `.husky/pre-push`. When the signals are absent the hook is skipped
  and init emits an actionable three-step hint (`pnpm add -D husky` →
  `pnpm exec husky init` → re-run). Pre-v0.13 init blind-wrote the
  hook on every project; the file sat as dead-code because git's
  default `core.hooksPath` is `.git/hooks/` and husky's `prepare`
  script is what redirects it. Retrofit-dogfood on a real
  production target (no husky configured) empirically confirmed
  the prior behavior produced false-confidence. `--force` does
  NOT bypass the
  precondition — writing dead-code with an override flag is still
  silent-bad. Users on non-standard setups (yarn-pnp, custom
  hooksPath) can skip the gate via `--skip-husky` and wire their
  own hook. Closes retrofit-dogfood finding N1.

### Added

- `scripts/release-smoke.sh` + `pnpm release:smoke` npm-script — a
  mandatory pre-publish installability gate. Packs all 5 packages,
  extracts the `cli` tarball to verify `templates/` bundling and
  absence of `workspace:*` protocol leaks in the published `package.json`,
  scratch-installs the tarballs into a clean `node_modules`, then runs
  `aegis new` and verifies the emitted scaffold has a real `.gitignore`,
  zero unsubstituted `{{placeholders}}`, and zero `.tpl` leftovers.
  Would have caught all three publish-breakages during v0.12. Now
  documented as step 6 of the release sequence in `docs/release.md`.

### Changed

- Template manifest schema now accepts `S` for `scanExpectedGrade`
  (in addition to A-F), matching the `Grade` enum exported by
  `@aegis-scan/core` (where `S` is emitted for score ≥ 950 with
  confidence `high`). Schema-forward-compat only — no template.json
  data update yet; the nextjs-supabase template's declared
  `scanExpectedScore`/`scanExpectedGrade` will be re-measured
  against the packaged v0.13 tarball and advanced before tag-cut.
- `supply-chain` scanner now emits ecosystem-inherent findings at
  `info` severity instead of `medium`. Covered patterns:
  `esbuild` (postinstall), `@next/swc-*` (platform-native compiler),
  `@rollup/rollup-*` (platform-native bundler). Findings remain
  visible in the report for pedagogy — the user should know their
  real supply-chain surface — but the `info` severity is score-neutral
  (zero base deduction per `scoring.ts`), so these unavoidable patterns
  no longer drag the scaffold baseline below 1000. Trust-root: each
  pattern is anchored to an npm scope owned by a specific upstream
  vendor, so attackers cannot match without first compromising
  registry-level scope ownership. Threat-model regression-test pins
  that non-ecosystem packages with postinstall or native binaries
  continue to emit at `medium`. Closes scaffold findings
  `SUPPLY-001..003`.
- Scaffold empirical baseline moves 999/S/3-MEDIUM → **1000/S/0-MEDIUM**
  (3 INFO findings remain visible). Score category: `security` +
  `dependencies` both at 1000/1000.

---

## [0.12.2] — 2026-04-19 — "templates-bundling hotfix"

### Fixed

- Published v0.12.1 shipped `@aegis-scan/cli` with `files: ["dist",
  "README.md"]` — the repo-root `templates/` directory was NOT bundled
  into the cli tarball. Users running `aegis new <name>` after
  `npm install @aegis-scan/cli@0.12.1` hit `Error: template
  "nextjs-supabase" not found. Tried: node_modules/@aegis-scan/cli/templates/…`.
- Root cause was flagged during Task 5a Pass-1 ("packaging gap") and
  deferred to "Phase 6/7" — the deferral slipped through all Phase-8
  release-gates because Phase-6 smoke-test only exercised the local
  dev-build path (`node packages/cli/dist/index.js new …`) where the
  template-resolver's monorepo-fallback candidate finds repo-root
  `templates/`. The published-package path hits the `<cli-root>/templates/`
  primary candidate, which was missing.
- Fix: new `packages/cli/scripts/copy-templates.cjs` prepack hook copies
  repo-root `templates/` → `packages/cli/templates/` at pack time.
  `packages/cli/package.json` `files` field extended to include
  `templates`. `packages/cli/templates/` is gitignored (staged copy, not
  source-of-truth).

### New release-gate — `pre-publish installability smoke-test`

The v0.12.0 workspace:* bug + v0.12.1 missing-templates bug were both
caught by the SAME missing release-gate: real `npm install` from packed
tarball into a scratch directory followed by the primary user-facing
command (`aegis new`). Every future release MUST run this before
`pnpm -r publish`:

```bash
pnpm pack (for each package → /tmp/pack-test/)
cd /tmp/pack-test/smoke && npm init -y
npm install /tmp/pack-test/aegis-scan-{core,scanners,reporters,cli}-*.tgz
npx aegis new test-app --skip-install
# must succeed + generate scaffold dir
```

### Action required

- npm `latest` reverted to 0.11.2 during this hotfix window; advances to
  0.12.2 post-publish.
- Both v0.12.0 and v0.12.1 are deprecated. Any consumer pinned to either
  must upgrade to v0.12.2.

---

## [0.12.1] — 2026-04-19 — "workspace: protocol hotfix"

### Fixed

- Published v0.12.0 shipped literal `workspace:*` protocol strings in the
  internal dependencies of `@aegis-scan/{scanners,reporters,cli,mcp-server}`,
  causing `EUNSUPPORTEDPROTOCOL` on any `npm install`. Root cause: the
  Phase-8 publish sequence used `npm publish` per-directory, which does not
  rewrite the pnpm-specific `workspace:*` protocol at pack-time. v0.12.1
  republishes via `pnpm -r publish`, which rewrites `workspace:*` to the
  concrete `^0.12.1` version specifiers expected by npm.

### Action required

- The npm `latest` dist-tag was reverted to `0.11.2` during the hotfix
  window so that unpinned installs did not hit the broken 0.12.0. After
  0.12.1 publishes, `latest` advances to `0.12.1`.
- v0.12.0 is deprecated on npm. Any consumer pinned to `0.12.0` must
  upgrade to `0.12.1`.
- No source / scanner / template changes vs 0.12.0. The fix lives entirely
  in the publish tooling + packed dependency specifiers.

---

## [0.12.0] — 2026-04-19 — "Scaffolding Pivot"

**Honest score:** **8.9** (up from 8.8 at v0.11.2). First scope-pivot
release: AEGIS adds project-lifecycle commands (`aegis new`, `aegis
init`) and ships a Next.js + Supabase starter template with 11 security
primitives, RLS bootstrap migration, strict PR-gate workflow, and
AI-safety rules pre-wired from commit 0. Scanner layer unchanged —
corpus scores stable; the bump is a capability addition, not precision
tuning.

**Canary tally:** 67/67 unchanged across 4 phases (template work does
not affect scanner canaries).

**Full test suite:** 1518 → **1567** (+49: 14 Phase-1 template-machinery
tests + 22 `aegis new` tests + 13 `aegis init` tests). Main-suite
regression-free. Benchmark 30/30 unchanged. Self-scan 1000/A/0.

**Real-world corpus (8 projects):** strictly unchanged vs v0.11.2 —
no scanner changes in v0.12.

**Scaffold baseline:** a fresh `aegis new` scaffold scores **997/A
HARDENED, 5 MEDIUM, 0 BLOCKER** (empirically verified end-to-end via
`npm install` + `aegis scan`). The 5 baseline findings are documented
in the scaffold's own README under "Known baseline findings" — pedagogy,
not suppression:

- `AUTH-001` (middleware.ts) — template uses per-route auth via
  `secureApiRouteWithTenant`, not middleware-level auth. Scanner FP.
- `HDR-001` (next.config.ts) — deprecated `X-XSS-Protection` header
  check; the scaffold's Content-Security-Policy supersedes it. Scanner
  FP.
- `SUPPLY-001/002/003` — Next.js ecosystem inherent (`esbuild`
  postinstall + `@next/swc` + `@rollup` native binaries). Unavoidable
  without replacing Next.js.

All three scanner-FP classes are scheduled for v0.13 scanner-fixes.

### Added — project-lifecycle commands

**`aegis new <name>` — scaffold generator.**

Generates a new Next.js + Supabase project from the bundled
`nextjs-supabase` template. Applies `{{PLACEHOLDER}}` substitution
(`PROJECT_NAME`, `AEGIS_VERSION`), strips `.tpl` suffixes, runs
`npm install` + `aegis scan` as a post-install verification, and
reports the measured score against the template's declared
`scanExpectedScore`. Options: `--template <name>`, `--target <dir>`,
`--skip-install`, `--skip-scan`. Name validation
(`^[a-z][a-z0-9-]*$`, max 64 chars, reserved-names rejected)
prevents path-traversal. Multi-template ready — the `--template`
flag + candidate-chain resolver support future `templates/<stack>/`
additions in v0.14+ without CLI rewrite. Partial-write-on-failure
cleans up mid-scaffold state so an interrupted run leaves the target
dir empty (when it was empty to begin with) rather than partially
populated.

**`aegis init` — retrofit extension.**

Extends the pre-existing `aegis init` (which generates
`aegis.config.json`) with three onboarding files: the PR-gate
workflow, `CLAUDE.md`, and a husky pre-push hook. Skip-if-exists by
default — user files are never silently clobbered. Per-file skip
flags (`--skip-ci`, `--skip-claude`, `--skip-husky`) and a repo-wide
`--force` to overwrite. Partial-write policy: the command modifies
the user's project, so it never rolls back successful writes.
CI-friendly (non-interactive).

### Added — template + infrastructure

- **11 clean-room security primitives** at
  `templates/nextjs-supabase/files/lib/`: safe-fetch (SSRF-safe),
  crypto (AES-256-GCM + timing-safe compare), rate-limit
  (X-Forwarded-For-aware + in-memory limiter), input validation
  (UUID + `sanitizeString` + `escapePostgrestLike`), `requireRole`
  + `requireRoleOrSelf` + `isManager`, AppError hierarchy. Plus
  extracted-and-scrubbed: Zod-strict schema wrapper, tenant-guard
  (`secureApiRouteWithTenant`), Supabase server-client, CSRF + 9
  security headers + rate-limit middleware, PII-sanitizing logger
  (50+ redaction patterns).
- **RLS bootstrap migration**
  (`supabase/migrations/0000_rls_bootstrap.sql`): `tenants` +
  `profiles` tables with strict RLS policies + auto-profile-on-signup
  trigger.
- **Exemplary API route** (`app/api/example/[id]/route.ts`, 59 LoC)
  — composes all 6 primitives (tenant-guard, require-role,
  `isValidUUID`, Zod-strict, logger, Supabase reuse) with correct
  error-mapping pattern (`ForbiddenError` → 403, `ZodError` /
  `SyntaxError` → 400).
- **PR-gate GitHub Action workflow**
  (`templates/nextjs-supabase/files/.github/workflows/aegis.yml`):
  `mode: audit` + pinned external-tool pre-installs (Semgrep 1.94.0,
  OSV-Scanner v1.9.2, Gitleaks v8.19.0, TruffleHog v3.82.0) with
  SHA-256 checksum verification. Python 3.11 for Semgrep-classifier
  compatibility. Permissions scoped minimum: `contents: read` +
  `pull-requests: write`.
- **Template-machinery** at `packages/cli/src/template/`: Zod-strict
  manifest schema (semver `aegisVersion` + placeholder regex +
  strict `postInstall`), loader with file enumeration,
  placeholder-substitution utility. Enables future templates without
  CLI rewrite.
- **AI-safety rules template** (`CLAUDE.md`) — project instructions
  for AI assistants, templated with `PROJECT_NAME` + `AEGIS_VERSION`.

### Deferred to v0.13

Dogfood-discovered from the Phase-4 exit-criterion scan of the fresh
scaffold — three scanner improvements that each prevent the scaffold
from reaching `1000/A/0`:

1. `auth-enforcer` — recognize auth-per-route pattern (middleware
   that delegates auth to route handlers via
   `secureApiRouteWithTenant` is currently flagged as "missing auth
   pattern").
2. `header-checker` — remove `X-XSS-Protection` rule (MDN-deprecated;
   modern Content-Security-Policy supersedes it).
3. `supply-chain` — Next.js-ecosystem allowlist for `@next/swc`,
   `@rollup` native binaries and `esbuild` postinstall scripts.

v0.13 is also the dedicated **pipeline-orchestration** release:
`aegis install` + unified finding-normalization across the 16
external tools + confidence-merge layer. The scaffold's pre-installed
external tools become integrated into `aegis audit` at v0.13 (today
they install successfully but are not invoked by audit — the scaffold
is forward-compat).

---

## [0.11.2] — 2026-04-18 — "Dogfood-Driven Precision Part 2"

**Honest score:** **8.8** (up from 8.7 at v0.11.1). Patch release
continuing the v0.11.1 dogfood theme — the post-v0.11.1 scan of the
same real-world Next.js+Supabase project surfaced a single remaining
FP class (`tenant-isolation-checker` service_role over-emission) that
analysis revealed to contain TWO orthogonal bugs plus the originally-
scoped scope-aware suppression concern. All three sub-parts ship with
canary-pinned RED → GREEN transitions.

**Canary tally:** `phase3-v011x-dogfood` grows 29/29 → **40/40** (+11
Part C canaries: 4 FP pinning the happy-path / two-step destructure /
compound `[org]/[slug]` route / different-field `.eq('id', slug)`
shapes; 7 TP pinning the N-C-1..N-C-6 + N-C-10 regression negatives).
`phase1` + `phase2a` + `phase2b` unchanged at 27/27.

**Full test suite:** 1504 → **1518** (+14 Part C tests: T7-T17
mirrors + 3 internal helper cases for file-level scope + arrow-handler
recognition + helper-only false-suppression guard). Benchmark 30/30
unchanged. Self-scan 1000/A/0.

**Real-world corpus (8 projects):** `|Δ|` max = **0 points**, 0 grade
shifts. Part C suppression is intentionally narrow — the URL-param
binding-origin check only fires on a specific route-handler AST shape,
so broad real-world scans show strictly unchanged scores. The dogfood
project itself is the only beneficiary, with its remaining 8
`tenant-isolation-checker` FPs dropping to 0.

### Fixed — 3 empirical FP classes

**Bug X — `tenant-isolation-checker` comment-prose suppression (Part A, commit `33f0ccc`).**

The Day-0 `/service_role/gi` regex fired on comment prose describing
WHY the admin-helper is used, e.g. `// service_role: public endpoint,
no user session`. Devs could "fix" findings by removing their
architecture-decision comments — a worst-case signal inversion where
documenting intent increased noise.

Fix: `stripComments` from v0.11.1's `ast/page-context.ts` is now
applied before the regex scan. String literals (`'service_role'` as
value) and env-var names (`SUPABASE_SERVICE_ROLE_KEY`) survive
stripping and still fire — canary T3 regression-pins this.

**Bug Y — `tenant-isolation-checker` recall widening (Part B, commit `48c24a6`).**

The same Day-0 regex missed the dominant real-world shape: a route
using a `createAdminSupabaseClient()` helper with no literal
"service_role" text in the file. Files that used the helper without
descriptive comments were silently ignored — the inverse FP where
removing comments REDUCED detection signal.

Fix: pattern-set expansion from a single regex to a 4-entry set
covering (a) literal / env-var text, (b) `create(Admin|ServiceRole|ServerService)(Supabase)?Client`
helper names, (c) `getServiceClient` / (d) `getAdminClient` alt
conventions. Per-line dedup prevents double-emit when helper-call and
env-var sit on adjacent tokens. `SUPABASE_SIGNAL` activation gate also
widened so files using only the helper activate the scanner.

**Scope-aware service_role suppression (Part C, commit `fee7bdd`).**

The remaining FP class: a route correctly scoped by a URL-parameter
`.eq()` with a service_role helper should not emit a critical
tenant-isolation finding. Pure lexical name-match risks a catastrophic
mis-suppression on body-shadow patterns (`const { slug } = await req.json()`),
so the implementation uses **binding-origin tracking** — a URL-param
binding is a declaration whose initializer traces back (via a fixed-
point propagation) to `await params` / `params.<X>`, not mere name
collision.

Suppression fires file-level when EVERY exported handler in the route
file is safe-scoped: every `.from(...)` chain has ≥1 `.eq(<col>, <arg>)`
where `<arg>` resolves (by lexical scope) to a URL-param declaration,
AND the handler body has 0 write calls (`.insert/.update/.delete/.upsert`
on a `supabase.from(…)` chain). Any single unscoped chain OR any write
defeats the file-level scoping and emits normally. The `.from()`-per-
call URL-param check also runs independently: T13 (scoped read
followed by an unscoped audit-write) keeps its read-chain suppressed
while the write-chain still emits.

Negative canary matrix — each edge-case explicitly pinned in scanner
JSDoc (Flag-1 pattern):
  - **N-C-1** (T9): service_role + no `.eq()`         → emit
  - **N-C-2** (T10): `.eq('slug', body.slug)`         → emit
  - **N-C-3** (T11): `.eq` arg via `normalize(slug)`  → emit
  - **N-C-4** (T12): `.eq` arg hardcoded literal      → emit
  - **N-C-5** (T13): scoped read + unscoped write     → emit
  - **N-C-6** (T14): two `.from()`, second unscoped   → emit
  - **N-C-10** (T17): body-shadow same-name via binding-origin → emit

### Known limitations (deferred to v0.12)

  - **N-C-7**: RLS-permissive table policy (`CREATE POLICY allow_all USING (true)`)
    — structurally scoped but functionally unguarded. Detection
    requires migration-file cross-reference.
  - **N-C-8**: Compound-route strict all-segments matching — current
    MVP accepts ANY URL-param `.eq` as sufficient for a compound route
    (`[org]/[slug]`), not EACH segment matched.
  - **N-C-9**: Query-builder variable with mid-chain conditional
    scoping (`let q = supabase.from(...); if (cond) q = q.eq(...); return q`).
  - Ctx-style signature `(req, ctx: { params: ... })` not yet
    recognised; only `{ params }` / `{ params: { … } }` destructure in
    the 2nd parameter triggers the URL-param analysis.

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
