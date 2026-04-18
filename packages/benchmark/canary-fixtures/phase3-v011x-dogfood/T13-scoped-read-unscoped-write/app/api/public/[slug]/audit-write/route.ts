import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = (await req.json()) as { action: string };
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();
  await supabase
    .from('audit_log')
    .insert({ tenant_id: data?.id, action: body.action });
  return Response.json({ ok: true });
}
