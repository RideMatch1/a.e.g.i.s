# OWASP-APTS Conformance Claim — AEGIS Autonomous Pentest Layer

> **Document type:** Tier-1 **Readiness Assessment** (Phase 1) — explicitly **NOT** a Conformance Claim.
> Template structure derived from OWASP/APTS Conformance_Claim_Template (CC BY-SA 4.0). See [`attribution.md`](./attribution.md).

---

## Phase-1 Disclaimer (load-bearing — read this first)

> APTS specifies that a Conformance Claim at any tier requires **100% MET on every requirement at the claimed tier; partial credit is not awarded** (Conformance_Claim_Template § "Reminder").
>
> AEGIS today does **not** meet that bar at Tier 1. This document publishes a **transparent Tier-1 Readiness Assessment**: every Tier-1 requirement is explicitly classified MET / PARTIAL / NOT-MET / N-A, with concrete evidence paths for every MET entry and per-entry Phase-2 closure plans for every PARTIAL/NOT-MET entry.
>
> Phase-1 publication establishes the public baseline. Phase 2 closes the gaps and converts this Readiness Assessment into a full Tier-1 Conformance Claim.

---

## Conformance Claim metadata

| Field | Value |
|-------|-------|
| **Organization Name** | AEGIS maintainer team |
| **Platform Name** | AEGIS Autonomous Pentest Layer |
| **Operator Type** | Open-source project (self-hosted by consumer) |
| **Platform Version** | `@aegis-scan/cli` v0.16.6 (siege-mode + LLM-pentest wrappers) |
| **APTS Version** | v0.1.0 |
| **Claimed Tier** | **Tier 1 — Readiness Assessment (Phase 1)** |
| **Claim Date** | 2026-04-27 |
| **Assessment Method** | Internal self-assessment |
| **Contact** | https://github.com/RideMatch1/a.e.g.i.s/issues |
| **Pinned HEAD SHA** | `551c63f989ed6f088ad642b79241fd531a1b82d5` |

---

## Scope of Claim

### In scope

The conformance posture covers the **AEGIS Autonomous Pentest Layer**:

- `aegis siege` — 4-phase live-attack simulation (auth-probe, header-probe, rate-limit-probe, privesc-probe, race-probe). The autonomous engagement orchestrator.
- **Strix LLM-pentest wrapper** (`packages/scanners/src/dast/strix.ts`) — autonomous DAST agent integration.
- **PTAI LLM-pentest wrapper** (`packages/scanners/src/dast/ptai.ts`) — 10-agent pentest framework integration.
- **Pentest-Swarm-AI LLM-pentest wrapper** (`packages/scanners/src/dast/pentestswarm.ts`) — multi-agent stigmergic pentest integration.
- **CLI orchestration** of the above — engagement scheduling, output aggregation, scoring, reporting.

### Out of scope (supporting components)

These components are **not** part of the conformance claim because they do not operate autonomously in the APTS sense:

- Deterministic SAST scanners (`aegis scan` / `aegis audit`) — deterministic regex / AST analysis, no autonomous decisions.
- `@aegis-scan/skills` methodology library — markdown-only methodology library for AI coding agents; not a runtime autonomous platform.
- `@aegis-wizard/cli` scaffold generator — one-shot project scaffolder; not autonomous.
- MCP server — exposes `aegis_*` tools to AI coding agents but does not itself operate autonomously.

### Autonomy levels supported

L1 (Single Technique) and L2 (Phase Chaining within boundaries) — claimed for the L1/L2 wrapper invocations under siege orchestration. L3/L4 are explicitly out-of-scope for this readiness assessment.

### Deployment model

Self-hosted by consumer. AEGIS is shipped as `@aegis-scan/*` npm packages and a GitHub Action recipe. No AEGIS-hosted SaaS surface.

---

## Foundation Model Disclosure (APTS-TP-021)

See [`FOUNDATION-MODEL-DISCLOSURE.md`](./FOUNDATION-MODEL-DISCLOSURE.md) for the complete BYOM matrix per wrapper (Strix, PTAI, Pentest-Swarm-AI) and the `aegis fix` companion mode.

Summary: AEGIS does not pin a foundation model. The operator chooses the provider per wrapper (Anthropic / OpenAI / Google / Ollama-local) via documented environment variables. Operator-side per-engagement re-attestation is required per APTS-TP-022.

---

## Domain Summary

