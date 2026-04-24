# Changelog

All notable changes to `@aegis-wizard/cli` are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The
wizard package uses SemVer; each minor-version may add new wizard
questions, brief-sections, or pattern bodies. Release cadence is driven
by dogfood-audit + recon-report findings, not by a fixed schedule.

---

## [0.17.3] — 2026-04-24 — "consistency-polish + M2-closure + scanner-gitignore-awareness"

### Fixed (external audit v0.17.2 closures)

- **M (H3 partial-regression)** — `{{LOCALE_PREFIX}}` placeholder now threads through Phase 5 prose (steps 1, 2, 3) via the existing `substitute()` chain in `generator.ts`. Integration-test spans all 3 claim surfaces (pattern body, Phase 5 prose, gate-invocation) × both `i18n_strategy` values (`url-prefix`, `none`), per advisor memory `feedback_consistency_fix_test_scope.md`. Closes the "consistent across pattern + prose + gate" sub-claim under both strategies. The gate-script's `IMPRESSUM_PATH` default stays `[locale]/` (wizard default), with an explicit-arg escape-hatch documented in the fixture + embedded-script comment for non-i18n scaffolds. (audit-finding M)
- **L (prod-check-doc in tarball)** — `docs/security/prod-check-2026-04-23.md` now ships inside the npm tarball at `package/dist/docs/security/`. `scripts/copy-wizard-assets.mjs` extends to copy `docs/security/*.md` at build time alongside the existing pattern-copy step. External consumers verify the v0.17.1 D-OTH-01 + D-OTH-02 dev-only closures directly from the published artifact (no GitHub visit required). (audit-finding L)
- **L (pedagogical literal)** — `logger-pii-safe.md` replaces `api_key: 'sk_live_abc123'` with `'sk_live_EXAMPLE'` (+ matching redact-example `sk***LE`). External gitleaks (run without our `.gitleaks.toml`) no longer matches the generic-api-key rule on the tarball. Pedagogy preserved via explicit placeholder convention, consistent with SC-8 Class-3b discipline. (audit-finding L)
- **L (SBOM comment-reality)** — `scripts/generate-sbom.sh` comment now documents that cdxgen 12.1.x outputs CycloneDX 1.6 while 12.2+ outputs 1.7; the script is a thin wrapper and cdxgen's own version selects the spec. On Renovate-driven cdxgen bumps (post-14d-cooldown), the emitted specVersion auto-updates. (audit-finding L)
- **L (commit-count framing)** — canonical template adopted for Meta + tag-message: "N total atomic commits (X + Y + this version-bump)". v0.17.2 artifacts are frozen (tag already shipped); v0.17.3 + future releases follow this convention. (audit-finding L)

### Changed (structural)

- **Scanner `walkFiles` honors `.gitignore`** — `packages/core/src/utils.ts::walkFiles()` now loads `.gitignore` at the root-dir via the `ignore` npm package (kaelzhang, ~900k weekly downloads, gitignore(5)-spec compliant, ~20KB) and composes with any child `.gitignore` files encountered during the walk. Negation rules (`!pattern`), directory-only patterns (`pattern/`), and anchored patterns (`/pattern`) all handled by the library per spec. New fourth parameter `opts.respectGitignore` defaults to `true`; scanner-internal tests that need full walks regardless (benchmark canary-fixtures) can opt out via `{ respectGitignore: false }`. Backward-compat: all 59 existing `walkFiles` call-sites stay 3-arg shape. Closes the v0.17.2 dogfood-paradox where parallel-session operator-local work in gitignored trees polluted self-scan output. The v0.17.2 r3 path-filter at §6 gate-formula becomes vestigial; returns to natural total-count metric.

### Added (i18n infrastructure — M2 closure)

