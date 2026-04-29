// Safe pattern: verify caller's JWT via auth.getUser(req.headers.Authorization)
// BEFORE any service-role DB call.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req: Request) => {
  // Extract user from request's Authorization header (RLS-protected check)
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Now safe to use service-role key (auth verified)
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.from("audit_log").insert({ user_id: user.id });

  return new Response(JSON.stringify({ ok: true, data, error }), {
    headers: { "Content-Type": "application/json" },
  });
});
