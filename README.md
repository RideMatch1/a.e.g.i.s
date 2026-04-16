# A.E.G.I.S

<img width="1456" height="816" alt="A E G I S" src="https://github.com/user-attachments/assets/a5ce364d-df19-423c-adbd-ecda8fd06a88" />

**The paranoid audit tool your vibe-coded app deserves.**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Tests: 1339 passing](https://img.shields.io/badge/Tests-1339%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Node 20+](https://img.shields.io/badge/Node-20%2B-brightgreen)
![npm](https://img.shields.io/npm/v/@aegis-scan/cli)
![Honest 7.7](https://img.shields.io/badge/Honest%20Score-7.7%2F10-blue)
[![Release: v0.7.0](https://img.shields.io/badge/Release-v0.7.0-informational)](https://github.com/RideMatch1/a.e.g.i.s/releases/tag/v0.7.0)

> **Current release: `v0.7.0` — Cross-File Taint Foundation.** Whole-program taint propagation across imported function calls, SARIF 2.1.0 `relatedLocations`, 25/25 strict benchmark. See [CHANGELOG](./CHANGELOG.md) for the full v0.7.0 scope, deferred-to-v0.8 gaps, and measurement caveats.

---

## What is AEGIS?

AEGIS (Automated Enterprise-Grade Inspection Suite) is a **stack-specific security scanner for Next.js + Supabase** with 39 built-in scanners, an AST-based cross-file taint tracker, and a 0-1000 scoring system. It finds vulnerabilities that generic SAST tools (Semgrep, CodeQL, SonarQube) miss because they lack framework-specific rules.

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

On top of that: 37 built-in regex scanners + 1 AST taint analyzer + 1 RPC-specific SQLi scanner, 16 external tool wrappers (Semgrep, Gitleaks, ZAP, Trivy, …), 5 live attack probes, 4 compliance frameworks (GDPR, SOC 2, ISO 27001, PCI-DSS), an MCP Server for AI agents, a VS Code extension, and a GitHub Action with PR comments.

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

Known limitations (deferred to v0.8): HOC / curry patterns, generic pass-through return-taint, method-call cross-file callees, conditional-import confidence downgrade. See [CHANGELOG](./CHANGELOG.md).

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

## Scanners (59 total)

### Built-in (39 scanners: 38 regex + 1 AST taint analyzer)

| Scanner | Category | What it checks |
|---------|----------|----------------|
| `taint-analyzer` | Security | **AST-based data-flow analysis** — tracks user input from sources to sinks with per-CWE sanitizer awareness, cross-file propagation since v0.7 |
| `auth-enforcer` | Security | Missing auth guards, unprotected routes, RBAC gaps |
| `tenant-isolation-checker` | Security | Supabase queries missing `tenant_id` filters — cross-tenant data leak detection |
| `rls-bypass-checker` | Security | Supabase `.rpc()` and `service_role` usage bypassing Row Level Security |
| `crypto-auditor` | Security | Weak algorithms, hardcoded secrets, insecure RNG, eval() injection |
| `zod-enforcer` | Security | Missing Zod validation on mutation routes, missing `.strict()` |
| `sql-concat-checker` | Security | SQL via string concatenation instead of parameterized queries |
| `xss-checker` | Security | Unsanitized user input in HTML responses |
| `ssrf-checker` | Security | Server-side request forgery patterns |
| `csrf-checker` | Security | Mutation handlers lacking CSRF protection |
| `rate-limit-checker` | Security | Sensitive routes missing rate limiting |
| `path-traversal-checker` | Security | User input flowing into file system operations (CWE-22) |
| `prompt-injection-checker` | Security | User input in LLM prompts without sanitization (CWE-77) |
| `redos-checker` | Security | Catastrophic backtracking patterns (CWE-1333) |
| `rsc-data-checker` | Security | Server Components passing full DB records to client (CWE-200) |
| `mass-assignment-checker` | Security | Unvalidated request bodies to database writes |
| `open-redirect-checker` | Security | Redirects using unvalidated user input |
| `cors-checker` | Security | Misconfigured CORS (wildcard / reflected origins) |
| `header-checker` | Security | Missing security headers (CSP, HSTS, COOP, …) |
| `config-auditor` | Security | Docker, Next.js, Firebase misconfigurations |
| `cookie-checker` | Security | Missing `Secure` / `HttpOnly` / `SameSite` flags |
| `entropy-scanner` | Security | High-entropy strings (leaked secrets) via Shannon entropy |
| `timing-safe-checker` | Security | Secret comparisons using `===` instead of constant-time |
| `upload-validator` | Security | File uploads without magic-byte validation |
| `error-leakage-checker` | Security | Stack traces leaked to client responses |
| `env-validation-checker` | Security | Missing central environment-variable validation |
| `http-timeout-checker` | Security | HTTP calls without timeouts |
| `jwt-checker` | Quality | JWT implementation issues, weak signing |
| `logging-checker` | Quality | Missing structured logging |
| `console-checker` | Quality | Debug artifacts in production code |
| `gdpr-engine` | Compliance | GDPR/DSGVO: privacy page, consent, PII, Google Fonts, double-opt-in |
| `soc2-checker` | Compliance | SOC 2 Type II control gaps |
| `iso27001-checker` | Compliance | ISO 27001 control mapping |
| `pci-dss-checker` | Compliance | PCI DSS cardholder-data exposure |
| `pagination-checker` | Security | Database queries without row limits |
| `i18n-quality` | i18n | Hardcoded UI strings, missing locale keys |
| `supply-chain` | Dependencies | Dependency confusion, typosquatting, lockfile integrity |
| `dep-confusion-checker` | Dependencies | Scoped packages without private registry mapping |

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

## MCP Server

AEGIS ships a Model Context Protocol server so AI coding agents (Claude Code, Cursor, Continue, …) can run scans and query findings directly.

```json
{
  "mcpServers": {
    "aegis": {
      "command": "node",
      "args": ["node_modules/@aegis-scan/mcp-server/dist/index.js"]
    }
  }
}
```

Tools exposed: `aegis_scan`, `aegis_findings`, `aegis_score`, `aegis_compliance`, `aegis_fix_suggestion`.

---

## CI/CD — GitHub Action

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
      - uses: RideMatch1/a.e.g.i.s/ci/github-action@main
        with:
          fail-below: 700
```

Posts a PR comment with score, severity table, and top findings.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, workflow, and scope boundaries. Security issues: [SECURITY.md](./SECURITY.md).

Bug reports and feature requests welcome via [GitHub Issues](https://github.com/RideMatch1/a.e.g.i.s/issues); broader design questions via [Discussions](https://github.com/RideMatch1/a.e.g.i.s/discussions).

---

## Credits

See [CREDITS.md](./CREDITS.md) for full attribution of integrated tools and inspirations.

## License

MIT
