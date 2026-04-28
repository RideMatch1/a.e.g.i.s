<!-- aegis-local: AEGIS-native skill, MIT-licensed; generic feature-dev workflow for AEGIS-bootstrapped repos. DB-migration -> API-route -> Service-Layer -> UI-Component -> Tests -> Optimistic-Updates with TDD-first discipline per spec hard-NICHTs. Single-file skill (no references), since the workflow generalises across stacks. -->
---
name: aegis-module-builder
description: Generic feature-dev workflow for AEGIS-bootstrapped repos. Six-phase pipeline - Plan / Test (red) / Implement (green) / Verify (gates 1-4) / Optimistic-update / Commit. TDD-first per spec hard-NICHTs (test before impl, no mocks, follow superpowers test-driven-development). Wraps DB-migrations, API-routes (secureApiRoute + Zod-strict + requireRole), service-layer extraction, UI-components, tests, optimistic-updates. Trigger keywords - module, feature, db-migration, api-route, refactor, neue funktion, neue api, neues modul.
model: sonnet
license: MIT
metadata:
  required_tools: "shell-ops,file-ops,task-tracking"
  required_audit_passes: "1"
  enforced_quality_gates: "4"
  pre_done_audit: "true"
---

# aegis-module-builder — Generic Feature-Dev Workflow

The Foundation's TDD-first feature-dev skill. Wraps the canonical "DB-migration → API-route → Service-Layer → UI-Component → Tests → Optimistic-Update" pipeline with explicit Plan / Red / Green / Verify / Polish / Commit phases. Used for every non-customer-build dev task in an AEGIS-bootstrapped repo.

---

## HARD-CONSTRAINT — TDD-First, No Bypasses

This skill MUST follow the TDD-first discipline:

1. **Test before implementation, every time.** Phase 2 writes the failing test first. Phase 3 implements just enough code to make it green. No skipping Phase 2 "because I know what the code should look like".
2. **No mocks for external dependencies that will be hit in production.** If the feature uses a database, the test uses a real (test-instance) database — not a mock. If the feature calls an external API, the test uses a recorded fixture (VCR-style) — not a hand-written mock that drifts from reality.
3. **No `--no-verify` on commits.** Husky pre-commit runs `aegis-quality-gates --quick` (gates 1-4: build/tsc/lint/tests). Bypassing means the next commit pulls in a broken build. If a hook is firing falsely, fix the hook, don't bypass.
4. **No "I'll add the test later" commits.** Either the test exists and passes, or the commit doesn't happen.
5. **Pre-existing-tests stay green.** Running existing tests before starting + after each phase catches regressions early. If existing tests fail before any change — the workspace is broken; investigate before adding new code.
6. **Reference `superpowers:test-driven-development`** for the TDD-mechanics (red-green-refactor cycle, test-shape patterns, when-to-skip-test escape-hatches). This skill is the AEGIS-foundation flavor of that pattern.

If TDD-discipline can't be followed for a specific change (e.g., a one-line typo fix, a config file edit) — explicit `--no-tdd` flag with rationale documented in the commit message. Don't silent-skip.

---

## Mission

Replace the failure-mode where "feature-dev" means "write code, hope it works, commit, see it break in CI" with a disciplined pipeline that catches regressions before commit. Be the canonical workflow for every non-customer-build dev task — DB-migration, API-route, service-extraction, UI-feature, refactor, bugfix.

**Quality bar:** every commit from this skill leaves the build green per gates 1-4 (build / tsc / lint / tests). No exceptions.

---

## Triggers

### Slash-commands

- `/module` — start a module-build for a new feature
- `/feature` — alias
- `/refactor` — start a refactor with TDD-coverage

### Auto-trigger keywords

- module, feature, db-migration, api-route, refactor, neue funktion, neue api, neues modul, optimistic update

### Required-input

The skill needs a feature-spec. If invoked without one, ask:

```
What does this feature do?
- User-story (1-2 sentences)
- Inputs (request shape, params, files)
- Outputs (response shape, side-effects)
- Acceptance-criteria (3-5 bullet points)
```

