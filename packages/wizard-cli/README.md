# AEGIS Wizard

> **Scaffold + brief-generator for institutional-grade Next.js + Supabase + shadcn SaaS.**
>
> Answer a thorough wizard. Get a brief. Hand it to your agent. Ship in one day.

[![npm version](https://img.shields.io/npm/v/@aegis-wizard/cli.svg)](https://www.npmjs.com/package/@aegis-wizard/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![SLSA v1](https://img.shields.io/badge/SLSA-v1-green.svg)](https://slsa.dev/)

---

## What is it

`@aegis-wizard/cli` is a scaffold-wizard and brief-generator for Next.js + Supabase + shadcn/ui SaaS projects. Run `aegis-wizard new my-saas --interactive`, answer ~15 essential questions about your project, and the wizard emits two files:

1. `aegis.config.json` — a validated config capturing every answer, ready for non-interactive re-runs.
2. `my-saas-brief.md` — an agent-consumable Markdown brief that composes your answers with battle-tested security + compliance patterns into a top-to-bottom build plan.

Hand the brief to an AI coding-agent (Claude Code, Codex, Cursor, or similar) and it scaffolds a working SaaS backend — multi-tenant, authenticated, DSGVO-compliant, deployment-ready — in a day.

## Quickstart

```bash
# 1. Install globally
npm install -g @aegis-wizard/cli

# 2. Run the wizard
aegis-wizard new my-saas --interactive

# 3. Hand the brief to your agent
#    Claude Code / Codex / Cursor / any LLM coding agent
#    Point it at ./my-saas/my-saas-brief.md

# 4. (Recommended) After build, verify safety with @aegis-scan
npx @aegis-scan/cli scan ./my-saas
# expected: score >= 960, grade A, 0 critical
```

One-shot via `npx` (no global install):

```bash
npx -y @aegis-wizard/cli new my-saas --interactive
```

## What the brief contains

The generated brief is structured so an agent can execute it top-to-bottom without guesswork:

- **Installation commands** — `create-next-app`, `shadcn init`, `npm install`, verbatim, in order.
- **Database schema** — migrations in `supabase/migrations/` with tenants + profiles + RLS + DSGVO tables.
- **API route convention** — paste-ready `secureApiRouteWithTenant` + `requireRole` + Zod `.strict()` template.
- **Build order** — 10 phases, each with gate-checks. Agent halts between phases.
- **Quality gates** — `npm run build`, `tsc --noEmit`, `aegis scan`, `react-doctor`, Umlaut-check, placeholder-leak check.
- **DSGVO checklist** — cookie-banner, account-deletion, audit-log verification steps.
- **Environment variables** — `.env.local` copy-paste template with correct secret-scoping.
- **Post-build report template** — structure for the agent's handover document.

## Flags

```bash
aegis-wizard new <project-name> [flags]

  -i, --interactive       Run the interactive wizard (default)
  -n, --non-interactive   Skip the wizard, read --config instead
  -c, --config <file>     Path to a pre-filled aegis.config.json
  -o, --output-dir <dir>  Where to write emitted files (default: ./<project-name>)
  -m, --output-mode <m>   brief | scaffold | both (default: both)
  -v, --verbose-brief     Emit verbose brief with prose + rationale
  -l, --lang <lang>       Brief language: en (default) | de
```

`--output-mode=scaffold` writes only `aegis.config.json` (no brief). `--output-mode=brief` writes only the brief. `--output-mode=both` (the default) writes both.

`--verbose-brief` adds prose paragraphs before each code-block explaining why each pattern / rule / command exists, plus "alternatives considered" notes on major decisions. The structure stays identical; the difference is explanation density. Expect ~1.5x the terse line count.

`--lang=de` switches the brief's static strings to German. Dynamic interpolations (file paths, command names, pattern references, URLs) stay language-agnostic. All four combinations — terse+en, terse+de, verbose+en, verbose+de — produce functionally-equivalent scaffolds.

## Stack (locked)

| Layer | Tech |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript (strict mode) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| UI Library | [shadcn/ui](https://ui.shadcn.com) + [Radix](https://www.radix-ui.com) |
| Database / Auth / Storage | [Supabase](https://supabase.com) |
| State | [Zustand](https://zustand.docs.pmnd.rs) |
| Server State | [TanStack Query](https://tanstack.com/query) |
| Forms | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) |

AEGIS Wizard masters this one stack deeply. For other stacks, this tool is not for you — but this stack covers 90% of modern SaaS use-cases.

## Patterns included (v0.17)

The `saas-starter` preset bundles 8 production-hardened patterns shipped in `docs/patterns/`:

**Foundation**
- `multi-tenant-supabase` — tenants + profiles + RLS with `secureApiRouteWithTenant`
- `auth-supabase-full` — login, signup, password-reset, MFA, magic-link
- `rbac-requirerole` — role-based access control with `requireRole()`
- `middleware-hardened` — CSP, HSTS, XFO, CORS, rate-limit
- `logger-pii-safe` — deep-sanitize logger with 50+ redaction patterns
- `i18n-next-intl` — DE / EN i18n via `next-intl`

**Compliance**
- `dsgvo-kit` — cookie-banner, consent-versioning, data-export, account-deletion with 30-day grace
- `legal-pages-de` — Impressum / Datenschutz / AGB templates for DE-jurisdiction operators

See the [pattern catalog](../../docs/patterns/index.md) for the full listing.

## Relationship to `@aegis-scan`

AEGIS Wizard is a sibling product to [`@aegis-scan/cli`](https://www.npmjs.com/package/@aegis-scan/cli), the framework-specific SAST scanner for Next.js + Supabase projects. Wizard **scaffolds** your SaaS from zero; Scan **verifies** it post-build. Recommended workflow runs both:

```bash
# Scaffold (once, project-init)
npx -y @aegis-wizard/cli new my-saas --interactive

# Scan (every commit, CI-integrated)
npx -y @aegis-scan/cli scan .
```

The brief emitted by Wizard encodes the same architectural assumptions Scan checks against — the two tools are co-calibrated. A Wizard-scaffolded project scoring below 960 on Scan's 0-1000 grade is treated as a pattern-defect issue, not as a user error.

## What AEGIS Wizard is NOT

- **Not a component-library.** Uses [shadcn/ui](https://ui.shadcn.com) directly; does not wrap, fork, or redistribute their components.
- **Not a template-engine with locked-in abstractions.** The code recommended lives directly in your project. You own every file. No black boxes.
- **Not a registry-host.** No `@aegis-wizard/some-pack` packages. The wizard points at the right upstream sources (shadcn, npm, Supabase) and stitches them together correctly.
- **Not opinionated about your business logic.** Wizard gives you the security + architecture foundation. What you build on top is yours.

## Supply-chain integrity

Every published version ships with SLSA v1 provenance — the npm attestation binds the tarball to the exact GitHub Actions run, commit-SHA, and registry-identity. Consumers can verify with:

```bash
npm audit signatures
npm view @aegis-wizard/cli@<version> dist.attestations.provenance.predicateType
# → https://slsa.dev/provenance/v1
```

The publish-workflow (`.github/workflows/publish-wizard.yml`) triggers on `wizard-v*` tags and runs with SHA-pinned GitHub Actions per supply-chain-integrity discipline.

## License

MIT — do what you want. Build open, build safely.

---

**Built by the AEGIS team.** See the [project repo](https://github.com/RideMatch1/a.e.g.i.s) for contributor guidelines, issue tracking, and the full monorepo.
