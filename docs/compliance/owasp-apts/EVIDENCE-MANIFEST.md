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

### `ev-hash-chain`

- **Type:** code-cryptography + tests
- **Paths:**
  - `packages/core/src/runtime/hash.ts` — SHA-256 (Node `crypto`, FIPS 180-4 / RFC 6234) + canonical-JSON normalization (sorted-key recursive serialization, undefined-fields dropped). hashCanonical convenience wrapper.
  - `packages/core/src/runtime/chain.ts` — ChainedEmitter wraps each emitted event with prev_hash (null on first) + this_hash (SHA-256 over the event minus this_hash). emit() returns the chained event so callers can dispatch downstream. getTail() exposes the running tail-hash so resume can thread the chain across sessions.
  - `packages/core/__tests__/runtime/chain.test.ts` — sha256 RFC-6234 known-value, canonical-stability across key-permutations, ChainedEmitter prev-hash threading, caller-tampered this_hash overwritten, initialPrevHash for resume continuity, getTail post-emit.
- **What it proves:** APTS-AR-010 (Cryptographic Hashing of All Evidence) at the event level, APTS-AR-012 (Tamper-Evident Logging with Hash Chains), APTS-AL-005 (Mandatory Logging + Reviewable Audit Trail).
- **How to verify:** Run a siege engagement with `--state-file /tmp/x.jsonl`. Inspect: every line has prev_hash + this_hash; line 0's prev_hash is null. Edit any line and re-run `aegis audit-verify /tmp/x.jsonl` — the chain breaks at the affected line.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-finding-evidence-hash`

- **Type:** code-cryptography + tests
- **Paths:**
  - `packages/core/src/runtime/events.ts` — findingEvent now computes evidence_hash via hashCanonical(finding) and embeds it on the finding-emitted JSONL event. Deterministic across property-declaration-order permutations. Different finding content yields different hashes.
  - `packages/core/__tests__/runtime/chain.test.ts` (§ "evidence_hash for AR-010") — verifies presence, determinism, content-sensitivity.
- **What it proves:** APTS-AR-010 (Cryptographic Hashing of All Evidence) at the per-finding level.
- **How to verify:** During siege, every emitted finding-emitted event in the state-file carries an evidence_hash field. Reviewers can re-hash the underlying Finding from a separate report (JSON / SARIF) to confirm the trail-emission matches the stored finding.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-audit-verify-cli`

- **Type:** cli-tool
- **Paths:**
  - `packages/cli/src/commands/audit-verify.ts` — `aegis audit-verify <state-file>` reads the JSONL audit log, walks the chain, recomputes each event's hash from its canonical form, verifies the prev_hash → this_hash linkage. Reports broken_at line + error reason on failure. JSON output mode (`--format json`) for machine consumption.
  - `packages/cli/src/index.ts` — command registration.
- **What it proves:** APTS-AR-012 (Tamper-Evident Logging with Hash Chains) — the verification path is what makes the chain tamper-EVIDENT (not just tamper-resistant).
- **How to verify:** `aegis audit-verify /tmp/siege-engagement.jsonl` — green confirms chain intact; red surfaces the broken-at-line-N + reason.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-scope-validation-events`

- **Type:** code-integration
- **Paths:**
  - `packages/cli/src/commands/siege.ts` — engagement-start emits a structured scope-validation event with target + action + allowed + reason + apts_refs. Pulled from validateTargetInScope's decision object so the audit trail captures the same APTS-ID references the validator reports back.
  - `packages/core/src/runtime/events.ts` — scope-validation event-shape declared in the discriminated union.
