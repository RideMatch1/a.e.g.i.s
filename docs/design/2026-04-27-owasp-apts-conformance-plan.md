# OWASP-APTS Conformance Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the WP-A1 Phase-1 deliverables — a public OWASP-APTS Tier-1 Readiness/Gap Assessment for the AEGIS Autonomous Pentest Layer, doc-only, zero blast-radius.

**Architecture:** New `docs/compliance/owasp-apts/` subtree with 7 Markdown + 1 JSON files. No code changes in this phase. All 72 Tier-1 APTS requirements get explicit status (`met`/`partially_met`/`not_met`/`not_applicable`/`planned`). Machine-readable claim conforms to APTS Conformance_Claim_Schema.

**Tech Stack:** Markdown, JSON (APTS schema v0.1.0), CC BY-SA 4.0 attribution for derived templates, MIT for AEGIS-original content. Validation via `jq`, `python3 -c`, `grep`.

**Spec reference:** `docs/design/2026-04-27-owasp-apts-conformance.md`
**Upstream APTS:** `https://github.com/OWASP/APTS` (v0.1.0, Incubator) — local clone of relevant files at `/tmp/apts-spec/`

---

## File Structure

| Path | Purpose | Origin |
|---|---|---|
| `docs/compliance/owasp-apts/README.md` | Entry point: what is APTS, what's here, how to read | original |
| `docs/compliance/owasp-apts/CONFORMANCE-CLAIM.md` | Filled APTS template, marked **Tier-1 Readiness Assessment** | derived from APTS Conformance_Claim_Template (CC BY-SA 4.0) |
| `docs/compliance/owasp-apts/conformance.json` | Machine-readable claim, all 72 Tier-1 entries | derived from APTS Conformance_Claim_Schema |
| `docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md` | Per-req evidence trail (paths, line refs, commit SHAs) | original |
| `docs/compliance/owasp-apts/FOUNDATION-MODEL-DISCLOSURE.md` | APTS-TP-021 BYOM mapping for 3 wrappers + fix-mode | derived from APTS template |
| `docs/compliance/owasp-apts/gap-summary.md` | TL;DR table of MET/PARTIAL/NOT-MET counts per domain | original |
| `docs/compliance/owasp-apts/attribution.md` | CC BY-SA 4.0 attribution + AEGIS license note | required by upstream license |
| `README.md` (root) | New "OWASP-APTS Conformance Posture" section linking to the new subtree | modified |
| `CHANGELOG.md` | Unreleased entry | modified |
| `aegis-precision/v018-apts-phase1-handover.md` | Phase-2 punch list, executor notes, post-ship hand-over | original |

---

## Decision Rubric (used by Tasks 3-4)

When classifying each of the 72 Tier-1 reqs, apply this rubric in order:

1. **`met`** — there is concrete code, doc, test, or CI gate in the AEGIS repo that can be pointed to. The reviewer would agree the requirement is satisfied without further argument.
2. **`partially_met`** — the requirement is partially addressed; clearly something is implemented but not the full scope. Document specifically what is + what is missing.
3. **`not_met`** — no implementation today. Honest gap.
4. **`not_applicable`** — the requirement does not apply to the AEGIS Autonomous Pentest Layer scope (rare; usually only for tier 2+ items, but a few Tier-1 reqs may N/A out under the β scope boundary).
5. **`planned`** — explicitly committed for Phase 2 (ETA in handover doc).

**Hard rules:**
- Never mark `met` without a concrete evidence path in EVIDENCE-MANIFEST.md.
- Never mark `not_applicable` without a one-line rationale tied to the boundary statement.
- When in doubt between `met` and `partially_met`, choose `partially_met`. Better honest gap than over-claim.

---

## Task 1: Foundation triplet — directory + README + attribution

**Files:**
- Create: `docs/compliance/owasp-apts/README.md`
- Create: `docs/compliance/owasp-apts/attribution.md`

- [ ] **Step 1: Create the README entry-point**

```markdown
# OWASP-APTS Conformance Posture

This subtree contains AEGIS's public OWASP Autonomous Penetration
Testing Standard (APTS) conformance posture.

## What is APTS

OWASP/APTS v0.1.0 is a governance standard for autonomous penetration
testing platforms. It defines 173 tier-required requirements across 8
domains (Scope Enforcement, Safety Controls, Human Oversight, Graduated
Autonomy, Auditability, Manipulation Resistance, Supply Chain Trust,
Reporting), tiered Foundation/Enhanced/Advanced.

Upstream: [github.com/OWASP/APTS](https://github.com/OWASP/APTS)
License: CC BY-SA 4.0

## Phase 1 — Tier-1 Readiness Assessment (this release)

This release publishes a **Tier-1 Readiness Assessment** — explicitly
**not** a conformance claim. APTS forbids partial credit; a claim
requires 100% MET on the claimed tier. This release transparently
discloses where AEGIS sits today against the 72 Tier-1 requirements.

## Files

- [`CONFORMANCE-CLAIM.md`](./CONFORMANCE-CLAIM.md) — filled human-readable APTS template
- [`conformance.json`](./conformance.json) — machine-readable claim per APTS schema
- [`EVIDENCE-MANIFEST.md`](./EVIDENCE-MANIFEST.md) — per-requirement evidence trail
- [`FOUNDATION-MODEL-DISCLOSURE.md`](./FOUNDATION-MODEL-DISCLOSURE.md) — APTS-TP-021 BYOM disclosure
- [`gap-summary.md`](./gap-summary.md) — TL;DR table of MET/PARTIAL/NOT-MET counts
- [`attribution.md`](./attribution.md) — CC BY-SA 4.0 attribution chain

## Boundary

This conformance posture covers the **AEGIS Autonomous Pentest Layer**:
`aegis siege` (4-phase live-attack simulation) plus the integrated
LLM-pentest wrappers (Strix, PTAI, Pentest-Swarm-AI) plus the CLI
orchestration around them.

Deterministic SAST/DAST scanners (`aegis scan` / `aegis audit`), the
`@aegis-scan/skills` methodology library, and the `@aegis-wizard/cli`
scaffold generator are **supporting components**, explicitly **not**
part of this conformance claim, because they do not operate
autonomously in the APTS sense.

## Roadmap

- **Phase 1** (this release): Tier-1 Readiness Assessment
- **Phase 2**: Tier-1 Full Conformance Claim (close all Tier-1 gaps)
- **Phase 3**: Tier-2 Climb

See the design spec: [`docs/design/2026-04-27-owasp-apts-conformance.md`](../../design/2026-04-27-owasp-apts-conformance.md)
```

