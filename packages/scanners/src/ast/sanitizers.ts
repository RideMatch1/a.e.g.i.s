/**
 * Sanitizer definitions with per-vulnerability-class awareness.
 *
 * Some sanitizers neutralize all taint (e.g., Zod .parse() validates the entire shape).
 * Others only neutralize specific vulnerability classes:
 * - parseInt() prevents SQLi/CmdInjection (converts to number) but NOT XSS
 *   (a number can still be reflected in HTML without escaping)
 * - encodeURIComponent() prevents SSRF but NOT SQLi
 * - DOMPurify.sanitize() prevents XSS but NOT SQLi
 *
 * Explicitly excluded: JSON.parse() — does NOT sanitize.
 */

/** CWE numbers for vulnerability classes */
const CWE_SQLI = 89;
const CWE_XSS = 79;
const CWE_SSRF = 918;
const CWE_PATH_TRAVERSAL = 22;
const CWE_CMD_INJECTION = 78;
const CWE_CODE_INJECTION = 94;
const CWE_OPEN_REDIRECT = 601;
const CWE_PROTOTYPE_POLLUTION = 1321;

const ALL_CWES = [CWE_SQLI, CWE_XSS, CWE_SSRF, CWE_PATH_TRAVERSAL, CWE_CMD_INJECTION, CWE_CODE_INJECTION, CWE_OPEN_REDIRECT, CWE_PROTOTYPE_POLLUTION];

export interface SanitizerDef {
  name: string;
  /** CWE numbers this sanitizer neutralizes. Empty = neutralizes ALL. */
  neutralizes: number[];
}

export const TAINT_SANITIZER_DEFS: SanitizerDef[] = [
  // Type coercion — prevents injection via type conversion, but String() is pass-through for XSS
  { name: 'parseInt', neutralizes: [CWE_SQLI, CWE_CMD_INJECTION, CWE_SSRF, CWE_PATH_TRAVERSAL] },
  { name: 'parseFloat', neutralizes: [CWE_SQLI, CWE_CMD_INJECTION, CWE_SSRF, CWE_PATH_TRAVERSAL] },
  { name: 'Number', neutralizes: [CWE_SQLI, CWE_CMD_INJECTION, CWE_SSRF, CWE_PATH_TRAVERSAL] },
  { name: 'Boolean', neutralizes: ALL_CWES },
  { name: 'BigInt', neutralizes: [CWE_SQLI, CWE_CMD_INJECTION, CWE_SSRF, CWE_PATH_TRAVERSAL] },

  // Encoding — prevents URL-based attacks
  { name: 'encodeURIComponent', neutralizes: [CWE_SSRF, CWE_XSS, CWE_PATH_TRAVERSAL] },
  { name: 'encodeURI', neutralizes: [CWE_SSRF, CWE_PATH_TRAVERSAL] },

  // HTML sanitization — prevents XSS only
  { name: 'DOMPurify.sanitize', neutralizes: [CWE_XSS] },
  { name: 'sanitizeHtml', neutralizes: [CWE_XSS] },
  { name: 'escapeHtml', neutralizes: [CWE_XSS] },
  { name: 'escape', neutralizes: [CWE_XSS] },
  { name: 'he.encode', neutralizes: [CWE_XSS] },

  // Schema validation — validates entire shape, neutralizes all
  // IMPORTANT: PARSE_NOT_SANITIZER blocklist (checked first in isSanitizer/sanitizesForCwe)
  // prevents URL.parse(), qs.parse(), cookie.parse() etc. from matching.
  { name: 'parse', neutralizes: ALL_CWES },
  { name: 'safeParse', neutralizes: ALL_CWES },

  // SQL parameterization
  { name: 'Prisma.sql', neutralizes: [CWE_SQLI] },
  { name: 'sql', neutralizes: [CWE_SQLI] },

  // UUID validation — validates format, prevents all injection
  { name: 'isValidUUID', neutralizes: ALL_CWES },

  // Path sanitization
  { name: 'path.normalize', neutralizes: [CWE_PATH_TRAVERSAL] },
  { name: 'path.resolve', neutralizes: [CWE_PATH_TRAVERSAL] },
  { name: 'path.basename', neutralizes: [CWE_PATH_TRAVERSAL] },

  // String sanitization
  { name: 'validator.escape', neutralizes: [CWE_XSS] },
  { name: 'xss', neutralizes: [CWE_XSS] },
];

/**
 * Flat list of sanitizer names.
 * NOTE: Getter-based so it reflects runtime mutations from custom rules.
 */
export function getAllSanitizerNames(): string[] {
  return TAINT_SANITIZER_DEFS.map((d) => d.name);
}

/**
 * @deprecated — use `getAllSanitizerNames()` instead (stale after custom rules apply).
 * Kept for backward compatibility; reflects only built-in sanitizers.
 */
export const TAINT_SANITIZERS: string[] = TAINT_SANITIZER_DEFS.map((d) => d.name);

/** Known non-sanitizer .parse() methods that propagate taint */
export const PARSE_NOT_SANITIZER = new Set([
  'JSON.parse', 'JSON5.parse', 'URL.parse',
  'querystring.parse', 'qs.parse', 'cookie.parse',
  'path.parse', 'url.parse', 'csv.parse',
  // v0.8 Phase 6: Date.parse returns a number (timestamp) or NaN, not a
  // safe-validated string. Does not neutralize SQLi / CmdInjection / SSRF
  // because the raw string flows through when the result is unused.
  'Date.parse',
]);

/**
 * Check if a function call name matches a known sanitizer (any vuln class).
 */
export function isSanitizer(callName: string): boolean {
  if (PARSE_NOT_SANITIZER.has(callName)) return false;
  return TAINT_SANITIZER_DEFS.some(
    (d) => callName === d.name || callName.endsWith('.' + d.name),
  );
}

/**
 * Check if a sanitizer neutralizes a specific CWE.
 * Returns true if the sanitizer exists AND neutralizes the given CWE.
 * Returns false if the sanitizer doesn't exist or doesn't cover this CWE.
 */
export function sanitizesForCwe(callName: string, cwe: number): boolean {
  if (PARSE_NOT_SANITIZER.has(callName)) return false;
  const def = TAINT_SANITIZER_DEFS.find(
    (d) => callName === d.name || callName.endsWith('.' + d.name),
  );
  if (!def) return false;
  return def.neutralizes.includes(cwe);
}