| Domain | Total Tier-1 | Met | Partially | Not Met | N/A | Planned |
|---|---|---|---|---|---|---|
| Scope Enforcement (SE) | 9 | 9 | 0 | 0 | 0 | 0 |
| Safety Controls (SC) | 6 | 3 | 3 | 0 | 0 | 0 |
| Human Oversight (HO) | 13 | 4 | 4 | 5 | 0 | 0 |
| Graduated Autonomy (AL) | 11 | 8 | 3 | 0 | 0 | 0 |
| Auditability (AR) | 7 | 5 | 1 | 1 | 0 | 0 |
| Manipulation Resistance (MR) | 13 | 13 | 0 | 0 | 0 | 0 |
| Supply Chain Trust (TP) | 10 | 4 | 3 | 1 | 2 | 0 |
| Reporting (RP) | 3 | 3 | 0 | 0 | 0 | 0 |
| **Total** | **72** | **49** | **14** | **7** | **2** | **0** |

**MET total: 49/72 (68%).** Phase 2 Cluster-1 (machine-readable RoE schema + scope-object DSL) shipped 8 entries. Phase 2 Cluster-2 (intervention API + JSONL state-stream + signal handlers + webhook dispatcher) shipped 6 + 2 partial-bumps. Phase 2 Cluster-3 (SHA-256 hash-chain + per-finding evidence_hash + `aegis audit-verify` CLI) shipped 4 more (AR-010 + AR-012 + AL-005 + SE-015) — the **SE domain is fully met (9/9)**. Phase 2 Cluster-4 (manipulation-resistance enforcement module + siege wiring) shipped 11 more (MR-001/002/004/005/007/008/009/010/011/012/018) — the **MR domain is now also fully met (13/13)**, joining SE and RP at 100%. Phase 2 Cluster-5 (safety-controls module + per-phase wiring) shipped 5 more (SC-009 + SC-010 + SC-015 + AL-016 + HO-003) — three domains remain partial-or-better: HO (4/13), AR (5/7 + 1 partial), TP (4/10 + 3 partial + 2 N/A). APTS still forbids partial credit for a conformance claim; this remains a Readiness Assessment, not a claim, until 100% MET.

---

## Per-domain narrative

### Scope Enforcement (SE) — 9/9 MET (FULL)

After Phase 2 Cluster-1, six SE entries (SE-001/003/004/005/006/008) flipped MET via the RoE schema + validators + CLI integration. SE-002 (RFC 1918) and SE-009 (hard deny lists) were already MET. After Phase 2 Cluster-3, SE-015 (scope-enforcement audit log) flipped MET via the scope-validation event emission into the hash-chained JSONL audit log. **SE is the first domain to reach 100% Tier-1 MET coverage.**

### Safety Controls (SC) — 3/6 MET

After Phase 2 Cluster-5, three SC entries flipped to MET via the new `packages/core/src/safety-controls/` module: multi-path kill switch (SC-009 — signals + file-marker + dead-man heartbeat), per-engagement health probe with auto-halt thresholds (SC-010 — heap memory + error rate + target response time), and post-test target integrity probe (SC-015 — HEAD via safeFetch, baseline-aware spike detection). Remaining gaps: SC-001 (CIA scoring — Cluster-6), SC-004 (orchestrator-level rate limiting), SC-020 (per-scanner action allowlist).

### Human Oversight (HO) — 4/13 MET

After Phase 2 Cluster-5, HO-003 (decision timeout + default-safe halt) flipped to MET via `withPhaseTimeout`. AEGIS today provides decision points at engagement start, multi-channel notification hooks (Slack/email/PagerDuty are still Cluster-2.5 work), per-phase decision-timeout, and structured intervention via SIGUSR1. Remaining HO gaps fall mostly into Cluster-6 (HO-001/004/010/011/012/013/014 — pre-approval gates per AL-level, authority delegation, mandatory human decision points, escalation frameworks).

### Graduated Autonomy (AL) — 8/11 MET

After Phase 2 Cluster-1 + Cluster-2 + Cluster-3 + Cluster-5, eight AL entries are MET: AL-002, AL-003 (pre-existing), AL-005 (hash-chained audit trail), AL-006 + AL-014 (RoE schema), AL-011 + AL-012 (intervention API + signal handlers), AL-016 (continuous boundary monitor — Cluster-5). Remaining: AL-001 (formal AL-level tagging per scanner), AL-004 (per-phase confirmation), AL-008 (per-action approval gate — partial via signals).