- **What it proves:** APTS-SE-015 (Scope Enforcement Audit and Compliance Verification) — the audit log carries the explicit scope-decision rather than only its consequence (proceed / halt).
- **How to verify:** Inspect `/tmp/siege.jsonl` after a run — at least one line is `{"event":"scope-validation",...}` with allowed + reason matching the validateTargetInScope decision. The chain protects this event the same way it protects every other audit entry.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-instruction-boundary`

- **Type:** code-module + tests
- **Paths:**
  - `packages/core/src/manipulation-resistance/instruction-boundary.ts` — `enforceInstructionBoundary(wrapperName, action, roe)` checks per-wrapper action allowlist (`WRAPPER_ACTION_ALLOWLIST`), target-in-RoE-scope, and any URL embedded in payloads. Unknown wrappers are deny-by-default.
  - `packages/core/__tests__/manipulation-resistance/instruction-boundary.test.ts` — 7 tests cover happy path + each rejection class.
- **What it proves:** APTS-MR-001 (Instruction Boundary Enforcement Architecture) — orchestrator enforces a layer-2 instruction frame on top of every wrapper's internal one.
- **How to verify:** `pnpm -F @aegis-scan/core test instruction-boundary` — 7/7 green. Read the per-wrapper allowlist constants in the source.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-response-validator`

- **Type:** code-module + tests
- **Paths:**
  - `packages/core/src/manipulation-resistance/response-validator.ts` — `validateWrapperResponse` runs per-wrapper Zod schemas (`StrixOutputSchema`, `PtaiOutputSchema`, `PentestswarmOutputSchema`, `SubfinderEntrySchema`); recursive HTML-encode + 16-KiB field-length cap defends against script injection + memory exhaustion.
  - `packages/scanners/src/dast/{strix,ptai,pentestswarm}.ts` — wrapper-side application post-parse, pre-emit.
  - `packages/core/__tests__/manipulation-resistance/response-validator.test.ts` — 6 tests on validation; 6 tests on detectAuthorityClaim.
- **What it proves:** APTS-MR-002 (Response Validation and Sanitization).
- **How to verify:** `pnpm -F @aegis-scan/core test response-validator` — 12/12 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-config-integrity`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/manipulation-resistance/config-integrity.ts` — `pinConfig(label, value)` returns `{ hash, pinned_at, label }` (SHA-256 of canonical JSON); `verifyConfig(value, pin)` returns `{ ok, observed_hash, reason? }` and reports drift with both hashes for audit.
  - `packages/cli/src/commands/siege.ts` — wired at engagement-start (pin) + after each phase (verify); halt on mismatch.
  - `packages/core/__tests__/manipulation-resistance/config-integrity.test.ts` — 5 tests cover pin shape, ok-on-identity, mismatch on field mutation, canonical-form awareness, and deeply nested array changes.
- **What it proves:** APTS-MR-004 (Configuration File Integrity Verification) + APTS-MR-012 (Immutable Scope Enforcement Architecture) — joint coverage since the SHA-256 pin includes RoE in_scope/out_of_scope.
- **How to verify:** `pnpm -F @aegis-scan/core test config-integrity` — 5/5 green. Trace the pin/verify wiring in siege.ts.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-authority-claim-detector`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/manipulation-resistance/response-validator.ts` — `detectAuthorityClaim(text)` returns `{ claim, rationale, matched_phrase, suggested_action, apts_refs }`. RCE / reverse-shell suggest `reject`; root / superuser / assertive admin claims suggest `verify`; bare admin-endpoint findings pass through.
  - `packages/cli/src/commands/siege.ts` — `haltOnFindingTextRisk` runs detectAuthorityClaim on every finding's title + description; reject suggestions emit a `critical-finding` event with stop_action `halt`.
