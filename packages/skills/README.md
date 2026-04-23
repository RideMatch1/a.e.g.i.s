# @aegis-scan/skills

Opt-in skill library for Claude Code and compatible AI agents. Third
sibling in the AEGIS full-repertoire institutional-grade security
toolkit.

## AEGIS is a three-layer toolkit

- **`@aegis-wizard/cli`** — scaffold + agent-brief generator. Builds
  a secure Next.js + Supabase + shadcn SaaS from day one with an
  agent-consumable Markdown brief.
- **`@aegis-scan/cli`** — defensive SAST scanner (five-package
  family). Catches what the scanner knows to look for across your
  built application.
- **`@aegis-scan/skills`** — this package. Red-team methodology
  library (v0.1.0) with defensive, MITRE-mapped, and ops extensions
  landing in later releases. Primes your AI coding-agent with
  attack-class decision-trees so you can stress-test what you built
  before shipping.

Build with the wizard. Scan what you built. Test it red-team-style.
Full lifecycle, one toolchain, one attribution-compliant open-source
license stack.

## Quickstart

```bash
npm install -g @aegis-scan/skills

# Install every skill into Claude Code's user-skill directory
aegis-skills install

# List what is available
aegis-skills list

# Inspect a specific skill
aegis-skills info sqli
```

After `install` lands the skill files under `~/.claude/skills/user/aegis-skills/`,
Claude Code auto-loads each `SKILL.md` based on its trigger-phrases
whenever you invoke the agent with a relevant prompt.

## What ships in v0.1.0

Thirty-seven offensive-security SKILL.md files under
`skills/offensive/snailsploit-fork/`, covering:

- **Web application:** sqli · xss · ssrf · ssti · xxe · idor · file-upload
  · rce · deserialization · race-condition · request-smuggling ·
  open-redirect · parameter-pollution · graphql · waf-bypass (15)
- **Auth and identity:** jwt · oauth (2)
- **Infrastructure and binary:** shellcode · edr-evasion ·
  exploit-development · exploit-dev-course · basic-exploitation ·
  crash-analysis · mitigations · windows-mitigations ·
  windows-boundaries · keylogger-arch · initial-access ·
  advanced-redteam (12)
- **Reconnaissance and OSINT:** osint · osint-methodology (2)
- **Fuzzing and vulnerability research:** fuzzing · fuzzing-course ·
  bug-identification · vuln-classes (4)
- **AI security:** ai-security (1)
- **Utility:** fast-checking (1)

All forked from
[SnailSploit/Claude-Red](https://github.com/SnailSploit/Claude-Red)
under MIT License with attribution preserved per-file. See
[`ATTRIBUTION.md`](./ATTRIBUTION.md) for the full credit chain.

## Multi-source architecture

`@aegis-scan/skills` is designed to grow across sources without
re-architecting the package. The `skills/` tree carries four
category-directories from day one, three of which are placeholders
for future content:

```
skills/
├── offensive/                    — populated in v0.1.0
│   └── snailsploit-fork/
│       └── 37 SKILL.md files
├── defensive/                    — placeholder for skills-v0.2+
├── mitre-mapped/                 — placeholder for skills-v0.2+
└── ops/                          — placeholder for skills-v0.3+
```

`aegis-skills list --category defensive` today returns an informative
"coming in v0.2+" message rather than a missing-directory error. When
future sources land, they slot into the existing tree and the manifest
metadata expands without layout churn.

## Structural invariant

The `skills/` directory is markdown-only by construction. No
executable content, no binaries, no install-time lifecycle scripts
anywhere in the package. The `publish-skills.yml` CI gate enforces
this structurally before every tag-push. A consumer running
`npm install @aegis-scan/skills` executes zero scripts from the
`@aegis-scan` namespace. See the top-level `SECURITY.md` for the
full supply-chain integrity posture.

## Responsible use

This package ships offensive-security methodology for authorized use
only:

- Authorized security testing of systems you own or have explicit
  written permission to test.
- Bug-bounty engagements strictly within the defined scope.
- CTF competitions and educational environments.
- Defensive security research — understanding attack classes to
  defend against them.

Use against systems you do not own or have permission to test is
unauthorized and likely illegal. AEGIS provides methodology;
responsible use is the operator's obligation. See the top-level
`SECURITY.md` for the full responsible-use disclosure and the
`SECURITY-INCIDENT-RESPONSE.md` for the abuse-report channel.

## License

MIT (see [`LICENSE`](./LICENSE)). Upstream skills ship under their
original licenses with attribution preserved per-file — see
[`ATTRIBUTION.md`](./ATTRIBUTION.md) for the full chain.