- [ ] **Step 2: Create the attribution doc**

```markdown
# Attribution and License

## Upstream attribution: OWASP/APTS

Portions of this subtree (the conformance-claim template structure,
the machine-readable claim schema, the evidence-package manifest
layout, and the foundation-model disclosure section) are derived from
the **OWASP Autonomous Penetration Testing Standard v0.1.0**, which
is licensed under **Creative Commons Attribution-ShareAlike 4.0
International (CC BY-SA 4.0)**.

- Upstream repository: https://github.com/OWASP/APTS
- License: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/
- Standard version: v0.1.0
- Date pulled: 2026-04-27

## What is derived

| Derived file | Upstream source |
|---|---|
| `CONFORMANCE-CLAIM.md` | `standard/appendix/Conformance_Claim_Template.md` |
| `conformance.json` (structure) | `standard/appendix/Conformance_Claim_Schema.md` + `standard/apts_requirements_schema.json` |
| `EVIDENCE-MANIFEST.md` (structure) | `standard/appendix/Evidence_Package_Manifest.md` |
| `FOUNDATION-MODEL-DISCLOSURE.md` (section 2 layout) | `standard/appendix/Conformance_Claim_Template.md` § Foundation Model Disclosure |

## Share-Alike obligation

CC BY-SA 4.0 requires that derivative works are licensed under the
same terms. The above-listed files are therefore licensed under
**CC BY-SA 4.0** — anyone may re-use, modify, and distribute them
under the same license, with attribution preserved.

## AEGIS-original content

All other files in this subtree (notably `README.md`, `gap-summary.md`,
the AEGIS-specific evidence claims, and any AEGIS-side opinion or
narrative) are **AEGIS-original** and are licensed under the
[AEGIS top-level MIT license](../../../LICENSE).

The repository as a whole remains MIT-licensed; this subtree's
APTS-derived files carry CC BY-SA 4.0 as required by the upstream
share-alike clause. The two licenses do not conflict because the
CC BY-SA-licensed files are clearly identified above.
```

- [ ] **Step 3: Validate paths resolve**

Run:
```bash
test -f /Users/lukashertle/Developer/projects/aegis/docs/compliance/owasp-apts/README.md && \
test -f /Users/lukashertle/Developer/projects/aegis/docs/compliance/owasp-apts/attribution.md && \
echo OK
```
Expected: `OK`

- [ ] **Step 4: Validate cross-references**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
grep -cE '\]\(\./[a-zA-Z0-9.-]+\.(md|json)\)' docs/compliance/owasp-apts/README.md
```
Expected: `6` (links to CONFORMANCE-CLAIM.md, conformance.json, EVIDENCE-MANIFEST.md, FOUNDATION-MODEL-DISCLOSURE.md, gap-summary.md, attribution.md). The link to the design spec at `../../design/...` does NOT match because of the `./` prefix-anchor in the regex — that's intentional, we only count the in-subtree cross-refs.

- [ ] **Step 5: Commit**

```bash
git add docs/compliance/owasp-apts/README.md docs/compliance/owasp-apts/attribution.md
git commit -m "docs(compliance): add OWASP-APTS subtree README + CC BY-SA 4.0 attribution"
```

---

## Task 2: Foundation Model Disclosure (APTS-TP-021)

**Files:**
- Create: `docs/compliance/owasp-apts/FOUNDATION-MODEL-DISCLOSURE.md`

- [ ] **Step 1: Verify what wrappers exist + their LLM-touchpoints**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
ls packages/scanners/src/dast/ 2>&1 && \
echo "---fix-mode---" && \
ls packages/cli/src/commands/fix.ts packages/cli/src/fix/ 2>&1
```
Expected: lists `strix.ts`, `ptai.ts`, `pentestswarm.ts` (or similar) under dast/ + the fix.ts source.

- [ ] **Step 2: Read each wrapper's actual LLM-touchpoints**

Run for each:
```bash
grep -nE 'LLM_API_KEY|ANTHROPIC|OPENAI|OLLAMA|LITELLM|model' packages/scanners/src/dast/*.ts | head -30
```
Note which providers each wrapper supports — this informs the BYOM matrix.

- [ ] **Step 3: Write the disclosure file**

The file content is derived from APTS Conformance_Claim_Template § Foundation Model Disclosure. It must include, per APTS-TP-021:
- Provider, Model Family, Version Identifier, Release Date
- Fine-Tunes/Adapters, Capability Baseline Reference
- Last Re-attestation Date, Next Scheduled Review

For AEGIS-specific BYOM: ONE table per wrapper + ONE for fix-mode, each with the supported providers and the AEGIS-side note about how the operator chooses.

