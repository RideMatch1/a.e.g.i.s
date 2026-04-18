import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  return Response.json({ ok: true, client: supabase });
}