### Auditability (AR) — 5/7 MET (Cluster-3 shipped)

JSON output + SARIF 2.1.0 emission cover structured logging (AR-001) and per-finding confidence scoring (AR-004). Cluster-2 JSONL state-stream closed AR-002. Cluster-3 ships the SHA-256 hash-chain (AR-012) + per-finding evidence_hash (AR-010). Only AR-006 (alternative-evaluation reasoning during autonomous decisions) and AR-015 (evidence sensitivity classification) remain — both deferred to later clusters.

### Manipulation Resistance (MR) — 13/13 MET (FULL)

After Phase 2 Cluster-4, eleven MR entries flipped to MET via the new `packages/core/src/manipulation-resistance/` enforcement module. The module provides orchestrator-side instruction-boundary enforcement (`enforceInstructionBoundary` with per-wrapper action allowlist, MR-001), wrapper response validation + sanitization (Zod schemas + 16-KiB cap + HTML encoding, MR-002), SHA-256 config-integrity pin + per-phase verification (MR-004 + MR-012 jointly), authority-claim detection with reject/verify suggested actions (MR-005), `safeFetch` with manual-redirect re-validation + DNS-rebind defense + IP-class rejection (MR-007/008/009 jointly), scope-expansion social-engineering pattern detector (MR-010), per-engagement egress allowlist composition + env propagation (MR-011), and `--sandbox-mode <docker|firejail|none>` wrapper-exec rewriting with hard `--network` enforcement under docker (MR-018). The two pre-existing MET entries (MR-003 error-neutrality via `error-leakage-checker`; MR-019 credential-protection via the four-scanner family) join these eleven for full domain coverage. **MR is the third domain to reach 100% Tier-1 MET coverage**, after SE and RP.

### Supply Chain Trust (TP) — 4/10 MET (+ 2 N/A)

The strongest currently-shipping baseline alongside RP. AEGIS already covers provider vetting (TP-001 via wrapper double-gating), dependency inventory (TP-006 via `supply-chain` scanner family), cloud configuration hardening (TP-008), and the Foundation Model Disclosure (TP-021). The 2 N/A entries (TP-012 client data classification, TP-018 tenant breach notification) are out-of-scope for the self-hosted-by-consumer deployment model.

### Reporting (RP) — 3/3 MET (full)

All three Tier-1 RP requirements are MET: false-positive rate disclosure (`[LOW-CONFIDENCE]` PR badge + per-CWE confidence rules), vulnerability coverage disclosure (README scanner inventory + `getAllScanners()` registry + CHANGELOG), and executive summary (0-1000 score + grade + badge in every report).

---

## Requirement-by-requirement details

The complete per-requirement classification with rationale and evidence references is in the machine-readable [`conformance.json`](./conformance.json). The narrative-form Gap Notes for every PARTIAL / NOT-MET / N/A entry (with Phase-2 closure plan) are in [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md) § "Gap Notes".

---

## Declared Scope Boundaries

The following are deliberate design decisions, not implementation gaps:

- **Self-hosted-by-consumer deployment model** — AEGIS does not host customer data, so APTS-TP-012 (client data classification) and APTS-TP-018 (tenant breach notification) are N/A. This is a deliberate architectural choice; AEGIS ships as npm packages and a GitHub Action, not a SaaS.
- **BYOM (Bring Your Own Model)** — AEGIS does not pin a foundation model. The operator selects, configures, and re-attests per engagement. Per-engagement model attestation responsibility lies with the operator per APTS-TP-022.
- **L3/L4 autonomy levels not claimed** — The wrappers AEGIS integrates may individually support L3/L4 autonomy, but AEGIS-side orchestration claims only L1/L2 in this Phase-1 Readiness Assessment.

---

## Evidence Availability

All Phase-1 evidence is **public** — every Evidence Item in [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md) cites a source-code path, a test file, a config schema, or a documentation reference within the AEGIS public repository. There is no confidential evidence in this Phase-1 release.

Phase 2 may introduce confidential evidence (e.g., kill-switch demonstration recordings, internal engagement logs); the manifest schema already provides for sensitivity classification in the Phase-2 evidence-acquisition plan.

---

## Customer / Reviewer guidance

To independently verify this Readiness Assessment:

