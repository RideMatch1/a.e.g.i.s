# HARD-CONSTRAINT-Block Template

The HARD-CONSTRAINT-block is the AEGIS-native discipline-marker that turns a SKILL.md into an enforceable contract. It's parameterized per skill-type (orchestrator / builder / auditor / writer / meta).

---

## Why HARD-CONSTRAINT?

Without HARD-CONSTRAINT, a skill is a description. With HARD-CONSTRAINT, a skill is a precondition-checked contract:

- **Frontmatter HARD-CONSTRAINT** (under `metadata:`) — signals to the loader (`parseHardConstraintFrontmatter()`) that this skill has enforced quality-gates, a required tool-set, and a mandatory pre-done audit. The loader can refuse to dispatch the skill if the harness lacks the required tools.

- **Body HARD-CONSTRAINT-block** (after Mission) — signals to the agent that certain conditions MUST be satisfied before the skill begins work. The skill author enforces this; the agent is expected to read + obey.

Example: `aegis-customer-build` HARD-CONSTRAINT requires loading 7 phase-references + the project's component-library inventory + the configurator-briefing BEFORE Phase 1 starts. Skipping any of these guarantees a quality-regression.

---

## Frontmatter Template (canonical v0.3.0+)

```yaml
---
name: <skill-name>                    # kebab-case, [a-z][a-z0-9-]{2,40}
description: <one-sentence-purpose plus trigger-keywords>   # 50-280 chars
model: opus | sonnet | haiku           # per Lens 8
license: MIT                            # AEGIS-native default
metadata:
  required_tools: "<csv-of-tool-categories>"   # per Lens 9 + AGENTS.md tool-mapping
  required_audit_passes: "<N>"                # how many audit-passes the skill requires
  enforced_quality_gates: "<N>"               # how many of the 9 gates this skill enforces
  pre_done_audit: "true" | "false"            # whether this skill blocks DONE-claim until audited
---
```

`metadata.required_tools` examples per skill-type:

| Skill-type | required_tools |
|---|---|
| orchestrator (session-entry) | "shell-ops,file-ops,task-tracking" |
| customer-build | "shell-ops,file-ops,task-tracking,subagent-dispatch,library-engine,aegis-scan,brutaler-anwalt,lighthouse" |
| audit | "shell-ops,file-ops,curl,playwright,aegis-scan" |
| module-builder | "shell-ops,file-ops,task-tracking" |
| handover-writer | "file-ops,shell-ops" |
| quality-gates | "shell-ops,file-ops" |
| skill-creator | "shell-ops,file-ops,task-tracking" |
| compliance / dsgvo | "shell-ops,file-ops" |

---

## Body HARD-CONSTRAINT-Block — Per Skill-Type

The body block follows a fixed template. Header always `## HARD-CONSTRAINT — <discipline-name>`.

### Pattern A: Orchestrator (session-entry skills)

```markdown
## HARD-CONSTRAINT — Bootstrap-Discipline

Before responding to ANY user request, this skill MUST:

1. Read `<bootstrap-file-1>`.
2. Read `<bootstrap-file-2>`.
3. Read `<bootstrap-file-3>`.
4. Print `Tool-inventory: [...], Skills available: [...], Project-state: ...`.
5. THEN process the user's request.

If any of (1)-(N) is missing — STOP, report the gap. Don't improvise.
```

Example: `aegis-orchestrator`.

### Pattern B: Builder (customer-build / module-builder)

```markdown
## HARD-CONSTRAINT — Anti-Halbherzig-Discipline

Before <pipeline-start>, this skill MUST:

1. Load all <N> phase-references in `references/`.
2. Load <project-inventory>.
3. Load <input-contract> (e.g., briefing, feature-spec).
4. Validate <pages-count | feature-acceptance-criteria | etc.> commitment.
5. <pipeline> is non-skippable.
6. Per-phase checkpoint to `.aegis/state.json`.
7. Final-Verify-Loop: <N> gates green OR repair-attempt OR INCOMPLETE-Status.

If any of (1)-(N) cannot be satisfied — STOP and report which precondition is missing.
```

Example: `aegis-customer-build`.

### Pattern C: Auditor (audit / brutaler-anwalt)

```markdown
## HARD-CONSTRAINT — Layer-Order, Reference-Loading, No Mocks

This skill MUST:

1. Load all <N> layer-references BEFORE producing any finding.
2. Execute layers in fixed order (1 → N).
3. No mocks. Every layer hits the real target.
4. Cross-check with <sibling-skill> at <shared-layers>.
5. Output the canonical <N>-section format.
6. Include <severity-classification> per layer's defined criteria.

If any layer cannot run — STOP, report which layer + why. Don't silent-skip.
```

