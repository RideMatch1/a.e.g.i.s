# Evidence Manifest — Phase 1 Tier-1 Readiness

**Pinned at:** AEGIS HEAD `551c63f989ed6f088ad642b79241fd531a1b82d5` (2026-04-27)
**Schema:** Derived from APTS Evidence_Package_Manifest (CC BY-SA 4.0, see [`attribution.md`](./attribution.md))

This manifest documents one Evidence Item per `evidence_refs` entry in
[`conformance.json`](./conformance.json), and a Gap Note for every
`partially_met` and `not_met` requirement. Every code path is verified
to exist at the pinned HEAD SHA.

---

## Evidence Items (referenced by `met` requirements)

### `ev-ssrf-rfc1918`

- **Type:** code-rule + config-schema
- **Path:** `packages/scanners/src/quality/ssrf-checker.ts`
- **What it proves:** APTS-SE-002 (IP Range Validation, RFC 1918 awareness)
- **How to verify:** Open the file; the private-IP block-rules + RFC 1918 / link-local checks are in the source. The scanner is registered in `packages/scanners/src/index.ts` via `getAllScanners()`.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-config-deny`

- **Type:** config-schema
- **Path:** `aegis.config.json` (root) + the schema enforced by `@aegis-scan/core` `ConfigLoader`
- **What it proves:** APTS-SE-009 (Hard Deny Lists and Critical Asset Protection)
- **How to verify:** Inspect `aegis.config.json` for the `excludePaths` field; the Zod-strict schema in `@aegis-scan/core` enforces consumption by every scanner.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-cli-target-selection`

- **Type:** cli-spec
- **Path:** `packages/cli/src/commands/` (mode subcommands: `scan`, `audit`, `siege`, `fix`, `init`, `history`)
- **What it proves:** APTS-AL-002 (Human-Directed Target and Technique Selection)
- **How to verify:** Every entry-point requires the operator to pass `--target <URL>` (siege) or a project path (scan/audit) and to choose a mode subcommand. No targets are model-selected.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-config-schema`

- **Type:** code-schema
- **Path:** `@aegis-scan/core` `ConfigLoader` (Zod-strict) + `aegis.config.json`
- **What it proves:** APTS-AL-003 (Parameter Configuration by Human Operator)
- **How to verify:** The Zod-strict schema rejects any field not declared by the operator; no LLM can mutate the config at runtime.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-sarif-reporter`

- **Type:** code-reporter + test
- **Path:** `packages/reporters/src/sarif.ts` + `packages/reporters/__tests__/sarif.test.ts`
- **What it proves:** APTS-AR-001 (Structured Event Logging with Schema Validation) — findings emit as SARIF 2.1.0 conforming to the upstream SARIF schema; the parallel JSON output is structured per the AEGIS Finding type.
- **How to verify:** The `__tests__/sarif.test.ts` exercises the SARIF emitter; the JSON Finding type is defined in `packages/core/src/types.ts`.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-finding-confidence`

- **Type:** code-type + scoring-rule
- **Path:** `packages/core/src/types.ts` (`Finding.confidence` field) + `packages/core/src/scoring.ts` + `packages/core/src/orchestrator.ts:119`
- **What it proves:** APTS-AR-004 (Decision Point Logging and Confidence Scoring)
- **How to verify:** `Finding.confidence` is required on every Finding (`Finding.confidence: Confidence` in `types.ts`); the orchestrator + scoring engine consume it for per-CWE confidence rules.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-error-neutrality`

