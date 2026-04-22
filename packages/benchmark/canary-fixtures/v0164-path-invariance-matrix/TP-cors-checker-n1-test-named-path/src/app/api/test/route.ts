// Route at N1-class path. Scanner must flag the response-header pattern.
export async function GET(): Promise<Response> {
  return new Response('ok', {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
