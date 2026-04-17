import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// S8 canary — mutation route with no Zod schema validating input.
// Raw JSON.parse output flows to a mutating DB call.

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const raw = await req.text();
  const body = JSON.parse(raw);

  const comment = await prisma.comment.create({
    data: {
      authorId: session.user.id,
      postId: body.postId,
      content: body.content,
    },
  });

  return NextResponse.json(comment);
}
