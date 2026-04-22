// Legitimate Next.js App Router route at app/api/test/route.ts. Calls
// supabase.rpc() without an RLS-aware comment — rls-bypass-checker
// must flag RLS / CWE-863 (severity=info per v0.14 generic-rpc downgrade).
export async function fetchStats(supabase: any): Promise<unknown> {
  const { data } = await supabase.rpc('get_dashboard_stats');
  return data;
}

export async function GET(): Promise<Response> {
  return new Response('ok', { status: 200 });
}
