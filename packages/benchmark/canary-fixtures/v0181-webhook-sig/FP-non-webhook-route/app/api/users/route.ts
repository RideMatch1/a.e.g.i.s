import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// Regular API route — not a webhook. webhook-signature-checker MUST NOT fire.
export async function POST(req: NextRequest) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const created = await db.users.create({ data: body });
  return NextResponse.json(created);
}