- **What it proves:** APTS-MR-005 (Authority Claim Detection and Rejection).
- **How to verify:** `pnpm -F @aegis-scan/core test response-validator` — 6 tests for the detector. `pnpm -F @aegis-scan/cli test siege` — integration test "halts when authority-claim is rejected in a finding (APTS-MR-005)".
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-orchestrator-safe-fetch`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/manipulation-resistance/redirect-policy.ts` — `safeFetch` rejects non-HTTP(S) protocols, RFC 1918 / link-local / loopback / cloud-metadata IPs, redirects-to-private-IPs, and chains beyond `maxRedirects`. DNS-rebind defense via lookup + per-hop classification. Structured `SafeFetchRejection` error carries APTS refs.
  - `packages/cli/src/commands/siege.ts` — replaces `fetch` on the recon + reachability paths.
  - `packages/core/__tests__/manipulation-resistance/redirect-policy.test.ts` — 15 tests: classifyIp coverage + safeFetch rejection classes + redirect re-validation + maxRedirects abort.
- **What it proves:** APTS-MR-007 (Redirect Following) + APTS-MR-008 (DNS Rebinding) + APTS-MR-009 (SSRF) jointly.
- **How to verify:** `pnpm -F @aegis-scan/core test redirect-policy` — 15/15 green. The siege integration test "halts when safeFetch rejects target by SSRF policy" exercises the orchestrator-level rejection path.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-scope-expansion-detector`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/manipulation-resistance/scope-expansion-detector.ts` — `detectScopeExpansion(text)` returns `{ detected, kind, rationale, matched_phrase, apts_refs }`. Patterns cover expand-scope, include-subdomain, forward-data, change-target, authorize-action.
  - `packages/cli/src/commands/siege.ts` — `haltOnFindingTextRisk` runs the detector on every finding emitted by the orchestrator; detection emits a critical-finding event with stop_action `halt`.
  - `packages/core/__tests__/manipulation-resistance/scope-expansion-detector.test.ts` — 7 tests covering each kind + the negative case + APTS-ref invariant.
- **What it proves:** APTS-MR-010 (Scope Expansion Social Engineering Prevention).
- **How to verify:** `pnpm -F @aegis-scan/core test scope-expansion-detector` — 7/7 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-egress-allowlist`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/manipulation-resistance/oob-blocker.ts` — `composeEgressAllowlist(roe, opts)` builds the per-engagement allowlist from RoE in_scope.domains (with `*.subdomain` expansion), in_scope.ip_ranges, fixed orchestrator-essentials (LLM provider APIs), and operator extras. `withEgressEnv` propagates via AEGIS_EGRESS_ALLOWLIST env var.
  - `packages/cli/src/commands/siege.ts` — composes + sets `process.env.AEGIS_EGRESS_ALLOWLIST` before scanner dispatch.
  - `packages/core/__tests__/manipulation-resistance/oob-blocker.test.ts` — 7 tests: scope inclusion, IP-range inclusion, LLM-essentials toggle, extras, sorted env value, env merge.
