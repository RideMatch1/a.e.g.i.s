<!-- aegis-local: AEGIS-native skill, MIT-licensed; writes the structured session-end handover, captures progress + open items + skill-changes + recommendations, then updates the HANDOVER-LATEST.md symlink so the next agent starts with full context. Pattern ported from a private reference-implementation; this is the public OSS variant. -->
---
name: aegis-handover-writer
description: Writes the session-end handover. Captures completed-work, quality-gate metrics, files changed, skill changes, open items 1/2/3, fallstricke, next steps, recommendations. Updates HANDOVER-LATEST.md symlink. Trigger keywords - handover, session-ende, fertig, übergabe, recap, abschluss.
model: sonnet
license: MIT
metadata:
  required_tools: "file-ops,shell-ops"
  required_audit_passes: "0"
  enforced_quality_gates: "0"
  pre_done_audit: "false"
---

# aegis-handover-writer — Session-End Handover

Writes a structured handover-file at `.claude/handover/HANDOVER-YYYY-MM-DD-<topic>.md` and updates `HANDOVER-LATEST.md` symlink. Continuous updates supported during long sessions (overwrite-or-append based on whether `HANDOVER-LATEST.md` already exists for today).

---

## HARD-CONSTRAINT — Handover-Completeness

The handover-file MUST include all 8 sections listed under `## Verification / Success Criteria`. Skipping a section breaks the next agent's bootstrap. If a section legitimately has nothing to report (e.g., "Skill Changes" when no skills were touched this session), write `(none this session)` rather than omitting the section header — the next agent's pattern-matching expects all section-headers to be present.

References + cross-links to the foundation spec (`seitengold/docs/2026-04-28-aegis-agent-foundation-design.md`) belong in `## Recommendations` if they affect the operator's next decisions, not buried in `## Status`.

---

## Mission

Eliminate the "next agent starts blind" failure mode at session-boundaries. The handover-file IS the bootstrap-input for whoever opens the next session — Claude Code, Codex, or human operator. Quality of handover directly determines quality of next-session start.

Plus: enable **continuous-handover** during long autonomous builds. Write incremental updates to `HANDOVER-LATEST.md` after each major phase, not just at session-end. If a long-running build crashes mid-Phase-3, the resume-agent finds the partial handover documenting Phase-1+2 already done.

---

## Triggers

### Slash-commands

- `/handover` — write session-end handover
- `/übergabe` — alias
- `/session-ende` — alias
- `/recap` — alias

### Auto-trigger keywords

- handover, übergabe, session-ende, fertig, recap, abschluss, weitermachen-vorbereitung
- Plus: when the orchestrator detects a phase-completion event in a long-running build

### Continuous-update trigger

When invoked with `--continuous` (or a CLI-invocation from another skill), updates `HANDOVER-LATEST.md` in-place rather than writing a new dated file. Used by `aegis-customer-build` after each of its 7 phases.

---

## Process

### Phase 1: Determine handover-filename

For session-end (default): `HANDOVER-YYYY-MM-DD-<topic-slug>.md` based on date + 1-3-word session-topic. The topic is inferred from the last user-request or extracted from `.aegis/state.json` `current_phase`.

For continuous-update: write to `HANDOVER-LATEST.md` directly (which is itself a symlink to today's dated file) and append rather than overwrite.

### Phase 2: Gather inputs

Read these in order:
- `git log --oneline -20` — recent commits with SHAs
- `.aegis/state.json` — current state, last completed phase, project-skills
- `git status --short` — unstaged changes, anything still in flight
- `git diff main..HEAD --name-only` — files changed this branch
- For Skill Changes: scan `~/.claude/skills/` and `<repo>/.claude/skills/` for files modified since the last handover

### Phase 3: Write the handover-file

Use the template under `## Verification / Success Criteria` below. Each section MUST be present (write `(none this session)` if empty).

### Phase 4: Update symlink

```bash
cd .claude/handover/
ln -sf HANDOVER-YYYY-MM-DD-<topic>.md HANDOVER-LATEST.md
```

Verify: `readlink HANDOVER-LATEST.md` returns the right target.

### Phase 5: Commit (optional)

If the orchestrator asked for a `--commit` flag: `git add .claude/handover/ && git commit -m "docs(handover): YYYY-MM-DD-<topic>"`. Otherwise leave the file uncommitted — operator commits at their discretion.

---

## Verification / Success Criteria

The handover-file MUST contain these 8 sections, in order:

- [ ] `## Status` — bullet-list of what was completed this session, with concrete file-paths + commit-SHAs (e.g., `b837c6d release(skills): bump to 0.3.0`)
- [ ] `## Metrics` — quality-gate results (build / tsc / lint / tests / aegis-scan / brutaler-anwalt / lighthouse / skillforge-validate / briefing-coverage)
- [ ] `## Files Changed` — list of new + modified files (`git diff main..HEAD --name-only`)
- [ ] `## Skill Changes` — any SKILL.md edits, new skills, frontmatter updates, references added — even minor changes get tracked here
- [ ] `## Open (Pri 1/2/3)` — what's left, prioritized: P1 = blocker for next session, P2 = should-do-soon, P3 = nice-to-have
- [ ] `## Known Fallstricke` — gotchas to remember (e.g., "the SkillForge validator rejects top-level frontmatter fields outside the allowlist; use metadata: nesting")
- [ ] `## Next Steps` — concrete actions for the next session, ordered by sequence (e.g., "1. Run `pnpm test`. 2. If green, push the branch. 3. Open PR.")
- [ ] `## Recommendations` — what the operator should do (deploy, review, npm-publish, etc.) — actions that need human-judgment

Plus the symlink check:
- [ ] `readlink .claude/handover/HANDOVER-LATEST.md` returns the new file (not a stale earlier handover)

---

## Anti-Patterns

- ❌ Vague status ("worked on stuff") — must be concrete with file-paths + commit-SHAs
- ❌ Missing skill-changes section — even minor frontmatter edits must be tracked (next agent needs to know)
- ❌ Skipping symlink update — next session won't find the latest handover
- ❌ Mixing P1 and P3 items in the same list — prioritize, don't dump
- ❌ "We'll fix this later" without a Pri-line — every deferred item belongs in Open (Pri X)
- ❌ Writing the handover BEFORE the current phase is actually complete — handover comes after the work, not as a way to declare it done
- ❌ Overwriting a continuous-handover with a session-end-handover when both happen on the same day — append + symlink-rotate, don't lose history

---

## Extension Points

- **Per-use-case handover-templates** — drop a custom template into `.claude/handover/templates/<use-case>.md`. The skill detects it via filename-match and uses it instead of the default template. Useful when customer-build sessions need a different shape than compliance-audit sessions.
- **Domain-specific sections** — extend the 8-section template with extra sections (e.g., `## Security Findings` for compliance-audit, `## Pages Built` for customer-build). Add to the use-case template.
- **External system updates** — add hooks that, after writing the handover-file, update Linear / Jira / Slack with a summary. Implement as PostToolUse hooks in `.claude/settings.json`, NOT as logic inside this skill.
- **Continuous-handover-frequency** — for very long builds (4-5h+), the customer-build orchestrator can call this skill with `--continuous` after every phase. Each call appends to `HANDOVER-LATEST.md` rather than rotating to a new dated file.
- **Per-handover sign-off** — add a `## Operator Sign-off` section template for handovers that require explicit human review before next-session-resume. Useful for production-deploy gates.
