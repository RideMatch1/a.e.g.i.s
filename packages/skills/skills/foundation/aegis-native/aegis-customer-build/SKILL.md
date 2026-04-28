<!-- aegis-local: AEGIS-native skill, MIT-licensed; library-engine-driven autonomous customer-website builder. Ingests a configurator-output briefing.md, runs 7 phases (Recon/Architecture/Component-Build/Content/Integration/Mid-Audit/Final-Verify) plus Pre-Build-Validation and Post-Build status-report, dispatches subagents (Master/Research/Executor/Strategist), hits AAA+++ quality-gates (994/S/FORTRESS, Lighthouse 98+, briefing-coverage 100%) or returns INCOMPLETE-Status. Pattern ported from a private operational reference; this is the public OSS variant. References to private engines, libraries, and reference-implementations are placeholder/concept-level only. -->
---
name: aegis-customer-build
description: Autonomous customer-website builder. Ingests configurator-briefing, runs 7 phases (Recon/Architecture/Build/Content/Integration/Mid-Audit/Final-Verify) + multi-agent dispatch, hits production-bar quality gates or returns INCOMPLETE-list. Trigger keywords - build customer, kundenseite, konfigurator-briefing, autonomous-build, 3h-build, agentur-build.
model: opus
license: MIT
metadata:
  required_tools: "shell-ops,file-ops,task-tracking,subagent-dispatch,library-engine,aegis-scan,brutaler-anwalt,lighthouse"
  required_audit_passes: "3"
  enforced_quality_gates: "9"
  pre_done_audit: "true"
---

# aegis-customer-build — Autonomous AAA+++ Customer-Site Builder

The Foundation's flagship skill. One operator-prompt → 3-5h autonomous → deployment-ready customer-site at production-bar quality. Multi-agent orchestration with mandatory mid-build audits and a final 9-gate verification loop. Either DONE with proof or INCOMPLETE with explicit open-list — never "looks done".

> **Library-engine** = the project's component-library invocation toolchain. Could be a private engine kept out of the public AEGIS repo (referenced by capability, not by code), a public starter-template, or a project-specific harvested library. The skill never assumes a specific engine; it consumes whatever the project has bound under `<private-engine>` per the spec §13.14.F placeholder convention.

---

## HARD-CONSTRAINT — Anti-Halbherzig-Discipline

Before Phase 1 starts, this skill MUST:

1. **Load all 7 phase-references** in `references/phase-1-recon.md` through `references/phase-7-final-verify.md`. Skipping a phase-reference = guaranteed quality-regression. References live next to this SKILL.md.
2. **Load the project's component-library inventory.** Scan, catalog, and bind to component-tree. No improvising components when the library has a fitting one.
3. **Load the configurator-briefing** at the path the operator passed. Validate it against the schema in `references/phase-1-recon.md` BEFORE any build-action.
4. **Load `compliance/aegis-native/brutaler-anwalt/SKILL.md`** for the spot-check passes in Phase 6 + final pass in Phase 7. Audit-patterns are mandatory cross-reference.
5. **Pages-Count-Commitment:** count the pages explicitly listed in the briefing. Print `Briefing pages: N expected, will build: N`. If briefing says 5 pages, build 5. Building 4 is a violation — explicit INCOMPLETE-Status with the 5th page listed.
6. **7-phase-pipeline is non-skippable.** No "this build doesn't need Phase 6". Mid-Audit and Final-Verify run on every build, regardless of size.
7. **Per-phase checkpoint:** after each phase, write `.aegis/state.json` with `{phase, status, timestamp, gates_run, gates_pass}`. The next agent (or resumed session) needs this to recover from a crash.
8. **Final-Verify-Loop:** all 9 gates (per `aegis-quality-gates`) green OR repair-attempt (max 3 iterations) OR INCOMPLETE-Status with the failing-gate-list. Never silent-skip.

If any of (1)-(8) cannot be satisfied — STOP and report which precondition is missing. Don't improvise; the foundation depends on these guarantees.

---

## Mission

Eliminate the failure-mode where a coding-agent says "the site is done" while pages are stub-quality, gates were skipped, or the briefing's page-list isn't fully covered. Provide an industrial-grade pipeline that:

