// Reference-implementation extract — generic Next.js+Supabase primitive.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for Server Components, Route Handlers,
 * and Server Actions. Uses the ANON key so RLS policies apply. For
 * service_role usage (RLS-bypass for public / webhook routes) create
 * a dedicated admin client in lib/supabase/admin.ts — not shipped by
 * this scaffold; add when you hit a legitimate cross-tenant use-case.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // read-only cookies inside Server Components — safe to ignore
          }
        },
      },
    },
  );
}
