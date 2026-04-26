# A.E.G.I.S

<img width="1456" height="816" alt="A E G I S" src="https://github.com/user-attachments/assets/a5ce364d-df19-423c-adbd-ecda8fd06a88" />

**The paranoid audit tool your vibe-coded app deserves.**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Node 20+](https://img.shields.io/badge/Node-20%2B-brightgreen)
[![npm](https://img.shields.io/npm/v/@aegis-scan/cli?label=%40aegis-scan%2Fcli)](https://www.npmjs.com/package/@aegis-scan/cli)

Stack-specific security scanner for **Next.js + Supabase + React**. 42 built-in checkers plus 19 external-tool wrappers (16 traditional SAST/DAST + 3 LLM-agent pentest frameworks: Strix, PTAI, Pentest-Swarm-AI), AST-based cross-file taint analysis, 0-1000 score with `FORTRESS → CRITICAL` grade. Best used **alongside** Semgrep / CodeQL — not instead of them. Ships a CLI, MCP server, and a GitHub-Actions recipe for CI integration.

---

## What is AEGIS?

AEGIS (Automated Enterprise-Grade Inspection Suite) finds vulnerabilities that generic SAST tools miss because they lack framework-specific rules. AEGIS covers the Next.js / Supabase / React gaps — multi-tenant isolation, RLS bypass, Server Component data leaks, Zod enforcement, `.rpc()` SQLi, mass assignment, auth-guard gaps — while Semgrep / CodeQL cover the generic SAST space.

What makes the engine different: AEGIS tracks **data flow** through your code — within a file AND across module boundaries:

```typescript
// Same-file taint:
const id = req.body.id;                            // source: user input
const trimmed = id.trim();                         // propagates through method call
const query = `SELECT * WHERE id = ${trimmed}`;    // propagates through template
db.query(query);                                   // sink: SQL Injection (CWE-89, CRITICAL)

// Cross-file taint:
// lib/db.ts     — export function runQuery(sql: string) { db.query(sql); }
// api/route.ts  — import { runQuery } from '../lib/db';
//                 runQuery(req.body.q);           // AEGIS traces the sink across the boundary
```

Per-CWE sanitizer awareness: `parseInt()` blocks SQL injection but not XSS, `DOMPurify.sanitize()` blocks XSS but not SQL injection, `encodeURIComponent()` blocks SSRF but not path traversal (frameworks decode before fs access).

Suite composition: **40** regex scanners + **1** AST taint analyzer + **1** RPC-specific SQLi scanner (built-in), **16** external tool wrappers (Semgrep, Gitleaks, ZAP, Trivy, Nuclei, Bearer, Checkov, Hadolint, TruffleHog, OSV-Scanner, testssl.sh, React Doctor, Lighthouse, Axe, …), **5** live attack probes, **4** compliance frameworks (GDPR / SOC 2 / ISO 27001 / PCI-DSS), an MCP server for AI agents, and a reusable GitHub-Actions recipe (at `ci/github-action/`) that posts PR comments with the score + top findings.

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
  │  (41 regex rules)│  │  Analyzer  │  │  (Semgrep, ZAP, …│
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

## Scaffold a new project

Starting a Next.js + Supabase project? Skip the security-retrofit
phase — let AEGIS lay down a production-ready foundation from commit 0.

```bash
aegis new my-saas
```

The scaffold ships with:

- **11 clean-room security primitives** — `secureApiRouteWithTenant`,
  `requireRole` (RBAC), rate-limit (X-Forwarded-For-aware), SSRF-safe
  `fetch`, AES-256-GCM crypto, Zod-strict schemas, PII-sanitizing
  logger (50+ redaction patterns), AppError hierarchy.
- **RLS bootstrap migration** — `tenants` + `profiles` tables with
  strict policies + auto-profile-on-signup trigger.
- **Hardened middleware** — CSRF + 9 security headers
  (incl. COEP / COOP / CORP) + rate-limit.
- **Exemplary API route** (59 LoC) composing all 6 primitives — teaches
  the composition pattern at scale, with correct error-mapping
  (`ForbiddenError` → 403, `ZodError` / `SyntaxError` → 400).
- **GitHub Action PR-gate** with `mode: audit` + pinned Semgrep /
  OSV-Scanner / Gitleaks / TruffleHog pre-installs (SHA-256 verified).
- **AI-safety rules** (`CLAUDE.md`) for AI coding assistants.
- **Husky pre-push hook** running `aegis scan --fail-on-blocker`.

**Baseline:** a fresh scaffold scores **997/A HARDENED** with
**0 BLOCKER** (empirically verified — `npm install` + `aegis scan`
end-to-end). The 5 MEDIUM baseline findings — 2 scanner-FPs (scheduled
for v0.13 scanner-fixes) + 3 Next.js-ecosystem-inherent supply-chain
items — are documented in the scaffold's own README under "Known
baseline findings": pedagogy, not suppression.

**Retrofit an existing project:**

```bash
aegis init
```

Writes `aegis.config.json` + `.github/workflows/aegis.yml` +
`CLAUDE.md` + `.husky/pre-push` into the current directory.
Skip-if-exists by default (never clobbers user files). Use `--force`
to overwrite the three extension files uniformly, or `--skip-ci` /
`--skip-claude` / `--skip-husky` to opt out per file. Partial-write-
safe: successful writes stay on disk if a later write fails — the
command modifies the user's project, so it never rolls back.

See the [v0.12 scaffolding-pivot design spec](./docs/design/2026-04-18-v0.12-scaffolding-pivot.md)
for template structure, primitive source-strategy, and exit criteria.

---

## AEGIS is a three-layer security toolkit

AEGIS ships three sibling packages that cover the full pre-ship security lifecycle. Serious security teams use all three together.

| Package | Role | Quickstart |
|---|---|---|
| [`@aegis-wizard/cli`](https://www.npmjs.com/package/@aegis-wizard/cli) | **Build** — interactive scaffold + agent-brief generator for Next.js + Supabase + shadcn SaaS | `npx -y @aegis-wizard/cli new my-saas --interactive` |
| [`@aegis-scan/cli`](https://www.npmjs.com/package/@aegis-scan/cli) | **Scan** — defensive SAST scanner (five-package family). 42 built-in checkers plus 19 external-tool wrappers (16 SAST/DAST + 3 LLM-agent pentest frameworks), AST-based cross-file taint analysis. | `npx -y @aegis-scan/cli scan ./my-saas` |
| [`@aegis-scan/skills`](https://www.npmjs.com/package/@aegis-scan/skills) | **Test** — opt-in red-team skill library for Claude Code and compatible AI agents. Prime your agent with attack-class methodology so you can stress-test what you built before shipping. | `npm i -g @aegis-scan/skills && aegis-skills install` |

Build with the wizard. Scan what you built. Test it red-team-style. Full lifecycle, one toolchain, one attribution-compliant open-source license stack. The three packages release independently (`wizard-v*`, `v*`, and `skills-v*` tag-namespaces) so neither gates the other — but they co-calibrate on architectural assumptions: a wizard-scaffolded project scoring below 960 on scan's grade is treated as a pattern-defect, and an agent running under the skills library can reach for attack classes scan detects defensively.

```bash
# One-shot full-repertoire workflow
npx -y @aegis-wizard/cli new my-saas --interactive   # build
npx -y @aegis-scan/cli scan ./my-saas                # scan
npm i -g @aegis-scan/skills && aegis-skills install  # equip agent for test
```

See the individual package READMEs for full docs:

- [`packages/wizard-cli/README.md`](./packages/wizard-cli/README.md)
- [`packages/skills/README.md`](./packages/skills/README.md)
- [`docs/patterns/index.md`](./docs/patterns/index.md) for the wizard's bundled pattern catalog

Responsible-use for `@aegis-scan/skills` is documented in this repository's `SECURITY.md` — the offensive methodology library is authorized-testing-only.

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

## Real-world corpus

AEGIS is tuned against an 8-project public-source corpus. Each finding
is manually annotated TP/FP and the recurring FP patterns are pinned
as regression tests. Scores below are post-v0.11.2:

| Project | Stack | v0.9.5 | v0.10.0 | v0.11.0 | v0.11.1 | v0.11.2 |
|---|---|---|---|---|---|---|
| shadcn/taxonomy | Next.js + next-auth | 985 A | 984 A | 984 A | 984 A | 984 A |
| formbricks | Next.js + Prisma | 968 A | 967 A | 967 A | 966 A | 966 A |
| midday | Next.js + Supabase | 957 A | 958 A | 957 A | 954 A | 954 A |
| dub | Next.js + Prisma | 956 A | 951 A | 950 A | 950 A | 950 A |
| documenso | Next.js + Prisma | 956 A | 956 A | 956 A | 956 A | 956 A |
| trigger.dev | Next.js + Prisma | 953 A | 953 A | 952 A | 952 A | 952 A |
| cal.com | Next.js + Prisma | 947 A | 947 A | 947 A | 947 A | 947 A |
| supabase-studio | Next.js + Supabase | 0 F* | 0 F* | 0 F* | 0 F* | 0 F* |

**v0.11.2 movement vs v0.11.1: `|Δ|` max = 0 points, 0 grade shifts.**
The change set is a narrow scanner-precision fix (tenant-isolation-checker
comment-prose strip + recall widen + URL-param-scope suppression). The
suppression branches only fire on a specific AST shape not present in
these projects — corpus scores are strictly unchanged. The dogfood
project driving the release: 8 `tenant-isolation-checker` FPs → 0.

**v0.11.1 movement vs v0.11.0: `|Δ|` max = 3 points, 0 grade shifts.**
The change set is dogfood-driven — a real-world Next.js+Supabase scan
surfaced 5 distinct auth-enforcer + ssrf-checker FP classes not on
the v0.11 speculative roadmap. The dogfood project itself moved
940/A → 946/A with 6 false-positive findings eliminated. The small
midday drift (−3) is category-cap arithmetic from reduced ssrf
emissions — noise-level, grade unchanged.

**v0.11.0 movement vs v0.10.0: `|Δ|` max = 1 point, 0 grade shifts.**
The same change set closed **+4 synthetic-recall canaries**, taking
the 27-canary harness to **27/27 full green** for the first time.
Interpretation: precision on real-world corpora stayed stable while
recall on documented CWE / scanner gaps improved. The dual view is
intentional — a precision-only read would call a tool "good" for not
changing scores, which is circular.

*\*supabase-studio retains two BLOCKER findings on legitimate SQL
string-concatenation in shipping source (`Reports.constants.ts` and
`Logs.utils.ts`). These are not false positives — a Supabase-internal
admin dashboard with a different threat model than a customer-facing
app, but the findings are accurate as written.*

Corpus-driven fixes in v0.11.0 (analyzer-core consumer-side symmetry +
new scanner + precision tweaks; details in
[CHANGELOG.md](./CHANGELOG.md#0110--2026-04-17--recall-honesty-part-2)):

- New `ast/guard-flow.ts` module — shared dominator-walk between
  function-summary (v0.9.1 builder-side) and taint-tracker (v0.11
  consumer-side). Closes D4 (named-fn URL guard) + D5 (startsWith-
  literal guard) + Z3 (cross-file consumer-side guard symmetry) via
  a single `isSinkGuardedByKnownPredicate` wired into three sink-
  emission call sites.
- New scanner `middleware-auth-checker` — Next.js middleware auth-
  bypass CVE-2025-29927 via `x-middleware-subrequest` header.
  Bumps built-in scanner count 40 → 41.
- `ssrf-checker` structural SAFE_PATTERN for user-defined typed URL
  guards (name token + `: boolean` return). Silences ssrf-checker
  on D4-shape allowlist helpers — both scanners now fall silent in
  tandem on the same structural signal.
- `ssrf-checker` library-wrapper heuristic (Z4) — exported fetch-
  wrappers where the URL is a parameter no longer emit CWE-918 at
  the wrapper site.
- `timing-safe-checker` UPPERCASE env-var name allowlist widened to
  cover the common `process.env.SECRET` shape.
- **Canary-based recall measurement** — `packages/benchmark/canary-
  fixtures/` is a 27-canary harness covering 5 harness-validation +
  10 deferred-item targets + 12 blind-spot stressors. 23/27 pass
  post-v0.10; the remaining 4 (D4 / D5 taint-analyzer guard-flow,
  S1 CVE-2025-29927 middleware bypass, S12 timing-safe var-name
  allowlist) are explicit v0.11 scope.

---

## Honest limitations

Running a security tool is a trust exercise. Here is what AEGIS does **not** do well — or at all — documented up front so you can decide where AEGIS fits in your stack:

- **Cross-file taint precision is unmeasured at scale.** The current dogfood corpus (6 production Next.js codebases) has too few cross-file emissions to produce a statistically valid precision number. Cross-file findings therefore ship with `confidence: 'medium'` rather than the default. Same-file taint is measured by the benchmark (30/30 strict) and is the engine's primary strength.
- **Not a general SAST replacement.** AEGIS is stack-specific. On Python / Go / Rust / Java it does nothing useful. On non-Next.js Node it still covers the generic classes (SQLi, SSRF, path traversal, prompt injection, crypto misuse) but skips the framework-specific rules. Use alongside Semgrep / CodeQL / njsscan, never instead.
- **Compliance checks are pattern-based rules, not audit-grade.** `gdpr-engine`, `soc2-checker`, `iso27001-checker`, `pci-dss-checker` cover dozens of the most common pattern-level controls (e.g. GDPR: privacy page, cookie consent, PII handling, self-hosted fonts, double-opt-in, retention). They are **not** a substitute for a certified auditor.
- **TypeScript / JavaScript only.** No Python / Go / Rust / Java / C# / Ruby / PHP.
- **External-tool wrappers require the tool on PATH.** Semgrep / Gitleaks / Trivy / ZAP / OSV-Scanner / … integrations auto-skip when the underlying binary is absent. The CLI reports `Confidence: LOW` with a "Missing: …" note, and the CI PR-comment badge gets a `[LOW-CONFIDENCE]` prefix, when no security-focused external tool is available.
- **Single-maintainer project.** CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / CODEOWNERS / issue templates are in place; contributions and review help welcome.

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

**Cross-file propagation** — a function-summary cache lets the tracker follow taint into an imported function, check whether any parameter reaches a sink (and with which CWE), and emit a finding at the caller's file with a `relatedLocations` pointer back to the origin file. Supported patterns:

- Bare-identifier callees: `import { runQuery } from './lib'; runQuery(tainted);`
- Arrow-function-variable exports: `export const fn = (x) => sink(x);`
- Default exports: `export default function (x) { sink(x); }`
- Declaration-style exports: `export { foo };` / `export { foo as bar };`
- Barrel re-exports up to depth 5.
- HOC / curry binding sites (`withAuth((cmd) => exec(cmd))`) emit at the binding line.
- Generic pass-through return-taint (`identity<T>(x: T): T`).
- Method-call cross-file callees (`import { db }; db.query(tainted)`) via TypeChecker resolution.
- Conditional-import downgrade — `confidence: 'medium'` when the callee module is ternary / if-else dynamic-imported.
- Cross-file sanitizer recognition — imported wrappers that `parseInt()` / `z.parse()` / etc. their arg suppress the finding.
- Regex-guard filter — `if (!regex.test(x)) return;` before an SSRF sink drops CWE-918.
- SSRF URL-position check — only the first `fetch(url, …)` arg counts; tainted values in `headers`/`body` do not.

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
| **diff-deps** | `aegis diff-deps --since=HEAD~1` | Dependency-change reporter — added/removed deps and major/minor/patch bumps against a git ref; flags risky major bumps on `criticalDeps` with exit 1. v0.15.0+ |

---

## Scanners (63 total)

> Authoritative registration: `getAllScanners()` + `getAttackScanners()` in
> [`packages/scanners/src/index.ts`](./packages/scanners/src/index.ts). Counts
> below are re-verified at every release per the release checklist.

### Built-in (42 scanners: 41 regex + 1 AST taint analyzer)

| Scanner | Category | CWE(s) | What it checks |
|---------|----------|--------|----------------|
| `taint-analyzer` | Security | 22, 78, 79, 89, 94, 601, 918, 1321 | **AST-based data-flow analysis** — tracks user input from sources to sinks with per-CWE sanitizer awareness and cross-file propagation |
| `auth-enforcer` | Security | 285, 306 | Missing auth guards, unprotected routes, RBAC gaps |
| `middleware-auth-checker` | Security | 285 | Next.js middleware auth-bypass (CVE-2025-29927, `x-middleware-subrequest` header) |
| `tenant-isolation-checker` | Security | 639 | Supabase queries missing `tenant_id` filters — cross-tenant data leak detection |
| `rls-bypass-checker` | Security | 863 | Supabase `.rpc()` and `service_role` usage bypassing Row Level Security |
| `crypto-auditor` | Security | 326, 327, 338, 798 | Weak algorithms, hardcoded secrets, insecure RNG, eval() injection |
| `zod-enforcer` | Security | 20 | Missing Zod validation on mutation routes, missing `.strict()` |
| `sql-concat-checker` | Security | 89 | SQL via string concatenation instead of parameterized queries |
| `template-sql-checker` | Security | 89 | Template-literal SQL injection via `.rpc()` / `.execute()` / `.query()` / `.$queryRawUnsafe()` / `.$executeRawUnsafe()` / `.raw()` (Supabase, Prisma-raw, knex/mysql2/mongoose/sequelize sinks). v0.15.3 expanded sink-list |
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
| `jwt-detector` | Security | 798 | Hardcoded JWT-format credential detection (`eyJ...`) — catches literal service-role tokens and demo-tokens shipped in source. Comment-aware via `stripComments`. v0.15.2+ |
| `logging-checker` | Quality | 778 | Missing structured logging — auto-skips CLI-tool projects (detects `bin` field in root or workspace children); v0.15.4 also skips empty projects (0 source files) |
| `console-checker` | Quality | 532 | Debug artifacts in production code (`console.log`, `debugger;`, TODO/FIXME) |
| `gdpr-engine` | Compliance | — | GDPR/DSGVO: privacy page, consent, PII, Google Fonts, double-opt-in |
| `soc2-checker` | Compliance | — | SOC 2 Type II control gaps |
| `iso27001-checker` | Compliance | — | ISO 27001 control mapping |
| `pci-dss-checker` | Compliance | — | PCI DSS cardholder-data exposure |
| `pagination-checker` | Security | 770 | Database queries without row limits |
| `i18n-quality` | i18n | — | Hardcoded UI strings, missing locale keys |
| `supply-chain` | Dependencies | 829, 1357 | Dependency confusion, typosquatting, lockfile integrity, monorepo-aware phantom-dep detection (handles TS path aliases + pnpm/npm/yarn workspaces + sub-package deps) |
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

**BLOCKER** and **CRITICAL** severity are semantically equivalent — both represent the highest-severity tier and both force the score to 0 / grade F immediately, regardless of other findings. Scanners may emit either label; the scoring engine treats them identically (this was unified in v0.15.1 after an external review surfaced scans returning grade S with a critical finding quietly buried in the table). Examples of findings that fall into this tier: eval injection, hardcoded secrets, unauthed admin routes, service-role-key misuse, SQL injection on unscoped queries.

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

## CI/CD — GitHub Action

Drop-in security gate for any GitHub Actions workflow. Posts a PR comment with score, severity table, and top findings; fails the build when the score drops below a configurable threshold.

**Distribution note:** the action lives in-repo at `ci/github-action/action.yml` (not published to the GitHub Marketplace). Consumers reference it via `uses: RideMatch1/a.e.g.i.s/ci/github-action@<tag>` pinning to a released tag (e.g. `v0.16.5`).

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
      - uses: RideMatch1/a.e.g.i.s/ci/github-action@v0.11.2  # pin to a specific release tag
        with:
          mode: scan           # 'scan' (quick) or 'audit' (full)
          path: .              # project to scan (default: '.')
          fail-below: 700      # set to 0 to never fail the build
          comment-on-pr: true  # post PR comment with findings table
```

**Inputs:** `mode`, `path`, `fail-below`, `comment-on-pr`, `upload-sarif`, `diff-against`, `aegis-version`. See `ci/github-action/action.yml` for the full schema. Always pin to a specific release tag (`@v0.11.2`) rather than `@main` — a floating ref can silently break CI when AEGIS itself updates.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, workflow, and scope boundaries. Security issues: [SECURITY.md](./SECURITY.md).

Bug reports and feature requests welcome via [GitHub Issues](https://github.com/RideMatch1/a.e.g.i.s/issues); broader design questions via [Discussions](https://github.com/RideMatch1/a.e.g.i.s/discussions).

---

## Credits

See [CREDITS.md](./CREDITS.md) for full attribution of integrated tools and inspirations.

## License

MIT
