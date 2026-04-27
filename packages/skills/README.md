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

## What ships

### Offensive skills — `skills/offensive/snailsploit-fork/`

Thirty-seven offensive-security `SKILL.md` files covering:

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
under MIT License with attribution preserved per-file.

### Defensive skills — `skills/defensive/aegis-native/`

Three AEGIS-native `SKILL.md` files (MIT) mirroring `@aegis-wizard/cli`
patterns and providing remediation guidance for `@aegis-scan/cli`
findings:

- **`rls-defense`** — Supabase Row-Level Security hardening (covers `rls-bypass-checker` + `template-sql-checker` findings)
- **`tenant-isolation-defense`** — multi-tenant SaaS isolation (covers `tenant-isolation-checker` + `mass-assignment-checker` findings)
- **`ssrf-defense`** — SSRF defense including DNS-rebinding, IPv6, cloud metadata-endpoint protection (covers `ssrf-checker` + cross-file taint findings)

### MITRE-mapped skills — `skills/mitre-mapped/aegis-native/`

Three AEGIS-native `SKILL.md` files (MIT) cross-walking AEGIS findings
to MITRE frameworks:

- **`mapping-overview`** — top-level per-CWE → ATT&CK technique mapping plus tactic-level coverage summary; ATLAS overlay for AI/LLM threats; D3FEND defensive-countermeasure mapping; NIST CSF 2.0 + NIST AI RMF function-level alignment.
- **`t1190-exploit-public-app`** — deep-dive on T1190 (the #1 Initial Access vector in Verizon DBIR 2024).
- **`t1078-valid-accounts`** — deep-dive on T1078 (Valid Accounts) coverage via the AEGIS credential-protection scanner family.

### Operations skills — `skills/ops/aegis-native/`

Three AEGIS-native `SKILL.md` files (MIT) wrapping the AEGIS workflow
in process-discipline:

- **`triage-finding`** — operational runbook for triaging an AEGIS finding (severity → confidence → verify → fix-vs-suppress-vs-defer).
- **`suppress-correctly`** — when suppression is appropriate, the structured-rationale syntax, anti-patterns, and audit-trail expectations.
- **`escalation-runbook`** — what to do when a BLOCKER reaches main, when a finding suggests active exploitation, or when a credential leak is detected.

### Compliance skills — `skills/compliance/aegis-native/`

One AEGIS-native multi-file `SKILL.md` (MIT) for adversarial DE/EU
compliance audits:

- **`brutaler-anwalt`** — adversarial DE/EU compliance auditor (DSGVO / DDG / TTDSG / UWG / NIS2 / EU AI Act / branchenrecht / strafrecht-steuer) with three-persona self-verification (Hunter / Challenger / Synthesizer). Slash-command activation via `/anwalt`. Ships an 11-file `references/` sibling tree (~120 KB) with per-bereich rules, BGH/EuGH-judgment database, abmahn-templates, and an explicit AEGIS-scanner-output → rechtliche-Bewertung mapping. The installer auto-copies the references tree alongside the SKILL.md.

### Attribution + license

See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for the full credit chain.
Offensive skills are MIT-via-upstream-fork; defensive / mitre-mapped /
ops / compliance skills are MIT-AEGIS-original.

## Multi-source architecture

`@aegis-scan/skills` is designed to grow across sources without
re-architecting the package. The `skills/` tree carries five
category-directories:

```
skills/
├── offensive/
│   └── snailsploit-fork/         — 37 SKILL.md files (MIT, forked from SnailSploit/Claude-Red)
├── defensive/
│   └── aegis-native/             — 3 SKILL.md files (MIT, AEGIS-original)
├── mitre-mapped/
│   └── aegis-native/             — 3 SKILL.md files (MIT, AEGIS-original — ATT&CK / ATLAS / D3FEND / NIST cross-walk)
├── ops/
│   └── aegis-native/             — 3 SKILL.md files (MIT, AEGIS-original — triage / suppress / escalation runbooks)
└── compliance/
    └── aegis-native/             — 1 multi-file SKILL.md + 11-file references/ tree (MIT, AEGIS-original — adversarial DE/EU compliance auditor with three-persona self-verification)
```

Total: **47 skills** across **5 categories** and **2 source-namespaces**
(`snailsploit-fork` for the offensive fork; `aegis-native` for the
defensive / mitre-mapped / ops / compliance AEGIS-original content).

When future external sources land, they slot into the existing tree
under their own per-source subdirectory (e.g.,
`defensive/anthropic-cybersec-pick/`) and the manifest metadata
expands without layout churn.

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
