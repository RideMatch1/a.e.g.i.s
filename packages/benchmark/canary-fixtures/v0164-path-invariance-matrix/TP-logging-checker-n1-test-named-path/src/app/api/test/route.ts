// Route at N1-class path. Scanner must flag the mutation-handler pattern.
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  return NextResponse.json({ ok: true, id: body.id });
}
