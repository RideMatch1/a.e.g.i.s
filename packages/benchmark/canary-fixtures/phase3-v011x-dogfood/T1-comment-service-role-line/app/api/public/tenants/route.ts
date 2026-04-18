import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // service_role: public endpoint, no user session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return Response.json({ status: 'ok', client: supabase });
}
