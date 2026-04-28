<!-- aegis-local: AEGIS-native skill, MIT-licensed; DSGVO baseline-checks for AEGIS-bootstrapped projects. Consent-management, retention-policy, Art. 13/15 info-pflicht templates, Datenpanne 72h-Meldepflicht runbook (Art. 33), Schrems-II Drittlandtransfer-Compliance. Pattern ported from a private operational reference; this is the public OSS variant. -->
---
name: dsgvo-compliance
description: DSGVO baseline-templates for AEGIS-bootstrapped projects. Consent-management, retention-policy, Art. 13/15 info-pflicht templates, Datenpanne 72h-Runbook (Art. 33), Schrems-II Drittlandtransfer-TIA. Sister-skill to brutaler-anwalt (audit findings vs fix-templates). RDG-Linie respected. Trigger keywords - consent, retention, art-13, art-15, datenpanne, drittland, schrems, dsgvo-baseline, dsb.
model: opus
license: MIT
metadata:
  required_tools: "shell-ops,file-ops"
  required_audit_passes: "1"
  enforced_quality_gates: "0"
  pre_done_audit: "true"
---

# dsgvo-compliance — DSGVO Baseline + Runbooks

The Foundation's DSGVO baseline skill. Provides templates, runbooks, and check-procedures for the most-bug-prone DSGVO surfaces: Consent-Management (Art. 7), Retention-Policy (Art. 5 Abs. 1 lit. e), Art. 13/14 Info-Pflichten, Art. 15 Auskunftsanfragen, Art. 33 Datenpanne 72h-Meldepflicht, Drittlandtransfer (Art. 46) post-Schrems-II.

Sister-skill to `compliance/aegis-native/brutaler-anwalt`: brutaler-anwalt audits FINDINGS, dsgvo-compliance provides the fix-templates + ongoing-process.

---

## HARD-CONSTRAINT — Reference-Loading + No-Legal-Advice-Disclaimer

This skill MUST:

1. **Load `references/art-13-15-templates.md`** before producing any Art. 13/14 info-text or Art. 15 Auskunftsantwort. Templates are calibrated to current BGH/EuGH-Linie; ad-hoc generation drifts.
2. **Load `references/datenpanne-runbook.md`** before producing any Art. 33 incident-response output. Timeline + Behörden-Kontakte + Eskalations-Matrix are non-improvisable.
3. **Always include the no-legal-advice disclaimer** in any output: "This output is informational; not legal advice. For binding decisions, consult a Fachanwalt für IT-Recht / Datenschutz."
4. **Cross-check with brutaler-anwalt findings** when this skill runs as a follow-up to an audit. brutaler-anwalt identifies findings; dsgvo-compliance produces the fix-templates.
5. **No improvisation on Art. 33 Datenpanne timing.** 72h is the hard deadline. If incident-detection > 72h ago, the runbook switches to retroactive-disclosure mode (still required, with explanation of delay).
6. **Datenschutzbeauftragter (DSB) auto-detect**: skill detects whether project requires a DSB per Art. 37 thresholds (≥ 20 Mitarbeiter dauerhaft mit personenbezogenen Daten, oder Kerntätigkeit Profiling/special-categories). If yes — flag in output.

If any of (1)-(6) cannot be satisfied → STOP, report the gap. RDG (Rechtsdienstleistungsgesetz)-line: this skill provides templates + runbooks, NOT individual legal advice.

---

## Mission

Eliminate the failure-mode where a project ships with placeholder DSGVO-text ("Lorem ipsum datenschutz") or hand-written Art. 13 info-blocks that miss 4 of 12 required fields. Provide:

- **Templates** for Art. 13/14 info-pflichten + Art. 15 Auskunftsantworten (calibrated to BGH/EuGH-Linie)
- **Runbooks** for Art. 33 Datenpanne (72h-Meldepflicht, with timeline + Behörden-Kontakte per Bundesland)
- **Check-procedures** for consent-management, retention-policy, Schrems-II Drittlandtransfer
- **DSB-eligibility-check** per Art. 37 thresholds

Output is ALWAYS scoped to AEGIS-foundation projects + carries the no-legal-advice disclaimer.

---

## Triggers

### Slash-commands