- **Type:** code-rule + AEGIS-side discipline
- **Path:** `packages/scanners/src/quality/error-leakage-checker.ts` (scans the *target* for error-leakage) + AEGIS-side: every CLI command catches errors and emits sanitized JSON without raw stack traces in the report output
- **What it proves:** APTS-MR-003 (Error Message Neutrality) — both as a scanner-detection of the rule on the target AND as AEGIS-side compliance with neutral error output
- **How to verify:** Inspect `error-leakage-checker.ts` for the rule; run `aegis scan .` against an intentionally-failing target — the JSON output reports the failure without leaking AEGIS-internal stack traces
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-credential-protection`

- **Type:** scanner-family
- **Paths:**
  - `packages/scanners/src/quality/next-public-leak.ts` — NEXT_PUBLIC_* secret leakage
  - `packages/scanners/src/quality/entropy-scanner.ts` — Shannon-entropy-based high-entropy-string detection
  - `packages/scanners/src/quality/crypto-auditor.ts` — hardcoded-secret + insecure-RNG detection
  - `packages/scanners/src/secrets/jwt-detector.ts` — literal `eyJ...` JWT-format credential detection
- **What it proves:** APTS-MR-019 (Discovered Credential Protection) — multi-layer scanner family that catches secrets across NEXT_PUBLIC_ exposure, entropy-shaped strings, hardcoded-secret patterns, and JWT-format literals.
- **How to verify:** Each file has its own `__tests__` fixture under `packages/scanners/__tests__/`.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-provider-vetting`

- **Type:** code-pattern + double-gating
- **Path:** Each wrapper's `isAvailable()` method:
  - `packages/scanners/src/dast/strix.ts:67`
  - `packages/scanners/src/dast/ptai.ts:79-81`
  - `packages/scanners/src/dast/pentestswarm.ts:85-87`
- **What it proves:** APTS-TP-001 (Third-Party Provider Selection and Vetting) — every wrapper performs a double-gate (binary-on-PATH check + LLM-API-key-in-env check) before activating; unavailable wrappers auto-skip with a `[LOW-CONFIDENCE]` confidence note.
- **How to verify:** Inspect each `isAvailable()` source; run `aegis scan .` with a wrapper deliberately uninstalled — the CLI prints the auto-skip message.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-supply-chain`

- **Type:** scanner-family
- **Paths:**
  - `packages/scanners/src/dependencies/supply-chain.ts` — typosquatting, lockfile integrity, monorepo-aware phantom-dep detection
  - `packages/scanners/src/dependencies/dep-confusion.ts` — scoped-package private-registry mapping enforcement
- **What it proves:** APTS-TP-006 (Dependency Inventory, Risk Assessment, and Supply Chain Verification)
- **How to verify:** Run `aegis scan .` on any project with a lockfile; inspect the `supply-chain` and `dep-confusion-checker` finding sections.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-cloud-config`

- **Type:** scanner-family + CI hardening
- **Paths:**
  - `packages/scanners/src/quality/config-auditor.ts` — Docker / Next.js / Firebase misconfig
  - `packages/scanners/src/quality/header-checker.ts` — CSP / HSTS / COOP / CORP / COEP enforcement
  - `ci/github-action/action.yml` — pinned-SHA + npm-install hardening (per AUDIT-AEGIS-SCAN-V0165 §1+§2)
- **What it proves:** APTS-TP-008 (Cloud Security Configuration and Hardening)
- **How to verify:** Inspect `config-auditor.ts` rules; inspect `header-checker.ts` baseline; inspect `ci/github-action/action.yml` for SHA-pinning.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-foundation-model`

- **Type:** disclosure-document
- **Path:** [`FOUNDATION-MODEL-DISCLOSURE.md`](./FOUNDATION-MODEL-DISCLOSURE.md)
- **What it proves:** APTS-TP-021 (Foundation Model Disclosure and Capability Baseline) — BYOM matrix per wrapper + the fix-mode companion; capability-baseline references point to provider model cards at the configured version.
- **How to verify:** Open the disclosure document; the Strix / PTAI / Pentest-Swarm-AI sections each have BYOM tables with verified source-line references.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-fp-disclosure`

- **Type:** scoring-rule + report-artifact
- **Paths:**
  - `packages/core/src/scoring.ts` — confidence aggregator + `[LOW-CONFIDENCE]` PR-comment badge logic
  - `packages/scanners/src/index.ts` — per-CWE confidence rules wired into `getAllScanners()` registration
