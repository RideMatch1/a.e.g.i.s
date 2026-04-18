import { createAdminSupabaseClient } from '@/lib/supabase/admin';

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const normalized = normalize(slug);
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', normalized)
    .single();
  return Response.json(data);
}
