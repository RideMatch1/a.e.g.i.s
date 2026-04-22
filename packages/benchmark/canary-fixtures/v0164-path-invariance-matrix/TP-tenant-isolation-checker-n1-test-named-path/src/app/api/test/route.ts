// Route at N1-class path. Scanner must flag the unscoped-query pattern.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient('url', 'key');
  const { data } = await supabase.from('users').select('*');
  return NextResponse.json(data);
}