Template:
```markdown
# Foundation Model Disclosure (APTS-TP-021)

## AEGIS Bring-Your-Own-Model (BYOM) posture

The AEGIS Autonomous Pentest Layer does not pin a foundation model.
Each integrated wrapper supports operator-chosen providers via its
own configuration surface. This disclosure documents the provider/
model matrix supported by each wrapper as of the claim date.

The operator is responsible for declaring which model is in use at
runtime and for keeping their own re-attestation records per
APTS-TP-022. AEGIS provides the matrix; the operator provides the
attestation against their actual deployment.

## Wrapper: Strix (`packages/scanners/src/dast/strix.ts`)

| Field | Value |
|-------|-------|
| Provider | Operator-chosen via LiteLLM |
| Supported families | OpenAI GPT-* · Anthropic Claude * · Google Gemini * |
| Default model | None pinned by AEGIS |
| Version Identifier | Operator-set via `STRIX_LLM` + `LLM_API_KEY` env |
| Capability Baseline Reference | Provider's official model card at the configured version |
| Re-attestation cadence | Operator owns; AEGIS recommends per-major-AEGIS-release |

(Same table for PTAI, Pentest-Swarm-AI, fix-mode — fill from Step 2 grep output.)

## Operator obligations

For each engagement claiming APTS-TP-021 conformance, the operator
must:

1. Record the exact model version (not "latest") used for that engagement
2. Reference the provider's capability baseline (model card link + retrieval date)
3. Document any fine-tunes or adapters applied
4. Maintain re-attestation records when the model family or version changes

AEGIS provides templates for this in
[`docs/compliance/owasp-apts/templates/`](./templates/) (deferred to Phase 2).
```