- **What it proves:** APTS-RP-006 (False Positive Rate Disclosure)
- **How to verify:** Run `aegis scan .` on a project; the report concludes with confidence breakdown; missing wrappers triggers `[LOW-CONFIDENCE]` badge.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-coverage-disclosure`

- **Type:** docs + public-registry
- **Paths:**
  - `README.md` § "Scanners (63 total)" + sub-sections enumerating built-in / external / attack scanners
  - `packages/scanners/src/index.ts` — `getAllScanners()` + `getAttackScanners()` exported registries
  - `CHANGELOG.md` — per-release scanner additions documented
- **What it proves:** APTS-RP-008 (Vulnerability Coverage Disclosure)
- **How to verify:** Inspect README scanner-inventory tables; verify that `getAllScanners()` count matches the README count.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-executive-summary`

- **Type:** report-artifact
- **Paths:**
  - `packages/core/src/scoring.ts` — 0-1000 score + grade (FORTRESS/HARDENED/SOLID/NEEDS_WORK/AT_RISK/CRITICAL) + badge
  - `packages/reporters/` — terminal / JSON / SARIF / HTML / Markdown reporters all surface the score+grade+badge
- **What it proves:** APTS-RP-011 (Executive Summary and Risk Overview)
- **How to verify:** Run `aegis scan .` — the final lines of the terminal report include the score, grade, and badge.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-roe-schema`

- **Type:** code-schema + tests
- **Paths:**
  - `packages/core/src/roe/types.ts` — Zod-strict RoE schema (RoESchema). Captures operator authorization (organization, authorized_by, contact, ≥20-char attestation statement, signature_method), in_scope (domains with wildcard + includeSubdomains, IP CIDRs IPv4/IPv6, repository_paths), out_of_scope deny-list (domains, IP ranges, paths), asset_criticality (pattern + classification critical/high/medium/low), temporal envelope (start/end/timezone + blackout_windows), stop_conditions, optional notifications and references.
  - `packages/core/__tests__/roe.test.ts` — schema + validator + loader tests; covers positive validation, every rejection mode (empty roe_id, wrong spec_version, short authorization statement, scheme-in-domain, malformed CIDR, end-before-start, unknown top-level field).
- **What it proves:** APTS-SE-001 (Rules of Engagement Specification + Validation), APTS-SE-003 (Domain Scope + Wildcard Handling), APTS-SE-004 (Temporal Boundary), APTS-SE-005 (Asset Criticality Classification), APTS-AL-006 (Basic Scope Validation policy DSL), APTS-AL-014 (Boundary Definition Framework).
- **How to verify:** `pnpm -F @aegis-scan/core test -- roe.test.ts` runs every schema-validation case. Inspect `RoESchema` for the field shape; the operator-readable structure mirrors the APTS Conformance_Claim_Template.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-roe-validators`

- **Type:** code-validator + tests
- **Paths:**
  - `packages/core/src/roe/types.ts` — `validateTargetInScope` (deny-list precedence, IP CIDR check, wildcard domain matching), `validateTemporalEnvelope` (envelope start/end + blackout windows), `getAssetCriticality` (first-match-wins classification), `validateAction` (composite gate combining temporal + scope + criticality).
  - `packages/core/__tests__/roe.test.ts` — every validator covered with positive + negative cases, including deny-wins-over-in-scope, blackout window mid-engagement, classification first-match precedence, composite-gate cascading rejection.