- **DE phase-body-prose i18n** — `build_order.phase_N_body` keys (phases 1-10) added to both `en.json` and `de.json` as string-arrays for translator ergonomics. New `getMessageArray()` helper in `src/brief/i18n/index.ts` mirrors `getMessage()` fallback semantics. `renderBuildOrder` in `src/brief/sections.ts` threads through `getMessageArray` + replaces the `{GATE}` literal marker per-line (not a UPPER_SNAKE `substitute()`-placeholder). DE brief no longer leaks hardcoded English phase-body prose. Code snippets + file paths + command names stay language-agnostic per README `--lang=de` scope. (closes v0.17.2 deferred M2)

### Changed (CI — Node-24 migration Sub-arc A)

- **13 SHA-pinned action bumps** across non-publish workflows prepare for Node-20 runner deprecation on 2026-06-02:
  - `actions/checkout` v4.3.1 → v6.0.2 (6 files: ci, codeql, gitleaks, npm-version-watch, release, scorecard)
  - `actions/setup-node` v4.4.0 → v6.4.0 (3 files: ci, npm-version-watch, release)
  - `github/codeql-action` v3.28.1 → v4.35.2 (4 sub-actions: init, autobuild, analyze, upload-sarif across codeql.yml + scorecard.yml)
  - `pnpm/action-setup` comment-fix v4.3.0 → v5.0.0 (ci.yml; SHA was already on v5 at initial pinning per plan-doc §5.3 — doc-rot repair)
- All SHA-pin-policy preserved (25/25 PINNED pre + post). As a byproduct this also resolves the pre-existing doc-rot where 4 files carried a stale `v5.0.1` comment on the actual `v4.3.1` checkout SHA. Sub-arc B (3 publish-workflow bumps + 3 pnpm comment-fixes) remains deferred to a separate maintainer-GO cycle before the 2026-06-02 deadline.

### Deferred (planned for v0.17.4 / v0.18 / v0.2 skills-arc)

- **Cookie-banner + login-form i18n rewrite** (carried from v0.17.1 + v0.17.2 §9) — ~5-10 pattern-files + dedicated i18n-pass arc
- **Composed-middleware-with-next-intl recipe** (v0.2 skills-arc first defensive skill)
- **Generator-side conditional-emit for optional pattern-fields** (`{{#if FIELD}}…{{/if}}` template construct, v0.18 candidate)
- **Phase-ordering review** (audit v0.17.1 L9 deeper, v0.18 candidate)
- **`tsc removeComments: true`** for published artifacts (trade-off review, v0.18 candidate)
- **Node-24 migration Sub-arc B** (6 publish-workflow SHA-bumps + 3 pnpm comment-fixes, separate maintainer-GO cycle before 2026-06-02)
- **gitleaks-action PR #207 checkpoint** (2026-05-15 — if upstream PR still unmerged, pivot to bash + gitleaks-binary invocation per plan-doc §4.3 Option C)
- **OIDC Trusted Publishers** (v0.18 fortress item, G-16)
- **cosign tarball-signing** (v0.2 supply-chain hardening, 2nd attestation layer)
- **SBOM-as-GitHub-Release-asset** (v0.2 supply-chain candidate)
- **OpenSSF Best Practices Badge** (v1.0 stretch)
- **Threat model doc** (`docs/security/THREAT-MODEL.md`, v0.18)

### Meta

- Triggered by independent external audit of `@aegis-wizard/cli@0.17.2` (2026-04-24, `~/aegis-wizard-v0172-audit/AUDIT-V0172.md`). Verdict: SHIP-WITH-CAVEATS, 0 critical, 0 high, 1 medium, 4 low — 72% reduction from v0.17.1's 18 findings. All 5 closed in this cycle + M2 deferred-closure + structural scanner-gitignore-awareness + Node-24 Sub-arc A. Self-scan: `1000/S/0 FORTRESS` preserved; now achieved via natural scanner-gitignore-awareness instead of the v0.17.2 r3 path-filter workaround.
- **11 total atomic commits on the v0.17.3 arc** (1 scanner-structural SC-1 + 5 audit-fix B1-B5 + 4 Node-24 SHA-bumps SC-2.1-2.4 + this version-bump B6). Closes audit v0.17.2 M + L×4 + v0.17.2-deferred M2 + v0.17.2-B1-checkpoint-queued scanner-gitignore + Node-24 Sub-arc A.

