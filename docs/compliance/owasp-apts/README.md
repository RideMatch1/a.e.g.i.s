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
