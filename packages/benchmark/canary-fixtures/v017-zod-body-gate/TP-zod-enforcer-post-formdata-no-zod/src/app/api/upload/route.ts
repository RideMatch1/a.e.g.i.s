export async function POST(request) {
  const fd = await request.formData();
  return Response.json({ ok: true });
}
