<!--
Thanks for contributing to AEGIS. Please fill out the sections below so
reviewers can assess the change quickly. Delete any section that doesn't apply.
-->

## What does this change

<!-- One-paragraph summary. What problem does it solve? -->

## Scope

<!-- Tick the box that best describes the change -->

- [ ] New scanner or scanner feature
- [ ] Scanner precision fix (FP removal / FN capture)
- [ ] Reporter / output format
- [ ] CLI UX / config
- [ ] MCP server
- [ ] GitHub Action
- [ ] Documentation
- [ ] Benchmark / test fixtures
- [ ] Infrastructure / release process
- [ ] Refactor (no behaviour change)

## Coverage

- Tests added / updated: <!-- e.g. +3 regression tests in taint-tracker.test.ts -->
- Benchmark delta (`node packages/benchmark/run.mjs`): <!-- e.g. 30/30 → 31/31 -->
- Self-scan delta (`aegis scan .` from repo root): <!-- e.g. 1000/A unchanged -->

## Breaking changes

- [ ] This PR introduces a breaking change (CLI flag removed, API shape
      changed, config schema tightened, etc.)
- [ ] No breaking changes

<!-- If breaking: what's the migration path? Mention in CHANGELOG. -->

## Validator / review notes

<!-- Anything you want the reviewer to look at closely? Edge cases, alternative
approaches you considered, tradeoffs you're unsure about. -->

## Related issue(s)

<!-- Closes #123 / Refs #456 -->

---

Checklist before merge:

- [ ] `pnpm -r build` passes
- [ ] `pnpm -r test` passes
- [ ] `node packages/benchmark/run.mjs` — 30/30 (or the new count, if benchmark was extended)
- [ ] Self-scan (`aegis scan .`) — no new findings beyond the current 1000/A
- [ ] Commit messages follow the `<type>(v0.x.x): subject` convention
- [ ] CHANGELOG entry added (or PR is trivially doc-only)
