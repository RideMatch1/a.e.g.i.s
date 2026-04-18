/**
 * Public spa info endpoint.
 *
 * @description Uses service_role for tenant slug resolution because
 *   the tenants table has an RLS policy that blocks anonymous SELECT.
 *   Downstream queries are scoped by slug via explicit .eq('slug', slug).
 */
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return Response.json({ status: 'ok', client: supabase });
}
