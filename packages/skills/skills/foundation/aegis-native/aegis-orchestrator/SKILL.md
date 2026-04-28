<!-- aegis-local: AEGIS-native skill, MIT-licensed; master-entry orchestrator that fires on every session-start, loads CLAUDE.md + AGENTS.md + latest handover + project-skill, prints tool inventory + project-state, then dispatches to the matching specialist skill (customer-build / compliance-audit / dev-feature / aegis-self-test). Pattern ported from a private reference-implementation; this is the public OSS variant. -->
---
name: aegis-orchestrator
description: AEGIS Master-Entry. Loads CLAUDE.md + AGENTS.md + latest handover + state.json, detects use-case (customer-build / compliance-audit / dev-feature / aegis-self-test / skill-authoring), routes to specialist skill per AGENTS.md, runs quality-gates pre-commit, writes session-end handover. Trigger keywords - start, session, bootstrap, orchestrator, phase, handover, weiter, weitermachen.
model: opus
license: MIT
metadata:
  required_tools: "shell-ops,file-ops,task-tracking"
  required_audit_passes: "1"
  enforced_quality_gates: "9"
  pre_done_audit: "true"
---

# aegis-orchestrator — Session-Entry

Master skill for AEGIS-foundation-bootstrapped repos. Fires on every session-start (Claude Code via SessionStart-Hook in `.claude/settings.json`; Codex via the Bootstrap-section in `AGENTS.md` per the foundation spec §14.5). Ensures every new agent has full context + finds the right specialist skill before responding to the user's first request.

---

## HARD-CONSTRAINT — Bootstrap-Discipline

Before responding to ANY user request, this skill MUST:

1. **Read** `.claude/handover/HANDOVER-LATEST.md` (or `.codex/handover/HANDOVER-LATEST.md` — same file via symlink on `--platform=both`).
2. **Read** `CLAUDE.md` (project rules).
3. **Read** `AGENTS.md` (router + tool-mapping table — already in context if AGENTS.md was loaded).
4. **Read** project-skill if present: `.claude/skills/<project-slug>/SKILL.md`.
5. **Read** `.aegis/state.json` to pick up the use-case + last completed phase.
6. **Read** `.aegis/Plans.md` if present — the live working-plan SSOT (see "Plans.md" section below). Skip if missing; orchestrator initializes it during Phase 3 dispatch.
7. **Print** to the user: `Tool-inventory: [...], Skills available: [...], Project-state: phase X, Use-case: Y, Open tasks: N`.
8. **THEN** process the user's request — never before.

If any of (1)-(5) is missing, STOP and report the gap explicitly. Don't improvise — `aegis foundation init` should have populated them; if it hasn't, the fix is to run init, not to skip the bootstrap.

---

## Mission

Be the universal session-opener for AEGIS-bootstrapped repositories. Eliminate the "agent starts blind, asks the user where to look" failure mode. Eliminate the "agent dispatches to a non-existent skill" failure mode. Eliminate the "agent commits without quality-gates" failure mode.

Three guarantees per session:
- Every agent starts with full project context (handover + CLAUDE.md + AGENTS.md + project-skill + state).
- Every agent dispatches to the matching specialist skill via the AGENTS.md routing-table.
- Every commit is preceded by `aegis-quality-gates` pre-commit verification.

---

## Triggers

### Slash-commands

- `/start` — start of session, full bootstrap then await user-prompt
- `/session` — alias for /start
- `/bootstrap` — alias for /start
- `/orchestrator` — explicit invocation

### Auto-trigger keywords

Activate automatically when any of these appear in the user's first message:

- start, session, bootstrap, phase, handover, weiter, weitermachen, übergabe, recap

### Auto-trigger via SessionStart-Hook

`.claude/settings.json` configures Claude Code to invoke `aegis-orchestrator` automatically at session-start (via the harness-side hook). Codex agents read the Bootstrap-section in `AGENTS.md` and self-trigger.

---

## Process

The skill follows a fixed bootstrap-then-dispatch sequence. No skipping.

### Phase 1: Bootstrap (mandatory, all 6 steps)

Per the HARD-CONSTRAINT block above. Stop on any missing artifact.