- Runs a fixed 9-step sequence (Pre-Build + 7 phases + Post-Build) — no agent-judgment-call to skip steps.
- Uses the project's existing component-library 1:1 — no parallel hand-cobbled assemblies that drift from the library's quality-bar.
- Audits at the half-way mark (Phase 6) before pouring more time into a build whose foundation is already broken.
- Verifies every page in the briefing exists in the artifact (briefing-coverage gate) — no silent omissions.
- Reports DONE-with-proof or INCOMPLETE-with-list — never optimistic "looks done".

Production-bar reference: a previous customer-build run (private operational reference) hit AEGIS 994/S/FORTRESS + Lighthouse 98/100/100/100 + brutaler-anwalt 0 KRITISCH/0 HOCH on a 13-page deliverable in 3h. This skill is the public-reusable version of that pipeline.

---

## Triggers

### Slash-commands

- `/build` — start a customer-build run (operator passes briefing-path as argument)
- `/customer-build` — alias
- `/agentur-build` — alias

### Auto-trigger keywords

- build customer, kundenseite, neue site, konfigurator-briefing, autonomous-build, 3h-build, AAA+++ site

### Required-input gate

The skill refuses to start without a briefing-path. If the user just says "build a site", the skill asks for the briefing-file (path or content) and exits if not provided. No improvising a briefing from chat-context — the briefing is the contract.

---

## Process

The pipeline is fixed. Pre-Build + 7 numbered phases + Post-Build = 9 mandatory steps. Each step has a phase-reference under `references/`. Each step ends with a checkpoint-write to `.aegis/state.json`.

### Phase Summary Table

| # | Phase | Time | Subagent | Reference | Checkpoint |
|---|---|---|---|---|---|
| 0 | Pre-Build-Validation | ~10 min | Master | phase-1-recon.md | briefing_validated |
| 1 | Recon | ~20-30 min | Research (opus) | phase-1-recon.md | briefing_parsed |
| 2 | Architecture | ~20-30 min | Strategist (opus) | phase-2-architecture.md | architecture_decisions |
| 3 | Component-Build | ~60-90 min | Executor (sonnet) × N | phase-3-component-build.md | pages_built |
| 4 | Content | ~30-45 min | Executor (sonnet) | phase-4-content.md | content_complete |
| 5 | Integration | ~30-45 min | Executor (sonnet) | phase-5-integration.md | integrations_mounted |
| 6 | Mid-Audit | ~20-30 min | Auditor (opus) | phase-6-mid-audit.md | mid_audit_score |
| 7 | Final-Verify | ~30-45 min | Auditor (opus) | phase-7-final-verify.md | gates_status |
| 8 | Post-Build Status | ~5-10 min | Master | _(inline below)_ | status: DONE\|INCOMPLETE |

Total: 3-5h wall-clock with parallel subagent dispatch in Phase 3.

### Pre-Build-Validation (~10 min)

Before Phase 1: validate the briefing.md exists, parses, and is complete enough to commit to a 3-5h build. See `references/phase-1-recon.md` for the briefing-completeness checklist (project-slug, brand, pages-list with N≥3, tech-stack, content-plan, brand-identity, design-prefs).

If briefing is incomplete — STOP, print the missing fields, ask the operator to complete it. Don't guess.

Tech-stack auto-detection: if the briefing says Next.js, the build uses the foundation's Next.js template. Alternative stacks (Remix, SvelteKit) are extension-points; the canonical path is Next.js App Router.

### Phase 1: Recon (~20-30 min)

Parse the briefing into structured data. Extract: pages-list, tech-stack, brand-identity, content-plan, design-prefs. Identify mandatory integrations (forms, chatbot, scanner, analytics).

See `references/phase-1-recon.md` for the parser-checklist + tech-stack-detection-patterns.

Checkpoint: `.aegis/state.json` `phase: 1, status: complete, briefing_parsed: true`.

### Phase 2: Architecture (~20-30 min)

Decide routing-pattern (App Router vs Pages Router), component-tree (page-level vs shared), data-flow (props vs context vs server-state), and tech-stack-decision-matrix (Tailwind vs styled-components, etc.).

See `references/phase-2-architecture.md`.

Checkpoint: `.aegis/state.json` `phase: 2, architecture_decisions: {routing, component_tree, data_flow}`.

