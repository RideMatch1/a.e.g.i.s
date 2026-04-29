// Sanitized from real 2026-04-29 dogfood-scan TP (supabase-vector-gmailkb-rag
// supabase/functions/crawl_links.ts). Service-role-key + no auth check =
// anyone with the function URL gets full RLS bypass.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req: Request) => {
  try {
    const { max_links = 50 } = await req.json();
    const { data, error } = await supabase
      .from("emails")
      .select("email_id, links")
      .limit(max_links);

    if (error) throw error;
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