- **What it proves:** APTS-SE-003 (Domain Scope Validation), APTS-SE-004 (Temporal Boundary), APTS-SE-005 (Asset Criticality), APTS-SE-006 (Pre-Action Scope Validation), APTS-SE-008 (Temporal Compliance Monitoring), APTS-AL-006 (Basic Scope Validation), APTS-AL-014 (Boundary Enforcement).
- **How to verify:** Run the test suite; inspect each validator function for the per-CWE-style decision shape with explicit `apts_refs` field tying the decision back to the APTS requirement(s) it satisfies or violates.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-roe-cli-integration`

- **Type:** code-integration
- **Paths:**
  - `packages/cli/src/index.ts` — `aegis siege --roe <path>` flag declaration.
  - `packages/cli/src/commands/siege.ts` — pre-engagement RoE load + temporal-envelope check + target-in-scope check; falls back to `synthesizeMinimalRoE` with a yellow operator-warning when `--roe` is omitted; per-phase `validateTemporalEnvelope` recheck after each of the 4 siege phases (recon → discovery → exploitation → reporting), with halt-on-expiry.
  - `packages/cli/__tests__/siege.test.ts` — siege orchestration tests with mocked validators.
- **What it proves:** APTS-SE-001 (RoE specification + validation pipeline), APTS-SE-006 (pre-action scope validation), APTS-SE-008 (per-phase temporal-compliance monitoring).
- **How to verify:** Run `aegis siege . --target https://example.com --roe ./engagement.json --confirm` against an example RoE — the CLI loads + validates + halts on any rejection. Without `--roe`, the synthesized-RoE warning surfaces.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-jsonl-events`

- **Type:** code-schema + tests
- **Paths:**
  - `packages/core/src/runtime/events.ts` — engagement-event schema (engagement-start, phase-transition, finding-emitted, critical-finding, intervention, resume, halt, kill, completion). Each event carries ts (ISO-8601), engagement_id, event-name + per-event-shape payload. EventSink: callback-or-file-path; emitEvent appends one JSON line per event.
  - `packages/core/__tests__/runtime/runtime.test.ts` — emit-to-callback + emit-to-file tests; findingEvent extraction; isCriticalSeverity classification.
- **What it proves:** APTS-HO-002 (Real-Time Monitoring channel), APTS-AR-002 (State Transition Logging), APTS-AL-011 (Escalation Triggers — critical-finding events carry RoE stop_action).
- **How to verify:** Run `aegis siege . --target https://example.com --confirm --state-file /tmp/siege-events.jsonl` against a localhost target; tail `/tmp/siege-events.jsonl` during the run.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-engagement-state`

- **Type:** code-schema + tests
- **Paths:**
  - `packages/core/src/runtime/state.ts` — Zod-strict EngagementState schema (state_version, engagement_id, target, roe_id, completed_phases, findings_so_far, paused_at, reason). writeEngagementState + loadEngagementState (with file-missing / json-parse / schema-validation phase tagging). newEngagementState builder for engagement-start.
  - `packages/core/__tests__/runtime/runtime.test.ts` — round-trip tests; every loadEngagementState rejection phase covered.
- **What it proves:** APTS-HO-006 (Graceful Pause + State Preservation), APTS-HO-008 (Immediate Kill Switch + State Dump). Phase-grained resume — fine-grained mid-phase resume is Cluster-2.5 work.
- **How to verify:** Send SIGUSR1 to a running siege process configured with `--state-file`; the file content is a valid EngagementState. Resume with `--resume <state-file>`; siege skips the phases listed in completed_phases.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-signal-handlers`

- **Type:** code-handler + tests
- **Paths:**
  - `packages/core/src/runtime/signals.ts` — installSignalHandlers wires SIGINT (exit 130, kill-with-state-dump), SIGTERM (exit 143, kill-with-state-dump), SIGUSR1 (exit 0, pause-with-state-dump). uninstall() removes listeners on engagement completion. Test-injectable exit + on for deterministic signal-flow assertions.
  - `packages/core/__tests__/runtime/runtime.test.ts` — handler installation + per-signal exit-code mapping + state-dump-to-disk verification.
