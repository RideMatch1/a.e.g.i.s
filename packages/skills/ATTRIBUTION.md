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

## Future external sources

The `skills/` tree is designed to grow across sources. Future
candidates being evaluated for cherry-pick (per the maintainer's
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
upstream). AEGIS-native defensive / mitre-mapped / ops skills ship
under MIT (AEGIS-original). Future cybersecurity-framework-mapped
cherry-picks would ship under Apache-2.0 (via upstream) when those
land. All these licenses are permissive, commercially-redistributable,
and require attribution preservation — which this file codifies. No
license incompatibility.

## Changes to upstream

See `CHANGELOG.md` for AEGIS-side version history.

- For `snailsploit-fork/` (offensive): the only change to any forked `SKILL.md` is the prepended AEGIS-local HTML attribution header documented above. Quarterly upstream-sync pulls additions and corrections.
- For `aegis-native/` (defensive / mitre-mapped / ops): there is no upstream — content is AEGIS-authored. Each `SKILL.md` carries an `<!-- aegis-local: AEGIS-native skill, MIT-licensed; ... -->` header documenting the AEGIS-internal source pattern.