Example: `aegis-audit`, `brutaler-anwalt`.

### Pattern D: Writer (handover-writer / report-writer)

```markdown
## HARD-CONSTRAINT — <Output>-Completeness

The <output-artifact> MUST include all <N> sections listed under `## Verification / Success Criteria`.

Skipping a section breaks <downstream-consumer>. If a section legitimately has nothing to report, write `(none this session)` rather than omitting the header.

References to <source-doc> belong in `## Recommendations` if they affect the operator's next decisions, not buried elsewhere.
```

Example: `aegis-handover-writer`.

### Pattern E: Verifier (quality-gates)

```markdown
## HARD-CONSTRAINT — Fail-Closed, No Mocks

This skill is the safety-net for <consumer>. It MUST:

1. Run real commands against the real artifact (no mocks).
2. Fail-closed: if even one <thing> is red, return exit-non-zero.
3. Not be silenced via <bypass-mechanism> (`--no-verify`, etc.).
4. Emit a structured report (JSON + markdown) downstream tooling can parse.

If <bypass> is invoked → that's a violation per spec hard-NICHTs. Document the override in <SECURITY-EXCEPTION.md>.
```

Example: `aegis-quality-gates`.

### Pattern F: Meta (skill-creator / framework-tooling)

```markdown
## HARD-CONSTRAINT — Reference-Loading + Validate-Gate

This skill MUST:

1. Load `<methodology-reference>` before producing any output.
2. Load `<format-template>` for the <format> structure.
3. Validate-gate is non-skippable. Iterate up to <N> times; if not at <threshold> → INCOMPLETE.
4. <Triage-or-similar>-first, not <action>-first.
5. No <output> ships without: <required-fields>.
6. Attribution is mandatory when derived from <external>.

If any of (1)-(N) cannot be satisfied → STOP, report the gap.
```

Example: `aegis-skill-creator`.

---

## Block-Length Guidelines

- **Numbered list:** 4-8 items. Fewer = under-specified; more = either splitting into a sub-block or consolidating items.
- **Final escape clause:** every HARD-CONSTRAINT-block ends with "If any of (1)-(N) cannot be satisfied — STOP and report which precondition is missing. Don't improvise; the foundation depends on these guarantees." (or domain-equivalent).
- **No optional items.** If a step is "should" — move it out of HARD-CONSTRAINT. HARD-CONSTRAINT is "MUST" only.

---

## Cross-references to other Skills

When a HARD-CONSTRAINT requires another skill, format as:

```
4. Load `compliance/aegis-native/brutaler-anwalt/SKILL.md` for the spot-check passes in Phase 6 + final pass in Phase 7.
```

The path is canonical (relative to skill-pool root) so any harness can resolve it.

---

## Anti-Patterns for HARD-CONSTRAINT-blocks

- ❌ Aspirational items ("ideally we should...") — HARD-CONSTRAINT is non-negotiable; aspirations belong in Mission.
- ❌ Items that aren't actually enforceable ("be thorough", "do good work") — replace with verifiable preconditions.
- ❌ More than 10 items — block becomes a wall-of-text; split into 2 sub-blocks if domain-genuinely-complex.
- ❌ Reusing the same block across all skills verbatim — each skill's preconditions are domain-specific; copy-paste-then-adapt.
- ❌ Missing the final escape-clause — without it, agents may try to silent-skip a missing precondition.
- ❌ HARD-CONSTRAINT-block before Mission — Mission first (so the reader knows context); HARD-CONSTRAINT after Mission (preconditions for the mission).
- ❌ HARD-CONSTRAINT in frontmatter only — the body block IS the discipline-marker for the agent. Both are needed.

---

## Migration: Adding HARD-CONSTRAINT to an Existing Skill

If upgrading a v0.2.x skill to v0.3.0+ HARD-CONSTRAINT-format:

```
1. Add metadata: block to frontmatter with required_tools, required_audit_passes, enforced_quality_gates, pre_done_audit.
2. Add `## HARD-CONSTRAINT — <discipline>` section after Mission.
3. List 4-8 numbered preconditions.
4. End with the escape-clause.
5. Re-run validate-skill.py.
6. If validate score drops because of new content — review and fix.
7. Commit with `feat(<skill-name>): HARD-CONSTRAINT-frontmatter + <N> missing sections`.
```

Reference: brutaler-anwalt (commit `4fdd1e0`) is the canonical migration-example. 9/16 → 17/17 after migration.

---

License: MIT. Template-content used per AEGIS-foundation public-OSS license; adapt freely for your skill-authoring.
