/**
 * Canonical test-file detection — returns true only for files that are
 * unambiguously part of the test/mock/e2e infrastructure, so scanners
 * can skip them without masking real vulnerabilities in legitimate
 * production code.
 *
 * The predicate deliberately distinguishes between unambiguous
 * test-framework conventions (which are safe to use as substring
 * matches) and the ambiguous path substrings `/test/` and `/tests/`
 * (which are NOT safe — `app/api/test/route.ts` is a legitimate
 * Next.js App Router route-handler, not a test file).
 *
 * v0.16.3 D-CA-001 (2026-04-21) — Round-7 comprehensive-audit surfaced
 * a systemic silent-skip class: 19 scanner files used
 * `filePath.includes('/test/') || filePath.includes('/tests/')` as
 * substring-match in their local isTestFile/shouldSkipFile helpers,
 * silently skipping every file whose path contained either segment
 * anywhere. Empirical RED-reproduction: identical source code under
 * `src/app/api/test/route.ts` got 0 findings while the same source
 * under `src/app/api/vuln/route.ts` got 6 findings — jwt-detector,
 * taint-analyzer, tenant-isolation-checker, sql-concat-checker, and
 * every other scanner silently no-oped on the `/test/` path. This
 * helper closes that class by dropping the substring-match and keeping
 * only the unambiguous conventions.
 *
 * Matches (returns true):
 *   - `.test.{ts,tsx,js,jsx,mjs,cjs}` file-name extension
 *   - `.spec.{ts,tsx,js,jsx,mjs,cjs}` file-name extension
 *   - `.e2e.{ts,tsx,js,jsx,mjs,cjs}` file-name extension
 *   - `__tests__/` directory segment anywhere in the path
 *   - `__mocks__/` directory segment anywhere in the path
 *   - `playwright/` directory segment (v0.6.1 console-checker extension)
 *   - `cypress/` directory segment (v0.6.1 console-checker extension)
 *   - `e2e/` directory segment (v0.6.1 console-checker extension)
 *
 * Does NOT match (returns false):
 *   - `app/api/test/route.ts` — legitimate Next.js route named "test"
 *   - `src/testing/utils.ts` — non-test utility with "test" in a dir-name
 *   - `src/components/TestButton.tsx` — legitimate component
 *   - `tests/helpers.ts` at top-level — no `.test.` extension and no
 *     `__tests__/` segment, so we defer to the scanner-specific
 *     judgment rather than silent-skip
 *
 * Path separators are normalized so the predicate works on both POSIX
 * (`/`) and Windows (`\`) paths.
 */
export function isTestFile(filePath: string): boolean {
  // (1) Proper test-file extensions — `.test.ts`, `.spec.ts`, `.e2e.ts`, etc.
  if (/\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) return true;

  // (2) Unambiguous test-framework directory conventions as path segments.
  //     `[\/\\]<name>[\/\\]` ensures we match a directory segment rather
  //     than a substring of a filename or a longer directory name.
  if (/[\/\\]__tests__[\/\\]/.test(filePath)) return true;
  if (/[\/\\]__mocks__[\/\\]/.test(filePath)) return true;

  // (3) E2E-framework directory conventions (v0.6.1 console-checker
  //     extension — dogfood on cal-com and dub found 44 of 46
  //     console-checker FPs in `apps/web/playwright/**` with unit-test-
  //     conventions-only matching; keeping these as unambiguous skips
  //     preserves that trade-off).
  if (/[\/\\]playwright[\/\\]/.test(filePath)) return true;
  if (/[\/\\]cypress[\/\\]/.test(filePath)) return true;
  if (/[\/\\]e2e[\/\\]/.test(filePath)) return true;

  // Deliberately NOT `/test/` or `/tests/` substring — legitimate
  // routes/directories (app/api/test/route.ts, src/testing/utils.ts,
  // …) must be scanned. D-CA-001 fix (2026-04-21).
  return false;
}
