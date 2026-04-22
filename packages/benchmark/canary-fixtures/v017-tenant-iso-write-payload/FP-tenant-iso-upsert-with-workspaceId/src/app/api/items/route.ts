import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function PUT(request: Request) {
  const body = await request.json();
  const workspaceId = body.workspaceId;
  await supabase.from('items').upsert({
    workspaceId: workspaceId,
    title: body.title,
  });
  return NextResponse.json({ ok: true });
}
