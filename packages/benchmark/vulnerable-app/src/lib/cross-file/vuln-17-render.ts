/**
 * VULN-17 support: cross-file XSS wrapper.
 * Exported renderer interpolates its param into an HTML template returned
 * via `new Response(...)` — CONSTRUCTOR_SINKS entry for Response (CWE-79).
 * Called from ../app/api/vuln-17-cross-file-xss/route.ts with tainted input.
 */
export function renderGreeting(name: string): Response {
  return new Response(`<h1>Hello, ${name}</h1>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
