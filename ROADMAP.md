# AEGIS — Roadmap

> **Last updated:** 2026-04-28
> **Maintainer status:** Single maintainer (RideMatch1).
> **License:** MIT.
> **Stability:** Released packages (0.17.x scanner-family, 0.4.0 skills) are stable for production use; agent-foundation work (Phase 3+) is in active development.

This file communicates AEGIS's direction publicly so that potential users, contributors, and downstream consumers can make informed decisions about adoption, contribution, and long-term reliance.

---

## Bus-factor + Reliability statement

AEGIS is currently developed by a single maintainer. This is honest single-point-of-failure exposure. Mitigations in place:

- **MIT license + public source.** Forking is unambiguous if maintenance lapses.
- **SLSA Level 2+ provenance** on every published package. Consumers can verify upstream supply-chain even if the maintainer disappears.
- **Repository ruleset enforcement** (signed commits, linear history, no force-push to main). New maintainers cannot rewrite history silently.
- **Scrub-gates + supply-chain CI** documented in `.github/workflows/`. Reproducible release process.
- **Comprehensive tests** (3000+ across packages, canary fixtures with real OSS code) so a fork can verify the bar from day one.

If you want to help reduce single-maintainer exposure: contributions are welcome (see "How to contribute" below). High-leverage areas for new contributors are flagged in the roadmap items.

---

## Current state — shipped and stable

| Package | Version | Status |
|---|---|---|
| `@aegis-scan/core` | 0.17.0 | Stable |
| `@aegis-scan/scanners` | 0.17.0 | Stable |
| `@aegis-scan/reporters` | 0.17.0 | Stable |
| `@aegis-scan/cli` | 0.17.0 | Stable |
| `@aegis-scan/mcp-server` | 0.17.0 | Stable |
| `@aegis-scan/skills` | 0.4.0 | Stable (foundation cluster shipped 2026-04-28) |
| `@aegis-wizard/cli` | 0.16.x | Stable (scaffold) |

42 built-in checkers + 20 external-tool wrappers + 8 foundation skills + adversarial DE/EU compliance auditor (`brutaler-anwalt`) + 37 forked offensive-security skills.

---

## Active work — Phase 3 (Agent Foundation, in progress)

Per the AEGIS Agent Foundation spec (operator-local design doc, 2026-04-28).

### Phase 3 — CLI + agent-framework package (~8-10h work)

- [ ] New package `@aegis-scan/agent-framework@0.18.0` with platform-detector / session-start-hook / agents-md-generator / skill-frontmatter-validator / project-skill-generator / state-tracker / env-detect / cooldown-gate / presets-loader (9 modules with TDD per module).
- [ ] New CLI subcommands `aegis foundation {init,update,verify,project-init,audit,status}` wired up in `packages/cli/src/commands/foundation/`.
- [ ] New CLI subcommand `aegis foundation verify --residue` (Gate 10 stale-reference detection per the v0.4.0+ `aegis-quality-gates` skill spec).
- [ ] New template `templates/customer-project/` with CLAUDE.md / AGENTS.md / .claude/settings.json (SessionStart-Hook) / .codex/config.toml / .aegis/state.json / .husky/{pre-commit,pre-push}.
- [ ] New presets `presets/{customer-build,compliance-audit,dev-feature,aegis-self-test}.yaml`.
- [ ] CLI bumps 0.17.x → 0.18.0; agent-framework new at 0.18.0.

**Acceptance:** `npm install -g @aegis-scan/cli@0.18.0 && aegis foundation init --use-case=customer-build` works in an empty repo.

### Phase 4 — End-to-end acceptance (~6-8h, operator-driven)

- [ ] Drive a real Claude Code session AND a Codex session through the foundation on a test customer project. Verify hand-off and recovery work cross-platform.
- [ ] Phase 4.5 post-publish-audit: tarball-pack + scratch-install smoke + CodeQL triage + SLSA verify per published package.

### Phase 5 — OSS-launch documentation (~3-5h)

