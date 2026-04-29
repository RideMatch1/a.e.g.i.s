// Genuinely unprotected mutating route — no auth guard, no HOC,
// no auth-module re-export. Should fire CWE-306.

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  // Direct DB access with no auth check
  return NextResponse.json({ message: "ok", payload: body });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  return NextResponse.json({ deleted: id });
}
