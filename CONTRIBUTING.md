# Contributing to AEGIS

AEGIS (Automated Enterprise-Grade Inspection Suite) is an MIT-licensed stack-specific SAST for Next.js + Supabase + React, built in the open. Contributions are welcome — please read this doc before opening a PR so work lands cleanly.

## Project scope (what's in — and what's permanently out)

AEGIS is deliberately narrow. The following are **permanently** out of scope; PRs expanding them will be closed with a link to this section:

- **Languages other than TypeScript / JavaScript.** Single-language by design. No Python / Go / Java / Rust / etc. No "polyglot mode."
- **SaaS platform, cloud dashboard, telemetry.** AEGIS runs local-only; findings never leave the user's machine. No hosted variant will be built.
- **AI calls by default.** AI-assisted features are opt-in via the `--ai` flag; default runs are deterministic with zero remote calls.
- **Compliance certification issuance.** AEGIS produces audit-evidence that a certified auditor can use as input; it does not itself certify.

In scope:

- New scanners for Next.js / Supabase / React patterns.
- New sinks / sanitizers for the AST taint tracker.
- External-tool wrappers (Semgrep, Gitleaks, …) that fit AEGIS's scanner interface.
- Precision improvements to existing scanners (fewer false positives, better CWE attribution).
- Reporter improvements (SARIF, terminal, markdown, HTML, JSON).
- MCP server + VS Code extension surface.
- Docs, benchmarks, test coverage.

## Development setup

Requires Node 20+ and pnpm 9+.

```bash
git clone https://github.com/RideMatch1/a.e.g.i.s.git
cd a.e.g.i.s
pnpm install
pnpm -r build
pnpm -r test                     # expect 1339 green
node packages/benchmark/run.mjs  # expect 25/25 strict
```

The benchmark scans a vulnerable fixture app under `packages/benchmark/vulnerable-app/` and enforces a strict expected-findings list. New scanners or detectors should add to it.

## Development workflow

- **Atomic commits**: one logical change per commit. Commit messages describe the *why*, not the *what* (code shows the what). Use conventional-commit prefixes: `feat(scope):`, `fix(scope):`, `test(scope):`, `docs(scope):`, `chore(scope):`.
- **Tests green before push**: `pnpm -r test` must pass. New functionality needs test coverage.
- **Benchmark green before push**: `node packages/benchmark/run.mjs` must stay 25/25 strict. Changes that shift the count require an `expected.json` update in the same commit.
- **Target branch**: `main`. No long-lived feature branches for solo-scoped work.
- **Pre-1.0 semantics**: breaking changes are allowed, but require a `CHANGELOG.md` entry under the current `[Unreleased]` heading describing migration.

## PR guidelines

- One concern per PR. Five small PRs are easier to review than one sweeping one.
- Title should match the first-line commit format (`fix(scope): …` / `feat(scope): …` / `docs: …`).
- Description explains *why* the change exists, not *what* it does. Reference a tracked issue when applicable.
- Run `pnpm -r build && pnpm -r test && node packages/benchmark/run.mjs` locally before pushing.
- Include tests for any new behaviour. Test-free code changes are blocked at review.
- For scanner / rule additions, see the next section.

## Scanner / rule additions

- **Scanner code**: `packages/scanners/src/`. Pattern: one file per scanner, exports a `Scanner` that implements the `Scanner` interface from `@aegis-scan/core`.
- **Tests**: `packages/scanners/__tests__/<scanner-name>.test.ts`.
- **Benchmark fixture**: if the scanner detects something new, add a vulnerable-app route under `packages/benchmark/vulnerable-app/src/app/api/<vuln-id>/` (and optionally a clean counterpart) and a matching entry in `packages/benchmark/expected.json`.
- **Rules registry**: sinks live in `packages/scanners/src/ast/sinks.ts`, sanitizers in `.../sanitizers.ts`. Add new entries there — both the summary-cache and taint-tracker consume these as single source of truth.

Coverage target for new scanners: **70%+** on the new file (stricter than the 65% package-default).

## Getting help

- **Bugs and feature requests**: [GitHub Issues](https://github.com/RideMatch1/a.e.g.i.s/issues).
- **Questions, usage, design discussion**: [GitHub Discussions](https://github.com/RideMatch1/a.e.g.i.s/discussions).
- **Security vulnerabilities**: do NOT open a public issue. See [`SECURITY.md`](./SECURITY.md) for the private reporting channel.

For big refactors or complex features, open a Discussion thread first so scope is aligned before code is written.
