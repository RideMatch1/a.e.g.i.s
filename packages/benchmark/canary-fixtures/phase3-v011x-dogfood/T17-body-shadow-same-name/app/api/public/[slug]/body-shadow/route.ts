import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  req: Request,
  _ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = (await req.json()) as { slug: string };
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();
  return Response.json(data);
}