- **What it proves:** APTS-HO-008 (Kill Switch with State Dump), APTS-AL-012 (Kill Switch + Pause Capability), APTS-HO-006 (Graceful Pause via SIGUSR1).
- **How to verify:** `kill -USR1 <siege-pid>` writes EngagementState, exits 0. `kill -TERM <siege-pid>` writes EngagementState, exits 143. State-write is best-effort — never masks the exit if disk-write fails.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-notification-webhook`

- **Type:** code-dispatcher + tests
- **Paths:**
  - `packages/core/src/runtime/notifications.ts` — dispatchNotification fires fire-and-forget POST to each configured webhook URL with the JSON-serialized event payload. Default-event-allow-list (engagement-start, critical-finding, intervention, halt, kill, completion). Per-request timeout + AbortController. Failures recorded as halt-events with non-fatal flag — never abort the engagement.
  - `packages/core/__tests__/runtime/runtime.test.ts` — POST shape, allow-list filter, error-swallow with halt-event recording, custom event-allow-list.
- **What it proves:** APTS-HO-015 (Real-Time Activity Monitoring + Multi-Channel Notification — webhook subset; full multi-channel = Cluster-2.5).
- **How to verify:** `aegis siege . --target X --confirm --notify-webhook https://hook.example.com/critical` emits engagement-start + critical-finding events to the URL.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-siege-c2-wiring`

- **Type:** code-integration
- **Paths:**
  - `packages/cli/src/index.ts` — `siege --state-file <path>`, `--resume <path>`, `--notify-webhook <url>` (repeatable via collectMulti).
  - `packages/cli/src/commands/siege.ts` — engagement_id generation, JSONL event emission at engagement-start + per-phase enter/exit + per-finding (with critical-finding fan-out), state persistence at every phase boundary, signal-handler installation, --resume pathway that skips completed phases. handlers.uninstall() on completion + on halt-paths.
- **What it proves:** Composite — combines ev-jsonl-events, ev-engagement-state, ev-signal-handlers, ev-notification-webhook into the operator-facing `aegis siege` flow. Closes APTS-HO-002, HO-006, HO-008, AL-011, AL-012, AR-002.
- **How to verify:** Full run: `aegis siege . --target https://localhost:3000 --confirm --state-file /tmp/eng.jsonl --notify-webhook https://hook.example.com/`. Mid-run: `kill -USR1 <pid>` → state-file populated → `aegis siege . --target https://localhost:3000 --confirm --resume /tmp/eng.jsonl`. Operator should see "Skipping Phase X" notes for each previously-completed phase.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

---

## Gap Notes (`partially_met`, `not_met`, `not_applicable`)

The Phase-2 plan column captures the closure approach for each gap.
The handover doc tracks the same set with sequencing + ETA.

### Scope Enforcement (SE) — gaps

> **Closed by Phase 2 Cluster-1** (RoE schema + scope-object DSL): SE-001, SE-003, SE-004, SE-005, SE-006, SE-008. See `ev-roe-schema`, `ev-roe-validators`, `ev-roe-cli-integration` above.

- **APTS-SE-015 (Scope Enforcement Audit and Compliance Verification) — partially_met:** JSON output captures targets and `roe_id` is logged at engagement start; no separate scope-enforcement audit trail with hash-chain integrity. **Phase-2 plan:** dedicated scope-audit log channel — combines with AR-010 + AR-012 closure (Cluster-3 hash-chain work).

### Safety Controls (SC) — gaps

- **APTS-SC-001 (Impact Classification and CIA Scoring) — partially_met:** CWE-based severity is CIA-adjacent. **Phase-2 plan:** add CIA impact-vector field to Finding type; populate per-CWE in the scanner emit-path.
- **APTS-SC-004 (Rate Limiting, Bandwidth, and Payload Constraints) — partially_met:** Per-wrapper. **Phase-2 plan:** orchestrator-level token-bucket / global rate-limit + payload-size envelope.
- **APTS-SC-009 (Kill Switch) — partially_met:** Ctrl+C only. **Phase-2 plan:** multi-path kill switch — signal-based (SIGTERM with 5s grace + SIGKILL), API-based (`aegis siege --kill`), dead-man-switch (heartbeat to operator-managed endpoint).
- **APTS-SC-010 (Health Check Monitoring, Threshold Adjustment, Automatic Halt) — not_met:** **Phase-2 plan:** per-engagement health probe with auto-halt thresholds (memory, error-rate, target-response-time).
- **APTS-SC-015 (Post-Test System Integrity Validation) — not_met:** **Phase-2 plan:** post-engagement verification step that confirms target service responsiveness + records final state-snapshot.
- **APTS-SC-020 (Action Allowlist Enforcement External to the Model) — partially_met:** Mode-gate is coarse. **Phase-2 plan:** per-scanner action allowlist consumed by the orchestrator before scanner dispatch.

