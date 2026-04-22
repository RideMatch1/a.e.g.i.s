export async function POST(request) {
  const raw = await request.text();
  return Response.json({ ok: true });
}
