export async function POST(request) {
  const userId = request.headers.get('x-user-id');
  return Response.json({ marked: true });
}