### Human Oversight (HO) — gaps

> **Closed by Phase 2 Cluster-2** (Intervention API + JSONL state-stream + signal handlers + webhook dispatcher): HO-002, HO-006, HO-008. See `ev-jsonl-events`, `ev-engagement-state`, `ev-signal-handlers`, `ev-siege-c2-wiring` above.
>
> **Bumped from not_met to partially_met by Cluster-2:** HO-015 (webhook channel shipped; full multi-channel Slack/email/PagerDuty integration is Cluster-2.5).

- **APTS-HO-001 — partially_met:** `--mode pentest` opt-in is a pre-approval gesture. **Phase-2 plan:** structured per-AL-level pre-approval gate.
- **APTS-HO-003 — not_met:** **Phase-2 plan:** decision-timeout per phase with default-safe-behavior (halt > continue).
- **APTS-HO-004 — not_met:** **Phase-2 plan:** authority-delegation matrix in the RoE schema.
- **APTS-HO-007 — not_met:** **Phase-2 plan:** mid-engagement redirect via expanded RoE-edit-then-resume cycle (Cluster-2.5).
- **APTS-HO-010 — partially_met:** One decision point at start. **Phase-2 plan:** identify per-phase irreversible-action set + add gate per item.
- **APTS-HO-011 — not_met:** **Phase-2 plan:** unexpected-finding escalation framework (severity > THRESHOLD → operator notification + halt-pending-approval).
- **APTS-HO-012 — not_met:** **Phase-2 plan:** impact-threshold-breach trigger (combines with SC-001 CIA scoring, Cluster-6).
- **APTS-HO-013 — partially_met:** `[LOW-CONFIDENCE]` badge is post-hoc. **Phase-2 plan:** in-engagement confidence-based pause.
- **APTS-HO-014 — not_met:** **Phase-2 plan:** legal/compliance escalation triggers in the RoE schema (regulated-asset class detection).
- **APTS-HO-015 — partially_met:** Webhook channel shipped (one or more URLs supported simultaneously). **Phase-2 plan:** native multi-channel transport (Slack, email, PagerDuty) — Cluster-2.5.

### Graduated Autonomy (AL) — gaps

- **APTS-AL-001 — partially_met:** No formal AL-level tags. **Phase-2 plan:** AL-level metadata field per scanner registration; orchestrator labels each engagement-phase with the AL-level it operates under.
- **APTS-AL-004 — partially_met:** siege-phase chain is operator-confirmed once. **Phase-2 plan:** per-phase confirmation prompt (or RoE-acknowledged auto-chain disclosure).
- **APTS-AL-005 — partially_met:** Logs not signed. **Phase-2 plan:** combine with AR-010 hash-chain.
- **APTS-AL-008 — partially_met:** Signal-based pause/kill is an out-of-band intervention surface; per-action approval gate (RoE-driven, per-scanner-emit) is Cluster-4 work.

> **Closed by Phase 2 Cluster-1** (RoE schema + scope-object DSL): AL-006, AL-014. See `ev-roe-schema`, `ev-roe-validators` above.
>
> **Closed by Phase 2 Cluster-2** (Intervention API + JSONL state-stream + signals + webhooks): AL-011, AL-012. See `ev-jsonl-events`, `ev-signal-handlers`, `ev-siege-c2-wiring` above.
- **APTS-AL-016 — not_met:** **Phase-2 plan:** continuous boundary-monitor that re-validates the scope-object on every scanner-emit.

### Auditability (AR) — gaps

> **Closed by Phase 2 Cluster-2** (JSONL state-stream): AR-002. See `ev-jsonl-events`, `ev-siege-c2-wiring` above.

