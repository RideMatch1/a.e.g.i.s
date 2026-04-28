<!-- aegis-local: AEGIS-native skill, MIT-licensed; runs the canonical 9-gate quality-check sequence pre-commit and post-build, fails-closed if any gate is red, produces a JSON+markdown report. The external safety-net per spec §2 Component 5. -->
---
name: aegis-quality-gates
description: One-shot 9-quality-gate runner. Sequentially runs build / tsc / lint / tests / aegis-scan / brutaler-anwalt / lighthouse / skillforge-validate / briefing-coverage with thresholds per spec §6. Returns exit 0 if all green, exit 1 with a failing-gate list otherwise. Produces .aegis/verify-report.json + a markdown summary. Invoked pre-commit (via husky) and at end of build (via `aegis foundation verify`). Trigger keywords - verify, check all gates, quality-gates, audit-gate, pre-commit-check.
model: sonnet
license: MIT
metadata:
  required_tools: "shell-ops,file-ops"
  required_audit_passes: "1"
  enforced_quality_gates: "9"
  pre_done_audit: "true"
---

# aegis-quality-gates — 9-Gate Verifier

Single-purpose skill: run the canonical AEGIS Foundation quality-gate sequence, return pass/fail per gate, fail-closed when any gate is red. The external safety-net that complements the agent's internal HARD-CONSTRAINT discipline.

---

## HARD-CONSTRAINT — Fail-Closed, No Mocks

This skill is the safety-net for the entire foundation. It MUST:

1. Run real commands against the real artifact (no mocks, no skipping).
2. Fail-closed: if even one gate is red, return exit-non-zero — do NOT report success.
3. Be insurance against the failure-mode where a subagent says "it's done" while gates are silently red. The agent's self-report is not trusted; the gate-runner's exit-code is.
4. Emit a structured report that downstream tooling (CI, handover-writer, status-reporter) can parse — JSON at `.aegis/verify-report.json`, markdown summary printed to stdout.

If husky is bypassed via `--no-verify`: that's a violation per spec §9 hard-NICHTs. Document the override in `SECURITY-EXCEPTION.md` with rationale.

---

## Mission

Be the single source of truth for "is this build ready to commit / push / publish". Operate as a pure function of the working tree + project preset: same inputs → same outputs, no agent-judgment-calls. Make it cheap enough to run pre-commit (every commit) AND comprehensive enough to gate post-build acceptance.

---

## Triggers

### Slash-commands

- `/verify` — full 9-gate run
- `/check all gates` — alias

### Auto-trigger keywords

- verify, check all gates, quality-gates, audit-gate, pre-commit-check

### Husky pre-commit hook

`templates/customer-project/.husky/pre-commit` invokes `aegis foundation verify --quick` (gates 1-4 only — build/tsc/lint/tests). Full 9-gate run is `--final` for end-of-build. Pre-commit-quick keeps commit-loop fast.

---

## Process

### The 9 gates (sequence + thresholds per spec §6)

| # | Gate | Command | Threshold | Mode |
|---|---|---|---|---|
| 1 | build | `npm run build` (or `pnpm run build`) | exit 0 | always |
| 2 | tsc | `npx tsc --noEmit` | 0 errors | always |
| 3 | lint | `npm run lint` (if defined) | 0 errors | always |
| 4 | tests | `npm test` / `pnpm vitest run` | 100% pass, no regression | always |
| 5 | aegis-scan | `npx -y @aegis-scan/cli scan <built-site>` | score ≥ 950, grade S/FORTRESS | --final only |
| 6 | brutaler-anwalt | invoke compliance/aegis-native/brutaler-anwalt skill | 0 KRITISCH, ≤ 2 HOCH | --final only |
| 7 | lighthouse | `npx -y @lhci/cli` | Mobile ≥ 75, Desktop ≥ 90, A11y/SEO/BP = 100 | --final only |
| 8 | skillforge-validate | `python3 /tmp/SkillForge/scripts/validate-skill.py <each-touched-skill>` | 16/17 or higher per touched skill | always (when skills touched) |
| 9 | briefing-coverage | custom check: every page in briefing.md exists in built artifact | 100% | --final + briefing present |

