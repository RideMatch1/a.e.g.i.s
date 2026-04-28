# foundation/_INDEX.md — Foundation Skill Trigger-Table

Routes the Foundation's own skills (orchestrator, customer-build, audit, etc.) based on user intent + keyword triggers. Loaded on-demand by the master `AGENTS.md` router when a Foundation-related request arrives.

---

## Skills in this category

| Trigger keywords | → Skill | Frontmatter `model` | Loaded path |
|---|---|---|---|
| start, session, bootstrap, phase, handover, weiter, weitermachen, übergabe, recap | `aegis-orchestrator` | opus | `foundation/aegis-native/aegis-orchestrator/SKILL.md` |
| handover, übergabe, session-ende, fertig, recap, abschluss | `aegis-handover-writer` | sonnet | `foundation/aegis-native/aegis-handover-writer/SKILL.md` |
| verify, check all gates, quality-gates, audit-gate, pre-commit-check | `aegis-quality-gates` | sonnet | `foundation/aegis-native/aegis-quality-gates/SKILL.md` |
| build customer, kundenseite, neue site, konfigurator-briefing, autonomous-build, 3h-build | `aegis-customer-build` | opus | `foundation/aegis-native/aegis-customer-build/SKILL.md` |
| module, feature, db-migration, api-route, refactor, neue funktion, neue api, neues modul | `aegis-module-builder` | sonnet | `foundation/aegis-native/aegis-module-builder/SKILL.md` |
| audit, paranoid-audit, AAA+++ check, 8-layer, security-audit, full-audit | `aegis-audit` | opus | `foundation/aegis-native/aegis-audit/SKILL.md` |
| neuer skill, skill erstellen, skill verbessern, skill audit, meta-skill, skillforge | `aegis-skill-creator` | opus | `foundation/aegis-native/aegis-skill-creator/SKILL.md` |
| consent, retention, art-13, art-15, art-33, datenpanne, drittland, dsgvo-baseline, schrems | `dsgvo-compliance` | opus | `foundation/aegis-native/dsgvo-compliance/SKILL.md` |

---

## Slash-Commands

- `/start` / `/session` / `/bootstrap` — invoke aegis-orchestrator
- `/verify` / `/check all gates` — invoke aegis-quality-gates
- `/handover` / `/übergabe` / `/session-ende` — invoke aegis-handover-writer
- `/build` / `/customer-build` / `/agentur-build` — invoke aegis-customer-build
- `/module` / `/feature` / `/refactor` — invoke aegis-module-builder
- `/audit` / `/paranoid-audit` / `/8-layer` — invoke aegis-audit
- `/skill-creator` / `/new-skill` / `/skill-audit` — invoke aegis-skill-creator
- `/dsgvo` / `/art-13` / `/art-15` / `/datenpanne` / `/schrems` — invoke dsgvo-compliance

---

## Rules for foundation skills

- Each skill MUST have `metadata.required_tools`, `metadata.pre_done_audit`, `model`, `license` populated per the v0.3.0+ HARD-CONSTRAINT-frontmatter format.
- Each skill MUST validate `python3 /tmp/SkillForge/scripts/validate-skill.py <skill>` at 16/17 or higher (the 1-warning ceiling allows for "5 phases recommend 1-3" advisories on intentionally-multi-phase skills).
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

## Cluster Composition Patterns

The 8 foundation skills compose into use-case clusters per master `AGENTS.md` Use-Case Routing:

| Use-case | Cluster |
|---|---|
| customer-build | aegis-orchestrator → aegis-customer-build (multi-agent) → aegis-quality-gates → aegis-handover-writer |
| compliance-audit | aegis-orchestrator → aegis-audit + brutaler-anwalt (cross-validate) → dsgvo-compliance (fix-templates) → aegis-handover-writer |
| dev-feature | aegis-orchestrator → aegis-module-builder (TDD) → aegis-quality-gates → aegis-handover-writer |
| aegis-self-test | aegis-orchestrator → aegis-quality-gates → aegis-audit → aegis-handover-writer |
| skill-authoring | aegis-orchestrator → aegis-skill-creator → aegis-quality-gates → aegis-handover-writer |

Each cluster ends with `aegis-handover-writer` to ensure the next session starts with full context.

---

## Forward-compat note

`foundation/_INDEX.md` at v0.4.0+ routes the full 8-skill foundation cluster. Future foundation-additions (e.g., `aegis-deploy` for Hetzner-Dokploy automation, `aegis-monitoring` for post-deploy observability) get rows added here + corresponding SKILL.md folders under `foundation/aegis-native/`.
