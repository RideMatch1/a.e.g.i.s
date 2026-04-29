// Anon-key-only Edge Function: RLS protects the data, so even unauthenticated
// callers only see what RLS allows. No service-role bypass available.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

Deno.serve(async (req: Request) => {
  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.from("public_posts").select("*").limit(20);

  return new Response(JSON.stringify({ data, error }), {
    headers: { "Content-Type": "application/json" },
  });
});
