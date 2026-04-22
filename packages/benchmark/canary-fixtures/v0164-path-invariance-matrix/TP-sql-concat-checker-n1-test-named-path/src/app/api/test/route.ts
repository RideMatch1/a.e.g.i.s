// Route at N1-class path. Scanner must flag the query-concatenation pattern.
export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const supabase = (globalThis as any).supabase;
  const sql = "SELECT * FROM users WHERE id = " + body.id;
  const { data } = await supabase.rpc('exec_raw', { sql });
  return new Response(JSON.stringify(data));
}