- **APTS-AR-006 — partially_met:** Taint chain only. **Phase-2 plan:** alternative-evaluation reasoning emit for siege-mode autonomous decisions.
- **APTS-AR-010 — not_met:** **Phase-2 plan:** SHA-256 hash per finding emitted alongside the finding; hash captured in audit log.
- **APTS-AR-012 — not_met:** **Phase-2 plan:** hash-chained audit-log file (each entry's hash includes the previous entry's hash).
- **APTS-AR-015 — not_met:** **Phase-2 plan:** evidence-classification field on Finding (public / internal / confidential) + sensitivity-aware redaction in reporters.

### Manipulation Resistance (MR) — gaps

- **APTS-MR-001 — partially_met:** Wrapper-internal only. **Phase-2 plan:** orchestrator-side instruction-boundary enforcement on wrapper outputs.
- **APTS-MR-002 — partially_met:** JSON-schema only. **Phase-2 plan:** semantic response validation (sanity-check finding-counts vs known-baseline + manipulation-signature detection).
- **APTS-MR-004 — not_met:** **Phase-2 plan:** SHA-256 hash-pin of `aegis.config.json` at engagement start; mid-run mutation detection.
- **APTS-MR-005 — not_met:** **Phase-2 plan:** authority-claim detection in finding text (e.g., wrapper-claimed admin-bypass without verifying; reject without operator confirmation).
- **APTS-MR-007 — partially_met:** SAST level only. **Phase-2 plan:** orchestrator HTTP-client default redirect-following policy (max-1-redirect, same-origin only).
- **APTS-MR-008 — partially_met:** Same as MR-007. **Phase-2 plan:** combine with MR-007 closure.
- **APTS-MR-009 — partially_met:** Same as MR-008. **Phase-2 plan:** combine with MR-008 closure.
- **APTS-MR-010 — not_met:** **Phase-2 plan:** scope-expansion detector — flag finding text that suggests expanding scope outside the RoE.
- **APTS-MR-011 — not_met:** **Phase-2 plan:** OOB-communication blocker on wrapper outputs (no DNS exfil, no out-of-engagement HTTP).
- **APTS-MR-012 — partially_met:** Read-once but no mid-run protection. **Phase-2 plan:** combine with MR-004 hash-pin.
- **APTS-MR-018 — not_met:** **Phase-2 plan:** per-wrapper container/sandbox isolation profile in the wrapper-launcher.

### Supply Chain Trust (TP) — gaps

- **APTS-TP-003 — partially_met:** Operator-managed env-var auth. **Phase-2 plan:** AEGIS-mediated key vault integration option (Vault / 1Password CLI / aws-secretsmanager).
- **APTS-TP-005 — not_met:** **Phase-2 plan:** documented incident-response playbook for provider-side compromise (LLM-API breach, wrapper-upstream compromise) under `docs/security/`.
- **APTS-TP-012 — not_applicable:** Self-hosted-by-consumer; no AEGIS-side data ingestion.
- **APTS-TP-013 — partially_met:** Source-secrets only. **Phase-2 plan:** PII/PHI/PCI-aware classification in entropy-scanner outputs.
- **APTS-TP-014 — partially_met:** SAST only. **Phase-2 plan:** in-flight TLS enforcement on AEGIS↔wrapper communication; mTLS between orchestrator and any non-localhost wrapper.
- **APTS-TP-018 — not_applicable:** Self-hosted; no AEGIS-side tenancy.

### (No RP gaps — all 3 RP Tier-1 reqs are MET.)

---

## Phase-2 evidence acquisition plan

Phase 2 closes the gaps and converts every `partially_met` to `met`,
every `not_met` to `met` (or to `not_applicable` with a clean
boundary-justification), and updates the `evidence_refs` array on each
re-classified entry. Phase 2 also adds:

- A SHA-256 hash field on every Evidence Item (so that reviewers can
  detect tampering since the publication date).
- A pre-publish CI gate (`ci/check-apts-claim.sh`) that schema-validates
  `conformance.json` and verifies that every claimed evidence path
  resolves to a real file at HEAD.