---

## [0.17.2] — 2026-04-24 — "post-audit fortress-completion"

### Fixed (external audit closures)

- **H1** — `auth-supabase-full` pattern body no longer recommends `shadcn add … form …`. The v0.17.1 fix removed `form` from the primary install block but missed the auth-pattern's own install line. (audit-finding H1)
- **H2** — `i18n-next-intl` pattern aligned with Next.js 16 `proxy.ts` / `export function proxy` idiom. The v0.17.1 commit-5 rename missed this pattern body. Added illustrative-only warning that the canonical composition recipe ships in v0.2 (`middleware-next-intl-compose` skill). (audit-finding H2)
- **H3** — Legal-pages pattern body file-section headings now use `{{LOCALE_PREFIX}}` placeholder so the path is consistent across pattern body, Phase 5 prose, and the Impressum gate-script default (all three previously disagreed on flat vs `[locale]/`-prefixed paths). (audit-finding H3)
- **M1** — Impressum gate detects empty-placeholder broken HTML (`<a href="mailto:"></a>`, empty `href=""`, naked `<p></p>`) that the previous `grep "{{"` gate passed vacuously when optional config-fields were unset. (audit-finding M1)
- **M3 + L8** — `aegis_version` schema now requires strict semver (`/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/` with `$` anchor); brief-generator overrides any user-supplied value with `readSelfVersion()` (the actual running CLI version) and warns to stderr on mismatch. The provenance-header in the brief no longer lies. (audit-findings M3 + L8)
- **M4** — Impressum gate fixture script and the script embedded in `legal-pages-de.md` are now byte-identical (single source-of-truth). Errors route to stderr and variable names match; a new byte-equality test catches future drift at CI-time. (audit-finding M4)
- **M5** — Impressum gate `1-Anschrift` regex now matches non-Straße street suffixes (`-weg`, `-allee`, `-platz`, `-ring`, `-chaussee`, `-damm`, `-pfad`, `-ufer`). False-negative on a minimal sole-proprietor Impressum with `-weg` address closed. (audit-finding M5)
- **L6** — Phase 1 Installation drops the redundant `--disable-git` flag from the `create-next-app` invocation. The next line was already re-initializing git manually; the flag was a no-op. (audit-finding L6)

### Added (security infrastructure — supply-chain-hardening arc)

- **`pnpm.onlyBuiltDependencies = []`** — explicit deny-all postinstall scripts in transitive deps. Closes the Lottie Player Oct-2024 npm-hijack class.
- **CI gate: SHA-pin enforcement on GitHub Actions** — `scripts/check-gha-sha-pin.sh` parses `.github/workflows/*.yml` and fails on any bare-tag reference (e.g. `@v3`). Closes the tj-actions/changed-files March-2025 tag-rewrite class.
- **CI gate: dependency cooldown lint** — `scripts/check-dep-cooldown.sh` enforces a 7-day cooldown (default) / 14-day cooldown (critical-deps allowlist) on every direct dep. Closes the eslint-config-prettier July-2025 rushed-update window class.
- **Publish-time gate: manifest-confusion check** — `scripts/check-manifest-confusion.mjs` proves the published tarball's `package.json` matches the source on 12 security-critical fields (deps, scripts, bin, etc.). Closes the Darcy Clarke June-2024 disclosure class.
- **Renovate config** — `.github/renovate.json5` enforces 7d / 14d cooldowns at PR-creation time, tiered automerge (patch auto, minor manual, major explicit), SHA-pin Actions, vuln-alerts override cooldown.
- **CycloneDX SBOM in publish workflows** — `scripts/generate-sbom.sh` emits `sbom.cdx.json` per package. Embedded in tarball via `files`-array. Complements SLSA v1 provenance: provenance proves WHO built it, SBOM proves WHAT is in it.
- **CI gate: dist/ planning-artifact leak check** — `scripts/check-dist-codename-leak.sh` catches the narrow class of internal planning-shorthand (`recon §N`, `recon-report FN`, `dispatch-brief commit N`, `dogfood §N`) riding from source-comments into the built `dist/*.js`. Closes audit L1.

