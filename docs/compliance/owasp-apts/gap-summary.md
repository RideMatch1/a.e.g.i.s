# OWASP-APTS Tier-1 Gap Summary — 2026-04-27

## Headline

AEGIS Autonomous Pentest Layer is currently **49/72 MET (68%)** on
OWASP-APTS Tier-1 (Phase 1 baseline + Phase 2 Clusters 1 + 2 + 3 + 4 + 5
shipped on the same day). **Three domains remain fully met: Scope
Enforcement (SE 9/9), Manipulation Resistance (MR 13/13), and Reporting
(RP 3/3).** Phase 2's remaining cluster (Cluster-6, 8 reqs) closes a
further 8 gaps and converges on full Tier-1 closure for HO + SC and a
Tier-1 Conformance Claim.

This is **not** a conformance claim. APTS forbids partial credit; a
Tier-1 conformance claim is achievable only after 100% MET. We're
publishing the gap, not the claim.

**Phase-2 Cluster-1 (RoE schema) shipped — closes 8 entries.** The
machine-readable Rules-of-Engagement schema (Zod-strict JSON) plus the
in-scope/out-of-scope/temporal/asset-criticality validators plus the
`aegis siege --roe <path>` CLI integration flipped SE-001, SE-003,
SE-004, SE-005, SE-006, SE-008, AL-006, and AL-014 from
partially_met/not_met to met.

## Per-domain breakdown

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

## Strongest domains today

- **Reporting (RP) — 3/3 (100%)**. False-positive rate disclosure, vulnerability coverage disclosure, and executive-summary scoring are all already shipped.
- **Supply Chain Trust (TP) — 4/10 + 2 N/A (50% effective)**. Provider vetting, dependency inventory, cloud configuration, and Foundation Model Disclosure are all MET. Two N/A items are deliberate boundary decisions (self-hosted-by-consumer model).

## Weakest domains today (Phase-2 priority order)

### 1. Human Oversight (HO) — 0/13 MET — largest gap cluster

AEGIS today provides one decision point at engagement start (`siege --confirm`) and one termination path (Ctrl+C). The Phase-2 plan introduces:

- **Structured intervention API** — pause / redirect / kill via SIGUSR1 + a JSONL-streamed engagement state.
- **Multi-channel notification hooks** — Slack / email / PagerDuty / webhooks for escalation triggers.
- **Authority-delegation matrix** — formalized in the RoE schema.
- **Decision-timeout framework** — default-safe-behavior on indecision (halt > continue).

This is the single biggest Phase-2 deliverable and unlocks closure for HO + AL-008 + AL-011 + AL-016 jointly.

### 2. Safety Controls (SC) — 3/6 MET (Cluster-5 shipped)

After Phase-2 Cluster-5 the new `packages/core/src/safety-controls/` module + siege wiring close SC-009 (multi-path kill switch — signals + file-marker + dead-man heartbeat), SC-010 (health monitor with heap/error-rate/response-time auto-halt thresholds), and SC-015 (post-test integrity probe with baseline-spike detection). Remaining gaps:

- **CIA impact-vector field** on Finding type — closes SC-001 + HO-012 (Cluster-6).
- **Orchestrator-level rate limiting** + payload envelope — SC-004.
- **Per-scanner action allowlist** — SC-020.

### 3. Manipulation Resistance (MR) — 13/13 MET (Cluster-4 shipped)

After Phase-2 Cluster-4, the new `packages/core/src/manipulation-resistance/` enforcement module + siege wiring close the remaining 11 entries. Module + integration scope:

- **Instruction-boundary** — `enforceInstructionBoundary` with per-wrapper action allowlist + RoE scope check on target + payload URLs (MR-001).
- **Response validation + sanitization** — per-wrapper Zod schemas + 16-KiB cap + HTML encoding before findings emit (MR-002).
- **Config integrity** — SHA-256 hash-pin at engagement-start + per-phase verifyConfig (MR-004 + MR-012 jointly).
- **Authority-claim detection** — pattern detector on finding text; reject for RCE / reverse-shell, verify for admin / root claims (MR-005).
- **safeFetch** — orchestrator-side HTTP egress with manual redirect re-validation, DNS-rebind defense, and IP-class rejection of RFC 1918 / link-local / loopback / cloud-metadata (MR-007 + MR-008 + MR-009 jointly).
- **Scope-expansion detector** — pattern detector for adversarial directives in finding text; halt-pending on detection (MR-010).
- **Egress allowlist** — per-engagement allowlist composed from RoE + LLM-essentials, propagated via `AEGIS_EGRESS_ALLOWLIST` env (MR-011).
- **Wrapper sandboxing** — `--sandbox-mode docker|firejail|none` rewrites wrapper exec; docker mode enforces network restriction (MR-018).

