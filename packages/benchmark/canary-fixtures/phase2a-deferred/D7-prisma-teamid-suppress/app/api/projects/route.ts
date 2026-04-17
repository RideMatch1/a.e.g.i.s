import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// D7 canary — Prisma tRPC-style multi-tenancy using teamId as the
// tenant-boundary discriminant (team-based SaaS convention; tRPC
// procedure ctx.session pattern). Legitimate per-tenant filter under
// a different canonical column name.
//
// Post-v0.10 expected: teamId recognised as tenant discriminant
// alongside workspaceId / orgId / organizationId / tenantId. No
// emission (FP suppression). Comments scrubbed of scanner-trigger
// substrings (see Z2 bonus finding).

type Ctx = { session: { userId: string; teamId: string } };

export async function GET(req: NextRequest, _ctx: { ctx: Ctx }) {
  // tRPC-style context injection is emulated for the canary.
  const ctx: Ctx = {
    session: {
      userId: 'u_fake',
      teamId: req.headers.get('x-team') ?? '',
    },
  };

  if (!ctx.session.teamId) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: {
      teamId: ctx.session.teamId,
      archivedAt: null,
    },
    include: { members: true },
  });

  return NextResponse.json(projects);
}