- [ ] `docs/CREDITS.md`, `docs/GETTING-STARTED.md`, `docs/ARCHITECTURE.md`, `docs/SKILL-AUTHORING.md`, `docs/PLATFORM-NOTES.md`.
- [ ] README expansion with adoption-guide + comparison-table vs Snyk / Semgrep / CodeQL.
- [ ] Final v0.18.0 publish across the family.

---

## Audit-driven improvements — backlog (post-Grok-critique 2026-04-28)

Items captured from external audits to address visibility, transparency, and reliability gaps.

### Quick visibility wins (≤1d total)

- [ ] Coverage badge + Codecov integration in CI.
- [x] Public ROADMAP.md (this file).
- [x] Pre-tag security-review-checklist (see `RELEASE_CHECKLIST.md`).
- [ ] Per-scanner status table in terminal reporter (more granular than current "Missing: …" line).

### Deep-value reliability work (1-3d total)

- [ ] Cross-file taint corpus expansion: n<20 → n≥30 (real OSS-project canary fixtures, currently medium-confidence).
- [ ] Real Supabase RLS E2E tests via `supabase start` (local docker), 5-10 RLS-bypass scenarios.
- [ ] Flake-detection in CI (vitest junit-reporter + flaky-test action) to root-cause the turbo-parallel-AST race.
- [ ] Multi-agent skill format support beyond Claude (Cursor `.cursor/rules/`, Windsurf `.windsurf/rules/`, Codex `.codex/`). AGENTS.md universal-router already covers Codex; Cursor + Windsurf need tool-mapping rows.

### Strategic / longer-term

- [ ] Scheduled GHA: weekly upstream-sync of `snailsploit-fork` (open PR when upstream changes, preserve aegis-local headers).
- [ ] Public benchmark dashboard on GitHub Pages: 21+9 fixtures plus comparison vs Snyk / Semgrep / CodeQL on a fixed corpus.
- [ ] Migrate the 41 regex-based checkers to AST-walks one-per-sprint (reduces refactor-fragility per audit feedback).

---

## How to contribute

This project welcomes contributions. The single-maintainer status means meaningful PRs significantly reduce bus-factor risk.

### High-leverage areas for new contributors

1. **Cross-file taint canary fixtures** — add real OSS-project examples to `packages/benchmark/canary-fixtures/` to bump corpus n. Each fixture is one PR.
2. **Real-tool E2E tests** — Supabase RLS instances (docker-based) for `rls-bypass-checker` and `tenant-isolation-checker`. High-confidence proof of correctness.
3. **Skill authoring** — write new defensive / mitre-mapped / ops / compliance skills following the SkillForge methodology in `packages/skills/skills/foundation/aegis-native/aegis-skill-creator/`.
4. **Cursor / Windsurf agent-format adaptors** — extend AGENTS.md tool-mapping table + add per-platform rule files.

### Process

1. Open an issue describing the contribution (avoid duplicate work).
2. For PRs: tests first (TDD per `superpowers:test-driven-development`), then implementation.
3. Pre-tag security-review checklist applies (`RELEASE_CHECKLIST.md`).
4. Signed commits required (repository ruleset enforces SSH or GPG signature on every commit to main).

### Reporting issues

- **Bugs**: GitHub Issues with reproduction steps.
- **Security issues**: see `SECURITY.md` for the responsible-disclosure channel; do NOT open a public issue for actively-exploitable findings.
- **Skill or methodology gaps**: GitHub Issues with the user-story.

---

## What this roadmap is NOT

- A commitment to specific release dates. Release cadence is driven by audit + quality-gate completion, not a fixed schedule.
- A guarantee of features. Items are intentions; some may be re-prioritized or dropped based on user feedback.
- A complete picture of internal experimentation. Operator-local research happens in `aegis-precision/` (gitignored) and may surface here when ready to ship.

---

**For day-by-day work tracking**, see the AEGIS Agent Foundation handover docs (operator-local, pointer-only).
