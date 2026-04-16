/**
 * Taint sources — expressions that introduce user-controlled input.
 * Each entry is a dot-separated property path prefix.
 *
 * Explicitly excluded: process.env (deploy-time config, not user input).
 */
export const TAINT_SOURCES: string[] = [
  // Express / Node.js
  'req.body', 'req.query', 'req.params', 'req.headers',
  // Next.js / Web API
  'request.body', 'request.query', 'request.headers',
  'request.nextUrl.searchParams', 'searchParams.get',
  'request.json', 'request.text', 'request.formData',
  // Browser
  'document.location', 'window.location', 'location.search',
  'location.hash', 'document.referrer',
  // URL parsing
  'url.searchParams',
];

/**
 * Check if an expression text matches a taint source.
 * Matches both prefix AND suffix — handles chained access like
 * `request.nextUrl.searchParams.get('name')` matching `searchParams.get`.
 */
export function isSourceExpression(text: string): boolean {
  return TAINT_SOURCES.some((source) => {
    // Prefix match: "req.body" matches "req.body.id"
    if (text === source || text.startsWith(source + '.') || text.startsWith(source + '(')) {
      return true;
    }
    // Suffix match: "request.nextUrl.searchParams.get" matches "searchParams.get"
    // NOTE: Do NOT match endsWith(source + ')') — that catches function args like schema.parse(req.body)
    if (text.endsWith(source) ||
        text.includes('.' + source + '.') || text.includes('.' + source + '(')) {
      return true;
    }
    return false;
  });
}