- **What it proves:** APTS-MR-011 (Out-of-Band Communication Prevention) — the allowlist is the policy boundary; in `--sandbox-mode docker` it is enforced via the chosen docker network.
- **How to verify:** `pnpm -F @aegis-scan/core test oob-blocker` — 7/7 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-multi-path-kill-switch`

- **Type:** code-module + tests + integration + cli
- **Paths:**
  - `packages/core/src/safety-controls/kill-switch.ts` — `startKillRequestWatcher` polls a marker file via `setInterval(unref)` and fires an operator-supplied callback on detection; `requestKill` writes the marker. `startDeadManHeartbeat` POSTs at a configured interval and counts consecutive failures (network error, non-2xx, thrown).
  - `packages/cli/src/commands/siege.ts` — wires both watchers; halt event carries the SC-009 ref on detection.
  - `packages/cli/src/index.ts` — `aegis siege-kill <state-file>` subcommand.
  - `packages/core/__tests__/safety-controls/kill-switch.test.ts` — 7 tests (marker shape, watcher fire-on-detect, stop()-prevents-callback, heartbeat threshold-fire, success-resets-counter, thrown-error-counts).
- **What it proves:** APTS-SC-009 (Kill Switch) — multi-path: signal (existing), file-marker, dead-man.
- **How to verify:** `pnpm -F @aegis-scan/core test kill-switch` — 7/7 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-health-monitor`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/safety-controls/health-monitor.ts` — `runHealthCheck` evaluates heap memory + rolling error rate + last target response time against thresholds; observed values returned for the audit trail.
  - `packages/cli/src/commands/siege.ts` — `runSafetyChecks` invokes runHealthCheck at every phase boundary; halt on breach.
  - `packages/core/__tests__/safety-controls/health-monitor.test.ts` — 6 tests (errorRate edge cases + each threshold class).
- **What it proves:** APTS-SC-010 (Health Check Monitoring + Threshold-Based Auto-Halt).
- **How to verify:** `pnpm -F @aegis-scan/core test health-monitor` — 6/6 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-post-test-integrity`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/safety-controls/post-test-integrity.ts` — `probeTargetIntegrity` HEADs the target via safeFetch; flags 5xx + response-time spike-vs-baseline.
  - `packages/cli/src/commands/siege.ts` — captures pre-engagement baseline at the reachability check; runs probeTargetIntegrity post-Phase-4; emits a scope-validation event with the verdict.
  - `packages/core/__tests__/safety-controls/post-test-integrity.test.ts` — 5 tests (ok-on-200, fail-on-5xx, fail-on-spike, ok-within-threshold, fail-on-fetch-throw).
- **What it proves:** APTS-SC-015 (Post-Test System Integrity Validation).
- **How to verify:** `pnpm -F @aegis-scan/core test post-test-integrity` — 5/5 green. Integration test "runs probeTargetIntegrity post-engagement and emits SC-015 audit event".
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-continuous-boundary-monitor`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/safety-controls/boundary-monitor.ts` — `detectScopeBreach` validates a finding-like\'s location/target/file against the loaded RoE; URL-shaped values pass through `validateTargetInScope`.
  - `packages/cli/src/commands/siege.ts` — wired into `haltOnFindingTextRisk` for every emitted finding; emits a per-finding scope-validation event; halt on breach.
  - `packages/core/__tests__/safety-controls/boundary-monitor.test.ts` — 5 tests (no-inspectable-passes, in-scope-passes, out-of-scope-fails, file-paths-skip, location-precedence).
- **What it proves:** APTS-AL-016 (Continuous Boundary Monitoring + Breach Detection).
- **How to verify:** `pnpm -F @aegis-scan/core test boundary-monitor` — 5/5 green. Integration test "halts when detectScopeBreach reports a per-finding boundary breach (APTS-AL-016)".
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-cia-scoring`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/cia-scoring.ts` — `assignCiaVector` returns the per-CWE default mapping (CWE-89 SQLi, CWE-79 XSS, CWE-78 OS-injection, CWE-918 SSRF, CWE-502 deserialization, CWE-287 auth failure, etc. — 20 mappings) or the severity-based fallback. `evaluateCiaThreshold` flags axes at-or-above per-axis threshold.
  - `packages/core/src/types.ts` — Finding gains `cia_vector?: { c, i, a }` + new `CiaImpact` type.
  - `packages/cli/src/commands/siege.ts` — wired into `haltOnFindingTextRisk`; halt on threshold breach.
  - `packages/core/__tests__/oversight/cia-scoring.test.ts` — 11 tests (per-CWE, severity fallback, threshold breach, ≥-not->, multi-axis, no-shared-reference).
- **What it proves:** APTS-SC-001 (Impact Classification + CIA Scoring) + APTS-HO-012 (Impact Threshold Breach Escalation) — joint coverage.
- **How to verify:** `pnpm -F @aegis-scan/core test cia-scoring` — 11/11 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-pre-approval-gates`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/approval-gates.ts` — `evaluateApprovalGate(phase, autonomy_levels, engagementConfirmed)`. Phase→AL mapping (recon=L1, discovery=L2, exploitation=L3, reporting=L4).
  - `packages/cli/src/commands/siege.ts` — `evaluatePhaseApproval` invoked before each running phase; halt on denial.
  - `packages/core/__tests__/oversight/approval-gates.test.ts` — `evaluateApprovalGate` suite (allow paths + deny paths + AL mapping invariant).
- **What it proves:** APTS-HO-001 (Pre-Approval Gates per AL-level).
- **How to verify:** `pnpm -F @aegis-scan/core test approval-gates` — green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-irreversible-gate`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/approval-gates.ts` — `evaluateIrreversibleGate(phase, autonomy_levels)` is a SECOND independent gate that engagement-wide --confirm CANNOT bypass. Returns `allowed=false` when `irreversible_action_classes` is non-empty AND `pre_approved !== true`. `detectIrreversibleActions` is the per-level lookup helper.
  - `packages/cli/src/commands/siege.ts` — `evaluatePhaseApproval` calls BOTH `evaluateApprovalGate` and `evaluateIrreversibleGate` before each phase entry; either denial halts the engagement.
  - `packages/core/__tests__/oversight/approval-gates.test.ts` — `evaluateIrreversibleGate` suite (7 tests: empty/undefined/pre-approved/denied/confirm-insufficient/L1-deny/no-AL-mapping).
  - `packages/cli/__tests__/siege.test.ts` — halt-path test (`halts when evaluateIrreversibleGate denies a phase entry (APTS-HO-010 hard gate)`).
- **What it proves:** APTS-HO-010 (Mandatory Human Decision Points) — the hard-gate semantic, where engagement-wide consent cannot authorize irreversible actions implicitly.
- **How to verify:** `pnpm -F @aegis-scan/core test approval-gates && pnpm -F @aegis-scan/cli test siege` — both green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-authority-delegation`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/authority-matrix.ts` — `validateDelegationMatrix` shape-checks operator-supplied matrix (non-empty role + can_approve, no duplicate roles, no empty action-class strings). `rolesForAction` returns the roles that can approve a given class.
  - `packages/cli/src/commands/siege.ts` — validates RoE.authorization.delegation_matrix at engagement start; halt on malformed input.
  - `packages/core/__tests__/oversight/authority-matrix.test.ts` — 9 tests (every rejection case + valid input + lookup).
- **What it proves:** APTS-HO-004 (Authority Delegation Matrix).
- **How to verify:** `pnpm -F @aegis-scan/core test authority-matrix` — 9/9 green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-severity-escalation`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/escalation.ts` — `escalateOnSeverity` returns halt-pending when severity ≥ threshold. Default `high`; operator override via `RoE.escalation.severity_threshold`.
  - `packages/cli/src/commands/siege.ts` — wired into `haltOnFindingTextRisk` with operator-threshold check; emits critical-finding event with stop_action `halt`.
  - `packages/core/__tests__/oversight/escalation.test.ts` — 3 tests for severity escalation paths.
- **What it proves:** APTS-HO-011 (Unexpected Findings Escalation Framework).
- **How to verify:** `pnpm -F @aegis-scan/core test escalation` — `escalateOnSeverity` block green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-confidence-escalation`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/escalation.ts` — `escalateOnConfidence`. When confidence==='low', returns `notify` (soft) or `halt` (hard, operator opt-in via `RoE.escalation.pause_on_low_confidence`).
  - `packages/cli/src/commands/siege.ts` — wired into `haltOnFindingTextRisk`; halt on hard-pause flag.
  - `packages/core/__tests__/oversight/escalation.test.ts` — 4 tests for confidence escalation paths.
- **What it proves:** APTS-HO-013 (Confidence-Based Escalation).
- **How to verify:** `pnpm -F @aegis-scan/core test escalation` — `escalateOnConfidence` block green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-compliance-triggers`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/oversight/escalation.ts` — `escalateOnComplianceTrigger` scans finding title + description against operator-supplied regulatory class markers. Built-in patterns: PII, PCI, PHI, GDPR, HIPAA, SOX. `on_match` is `halt` (default) or `notify`.
  - `packages/cli/src/commands/siege.ts` — wired into `haltOnFindingTextRisk` when `RoE.compliance_triggers` is set; halt on halt-class match.
  - `packages/core/__tests__/oversight/escalation.test.ts` — 5 tests (PCI, notify mode, PII/HIPAA/SOX, no-match, unknown-class graceful).
- **What it proves:** APTS-HO-014 (Legal/Compliance Escalation Triggers).
- **How to verify:** `pnpm -F @aegis-scan/core test escalation` — `escalateOnComplianceTrigger` block green. Integration test "halts when escalateOnComplianceTrigger fires with on_match=halt (APTS-HO-014)".
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-decision-timeout`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/safety-controls/decision-timeout.ts` — `withPhaseTimeout` wraps a phase promise in Promise.race against a deadline; signals an optional AbortController on timeout. `derivePhaseTimeoutMs` reads `RoE.stop_conditions.phase_timeout_minutes` with a `max_duration_minutes/4` fallback and a default-supplied final fallback.
  - `packages/cli/src/commands/siege.ts` — wraps each of the three running phases (recon, discovery, exploitation) in withPhaseTimeout. CLI flag `--phase-timeout-minutes` overrides the RoE value.
  - `packages/core/__tests__/safety-controls/decision-timeout.test.ts` — 7 tests (resolves-on-time, fails-on-overrun, abort-controller-fires, error-rethrow, derivePhaseTimeoutMs precedence ladder).
- **What it proves:** APTS-HO-003 (Decision Timeout + Default-Safe Behavior).
- **How to verify:** `pnpm -F @aegis-scan/core test decision-timeout` — 7/7 green. Integration test "halts when withPhaseTimeout reports a recon-phase timeout (APTS-HO-003)".
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-wrapper-sandboxing`

