# @aegis-scan/cli

> **The paranoid audit tool your vibe-coded app deserves.**

[![npm](https://img.shields.io/npm/v/@aegis-scan/cli?label=%40aegis-scan%2Fcli)](https://www.npmjs.com/package/@aegis-scan/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node 20+](https://img.shields.io/badge/Node-20%2B-brightgreen)](https://nodejs.org/)
[![SLSA v1](https://img.shields.io/badge/SLSA-v1-green.svg)](https://slsa.dev/)

Stack-specific security scanner for **Next.js + Supabase + React**. 42 built-in checkers + 20 external-tool wrappers (16 SAST/DAST + 1 passive subdomain-recon + 3 LLM-agent pentest frameworks: Strix, PTAI, Pentest-Swarm-AI), AST-based cross-file taint analysis, 0-1000 score with `FORTRESS → CRITICAL` grade.

Best used **alongside** Semgrep / CodeQL — not instead of them.

## Quickstart

```bash
# One-shot via npx (no install)
npx -y @aegis-scan/cli scan .

# Or install globally
npm install -g @aegis-scan/cli
aegis scan .

# Full audit with all scanners (DAST, infra, TLS)
aegis audit .

# Generate config + CI integration files
aegis init .
```

## Scan modes

| Mode | Command | What it does |
|------|---------|--------------|
| **scan** | `aegis scan .` | Quick pass — security, deps, quality, compliance, i18n (~3s) |
| **audit** | `aegis audit .` | Full audit — all scanners including DAST, infra, TLS |
| **siege** | `aegis siege . --target URL --confirm` | 4-phase attack simulation against a live target |
| **fix** | `aegis fix .` | AI-powered remediation (Claude, OpenAI, Ollama, or templates) |
| **history** | `aegis history . --blame` | Git blame enrichment — who introduced each finding |
| **diff** | `aegis scan . --diff main` | Only report findings in files changed vs a git ref |
| **diff-deps** | `aegis diff-deps --since=HEAD~1` | Dependency-change reporter; flags risky major bumps on `criticalDeps` |

## Output formats

```bash
aegis scan . --format terminal   # default: colour-rich table
aegis scan . --format json       # machine-parseable
aegis scan . --format sarif      # SARIF 2.1.0 — drop-in for GitHub Code Scanning
aegis scan . --format markdown   # PR-comment-friendly
aegis scan . --format html       # standalone dashboard
```

## What AEGIS finds that generic SAST tools miss

Stack-specific findings that Semgrep / CodeQL / njsscan don't have rules for:

| Vulnerability | Category |
|---|---|
| Missing `tenant_id` filter — cross-tenant data leak | Multi-Tenant |
| `service_role` RLS bypass in API routes | Supabase |
| SQLi via `.rpc()` template interpolation | Supabase |
| Mass assignment — unvalidated `request.json()` to `.insert()` | Supabase |
| No rate limiting on sensitive endpoint | Next.js API |
| Missing auth guard on API route | Next.js API |
| Server Component passing full DB record to client (CWE-200) | RSC |
| Prompt injection — user input in LLM prompts | AI / LLM |
| Missing Zod `.strict()` on mutation schemas | Validation |
| No pagination on database query | Performance / DoS |

## Scoring

| Score | Grade | Badge |
|-------|-------|-------|
| 950-1000 | S | FORTRESS |
| 850-949 | A | HARDENED |
| 700-849 | B | SOLID |
| 500-699 | C | NEEDS_WORK |
| 300-499 | D | AT_RISK |
| 0-299 | F | CRITICAL |

A **BLOCKER** or **CRITICAL** severity finding forces score 0 / grade F regardless of other findings — so a single unauthed admin route or hardcoded secret cannot be quietly buried in a green-grade report.

## CI integration — GitHub Action

Drop-in security gate for any GitHub Actions workflow. Posts a PR comment with score + severity table + top findings; fails the build when score drops below threshold.

```yaml
- uses: RideMatch1/a.e.g.i.s/ci/github-action@v0.16.6
  with:
    mode: scan          # 'scan' (quick) or 'audit' (full)
    fail-below: 700     # set to 0 to never fail
    comment-on-pr: true
```

Always pin to a tag (`@v0.16.6`), never `@main`.

## Supply-chain integrity

Every published version ships with **SLSA v1 provenance** — the npm attestation binds the tarball to the exact GitHub Actions run, commit-SHA, and registry-identity. Verify any installation:

```bash
npm audit signatures

# Expected: https://slsa.dev/provenance/v1
npm view @aegis-scan/cli@<version> dist.attestations.provenance.predicateType

# Expected: empty or only safe CI hooks
npm view @aegis-scan/cli@<version> scripts
```

The publish-workflow (`.github/workflows/publish.yml`) triggers on signed git tags only and runs with SHA-pinned GitHub Actions. **No install-time scripts** are declared in any `@aegis-scan/*` package — `npm install @aegis-scan/cli` executes zero scripts from the AEGIS namespace.

## Honest limitations

- **TypeScript / JavaScript only.** No Python / Go / Rust / Java / C# / Ruby / PHP.
- **External-tool wrappers require the tool on PATH.** Semgrep / Gitleaks / Trivy / ZAP / OSV-Scanner / … integrations auto-skip when the underlying binary is absent.
- **Stack-specific.** On non-Next.js Node it covers generic classes (SQLi, SSRF, path traversal, prompt injection, crypto misuse) but skips framework-specific rules.
- **Compliance checks are pattern-based, not audit-grade.** GDPR / SOC 2 / ISO 27001 / PCI-DSS engines cover dozens of common control gaps but are not a substitute for a certified auditor.

## Three-layer toolkit

`@aegis-scan/cli` is one of three sibling packages that cover the full pre-ship security lifecycle:

- **[`@aegis-wizard/cli`](https://www.npmjs.com/package/@aegis-wizard/cli)** — interactive scaffold + agent-brief generator for Next.js + Supabase + shadcn SaaS
- **[`@aegis-scan/cli`](https://www.npmjs.com/package/@aegis-scan/cli)** — this package — defensive SAST scanner
- **[`@aegis-scan/skills`](https://www.npmjs.com/package/@aegis-scan/skills)** — opt-in red-team skill library for AI agents

Build with the wizard. Scan what you built. Test it red-team-style.

## Links

- **Main repo:** https://github.com/RideMatch1/a.e.g.i.s
- **CHANGELOG:** https://github.com/RideMatch1/a.e.g.i.s/blob/main/CHANGELOG.md
- **Security policy:** https://github.com/RideMatch1/a.e.g.i.s/blob/main/SECURITY.md
- **Getting Started guide:** https://github.com/RideMatch1/a.e.g.i.s/blob/main/docs/GETTING-STARTED.md

## License

MIT
