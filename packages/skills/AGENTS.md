# AGENTS.md — AEGIS Skill-Pool Router

> Universal router for Claude Code AND Codex (and any AGENTS.md-aware harness).
> Hierarchical loading reduces token-load by ≥70% vs flat skill-pool.
> Skill-pack version: 0.3.0 (Phase 1 — POC with brutaler-anwalt; full router lands in 0.4.0 with all aegis-native skills).

---

## Bootstrap

Before responding to any user request, the agent **MUST**:

1. Read `.claude/handover/HANDOVER-LATEST.md` (Claude Code) OR `.codex/handover/HANDOVER-LATEST.md` (Codex). On `--platform=both`, both paths point to the same file via symlink.
2. Read `CLAUDE.md` (project rules and quality-gates) if present in the project root.
3. Read this `AGENTS.md` (router + tool-mapping table — already in context if AGENTS.md is loaded).
4. Read project-skill if present: `.claude/skills/<project-slug>/SKILL.md`.
5. Read latest audit-state: `.aegis/state.json`.
6. Print: `Tool-inventory: [...], Skills available: [...], Project-state: phase X, Use-case: Y`.
7. **Then** process the user's request.

If any of (1)-(5) is missing, STOP and report the gap. Don't improvise.

> On Codex this bootstrap-section is the SessionStart-Hook equivalent (per the foundation spec §14.5). On Claude Code the same agent-side discipline applies; harness-side `.claude/settings.json` SessionStart-Hook complements it.

---

## Tool-Category Mapping (canonical)

Skills reference **tool-categories**, not harness-specific tool-names. This table tells the agent which tool to invoke per harness.

| Tool category | Claude Code | Codex | Copilot CLI |
|---|---|---|---|
| File read | `Read` | native file-read | native file-read |
| File write | `Write` | native file-write | native file-write |
| File edit | `Edit` | native file-edit | native file-edit |
| Shell command | `Bash` | native shell | native shell |
| Task tracking | `TodoWrite` | `update_plan` | (varies) |
| Subagent dispatch | `Task` (named agent type) | `spawn_agent` (worker, message-framing) | (per docs) |
| Subagent wait | (auto on Task return) | `wait` | (per docs) |
| Subagent free slot | (auto) | `close_agent` | (per docs) |
| Skill invocation | `Skill` tool | (skills load via plugin-manifest at session-start; content in context) | (per docs) |

**Tool-name aliases** (skill body conventions): `shell-ops` ≡ `Bash` / native shell. `file-ops` ≡ `Read`/`Write`/`Edit` / native file tools. `task-tracking` ≡ `TodoWrite` / `update_plan`. `subagent-dispatch` ≡ `Task` / `spawn_agent`.

---

## Use-Case Routing

| User intent / file pattern | → Skill cluster |
|---|---|
| "audit", "compliance", "DSGVO", "Impressum", "Cookie", "Abmahnung", "TTDSG", "DDG", "AVV", "AGB" | `compliance/_INDEX.md` |
| "build customer", "neue kundenseite", "konfigurator-briefing", "voidframe build" | `aegis-native/_INDEX.md` (post-0.4.0; aegis-customer-build) |
| "test aegis", "verify foundation", "smoke", "self-test" | `aegis-native/_INDEX.md` (post-0.4.0; aegis-quality-gates → aegis-self-test) |
| "scan", "security audit", "pen-test", "OWASP", "SAST", "DAST" | `defensive/_INDEX.md` + `offensive/_INDEX.md` |
| "module", "feature", "DB migration", "API route" | `aegis-native/_INDEX.md` (post-0.4.0; aegis-module-builder) |
| "session", "start", "phase", "handover", "bootstrap" | `aegis-native/_INDEX.md` (post-0.4.0; aegis-orchestrator) |

---

## Skill Categories

- `aegis-native/` — Foundation skills (orchestrator, customer-build, audit, etc.). _Lands in 0.4.0._
- `compliance/` — Regulatory + legal: brutaler-anwalt (DSGVO/UWG/AGB/Impressum/Cookies/AVV/NIS2/AI-Act). _0.3.0 ✓._
- `defensive/` — Security analysis (scan, hardening). _Existing._
- `offensive/` — Adversarial testing (snailsploit-fork). _Existing._
- `ops/` — Operations (monitoring, runbooks). _Existing._
- `mitre-mapped/` — MITRE-ATT&CK-aligned techniques. _Existing._

---

## Rules for skills routed via this AGENTS.md

- Each skill that ships under `<category>/aegis-native/<name>/` MUST have a HARD-CONSTRAINT-frontmatter block (per `parseHardConstraintFrontmatter` in `skills-loader.ts`). Required fields nested under `metadata:`: `required_tools`, `required_audit_passes`, `enforced_quality_gates`, `pre_done_audit`. Top-level: `model` (opus|sonnet|haiku), `license` (typically `MIT`).
- Each skill MUST pass SkillForge `validate-skill.py` 17/17 (or higher) — `## Triggers`, `## Process`, `## Verification / Success Criteria`, `## Anti-Patterns`, `## Extension Points` sections required.
- Multi-file skills (SKILL.md + sibling `references/`) are auto-installed by `@aegis-scan/skills install` (since v0.2.0).

---

## Forward-compat note

This AGENTS.md is the v0.3.0 skeleton. v0.4.0 (Phase 2 of AEGIS Agent Foundation) populates the full `aegis-native/` cluster (orchestrator, customer-build, audit, dsgvo-compliance, module-builder, skill-creator, handover-writer, quality-gates) and adds full `_INDEX.md` files for the remaining 4 categories.
