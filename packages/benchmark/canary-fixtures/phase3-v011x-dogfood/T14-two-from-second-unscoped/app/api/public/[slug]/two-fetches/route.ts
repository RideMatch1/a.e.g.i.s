import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();
  const { data: treatments } = await supabase
    .from('treatments')
    .select('*');
  return Response.json({ tenant, treatments });
}