- `/dsgvo` — full DSGVO baseline run (covers consent + retention)
- `/art-13` — Art. 13/14 info-pflicht templates
- `/art-15` — Art. 15 Auskunftsanfrage-Antwort
- `/datenpanne` — Art. 33 + 34 incident-response runbook
- `/schrems` — Drittlandtransfer-Compliance check (Art. 46 + TIA)

### Auto-trigger keywords

- consent, retention, art-13, art-15, art-33, datenpanne, drittland, dsgvo-baseline, schrems, datenschutz-beauftragter, dsb, art-37, avv, art-28

### Required-input

| Slash-command | Required input |
|---|---|
| /art-13 | project's data-processing-purposes + 3rd-party-list + storage-locations |
| /art-15 | the Auskunftsanfrage (text or PDF) + project's data-store inventory |
| /datenpanne | incident-summary (when, what, who-affected, scope) |
| /schrems | list of US/Drittland-3rd-parties used + their AVV-status |

---

## Process

| Phase | Time | Output |
|---|---|---|
| 1. Consent-mapping | ~15-30 min | consent-required cookies + processing-purposes + opt-in mechanism |
| 2. Retention-policy | ~20-30 min | per-data-category retention-period + deletion-trigger + Löschkonzept doc |
| 3. Art. 13 info-templates | ~30-45 min | Datenschutzerklärung + per-form Art. 13 short-form |
| 4. Datenpanne runbook | ~15 min (template-pull) or ~2-4h (active incident) | Art. 33 disclosure-letter + Art. 34 betroffene-notification + Behörden-Kontakte list |
| 5. Schrems-II TIA | ~30-60 min per 3rd-party | TIA-Dokument per US/Drittland-Empfänger |

### Phase 1: Consent-Mapping

1. List every data-collection-point in the project (forms, cookies, trackers, chatbot).
2. For each, classify processing-purpose + Art. 6 Rechtsgrundlage:
   - Vertragsanbahnung (Art. 6 Abs. 1 lit. b)
   - Berechtigtes Interesse (Art. 6 Abs. 1 lit. f) — requires Interessenabwägung
   - Einwilligung (Art. 6 Abs. 1 lit. a) — requires explicit + informed + revokable
   - Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c)
3. For each Einwilligung-based: verify TTDSG/TDDDG §25 compliance (cookie-banner pre-consent gate).
4. Produce consent-mapping doc.

### Phase 2: Retention-Policy

1. List every data-store: forms-DB, logs, analytics, backup-archives, customer-DB, etc.
2. Per data-category, define retention-period + deletion-trigger:
   - Kontaktanfragen: 6 Monate nach letzter Kommunikation (oder bis Vertragsende + 3 Jahre)
   - Newsletter-Subscriber: bis Abmeldung + 30 Tage Grace
   - Analytics-Logs: anonymized after 30 days, raw-deleted after 90 days
   - Customer-Records: 10 Jahre (HGB / AO Aufbewahrungsfristen)
   - Server-Logs: 7-30 Tage (security-purpose only)
3. Document Löschkonzept: cron-jobs, manual triggers, audit-trail.
4. Cross-check with current actual deletion behavior — drift detection.

### Phase 3: Art. 13 Info-Templates

Use `references/art-13-15-templates.md` for the canonical template-pulls:

- Per processing-purpose: a structured paragraph for the DSE.
- Per form: a short-form Art. 13 info-block displayed near the form.
- Per chatbot/scanner: a tool-specific Art. 13 disclosure.

Customize per project's actual data-flows; verify all 12 Art. 13 fields are addressed.

### Phase 4: Datenpanne Runbook

Use `references/datenpanne-runbook.md`:

- Detect: how was the breach detected? (logs / tip / penetration-test / external-report)
- Assess: scope (records affected) + severity (high-risk for betroffene? Art. 34 trigger?)
- Disclose: Art. 33 within 72h to Aufsichtsbehörde; Art. 34 to betroffene if high-risk.
- Document: Art. 33 Abs. 5 internal-documentation pflicht (every breach, even if not disclosed externally).

If active incident: skill prioritizes timing + clear-text disclosure-template + Behörden-Kontakte. No legal-advice; just the factual checklist.

### Phase 5: Schrems-II TIA (Transfer-Impact-Assessment)

For each US/Drittland-3rd-party (Layer 4 audit cross-reference):

