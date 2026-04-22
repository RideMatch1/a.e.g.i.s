import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function PATCH(request: Request) {
  const body = await request.json();
  await supabase.from('items').update({ name: body.name });
  return NextResponse.json({ ok: true });
}
