export async function POST(request, { params }) {
  const id = params.id;
  await archiveItem(id);
  return Response.json({ archived: id });
}
