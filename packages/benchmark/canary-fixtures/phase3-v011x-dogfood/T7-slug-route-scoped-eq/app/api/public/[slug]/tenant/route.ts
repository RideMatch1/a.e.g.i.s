import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();
  return Response.json(data);
}
