# Changelog

All notable changes to `@aegis-scan/skills` are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The
skills package uses SemVer; each minor-version may add new skill
sources and categories. Release cadence is driven by upstream-sync
and quality-audit completion, not by a fixed schedule.

---

## [Unreleased]

### Added

- **Plans.md — Live Working-Plan SSOT pattern** in `aegis-orchestrator/SKILL.md`. Defines `.aegis/Plans.md` as the single source of truth for in-flight tasks + acceptance criteria + blockers, complementing `state.json` (machine-readable phase) and handover docs (point-in-time snapshots). Lifecycle: orchestrator initializes, specialist skills update, handover-writer summarizes at session-end. AC-discipline: every task carries observable + independently verifiable acceptance criteria; task is DONE only when all AC are checked; blocked tasks keep AC unchanged and document the blocker. Concept adapted from [Chachamaru127/claude-code-harness](https://github.com/Chachamaru127/claude-code-harness) (MIT) — pure markdown integration, no fork, no Go binary, no install.
- **Gate 10 — Residue-Check** added to `aegis-quality-gates/SKILL.md`. Detects stale commit-SHAs in handover docs (caught the v0.4.0 publish-procedure bug where rebase invalidated cited SHAs), broken markdown cross-links in shipped SKILL.md content, orphan path references, phantom `_INDEX.md` skill rows pointing at non-existent paths, dead `<!-- aegis-local: -->` provenance refs. Pure shell + grep methodology — runs in both `--quick` and `--final` modes, plus a new `--residue` operator-on-demand mode for post-rebase / post-merge checks. Concept adapted from claude-code-harness's `harness doctor --residue` (MIT).
- **Plans.md task-discipline** referenced from `aegis-module-builder/SKILL.md`. Module-builder feature-specs map their acceptance-criteria 1:1 onto the Plans.md AC-checkbox format defined in aegis-orchestrator. Module-build phases 2-6 check off AC as they progress; task moves DONE only when all AC are checked.

### Updated

- `aegis-quality-gates`: description + frontmatter `enforced_quality_gates` bumped from 9 → 10 to reflect the new residue-check gate.
- `aegis-orchestrator`: bootstrap-checklist extended from 6 to 8 steps (added Plans.md read at step 6, expanded print at step 7).
- `packages/skills/ATTRIBUTION.md` — new "concept-only" attribution section for claude-code-harness documenting both pattern adoptions, what was NOT adopted, and why concept-only beats fork-or-mandate for methodology adoption.

- **External-skills mandate-without-fork integration** with [supabase/agent-skills](https://github.com/supabase/agent-skills) (MIT). Two upstream skills (`supabase` + `supabase-postgres-best-practices`) are now declared **mandatory complements** to the AEGIS-native security layer for any project using Supabase or Postgres. Installation via the upstream's own distribution channel (`npx skills add supabase/agent-skills -g -y`) — not re-shipped here. Rationale: upstream is actively maintained by the Supabase team with frequent updates the AEGIS team has no special insight into, so fork-mode would freeze content at a fork-SHA + create unnecessary quarterly upstream-sync work for content that benefits from staying current.
  - `ATTRIBUTION.md` — new "Required external skills (mandatory complement, not forked)" section documenting the rationale, install command, and license-compatibility chain.
  - `README.md` — new "Required external skills (mandatory complement, not forked)" section under "What ships" with explicit install instructions and the cross-reference map.
  - `skills/defensive/aegis-native/rls-defense/SKILL.md` — new "Complementary external skill (mandatory)" section pointing to upstream `security-rls-basics.md`, `security-rls-performance.md`, and `security-privileges.md` reference files.
  - `skills/defensive/aegis-native/tenant-isolation-defense/SKILL.md` — new "Complementary external skill (mandatory)" section pointing to upstream `supabase` and `supabase-postgres-best-practices` skills.
  - AEGIS repository root — new `AGENTS.md` documents the repo-wide mandate for AI coding-agents working in this repo and the layer-split between AEGIS-native security and upstream Supabase dev/perf coverage.

### Notes

- This [Unreleased] entry establishes **three external-source integration-patterns** that AEGIS now uses, picked per-source based on stability + maintenance-economics:
  1. **Fork-mode** (`snailsploit-fork`) — content forked into `skills/<category>/<source>/` with attribution headers; quarterly upstream-sync.
  2. **Mandate-without-fork** (`supabase/agent-skills`) — install via upstream's own distribution channel; cross-reference from AEGIS skills.
  3. **Concept-only adoption** (`Chachamaru127/claude-code-harness`) — methodology adapted into existing AEGIS skills via prose; zero code, zero install, attribution preserved in this CHANGELOG + ATTRIBUTION.md.

---

## [0.4.0] — 2026-04-28 — "Full foundation cluster (Phase 2 of AEGIS Agent Foundation)"

### Added — 5 new foundation skills

The remaining 5 of 8 foundation skills land in this minor, completing the v0.4.0 foundation cluster started in v0.3.0 (which shipped orchestrator + handover-writer + quality-gates).

- **`aegis-customer-build`** (multi-file, `model: opus`) — library-engine-driven autonomous customer-website builder. Ingests a configurator-output briefing.md, runs Pre-Build-Validation + 7 phases (Recon / Architecture / Component-Build / Content / Integration / Mid-Audit / Final-Verify) + Post-Build status-report. Multi-agent orchestration via subagent-dispatch (Master + Research + Executor + Strategist). Hits production-bar 994/S/FORTRESS + Lighthouse 98+ + briefing-coverage 100% or returns INCOMPLETE-Status. SKILL.md + 7 phase-references (`phase-1-recon` through `phase-7-final-verify` covering briefing-parser-checklist, architecture-decisions, component-build pattern, copy/SEO/Schema, API-route + DSGVO-form pattern, mid-audit repair-loop, 9-gate final-verify + briefing-coverage). validate 17/18 (1 advisory warning on 7 intentional phases).
- **`aegis-module-builder`** (single-file, `model: sonnet`) — Generic feature-dev workflow with TDD-first discipline. Six-phase pipeline: Plan / Test (red) / Implement (green) / Verify (gates 1-4) / Polish / Commit. Wraps DB-migration + API-route (secureApiRoute + Zod-strict + requireRole) + Service-Layer + UI-Component + Tests + Optimistic-Updates. References `superpowers:test-driven-development` for TDD-mechanics. validate 16/18 (intentional 6-phase + intentional single-file design).
- **`aegis-audit`** (multi-file, `model: opus`) — 8-Layer paranoid-audit skill. Layers: HTTP-Headers / HTML-Live-Probe / Impressum / DSE / Cookie+Consent / Branche-Specific / Code-Cross-Check / Schadens-Diagnose. Runs against built customer-site, live URL, or local repo. Output 4-section format (Schadens-Diagnose / Findings-Tabelle / Anwalts-Anhang / Abmahn-Simulation) with €-range estimates per industry × visibility × competitor formula. SKILL.md + 8 layer-references (`layer-1-headers` through `layer-8-schadens-diagnose`). Cross-checks with brutaler-anwalt at shared layers (Impressum / DSE / Cookie). validate 16/17 (1 advisory).
- **`aegis-skill-creator`** (multi-file, `model: opus`) — Meta-skill that builds new skills via SkillForge methodology (tripleyak/SkillForge MIT) + AEGIS HARD-CONSTRAINT-format. Five-phase pipeline: Triage (USE_EXISTING / IMPROVE / CREATE_NEW / COMPOSE) / Scaffold (init_skill.py-style) / Iterate (11-Lens-Analysis) / Validate (auto-iterate to 16/17+) / Commit. SKILL.md + 2 references (`skillforge-methodology.md` with attribution + `hard-constraint-template.md` per-skill-type templates: orchestrator / builder / auditor / writer / verifier / meta). validate 17/18 (1 advisory on 5 phases).
- **`dsgvo-compliance`** (multi-file, `model: opus`) — DSGVO baseline-checks for AEGIS-bootstrapped projects. Five-phase pipeline: Consent-mapping / Retention-policy / Art. 13 info-templates / Datenpanne 72h-runbook / Schrems-II TIA. Sister-skill to brutaler-anwalt (audit findings vs fix-templates). SKILL.md + 2 references (`art-13-15-templates.md` covering full DSE template + Art. 15 Auskunftsanfrage-Antwort + per-form short-form Art. 13; `datenpanne-runbook.md` covering Sofortmaßnahmen + 72h-Timeline + Risiko-Bewertung + Art. 33/34 templates + Aufsichtsbehörden-Kontakte per Bundesland). RDG-Linie respected: templates + runbooks, not individual legal advice. validate 16/17 (1 advisory).

### Updated — Master AGENTS.md + foundation/_INDEX.md (full activation)

- **`packages/skills/AGENTS.md`** — removes all `_(post-0.4.0)_` placeholder-markers from Use-Case Routing table. Adds rows for module-builder / skill-creator / dsgvo-compliance use-cases. Adds Tool-Category Mapping rows for `library-engine` / `aegis-scan` / `lighthouse` / `playwright` / `curl` (the domain-specific tool-categories required by the new foundation skills). Adds Cluster Composition Reference table mapping each use-case to its multi-skill cluster (every cluster ends with aegis-handover-writer for next-session bootstrap).
- **`packages/skills/skills/foundation/_INDEX.md`** — removes all `_(post-0.4.0)_` markers, adds full path + slash-command surface for all 8 skills. Adds Cluster Composition Patterns table.

### Updated — manifest test

- **`__tests__/manifest.test.ts`** — `EXPECTED_TOTAL` 50 → 55 (5 new foundation skills auto-detected by `loadAllSkills()`). `EXPECTED_NAMES_BY_CATEGORY['foundation']` adds the 5 new names alphabetically: `aegis-audit`, `aegis-customer-build`, `aegis-module-builder`, `aegis-skill-creator`, `dsgvo-compliance` (joining the 3 v0.3.0 skills).

### Validation

- All 5 new SKILL.md files pass SkillForge `validate-skill.py` ≥ 16/17 (the 1-warning ceiling per the `foundation/_INDEX.md` rule allows for advisory warnings on intentionally-multi-phase skills).
- All 16 new `references/*.md` files pass scrub-clean (no internal-codename leaks). Total references-files added: 7 (customer-build phases) + 8 (audit layers) + 2 (skill-creator) + 2 (dsgvo-compliance) − 1 single-file = 18 reference-files plus 5 SKILL.md = 23 new markdown files.
- `tsc --noEmit` clean. **486 / 486 tests pass post-addition** (was 432, +54 auto-generated for 5 new skills + 18 new references). Test breakdown: scrub 92 (was 68, +24), attribution 150 (was 140, +10), frontmatter 227 (was 207, +20), manifest 17 (unchanged count, EXPECTED_TOTAL bumped).
- All scrub-test FORBIDDEN-codename patterns clean across new content (the canonical scrub-list lives in `__tests__/scrub.test.ts` plus the CI tarball-scrub gate). The customer-build skill uses the `library-engine` tool-category placeholder consistently per the foundation-spec privacy-residue convention, not any private-engine codename.

### Notes

- Hierarchical loading via the v0.4.0 master AGENTS.md plus foundation/_INDEX.md: token-budget reduction estimate ≥70% versus a flat skill-pool now applies for the full foundation cluster (was just brutaler-anwalt at v0.3.0).
- 5 cluster-composition patterns documented in AGENTS.md + _INDEX.md (customer-build / compliance-audit / dev-feature / aegis-self-test / skill-authoring) — each cluster terminates with aegis-handover-writer per the discipline that no session ends without writing a handover.
- HARD-CONSTRAINT-frontmatter format from v0.3.0 applied uniformly to all 5 new skills under `metadata:` nesting per the SkillForge validator's allowlist constraint. `parseHardConstraintFrontmatter()` from `skills-loader.ts` reads them without code change.
- Phase 3 of the AEGIS Agent Foundation (CLI + agent-framework package) follows in `@aegis-scan/cli@0.18.0` + `@aegis-scan/agent-framework@0.18.0` (separate publishes).

---

## [0.3.0] — 2026-04-28 — "HARD-CONSTRAINT-frontmatter + AGENTS.md router (Phase 1 of AEGIS Agent Foundation)"

### Added

- **HARD-CONSTRAINT frontmatter format** — adds the v0.3.0 metadata-nested fields used by the AEGIS Agent Foundation (`metadata.required_tools`, `metadata.required_audit_passes`, `metadata.enforced_quality_gates`, `metadata.pre_done_audit`) plus top-level `model` (opus|sonnet|haiku) and `license` (typically MIT). The fields are visible to agents reading the SKILL.md content as the un-skippable Reference-Loading + Pre-Done-Audit gate. Loader-compatible: comma-separated strings stay parser-stable; YAML-array-form deferred until at least three skills need true arrays. Per spec §2 Component 3 + §13.3 + §8 dec 7 of the Foundation design.
- **`parseHardConstraintFrontmatter()`** exported from `skills-loader.ts`. Reads top-level `name` / `description` / `model` / `license` plus the four metadata-nested HARD-CONSTRAINT fields. Backward-compat: top-level form still accepted as transitional fallback. Includes `extractMetadataField()` helper for two-level YAML extraction. 5 new unit-tests in `__tests__/frontmatter.test.ts` (canonical metadata-nested + flat-fallback + leading-aegis-local-comment-tolerance + missing-frontmatter graceful-empty + complete-skill-roundtrip). Total: 410 tests passing.
- **`brutaler-anwalt` upgraded** with HARD-CONSTRAINT-frontmatter (under `metadata:`) + 5 missing structural sections — `## Triggers` (renamed from `## Trigger-Pattern`), `## Process` (new — wraps the 4 Modi + 8-Phasen-HUNTER-Workflow), `## Verification / Success Criteria` (new — 8-checkbox pre-done gate), `## Anti-Patterns` (renamed from singular `## Anti-Pattern`), `## Extension Points` (new — extension-paths for references / branchen / modi / hooks). Plus a HARD-CONSTRAINT — Reference-Loading block that forbids improvisation: every finding must cite § / Art. + Az. + reference-file-path. SkillForge `validate-skill.py` against the consumer-side install-path: 9/16 → **17/17 ALL CHECKS PASSED**.
- **`packages/skills/AGENTS.md`** (new at the package root) — universal router skeleton covering Bootstrap-checklist, Tool-Category Mapping table (Claude Code / Codex / Copilot CLI columns), Use-Case Routing, and Skill Categories overview. Forward-compat note flags v0.4.0 expansion to the full `aegis-native/` cluster.
- **`packages/skills/skills/compliance/_INDEX.md`** (new) — trigger-table for the compliance category, routing brutaler-anwalt today + a forward-compat slot for `dsgvo-compliance` post-v0.4.0. Slash-command surface documented (`/anwalt` with `hunt`/`simulate`/`consult` sub-modes plus `/audit` and `/compliance-check` aliases). Bootstrap-checklist for category-loaders.

### Notes

- Hierarchical skill-loading per the Foundation spec §2 Component 2 + §13.4. Token-budget reduction estimate ≥70% versus a flat skill-pool once the full v0.4.0 cluster lands. The tool-mapping table in AGENTS.md establishes the universal alias set (`shell-ops` / `file-ops` / `task-tracking` / `subagent-dispatch`) so skills stay harness-agnostic in their HARD-CONSTRAINT-blocks.
- No CLI-surface changes in this minor — `aegis-skills list --category compliance` continues to surface brutaler-anwalt; the new metadata fields are extracted from the SKILL.md when consumers call `parseHardConstraintFrontmatter()` directly. Loader's existing `loadAllSkills()` is unchanged.
- `tsc --noEmit` clean. All 410 tests passing across scrub / attribution / frontmatter / manifest suites.

---

## [0.2.1] — 2026-04-28 — "list --category compliance hotfix"

### Fixed

- **`aegis-skills list --category compliance` was rejected** by the CLI's hardcoded `VALID_CATEGORIES` whitelist in `packages/skills/src/commands/list.ts:19`. The whitelist still listed only the four pre-v0.2.0 categories (`offensive`, `defensive`, `mitre-mapped`, `ops`) and mismatched the actual on-disk category set, so callers filtering to the new `compliance` category got `Error: --category must be one of …` instead of the brutaler-anwalt entry. Added `compliance` to the whitelist + updated the JSDoc + updated the `--help` text in `bin.ts`. The unit-tests already covered category-filter happy-path on the existing categories; this hotfix relies on the post-publish manual smoke (`npx -y @aegis-scan/skills@0.2.1 list --category compliance` returns brutaler-anwalt) for evidence.

### Meta

- Same-day patch on top of `0.2.0`. The bug was caught by a post-publish manual install + run, not by source-side tests — class-lesson logged: every new category-string surface needs an end-to-end CLI smoke before tag-push, not just a manifest-test.

---

## [0.2.0] — 2026-04-27 — "four-category-population + compliance with brutaler-anwalt"

### Added — four category populations (defensive / mitre-mapped / ops / compliance)

Ten new AEGIS-native `SKILL.md` files (MIT) populate four previously-placeholder category directories:

- **`skills/defensive/aegis-native/`** (3 skills) — `rls-defense`, `tenant-isolation-defense`, `ssrf-defense`. Mirror `@aegis-wizard/cli` patterns and provide remediation guidance for `@aegis-scan/cli` scanner findings (`rls-bypass-checker`, `tenant-isolation-checker`, `ssrf-checker`, `taint-analyzer`, `mass-assignment-checker`, `template-sql-checker`).
- **`skills/mitre-mapped/aegis-native/`** (3 skills) — `mapping-overview`, `t1190-exploit-public-app`, `t1078-valid-accounts`. Cross-walk AEGIS findings to MITRE ATT&CK Enterprise + ATLAS + D3FEND + NIST CSF 2.0 + NIST AI RMF.
- **`skills/ops/aegis-native/`** (3 skills) — `triage-finding`, `suppress-correctly`, `escalation-runbook`. Operational runbooks for the AEGIS workflow itself.
- **`skills/compliance/aegis-native/`** (1 skill) — `brutaler-anwalt`. Adversarial DE/EU compliance auditor (DSGVO / DDG / TTDSG / UWG / NIS2 / EU AI Act / branchenrecht / strafrecht-steuer) with three-persona self-verification (Hunter / Challenger / Synthesizer). Slash-command activation via `/anwalt`. Multi-file: ships an 11-file `references/` sibling tree (~120 KB) covering `audit-patterns.md`, `dsgvo.md`, `it-recht.md`, `vertragsrecht.md`, `checklisten.md`, `branchenrecht.md`, `bgh-urteile.md`, `abmahn-templates.md`, `aegis-integration.md`, `international.md`, `strafrecht-steuer.md`. The `aegis-integration.md` reference defines the consume-AEGIS-scanner-output severity-mapping (critical → 🔴 KRITISCH ≥70%, high → 🟡 HOCH 40–70%, etc.) so the skill bridges AEGIS technical findings to the rechtliche Bewertungs-Layer.

Total skills jumps from 37 to 47. All new content is MIT-AEGIS-original; no upstream-fork dependency. The `aegis-native/` source-namespace convention parallels the existing `snailsploit-fork/` for offensive skills, leaving room for future non-AEGIS sources (e.g., `defensive/anthropic-cybersec-pick/`) to slot in without layout churn.

### Added — installer support for multi-file skills (`references/` siblings)

`packages/skills/src/commands/install.ts` extended to copy any sibling `references/` directory next to a `SKILL.md` so multi-file skills stay self-consistent under the install target. The `brutaler-anwalt` skill is the first consumer; any future skill that ships supporting `.md` references inherits the same packaging treatment automatically. `--force` semantics extend naturally — references are overwritten alongside the SKILL.md they belong to. Markdown-only invariant intact (the new code only touches `.md` extensions).

### Added — scrub-test coverage for `references/` siblings

`__tests__/scrub.test.ts` gains a new describe-block (`scrub-clean — sibling references/ directories`) that iterates every SKILL.md, looks for a sibling `references/` dir, and runs the same FORBIDDEN-codename scan over each `.md` reference. Without this block, leaks in references would slip past source-side gates and only fail at the CI tarball-scrub step. Defense-in-depth: this catches them at unit-test time, source-side, before any push.

### Updated

- `skills/defensive/README.md`, `skills/mitre-mapped/README.md`, `skills/ops/README.md` — replace v0.2+ placeholder text with directory-of-shipped-content tables.
- `ATTRIBUTION.md` — credit the AEGIS-native sources, document the MIT license terms, future-external-source candidate list expanded.
- `README.md` (this package) — multi-source architecture diagram updated; per-category content tables replace the v0.1.0-only enumeration; new compliance row + brutaler-anwalt mention.
- `__tests__/manifest.test.ts` — `EXPECTED_TOTAL` 46 → 47, `EXPECTED_CATEGORIES` add `compliance`, `EXPECTED_SOURCES_BY_CATEGORY[compliance]` add `aegis-native`, `EXPECTED_NAMES_BY_CATEGORY[compliance]` add `brutaler-anwalt`.

### Validation

- All 10 new SKILL.md files pass the markdown-only structural invariant.
- All 10 new SKILL.md files pass the scrub-test (no internal-codename leaks).
- All 11 brutaler-anwalt `references/*.md` pass the new sibling-references scrub-block.
- All 3 updated category-README placeholders pass the future-category placeholder scrub-test.
- `loadAllSkills()` auto-discovers the new content via the existing `<category>/<source>/<name>/SKILL.md` layout — no loader changes needed.
- 405 / 405 tests pass post-addition (was 386).

---

## [0.1.1] — 2026-04-23 — "ship-gate-caught-recovery"

First published release. v0.1.0 was tagged but NEVER published to npm —
the publish-skills.yml tarball-scrub gate caught two internal planning-
path references in placeholder category READMEs at the `Verify no
internal-codename leaks in shipped tarball` step and refused to
publish. This v0.1.1 is the clean first-publish.

The fortress-discipline CI gate worked exactly as designed: the tag
landed, the workflow ran, the scrub-gate fired, and nothing reached
the npm registry. No force-push, no shortcut, no `--no-verify`. The
full incident post-mortem is retained in the repository's internal
planning tree; ask the maintainer for access if needed.

### Fixed

- **`skills/defensive/README.md`** and **`skills/mitre-mapped/README.md`**
  placeholder documents referenced a gitignored operator-local
  planning document by its exact filename; both files are generalized
  to point to "the repository's internal planning tree" instead.
- **`scripts/sync-upstream.sh`** reviewer-instruction paragraph
  referenced the same operator-local planning document; generalized
  to the same "internal planning tree" phrasing.

### Added

- **`__tests__/scrub.test.ts`** gains a new describe-block
  (`scrub-clean — future-category placeholder READMEs`) covering the
  three placeholder READMEs under `skills/defensive/`,
  `skills/mitre-mapped/`, and `skills/ops/`. Without this block, the
  v0.1.0 leak passed source-side tests (which iterated only the 37
  forked SKILL.md files plus 4 package-root documents) while failing
  at the CI tarball-scrub gate. Institutional spec-gap closed.

### Meta

- `v0.1.0` remains as a git-tag pointing at commit `8508aa6` for
  audit-trail purposes but carries no corresponding npm release. If
  you need to verify the v0.1.0 git state, check the tag; if you need
  a running skills package, install `0.1.1` or later.

---

## [0.1.0] — 2026-04-23 — "initial — offensive-only" (WITHHELD — see 0.1.1 above)

Initial ship. Multi-source package structure, offensive-only content
at v0.1.0.

### Added

- **Package scaffold** under `packages/skills/` with `@aegis-scan/skills`
  as the npm name, MIT license, and `npm-provenance` publish-config.
  No install-time lifecycle scripts (enforced by
  `.github/workflows/publish-skills.yml` gate).
- **Multi-source directory layout** with four category-directories
  under `skills/`:
  - `offensive/` — populated at v0.1.0 with the 37-skill fork below.
  - `defensive/` — placeholder README declaring skills-v0.2+ ambition
    (AEGIS-native skills mirrored from the `@aegis-wizard/cli` pattern
    library).
  - `mitre-mapped/` — placeholder README declaring skills-v0.2+ ambition
    (cherry-picks from an upstream framework-mapped source with MITRE
    ATT&CK / D3FEND / NIST CSF mappings).
  - `ops/` — placeholder README declaring skills-v0.3+ ambition
    (incident-response, post-build-audit, verify-install-integrity).
- **37 offensive skills** forked from
  [SnailSploit/Claude-Red](https://github.com/SnailSploit/Claude-Red)
  at SHA `c74d53e2938b59f111572e0819265a1e73029393` under the upstream
  MIT license. Upstream `Skills/offensive-<name>/SKILL.md` lands here
  as `skills/offensive/snailsploit-fork/<name>/SKILL.md` (redundant
  `offensive-` prefix stripped from directory names). Every file is
  byte-identical to upstream after a prepended AEGIS-local HTML
  attribution header.
- **`aegis-skills` CLI** with three subcommands: `list` (with
  `--category` and `--source` filters), `info <skill-name>` (renders
  frontmatter and upstream-source URL), and `install [--to <dir>]
  [--force]` (defaults to `~/.claude/skills/user/aegis-skills/`).
- **ATTRIBUTION.md** with per-source attribution for the SnailSploit
  fork plus forward-declared sections for defensive, MITRE-mapped,
  and ops categories.
- **Test suite** — four vitest files covering manifest integrity,
  frontmatter shape, attribution header preservation, and
  internal-codename scrub-clean invariant across every shipped
  skill. Total tests at v0.1.0 is 316 new cases; the full monorepo
  test count rises from 2224 to 2540.

### Known discrepancies tracked for upstream-courtesy-ping

- Upstream README tabulates 38 skill rows but the `Skills/` directory
  contains 37 subdirectories — the `patch-diffing` skill is listed in
  the README "Infrastructure & Binary" table but the directory is
  absent on disk at the fork SHA. This package ships what exists on
  disk (37) rather than what is claimed in the README (38). Tracked
  for an optional outreach to the upstream maintainer.
- Upstream uses two attribution conventions across its files — some
  use an older `## Metadata > Source:` bullet, others use a newer
  YAML-only frontmatter. Both conventions are preserved byte-
  identically. AEGIS's own per-file provenance anchor is the
  uniform `<!-- aegis-local: -->` HTML header applied during fork.

### Security posture

- Pre-fork security-pass (six protocol greps plus two supplementary
  checks) run against upstream before commit. All checks returned
  clean with three documented caveats (cloud-IMDS IPs in SSRF
  content, canonical pedagogical shellcode, pedagogical AMSI/IAT-
  hook code in the windows-boundaries skill). Log retained for
  advisor audit.
- Markdown-only structural invariant enforced both locally and in
  the `publish-skills.yml` CI gate: the `skills/` directory contains
  only `.md` files.
- `SECURITY.md` at the repo root gains a "Responsible-use posture for
  @aegis-scan/skills" section covering the authorized-use-only scope
  of the offensive content.

### License

MIT for AEGIS side. MIT for upstream SnailSploit fork. See
`LICENSE` and `ATTRIBUTION.md`.
