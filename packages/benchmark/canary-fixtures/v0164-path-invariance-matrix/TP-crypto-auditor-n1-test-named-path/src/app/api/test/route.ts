// Route at N1-class path. Scanner must flag the dynamic-evaluation pattern.
export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const result = eval(body.code);
  return new Response(String(result));
}
