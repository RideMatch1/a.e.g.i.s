# AGENTS.md — AEGIS Skill-Pool Router

> Universal router for Claude Code AND Codex (and any AGENTS.md-aware harness).
> Hierarchical loading reduces token-load by ≥70% vs flat skill-pool.
> Skill-pack version: 0.4.0 (Phase 2 — full aegis-native cluster, all 8 foundation skills active).

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
| Library engine | (project-specific, e.g., assemble-templates.sh) | (same) | (same) |
| Aegis scan | `npx -y @aegis-scan/cli scan <url>` | (same) | (same) |
| Lighthouse | `npx -y @lhci/cli@latest collect` | (same) | (same) |
| Playwright | `npx -y playwright-core` | (same) | (same) |
| Curl | `curl` | (same) | (same) |

**Tool-name aliases** (skill body conventions): `shell-ops` ≡ `Bash` / native shell. `file-ops` ≡ `Read`/`Write`/`Edit` / native file tools. `task-tracking` ≡ `TodoWrite` / `update_plan`. `subagent-dispatch` ≡ `Task` / `spawn_agent`. `library-engine` / `aegis-scan` / `brutaler-anwalt` / `lighthouse` / `curl` / `playwright` are domain-specific tool-categories invoked per the table above.

---

## Use-Case Routing

| User intent / file pattern | → Skill cluster |
|---|---|
| "audit", "compliance", "DSGVO", "Impressum", "Cookie", "Abmahnung", "TTDSG", "DDG", "AVV", "AGB" | `compliance/_INDEX.md` (brutaler-anwalt) + `aegis-native/_INDEX.md` (aegis-audit + dsgvo-compliance) |
| "build customer", "neue kundenseite", "konfigurator-briefing", "agentur-build" | `aegis-native/_INDEX.md` (aegis-customer-build → aegis-quality-gates) |
| "test aegis", "verify foundation", "smoke", "self-test" | `aegis-native/_INDEX.md` (aegis-quality-gates → aegis-audit) |
| "scan", "security audit", "pen-test", "OWASP", "SAST", "DAST" | `defensive/_INDEX.md` + `offensive/_INDEX.md` + `aegis-native/_INDEX.md` (aegis-audit) |
| "module", "feature", "DB migration", "API route", "refactor" | `aegis-native/_INDEX.md` (aegis-module-builder) |
| "session", "start", "phase", "handover", "bootstrap", "weiter" | `aegis-native/_INDEX.md` (aegis-orchestrator) |
| "neuer skill", "skill erstellen", "skill verbessern", "meta-skill" | `aegis-native/_INDEX.md` (aegis-skill-creator) |
| "consent", "retention", "art-13", "art-15", "datenpanne", "schrems" | `aegis-native/_INDEX.md` (dsgvo-compliance) |

---

## Skill Categories

- `aegis-native/` — Foundation skills (orchestrator, customer-build, audit, module-builder, skill-creator, dsgvo-compliance, handover-writer, quality-gates). _0.4.0 ✓._
- `compliance/` — Regulatory + legal: brutaler-anwalt (DSGVO/UWG/AGB/Impressum/Cookies/AVV/NIS2/AI-Act). _0.3.0 ✓._
- `defensive/` — Security analysis (scan, hardening). _Existing._
- `offensive/` — Adversarial testing (snailsploit-fork). _Existing._
- `ops/` — Operations (monitoring, runbooks). _Existing._
- `mitre-mapped/` — MITRE-ATT&CK-aligned techniques. _Existing._

---

## Rules for skills routed via this AGENTS.md

- Each skill that ships under `<category>/aegis-native/<name>/` MUST have a HARD-CONSTRAINT-frontmatter block (per `parseHardConstraintFrontmatter` in `skills-loader.ts`). Required fields nested under `metadata:`: `required_tools`, `required_audit_passes`, `enforced_quality_gates`, `pre_done_audit`. Top-level: `model` (opus|sonnet|haiku), `license` (typically `MIT`).
- Each skill MUST pass SkillForge `validate-skill.py` 16/17 or higher — `## Triggers`, `## Process`, `## Verification / Success Criteria`, `## Anti-Patterns`, `## Extension Points` sections required. The 1-warning ceiling allows for "5+ phases — recommend 1-3" advisories on intentionally-multi-phase skills.
- Multi-file skills (SKILL.md + sibling `references/`) are auto-installed by `@aegis-scan/skills install` (since v0.2.0).
- Validation against the local consumer-side install path: leading `<!-- aegis-local -->` HTML comments break the SkillForge regex anchor; use the wrapper script in `CONTRIBUTING.md` to strip the comment for validation.

---

## Cluster Composition Reference

Foundation use-cases compose into multi-skill clusters (per `aegis-native/_INDEX.md`):

| Use-case | Cluster |
|---|---|
| customer-build | aegis-orchestrator → aegis-customer-build → aegis-quality-gates → aegis-handover-writer |
| compliance-audit | aegis-orchestrator → aegis-audit + brutaler-anwalt → dsgvo-compliance → aegis-handover-writer |
| dev-feature | aegis-orchestrator → aegis-module-builder → aegis-quality-gates → aegis-handover-writer |
| aegis-self-test | aegis-orchestrator → aegis-quality-gates → aegis-audit → aegis-handover-writer |
| skill-authoring | aegis-orchestrator → aegis-skill-creator → aegis-quality-gates → aegis-handover-writer |

Every cluster ends with `aegis-handover-writer` to ensure the next session bootstraps with full context.

---

## Forward-compat note

`AGENTS.md` v0.4.0 routes the full 8-skill aegis-native foundation cluster + the v0.3.0 brutaler-anwalt compliance skill. Future additions (Phase 3 CLI commands, `aegis-deploy` automation, additional category `_INDEX.md` files for `defensive/` / `offensive/` / `ops/` / `mitre-mapped/`) extend per the rules above.
