# Attribution

`@aegis-scan/skills` is a multi-source skill library. Each source is
credited individually below. Every fork preserves upstream provenance
via a per-file `<!-- aegis-local: forked … from <upstream>@<sha>; attribution preserved -->`
HTML comment at the top of each `SKILL.md`, independent of whichever
attribution convention the upstream author used inside the file body.

## Offensive skills — SnailSploit/Claude-Red

All skills under `skills/offensive/snailsploit-fork/` are forked from
[SnailSploit/Claude-Red](https://github.com/SnailSploit/Claude-Red)
under MIT License.

- **Upstream author:** Kai Aizen (SnailSploit) — https://snailsploit.com
- **Upstream original source:** Sahar Shlichov — https://github.com/sahar042/offensive-checklist
- **SPDX:** MIT (README-declared by upstream; no standalone LICENSE file upstream at fork time)
- **Fork-SHA:** `c74d53e2938b59f111572e0819265a1e73029393`
- **Fork date:** 2026-04-23
- **Skill count at fork:** 37 (upstream README tabulates 38; the `patch-diffing` subdirectory listed in the README's "Infrastructure & Binary" table is absent on disk at the fork SHA, so we ship what exists rather than what is claimed)

### Upstream-attribution format notes

Upstream uses two attribution conventions across its 37 files:

- Thirty-two files use an older `## Metadata > - Source: <url>` bullet format pointing at the upstream `sahar042/offensive-checklist` file that seeded the skill.
- Five files (`fuzzing`, `jwt`, `osint`, `shellcode`, `sqli`) use a newer YAML-frontmatter convention (`--- name: description: ---`) without a separate Metadata section.

Both conventions are semantically equivalent: they identify the skill
and, where present, link to the upstream checklist source. AEGIS
preserves whichever form the upstream file used. The reliable
per-file provenance anchor across all 37 files is the AEGIS-added
`<!-- aegis-local: forked … -->` HTML header.

### Do-not-remove rule

Every forked `SKILL.md` retains both its original upstream content
byte-identically and the AEGIS-added header. When AEGIS runs a
quarterly upstream-sync (via `scripts/sync-upstream.sh`) the same
rule applies to any incoming updates — no stripping of upstream
attribution, no removal of AEGIS-added headers, no paper-over of
upstream format variance.

## Defensive skills — AEGIS-native

All skills under `skills/defensive/aegis-native/` are AEGIS-original
content under MIT License, mirroring patterns from `@aegis-wizard/cli`'s
pattern library and remediation guidance for `@aegis-scan/cli` scanner
findings.

- **Source:** AEGIS-original
- **License:** MIT (covered by the AEGIS top-level `LICENSE`)
- **Skill count at first ship:** 3 (`rls-defense`, `tenant-isolation-defense`, `ssrf-defense`)
- **First shipped:** post-v0.16.6 work-package WP-A2

## MITRE-mapped skills — AEGIS-native

All skills under `skills/mitre-mapped/aegis-native/` are AEGIS-original
content under MIT License, providing the cross-walk between AEGIS
scanner findings and MITRE ATT&CK Enterprise / ATLAS / D3FEND / NIST
CSF 2.0 / NIST AI RMF.

- **Source:** AEGIS-original
- **License:** MIT (covered by the AEGIS top-level `LICENSE`)
- **Skill count at first ship:** 3 (`mapping-overview`, `t1190-exploit-public-app`, `t1078-valid-accounts`)
- **First shipped:** post-v0.16.6 work-package WP-A2

The cross-walk references public MITRE frameworks. MITRE ATT&CK is
copyright © The MITRE Corporation, distributed under their copyright
statement at https://attack.mitre.org/resources/legal-and-branding/
which permits factual cross-walk usage. The AEGIS skills do not
re-distribute MITRE content; they reference public technique IDs and
descriptions by ID (which are factual identifiers).

## Operations skills — AEGIS-native

All skills under `skills/ops/aegis-native/` are AEGIS-original
operational runbooks under MIT License.

- **Source:** AEGIS-original
- **License:** MIT (covered by the AEGIS top-level `LICENSE`)
- **Skill count at first ship:** 3 (`triage-finding`, `suppress-correctly`, `escalation-runbook`)
- **First shipped:** post-v0.16.6 work-package WP-A2

## Compliance skills — AEGIS-native

All skills under `skills/compliance/aegis-native/` are AEGIS-original
adversarial DE/EU compliance content under MIT License.

- **Source:** AEGIS-original
- **License:** MIT (covered by the AEGIS top-level `LICENSE`)
- **Skill count at first ship:** 1 (`brutaler-anwalt`, multi-file with 11 supporting `references/*.md`)
- **First shipped:** v0.2.0
- **Content domain:** DE/EU compliance audit (DSGVO, DDG, TTDSG, UWG, NIS2, EU AI Act, branchenrecht, strafrecht-steuer). Three-persona self-verification (Hunter / Challenger / Synthesizer) is an AEGIS-original methodology pattern, not derived from upstream content. References cite German/EU statutes (`§`-paragraphs) and BGH/EuGH judgment-IDs (`Az.`) — these are factual legal identifiers, not copyrightable expression.

## Required external skills (mandatory complement, not forked)

Some upstream skill packages are higher-value when consumed
**directly from the upstream maintainer** rather than forked into
this tree. AEGIS treats them as **mandatory complements** —
required for full Supabase / Postgres coverage when working on a
project that uses those technologies — but installed via the
upstream's own distribution channel rather than re-shipped here.

This avoids:

- License-attribution drift across forks
- Stale upstream versions when the maintainer ships fixes
- Duplicate maintenance burden when the upstream package is the
  single source of truth

### `Chachamaru127/claude-code-harness` — concept-only adoption (no fork, no install)

- **Upstream:** https://github.com/Chachamaru127/claude-code-harness
- **License:** MIT
- **Adoption mode:** **concept-only** — AEGIS adopts two patterns from this project's design but ships zero copied code or assets:
  1. **Plans.md as a Live Working-Plan SSOT** — adapted into `aegis-orchestrator/SKILL.md` as the format for `.aegis/Plans.md`. AEGIS-specific: integrated into the existing 8-skill foundation cluster lifecycle (orchestrator initializes, specialist skills update, handover-writer summarizes), uses pure markdown, no Go binary or `/harness-*` verb-commands.
  2. **`harness doctor --residue` stale-reference detection** — adapted into `aegis-quality-gates/SKILL.md` as Gate 10 (residue-check). AEGIS-specific: pure shell + grep methodology integrated as a gate of the existing 10-gate verifier sequence (was 9-gate pre-adoption), with the AEGIS classes of residue documented (stale commit-SHAs in handovers, broken markdown cross-links in shipped SKILL.md, orphan path references, phantom `_INDEX.md` skill rows, dead `<!-- aegis-local: -->` provenance refs). The motivating bug-class: handover docs that cite commit-SHAs invalidated by a `git rebase`.

- **What was NOT adopted:** the Go-native runtime engine, the 5 `/harness-plan|work|review|release|setup` verb-commands, the 13 R01-R13 declarative guardrails, the 3-agent worker/reviewer/scaffolder split, the marketplace plugin distribution. AEGIS already has equivalents for or alternatives to each (repo rulesets, scrub-gates, supply-chain CI gates, 8 specialist foundation skills, npm direct distribution).

- **Why concept-only and not fork or mandate:** the two adopted patterns are **methodology**, not code — they fit AEGIS's existing skill-cluster architecture verbatim once described in markdown. Forking would buy nothing (no shared code paths) and adding a mandate would burden users with installing a tool they don't need. Documenting the inspiration in this file + the relevant SKILL.md sections preserves attribution while staying lean.

### `supabase/agent-skills` — Postgres + Supabase development best-practices

- **Upstream:** https://github.com/supabase/agent-skills
- **License:** MIT
- **Skills shipped:** `supabase` (comprehensive Supabase dev skill — Auth, Edge Functions, Realtime, Storage, MCP, CLI, schema-change workflow) + `supabase-postgres-best-practices` (8-category Postgres performance guide with 30+ reference files: query, conn, security, schema, lock, data, monitor, advanced).
- **Installation (mandatory when working on this repo):**

  ```bash
  npx skills add supabase/agent-skills -g -y
  ```

  Installs both skills globally to `~/.agents/skills/` and
  symlinks them into `~/.claude/skills/` for Claude Code
  auto-discovery. Compatible with 18+ AI agents (Claude Code,
  Cursor, GitHub Copilot, Cline, etc.) — universal Agent Skills
  Open Standard format.

- **Why mandatory and not forked:** the AEGIS skills package
  covers the **security layer** (RLS-bypass remediation,
  tenant-isolation, IDOR-defense, scanner-finding mapping). The
  upstream Supabase skills cover the **dev-productivity layer**
  (CLI commands, migration workflow, MCP server config, query
  performance optimization, indexing patterns, connection
  pooling, JSONB indexing, full-text search, etc.). The two are
  complementary and non-overlapping — see the cross-reference
  blocks at the bottom of `skills/defensive/aegis-native/rls-defense/SKILL.md`
  and `skills/defensive/aegis-native/tenant-isolation-defense/SKILL.md`.

- **Why not cherry-pick into AEGIS:** Supabase ships frequent
  updates to its own skills (core principles, CLI gotchas, MCP
  troubleshooting steps change between Supabase CLI versions).
  Forking would freeze the AEGIS copy at a fork-SHA and require
  quarterly upstream-sync work for content the AEGIS team has
  no special insight into. Routing users to the upstream package
  ensures they always pull the freshest Supabase-team-maintained
  guidance.

## OSINT skills — elementalsouls/Claude-OSINT

All skills under `skills/osint/` are forked from
[elementalsouls/Claude-OSINT](https://github.com/elementalsouls/Claude-OSINT)
under MIT License (with offensive-security ethical-use notice).

- **Upstream author:** Cyanide (elementalsouls)
- **SPDX:** MIT
- **Fork-SHA:** `ea42241d068e8112da0e4e28006207125c835c2e`
- **Fork date:** 2026-05-01
- **Skill count at fork:** 2 (`offensive-osint`, `osint-methodology`)
- **Upstream-attribution format:** YAML frontmatter (`name:`, `description:`,
  `version:`, `triggers:`). Both files preserved byte-identically inside the
  body; AEGIS-local provenance header added above the YAML opener.

### AEGIS-side modifications

- Per-file `<!-- aegis-local: forked … from elementalsouls/Claude-OSINT@<sha> -->`
  HTML header prepended above the YAML frontmatter on both `SKILL.md` files.
- `offensive-osint/SKILL.md` carries an additional **PORT-NOTE** inside its
  fork header explaining that the upstream `secret_scan.py` helper script is
  NOT shipped (`@aegis-scan/skills` enforces a markdown-only invariant via
  CI). The helper is scheduled for port to a TypeScript scanner module under
  **F-EXTERNAL-SECRETS-1** (planned v0.18.x). Until then, operators run
  AEGIS' existing `gitleaks` / `trufflehog` wrappers, or fetch the helper
  directly from the upstream repository.
- `offensive-osint/README.md` *Loading*, *Helper script*, *Self-test* and
  *License* sections updated to reflect the AEGIS package layout (no manual
  `cp` of `scripts/secret_scan.py` since the script is not shipped; smoke
  tests referenced as upstream-only pending F-SKILL-SYNC-CI-1).
- `osint-methodology/README.md` *Self-test* and *License* sections updated
  similarly.
- Upstream `LICENSE` and `tests/smoke-test-prompts.md` are NOT shipped — the
  AEGIS root `LICENSE` covers all of `@aegis-scan/skills`, and the smoke
  tests will land under `packages/skills/__tests__/skill-prompts/` when the
  skill-validation CI is built (F-SKILL-SYNC-CI-1).

### Why a separate top-level category instead of merging into `offensive/`

`osint/` is intel-gathering tradecraft (collection + correlation + scoring),
distinct from `offensive/` which encodes exploit-side red-team patterns
(SSRF / SQLi / XSS / RCE / etc.). The `snailsploit-fork/` already contains
much smaller `osint/` (399 lines) and `osint-methodology/` (434 lines)
skills that overlap topically but are subset by content. Both kept side-by-
side: the `snailsploit-fork/` versions remain available for operators who
prefer the lighter checklist style; the `osint/` top-level category
provides the operational arsenal (~5,800 lines of probe paths, regexes,
validators, identity-fabric methodology, vendor fingerprints) that the
`snailsploit-fork/` intentionally does not include. Frontmatter `name:`
collisions across categories are acceptable — Claude Code skill-routing
keys on path-relative identifiers, not the bare `name:` field.

## Future external cherry-pick candidates

The `skills/` tree is also designed to grow across sources via
**fork-mode** (the same pattern as `skills/offensive/snailsploit-fork/`)
when the content is security-domain and benefits from AEGIS-side
sanitization, scanner-mapping headers, or quarterly review.
Candidates being evaluated for cherry-pick (per the maintainer's
source-evaluation cycle):

- [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) — Apache-2.0, 754 mixed offensive+defensive skills with MITRE/D3FEND/NIST framework-mappings.
- [Eyadkelleh/awesome-claude-skills-security](https://github.com/Eyadkelleh/awesome-claude-skills-security) — security-pentesting curated list.
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — MIT, 1000+ mixed agent skills aggregator.

Each future cherry-pick will land in a per-source subdirectory under
the appropriate category (e.g., `defensive/anthropic-cybersec-pick/`)
with attribution preserved per the same per-file `<!-- aegis-local: -->`
header convention as the offensive `snailsploit-fork/` source.

## License compatibility

AEGIS itself ships under MIT. Offensive skills ship under MIT (via
upstream). AEGIS-native defensive / mitre-mapped / ops / compliance
skills ship under MIT (AEGIS-original). Future cybersecurity-framework-
mapped cherry-picks would ship under Apache-2.0 (via upstream) when
those land. All these licenses are permissive, commercially-
redistributable, and require attribution preservation — which this
file codifies. No license incompatibility.

## Changes to upstream

See `CHANGELOG.md` for AEGIS-side version history.

- For `snailsploit-fork/` (offensive): the only change to any forked `SKILL.md` is the prepended AEGIS-local HTML attribution header documented above. Quarterly upstream-sync pulls additions and corrections.
- For `aegis-native/` (defensive / mitre-mapped / ops / compliance): there is no upstream — content is AEGIS-authored. Each `SKILL.md` carries an `<!-- aegis-local: AEGIS-native skill, MIT-licensed; ... -->` header documenting the AEGIS-internal source pattern.