### Phase 3: Component-Build (~60-90 min)

Iterate page-by-page. For each page: bind to library-components from the project's component-library. Custom-content for unique pages; standard-template for boilerplate.

This is the biggest time-block. Subagent-dispatch is recommended: each page can be built by an Executor-subagent in parallel (per spec §14.3 — multi-agent orchestration via Task tool / spawn_agent).

See `references/phase-3-component-build.md` for the per-page-iteration pattern.

Checkpoint per page: `.aegis/state.json` `pages_built: [...]` updated incrementally.

### Phase 4: Content (~30-45 min)

Copy-writing per page (matching the briefing's tone-of-voice), image-placement (per the operator's image-pipeline — typically a mix of stock + custom), SEO-meta + Open-Graph + Schema.org structured data.

See `references/phase-4-content.md`.

Checkpoint: `.aegis/state.json` `phase: 4, content_complete: true, alt_texts_present: true`.

### Phase 5: Integration (~30-45 min)

API-routes (with secureApiRoute + Zod-strict + requireRole patterns from the foundation's templates), forms (DSGVO-compliant + double-opt-in pattern), chatbot mounting (e.g., a public LLM via /api/chat — per the foundation's reference integration), scanner mounting (/scan + sub-routes if the project uses the AEGIS public scanner).

See `references/phase-5-integration.md` for the API-route-template + form-template + chatbot-mount-pattern.

Checkpoint: `.aegis/state.json` `phase: 5, integrations_mounted: [...]`.

### Phase 6: Mid-Audit (~20-30 min, MANDATORY)

Run AEGIS-scan on the half-built artifact. Run brutaler-anwalt in HUNT-mode with topic-specific scope (focus: Impressum + Cookie + DSE — the bug-prone surface). Identify regressions early before pouring 60 more minutes of content into a foundation that's already red.

See `references/phase-6-mid-audit.md` for the spot-check-pattern + repair-attempt-loop (max 3 iterations before escalating to Phase 7 INCOMPLETE).

Checkpoint: `.aegis/state.json` `phase: 6, mid_audit_score: X, mid_audit_repairs: N`.

### Phase 7: Final-Verify (~30-45 min)

Run all 9 quality-gates (per `aegis-quality-gates`). Run briefing-coverage check (every page in briefing exists in artifact + has minimum content + has SEO-meta). Run Lighthouse (Mobile + Desktop). Run final brutaler-anwalt full-pass.

See `references/phase-7-final-verify.md` for the 9-gate-runner-invocation + briefing-coverage-pattern + status-report-format.

Checkpoint: `.aegis/state.json` `phase: 7, gates_status: {build, tsc, ...}, briefing_coverage: X/X, status: DONE|INCOMPLETE`.

### Post-Build: Status-Report (~5-10 min)

Print the structured status:

```
Bin fertig, Chef.
- Site unter <output-path>/
- AEGIS Score: <score>/<grade>/<bracket>
- Lighthouse: <mobile>/<desktop>
- brutaler-anwalt: <kritisch> KRITISCH, <hoch> HOCH
- Briefing-Coverage: <built>/<expected> pages (<pct>%)
- Audit-Report: <output-path>/audits/final.md
- Bereit für deploy.
```

OR if any gate is red:

```
BUILD INCOMPLETE — folgende Items offen:
- [ ] <gate-name>: <actual> (threshold: <expected>)
- [ ] <missing-page>: <expected-path> (briefing line N)
...
Repair-attempt-Count: <N>/3. Empfehlung: <repair / abandon>.
```

Never report "DONE" with red gates. Never silent-skip a gate.

---

## Verification / Success Criteria

Before declaring the build complete:

