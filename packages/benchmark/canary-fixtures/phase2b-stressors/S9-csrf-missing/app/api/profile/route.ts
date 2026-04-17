import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// S9 canary — state-changing POST that sets a cookie without
// SameSite attribute AND accepts no CSRF token. Cross-origin form
// submission can modify the authenticated user's profile.

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const body = await req.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName: body.displayName },
  });

  // Cookie set without SameSite — vulnerable to cross-origin delivery.
  const jar = await cookies();
  jar.set('last_profile_update', new Date().toISOString(), {
    httpOnly: true,
    // no sameSite attribute
  });

  return NextResponse.json({ ok: true });
}