- [ ] **Step 4: Validate**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
grep -cE '^## Wrapper:' docs/compliance/owasp-apts/FOUNDATION-MODEL-DISCLOSURE.md
```
Expected: `3` (one per wrapper) + the fix-mode under its own ## section. Adjust regex to match the structure actually written.

- [ ] **Step 5: Commit**

```bash
git add docs/compliance/owasp-apts/FOUNDATION-MODEL-DISCLOSURE.md
git commit -m "docs(compliance): APTS-TP-021 Foundation Model Disclosure (BYOM matrix)"
```

---

## Task 3: Conformance JSON — all 72 Tier-1 entries

**Files:**
- Create: `docs/compliance/owasp-apts/conformance.json`

This is the densest task. It's broken into 8 sub-steps (one per domain) plus skeleton + validation.

- [ ] **Step 1: Build the JSON skeleton**

Write the metadata frame; entries get appended in subsequent sub-steps.

```json
{
  "claim_id": "aegis-apts-readiness-2026-04-27",
  "standard_version": "0.1.0",
  "published_at": "2026-04-27T00:00:00Z",
  "assessment_date": "2026-04-27",
  "assessment_type": "internal_self_assessment",
  "assessment_phase": "Tier-1 Readiness Assessment (NOT a conformance claim)",
  "claim_owner": {
    "organization": "AEGIS maintainer team",
    "contact": "https://github.com/RideMatch1/a.e.g.i.s/issues"
  },
  "platform": {
    "platform_name": "AEGIS Autonomous Pentest Layer",
    "platform_version": "@aegis-scan/cli v0.16.6 (siege-mode + LLM-pentest wrappers)",
    "operator_type": "open_source_project",
    "deployment_model": "self_hosted_by_consumer",
    "foundation_model_disclosure_reference": "FOUNDATION-MODEL-DISCLOSURE.md"
  },
  "claimed_conformance": {
    "claimed_tier": 1,
    "claim_type": "readiness_assessment",
    "claimed_domains": ["SE", "SC", "HO", "AL", "AR", "MR", "TP", "RP"],
    "autonomy_levels_supported": ["L1", "L2"],
    "assessment_scope": {
      "in_scope": [
        "aegis siege (4-phase live-attack simulation)",
        "Strix LLM-pentest wrapper",
        "PTAI LLM-pentest wrapper",
        "Pentest-Swarm-AI LLM-pentest wrapper",
        "CLI orchestration of the above"
      ],
      "out_of_scope": [
        "deterministic SAST scanners (aegis scan / aegis audit)",
        "@aegis-scan/skills methodology library",
        "@aegis-wizard/cli scaffold generator"
      ]
    }
  },
  "requirements": []
}
```

The `requirements` array gets populated in steps 2-9.

- [ ] **Step 2: Add SE (Scope Enforcement) — 9 entries**

Source IDs (verified): `SE-001, SE-002, SE-003, SE-004, SE-005, SE-006, SE-008, SE-009, SE-015`.

For each, write an entry of the shape:
```json
{
  "requirement_id": "APTS-SE-NNN",
  "status": "<met|partially_met|not_met|not_applicable|planned>",
  "rationale": "<one sentence, concrete>",
  "evidence_refs": ["<ev-id>", ...]
}
```

Pre-classified candidates (apply rubric, defend each):
- `SE-002` (RFC 1918) → `met` — `ssrf-checker` private-IP rules
- `SE-009` (Hard Deny Lists) → `met` — `aegis.config.json` excludePaths
- `SE-001` (RoE Specification) → `partially_met` — `aegis siege --target URL --confirm` is a minimal RoE; no machine-readable RoE schema yet
- `SE-003` (Domain Scope) → `partially_met` — single URL accepted, no wildcard handling
- `SE-004` (Temporal Boundary) → `not_met` — no scheduled-window enforcement
- `SE-005` (Asset Criticality) → `not_met` — no criticality classification metadata
- `SE-006` (Pre-Action Scope Validation) → `partially_met` — `--confirm` flag is pre-action gate
- `SE-008` (Temporal Compliance Monitoring) → `not_met` — no live monitoring
- `SE-015` (Scope Enforcement Audit) → `partially_met` — JSON output captures targets but not a formal audit trail

Each `met` / `partially_met` entry MUST have `evidence_refs` populated (those IDs are defined in EVIDENCE-MANIFEST in Task 4).

- [ ] **Step 3: Add SC (Safety Controls) — 6 entries**

IDs: `SC-001, SC-004, SC-009, SC-010, SC-015, SC-020`.

Pre-classified:
- `SC-001` (CIA Scoring) → `partially_met` — CWE-based severity is CIA-adjacent but not a formal CIA-vector
- `SC-004` (Rate Limiting) → `partially_met` — wrappers accept rate-limit flags; AEGIS-orchestrator-side has no global rate-limit
- `SC-009` (Kill Switch) → `partially_met` — `Ctrl+C` works, no formal multi-path kill switch
- `SC-010` (Health Check Monitoring) → `not_met` — no health monitoring
- `SC-015` (Post-Test System Integrity) → `not_met` — no post-test integrity validation
- `SC-020` (Action Allowlist) → `partially_met` — wrapper-mode-gate is an allowlist of which scanners run; not a fine-grained action allowlist

- [ ] **Step 4: Add HO (Human Oversight) — 13 entries**

IDs: `HO-001, HO-002, HO-003, HO-004, HO-006, HO-007, HO-008, HO-010, HO-011, HO-012, HO-013, HO-014, HO-015`.

Pre-classified — most are gaps (HO is autonomous-platform-specific):
- `HO-001` (Pre-Approval Gates L1/L2) → `partially_met` — `--mode pentest` opt-in is a pre-approval gesture
- `HO-002` (Real-Time Monitoring) → `not_met` — no real-time intervention surface
- `HO-003` (Decision Timeout) → `not_met`
- `HO-004` (Authority Delegation Matrix) → `not_met`
- `HO-006` (Graceful Pause + State Preservation) → `not_met`
- `HO-007` (Mid-Engagement Redirect) → `not_met`
- `HO-008` (Immediate Kill Switch + State Dump) → `not_met` — Ctrl+C kills without state-dump
- `HO-010` (Mandatory Human Decision Points) → `partially_met` — `--confirm` is one
- `HO-011` (Unexpected Findings Escalation) → `not_met`
- `HO-012` (Impact Threshold Breach Escalation) → `not_met`
- `HO-013` (Confidence-Based Escalation) → `partially_met` — `[LOW-CONFIDENCE]` PR badge is a low-fidelity escalation signal
- `HO-014` (Legal/Compliance Escalation) → `not_met`
- `HO-015` (Real-Time Activity Monitoring) → `not_met`

This is the weakest domain for AEGIS today. Phase 2 priority.

- [ ] **Step 5: Add AL (Graduated Autonomy) — 11 entries**

IDs: `AL-001, AL-002, AL-003, AL-004, AL-005, AL-006, AL-008, AL-011, AL-012, AL-014, AL-016`.

Pre-classified:
- `AL-001` (Single Technique Execution) → `partially_met` — wrappers execute single-technique-per-call but no AEGIS-orchestrator labeling
- `AL-002` (Human-Directed Target/Technique Selection) → `met` — operator passes `--target URL` + selects scanner mode
- `AL-003` (Parameter Configuration by Human) → `met` — `aegis.config.json` is fully operator-configured
- `AL-004` (No Automated Chaining) → `partially_met` — siege has 4 phases (chained); operator opts in via `--confirm`
- `AL-005` (Mandatory Logging + Reviewable Audit Trail) → `partially_met` — JSON output is reviewable, not signed
- `AL-006` (Basic Scope Validation + Policy Enforcement) → `partially_met` — `excludePaths` + `--target` validation
- `AL-008` (Real-Time Human Monitoring + Approval Gates) → `not_met` — no real-time gating
- `AL-011` (Escalation Triggers + Exception Handling) → `not_met`
- `AL-012` (Kill Switch + Pause Capability) → `partially_met` — Ctrl+C only
- `AL-014` (Boundary Definition + Enforcement Framework) → `partially_met` — `excludePaths` is a boundary; not a framework
- `AL-016` (Continuous Boundary Monitoring + Breach Detection) → `not_met`

- [ ] **Step 6: Add AR (Auditability) — 7 entries**

IDs: `AR-001, AR-002, AR-004, AR-006, AR-010, AR-012, AR-015`.

Pre-classified:
- `AR-001` (Structured Event Logging w/ Schema Validation) → `met` — JSON output + SARIF 2.1.0
- `AR-002` (State Transition Logging) → `partially_met` — scan-progress events emitted; not formally structured
- `AR-004` (Decision Point Logging + Confidence Scoring) → `met` — per-finding `confidence` field
- `AR-006` (Decision Chain of Reasoning + Alternative Eval) → `partially_met` — taint chain via `relatedLocations`; no alternative-evaluation log
- `AR-010` (Cryptographic Hashing of All Evidence) → `not_met`
- `AR-012` (Tamper-Evident Logging w/ Hash Chains) → `not_met`
- `AR-015` (Evidence Classification + Sensitive Data Handling) → `not_met`

- [ ] **Step 7: Add MR (Manipulation Resistance) — 13 entries**

IDs: `MR-001, MR-002, MR-003, MR-004, MR-005, MR-007, MR-008, MR-009, MR-010, MR-011, MR-012, MR-018, MR-019`.

Pre-classified:
- `MR-001` (Instruction Boundary Enforcement) → `partially_met` — wrappers each enforce their own; no AEGIS-orchestrator-side enforcement
- `MR-002` (Response Validation + Sanitization) → `partially_met`
- `MR-003` (Error Message Neutrality) → `met` — AEGIS findings sanitize stack traces (`error-leakage-checker`'s own pattern)
- `MR-004` (Configuration File Integrity) → `not_met`
- `MR-005` (Authority Claim Detection + Rejection) → `not_met`
- `MR-007` (Redirect Following Policy) → `partially_met` — `open-redirect-checker` exists at SAST level
- `MR-008` (DNS + Network-Level Redirect Prevention) → `partially_met` — `ssrf-checker` covers some
- `MR-009` (SSRF Prevention in Testing) → `partially_met` — same as MR-008
- `MR-010` (Scope Expansion Social Engineering) → `not_met`
- `MR-011` (Out-of-Band Communication Prevention) → `not_met`
- `MR-012` (Immutable Scope Enforcement Architecture) → `partially_met` — `aegis.config.json` is read-once-per-run
- `MR-018` (AI Model Input/Output Architectural Boundary) → `not_met`
- `MR-019` (Discovered Credential Protection) → `met` — `next-public-leak`, `entropy-scanner`, `crypto-auditor`, `jwt-detector`

- [ ] **Step 8: Add TP (Supply Chain Trust) — 10 entries**

IDs: `TP-001, TP-003, TP-005, TP-006, TP-008, TP-012, TP-013, TP-014, TP-018, TP-021`.

Pre-classified:
- `TP-001` (Provider Selection + Vetting) → `met` — wrapper `isAvailable()` + double-gating documented
- `TP-003` (API Security + Authentication) → `partially_met` — operator-managed env-var auth; AEGIS doesn't mediate
- `TP-005` (Provider Incident Response + Breach Notification) → `not_met`
- `TP-006` (Dependency Inventory + Risk Assessment) → `met` — `supply-chain` scanner + `dep-confusion-checker`
- `TP-008` (Cloud Security Configuration) → `met` — `config-auditor`, `header-checker`, GHA hardening
- `TP-012` (Client Data Classification Framework) → `not_met` — N/A under self-hosted-by-consumer model? Re-evaluate during execution
- `TP-013` (Sensitive Data Discovery + Handling) → `partially_met` — `entropy-scanner`, `next-public-leak`
- `TP-014` (Data Encryption + Cryptographic Controls) → `partially_met` — `crypto-auditor` flags weak crypto
- `TP-018` (Tenant Breach Notification) → `not_applicable` — under self-hosted-by-consumer, no AEGIS-side tenancy
- `TP-021` (Foundation Model Disclosure + Capability Baseline) → `met` — see `FOUNDATION-MODEL-DISCLOSURE.md`

- [ ] **Step 9: Add RP (Reporting) — 3 entries**

IDs: `RP-006, RP-008, RP-011`.

Pre-classified:
- `RP-006` (False Positive Rate Disclosure) → `met` — `[LOW-CONFIDENCE]` PR badge + per-CWE confidence rules
- `RP-008` (Vulnerability Coverage Disclosure) → `met` — README scanner inventory + `getAllScanners()` registry
- `RP-011` (Executive Summary + Risk Overview) → `met` — score + grade + badge in every report

- [ ] **Step 10: Validate**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
python3 -c "
import json
with open('docs/compliance/owasp-apts/conformance.json') as f:
    claim = json.load(f)
reqs = claim['requirements']
print(f'Total entries: {len(reqs)}')

# Check exactly 72
assert len(reqs) == 72, f'expected 72, got {len(reqs)}'

# Check all IDs are unique
ids = [r['requirement_id'] for r in reqs]
assert len(set(ids)) == len(ids), 'duplicate IDs found'

# Check all IDs exist in upstream Tier-1 set
with open('/tmp/apts-spec/apts_requirements.json') as f:
    upstream = json.load(f)
tier1_ids = {r['id'] for r in upstream['requirements'] if r['tier']==1}
ours = set(ids)
missing = tier1_ids - ours
extra = ours - tier1_ids
assert not missing, f'missing Tier-1 IDs: {missing}'
assert not extra, f'extra IDs (not Tier-1): {extra}'

# Check status values
valid = {'met','partially_met','not_met','not_applicable','planned'}
for r in reqs:
    assert r['status'] in valid, f'{r[\"requirement_id\"]}: invalid status {r[\"status\"]}'

# Met entries must have evidence_refs
for r in reqs:
    if r['status'] == 'met':
        assert r.get('evidence_refs'), f'{r[\"requirement_id\"]}: met without evidence_refs'

print('OK — all 72 Tier-1 entries, all IDs valid, all statuses valid, all met-entries have evidence')
"
```
Expected: ends with `OK — all 72 Tier-1 entries, all IDs valid, all statuses valid, all met-entries have evidence`