### Phase 1: Discover gates that apply

Read `presets/<use-case>.yaml` to determine which gates apply for this use-case + invocation-mode. customer-build uses all 9; compliance-audit uses 5+6+8 only; dev-feature uses 1-4+8.

### Phase 2: Run gates sequentially

In the order above. Capture stdout + stderr + exit-code per gate. Fail-fast if `--bail` flag set; otherwise continue and aggregate all failures into the report.

### Phase 3: Aggregate report

Write `.aegis/verify-report.json` with structured per-gate results. Print a markdown summary to stdout (one-line-per-gate with green/red marker + threshold + actual).

### Phase 4: Exit-code

Exit 0 if all applicable gates pass. Exit 1 otherwise — non-zero exit triggers husky-block on commit.

---

## Verification / Success Criteria

This skill's own success criteria (it's a verifier-of-verifiers):

- [ ] Each of the 9 gates is implemented + integration-tested (gate fires real command, parses real output)
- [ ] `--quick` mode runs gates 1-4 in under 30 seconds typical (so pre-commit-loop stays usable)
- [ ] `--final` mode runs all 9 gates + writes `.aegis/verify-report.json` + prints markdown summary
- [ ] Exit-code is 0 iff every applicable gate passed (no false-positive exit 0 with red gates)
- [ ] Per-gate threshold is read from the active preset (`presets/<use-case>.yaml`), not hardcoded
- [ ] husky-template `templates/customer-project/.husky/pre-commit` invokes this skill correctly
- [ ] When invoked from agent-context (vs CLI): returns the same per-gate status as the CLI does

---

## Anti-Patterns

- ❌ Mocking gate-runs — every gate must hit the real underlying tool. No simulated outputs.
- ❌ Silent skipping — if a gate's underlying tool is missing (e.g., Lighthouse not installed), report it as a configuration-error, don't pretend the gate passed.
- ❌ Returning exit 0 while ANY gate is red — even if "the failing gate doesn't matter for this commit". Use preset to exclude gates by use-case, not by ad-hoc judgment.
- ❌ Allowing `--no-verify` to silently bypass — log every bypass to `SECURITY-EXCEPTION.md`, fail-closed if file is missing, alert on push.
- ❌ Running the full 9-gate sequence on every keystroke — pre-commit gets `--quick`, end-of-build gets `--final`.
- ❌ Hard-coding thresholds in the skill body — thresholds live in `presets/<use-case>.yaml` so projects with different bars (e.g., proof-of-concept vs production) can configure.
- ❌ Skipping the JSON report — downstream tooling depends on `.aegis/verify-report.json` being well-formed.

---

## Extension Points

- **New gate**: add a row to the 9-gate table here + add the gate-implementation in `aegis foundation verify` CLI command code (`packages/cli/src/commands/foundation/verify.ts`). Update preset YAML schema to allow the new gate's threshold-block. Update each `presets/<use-case>.yaml` to opt-in or opt-out.
- **Per-project threshold-overrides**: a project's `aegis.config.json` can override the preset's threshold for one gate (e.g., a starter-template might cap aegis-scan target at 800 instead of 950). Don't override in code; override in config.
- **Custom gate-implementations**: for organisation-specific gates (e.g., "all images must be optimised"), add them as `presets/<use-case>.yaml` `custom_gates:` entries pointing at a node-script that returns `{name, pass, output}`. Skill calls the script as if it were a built-in gate.
- **Quick-vs-final composition**: extend the gate-table with a `mode` column listing `quick` / `final` / `both`. The CLI flag selects which subset runs.
- **Reporter formats**: report-rendering belongs in `packages/reporters` (existing). This skill emits the structured JSON; reporters render to HTML / SARIF / Markdown / etc.
