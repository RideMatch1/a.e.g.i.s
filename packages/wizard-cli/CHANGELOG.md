# Changelog

All notable changes to `@aegis-wizard/cli` are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The
wizard package uses SemVer; each minor-version may add new wizard
questions, brief-sections, or pattern bodies. Release cadence is driven
by dogfood-audit + recon-report findings, not by a fixed schedule.

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