- [ ] **Step 11: Commit**

```bash
git add docs/compliance/owasp-apts/conformance.json
git commit -m "docs(compliance): conformance.json — 72 Tier-1 entries with explicit status + evidence refs"
```

---

## Task 4: Evidence manifest

**Files:**
- Create: `docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md`

For each `met` entry in `conformance.json`, write a section under
`## Evidence Items`. For each `partially_met` and `not_met` entry,
write a section under `## Gap Notes`.

- [ ] **Step 1: Generate the skeleton from conformance.json**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
python3 -c "
import json
with open('docs/compliance/owasp-apts/conformance.json') as f:
    claim = json.load(f)
reqs = claim['requirements']
met = [r for r in reqs if r['status']=='met']
partial = [r for r in reqs if r['status']=='partially_met']
notmet = [r for r in reqs if r['status']=='not_met']
print(f'met: {len(met)} | partial: {len(partial)} | not_met: {len(notmet)}')
print('--- met IDs ---')
for r in met: print(f'  {r[\"requirement_id\"]}')
"
```

- [ ] **Step 2: Write the manifest**

Structure:
```markdown
# Evidence Manifest — Phase 1 Tier-1 Readiness

**Pinned at:** AEGIS HEAD `<git-rev-parse-HEAD-output>` as of 2026-04-27
**Schema:** APTS Evidence_Package_Manifest (CC BY-SA 4.0)

