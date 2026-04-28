# aegis-native/_INDEX.md — Foundation Skill Trigger-Table

Routes the Foundation's own skills (orchestrator, customer-build, audit, etc.) based on user intent + keyword triggers. Loaded on-demand by the master `AGENTS.md` router when a Foundation-related request arrives.

---

## Skills in this category

| Trigger keywords | → Skill | Frontmatter `model` | Loaded path |
|---|---|---|---|
| start, session, bootstrap, phase, handover, weiter, weitermachen, übergabe, recap | `aegis-orchestrator` | opus | `aegis-native/aegis-native/aegis-orchestrator/SKILL.md` |
| handover, übergabe, session-ende, fertig, recap, abschluss | `aegis-handover-writer` | sonnet | `aegis-native/aegis-native/aegis-handover-writer/SKILL.md` |
| verify, check all gates, quality-gates, audit-gate, pre-commit-check | `aegis-quality-gates` | sonnet | `aegis-native/aegis-native/aegis-quality-gates/SKILL.md` |
| _(post-0.4.0)_ build customer, kundenseite, konfigurator-briefing, voidframe build | `aegis-customer-build` | opus | _placeholder_ |
| _(post-0.4.0)_ modul, feature, db-migration, api-route | `aegis-module-builder` | sonnet | _placeholder_ |
| _(post-0.4.0)_ audit, paranoid-audit, 8-layer, AAA+++ check | `aegis-audit` | opus | _placeholder_ |
| _(post-0.4.0)_ neuer skill, skill erstellen, skill verbessern, skill audit | `aegis-skill-creator` | opus | _placeholder_ |
| _(post-0.4.0)_ consent, retention, art-13, art-15, datenpanne | `dsgvo-compliance` | opus | _placeholder_ |

---

## Slash-Commands

- `/start` / `/session` / `/bootstrap` — invoke aegis-orchestrator
- `/verify` / `/check all gates` — invoke aegis-quality-gates
- `/handover` / `/übergabe` / `/session-ende` — invoke aegis-handover-writer
- _(post-0.4.0)_ `/build` / `/customer-build` — invoke aegis-customer-build
- _(post-0.4.0)_ `/audit` / `/paranoid-audit` — invoke aegis-audit
- _(post-0.4.0)_ `/skill-creator` — invoke aegis-skill-creator
- _(post-0.4.0)_ `/dsgvo` — invoke dsgvo-compliance

---

## Rules for foundation skills

- Each skill MUST have `metadata.required_tools`, `metadata.pre_done_audit`, `model`, `license` populated per the v0.3.0 HARD-CONSTRAINT-frontmatter format.
- Each skill MUST validate `python3 /tmp/SkillForge/scripts/validate-skill.py <skill>` at 16/17 or higher (the 1-warning ceiling allows for "5 phases recommend 1-3" advisories).
- Multi-file skills (SKILL.md + sibling `references/`) are auto-installed; references kept under `<skill>/references/`.
- The master `AGENTS.md` tool-mapping table is canonical — skills reference tool-categories (`shell-ops`, `file-ops`, etc.), the AGENTS.md tells the agent which actual harness-tool to use.

---

## Bootstrap-checklist (called by master AGENTS.md)

When this category is loaded:

1. Verify the matched skill's SKILL.md is in context (read it, don't just assume).
2. Check the skill's `metadata.required_tools` — confirm those tool-categories are available in the harness (per AGENTS.md tool-mapping table).
3. If `metadata.pre_done_audit: "true"` — note it; the skill will not be allowed to declare DONE without explicit pre-done-audit completion.
4. Print: `Loaded foundation skill: <name>, model: <opus|sonnet|haiku>, audit-passes: <N>, gates: <N>`.

---

## Forward-compat note

`aegis-native/_INDEX.md` v0.3.0 routes 3 foundation skills (orchestrator, handover-writer, quality-gates). v0.4.0 (Phase 2 of AEGIS Agent Foundation continuation) populates the remaining 5: aegis-customer-build (multi-file with 7 phase-references), aegis-module-builder, aegis-audit (multi-file with 8 layer-references), aegis-skill-creator (multi-file with SkillForge-methodology reference), dsgvo-compliance (multi-file with Art-13/15-templates + Datenpanne-runbook).