- **Type:** code-module + tests + integration
- **Paths:**
  - `packages/core/src/manipulation-resistance/ai-io-boundary.ts` — `validateSandboxMode` + `wrapForSandbox(name, binary, args, mode, opts)`. Docker mode rewrites `exec("strix", args)` → `exec("docker", ["run", "--rm", "--network=aegis-egress", "--security-opt=no-new-privileges", "--cap-drop=ALL", "--read-only", "--tmpfs=/tmp", image, ...args])`. Firejail mode applies `--read-only=/`, `--ipc-namespace`, `--noroot`. Default `none` is back-compat pass-through. Unmapped wrappers fall back to pass-through with a diagnostic env tag.
  - `packages/cli/src/commands/siege.ts` — `--sandbox-mode <docker|firejail|none>` flag; RoE.sandboxing.mode acts as a stricter floor (CLI cannot weaken). Env propagation via AEGIS_SANDBOX_MODE.
  - `packages/scanners/src/dast/{strix,ptai,pentestswarm}.ts` — wrapper-side `wrapForSandbox` invocation before exec.
  - `packages/core/src/roe/types.ts` — `SandboxingSchema` declarative field.
  - `packages/core/__tests__/manipulation-resistance/ai-io-boundary.test.ts` — mode validation + each transformation including image-override + unmapped-wrapper fallback.
