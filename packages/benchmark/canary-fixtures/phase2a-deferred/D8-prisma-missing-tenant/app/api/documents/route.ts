import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// D8 canary — Prisma query with NO tenant-boundary discriminant in
// the where clause. Real IDOR: any authenticated user can fetch
// documents belonging to any workspace by passing the target name.
//
// Post-v0.10 expected: checker recognises Prisma query-method calls
// and emits CWE-639 HIGH when no tenant discriminant (workspaceId /
// teamId / orgId / organizationId / tenantId) is present in the
// where clause.

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get('name') ?? '';

  // Missing: workspaceId / teamId / orgId filter. Any user can query
  // any document if they know the name — cross-tenant leak.
  const docs = await prisma.document.findMany({
    where: {
      name: { contains: name },
    },
    take: 20,
  });

  return NextResponse.json(docs);
}
