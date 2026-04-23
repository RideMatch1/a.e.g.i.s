# Changelog

All notable changes to `@aegis-scan/skills` are documented here. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The
skills package uses SemVer; each minor-version may add new skill
sources and categories. Release cadence is driven by upstream-sync
and quality-audit completion, not by a fixed schedule.

---

## [0.1.0] — 2026-04-23 — "initial — offensive-only"

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
  skill. Total tests at v0.1.0 is 151 new cases; the full monorepo
  test count rises from 2224 to approximately 2375.

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