## Evidence Items (referenced by `met` requirements)

### `ev-ssrf-rfc1918`
- **Type:** code-rule
- **Path:** `packages/scanners/src/ssrf-checker.ts`
- **What it proves:** APTS-SE-002 (IP Range Validation, RFC 1918 awareness)
- **Captured at:** 2026-04-27
- **Sensitivity:** public

### `ev-config-deny`
- **Type:** config-schema
- **Path:** `aegis.config.json` schema § excludePaths
- **What it proves:** APTS-SE-009 (Hard Deny Lists)
- **Captured at:** 2026-04-27
- **Sensitivity:** public

(continue for every `met` entry — write one block per evidence-ref-id used in conformance.json)

## Gap Notes (`partially_met` and `not_met`)

### APTS-HO-002 — Real-Time Monitoring and Intervention Capability
- **Status:** not_met
- **Today:** AEGIS emits scan-progress events to stdout but has no
  intervention surface. The operator can Ctrl+C but cannot redirect
  or pause-and-resume.
- **Phase-2 plan:** Add a structured progress channel (JSONL stream)
  with an intervention-API for SIGUSR1-style pause/redirect.

(continue for every partially_met and not_met entry)
```

- [ ] **Step 3: Validate every met-entry has at least one evidence path documented**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
python3 -c "
import json, re
with open('docs/compliance/owasp-apts/conformance.json') as f:
    claim = json.load(f)
ev_refs = set()
for r in claim['requirements']:
    for e in r.get('evidence_refs', []):
        ev_refs.add(e)

with open('docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md') as f:
    body = f.read()
declared = set(re.findall(r'### \`(ev-[a-z0-9-]+)\`', body))
missing = ev_refs - declared
extra = declared - ev_refs
print(f'evidence-refs in conformance.json: {len(ev_refs)}')
print(f'evidence items in manifest: {len(declared)}')
assert not missing, f'evidence-refs not documented: {missing}'
print('OK')
"
```
Expected: `OK`

- [ ] **Step 4: Pin the HEAD SHA in the manifest**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
HEAD=$(git rev-parse HEAD) && \
sed -i.bak "s|\`<git-rev-parse-HEAD-output>\`|\`$HEAD\`|" docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md && \
rm docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md.bak && \
grep "Pinned at" docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md
```
Expected: prints the line with the actual SHA filled in.

- [ ] **Step 5: Commit**

```bash
git add docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md
git commit -m "docs(compliance): evidence manifest — paths for every met-entry + gap notes"
```

---

## Task 5: Human-readable conformance claim

**Files:**
- Create: `docs/compliance/owasp-apts/CONFORMANCE-CLAIM.md`

- [ ] **Step 1: Write the filled APTS template**

Use the upstream Conformance_Claim_Template (CC BY-SA 4.0). Mark
explicitly as **"Tier-1 Readiness Assessment Phase 1 — NOT a Conformance Claim"**.

Header sections:
1. Conformance Claim metadata table (Org, Platform, APTS Version, Claim Date, Assessment Method, Contact)
2. **Phase 1 Disclaimer** (block-quote, large) — "This is a transparent readiness assessment. APTS forbids partial credit; a Tier-1 conformance claim requires 100% MET on all 72 Tier-1 requirements. AEGIS today does NOT meet that bar. This document discloses where AEGIS stands as of 2026-04-27."
3. Scope of Claim — boundary statement (in-scope + out-of-scope)
4. Foundation Model Disclosure — link to FOUNDATION-MODEL-DISCLOSURE.md
5. Domain Summary table — populated from conformance.json counts
6. Requirement-by-requirement details — auto-generate per-domain section from conformance.json
7. Declared Scope Boundaries — restate what's out-of-scope and why
8. Evidence Availability — link to EVIDENCE-MANIFEST.md
9. Revision History

- [ ] **Step 2: Generate the Domain Summary table from conformance.json**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
python3 -c "
import json
from collections import Counter, defaultdict
with open('docs/compliance/owasp-apts/conformance.json') as f:
    claim = json.load(f)
by_dom = defaultdict(list)
for r in claim['requirements']:
    dom = r['requirement_id'].split('-')[1]
    by_dom[dom].append(r)
print('| Domain | Total Tier-1 | Met | Partially | Not Met | N/A | Planned |')
print('|---|---|---|---|---|---|---|')
totals = Counter()
for dom in ['SE','SC','HO','AL','AR','MR','TP','RP']:
    statuses = Counter(r['status'] for r in by_dom[dom])
    n_total = len(by_dom[dom])
    met = statuses.get('met',0)
    partial = statuses.get('partially_met',0)
    notmet = statuses.get('not_met',0)
    na = statuses.get('not_applicable',0)
    planned = statuses.get('planned',0)
    print(f'| {dom} | {n_total} | {met} | {partial} | {notmet} | {na} | {planned} |')
    for k,v in statuses.items():
        totals[k] += v
print(f'| **Total** | **72** | **{totals[\"met\"]}** | **{totals[\"partially_met\"]}** | **{totals[\"not_met\"]}** | **{totals[\"not_applicable\"]}** | **{totals[\"planned\"]}** |')
"
```

Paste the output into the Domain Summary section.

