# Defensive Skills — `defensive/`

Defensive-security methodology skills for AI coding agents (Claude Code,
Cursor, etc.). Each skill is a self-contained `SKILL.md` with YAML
frontmatter that the agent auto-loads when its trigger-keywords match a
user prompt.

## Sources

| Source dir | License | Skills |
|---|---|---|
| `aegis-native/` | MIT (AEGIS-original) | 3 |

## AEGIS-native skills

These skills are AEGIS-original content, mirroring patterns from
`@aegis-wizard/cli`'s pattern library and remediation guidance for
`@aegis-scan/cli` scanner findings.

| Skill | Addresses scanner findings |
|---|---|
| `rls-defense` | `rls-bypass-checker` (CWE-863), `template-sql-checker` (CWE-89) |
| `tenant-isolation-defense` | `tenant-isolation-checker` (CWE-639), `mass-assignment-checker` (CWE-915) |
| `ssrf-defense` | `ssrf-checker` (CWE-918), `taint-analyzer` (CWE-918) |

License: MIT. See top-level [`ATTRIBUTION.md`](../../ATTRIBUTION.md) for
attribution chain.

## Roadmap

Future expansions in this category may include:

- Cherry-picks from external CC BY-SA / Apache-2.0 / MIT defensive-skill libraries (per the maintainer's source-evaluation cycle).
- Additional AEGIS-native skills covering the remaining defensive scanner family (csrf-defense, header-defense, prompt-injection-defense, secret-management-defense, supply-chain-defense, etc.).

The broader skill-ecosystem roadmap is maintained in the repository's
internal planning tree; ask the maintainer for access if you are
contributing to the defensive-skills effort.
