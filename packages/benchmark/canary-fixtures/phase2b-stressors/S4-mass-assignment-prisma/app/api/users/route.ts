import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// S4 canary — mass assignment. Raw request body spread into
// prisma.update without any Zod pick / field allowlist. Attacker
// can set role: 'admin', isVerified: true, balance: 999999, etc.

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const body = await req.json();

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: body,
  });

  return NextResponse.json(updated);
}
