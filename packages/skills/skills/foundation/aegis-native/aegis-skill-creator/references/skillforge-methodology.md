# SkillForge Methodology Reference

**Source:** tripleyak/SkillForge — MIT-licensed. https://github.com/tripleyak/SkillForge
**Attribution:** This reference adapts SkillForge's iteration-guide + multi-lens-framework methodology for AEGIS-native skills. Original methodology by SkillForge contributors; this reference summarizes the parts directly applicable to AEGIS skill-authoring.

---

## What SkillForge Provides

SkillForge is a methodology + tooling for building Claude Code skills (or any AGENTS.md-aware skill-system) at industrial-grade quality.

Three principal artifacts:

- `init_skill.py` — scaffolds a skill-folder with the canonical layout
- `validate-skill.py` — validates SKILL.md against the spec (frontmatter + sections + complexity-thresholds)
- `references/multi-lens-framework.md` + `references/iteration-guide.md` — methodology

The validate-skill.py output (e.g., `16/17 passed, 1 warning`) is the canonical pass-criterion for AEGIS-native skills.

---

## The 11-Lens Analysis

When authoring or auditing a skill, apply each lens. Each lens-output lands in a specific SKILL.md section.

### Lens 1: User-Intent

**Question:** What does the user *actually* want when they invoke this skill?

**Method:** Imagine the user typing `/<skill-name>` (or saying the trigger-keyword). What's the underlying need? Often the surface-request is misleading — "I need a script" might be "I need a workflow" or "I need a checklist".

**Lands in:** `## Mission` section + `description:` frontmatter.

### Lens 2: Trigger-Keywords

**Question:** What words / contexts cause this skill to fire?

**Method:** Think of 5-10 distinct user-utterances. Distill the keywords. Verify keywords don't collide with sibling skills (e.g., two skills both triggered by "audit" would race).

**Lands in:** `## Triggers` section + `description:` keywords-list.

### Lens 3: Inputs / Outputs

**Question:** What does the skill take in? What does it produce?

**Method:** Define the contract. Inputs = files / args / context the skill expects. Outputs = files / state / messages the skill produces. Be specific: "produces a markdown report at <path>" beats "writes some output".

**Lands in:** `## Mission` (high-level) + `## Process` (per-phase inputs/outputs).

### Lens 4: Process / Workflow

**Question:** What's the step-by-step?

**Method:** Decompose into 3-7 phases (more = over-engineered per validator advisory). Each phase has a clear inputs → output → checkpoint pattern.

**Lands in:** `## Process` section.

### Lens 5: Verification

**Question:** How do you know the output is correct?

**Method:** Define checkbox-list of success-criteria. Each item is independently testable.

**Lands in:** `## Verification / Success Criteria` section.

### Lens 6: Anti-Patterns

**Question:** What goes wrong without this skill?

**Method:** Brainstorm failure-modes. The skill exists because these failure-modes are common; document them.

**Lands in:** `## Anti-Patterns` section.

### Lens 7: Extension Points

**Question:** How can future projects extend this?

**Method:** Identify variation-axes (different stack / different industry / different threshold). Document where extensions go (which file / which config-key).

**Lands in:** `## Extension Points` section.

### Lens 8: Model-Selection

**Question:** Opus / Sonnet / Haiku — which fits the cognitive load?

**Decision Matrix:**

| Skill type | Model |
|---|---|
| Strategic planning, multi-step orchestration, ambiguity-handling | opus |
| Routine execution with clear contract, single-flow | sonnet |
| Pattern-matching, simple lookups | haiku |

**Lands in:** `model:` frontmatter field.

### Lens 9: Tool-Categories

**Question:** Which tools does the skill need?

**Method:** List per AGENTS.md tool-mapping table:

- shell-ops (Bash equivalent)
- file-ops (Read / Write / Edit equivalent)
- task-tracking (TodoWrite / update_plan equivalent)
- subagent-dispatch (Task / spawn_agent equivalent)
- domain-specific (aegis-scan / brutaler-anwalt / lighthouse / playwright / curl / library-engine)

**Lands in:** `metadata.required_tools` frontmatter field.

### Lens 10: References-Set

**Question:** Which external sources / patterns / templates inform this skill?

**Method:** Identify methodologies, court-decisions, standards, prior art. Each becomes a reference under `references/`.

**Lands in:** `references/` folder + cross-mentions in body.

### Lens 11: Validate-Compliance

**Question:** Will this pass `validate-skill.py` at 16/17+?

**Method:** Run validate. Read output. Address each failing check. Re-run.

**Lands in:** none directly — but failing this means re-iterating other lenses.

---

## Iteration Guide

Skills are not one-shot. Plan for ≥ 3 iterations:

