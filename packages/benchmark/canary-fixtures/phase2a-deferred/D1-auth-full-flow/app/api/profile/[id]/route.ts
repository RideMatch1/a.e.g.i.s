import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// D1 canary — auth guard exists but does NOT dominate the DB write.
// Pattern-list scanner sees `session.user.id === params.id` and considers
// the route guarded. Full-flow taint-analyzer should prove the write is
// executed on every code path regardless of the comparison outcome.
//
// Post-v0.10 expected: auth-enforcer emits CWE-285 (improper authorization).
// Today: silent FN.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  // Ownership equality captured into a flag — used only for response
  // enrichment, never as a gating condition.
  const isOwn = session.user.id === params.id;

  const body = await req.json();

  // Unguarded DB write: runs for owned AND non-owned requests alike.
  await prisma.profile.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json({ ok: true, owned: isOwn });
}