### 4. Auditability (AR) — 2/7 MET — cryptographic gap

Phase-2 plan:

- **SHA-256 hash field** per Finding (AR-010).
- **Hash-chained audit-log file** — each entry's hash includes the previous entry's hash (AR-012).
- **Evidence-classification field** on Finding (public / internal / confidential) + sensitivity-aware redaction (AR-015).

### 5. Graduated Autonomy (AL) — 2/11 MET

Mostly resolved by HO closure (real-time approval gates) + boundary-DSL work. Phase-2 plan:

- **AL-level metadata field** per scanner registration; orchestrator labels each engagement-phase with the AL-level it operates under (AL-001).
- **Boundary-definition DSL** — multi-axis (paths, domains, time, assets, autonomy-level) replacing the current path-only `excludePaths` (AL-006 + AL-014).
- **Continuous boundary-monitor** that re-validates the scope-object on every scanner-emit (AL-016).

### 6. Scope Enforcement (SE) — 8/9 MET (Cluster-1 shipped)

Cluster-1 closed SE-001/003/004/005/006/008 in one shot via the
machine-readable RoE schema. Only SE-015 (separate audit log with
hash-chain integrity) remains, and that closure rolls into Cluster-3
(hash-chained audit-log file). No additional SE-specific work needed
in clusters 2/4/5/6.

## Phase-2 cluster ordering (closure leverage)

| Order | Cluster | Closes | Lift | Status |
|---|---|---|---|---|
| 1 | RoE schema + scope object | SE-001/003/004/005/006/008 + AL-006/014 | 8 entries | **shipped 2026-04-27** |
| 2 | Intervention API + JSONL state-stream + signals + webhooks | HO-002/006/008 + AL-011/012 + AR-002 (6 met) + HO-015/AL-008 (2 partial-bumps) | 8 entries | **shipped 2026-04-27** |
| 3 | Hash-chain + per-finding evidence_hash + audit-verify CLI + scope-validation events | AR-010/012 + AL-005 + SE-015 | 4 entries | **shipped 2026-04-27** |
| 4 | Orchestrator-side MR | MR-001/002/004/005/007/008/009/010/011/012/018 | 11 entries | **shipped 2026-04-27** |
| 5 | Multi-path kill + health + boundary monitor + decision timeout | SC-009/010/015 + AL-016 + HO-003 | 5 entries | **shipped 2026-04-27** |
| 6 | CIA scoring + HO oversight stack | SC-001 + HO-001/004/010/011/012/013/014 | 8 entries | queued |

Cluster-1 shipped 8/72 entries on the same day as the Phase-1 baseline
(15/72 → 23/72). Remaining five clusters plausibly close 27 of the 49
remaining gaps. The other 22 are smaller per-entry items distributed
across the narrative-form Gap Notes in [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md).

## Phase-2 ETA

7-11 weeks from now for the full Tier-1 Conformance Claim (all 72 MET).
Cluster-2 (intervention API + state-stream) is the next natural step
— it unlocks both the HO gaps (Human Oversight) and AL-008/012 in one
deliverable.

## What this is NOT

- This is **not** a conformance claim.
- AEGIS does **not** today claim OWASP-APTS Tier-1 conformance.
- The marketing-defensible claim from this release is:
  *"AEGIS publishes its OWASP-APTS Tier-1 Readiness Assessment — the first OSS pentest platform with a public APTS conformance posture, with Cluster-1 of Phase 2 (machine-readable Rules-of-Engagement schema) already shipped."*
- After Phase 2 fully ships, the claim becomes:
  *"AEGIS publishes its full OWASP-APTS Tier-1 Conformance Claim — every Tier-1 requirement met with traceable evidence."*

See the design spec at [`docs/design/2026-04-27-owasp-apts-conformance.md`](../../design/2026-04-27-owasp-apts-conformance.md) for the staged 1→2→3 plan.
