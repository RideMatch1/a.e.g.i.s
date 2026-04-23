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

## Defensive skills — AEGIS-native (skills-v0.2+)

Planned: AEGIS-authored defensive methodology skills mirrored from
the `@aegis-wizard/cli` pattern library under MIT License. Source is
AEGIS itself; this section will expand when the skills ship.

## MITRE-mapped skills — upstream cybersecurity framework-mapped source (skills-v0.2+)

Planned: cherry-picked skills from
[mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
under Apache-2.0 with per-skill quality-audit plus MITRE ATT&CK /
D3FEND / NIST CSF framework-mappings applied. Section populates when
skills-v0.2 lands.

## Operations skills — TBD (skills-v0.3+)

Planned: incident-response, post-build-audit, verify-install-integrity
modules. Source and attribution TBD.

## License compatibility

AEGIS itself ships under MIT. Offensive skills ship under MIT (via
upstream). Future cybersecurity-framework-mapped cherry-picks ship
under Apache-2.0 (via upstream). Both licenses are permissive,
commercially-redistributable, and require attribution preservation —
which this file codifies. No license incompatibility.

## Changes to upstream

See `CHANGELOG.md` for AEGIS-side version history. The only change
to any forked `SKILL.md` at v0.1.0 is the prepended AEGIS-local HTML
attribution header documented above.