1. SCC-Vertrag: signed? Latest EU-Commission template (2021/914)?
2. TIA: Schrems-II requires assessment of recipient-country surveillance-laws + technical safeguards.
3. Schutzgarantien: encryption-at-rest + at-transit, pseudonymization, access-controls.
4. Document the TIA per recipient.

EDSA Recommendations 01/2020 provide the methodology; 6-step process (mapping / SCC / law-assessment / technical-supplementary / decision / documentation).

---

## Verification / Success Criteria

Before declaring DSGVO-baseline complete:

- [ ] Phase 1: all data-collection-points mapped to Art. 6 Rechtsgrundlage
- [ ] Phase 2: retention-policy doc covers every data-category, with deletion-trigger
- [ ] Phase 3: Art. 13 templates cover all 12 required fields per processing-purpose
- [ ] Phase 4: Datenpanne runbook accessible to Operator (printed checklist + contact-info)
- [ ] Phase 5: TIA-Dokument exists per US/Drittland-3rd-party
- [ ] DSB-Status flagged (required / not-required per Art. 37 thresholds)
- [ ] AVV-Liste vorhanden (per Art. 28 — every processor signed AVV)
- [ ] Cross-check brutaler-anwalt L4 findings: every KRITISCH addressed
- [ ] No-legal-advice disclaimer in every output

If any unmet → INCOMPLETE-Status.

---

## Anti-Patterns

- ❌ Skipping disclaimer "because it's obvious" — RDG-Linie: every output explicit-disclaimer.
- ❌ Hand-writing Art. 13 from scratch — use the template-pull; missing fields = abmahn-risk.
- ❌ Inferring Rechtsgrundlage without mapping the actual processing-purpose — every processing has exactly one primary Rechtsgrundlage.
- ❌ Datenpanne timing > 72h with no retroactive-disclosure plan — runbook covers retroactive case; use it.
- ❌ Schrems-II handled by signing SCC alone — SCC + TIA + technical-supplementary all required per EDSA Recommendations.
- ❌ DSB-eligibility check skipped for "small project" — Art. 37 has clear thresholds; check explicitly.
- ❌ Retention-Policy without deletion-trigger — policy is theoretical; trigger is what actually happens.
- ❌ AVV-Liste assumes processors signed AVV without verification — every processor explicit AVV-on-file.
- ❌ Cookie-Banner consent without Art. 7 Abs. 1 nachweis-mechanism (consent-record-DB or audit-log) — Einwilligung must be nachweis-bar.
- ❌ Generic "Datenschutz ist uns wichtig"-prose without legal-fields — fluff doesn't satisfy Art. 13.

---

## Extension Points

- **Per-industry-DSE-templates**: add `references/art-13-templates-<industry>.md` for industry-specific processing-purposes (Anwalt: Mandantendaten, Arzt: Patientendaten + Art. 9 special-categories, etc.).
- **Multi-jurisdiction**: DSGVO is EU-wide but local-law variations exist (BDSG-DE, DSG-AT, FADP-CH). Add `references/jurisdiction-<country>.md` per scope-extension. Note: this skill is calibrated to DSGVO + BDSG (DE-default).
- **Custom retention-periods**: industry-specific (e.g., medical 30 years per HSV) override defaults via `aegis.config.json` `dsgvo.retention.<category>`.
- **Datenpanne-incident-tracker**: extend Phase 4 with optional `--incident-id=<id>` flag that writes to a per-project incident-DB (`docs/dsgvo/incidents/<id>.md`) with full timeline + disclosures + lessons-learned.
- **Auskunftsanfrage-Tracker**: extend Phase 3 (Art. 15) with `--anfrage-id=<id>` flag that tracks request-receipt + 30-day-deadline + response in `docs/dsgvo/auskunftsanfragen/<id>.md`.
- **DSB-Outsourcing-Decision-Aid**: when DSB required, add `--dsb-decision-aid` mode that produces a comparison-matrix (internal vs external DSB, cost-estimates, timeline).
- **Multi-language-DSE**: extend Phase 3 with `--lang=de,en` for bilingual DSE generation. Use language-specific BGH/EuGH-Linie references for non-DE.
- **AVV-Pflichten-Tracker**: list of all processors → AVV-status (signed / pending / missing) → renewal-dates (typically 1-3 year cycle).
- **Cross-skill compose with brutaler-anwalt**: a `--audit-then-fix` mode runs brutaler-anwalt first, then auto-applies dsgvo-compliance fixes for each KRITISCH finding.
