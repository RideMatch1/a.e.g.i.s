import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*');
  return Response.json(data);
}
