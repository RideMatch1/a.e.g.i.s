<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: code-review-headless
description: Headless code review workflow for AIRecon Docker engine (CLI-only), focused on bug discovery, security risks, regressions, and test gaps.
---

# Code Review (Headless / Docker-Friendly)

Use this workflow when reviewing source code, pull requests, or diffs for bugs and security issues.

## Constraints

- AIRecon engine runs in Docker + terminal tools.
- Do not depend on GUI workflows (IDE visual diff, GUI SAST dashboards, browser-only inspectors).
- Prefer reproducible CLI evidence: command output, file paths, line references.

## Review Priorities

1. Correctness bugs (logic, state, edge cases).
2. Security flaws (injection, authz/authn, unsafe deserialization, path handling).
3. Behavioral regressions introduced by new changes.
4. Missing tests for high-risk paths.
5. Performance/memory issues only when impactful.

## Fast Triage Flow

1. Scope the change:
   - `git status --short`
   - `git diff --stat`
   - `git diff -- <file>`
2. Locate critical surfaces:
   - Input parsing, path normalization, report writing, auth/session, tool dispatch.
3. Validate invariants:
   - No empty target/path writes
   - No unsafe path traversal
   - No silently swallowed critical errors
   - Deterministic behavior in retries/recovery
4. Confirm with tests:
   - Run the smallest relevant test subset first
   - Then broader suite if core behavior changed

## What to Report

- Findings first, ordered by severity.
- Include exact file + line references.
- Include impact + failure mode + minimal fix.
- Explicitly call out missing test coverage.
- If no bug found, state residual risk and untested assumptions.

## Useful CLI Patterns

```bash
# Find suspicious patterns quickly
grep -Rsn "TODO\\|FIXME\\|except Exception\\|pass$\\|eval\\|exec\\|subprocess" airecon/

# Focus on path/file handling
grep -Rsn "resolve\\|relative_to\\|os.path.join\\|open(" airecon/proxy/

# Verify reporting behavior
pytest -q tests/proxy/test_reporting.py

# Verify agent loop behavior
pytest -q tests/proxy/agent/test_loop.py tests/proxy/agent/test_loop_extended.py
```

## Output Discipline

- Every claim must be tied to concrete evidence from code or test output.
- Avoid speculative findings without proof.
- Prefer small, safe patches with matching tests.
