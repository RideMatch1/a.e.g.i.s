# OWASP-APTS Tier-1 Gap Summary — 2026-04-27

## Headline

AEGIS Autonomous Pentest Layer is currently **15/72 MET (21%)** on
OWASP-APTS Tier-1 (Phase 1 Readiness Assessment). Phase 2 closes the
remaining 55 gaps and converts this into a full Tier-1 Conformance Claim.

This is **not** a conformance claim. APTS forbids partial credit; a
Tier-1 conformance claim is achievable only after 100% MET. We're
publishing the gap, not the claim.

## Per-domain breakdown

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

### 2. Safety Controls (SC) — 0/6 MET

Per-wrapper safety controls today; no orchestrator-level baseline. Phase-2 plan:

- **Multi-path kill switch** — signal-based (SIGTERM with grace window + SIGKILL), API-based (`aegis siege --kill`), and dead-man-switch (heartbeat to operator-managed endpoint).
- **Health-check monitoring** — auto-halt thresholds on memory, error-rate, target-response-time.
- **Post-test integrity validation** — confirm target service responsiveness + final state-snapshot.
- **CIA impact-vector field** on Finding type — closes SC-001 + HO-012.

### 3. Manipulation Resistance (MR) — 2/13 MET

Existing MET coverage is on the *targets* AEGIS scans (error-leakage, credential-protection). Orchestrator-side enforcement is net-new. Phase-2 plan:

- **Config integrity verification** — SHA-256 hash-pin of `aegis.config.json` at engagement start; mid-run mutation detection (closes MR-004 + MR-012).
- **Authority-claim detection** in wrapper outputs — flag claimed admin-bypass without verification (MR-005).
- **OOB-communication blocker** on wrapper outputs — no DNS exfil, no out-of-engagement HTTP (MR-011).
- **Orchestrator-side redirect-following policy** — max-1-redirect, same-origin only (MR-007 + MR-008 + MR-009).
- **Per-wrapper container/sandbox isolation profile** in the wrapper-launcher (MR-018).

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

### 6. Scope Enforcement (SE) — 2/9 MET

Phase-2 plan:

- **Machine-readable RoE schema** (YAML/JSON) consumed at engagement start, with operator-signed acknowledgement field, temporal envelope, and asset-criticality classification (closes SE-001 + SE-003 + SE-004 + SE-005).
- **Per-action scope-object validation** in the siege phase loop (SE-006).
- **Live temporal-compliance monitor** with auto-halt past the temporal envelope (SE-008).
- **Dedicated scope-audit log channel** with hash-chain — combines with AR-012 closure (SE-015).

## Phase-2 cluster ordering (closure leverage)

| Order | Cluster | Closes | Lift |
|---|---|---|---|
| 1 | RoE schema + scope object | SE-001/003/004/005/006 + AL-006/014 | 7 entries |
| 2 | Intervention API + state-stream | HO-002/006/007/008 + AL-008/012 | 6 entries |
| 3 | Hash-chain + signed evidence | AR-010/012 + AL-005 + SE-015 | 4 entries |
| 4 | Orchestrator-side MR | MR-001/002/004/005/007/008/009/010/011/012/018 | 11 entries |
| 5 | Multi-path kill + health monitor | SC-009/010/015 + AL-016 | 4 entries |
| 6 | CIA scoring | SC-001 + HO-012 | 2 entries |

Six cluster-deliverables plausibly close 34 of the 55 remaining gaps.
The other 21 are smaller per-entry items distributed across the
narrative-form Gap Notes in [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md).

## Phase-2 ETA

8-12 weeks from Phase-1 publication for the full Tier-1 Conformance
Claim (all 72 MET). Cluster-1 (RoE schema) is the natural starting
point — high-leverage, no external dependencies, cleanly testable.

## What this is NOT

- This is **not** a conformance claim.
- AEGIS does **not** today claim OWASP-APTS Tier-1 conformance.
- The marketing-defensible claim from this Phase-1 release is:
  *"AEGIS publishes its OWASP-APTS Tier-1 Readiness Assessment — the first OSS pentest platform with a public APTS conformance posture."*
- After Phase 2 ships, the claim becomes:
  *"AEGIS publishes its full OWASP-APTS Tier-1 Conformance Claim — every Tier-1 requirement met with traceable evidence."*

See the design spec at [`docs/design/2026-04-27-owasp-apts-conformance.md`](../../design/2026-04-27-owasp-apts-conformance.md) for the staged 1→2→3 plan.
