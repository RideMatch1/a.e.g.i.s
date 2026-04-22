// Route at N1-class path. Scanner must flag the template-interpolated query.
export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const supabase = (globalThis as any).supabase;
  const { data } = await supabase.rpc('exec_raw', {
    sql: `SELECT * FROM users WHERE id = '${body.id}'`,
  });
  return new Response(JSON.stringify(data));
}
