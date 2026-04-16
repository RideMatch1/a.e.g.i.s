/**
 * CLEAN-01: Properly authenticated route — should NOT be flagged by auth-enforcer
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireRole(context, ['admin']);
  const data = await getUsers(context.tenantId);
  return NextResponse.json(data);
}