- [ ] **Step 3: Validate cross-references resolve**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
grep -E '\(\.\/[A-Z-]+\.md\)' docs/compliance/owasp-apts/CONFORMANCE-CLAIM.md
```
Expected: at least 3 internal links (to FOUNDATION-MODEL-DISCLOSURE, EVIDENCE-MANIFEST, attribution).

- [ ] **Step 4: Validate the Phase 1 Disclaimer is unambiguous**

Run:
```bash
grep -c "Readiness Assessment" docs/compliance/owasp-apts/CONFORMANCE-CLAIM.md
```
Expected: ≥ 3 occurrences (header, disclaimer block, revision history).

- [ ] **Step 5: Commit**

```bash
git add docs/compliance/owasp-apts/CONFORMANCE-CLAIM.md
git commit -m "docs(compliance): human-readable Tier-1 Readiness Assessment (filled APTS template)"
```

---

## Task 6: Gap summary (TL;DR)

**Files:**
- Create: `docs/compliance/owasp-apts/gap-summary.md`

- [ ] **Step 1: Write the TL;DR**

Structure:
```markdown
# OWASP-APTS Tier-1 Gap Summary — 2026-04-27

## Headline

AEGIS Autonomous Pentest Layer is currently **<X>/72 MET** on
OWASP-APTS Tier-1 (Phase 1 Readiness Assessment). Phase 2 closes the
gaps and converts this to a full Tier-1 Conformance Claim.

## Per-domain breakdown

(paste the Domain Summary table from CONFORMANCE-CLAIM.md)

## Top-3 gap clusters

1. **Human Oversight (HO)** — <N>/13 MET. AEGIS today has no real-time
   intervention surface. Phase 2 priority: structured progress channel
   + intervention API (SIGUSR1 pause/redirect, JSONL stream).
2. **Auditability (AR)** — <N>/7 MET. No cryptographic hashing or
   tamper-evident logging on findings/evidence today. Phase 2 priority:
   hash-chain on the JSON output writer.
3. **Manipulation Resistance (MR)** — <N>/13 MET. AEGIS-orchestrator
   has no own boundary-enforcement; it relies on each wrapper's
   internal enforcement. Phase 2 priority: orchestrator-side
   instruction-boundary + config-integrity verification.

## Phase 2 ETA

8-12 weeks for Tier-1 Full Conformance Claim. Closure roadmap tracked
in the handover doc.

## What this is NOT

This is **not** a conformance claim. APTS forbids partial credit. A
Tier-1 conformance claim is achievable only after 100% MET. We're
publishing the gap, not the claim.
```

- [ ] **Step 2: Validate counts match conformance.json**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
python3 -c "
import json
with open('docs/compliance/owasp-apts/conformance.json') as f:
    claim = json.load(f)
met = sum(1 for r in claim['requirements'] if r['status']=='met')
print(f'Met total: {met}/72')
" && \
grep -E '<X>|<N>' docs/compliance/owasp-apts/gap-summary.md
```
After running, replace any remaining `<X>` / `<N>` placeholders with the actual counts. The grep should return nothing once filled in.

- [ ] **Step 3: Commit**

```bash
git add docs/compliance/owasp-apts/gap-summary.md
git commit -m "docs(compliance): TL;DR gap summary with per-domain breakdown"
```

---

## Task 7: Top-level visibility — README + CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the README section**

Add a new top-level section to `README.md`, placed AFTER the "Honest limitations" section:

```markdown
---

## OWASP-APTS Conformance Posture

AEGIS publishes a public **OWASP Autonomous Penetration Testing Standard
(APTS) Tier-1 Readiness Assessment** — the first OSS pentest platform
with a public APTS conformance posture.

This is a **transparent gap statement**, not a conformance claim. APTS
forbids partial credit; a Tier-1 conformance claim requires 100% MET on
all 72 Tier-1 requirements. AEGIS today does not meet that bar — the
readiness assessment is honest about where the gaps are.

- [Tier-1 Readiness Assessment](./docs/compliance/owasp-apts/CONFORMANCE-CLAIM.md)
- [Gap summary (TL;DR)](./docs/compliance/owasp-apts/gap-summary.md)
- [Machine-readable claim (`conformance.json`)](./docs/compliance/owasp-apts/conformance.json)
- [Evidence manifest](./docs/compliance/owasp-apts/EVIDENCE-MANIFEST.md)
- [Foundation model disclosure (BYOM)](./docs/compliance/owasp-apts/FOUNDATION-MODEL-DISCLOSURE.md)

Phase 2 (Tier-1 Full Conformance Claim — close all Tier-1 gaps): 8-12
weeks. Phase 3 (Tier-2 Climb): post Phase 2.

The conformance posture covers the **AEGIS Autonomous Pentest Layer**
(`aegis siege` + LLM-pentest wrappers + CLI orchestration). The
deterministic SAST scanners, the `@aegis-scan/skills` methodology
package, and the `@aegis-wizard/cli` scaffold are supporting components
and explicitly out-of-scope for this conformance posture.
```

- [ ] **Step 2: Add the CHANGELOG entry**

Find the **Unreleased** section in `CHANGELOG.md` (top of file) and add under "Added":

```markdown
- **OWASP-APTS Conformance Posture** — first OSS pentest platform with
  a published APTS conformance posture. Phase 1 = Tier-1 Readiness
  Assessment (gap statement, NOT a conformance claim — APTS forbids
  partial credit). All 72 Tier-1 requirements explicitly classified
  (`met`/`partially_met`/`not_met`/`not_applicable`/`planned`),
  schema-valid against APTS v0.1.0 manifest. Boundary scope: AEGIS
  Autonomous Pentest Layer (siege + LLM-pentest wrappers + CLI
  orchestration). See `docs/compliance/owasp-apts/` and the design
  spec at `docs/design/2026-04-27-owasp-apts-conformance.md`.
```

- [ ] **Step 3: Validate the README link works**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
grep -A 2 "OWASP-APTS Conformance Posture" README.md | head -5
```
Expected: shows the new section.

- [ ] **Step 4: Validate CHANGELOG format consistency**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
head -50 CHANGELOG.md | grep -E "^## |^### " | head -10
```
Expected: shows the section structure; the new entry should fit existing pattern.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(readme): surface OWASP-APTS Conformance Posture + CHANGELOG entry"
```

---

## Task 8: Handover doc

**Files:**
- Create: `aegis-precision/v018-apts-phase1-handover.md`

- [ ] **Step 1: Write the handover**

Structure:
```markdown
# v0.18 — OWASP-APTS Phase 1 Handover