1. Check out the AEGIS repository at HEAD `551c63f989ed6f088ad642b79241fd531a1b82d5` (or any later revision; the manifest is re-pinned per release).
2. For each MET entry in [`conformance.json`](./conformance.json), follow the `evidence_refs` to [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md) and verify the cited source-code paths resolve and contain the claimed behavior.
3. For each PARTIAL / NOT-MET entry, verify the `rationale` matches what the source actually does (or doesn't do), and evaluate the Phase-2 plan in the manifest against your own conformance threshold.
4. Cross-check the JSON against the upstream APTS manifest — every `requirement_id` exists in `apts_requirements.json` v0.1.0 and is at Tier 1.
5. Use the upstream OWASP/APTS [Vendor_Evaluation_Guide](https://github.com/OWASP/APTS/blob/main/standard/appendix/Vendor_Evaluation_Guide.md) for an independent review framework.

---

## Phase-2 commitment

| Phase | Deliverable | Window |
|---|---|---|
| **Phase 1** (this release) | Tier-1 Readiness Assessment (Gap statement) | shipped 2026-04-27 |
| **Phase 2** | Tier-1 Full Conformance Claim — close all PARTIAL/NOT-MET to MET, then convert this document's header from "Readiness Assessment" to "Conformance Claim" | 8-12 weeks |
| **Phase 3** | Tier-2 Climb — extend coverage from 72 Tier-1 reqs to the 85 Tier-2 reqs | post Phase 2 |

The Phase-2 punch list is tracked in the project's handover doc and re-flected in the per-entry Phase-2 plans inside [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md).

---

## Revision History

| Date | Version | Change |
|------|---------|--------|
| 2026-04-27 | 1.0 | Initial Tier-1 Readiness Assessment publication. 15/72 MET, 28 PARTIAL, 27 NOT-MET, 2 N/A. Pinned at HEAD `551c63f989ed6f088ad642b79241fd531a1b82d5`. |
| 2026-04-27 | 1.1 | Phase 2 Cluster-1 ship — machine-readable RoE schema + scope-object DSL. 8 entries flip MET (SE-001/003/004/005/006/008 + AL-006/014). New: 23/72 MET, 23 PARTIAL, 24 NOT-MET, 2 N/A. |
| 2026-04-27 | 1.2 | Phase 2 Cluster-2 ship — intervention API + JSONL state-stream + signal handlers + webhook dispatcher. 6 entries flip MET (HO-002/006/008 + AL-011/012 + AR-002), 2 entries bump from NOT-MET to PARTIALLY-MET (HO-015, AL-008). New: 29/72 MET, 23 PARTIAL, 18 NOT-MET, 2 N/A. |
| 2026-04-27 | 1.3 | Phase 2 Cluster-3 ship — SHA-256 hash-chain + per-finding evidence_hash + `aegis audit-verify` CLI + scope-validation audit-event. 4 entries flip MET (AR-010 + AR-012 + AL-005 + SE-015). **SE domain fully met (9/9).** New: 33/72 MET, 21 PARTIAL, 16 NOT-MET, 2 N/A. |
| 2026-04-27 | 1.4 | Phase 2 Cluster-4 ship — `packages/core/src/manipulation-resistance/` enforcement module + siege wiring. 11 entries flip MET (MR-001/002/004/005/007/008/009/010/011/012/018). **MR domain fully met (13/13).** Three domains now at 100%: SE, MR, RP. New: 44/72 MET, 15 PARTIAL, 11 NOT-MET, 2 N/A. |
| 2026-04-27 | 1.5 | Phase 2 Cluster-5 ship — `packages/core/src/safety-controls/` module + per-phase wiring. 5 entries flip MET (SC-009 multi-path kill switch, SC-010 health monitor + auto-halt, SC-015 post-test integrity probe, AL-016 continuous boundary monitor, HO-003 decision timeout + default-safe halt). New: 49/72 MET, 14 PARTIAL, 7 NOT-MET, 2 N/A. |

---

## Sign-off

This Readiness Assessment is published as an operator-provided self-assessment. Customers may independently verify these claims using the upstream OWASP/APTS [Vendor Evaluation Guide](https://github.com/OWASP/APTS/blob/main/standard/appendix/Vendor_Evaluation_Guide.md) or the [Customer Acceptance Testing](https://github.com/OWASP/APTS/blob/main/standard/appendix/Customer_Acceptance_Testing.md) appendix.

Bug reports, conformance-mapping disputes, and Phase-2 prioritization input welcomed via the AEGIS issue tracker.
