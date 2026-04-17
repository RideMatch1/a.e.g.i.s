import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';

// D2 canary — proper ownership check in reversed-operand + snake_case form.
// v0.9.3 ROLE_GUARD_PATTERNS handle both:
//   - reversed operand: resource-column on left, session on right
//   - snake_case: author_id / user_id / owner_id canonical Postgres convention
//
// Post-v0.10 expected (unchanged from today): auth-enforcer does NOT emit.
// Canary is a regression pin ensuring v0.10's full-flow rewrite doesn't
// break this working pattern.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: post, error: fetchErr } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', params.id)
    .single();

  if (fetchErr || !post) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Reversed operand (resource on left) + snake_case column.
  if (post.author_id !== session?.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json();
  await supabase.from('posts').update(body).eq('id', params.id);

  return NextResponse.json({ ok: true });
}
