# Path-Invariance Test-Contract

AEGIS scanners classify source files as "test" or "non-test" via the canonical `isTestFile()` helper exported from `@aegis-scan/core` (`packages/core/src/is-test-path.ts`). The classifier's semantic is load-bearing: every scanner that walks the project tree filters its input through `isTestFile()` to avoid flagging intentional test-fixtures.

The **path-invariance contract** is the test-level guarantee that every scanner correctly applies this classifier — both positively (skipping real test-files) and negatively (scanning legitimate source files whose paths happen to contain ambiguous substrings).

## Why the contract exists

Pre-v0.16.3, nineteen of the shipped scanners copy-pasted a local skip-predicate that matched `filePath.includes('/test/')` or `filePath.includes('/tests/')`. The substring-match silently skipped any file whose path contained either segment — including legitimate Next.js App Router routes like `app/api/test/route.ts` and helper modules like `src/testing/utils.ts`.

Empirical reproduction from the D-CA-001 audit (2026-04-21): identical vulnerable source at `/test/route.ts` scanned clean while the same source at `/vuln/route.ts` produced six findings. The pattern-invariance under a filepath rename was broken — the scanner was producing different answers for the same question depending on where the file lived.

v0.16.3 closed D-CA-001 by centralizing the classifier into `isTestFile()` and dropping the ambiguous substring matches. The contract documented here prevents the regression from returning by requiring a per-scanner test-proof that the classifier is applied correctly.

## The classifier — positive match classes

`isTestFile(filePath)` returns `true` for the following path-classes (and only these):

| Class | Pattern | Example |
|---|---|---|
| P1 | `.(test\|spec\|e2e).(ts\|tsx\|js\|jsx\|mjs\|cjs)$` extension | `foo.test.ts`, `bar.spec.tsx`, `flow.e2e.ts` |
| P2 | `[/\\]__tests__[/\\]` directory segment | `src/__tests__/util.ts` |
| P3 | `[/\\]__mocks__[/\\]` directory segment | `__mocks__/api.ts` |
| P4 | `[/\\]playwright[/\\]` directory segment | `apps/web/playwright/login.ts` |
| P5 | `[/\\]cypress[/\\]` directory segment | `cypress/e2e/home.ts` |
| P6 | `[/\\]e2e[/\\]` directory segment | `e2e/checkout.ts` |

## The classifier — negative boundary class

`isTestFile(filePath)` returns `false` for paths that contain `/test/` or `/tests/` only as a **substring** without matching any of P1–P6. Legitimate routes and helper modules fall in this class:

| Class | Pattern | Example |
|---|---|---|
| N1 | `/test/` or `/tests/` substring that is not also P1–P6 | `src/app/api/test/route.ts`, `src/testing/utils.ts`, `src/pages/tests/index.ts` |

The canonical helper [deliberately drops](../../packages/core/src/is-test-path.ts) the ambiguous substring match. Operators who want their own `test/` directory skipped can declare it in `aegis.config.json` under `ignore` (the project-level ignore-list unions with the default).

## Contract — per scanner

Every scanner that consumes `isTestFile()` ships three artefacts alongside its detection logic:

### 1. TP canary fixture (N1-class)

A file under `packages/benchmark/canary-fixtures/<phase>/TP-<scanner>-n1-test-named-path/` containing:

- `expected.json` declaring `{ scanner, cwe, type: "TP", expected: [{ scanner, cwe }] }`.
- `package.json` marking the fixture as a private scratch project.
- The scanner's target vulnerability in a file whose path contains `/test/` as a segment (typically `src/app/api/test/route.ts`).

The canary runner invokes the scanner orchestrator against the fixture directory and asserts that a finding matching `scanner` + `cwe` is emitted. This proves the scanner still reaches legitimate routes whose paths contain the `/test/` substring.

### 2. FP canary fixture (P1-class)

A file under `packages/benchmark/canary-fixtures/<phase>/FP-<scanner>-p1-dot-test-file/` containing:

- `expected.json` declaring `{ scanner, cwe, type: "FP", expected: [{ scanner, cwe }] }`.
- `package.json` marking the fixture as a private scratch project.
- The same vulnerable pattern in a file whose basename has `.test.ts` extension (typically `src/foo.test.ts`).

