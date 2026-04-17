import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// D6 canary — Prisma multi-tenancy using workspaceId as the tenant-
// boundary discriminant (dub-style, Next.js + Prisma community
// convention). The where clause pins the query to the caller's
// workspace; a legitimate per-tenant filter.
//
// Post-v0.10 expected: checker understands Prisma query-method calls
// and recognises workspaceId / teamId / orgId / organizationId /
// tenantId as tenant discriminants. No emission (FP suppression).
// NOTE: scrubbed of scanner-trigger substrings to avoid Z2 comment-
// leak (regex matcher does not strip comments before testing).

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const links = await prisma.link.findMany({
    where: {
      workspaceId: session.workspaceId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(links);
}
