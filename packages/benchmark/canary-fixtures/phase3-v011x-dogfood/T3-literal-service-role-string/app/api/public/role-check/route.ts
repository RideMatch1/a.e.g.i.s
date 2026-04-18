import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const body = (await req.json()) as { role: string };
  const expected = 'service_role';
  if (body.role === expected) {
    return Response.json({ ok: true, client: supabase });
  }
  return Response.json({ ok: false });
}
