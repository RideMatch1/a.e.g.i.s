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

## Scanner author checklist

Every new scanner that consumes `isTestFile()` from `@aegis-scan/core` must ship a path-invariance test-contract alongside its detection logic. The contract exists because a substring-match bug in the previous skip-logic (D-CA-001, closed in v0.16.3) silently hid findings in legitimate Next.js App Router routes like `app/api/test/route.ts`. The canonical `isTestFile()` helper now rejects ambiguous substring matches; every scanner must prove, per-release, that it still scans legitimate `/test/` paths and still skips real test-files. See [`docs/testing/path-invariance-contract.md`](./docs/testing/path-invariance-contract.md) for the contract definition.

### Test-coverage requirements

- [ ] Use the canonical `isTestFile()` helper from `@aegis-scan/core`. Do not hand-roll `.test.ts` detection.
- [ ] Add a **TP canary fixture** under `packages/benchmark/canary-fixtures/<current-phase>/TP-<scanner>-n1-test-named-path/` with:
  - The scanner's target vulnerability in a file at `src/app/api/test/route.ts` (or a path containing `/test/` as a segment — the N1 negative-boundary class).
  - `expected.json` declaring `{ scanner, cwe }` the scanner must emit.
  - Verify via `node packages/benchmark/canary-run.mjs <phase>` — the fixture must PASS.
- [ ] Add a **FP canary fixture** under `packages/benchmark/canary-fixtures/<current-phase>/FP-<scanner>-p1-dot-test-file/` with:
  - The same vulnerable pattern in `src/foo.test.ts` (or a path exercising the P1 `.test.ts` extension class).
  - `expected.json` with `type: "FP"` — the scanner must NOT emit the declared `{ scanner, cwe }`.
- [ ] Add a `describe('<Scanner>Scanner — path-invariance (D-CA-001 contract, v0164)')` append-block to the scanner's test-file in `packages/scanners/__tests__/<category>/<scanner>.test.ts`. The block has two `it`-cases: one N1-scan-expected, one P1-skip-expected. Use inline `mkdirSync` + `writeFileSync` so each path is explicit.
- [ ] Add a coverage-matrix header-comment at the top of the scanner src file. Format:

```ts
// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — <pattern-description> in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — <pattern-description> in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.
```

### Discipline — preventive against known class-lessons

Three classes of mid-batch issue surfaced during the v0164 path-invariance arc. Apply the preventive-check before authoring fixtures and unit-tests:

- [ ] **Comment-pollution.** Fixture comments must not mention scanner-trigger-keywords that the scanner's proximity-check regex looks for. Example: `http-timeout-checker` flags bare `fetch()` when no `AbortController` or `signal:` appears within ±10 lines — a fixture comment that mentions `AbortController` would be read as a proximity-signal and suppress the finding. Use neutral descriptions ("verify N1-class scan coverage for http-timeout-checker") instead of pattern-specific wording.
- [ ] **Scanner-bimodal behavior.** Before fixture-authoring, grep the scanner source for threshold patterns (`>0.5`, `>50`, `ratio`, `threshold`, `percentage`). If the scanner emits an aggregate finding (no file-anchor) above a threshold and per-file findings below, the TP fixture must land on the per-file side so the assertion can anchor to a specific path. Example: `logging-checker` emits an aggregate finding when >50% of mutation routes lack audit logging; seeding a second logged route alongside the unlogged target drops the ratio to 50% and triggers the per-file branch.
- [ ] **Regex-boundary on fixture content.** Grep the scanner source for negated character-classes (`[^...]`). Patterns like `[^'"`;]*` stop consumption at the first excluded character — a fixture that embeds an inner quote literal may terminate the regex match before it reaches the vulnerable sub-expression. Example: `sql-concat-checker`'s concat regex fails on `"SELECT ... id = '" + body.id` because the inner single-quote ends the character-class match before the `+` operator. Use a minimal-reproducer without inner delimiters when possible.

### Verification

- [ ] `pnpm test --filter @aegis-scan/scanners` — all tests pass, including the new `path-invariance` describe-block.
- [ ] `node packages/benchmark/canary-run.mjs <phase>` — the new TP + FP fixtures PASS alongside existing fixtures.
- [ ] Self-scan preserved: `node packages/cli/dist/index.js scan . --format json` reports `score=1000 grade=A findings=0`.

### Pattern reference

Living-reference examples from the v0164 arc — copy these shapes rather than inventing:

- **Coverage-matrix-comment format:** `packages/scanners/src/quality/tenant-isolation-checker.ts` (top of file, below imports, before JSDoc).
- **Describe-block format:** `packages/scanners/__tests__/quality/tenant-isolation-checker.test.ts` (end of file, sibling to the outer describe).
- **Canary-fixture format:** `packages/benchmark/canary-fixtures/v0164-path-invariance-matrix/TP-tenant-isolation-checker-n1-test-named-path/`.

## Getting help

- **Bugs and feature requests**: [GitHub Issues](https://github.com/RideMatch1/a.e.g.i.s/issues).
- **Questions, usage, design discussion**: [GitHub Discussions](https://github.com/RideMatch1/a.e.g.i.s/discussions).
- **Security vulnerabilities**: do NOT open a public issue. See [`SECURITY.md`](./SECURITY.md) for the private reporting channel.

For big refactors or complex features, open a Discussion thread first so scope is aligned before code is written.