### Iteration 1: Skeleton

- Frontmatter complete (all fields populated, even with placeholder values)
- All required section-headers present (Mission / Triggers / Process / Verification / Anti-Patterns / Extension Points)
- Each section has ≥ 1 paragraph or 3 bullet-points

Validate target: 12-14/17 (most checks pass; some "thin content" warnings).

### Iteration 2: Content-Fill

- Apply 11-Lens-Analysis to each section
- Add tables for structured information (validate likes tables)
- Add references/ folder if complexity > 200 lines (validate flags this)
- Populate Anti-Patterns + Extension Points (≥ 5 items each)

Validate target: 15-16/17.

### Iteration 3: Polish

- Re-read SKILL.md as if you've never seen it. Does each section flow?
- Cross-check examples and code-blocks compile / make sense
- Verify trigger-keywords don't collide with other skills
- Add missing sections if validate flags any

Validate target: 16/17 (with the 1 advisory warning typically being "5+ phases — consolidate to 1-3").

### Iteration 4-5 (if needed)

If still < 16/17:

- Re-read each failing check's exact requirement
- Read 2-3 existing 17/17 skills as canonical examples
- Apply structural fixes (sometimes adding a single ## subsection lifts 2 checks)

If after 5 iterations still < 16/17 → INCOMPLETE-Status. Don't ship sub-bar skills.

---

## Common Pitfalls (per Fallstricke)

1. **Validator regex anchor** — leading `<!-- aegis-local -->` HTML comments break frontmatter detection. Strip the comment before validating (or use the wrapper script in CONTRIBUTING.md).
2. **Frontmatter allowlist** — `validate-skill.py` rejects unknown top-level YAML fields. Custom HARD-CONSTRAINT fields nest under `metadata:`. Top-level allowed: `name`, `description`, `model`, `license`, `metadata`, `agent`, `allowed-tools`, `context`, `hooks`, `user-invocable`.
3. **5-phase advisory** — a `## Process` section with > 3 sub-phases triggers an advisory warning ("Recommend 1-3 phases, not over-engineered"). Acceptable for genuinely-complex pipelines (customer-build has 7 phases by design); not acceptable for skills that could consolidate.
4. **Tables warning** — "Should use tables for structured information" — triggers when complex skill has only bullets. Add 1-2 tables to lift the warning.
5. **References warning** — "Complex skill (>200 lines) should have references/ directory" — triggers on monolithic SKILL.md. Either split into references/ or shrink SKILL.md.

---

## Cross-skill Authoring Pattern

When a new skill relates to existing skills:

- **Cross-mention** — body explicitly references sibling skills (e.g., aegis-audit body mentions brutaler-anwalt for cross-validation).
- **Routing-table updates** — `_INDEX.md` files in the category get the new skill's row.
- **Master AGENTS.md updates** — if a new use-case is introduced, master router gets a row.
- **manifest.test updates** — EXPECTED_TOTAL increments + EXPECTED_NAMES_BY_CATEGORY adds the new name.

These cross-skill updates land in the SAME commit as the new skill, not in a follow-up commit.

---

## Checklist Before Commit

- [ ] `validate-skill.py` ≥ 16/17
- [ ] 11-Lens-Analysis output mapped to sections
- [ ] HARD-CONSTRAINT-block in body (not just frontmatter)
- [ ] All required sections present + populated
- [ ] References (when multi-file) each ≥ 50 lines (simple) or 100+ lines (complex)
- [ ] Anti-Patterns + Extension Points each ≥ 5 items
- [ ] Attribution (when derived)
- [ ] _INDEX.md updated
- [ ] manifest.test EXPECTED_TOTAL incremented
- [ ] No leading `<!-- aegis-local -->` comment leaks into body (only line 1)
- [ ] Scrub-clean (no forbidden codenames)

---

## Reference: Original SkillForge Materials

For the original SkillForge methodology (more detail than this summary), see:

- `https://github.com/tripleyak/SkillForge/blob/main/references/multi-lens-framework.md`
- `https://github.com/tripleyak/SkillForge/blob/main/references/iteration-guide.md`
- `https://github.com/tripleyak/SkillForge/blob/main/scripts/init_skill.py`
- `https://github.com/tripleyak/SkillForge/blob/main/scripts/validate-skill.py`

This AEGIS reference adapts the relevant patterns for AEGIS-native skills with HARD-CONSTRAINT-block + foundation-quality-gates. AEGIS-specific extensions (HARD-CONSTRAINT-frontmatter under `metadata:`, the 9-gate quality-gates, the 4-section audit-output) are AEGIS-specific; SkillForge does not require them.

License: MIT. SkillForge methodology used per its MIT-license terms; this AEGIS adaptation is also MIT.