The canary runner asserts that the scanner does NOT emit `scanner` + `cwe` on this fixture. This proves the scanner correctly skips real test-files via the extension-match.

### 3. Describe-block unit-test

A sibling-level `describe` block appended to the scanner's existing test-file:

```ts
describe('<Scanner>Scanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;
  beforeEach(() => { projectPath = makeTempProject(); });

  it('N1-class: flags <pattern> under /api/test/ route path', async () => {
    mkdirSync(join(projectPath, 'src/app/api/test'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/api/test/route.ts'), VULN_CONTENT);
    const result = await <Scanner>Scanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === '<name>' && f.cwe === <CWE>).length).toBeGreaterThan(0);
  });

  it('P1-class: skips <pattern> in *.test.ts basename', async () => {
    mkdirSync(join(projectPath, 'src'), { recursive: true });
    writeFileSync(join(projectPath, 'src/foo.test.ts'), VULN_CONTENT);
    const result = await <Scanner>Scanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === '<name>')).toHaveLength(0);
  });
});
```

The canary fixtures prove the contract against the shipped binary via the orchestrator path; the describe-block proves it at the scanner-unit level during `pnpm test`.

## Strong-FP vs vacuous-FP

A **strong-FP** is one where the fixture file would be scanned by the scanner if its basename were different — the FP exercises the `isTestFile()` skip-path specifically.

A **vacuous-FP** is one where the scanner would not scan the file even if it were not a test-file, typically because the scanner has its own basename filter that rejects `foo.test.ts` before the classifier is consulted. Examples from the v0164 arc:

- `cors-checker` filters to basename `route.ts` / `middleware.ts` / `next.config.*` — `foo.test.ts` is not a scanner target, so the FP passes vacuously.
- `timing-safe-checker` filters to basename `route.ts` / `route.js` inside `src/app/api` — same reason.
- `tenant-isolation-checker` uses basename regex `/route\.(ts|js)$/` — same reason.

Vacuous-FPs are acceptable per this contract. The canary still exercises the "scanner does not emit on test-files" assertion; it just does so at a path the scanner rejects earlier in its pipeline. The fixture `expected.json` should document the vacuous nature in its `description` field for future-auditor clarity.

Strong-FPs are preferred where the scanner's path-filter permits them. The v0164 `http-timeout-checker` and `path-traversal-checker` fixtures use `src/api/foo.test.ts` specifically because those scanners walk the `api/` and `lib/` directories recursively — a `.test.ts` file inside the target directory exercises the `isTestFile()` skip-path rather than the directory-filter.

## Preventive class-lessons

Three classes of mid-batch issue surfaced during the v0164 arc and are enumerated in [`CONTRIBUTING.md`](../../CONTRIBUTING.md#discipline--preventive-against-known-class-lessons). Apply the preventive-check before authoring fixtures and unit-tests:

1. **Comment-pollution.** Fixture comments must not mention scanner-trigger-keywords that the scanner's proximity-check regex looks for.
2. **Scanner-bimodal behavior.** Check the scanner source for threshold-based aggregate-vs-per-file branching before choosing a fixture scope.
3. **Regex-boundary on fixture content.** Check the scanner source for negated character-classes that may terminate before the vulnerable sub-expression.

## References

- [`packages/core/src/is-test-path.ts`](../../packages/core/src/is-test-path.ts) — canonical classifier source.
- [`packages/benchmark/canary-fixtures/v0163-test-path-semantic-skip/`](../../packages/benchmark/canary-fixtures/v0163-test-path-semantic-skip/) — helper-level canaries covering the P1–P6 positive-match classes and the N1 negative-boundary.
- [`packages/benchmark/canary-fixtures/v0164-path-invariance-matrix/`](../../packages/benchmark/canary-fixtures/v0164-path-invariance-matrix/) — per-scanner canaries. 40 fixtures (20 TP + 20 FP) covering all isTestFile consumers.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md#scanner-author-checklist) — scanner-author checklist linking back to this contract.
