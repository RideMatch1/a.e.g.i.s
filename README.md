# A.E.G.I.S

<img width="1456" height="816" alt="A E G I S" src="https://github.com/user-attachments/assets/a5ce364d-df19-423c-adbd-ecda8fd06a88" />

**The paranoid audit tool your vibe-coded app deserves.**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Tests: 1397 passing](https://img.shields.io/badge/Tests-1397%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Node 20+](https://img.shields.io/badge/Node-20%2B-brightgreen)
![npm](https://img.shields.io/npm/v/@aegis-scan/cli)
![Internal Maturity: 8.2](https://img.shields.io/badge/Internal%20Maturity-8.2%2F10-blue)
[![Release: v0.9.2](https://img.shields.io/badge/Release-v0.9.2-informational)](https://github.com/RideMatch1/a.e.g.i.s/releases/tag/v0.9.2)

> **Current release: `v0.9.2` — validator hotfix + world-class-OSS polish.** An external adversarial stress-test of v0.9.1 delivered 5 MAJOR + 5 MINOR findings; every MAJOR is closed, four of the MINORs closed, and the fifth (display-layer LOW-CONFIDENCE badge hedge) is now committed rather than deferred. In parallel, a world-class-OSS polish sprint lifts the repo to production-adoption quality: npm-metadata across 5 packages, structured issue / PR templates, README architecture diagram + honest-limitations section, independently-validated PASS summary, and a pre-built VS Code `.vsix` attached to every Release via GitHub Actions. Tests 1386 → 1397; benchmark 30/30 unchanged; self-scan 1000/A unchanged. See [CHANGELOG](./CHANGELOG.md) §[0.9.2] for the full scope.

> **Prior release: `v0.9.1` — cross-file precision.** Closed both cross-file FPs surfaced by the v0.8 six-corpus dogfood. Self-scan on the AEGIS repo reaches 1000/A with 0 findings (was 973/A, 55 findings at v0.8.1). Supply-chain phantom-dependency checker now handles TypeScript path aliases, pnpm/npm/yarn workspaces, sub-package deps, and source-comment false matches — closes a ~38-finding FP flood on every modern Next.js monorepo. `setTimeout` / `setInterval` skip emission when arg 0 is a function (eliminates the modern-JS FP class); `encodeURIComponent` no longer credits CWE-22 (decoded-before-fs-access FN class removed). logging-checker skips CLI projects (detects `bin` in root or workspace children). GitHub Action default `aegis-version` pinned per release. `aegis.config.json` now accepts top-level `description` + `$schema` fields. See [CHANGELOG](./CHANGELOG.md) §[0.9.0] for the full scope and the M6 deferral analysis.

> **Prior release: `v0.8.1` — brutal-review hotfix.** Closes three MAJORs from the v0.8.0 post-ship cold-read review: a false-negative-producing sanitizer-registry bug on `path.normalize` / `path.resolve` / `path.basename` (removed — they do not prevent path traversal on their own), stale MCP tool names in the tutorial that broke first-contact for every MCP user (rewritten), and a scope gap in the Phase 5 conditional-import confidence downgrade that left the if/else form at full confidence (extended). Three remaining MAJORs (GitHub Action default pin, blanket logging-checker suppression in self-scan config, HOC text-match precision) deferred to v0.9 with documented rationale. See [CHANGELOG](./CHANGELOG.md) §[0.8.1] for full detail.

> **Prior release: `v0.8.0` — type-aware expansion.** Closes the four type-aware gaps deferred from v0.7 (HOC binding, generic pass-through return-taint, method-call cross-file via TypeChecker, conditional-import confidence downgrade). Extends `TYPED_SINK_MODULES` beyond `child_process` to fs / path / crypto / http / https. Adds `Date.parse` blocklist + URL-regex-whitelist sanitizer (closes v0.7 cal-com FP). Corpus doubled (3 → 6 OSS projects) toward the n≥20 cross-file measurement runway. Structural self-match refinement takes AEGIS-on-itself from 0/F to 973/A. Ships [docs/GETTING-STARTED.md](./docs/GETTING-STARTED.md) for 5-minute onboarding. See [CHANGELOG](./CHANGELOG.md) for the full v0.8 scope + honest score framing.

> **Two scores, don't confuse them:**
> - **"Internal Maturity 7.7/10"** (badge above) — AEGIS's *own* honest self-assessment of its maturity as a product. Tracks over releases. Different from the validator's precision-tier system.
> - **"0-1000" (see Scoring section below)** — the score AEGIS *outputs* for a scanned project. Based on weighted findings in that project's code. Graded FORTRESS → CRITICAL.

---

## What is AEGIS?

AEGIS (Automated Enterprise-Grade Inspection Suite) is a **stack-specific security scanner for Next.js + Supabase** with 40 built-in scanners, an AST-based cross-file taint tracker, and a 0-1000 scoring system. It finds vulnerabilities that generic SAST tools (Semgrep, CodeQL, SonarQube) miss because they lack framework-specific rules.

**Best used alongside Semgrep**, not instead of it. AEGIS covers the Supabase / Next.js-specific gaps (multi-tenant isolation, RLS bypass, Server Component data leaks, Zod enforcement) while Semgrep covers the generic SAST space.

What makes it different: AEGIS tracks **data flow** through your code — within a file and across module boundaries:

```typescript
// Same-file taint (works since v0.5):
const id = req.body.id;           // Source: user input
const trimmed = id.trim();         // Propagates: method call
const query = `SELECT * WHERE id = ${trimmed}`;  // Propagates: template literal
db.query(query);                   // Sink: SQL Injection (CWE-89, CRITICAL)

// Cross-file taint (new in v0.7):
// lib/db.ts    — export function runQuery(sql: string) { db.query(sql); }
// api/route.ts — import { runQuery } from '../lib/db';
//                runQuery(req.body.q);   // ← AEGIS traces this cross-module
```

Per-CWE sanitizer awareness means `parseInt()` blocks SQL injection but not XSS, and `DOMPurify.sanitize()` blocks XSS but not SQL injection.

On top of that: 38 built-in regex scanners + 1 AST taint analyzer + 1 RPC-specific SQLi scanner, 16 external tool wrappers (Semgrep, Gitleaks, ZAP, Trivy, …), 5 live attack probes, 4 compliance frameworks (GDPR, SOC 2, ISO 27001, PCI-DSS), an MCP Server for AI agents, a VS Code extension, and a GitHub Action with PR comments.

---

## Architecture

```
                   ┌──────────────────┐
                   │ aegis.config.json│ ← user config (optional)
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │   ConfigLoader   │ (@aegis-scan/core)
                   │  (Zod-strict)    │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │   Orchestrator   │ walkFiles → per-scanner dispatch
                   └────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
  ┌──────────────────┐  ┌────────────┐  ┌──────────────────┐
  │ Built-in scanners│  │  Taint     │  │ External wrappers│
  │  (39 regex rules)│  │  Analyzer  │  │  (Semgrep, ZAP, …│
  │                  │  │  (AST +    │  │   auto-skip when │
  │                  │  │   TS       │  │   not installed) │
  │                  │  │   Compiler)│  │                  │
  └─────────┬────────┘  └─────┬──────┘  └────────┬─────────┘
            │                  │                  │
            └─────────────┬────┴──────────────────┘
                          ▼
                ┌──────────────────┐
                │     Findings     │
                └─────────┬────────┘
                          │
                ┌─────────▼──────────┐
                │ Suppression filter │ ← inline + config suppressions
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │  Score / Grade /   │ ← 0-1000, blocker override
                │  Badge / Confidence│
                └─────────┬──────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          Terminal      JSON       SARIF 2.1.0
          (colour)   (machine)     (GH Code
                                    Scanning)
                          │
                          ▼
                     HTML / Markdown
                     (dashboards, PR comments)
```

The **taint analyzer** is the cross-cutting sibling to the regex scanners: it parses each file with the TypeScript Compiler API, walks the AST to find source → sink flows, consults the module-graph + function-summary cache for cross-file propagation, and emits its findings into the same pipeline. Every scanner reads from `@aegis-scan/core` and writes into the shared `Finding[]` array; the Orchestrator owns scheduling and the score aggregator owns the final verdict.

---

## Quick Start

```bash
npx @aegis-scan/cli scan .
```

```bash
# Or install globally
npm install -g @aegis-scan/cli
aegis scan .

# Full audit with all scanners
aegis audit .

# Generate config
aegis init .
```

> **New to AEGIS?** The
> **[Getting Started guide](./docs/GETTING-STARTED.md)** walks you from
> zero-install to your first scan, config, false-positive handling, MCP
> setup, and CI integration in about 5 minutes.

---

## What AEGIS finds that generic SAST tools miss

These are **stack-specific** vulnerabilities in Next.js + Supabase apps. Generic tools don't have rules for them because they're framework-specific patterns:

| Vulnerability | Category |
|---|---|
| Missing `tenant_id` filter — cross-tenant data leak | Multi-Tenant |
| `service_role` RLS bypass in API routes | Supabase |
| SQLi via `.rpc()` template interpolation in function name | Supabase |
| Mass assignment — unvalidated `request.json()` to `.insert()` | Supabase |
| No rate limiting on sensitive endpoint | Next.js API |
| Missing auth guard on API route | Next.js API |
| Server Component passing full DB record to client (CWE-200) | React Server Components |
| Prompt injection — user input in LLM prompts | AI / LLM |
| Missing Zod `.strict()` on mutation schemas | Validation |
| No pagination on database query | Performance / DoS |

AEGIS is not a Semgrep replacement — it's a **Semgrep multiplier**. When Semgrep is installed, AEGIS wraps it automatically and you get both.

---

## Honest limitations

Running a security tool is a trust exercise. Here is what AEGIS does **not** do well — or at all — documented up front so you can decide where AEGIS fits in your stack:

- **Cross-file taint precision is unmeasured at n≥20.** The v0.8 / v0.9 Dogfood across 6 production Next.js codebases (cal-com, dub, openstatus, taxonomy, documenso, vercel/commerce) produced 2 cross-file findings total, both confirmed FP; v0.9.1's AST-precise regex-guard + URL-position filters closed them at source and now the corpus shows 0 cross-file findings. That means **0 observed FPs but also 0 observed TPs** on this sample — high precision, unknown recall. Cross-file findings still ship with `confidence: 'medium'` pending a validated n≥20 measurement. See CHANGELOG `[0.9.1]` §Cross-file precision.
- **Not a general SAST replacement.** AEGIS is stack-specific. On a Python, Go, Rust, or Java codebase it will do nothing useful. On Node that isn't Next.js, it finds the generic classes (SQLi, SSRF, path traversal, prompt injection, crypto misuse) but skips the framework-specific ones. Use alongside Semgrep / CodeQL / njsscan, never instead.
- **Compliance checks are pattern-based rules, not audit-grade.** The `gdpr-engine`, `soc2-checker`, `iso27001-checker`, `pci-dss-checker` scanners implement dozens of the most common pattern-level controls (GDPR: privacy page, cookie consent, PII handling, Google-Fonts self-hosting, double-opt-in, retention). They are **not** a substitute for a certified auditor. Full framework-depth integration (SCF / OSCAL mapping, evidence export) is on the v1.0 roadmap.
- **Single-maintainer project.** Bus factor is 1. CONTRIBUTING + SECURITY + CODE_OF_CONDUCT + CODEOWNERS + issue templates are in place; contributions and review offers welcome.
- **TypeScript / JavaScript only.** No Python, Go, Rust, Java, C#, Ruby, PHP. Cross-language support is out of scope for Festung-Mode-B (local-first, no SaaS, low-maintenance OSS).
- **External-tool wrappers require the tool on PATH.** AEGIS's Semgrep / Gitleaks / Trivy / ZAP / OSV-Scanner / … integrations auto-skip when the underlying binary is absent. This shows up as `Confidence: LOW` with a "Missing: …" note in the terminal output; in CI comments the badge gets a `[LOW-CONFIDENCE]` prefix since v0.9.2.

---

## Independently validated (v0.9.1 stress-test)

v0.9.1 went through an adversarial external stress-test by a fresh, no-prior-context reviewer with file-system + network access, running ≈4 hours of reproducible probes. The review confirmed the following as reproducible:

- Self-scan on the AEGIS repo: `1000 / A / HARDENED`, 0 findings.
- Benchmark `30/30 strict` (21 planted vulnerabilities + 9 clean-file FP checks) passes.
- Test count `1386 green` across 5 packages.
- Adversarial inputs (10k-import file, 1 MB template literal, BOM + RTL override chars, symlink loop) complete in <2 s without crash.
- Prompt-injection hardening on `aegis fix` — per-invocation random hex sentinel holds against escape attempts.
- Prototype-pollution via config rejected by the Zod-strict schema; JSON-only config parser is immune to arbitrary-code execution.
- Real TP captured externally: open-redirect pattern in the official `vercel/next.js` `with-supabase` example (`searchParams.get('next') → redirect()`).
- Forensic leak check (`git log`, `git grep`) on published tarballs and `main` — clean of any private-identity / private-repo references.

The review also surfaced 5 MAJOR + 5 MINOR findings, all closed in v0.9.2 (see CHANGELOG `[0.9.2]`). What is written here is what the reviewer verified reproducibly; honest-score discipline applied to the positive side as well as the negative.

---

## Taint Analysis Engine

The AST-based taint tracker uses the TypeScript Compiler API to follow user input through your code — within a single file and across module boundaries.

**Per-CWE sanitizer awareness:**

| Sanitizer | Blocks SQLi | Blocks XSS | Blocks SSRF | Blocks CmdInj |
|---|---|---|---|---|
| `parseInt()` | Yes | No | Yes | Yes |
| `DOMPurify.sanitize()` | No | Yes | No | No |
| `encodeURIComponent()` | No | Yes | Yes | No |
| `z.parse()` (Zod) | Yes | Yes | Yes | Yes |

**Cross-file propagation** (v0.7) — a function summary cache lets the tracker follow taint into an imported function, check whether any parameter reaches a sink (and with which CWE), and emit a finding at the caller's file with a `relatedLocations` pointer back to the origin file. Supported patterns:

- Bare-identifier callees: `import { runQuery } from './lib'; runQuery(tainted);`
- Arrow-function-variable exports: `export const fn = (x) => sink(x);`
- Default exports: `export default function (x) { sink(x); }`
- Declaration-style exports: `export { foo };` and `export { foo as bar };`
- Barrel re-exports up to depth 5.
- Cross-file sanitizer recognition — imports of a function that wraps its arg through a known sanitizer suppress the finding.

v0.8 closed the four type-aware gaps from v0.7: HOC / curry consumption at binding sites (policy §9), generic pass-through return-taint via `summary.returnsTainted`, method-call cross-file via TypeChecker symbol resolution, and conditional-import confidence downgrade. v0.9.1 closed two additional cross-file FP classes with AST-precise filters in `paramReachesSink`: regex-guard awareness inside cross-file callee bodies (cal-com `isValidCalURL` pattern) and SSRF URL-position vs header-position distinction for `fetch(url, {headers})` shapes (dub `bitly rate-limit` pattern). See [CHANGELOG](./CHANGELOG.md) `[0.9.1]` + `[0.9.2]` for details. Known limitation: cross-file precision measurement still unvalidated at n≥20 — see the **Honest limitations** section above.

---

## Scan Modes

| Mode | Command | What it does |
|------|---------|--------------|
| **scan** | `aegis scan .` | Quick pass — security, deps, quality, compliance, i18n (~3s) |
| **audit** | `aegis audit .` | Full audit — all scanners including DAST, infra, TLS |
| **siege** | `aegis siege . --target URL --confirm` | 4-phase attack simulation against a live target |
| **fix** | `aegis fix .` | AI-powered remediation (Claude, OpenAI, Ollama, or templates) |
| **history** | `aegis history . --blame` | Git blame enrichment — who introduced each finding |
| **diff** | `aegis scan . --diff main` | Only report findings in files changed vs a git ref |

---

## Scanners (60 total)

> Authoritative registration: `getAllScanners()` + `getAttackScanners()` in
> [`packages/scanners/src/index.ts`](./packages/scanners/src/index.ts). Counts
> below are re-verified at every release per the release checklist.

### Built-in (40 scanners: 39 regex + 1 AST taint analyzer)

| Scanner | Category | CWE(s) | What it checks |
|---------|----------|--------|----------------|
| `taint-analyzer` | Security | 22, 78, 79, 89, 94, 601, 918, 1321 | **AST-based data-flow analysis** — tracks user input from sources to sinks with per-CWE sanitizer awareness, cross-file propagation since v0.7 |
| `auth-enforcer` | Security | 285, 306 | Missing auth guards, unprotected routes, RBAC gaps |
| `tenant-isolation-checker` | Security | 639 | Supabase queries missing `tenant_id` filters — cross-tenant data leak detection |
| `rls-bypass-checker` | Security | 863 | Supabase `.rpc()` and `service_role` usage bypassing Row Level Security |
| `crypto-auditor` | Security | 326, 327, 338, 798 | Weak algorithms, hardcoded secrets, insecure RNG, eval() injection |
| `zod-enforcer` | Security | 20 | Missing Zod validation on mutation routes, missing `.strict()` |
| `sql-concat-checker` | Security | 89 | SQL via string concatenation instead of parameterized queries |
| `xss-checker` | Security | 79 | Unsanitized user input in HTML responses |
| `ssrf-checker` | Security | 918 | Server-side request forgery patterns |
| `csrf-checker` | Security | 352 | Mutation handlers lacking CSRF protection |
| `rate-limit-checker` | Security | 770 | Sensitive routes missing rate limiting |
| `path-traversal-checker` | Security | 22 | User input flowing into file system operations |
| `prompt-injection-checker` | Security | 77 | User input in LLM prompts without sanitization |
| `redos-checker` | Security | 1333 | Catastrophic backtracking patterns |
| `rsc-data-checker` | Security | 200 | Server Components passing full DB records to client |
| `mass-assignment-checker` | Security | 915 | Unvalidated request bodies to database writes |
| `open-redirect-checker` | Security | 601 | Redirects using unvalidated user input |
| `cors-checker` | Security | 346 | Misconfigured CORS (wildcard / reflected origins) |
| `header-checker` | Security | 693 | Missing security headers (CSP, HSTS, COOP, …) |
| `config-auditor` | Security | 16 | Docker, Next.js, Firebase misconfigurations |
| `cookie-checker` | Security | 614, 1004 | Missing `Secure` / `HttpOnly` / `SameSite` flags |
| `entropy-scanner` | Security | 798 | High-entropy strings (leaked secrets) via Shannon entropy |
| `timing-safe-checker` | Security | 208 | Secret comparisons using `===` instead of constant-time |
| `upload-validator` | Security | 434 | File uploads without magic-byte validation |
| `error-leakage-checker` | Security | 209 | Stack traces leaked to client responses |
| `env-validation-checker` | Security | 16 | Missing central environment-variable validation |
| `http-timeout-checker` | Security | 400 | HTTP calls without timeouts |
| `next-public-leak` | Security | 200, 798 | Secrets accidentally prefixed `NEXT_PUBLIC_*` or read in `'use client'` files |
| `jwt-checker` | Quality | 327, 345 | JWT implementation issues, weak signing, 'none' algorithm |
| `logging-checker` | Quality | 778 | Missing structured logging (auto-skipped on CLI tools since v0.9) |
| `console-checker` | Quality | 532 | Debug artifacts in production code (`console.log`, `debugger;`, TODO/FIXME) |
| `gdpr-engine` | Compliance | — | GDPR/DSGVO: privacy page, consent, PII, Google Fonts, double-opt-in |
| `soc2-checker` | Compliance | — | SOC 2 Type II control gaps |
| `iso27001-checker` | Compliance | — | ISO 27001 control mapping |
| `pci-dss-checker` | Compliance | — | PCI DSS cardholder-data exposure |
| `pagination-checker` | Security | 770 | Database queries without row limits |
| `i18n-quality` | i18n | — | Hardcoded UI strings, missing locale keys |
| `supply-chain` | Dependencies | 829, 1357 | Dependency confusion, typosquatting, lockfile integrity, phantom-deps (monorepo-aware since v0.9) |
| `dep-confusion-checker` | Dependencies | 1357 | Scoped packages without private registry mapping |

### External wrappers (16 scanners, auto-skipped when not installed)

| Scanner | Install |
|---------|---------|
| Semgrep | `brew install semgrep` |
| Bearer | `brew install bearer` |
| Gitleaks | `brew install gitleaks` |
| TruffleHog | `brew install trufflehog` |
| OSV-Scanner | `brew install osv-scanner` |
| npm audit | Built into npm |
| license-checker | `npm i -g license-checker` |
| Nuclei | `brew install nuclei` |
| OWASP ZAP | Requires Docker |
| Trivy | `brew install trivy` |
| Hadolint | `brew install hadolint` |
| Checkov | `pip install checkov` |
| testssl.sh | `brew install testssl` |
| React Doctor | `npx react-doctor@latest .` |
| axe / Lighthouse | Requires Chromium |
| Lighthouse Performance | Requires Chromium |

### Attack probes (5, siege mode only)

`auth-probe`, `header-probe`, `rate-limit-probe`, `privesc-probe`, `race-probe`

---

## Scoring

| Score | Grade | Badge |
|-------|-------|-------|
| 950-1000 | S | FORTRESS |
| 850-949 | A | HARDENED |
| 700-849 | B | SOLID |
| 500-699 | C | NEEDS_WORK |
| 300-499 | D | AT_RISK |
| 0-299 | F | CRITICAL |

Certain findings (eval injection, hardcoded secrets, unauthed admin routes) are **BLOCKER** severity and force the score to 0 / F immediately.

---

## MCP Server — use AEGIS from any AI coding agent

AEGIS ships a Model Context Protocol server so AI coding agents (Claude Code, Cursor, Continue, Zed, …) can run scans, query findings, and check compliance posture directly from the conversation. Install locally, then register the server in your agent's MCP config.

**Install:**

```bash
npm install -D @aegis-scan/mcp-server
```

**Register (Claude Code** — `~/.config/claude-code/mcp.json`**, Cursor** — `.cursor/mcp.json`**, etc.):**

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "@aegis-scan/mcp-server"]
    }
  }
}
```

**Tools exposed** (callable from the agent without leaving the chat):

| Tool | Purpose |
|------|---------|
| `aegis_scan` | Run a scan on a project path; returns findings + score |
| `aegis_findings` | Filter/query the most recent scan's findings |
| `aegis_score` | 0-1000 score + grade + badge for the scanned project |
| `aegis_compliance` | GDPR / SOC 2 / ISO 27001 / PCI-DSS posture summary |
| `aegis_fix_suggestion` | Get a fix suggestion for a specific finding |

Low-friction for developers who already run Claude Code / Cursor — your assistant can now scan and triage without a context-switch.

---

## VS Code Extension (preview)

An extension lives in `packages/vscode-extension/` and ships with this repo (currently at `0.2.0`, not yet on the VS Code Marketplace). It exposes:

- `AEGIS: Scan Workspace` command
- `AEGIS: Scan Current File` command
- `AEGIS: Show Security Score` command
- Configurable `aegis.autoScanOnSave` + `aegis.severity.minimum` settings

Build from source:

```bash
cd packages/vscode-extension
pnpm install && pnpm run build
pnpm run package   # produces .vsix
code --install-extension aegis-vscode-0.2.0.vsix
```

Marketplace publishing is planned for a future release; feedback on the current surface is welcome via Issues.

---

## CI/CD — GitHub Action

Drop-in security gate for any GitHub Actions workflow. Posts a PR comment with score, severity table, and top findings; fails the build when the score drops below a configurable threshold.

```yaml
name: Security
on: [push, pull_request]
jobs:
  aegis:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: RideMatch1/a.e.g.i.s/ci/github-action@v0.7.2   # or @main for latest
        with:
          mode: scan           # 'scan' (quick) or 'audit' (full)
          path: .              # project to scan (default: '.')
          fail-below: 700      # set to 0 to never fail the build
          comment-on-pr: true  # post PR comment with findings table
```

**Inputs:** `mode`, `path`, `fail-below`, `comment-on-pr`. See `ci/github-action/action.yml` for the full schema. For reproducibility across team members, pin to a specific tag (`@v0.7.2`) rather than `@main`.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, workflow, and scope boundaries. Security issues: [SECURITY.md](./SECURITY.md).

Bug reports and feature requests welcome via [GitHub Issues](https://github.com/RideMatch1/a.e.g.i.s/issues); broader design questions via [Discussions](https://github.com/RideMatch1/a.e.g.i.s/discussions).

---

## Credits

See [CREDITS.md](./CREDITS.md) for full attribution of integrated tools and inspirations.

## License

MIT
