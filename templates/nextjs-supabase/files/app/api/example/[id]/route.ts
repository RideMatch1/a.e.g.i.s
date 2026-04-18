// Replace 'examples' with your real table when extending this demo.
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { requireRole } from '@/lib/api/require-role';
import { isValidUUID } from '@/lib/validation/input';
import { logger } from '@/lib/logger';
import { ForbiddenError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

const PutBodySchema = z.object({ name: z.string().min(1).max(120) }).strict();

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const { context, supabase } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('examples')
    .select('id, name')
    .eq('tenant_id', context.tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logger.info('example.get', { tenantId: context.tenantId, userId: context.userId, id });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const { context, supabase } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requireRole({ userId: context.userId, role: context.role }, ['admin', 'manager']); }
  catch (e) { if (e instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); throw e; }
  const body = PutBodySchema.parse(await request.json());
  const { data, error } = await supabase
    .from('examples')
    .update({ name: body.name })
    .eq('tenant_id', context.tenantId)
    .eq('id', id)
    .select('id, name')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logger.info('example.put', { tenantId: context.tenantId, userId: context.userId, id });
  return NextResponse.json(data);
}
