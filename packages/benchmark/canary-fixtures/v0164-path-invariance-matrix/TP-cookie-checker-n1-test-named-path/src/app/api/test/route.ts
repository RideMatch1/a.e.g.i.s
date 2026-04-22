// Legitimate Next.js App Router route at app/api/test/route.ts. Sets a
// cookie WITHOUT Secure/HttpOnly/SameSite — cookie-checker must flag.
export async function GET(): Promise<Response> {
  const response = new Response('ok');
  response.headers.set('Set-Cookie', 'session=abc123');
  return response;
}
