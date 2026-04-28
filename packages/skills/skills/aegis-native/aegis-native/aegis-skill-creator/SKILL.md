<!-- aegis-local: AEGIS-native skill, MIT-licensed; Meta-skill that builds new skills via SkillForge methodology + AEGIS HARD-CONSTRAINT-format. Triage (USE_EXISTING / IMPROVE / CREATE_NEW / COMPOSE) -> Scaffold via init_skill.py -> 11-Lens-Analysis -> Validate (auto-iterate to 16/17+) -> Commit. NO skill-creation without validate-pass + 3+ references + Anti-Patterns + Extension-Points sections. References to SkillForge methodology with attribution. -->
---
name: aegis-skill-creator
description: Meta-skill that builds new skills via SkillForge methodology (tripleyak/SkillForge MIT) + AEGIS HARD-CONSTRAINT-format. Five-phase pipeline - Triage (USE_EXISTING vs IMPROVE vs CREATE_NEW vs COMPOSE) / Scaffold (init_skill.py) / Iterate (11-Lens-Analysis from references) / Validate (validate-skill.py auto-iterate to 16/17+) / Commit. NO skill-creation without validate-pass plus 3+ references plus Anti-Patterns plus Extension-Points sections. Trigger keywords - neuer skill, skill erstellen, skill verbessern, skill audit, meta-skill, skill creator, skillforge.
model: opus
license: MIT
metadata:
  required_tools: "shell-ops,file-ops,task-tracking"
  required_audit_passes: "2"
  enforced_quality_gates: "1"
  pre_done_audit: "true"
---

# aegis-skill-creator — Meta-Skill (Skills That Build Skills)

The Foundation's meta-skill. Creates / improves / audits other skills via the SkillForge methodology (tripleyak/SkillForge, MIT) wrapped in AEGIS HARD-CONSTRAINT-format. Either produces a SKILL.md that validates 16/17+ with all required sections, or returns INCOMPLETE with the missing-checks list.

---

## HARD-CONSTRAINT — Reference-Loading + Validate-Gate

This skill MUST:

1. **Load `references/skillforge-methodology.md`** before producing any skill-output. The SkillForge methodology (11-Lens-Analysis, iteration-guide, multi-lens-framework) is the canonical authoring-method.
2. **Load `references/hard-constraint-template.md`** for the AEGIS HARD-CONSTRAINT-block structure. Every new skill carries this block.
3. **Validate-gate is non-skippable.** Every output skill must pass `validate-skill.py` at 16/17+ before commit. Iterate up to 5 times; if not at 16/17 after 5 iterations → return INCOMPLETE with missing-check list.
4. **Triage-first, not create-first.** Phase 1 evaluates USE_EXISTING / IMPROVE / CREATE_NEW / COMPOSE. Many "I need a new skill" requests are actually "improve this existing one"; jumping to create wastes effort.
5. **No skill ships without:** ≥ 3 references (when complex enough to warrant), `## Anti-Patterns`, `## Extension Points`, HARD-CONSTRAINT-block in body, all-fields-populated frontmatter (model + license + metadata.required_tools + metadata.pre_done_audit).
6. **Attribution is mandatory.** Skills derived from SkillForge methodology carry attribution-comment + reference SkillForge in `references/skillforge-methodology.md`. No silent-port.

If any of (1)-(6) cannot be satisfied → STOP, report the gap. Don't produce a partial skill.

---

## Mission

Eliminate the failure-mode where a coding-agent, asked to "build a skill", produces a 50-line SKILL.md that fails validate, has no references, no Anti-Patterns, and no clear extension-path. Provide an industrial-grade meta-pipeline that:

- Triages first (don't create when improve / use-existing applies)
- Uses SkillForge methodology (11 lenses)
- Wraps in AEGIS HARD-CONSTRAINT-format
- Validates auto-iteratively to 16/17+
- Returns DONE-with-validate-proof or INCOMPLETE-with-list

---

## Triggers

### Slash-commands

- `/skill-creator` — create / improve / audit a skill
- `/new-skill` — alias for create
- `/skill-audit` — run audit on existing skill

### Auto-trigger keywords

- neuer skill, skill erstellen, skill verbessern, skill audit, meta-skill, skill creator, skillforge

### Required-input

- For CREATE: skill-name + 1-paragraph mission-statement + intended trigger-keywords + complexity-estimate (single-file vs multi-file with N references)
- For IMPROVE: existing skill-path + specific gaps to address
- For AUDIT: existing skill-path

---

## Process

| Phase | Time | Output |
|---|---|---|
| 1. Triage | ~5 min | decision: USE_EXISTING / IMPROVE / CREATE_NEW / COMPOSE |
| 2. Scaffold | ~5 min | folder + SKILL.md skeleton via init_skill.py-style |
| 3. Iterate (11-Lens) | ~30-60 min | full SKILL.md + references |
| 4. Validate (auto-iterate) | ~10 min | 16/17+ validation pass |
| 5. Commit | ~5 min | atomic commit + handover-update |

### Phase 1: Triage

Evaluate the request against existing skill-pool:

```
1. List skills in target category (or full pool):
   ls /tmp/a.e.g.i.s/packages/skills/skills/<category>/

2. For each existing skill, read SKILL.md description:
   grep "^description:" */SKILL.md

3. Decide:
   - USE_EXISTING — an existing skill already does this; route there.
   - IMPROVE — an existing skill is close; extend it (new section / new reference / new triggers).
   - CREATE_NEW — no existing skill covers this; new skill needed.
   - COMPOSE — solve via 2+ existing skills + a coordinating wrapper.
```

Triage decision MUST be explicit + recorded. Don't silent-create when use-existing applies.

### Phase 2: Scaffold

For CREATE_NEW or COMPOSE:

```bash
# Use init_skill.py (SkillForge tool) or manual scaffold
SKILL_DIR=/tmp/a.e.g.i.s/packages/skills/skills/<category>/<source>/<name>
mkdir -p "$SKILL_DIR/references"

# Write SKILL.md skeleton with:
# - Frontmatter (name, description, model, license, metadata block)
# - HARD-CONSTRAINT block placeholder
# - All required sections as headers (Mission, Triggers, Process, Verification, Anti-Patterns, Extension Points)
```

For IMPROVE:

- Read existing SKILL.md
- Write existing-state-snapshot to `improvement-plan.md` (in skill-folder, removed before commit)
- Identify specific gaps (sections missing, references thin, frontmatter incomplete)

### Phase 3: Iterate (11-Lens-Analysis)

Apply each lens from `references/skillforge-methodology.md`:

| Lens | Question |
|---|---|
| 1. User-Intent | What does the user actually want when they invoke this skill? |
| 2. Trigger-Keywords | What words / contexts cause this skill to fire? |
| 3. Inputs / Outputs | What does the skill take in? What does it produce? |
| 4. Process / Workflow | What's the step-by-step? |
| 5. Verification | How do you know the output is correct? |
| 6. Anti-Patterns | What goes wrong without this skill? |
| 7. Extension Points | How can future projects extend this? |
| 8. Model-Selection | Opus / Sonnet / Haiku — which fits the cognitive load? |
| 9. Tool-Categories | Which tools (shell-ops / file-ops / task-tracking / subagent-dispatch / ...) does the skill need? |
| 10. References-Set | Which external sources / patterns / templates inform this skill? |
| 11. Validate-Compliance | Will this pass `validate-skill.py` at 16/17+? |

For each lens, write a paragraph in the SKILL.md (not all in one place; lens-output maps to specific sections per `references/skillforge-methodology.md`).

### Phase 4: Validate (auto-iterate)

```bash
python3 /tmp/SkillForge/scripts/validate-skill.py "$SKILL_DIR"
# Note: aegis-native skills with leading <!-- aegis-local --> comment need stripping first.
# A wrapper script handles this — see CONTRIBUTING.md "Validate aegis-native skills" section.
```

Read output. For each failing check:

- Missing section → add it
- Wrong frontmatter field → fix it
- Description too short / too long → adjust
- No tables / no examples → add them
- > 3 phases when 1-3 recommended → either consolidate or accept as advisory (per Fallstricke)

Re-run validate. Iterate up to 5 times. If still red after 5 — return INCOMPLETE with the failing-check list.

### Phase 5: Commit

```bash
git add "$SKILL_DIR"
git commit -m "$(cat <<EOF
feat(<category>): add <skill-name> — <one-line-purpose>

- Frontmatter with HARD-CONSTRAINT-fields (metadata.required_tools, etc.)
- Body sections per validate-skill.py contract (Mission, Triggers, Process, Verification, Anti-Patterns, Extension Points)
- N references (when multi-file)
- validate-skill.py: <N>/<M> passing

Closes <issue or skill-request reference>
EOF
)"
```

Update aegis-native/_INDEX.md (or appropriate category-_INDEX.md) with the new skill's trigger-table row.

Update master AGENTS.md if a new use-case is introduced.

Update manifest.test EXPECTED_TOTAL + EXPECTED_NAMES_BY_CATEGORY.

---

## Verification / Success Criteria

Before declaring the skill-creation complete:

- [ ] Phase 1 Triage decision explicit (USE_EXISTING / IMPROVE / CREATE_NEW / COMPOSE) + recorded
- [ ] If CREATE_NEW or COMPOSE: scaffold via init_skill.py-style, all required sections present
- [ ] 11-Lens-Analysis applied (each lens-output maps to a SKILL.md section)
- [ ] `validate-skill.py` at 16/17+ (auto-iterate up to 5; if not, INCOMPLETE)
- [ ] HARD-CONSTRAINT-block in body (not just frontmatter)
- [ ] References (when multi-file): 2+ for simple, 3+ for moderate, 7+ for complex (e.g., aegis-customer-build has 7 phase-refs)
- [ ] Anti-Patterns + Extension Points sections both populated (≥ 5 items each)
- [ ] Attribution (when derived from external pattern: SkillForge / Spec-Author / etc.)
- [ ] manifest.test + attribution.test + scrub.test all green
- [ ] Atomic commit + index-updates committed together

---

## Anti-Patterns

- ❌ Skipping Triage Phase 1 — many "create new" requests are actually "improve existing"; triage first.
- ❌ Inventing a category for a skill that fits an existing one — use the existing category structure.
- ❌ Frontmatter-only HARD-CONSTRAINT — body needs a HARD-CONSTRAINT-section too (frontmatter signals to loader, body signals to agent).
- ❌ References that are stubs — every reference has actual content (≥ 50 lines for simple, 100+ for complex).
- ❌ No Anti-Patterns section — validate flags this; also weakens skill (no "what NOT to do" guidance).
- ❌ Validate-pass without re-checking semantics — passing 16/17 with bad content is worse than failing with good content. Read the SKILL.md after validate.
- ❌ Multi-file skill where SKILL.md exceeds 300 lines + has 0 references — split into references.
- ❌ Single-file skill with 100 lines but missing sections — add missing sections; don't claim "single-file" as excuse to skip.
- ❌ Hardcoding tool-names like "Bash" in skill body — use tool-categories ("shell-ops") per AGENTS.md tool-mapping table.
- ❌ Skipping attribution when porting from another methodology — credit + license-mention.
- ❌ Committing skill without updating manifest.test EXPECTED_TOTAL — breaks CI.

---

## Extension Points

- **New methodology**: SkillForge is the canonical methodology. Other methodologies (Anthropic skill-spec, custom org-spec) can be added as `references/<methodology>-methodology.md`. Phase 3 lens-table extends per methodology.
- **Auto-iteration limit**: default 5 iterations in Phase 4. Increase via `--max-iterations N` for complex new skills; decrease via `--max-iterations 2` for low-stakes auto-fixups.
- **Per-category templates**: a category (e.g., `defensive/`) might have a more specific HARD-CONSTRAINT-block-template than the generic one. Add `references/hard-constraint-template-<category>.md`.
- **Different validators**: SkillForge `validate-skill.py` is canonical. Anthropic skill-spec validator (when available) can be added as `--validator=anthropic-spec`.
- **Bulk-mode**: for migration of many existing skills to v0.3.0+ HARD-CONSTRAINT-format, add `--bulk` flag that iterates a list of skills + applies the upgrade-pattern in batch.
- **Audit-mode**: `--audit` runs validate + 11-Lens review without modifying. Returns a structured report for operator-review. Useful before bumping a skill to a new major-version.
- **Custom severity-thresholds**: a project might require 17/17 (all green, no advisory). Override via `aegis.config.json` `skill_creator.min_validate_score` (default 16).
- **Multi-skill compose-mode**: `--mode=compose` builds 2+ skills as a cluster (e.g., a domain-specific bundle with orchestrator + 3 specialist + 1 audit). Phase 4 validates each individually + the bundle's _INDEX.md.
