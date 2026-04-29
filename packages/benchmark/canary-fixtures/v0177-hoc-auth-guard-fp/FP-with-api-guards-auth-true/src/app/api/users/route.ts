// Sanitized from a real 2026-04-29 dogfood-scan FP (tripsage-ai
// app/api/auth/mfa/backup/regenerate/route.ts). The HOC wrapper
// `withApiGuards({ auth: true })` enforces auth BEFORE the handler runs.
// The handler signature is `(req, { user, supabase }, data) => ...` —
// the framework injects the verified user/session into the second arg.

import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/factory";
import { someInputSchema } from "@/schemas/example";

export const POST = withApiGuards({
  auth: true,
  schema: someInputSchema,
  rateLimit: "api:users:create",
  telemetry: "api.users.create",
})(async (_req, { user, supabase }, data) => {
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error } = await supabase
    .from("users")
    .insert({ user_id: user.id, name: data.name });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
});
