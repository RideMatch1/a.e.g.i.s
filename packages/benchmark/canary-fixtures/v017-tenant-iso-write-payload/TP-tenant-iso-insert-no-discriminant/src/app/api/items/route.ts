import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function POST(request: Request) {
  const body = await request.json();
  await supabase.from('items').insert({ title: body.title, description: body.description });
  return NextResponse.json({ ok: true });
}
