/**
 * CLEAN-03: Query with tenant_id filter — should NOT be flagged by tenant-isolation-checker
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabase = createClient('url', 'key');
  const tenantId = 'some-tenant-id';
  const { data } = await supabase.from('appointments').select('*').eq('tenant_id', tenantId);
  return NextResponse.json(data);
}
