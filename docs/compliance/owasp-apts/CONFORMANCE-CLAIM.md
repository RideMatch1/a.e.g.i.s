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
| Scope Enforcement (SE) | 9 | 2 | 4 | 3 | 0 | 0 |
| Safety Controls (SC) | 6 | 0 | 4 | 2 | 0 | 0 |
| Human Oversight (HO) | 13 | 0 | 3 | 10 | 0 | 0 |
| Graduated Autonomy (AL) | 11 | 2 | 6 | 3 | 0 | 0 |
| Auditability (AR) | 7 | 2 | 2 | 3 | 0 | 0 |
| Manipulation Resistance (MR) | 13 | 2 | 6 | 5 | 0 | 0 |
| Supply Chain Trust (TP) | 10 | 4 | 3 | 1 | 2 | 0 |
| Reporting (RP) | 3 | 3 | 0 | 0 | 0 | 0 |
| **Total** | **72** | **15** | **28** | **27** | **2** | **0** |

**MET total: 15/72 (21%).** This is the honest baseline. APTS forbids partial credit for a conformance claim; this is therefore explicitly a Readiness Assessment, not a claim.

---

## Per-domain narrative

### Scope Enforcement (SE) — 2/9 MET

The SAST-side scope is mature (`aegis.config.json` + `excludePaths` is a battle-tested deny-list shape). The autonomous-engagement-side RoE is minimal (`siege --target URL --confirm`) — Phase 2 introduces a machine-readable RoE schema with temporal envelopes, asset-criticality classification, and per-action scope validation.

### Safety Controls (SC) — 0/6 MET

The weakest currently-shipping baseline at the orchestrator layer. AEGIS today relies on per-wrapper safety controls (Strix/PTAI/Pentest-Swarm-AI each have their own rate-limit and kill-switch behavior). Phase 2 introduces orchestrator-level rate-limiting, multi-path kill switch, health-check monitoring with auto-halt thresholds, and post-test integrity validation.

### Human Oversight (HO) — 0/13 MET

Largest gap cluster. AEGIS today provides one decision point at engagement start (`siege --confirm`) and one termination path (Ctrl+C). The Phase-2 plan introduces a structured intervention API: pause/redirect/kill via SIGUSR1 + a JSONL-streamed engagement state, plus multi-channel notification hooks (Slack/email/PagerDuty/webhooks) for the escalation triggers.

### Graduated Autonomy (AL) — 2/11 MET

The two MET entries (AL-002 human-directed target/technique selection, AL-003 operator-configured parameters) reflect AEGIS's CLI-first, config-strict design. The PARTIAL/NOT-MET items are about the metadata layer (no AL-level tagging per scanner) and the runtime gating (no real-time approval gates). Phase 2 introduces AL-level metadata fields per scanner registration plus an approval-gate API.

### Auditability (AR) — 2/7 MET

JSON output + SARIF 2.1.0 emission already covers structured logging (AR-001) and per-finding confidence scoring (AR-004). Cryptographic hashing of evidence (AR-010), tamper-evident logging (AR-012), and evidence sensitivity classification (AR-015) are net-new for Phase 2 — a hash-chained audit-log channel paired with a SHA-256 field on every emitted finding.

### Manipulation Resistance (MR) — 2/13 MET

The two MET entries reflect existing scanner coverage on the targets being scanned (MR-003 error-neutrality via `error-leakage-checker`; MR-019 credential-protection via the four-scanner family). The orchestrator-side enforcement (config-integrity verification, authority-claim detection, OOB-communication blocking, model-I/O sandboxing) is net-new for Phase 2.

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

---

## Sign-off

This Readiness Assessment is published as an operator-provided self-assessment. Customers may independently verify these claims using the upstream OWASP/APTS [Vendor Evaluation Guide](https://github.com/OWASP/APTS/blob/main/standard/appendix/Vendor_Evaluation_Guide.md) or the [Customer Acceptance Testing](https://github.com/OWASP/APTS/blob/main/standard/appendix/Customer_Acceptance_Testing.md) appendix.

Bug reports, conformance-mapping disputes, and Phase-2 prioritization input welcomed via the AEGIS issue tracker.
