/**
 * Greeting Page — GET /api/vuln-03-xss
 *
 * Returns a personalised HTML greeting using the name query parameter.
 * Used by the onboarding flow to render a welcome snippet inline.
 */
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');

  if (!name) {
    return new Response('<h1>Hello, Guest</h1>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // VULNERABLE: unsanitised query param interpolated into HTML response
  const html = `<!DOCTYPE html>
<html>
  <head><title>Welcome</title></head>
  <body>
    <h1>Hello, ${name}</h1>
    <p>Welcome to the spa management portal.</p>
  </body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
