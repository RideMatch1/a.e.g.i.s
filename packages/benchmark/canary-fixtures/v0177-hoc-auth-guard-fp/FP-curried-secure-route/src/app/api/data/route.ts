// Single-arg HOC: secureRoute(handler) — the wrapper enforces auth
// before invoking the handler. Common in frameworks where the auth
// is bound at the wrapper level without an options object.

import { NextResponse } from "next/server";
import { secureRoute } from "@/lib/api/secure";

export const GET = secureRoute(async (req, { user }) => {
  return NextResponse.json({ user_id: user.id, items: [] });
});

export const POST = secureRoute(async (req, { user }) => {
  const body = await req.json();
  return NextResponse.json({ user_id: user.id, received: body });
});