### Phase 2: Use-case detection

Read `.aegis/state.json` `use_case` field. If absent, infer from user's prompt keywords:

| User keywords | Use-case |
|---|---|
| build / kunde / customer / agentur / briefing / konfigurator | customer-build |
| audit / dsgvo / impressum / abmahnung / compliance | compliance-audit |
| feature / module / db / api / refactor | dev-feature |
| smoke / verify / self-test / aegis-test | aegis-self-test |

If no use-case can be inferred, ask the user explicitly. Don't guess silently.

### Phase 3: Specialist dispatch

Per the AGENTS.md `Use-Case Routing` table:

| Use-case | Specialist skill |
|---|---|
| customer-build | aegis-customer-build (multi-agent: Master + Research + Executor + Strategist) |
| compliance-audit | brutaler-anwalt (single-agent, multi-persona-internal) |
| dev-feature | aegis-module-builder |
| aegis-self-test | aegis-quality-gates → aegis-audit |

Hand off context to the specialist via inline-prompt-template (works on both Claude Code's Task tool AND Codex's spawn_agent per the foundation spec §14.3).

### Phase 4: Pre-commit gate

When the user says "commit" / "push" / "release" — orchestrator invokes `aegis-quality-gates` BEFORE the actual commit. Fails-closed: if any gate is red, commit is blocked + diagnosis printed.

### Phase 5: Session-end handover

When the user says "fertig" / "handover" / "session-ende" / "übergabe" — orchestrator invokes `aegis-handover-writer` to draft the structured handover-file + update the `HANDOVER-LATEST.md` symlink. The handover-writer reads `.aegis/Plans.md` to summarize task-status into the handover doc.

---

## Plans.md — Live Working-Plan SSOT

`.aegis/Plans.md` is the single source of truth for the **current** working plan (in-flight tasks, blockers, acceptance criteria). It complements (not replaces) `state.json` (machine-readable phase-state) and handover docs (point-in-time snapshots at session boundaries).

