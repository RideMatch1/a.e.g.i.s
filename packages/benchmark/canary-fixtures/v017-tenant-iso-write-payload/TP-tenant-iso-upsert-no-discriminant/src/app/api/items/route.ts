import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function PUT(request: Request) {
  const body = await request.json();
  await supabase.from('items').upsert({ title: body.title });
  return NextResponse.json({ ok: true });
}