### Changed (security infrastructure)

- Publish-flow ordering: SBOM generation now runs BEFORE tarball-pack so the verified tarball is the published tarball (closes advisor pre-merge Concern-1 on the supply-chain arc).
- `@cyclonedx/cdxgen` pinned at `12.1.4` in root `devDependencies` (exact pin, not `^12.2.0`); `pnpm exec cdxgen` replaces `pnpm dlx` so cooldown-lint covers it (closes advisor pre-merge Concern-2). Exact pin chosen at commit-time because the semver-caret-range would have resolved to 12.2.0 which was only 6 days old and below the 14-day critical-dep cooldown threshold.
- `.gitleaks.toml` migrated to `[[allowlists]]` array-of-tables with 5 entries covering structural false-positive classes: snailsploit-fork byte-identical upstream content (preserved); scanner own test-fixtures; benchmark canary-fixtures; the PII-safe-logger pedagogical doc; and one regex-suppression for a historic-commit literal placeholder.

### Documentation

- Ships `docs/security/prod-check-2026-04-23.md` with verbatim curl-output evidence for the v0.17.1 dev-only closures on the intl-handled security-headers and `/api/admin/*` 401-not-404 observations (audit H4 — closes the unsupported-claim gap).
- README adds `-f, --force` to the Flags table (L2), absolute github.com URL for the pattern-catalog link (L3), root-CHANGELOG pointer to the per-package wizard-cli CHANGELOG (L4), `--lang=en` coverage caveat for the still-German cookie-banner / AGB / datenschutz-admin labels (L5), brief-filename-derivation note explaining the `project_name`-vs-positional-arg semantics (L7), and a Phase-2-gate-with-custom-SMTP note covering the dev-vs-prod email-delivery ordering (L9).

### Deferred (planned for v0.17.3 or v0.2 skills-arc)

- **DE phase-step prose i18n** (audit M2) — `renderBuildOrder`, `renderInstallation`, etc. emit hardcoded English strings even with `--lang=de`. Bundle with the already-deferred cookie-banner + login-form i18n rewrite as a dedicated i18n-pass arc.
- **Cookie-banner + login-form i18n rewrite** (carried from v0.17.1 deferred block).
- **Composed-middleware-with-next-intl recipe** as the first defensive skill in v0.2 (`middleware-next-intl-compose`).
- **Generator-side conditional-emit for optional pattern-fields** (`{{#if FIELD}}…{{/if}}` template construct) — would move the M1 fix from a runtime gate to a generation-time guarantee.
- **Phase-ordering review** — Phase 2 email-gate vs Phase 9 SMTP env-vars (audit L9 deeper analysis).
- **`tsc removeComments: true` for published artifacts** — would strip all dist/ comments + reduce tarball size; trade-off review pending.

### Meta

- Triggered by an independent external audit of `@aegis-wizard/cli@0.17.1` (2026-04-23). Verdict: SHIP-WITH-CAVEATS, 0 critical, 4 high, 5 medium, 9 low — all addressable in a single follow-up cycle. The auditor verified 17 already-good claims (SLSA provenance genuine, zero eval/exec/network/postinstall, schema refines fire correctly, 264/264 tests green, pattern bodies tsc-clean on Next.js 16, tarball clean). v0.17.2 closes **17 of 18 findings** (10 via code-fix + 7 via documentation-only updates) and ships the supply-chain-hardening arc. **1 audit-finding deferred (M2 — DE phase-prose i18n);** the Deferred block also lists 5 future-candidate items beyond audit scope (cookie-banner i18n rewrite, composed-middleware-with-next-intl recipe, generator-side conditional-emit, phase-ordering review, `tsc removeComments`).
- Supply-chain-hardening arc adds a 7-layer defense pyramid (human review → pre-commit → pre-push → pre-publish → publish-time → post-publish → end-user-side) closing 6 named real-world threat-classes (xz-utils long-game, eslint-config-prettier token-leak, tj-actions tag-rewrite, Lottie Player postinstall, Darcy Clarke manifest-confusion, rushed-update window).
- Self-scan result: `1000/S/0` (grade S, 0 ship-surface findings, path-filtered per r3 gate-formula) transformed from the v0.17.1 `0/F/48` baseline via the SC-8 `.gitleaks.toml` allowlist migration and the in-source placeholder-fix in `src/brief/sections.ts`.
- 19 prior commits on the v0.17.2 arc (8 supply-chain + 11 audit-fix + this version-bump).

