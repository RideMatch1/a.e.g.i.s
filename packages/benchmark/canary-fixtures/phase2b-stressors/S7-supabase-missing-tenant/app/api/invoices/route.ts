import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// S7 canary — Supabase .from() query missing tenant_id filter in a
// multi-tenant app. Scanner activation requires any file in project
// to mention tenant_id (this fixture's types file contains the
// canonical column name used by the org-tenancy migration).

type InvoiceRow = {
  id: string;
  amount: number;
  tenant_id: string; // canonical column documented here
};

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const invoiceId = req.nextUrl.searchParams.get('id') ?? '';

  // Missing: .eq('tenant_id', session.user.tenantId) — cross-tenant leak.
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single<InvoiceRow>();

  return NextResponse.json(data);
}
