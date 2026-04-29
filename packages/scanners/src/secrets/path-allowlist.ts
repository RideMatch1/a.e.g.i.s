// v0.17.5 F5.1 — shared path-allowlist for secret-detection wrappers.
//
// Empirically (2026-04-29 dogfood-scan, 21 SaaS apps), gitleaks and
// trufflehog produce ~95% FPs on a typical Next.js + Supabase repo
// because they hit:
//   - Documentation example values (.md / .mdx with sample tokens)
//   - Lockfile-embedded URLs that look like creds
//   - i18n translation lockfiles (`i18n.lock`, `messages/*.json`)
//   - OpenAPI / Swagger DTO `@ApiProperty({ example: ... })` blocks
//   - Test fixtures, e2e tests, mocks, playwright/cypress files
//   - .env.example / .env.template / .env.sample files
//
// This module exports a single predicate `isSecretsNoisePath(file)`
// that returns true for paths matching any of the documented noise
// classes. Both `gitleaks.ts` and `trufflehog.ts` filter their
// findings through this predicate.
//
// The patterns are defensive: if a real leak somehow landed in one of
// these paths (e.g. a developer pasted a real key into a README), the
// scanner won't catch it. The trade-off is justified by the FP-storm
// reduction — corpus measurements showed ~200 noise findings per
// scan-run pre-filter, single-digit-or-zero post-filter on the same
// repos. Paranoid users who do want full coverage can opt out per-
// scanner via aegis.config.json suppression-overrides (future v0.18
// work — for v0.17.5 the allowlist ships as the hardcoded default).

const DOC_PATTERNS = [
  /\.(md|mdx|rst|adoc|txt)$/i,
  /(^|\/)(README|CHANGELOG|LICENSE|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|HISTORY|NOTICE|UPGRADING|MIGRATION)(\.[a-z]+)?$/i,
  /(^|\/)docs?\//i,
  /(^|\/)documentation\//i,
];

const LOCKFILE_PATTERNS = [
  // Common lockfile names
  /(^|\/)package-lock\.json$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)pnpm-lock\.ya?ml$/i,
  /(^|\/)bun\.lockb?$/i,
  /(^|\/)composer\.lock$/i,
  /(^|\/)Gemfile\.lock$/i,
  /(^|\/)Pipfile\.lock$/i,
  /(^|\/)poetry\.lock$/i,
  /(^|\/)Cargo\.lock$/i,
  /(^|\/)go\.sum$/i,
  /(^|\/)gradle\.lockfile$/i,
  // Generic lockfile suffix
  /\.lock$/i,
  /\.lockfile$/i,
];

const I18N_PATTERNS = [
  /(^|\/)i18n[^/]*\.(lock|json|ya?ml|po|pot)$/i,
  /(^|\/)locales?\//i,
  /(^|\/)translations?\//i,
  /(^|\/)messages\//i,
  /(^|\/)lang\//i,
];

const EXAMPLE_PATTERNS = [
  /\.example$/i,
  /\.example\.[a-z0-9]+$/i,
  /\.sample$/i,
  /\.sample\.[a-z0-9]+$/i,
  /\.template$/i,
  /\.template\.[a-z0-9]+$/i,
  /(^|\/)\.env\.example$/i,
  /(^|\/)\.env\.sample$/i,
  /(^|\/)\.env\.template$/i,
  /(^|\/)\.env\.[a-z]+\.example$/i,
  /(^|\/)\.env\.[a-z]+\.sample$/i,
  /(^|\/)examples?\//i,
  /(^|\/)samples?\//i,
];

const TEST_PATTERNS = [
  /(^|\/)tests?\//i,
  /(^|\/)testing\//i,            // workspace test-utility packages (cal.com 'packages/testing/')
  /(^|\/)__tests__\//i,
  /(^|\/)__mocks__\//i,
  /(^|\/)spec\//i,
  /(^|\/)fixtures?\//i,
  /(^|\/)mocks?\//i,
  /(^|\/)playwright\//i,
  /(^|\/)cypress\//i,
  /(^|\/)e2e\//i,
  /\.test\.[jt]sx?$/i,
  /\.spec\.[jt]sx?$/i,
  /\.e2e\.[jt]sx?$/i,
  /\.fixture\.[jt]sx?$/i,
  /\.mock\.[jt]sx?$/i,
];

const API_SPEC_PATTERNS = [
  // OpenAPI / Swagger spec files
  /(^|\/)openapi[^/]*\.(json|ya?ml)$/i,
  /(^|\/)swagger[^/]*\.(json|ya?ml)$/i,
  /\.openapi\.(json|ya?ml)$/i,
  /\.swagger\.(json|ya?ml)$/i,
  // Postman / Insomnia / Hoppscotch collection exports
  /\.postman_collection\.json$/i,
  /\.postman_environment\.json$/i,
  /\.insomnia\.(json|ya?ml)$/i,
];

const STORYBOOK_PATTERNS = [
  /\.stor(y|ies)\.[jt]sx?$/i,
  /\.stor(y|ies)\.mdx?$/i,
];

const VENDOR_PATTERNS = [
  /(^|\/)node_modules\//i,
  /(^|\/)vendor\//i,
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)\.next\//i,
  /(^|\/)out\//i,
  /(^|\/)coverage\//i,
  /(^|\/)\.turbo\//i,
  /\.min\.[jt]sx?$/i,
];

const ALL_NOISE_PATTERNS = [
  ...DOC_PATTERNS,
  ...LOCKFILE_PATTERNS,
  ...I18N_PATTERNS,
  ...EXAMPLE_PATTERNS,
  ...TEST_PATTERNS,
  ...API_SPEC_PATTERNS,
  ...STORYBOOK_PATTERNS,
  ...VENDOR_PATTERNS,
];

/**
 * Returns true if a file path is expected to contain example/test/doc
 * data rather than real secrets. Used to filter gitleaks/trufflehog
 * findings down from the corpus-wide ~95% FP rate.
 */
export function isSecretsNoisePath(filePath: string | undefined | null): boolean {
  if (!filePath) return false;
  // Normalize Windows separators for cross-platform consistency
  const normalized = filePath.replace(/\\/g, '/');
  return ALL_NOISE_PATTERNS.some((p) => p.test(normalized));
}

/** Exposed for unit-test introspection. */
export const _NOISE_PATTERN_GROUPS = {
  DOC_PATTERNS,
  LOCKFILE_PATTERNS,
  I18N_PATTERNS,
  EXAMPLE_PATTERNS,
  TEST_PATTERNS,
  API_SPEC_PATTERNS,
  STORYBOOK_PATTERNS,
  VENDOR_PATTERNS,
};