> Concept adapted from [Chachamaru127/claude-code-harness](https://github.com/Chachamaru127/claude-code-harness) (MIT) — their `Plans.md` SSOT pattern. AEGIS adapts the idea, not the tool: no Go binary, no marketplace plugin, no `/harness-*` verb-commands. Pure markdown discipline integrated into the existing AEGIS skill cluster.

### Lifecycle

1. **Initialize** — orchestrator creates `.aegis/Plans.md` on first dispatch if absent. Template is the format below.
2. **Update** — every specialist skill that performs work updates the relevant task row (status, blockers, AC checkbox progress). Module-builder, customer-build, audit, skill-creator, dsgvo-compliance all touch this file as they work.
3. **Summarize** — handover-writer reads Plans.md at session-end and folds the open-task-list into the handover doc's `§5 Open` section.
4. **Reset** — when a use-case completes (e.g., customer-build hits DONE-with-proof), orchestrator archives Plans.md to `.aegis/Plans-archive/<timestamp>.md` and starts a fresh one for the next use-case.

### Format

```markdown
# Plans.md — Working Plan

**Use-case:** customer-build (or compliance-audit / dev-feature / aegis-self-test / skill-authoring)
**Started:** 2026-04-28T14:00Z
**Last updated:** 2026-04-28T15:42Z
**Phase:** 3 of 7 (component-build)

---

## Tasks

### T01 — [DONE] Briefing-validation against schema

**AC:**
- [x] Briefing parsed without errors
- [x] All required schema-fields present
- [x] Pages-list extracted with N=5 entries

**Notes:** parsed-briefing.json written to .aegis/

### T02 — [IN PROGRESS] Component-tree binding to project library

**AC:**
- [x] Library inventory loaded
- [x] Pages 1-3 bound to library components
- [ ] Pages 4-5 bound (BLOCKER: missing testimonial-component variant)
- [ ] Component-tree exported as machine-readable JSON

**Notes:** Pages 4-5 use a variant of testimonial-card that the project library does not ship. Operator decision needed: drop the variant, request library extension, or use the closest existing variant.

### T03 — [PENDING] Phase-6 mid-audit

**AC:**
- [ ] aegis-scan run on the in-progress build
- [ ] brutaler-anwalt HUNT on impressum + cookie + DSE
- [ ] Repair-loop ≤ 3 iterations OR document blockers

---

## Blockers

- B01 (T02) — Library variant missing for testimonial-card. Awaiting operator decision.
```

### Acceptance-Criteria template

Every task carries an explicit AC list (1-N checkboxes). The discipline:

- AC must be **observable** (passes a check, file exists, command exits 0, etc.) — not subjective ("looks good").
- AC must be **complete** — task is DONE only when all AC are checked. No "looks done at 80%".
- AC must be **independently verifiable** — another agent reading the AC list can confirm pass/fail without context from the task-author.

When task is blocked, the AC stays unchanged (don't lower the bar to fit the blocker). Document the blocker explicitly in `## Blockers` section + flag in the task row.

### Cross-references

- `aegis-module-builder` reads Plans.md for task-AC discipline + writes back module-task progress.
- `aegis-customer-build` writes per-phase tasks into Plans.md as it executes the 7-phase pipeline.
- `aegis-audit` writes audit-finding tasks into Plans.md (1 task per layer-finding).
- `aegis-handover-writer` reads Plans.md → summarizes into handover §5 Open.
- `aegis-quality-gates` does NOT touch Plans.md — it is a stateless verifier; results go to `.aegis/verify-report.json`.

---

## Verification / Success Criteria

Before declaring the orchestrator-handoff complete for a session:

- [ ] Bootstrap-checklist completed (all 8 steps, no skipping)
- [ ] `.aegis/Plans.md` initialized for the current use-case (or carried-over from prior session if mid-use-case)
- [ ] Specialist skill identified + dispatched (or use-case ambiguity reported back to user)
- [ ] Quality-gates run before any commit (no `--no-verify` bypass)
- [ ] Session-end handover written (or explicitly deferred-to-next-session if user opts out)
- [ ] No specialist invoked without verifying its `metadata.required_tools` against the AGENTS.md tool-mapping table for the current harness
- [ ] `.aegis/state.json` updated with the new phase / last-action timestamp
- [ ] `.aegis/Plans.md` reflects the current task-state (closed tasks marked DONE, blockers documented)

If any checkbox is unmet: NOT done. Report which step is open + why + what needs to happen.

---

## Anti-Patterns

- ❌ Skipping the bootstrap-checklist "because the user is in a hurry" — the checklist IS the foundation; skipping it breaks every downstream skill.
- ❌ Inventing a specialist skill that doesn't exist in `AGENTS.md` routing-table.
- ❌ Committing without `aegis-quality-gates` running first.
- ❌ Closing a session without writing a handover (next agent starts blind).
- ❌ Dispatching to a specialist without confirming the harness has the required tools (per AGENTS.md tool-category mapping).
- ❌ Improvising a use-case when the user-prompt is genuinely ambiguous — instead, ask one clear question and wait.
- ❌ Pretending the bootstrap files were read when they weren't (file-existence-claims that are false).
- ❌ Claiming `done` while the project-skill state-file shows an incomplete phase.

---

## Extension Points

- **Add new use-cases**: extend the `Use-Case Routing` table in `AGENTS.md` plus add a new `presets/<use-case>.yaml` describing required-skills + tools + quality-gates + time-budget. Update Phase-2 keyword-inference table here accordingly.
- **Add new pre-commit-gates**: extend `aegis-quality-gates` SKILL.md (don't extend orchestrator). Orchestrator invokes quality-gates as a black-box.
- **Add new dispatch-rules**: extend Phase 3 in this skill's Process section. Each dispatch-rule maps one use-case to one specialist (or a multi-agent orchestration per spec §14.3).
- **Different harness support**: extend the AGENTS.md tool-category mapping to add new harness columns (e.g. Cursor, Windsurf). The orchestrator reads the mapping; no orchestrator-side change needed.
- **Custom SessionStart-Hook**: a project that needs additional bootstrap steps (e.g., load secrets from a vault, run a `git pull`) extends `.claude/settings.json` with a pre-orchestrator hook. Don't bake project-specific logic into this skill.
