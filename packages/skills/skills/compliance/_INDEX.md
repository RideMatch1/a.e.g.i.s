# compliance/_INDEX.md — Compliance Skill Trigger-Table

Routes `compliance/` category skills based on user intent + keyword triggers. Loaded on-demand by AGENTS.md when a compliance-related request arrives. Each row points at a specific SKILL.md to load.

---

## Skills in this category

| Trigger keywords | → Skill | Loaded path |
|---|---|---|
| dsgvo, datenschutz, impressum, cookie, abmahnung, compliance, agb, avv, drittland, einwilligung, ttdsg, ddg, tmg, uwg, nis2, ai-act, gobd, dsa, urheber, marke, ePrivacy, drittlandtransfer, schrems, eugh, bgh, abmahnanwalt, datenpanne, betroffenenrechte, art-13, art-15, art-83, scc, tia, dsfa, vvt, dpo, dsb, lg-muenchen-google-fonts, fashion-id | `brutaler-anwalt` | `compliance/aegis-native/brutaler-anwalt/SKILL.md` |
| _(post-0.4.0)_ consent-management, retention-policy, art-13-info-pflicht, datenpanne-runbook | `dsgvo-compliance` | `compliance/aegis-native/dsgvo-compliance/SKILL.md` |

---

## Slash-Commands

- `/anwalt` — invoke brutaler-anwalt SCAN-mode on current repo or live URL
- `/anwalt hunt <topic>` — HUNT-mode focused on one topic (cookie banner / drittland / impressum / etc.)
- `/anwalt simulate` — full SIMULATE-mode incl. fictional Abmahn-letter or Behörden-Anhörung
- `/anwalt consult <document>` — CONSULT-mode for review of one document (AGB / AVV / DSE / contract)
- `/audit` — alias for `/anwalt`
- `/compliance-check` — alias for `/anwalt`

---

## Rules for compliance skills

- **Reference-Loading is mandatory** per HARD-CONSTRAINT-block in each skill's SKILL.md. The skill MUST refuse to operate without loading at least `audit-patterns.md` + topic-specific references.
- **All references are MIT-licensed** (own work, AEGIS-native namespace). Each reference cites § / Art. + Az. + Reference-File-Pfad — no improvisation.
- **Disclaimer is non-negotiable** (RDG § 2 — keine Rechtsberatung). Each output ends with the standard RDG-disclaimer.

---

## Bootstrap-checklist (called by AGENTS.md)

When this category is loaded:

1. Verify the matched skill's SKILL.md is in context.
2. Check the skill's frontmatter `metadata.required_tools` — confirm those tool-categories are available in the harness (per AGENTS.md tool-mapping table).
3. If `metadata.pre_done_audit: "true"` — note it; the skill will not be allowed to declare DONE without explicit pre-done-audit completion (the Verification / Success Criteria checklist).
4. Print: `Loaded compliance skill: <name>, model: <opus|sonnet|haiku>, audit-passes: <N>, gates: <N>`.

---

## Forward-compat note

`compliance/_INDEX.md` v0.3.0 routes a single skill (`brutaler-anwalt`). v0.4.0 (Phase 2) adds `dsgvo-compliance` (consent-management + Art. 13/15 templates + Datenpanne-Runbook). Future additions land here without breaking the router-shape.
