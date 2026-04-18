import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const body = (await req.json()) as { slug: string };
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', body.slug)
    .single();
  return Response.json(data);
}