---

## [0.17.1] — 2026-04-23 — "post-dogfood honesty-pass"

### Added

- **Brief H2 "Skills (recommended companion package)"** — every emitted brief now mentions `@aegis-scan/skills`, the third sibling of the AEGIS three-layer toolkit. Closes the v0.17.0 gap where consumer-agents got scaffold + scan but never heard that a skill-library exists. Install command uses the CLI's default target path (no explicit `--to` flag; drop-it-and-it-works).
- **Brief H2 "Enabled features (no dedicated pattern yet)"** — when wizard-config enables features that the foundation+compliance pattern-library does not cover (calendar, billing, AI chat, team-management, command-palette, file-upload, plausible analytics, dokploy deployment), the brief now lists them with one-line ad-hoc-implement guidance. Silent-drops replaced with visible gaps. Feature-pattern-library expansion remains deferred to v0.2 skills-arc.
- **Phase 2 step: stub `src/app/admin/dashboard/page.tsx`** so the Phase 2 gate is satisfiable before Phase 6 ships the full dashboard (was a bootstrap-order impossibility). Phase 6 step 2 adds an explicit "replace the stub" instruction.
- **Phase 4 Step 4 + 5: enable pg_cron + schedule deletion-queue** — explicit numbered steps (`CREATE EXTENSION IF NOT EXISTS pg_cron` + `cron.schedule('dsgvo-deletion', ...)`) replacing the SQL-comment-only hint buried in the dsgvo-kit pattern body. DSGVO Art.17 deletion-queue now actually runs on a faithful phase-numbered execution. Phase 4 gate renumbered to step 6 with an added pg_cron-active assertion.

### Changed

- **AegisConfigSchema gains 3 cross-validators** (zod refines):
  - `integrations.ai.features` ⇄ `features.chat.{enabled,ai_powered}` coherence (forward + symmetric, 2 refines)
  - `compliance.dsgvo_kit` + `impressum`-in-`legal_pages` → `company_address` with TMG §5 minimum (street + zip_city + email)
  These turn previously-silent schema-incoherence into parse-time errors with explanatory messages referencing the German legal citation where applicable.
- **Next.js 16 alignment**: pattern bodies now use `proxy.ts` / `export function proxy` (new idiom); `create-next-app` invocation drops the no-op `--no-turbopack` flag; Quality Gates run `npx eslint src` instead of the removed `npx next lint`. Backward-compat for Next.js 15 noted in prose + `middleware` tag retained alongside new `proxy` tag.
- **Pages Inventory clarification** — auth routes (`/login`, `/signup`, `/auth/*`) + API routes (`/api/*`) explicitly noted as staying at root regardless of i18n. Legal pages get `[locale]` prefix conditional on `cfg.localization.i18n_strategy !== 'none'`.
- **Phase 5 Impressum gate** now runs a bash-3-compat completeness check covering 7 TMG §5 / DDG field-classes (Anschrift, PLZ-Ort, Kontakt-Email, Vertretungsberechtigter, Handelsregister, USt-IdNr, Telefon) with a `>= 5` threshold, replacing the vacuous `grep "{{"`. Defense-in-depth with the C5 schema refine.
- **Shadcn install block** — `shadcn init` now uses `--defaults --yes` (non-interactive, base-nova style locked); `shadcn add` gains `--yes`; install-list moves from 33 to 29 components by removing 4 entries (`toast` 404 in base-nova; `data-table` + `date-picker` are compositions not registry items; `form` HTTP-200-but-CLI-no-write per DR5 empirical install-test 2026-04-23). `spinner` + `combobox` KEPT (DR5 confirmed both write files cleanly). Phase 1 gate moves from `30-40` to `>= 27` with tolerance for auto-resolved deps.
- **CONSENT_VERSION** now read from `process.env.NEXT_PUBLIC_CONSENT_VERSION` with `'v1'` fallback, matching the env-template's documented intent. Pitfall-prose explains the bump procedure when T&Cs change.