- [ ] Pre-Build-Validation passed (briefing complete, schema-valid, pages ≥3)
- [ ] Phase 1 Recon checkpoint written + parsed-briefing under `<output>/briefing-parsed.json`
- [ ] Phase 2 Architecture decisions written under `<output>/architecture.md`
- [ ] Phase 3 Component-Build: every page in briefing has a corresponding file in the artifact
- [ ] Phase 4 Content: every page has copy + images + SEO-meta + alt-texts (no missing fields)
- [ ] Phase 5 Integration: all integrations from briefing mounted (forms, chatbot, scanner — whichever applies)
- [ ] Phase 6 Mid-Audit: AEGIS-score ≥ 900 mid-build (interim threshold) + brutaler-anwalt 0 KRITISCH
- [ ] Phase 7 Final-Verify: all 9 gates green per `aegis-quality-gates`
- [ ] Briefing-coverage: 100% of pages in briefing exist in artifact
- [ ] AEGIS-score: ≥ 950 (target ≥ 990)
- [ ] Lighthouse: Mobile ≥ 75, Desktop ≥ 90, A11y/SEO/BP = 100
- [ ] brutaler-anwalt: 0 KRITISCH, ≤ 2 HOCH (any HOCH explicitly listed in status)

If any checkbox unmet → INCOMPLETE-Status. Report which checkbox is open + repair-attempt count + recommendation.

---

## Anti-Patterns

- ❌ Skipping Pre-Build-Validation "because the briefing looks fine" — schema-validation catches missing fields the operator forgot.
- ❌ Building 4 pages when briefing says 5 — pages-count-commitment is non-negotiable.
- ❌ Skipping Phase 6 Mid-Audit "to save time" — Phase 6 catches foundation-bugs before Phase 7 has to find them in a fully-built artifact (more expensive to repair).
- ❌ Hand-cobbling components when the project's library has a fitting one — library-binding is the quality-bar; improvising drifts.
- ❌ Reporting "DONE" with red Lighthouse — Lighthouse is gate 7; red gate = INCOMPLETE.
- ❌ Skipping the final brutaler-anwalt pass "because the mid-audit was clean" — final pass is mandatory.
- ❌ Mocking gate-runs in Phase 7 — every gate hits real tools; mocking gates is grounds for full-rebuild.
- ❌ "Repair-attempt count: 5" — max 3 iterations before INCOMPLETE-Status. Don't loop forever; escalate.
- ❌ Silent-skipping Phase 6 because "this is just a small site" — every customer-build runs all 9 steps.
- ❌ Improvising a briefing from chat-context — the briefing is the contract; demand the file from the operator.
- ❌ Writing the post-build status-report without actually verifying the artifact (e.g., not running Lighthouse, just claiming a score).

---

## Extension Points

- **Alternative tech-stacks**: Next.js App Router is the canonical path. Remix / SvelteKit / Astro / Vite-React extensions add a `references/phase-2-architecture-<stack>.md` and a parallel `references/phase-3-component-build-<stack>.md`. Phase 1 + 4 + 5 + 6 + 7 stay stack-agnostic.
- **Custom briefing-schemas**: a project might use a different configurator that produces a different briefing-shape. Add a `references/phase-1-recon-<configurator>.md` and a schema-validator script. Pre-Build-Validation reads the configurator-name from the briefing and dispatches.
- **Multi-language sites**: extend Phase 4 with a `references/phase-4-content-i18n.md` covering locale-routing, message-bundles, hreflang-tags, locale-specific SEO-meta.
- **E-commerce extensions**: Phase 5 Integration extends with `references/phase-5-integration-ecommerce.md` covering payment-providers, cart-flows, fulfillment-webhooks. Phase 6 mid-audit extends to include PCI-DSS-spot-check.
- **Custom Lighthouse-thresholds**: a starter-template might cap at 80 instead of 95. Override in `presets/<use-case>.yaml` `lighthouse:{mobile,desktop,a11y,seo,bp}`. Phase 7 reads from preset, not hardcoded here.
- **Subagent-dispatch granularity**: by default Phase 3 dispatches one Executor per page. Larger sites (20+ pages) benefit from sub-batching (5-page batches per Executor). Add a `--batch-size` flag handled in Phase 3.
- **Resume after crash**: `.aegis/state.json` checkpoints make resume possible. Add a `--resume` flag that reads the latest checkpoint and skips already-complete phases. The skill's HARD-CONSTRAINT block stays — even on resume, the briefing is re-validated and the references are re-loaded.
- **Custom audit-gates**: a project with industry-specific compliance (HIPAA, PCI-DSS) adds gates to `presets/<use-case>.yaml` `custom_gates:[]`. Phase 7 picks them up automatically per `aegis-quality-gates` extension-points.
