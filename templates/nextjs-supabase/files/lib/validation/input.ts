// templates/nextjs-supabase/files/lib/validation/input.ts

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strict UUID check. Accepts any RFC-4122 variant; case-insensitive. */
export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Strip control chars (0x00-0x1F, 0x7F), trim whitespace, enforce a
 * maximum length. Use at the edge — request-body fields, query params,
 * user-supplied identifiers — before the value reaches business logic.
 * Does NOT encode HTML (that is a rendering concern — escape on output).
 */
export function sanitizeString(
  input: string,
  opts: { maxLength?: number } = {},
): string {
  const stripped = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return opts.maxLength !== undefined ? stripped.slice(0, opts.maxLength) : stripped;
}

/**
 * Escape PostgREST LIKE / ILIKE metacharacters so a user-supplied
 * search term is treated as a literal. PostgREST treats `%`, `_`, and
 * `\` specially — unescaped input enables pattern-match abuse (e.g.
 * `%` as a wildcard matching every row).
 */
export function escapePostgrestLike(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
