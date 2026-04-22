import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('url', 'key');

export async function GET(request: Request) {
  const tenantId = request.headers.get('x-tenant') ?? '';
  const { data } = await supabase
    .from('items')
    .select('*')
    .eq('tenant_id', tenantId);
  return NextResponse.json({ data });
}