**Date:** 2026-04-27
**Status:** Phase 1 shipped (Tier-1 Readiness Assessment).
**Next:** Phase 2 (close Tier-1 gaps to enable a full Tier-1 conformance claim).

## What shipped in Phase 1

- `docs/compliance/owasp-apts/` subtree (7 files, doc-only).
- README + CHANGELOG visibility.
- All 72 Tier-1 APTS reqs classified with explicit status.

## Phase 2 punch list

(generate this from `partially_met` + `not_met` in conformance.json)

| APTS-ID | Domain | Title | Status | Phase-2 plan |
|---|---|---|---|---|
| ... | ... | ... | partially_met | ... |
...

## Phase 2 priorities (cluster-level)

1. **AR (Auditability)** — hash-chain on JSON output, evidence sensitivity classification.
2. **HO (Human Oversight)** — structured progress channel + intervention API.
3. **MR (Manipulation Resistance)** — orchestrator-side boundary enforcement + config integrity.
4. **AL (Graduated Autonomy)** — explicit L1/L2 labeling per scanner mode.

## Out-of-scope-for-Phase-2 (parked)

- WP-B: deep-eye recon-wrapper (parallel work-stream, not Phase 2).
- WP-C: Decepticon integration (gated by Phase 2 — APTS-TP gives the vetting framework).
- WP-D: openai/evals — intent unclear, requires user clarification.
- WP-E: Live tests — RoE per target required.

## Re-attestation cadence

Phase 1 publication is the baseline. Re-assess on:
- Each major AEGIS release (re-pin the HEAD SHA in EVIDENCE-MANIFEST)
- APTS upstream version bump (v0.2 etc — re-map needed)
```

- [ ] **Step 2: Auto-fill the punch-list table from conformance.json**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
python3 -c "
import json
with open('docs/compliance/owasp-apts/conformance.json') as f:
    claim = json.load(f)
gaps = [r for r in claim['requirements'] if r['status'] in ('partially_met', 'not_met')]
import pathlib
upstream = json.loads(pathlib.Path('/tmp/apts-spec/apts_requirements.json').read_text())
titles = {r['id']: r['title'] for r in upstream['requirements']}
for r in gaps:
    rid = r['requirement_id']
    dom = rid.split('-')[1]
    title = titles.get(rid, '?')
    print(f'| {rid} | {dom} | {title} | {r[\"status\"]} | TBD |')
" 
```

Paste the output into the handover doc, then replace each `TBD` with a concrete Phase-2 plan derived from the entry's rationale in conformance.json + the Phase-2 cluster priorities.

- [ ] **Step 3: Commit**

The directory `aegis-precision/` is in the local-scrub-list, so the
commit message must NOT reference it by name. The diff shows the path;
the message describes it obliquely.

```bash
git add aegis-precision/v018-apts-phase1-handover.md
git commit -m "docs(handover): APTS Phase-1 closure note + Phase-2 punch list"
```

---

## Self-Review

After Task 8 completes, run this final sweep:

- [ ] **Spec coverage check**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
ls docs/compliance/owasp-apts/ && \
echo "--- expected: 7 files (README, CONFORMANCE-CLAIM, conformance.json, EVIDENCE-MANIFEST, FOUNDATION-MODEL-DISCLOSURE, gap-summary, attribution) ---"
```
Expected: 7 files in the subtree, plus the handover doc + README + CHANGELOG mods.

- [ ] **Phase 1 success criteria** (from spec § "Erfolgskriterien Phase 1")

| # | Criterion | Verify |
|---|---|---|
| 1 | All 72 Tier-1 reqs in conformance.json with explicit status | Task 3 Step 10 already validates |
| 2 | CONFORMANCE-CLAIM marked as Tier-1 Readiness Assessment | Task 5 Step 4 validates |
| 3 | EVIDENCE-MANIFEST has at least 1 path per met | Task 4 Step 3 validates |
| 4 | FOUNDATION-MODEL-DISCLOSURE covers all 3 wrappers + fix-mode | Task 2 Step 4 validates |
| 5 | README.md (top-level) links the new subtree | Task 7 Step 3 validates |
| 6 | Self-review clean (this section) | running now |
| 7 | CC BY-SA 4.0 attribution documented | Task 1 Step 4 + attribution.md |
| 8 | Atomic commits with clear messages | 8 commits, one per task |

- [ ] **Final commit-log review**

Run:
```bash
cd /Users/lukashertle/Developer/projects/aegis && \
git log --oneline main..HEAD 2>&1 | head -10
```
Expected: 8 commits in the order: foundation → fmd → conformance.json → evidence → claim → gap-summary → readme/changelog → handover.

If the head-count of commits is right and all validations passed:
**Phase 1 ship is complete.**

After ship, surface the batched checkpoint to the user (per spec): WP-B starts (parallel), WP-C/D/E need explicit GO. See `aegis-precision/v018-apts-phase1-handover.md` for the punch list.

---

## Out-of-scope for this plan

- WP-A2 (skills tree population for `defensive/`/`mitre-mapped/`/`ops/`) — separate plan, parallelizable
- WP-B (recon/OSINT external-tool wrapper) — separate plan, post-WP-A1
- WP-C (Decepticon integration) — gated by Phase 2 closure
- WP-D (openai/evals) — gated by user-intent clarification
- WP-E (live tests against downstream apps) — gated by RoE per target

These have their own planning cycles after WP-A1 ships.
