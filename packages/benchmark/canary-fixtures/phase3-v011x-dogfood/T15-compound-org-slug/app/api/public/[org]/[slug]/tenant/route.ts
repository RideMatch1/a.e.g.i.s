import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; slug: string }> },
) {
  const { org, slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('org_slug', org)
    .eq('slug', slug)
    .single();
  return Response.json(data);
}
