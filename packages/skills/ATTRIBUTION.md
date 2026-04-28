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