Don't infer from chat-context. Demand the spec.

---

## Process

| # | Phase | Time | Output |
|---|---|---|---|
| 1 | Plan | ~10 min | feature-spec.md + checklist |
| 2 | Test (red) | ~15-30 min | failing test that asserts the feature |
| 3 | Implement (green) | ~30-90 min | code that makes test pass |
| 4 | Verify (gates 1-4) | ~5 min | all 4 gates green per `aegis-quality-gates --quick` |
| 5 | Polish (optimistic-updates, edge-cases) | ~15-30 min | edge-case tests + UI polish |
| 6 | Commit | ~5 min | atomic commit with conventional-commits message |

### Phase 1: Plan

Read the feature-spec. Decompose into testable units:

- **DB layer**: any new tables / columns / indexes? Write migration first.
- **API layer**: new endpoint? List inputs/outputs/auth-requirements.
- **Service layer**: business-logic that lives between API and DB? Extract to a pure function.
- **UI layer**: components that render the feature? Sketch component-tree.

Write a `<feature>-spec.md` (or update an existing planning-doc) with:

```markdown
# Feature: <name>

## User-story
<1-2 sentences>

## Acceptance criteria
- [ ] AC1
- [ ] AC2
- [ ] AC3

## Decomposition
- DB: <new-table or "none">
- API: <route + method + auth>
- Service: <function-signature>
- UI: <component-tree>

## Test plan
- Unit: <list>
- Integration: <list>
- E2E: <list>
```

### Phase 2: Test (red)

For each layer (DB / API / Service / UI), write the failing test FIRST:

```ts
// __tests__/<feature>/api.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/<endpoint>/route';

describe('POST /api/<endpoint>', () => {
  it('returns 200 with valid input', async () => {
    const req = new Request('http://localhost/api/<endpoint>', {
      method: 'POST',
      body: JSON.stringify({ /* valid input */ }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ /* expected shape */ });
  });
  
  it('returns 400 on invalid input', async () => { /* ... */ });
  it('returns 401 when unauthenticated', async () => { /* ... */ });
  it('returns 429 after rate-limit', async () => { /* ... */ });
});
```

Run the test — it MUST fail (red). If it passes accidentally — the test isn't testing the right thing; rewrite it.

### Phase 3: Implement (green)

For each test, write the minimum code to make it pass:

- DB-migration: `pnpm db:migrate:create <feature>` + write the migration
- API-route: `app/api/<endpoint>/route.ts` with `secureApiRoute` wrapper
- Service-layer: pure function in `lib/services/<feature>.ts`
- UI-component: `components/<feature>/<Component>.tsx`

