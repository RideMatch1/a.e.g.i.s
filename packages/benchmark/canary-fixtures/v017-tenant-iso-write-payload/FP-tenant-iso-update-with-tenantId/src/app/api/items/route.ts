import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function PATCH(request: Request) {
  const body = await request.json();
  const tenantId = body.tenantId;
  await supabase.from('items').update({
    tenantId: tenantId,
    name: body.name,
  });
  return NextResponse.json({ ok: true });
}