### Fixed

- Three ESLint errors in shipped pattern code: datenschutz page uses `<Link>` from `next/link` instead of `<a>`; cookie-banner `setShowBanner(true)` inside first-mount useEffect is deferred via `queueMicrotask` to satisfy React Compiler's set-state-in-effect rule; orphan `// eslint-disable-next-line no-restricted-imports` removed from admin.ts (the underlying rule is not configured in the scaffold's eslint config, so the directive itself generated `unused-eslint-disable` warnings). Scaffolded projects now lint-pass out-of-the-box on Next.js 16 default config.

### Closed (dev-only — no prod-impact, verified via prod-check 2026-04-23 — see [`docs/security/prod-check-2026-04-23.md`](../../docs/security/prod-check-2026-04-23.md) for curl-output evidence)

- **Security-headers-drop on intl-handled responses** — dogfood §3.7#1 observed dev-mode-only. Production build of the dogfood scaffold (next@16.2.4) emits the full security-header set on `/de` (CSP with strict-dynamic + unique nonce, HSTS 2-year preload-eligible, x-frame-options DENY, x-content-type-options nosniff, permissions-policy, referrer-policy, COOP+CORP same-origin). Turbopack dev-server caching was the culprit; no pattern-code fix needed.
- **`/api/admin/*` returns 404 instead of 401** — dogfood §3.7#2 observed dev-mode-only. Production build returns `401 Unauthorized` (not `404`) on unauth `/api/admin/*` probe, with full security-header set on the error response. No pattern-code fix needed.

### Deferred (planned for v0.17.2 or v0.2 skills-arc)

- **Composed-middleware-with-next-intl recipe** (dogfood §3.1#9 + §7#4) — the single biggest brief-gap per dogfood-audit, but scope-heavy (~200 lines + 5-case decision tree). Routed to v0.2 skills-arc as the first defensive skill (`middleware-next-intl-compose`). Cross-referenced in the brief's new Skills section.
- **Cookie-banner + login-form i18n rewrite** (dogfood §3.2#8 + §3.2#9) — ~5 pattern-files, dedicated i18n-pass arc.
- **SENSITIVE_PERSONAL_FIELDS wizard-populated** (dogfood §3.2#10 + §7#13) — requires domain-inference logic; feature work, not fix.
- **Feature-pattern-library expansion** (calendar/billing/ai/team/file-upload patterns — dogfood §3.2#4 + §3.5) — v0.2 skills-arc.
- Full remaining backlog tracked in operator-local planning tree §10.

### Meta

- Triggered by the 2026-04-23 dogfood-execution test. The fortress-discipline + honest-numbers principle applies: documented gaps beat silent gaps. The v0.17.1 arc converts 15+ dogfood-discovered silent-gaps into fixes, schema-errors, verified-dev-only closures, or named deferrals.
- 12 prior atomic commits on the honesty-pass arc (F3 schema + C5 Impressum schema + F1 Skills + F2 Enabled-features + D-NX-01/02/03 Next.js 16 + D-COM-01 shadcn + D-COM-05 Impressum gate + D-CLA-05 Phase 2 stub + D-CON-03/04/D-COM-07 pg_cron + D-CON-05 CONSENT + D-OTH-08/09/10 eslint).
