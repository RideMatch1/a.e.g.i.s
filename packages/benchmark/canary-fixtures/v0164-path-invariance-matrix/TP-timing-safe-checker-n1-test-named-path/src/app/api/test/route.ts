// Route at N1-class path. Scanner must flag the token-comparison pattern.
export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const token = body.token as string;
  const secret = process.env.API_SECRET as string;
  if (token === secret) {
    return new Response('ok', { status: 200 });
  }
  return new Response('nope', { status: 401 });
}