After each layer: run that layer's tests. They MUST go green. If they don't — fix the implementation, not the test (unless the test's expectation was wrong, which is rare).

### Phase 4: Verify (gates 1-4)

Run `aegis-quality-gates --quick`:

```bash
npx -y @aegis-scan/cli foundation verify --quick
# OR (if foundation CLI not installed yet):
pnpm run build && tsc --noEmit && pnpm run lint && pnpm test
```

All 4 must pass:

| Gate | Threshold |
|---|---|
| build | exit 0 |
| tsc | 0 errors |
| lint | 0 errors |
| tests | 100% pass (no regression in existing tests) |

If any red — fix before Phase 5. Don't proceed with red gates.

### Phase 5: Polish

Add edge-case tests + UI polish:

- **Optimistic-updates** (UI): if the feature mutates state, render the change immediately with a rollback if the API fails. Use TanStack Query / SWR mutation patterns or React useOptimistic.
- **Loading + error states** (UI): every async-data UI needs both states tested.
- **Empty-states** (UI): no data → friendly empty-state, not a blank panel.
- **Accessibility**: keyboard-navigation, aria-labels, focus-management.
- **Edge-cases** (logic): null inputs, max-length inputs, concurrent submissions.

Add tests for each polish-item. They start as red (because the polish isn't there), then green.

### Phase 6: Commit

Atomic commit per logical unit. Conventional Commits format:

```
feat(api): add /api/<endpoint> with rate-limit + Zod validation

- Migration: 0042_add_<feature>_table.sql
- API-route: secureApiRoute + Zod-strict
- Service-layer: <feature>Service.create(input)
- UI: <Component> with optimistic update
- Tests: 4 unit + 2 integration

AC1: ✓ AC2: ✓ AC3: ✓ (per spec)
```

If the feature is large, split into multiple atomic commits per layer (1 for migration, 1 for API, 1 for service, 1 for UI). Each commit individually passes gates 1-4.

---

## Verification / Success Criteria

Before declaring the module complete:

- [ ] `<feature>-spec.md` written + acceptance-criteria checked
- [ ] Phase 2 tests are present + were red before Phase 3
- [ ] Phase 3 implementation makes Phase 2 tests green
- [ ] Phase 4 gates 1-4 all pass via `aegis-quality-gates --quick`
- [ ] Phase 5 polish-items addressed (optimistic / loading / error / empty / a11y / edge)
- [ ] Phase 6 atomic commit(s) follow Conventional-Commits format
- [ ] No mocks for production-relevant deps (real DB, recorded fixtures for external APIs)
- [ ] Existing tests still green (no regression)

If any unmet → not done. Report the open item explicitly.

---

## Anti-Patterns

- ❌ Skipping Phase 2 (writing implementation first) — that's not TDD; that's hope-driven-development.
- ❌ "I'll write the tests after, the implementation is simple enough" — every implementation is simple until the regression hits.
- ❌ Mocking the database in tests — drift from production behavior; use a real (test-instance) DB.
- ❌ Mocking external APIs with hand-written stubs — drift; use VCR-style recorded fixtures.
- ❌ `git commit --no-verify` to bypass husky — fix the hook, don't bypass.
- ❌ Committing with red gates 1-4 — every commit leaves the build green.
- ❌ Skipping rate-limit on a new API-route — `secureApiRoute` wrapper is mandatory.
- ❌ Skipping Zod-validation — every API-route validates input shape.
- ❌ One giant commit covering DB + API + service + UI — split into atomic commits per layer.
- ❌ Polish-items in Phase 5 added without tests — every polish-item gets a regression-test.
- ❌ Inferring `requireRole` for a new endpoint without confirming with the spec — auth is explicit, never inferred.

---

## Extension Points

- **Different framework adapters**: Next.js (App Router) is the canonical default. Remix / SvelteKit / Astro extensions add framework-specific test-templates + route-templates. Phase 1-6 stay the same; only the file-paths + test-shapes vary per adapter.
- **Different DB layers**: Drizzle / Prisma / Supabase all work; the migration-step in Phase 1 + 3 reads the project's DB-layer-config and uses the right tooling.
- **Different test-runners**: Vitest is canonical. Jest / Bun-test / Deno-test extensions wrap their respective CLIs. The Verify-gate (Phase 4) reads the project's test-config and dispatches.
- **Per-project quality-gate-overrides**: a starter project might set lint-threshold to "warnings allowed". Override in `aegis.config.json` `gates.<gate>.threshold`. Don't override here.
- **TDD-skip escape-hatch**: for genuine 1-line fixes (typo, config), `--no-tdd` flag bypasses Phase 2 + 3 if Phase 6 commit-message documents the rationale (e.g., `chore: fix typo in /datenschutz heading [skip-tdd: 1-line text-fix]`). Use sparingly.
- **Multi-package monorepos**: each package gets its own pipeline. Phase 6 commits are scoped to the package via `pnpm --filter <pkg> <cmd>` or `nx affected`.
- **Refactor-mode**: a refactor that moves code without changing behavior runs Phase 2 first to capture current behavior in tests, then refactors with the test as a regression-guard.
- **Bugfix-mode**: write the failing test that reproduces the bug FIRST (Phase 2), then fix (Phase 3). The test becomes a permanent regression-test.
