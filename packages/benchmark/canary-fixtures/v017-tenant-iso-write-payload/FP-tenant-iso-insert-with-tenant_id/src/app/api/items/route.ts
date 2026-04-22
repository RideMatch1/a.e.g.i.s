import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function POST(request: Request) {
  const body = await request.json();
  const tenantId = body.tenantId;
  await supabase.from('items').insert({
    tenant_id: tenantId,
    title: body.title,
  });
  return NextResponse.json({ ok: true });
}
