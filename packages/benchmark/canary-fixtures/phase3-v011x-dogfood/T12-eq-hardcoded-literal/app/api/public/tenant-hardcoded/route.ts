import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', 'production')
    .single();
  return Response.json(data);
}