- **What it proves:** APTS-MR-018 (AI Model Input/Output Architectural Boundary) — code path.
- **How to verify:** `pnpm -F @aegis-scan/core test ai-io-boundary` — green.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-sandbox-preflight`

- **Type:** code-module + tests + integration + dockerfiles + build script
- **Paths:**
  - `dockerfiles/sandboxes/strix.Dockerfile`, `dockerfiles/sandboxes/ptai.Dockerfile`, `dockerfiles/sandboxes/pentestswarm.Dockerfile` — authoritative builds for the three sandbox images. Each pins a minimal base, drops to a non-root user, and exposes the upstream LLM-pentest tool as ENTRYPOINT.
  - `dockerfiles/sandboxes/build.sh` — builds all three images and creates the `aegis-egress` docker network with `--internal=true` (egress restriction at network layer).
  - `packages/core/src/manipulation-resistance/ai-io-boundary.ts` — `preflightSandboxImages(opts)` probes `docker image inspect <ref>` and `docker network inspect <name>` for every required wrapper image plus the egress network. Returns ok=false with a remediation block listing exactly which artifacts are missing and the build commands.
  - `packages/cli/src/commands/siege.ts` — runs preflight at engagement-start when `--sandbox-mode=docker` is selected; halts with exit 1 + remediation message when artifacts are missing.
  - `packages/core/__tests__/manipulation-resistance/ai-io-boundary.test.ts` — `preflightSandboxImages` suite (6 tests: ok-path, missing-image, missing-network, image-override, unmapped-wrapper-skip, custom-network).
  - `packages/cli/__tests__/siege.test.ts` — halt path: "halts when preflightSandboxImages reports missing artifacts (APTS-MR-018 docker preflight)".
- **What it proves:** Closes the audit-flagged gap where MR-018 docker mode could be selected against non-existent images. Operators now hit a clear instruction-rich error at engagement-start, not at a wrapper exec deep inside a phase.
- **How to verify:** `pnpm -F @aegis-scan/core test ai-io-boundary && pnpm -F @aegis-scan/cli test siege` — both green. Live verify: `bash dockerfiles/sandboxes/build.sh` builds the images; `docker image ls 'aegis/*-sandbox'` lists them; `docker network inspect aegis-egress` shows the internal network.
- **Captured at:** 2026-04-27
- **Sensitivity:** public

---

## Gap Notes (`partially_met`, `not_met`, `not_applicable`)

The Phase-2 plan column captures the closure approach for each gap.
The handover doc tracks the same set with sequencing + ETA.

### Scope Enforcement (SE) — fully met

> **Closed by Phase 2 Cluster-1** (RoE schema + scope-object DSL): SE-001, SE-003, SE-004, SE-005, SE-006, SE-008. See `ev-roe-schema`, `ev-roe-validators`, `ev-roe-cli-integration` above.
>
> **Closed by Phase 2 Cluster-3** (hash-chain + scope-validation events): SE-015. See `ev-scope-validation-events`, `ev-hash-chain`, `ev-audit-verify-cli` above.
>
> **Already met before Phase 2** (deterministic SAST coverage + RoE deny-list): SE-002, SE-009.
>
> **All 9 SE Tier-1 entries now MET.**

### Safety Controls (SC) — gaps

> **Closed by Phase 2 Cluster-5** (safety-controls module + per-phase wiring): SC-009, SC-010, SC-015. See `ev-multi-path-kill-switch`, `ev-health-monitor`, `ev-post-test-integrity` above.
>
> **Closed by Phase 2 Cluster-6** (CIA scoring + per-finding evaluation): SC-001. See `ev-cia-scoring` above.

- **APTS-SC-004 (Rate Limiting, Bandwidth, and Payload Constraints) — partially_met:** Per-wrapper. **Phase-2 plan:** orchestrator-level token-bucket / global rate-limit + payload-size envelope.
- **APTS-SC-020 (Action Allowlist Enforcement External to the Model) — partially_met:** Mode-gate is coarse. **Phase-2 plan:** per-scanner action allowlist consumed by the orchestrator before scanner dispatch.

### Human Oversight (HO) — gaps

> **Closed by Phase 2 Cluster-2** (Intervention API + JSONL state-stream + signal handlers + webhook dispatcher): HO-002, HO-006, HO-008. See `ev-jsonl-events`, `ev-engagement-state`, `ev-signal-handlers`, `ev-siege-c2-wiring` above.
>
> **Closed by Phase 2 Cluster-5** (decision timeout + default-safe halt): HO-003. See `ev-decision-timeout` above.
>
> **Closed by Phase 2 Cluster-6** (oversight module + RoE delegation/autonomy schema): HO-001, HO-004, HO-010, HO-011, HO-012, HO-013, HO-014. See `ev-pre-approval-gates`, `ev-authority-delegation`, `ev-severity-escalation`, `ev-confidence-escalation`, `ev-compliance-triggers` above.
>
> **Bumped from not_met to partially_met by Cluster-2:** HO-015 (webhook channel shipped; full multi-channel Slack/email/PagerDuty integration is Cluster-2.5).
- **APTS-HO-007 — not_met:** **Phase-2 plan:** mid-engagement redirect via expanded RoE-edit-then-resume cycle (Cluster-2.5).
- **APTS-HO-015 — partially_met:** Webhook channel shipped (one or more URLs supported simultaneously). **Phase-2 plan:** native multi-channel transport (Slack, email, PagerDuty) — Cluster-2.5.

### Graduated Autonomy (AL) — gaps

- **APTS-AL-001 — partially_met:** No formal AL-level tags. **Phase-2 plan:** AL-level metadata field per scanner registration; orchestrator labels each engagement-phase with the AL-level it operates under.
- **APTS-AL-004 — partially_met:** siege-phase chain is operator-confirmed once. **Phase-2 plan:** per-phase confirmation prompt (or RoE-acknowledged auto-chain disclosure).
- **APTS-AL-008 — partially_met:** Signal-based pause/kill is an out-of-band intervention surface; per-action approval gate (RoE-driven, per-scanner-emit) is Cluster-4 work.

> **Closed by Phase 2 Cluster-1** (RoE schema + scope-object DSL): AL-006, AL-014. See `ev-roe-schema`, `ev-roe-validators` above.
>
> **Closed by Phase 2 Cluster-2** (Intervention API + JSONL state-stream + signals + webhooks): AL-011, AL-012. See `ev-jsonl-events`, `ev-signal-handlers`, `ev-siege-c2-wiring` above.
>
> **Closed by Phase 2 Cluster-3** (hash-chain → signed audit trail): AL-005. See `ev-hash-chain`, `ev-audit-verify-cli` above.
>
> **Closed by Phase 2 Cluster-5** (continuous boundary monitor): AL-016. See `ev-continuous-boundary-monitor` above.

### Auditability (AR) — gaps

> **Closed by Phase 2 Cluster-2** (JSONL state-stream): AR-002. See `ev-jsonl-events`, `ev-siege-c2-wiring` above.
>
> **Closed by Phase 2 Cluster-3** (hash-chain + per-finding evidence_hash): AR-010, AR-012. See `ev-hash-chain`, `ev-finding-evidence-hash`, `ev-audit-verify-cli` above.

- **APTS-AR-006 — partially_met:** Taint chain only. **Phase-2 plan:** alternative-evaluation reasoning emit for siege-mode autonomous decisions.
- **APTS-AR-015 — not_met:** **Phase-2 plan:** evidence-classification field on Finding (public / internal / confidential) + sensitivity-aware redaction in reporters.

### Manipulation Resistance (MR) — fully met

> **Closed by Phase 2 Cluster-4** (manipulation-resistance enforcement module + siege wiring): MR-001, MR-002, MR-004, MR-005, MR-007, MR-008, MR-009, MR-010, MR-011, MR-012, MR-018. See `ev-instruction-boundary`, `ev-response-validator`, `ev-config-integrity`, `ev-authority-claim-detector`, `ev-orchestrator-safe-fetch`, `ev-scope-expansion-detector`, `ev-egress-allowlist`, `ev-wrapper-sandboxing` above.
>
> **Already met before Phase 2** (per-target rule + scanner family): MR-003 (error-message neutrality), MR-019 (discovered-credential protection).
>
> **All 13 MR Tier-1 entries now MET.**

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
