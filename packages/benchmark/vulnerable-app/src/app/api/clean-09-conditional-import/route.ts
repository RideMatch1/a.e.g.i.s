/**
 * Conditional dynamic import — POST /api/clean-09-conditional-import
 *
 * CLEAN-09: the query module is resolved via a ternary over `await
 * import(...)`. Phase 5 (policy §4) downgrades the cross-file sink
 * finding to confidence: 'medium' because the scanner cannot prove
 * which branch is taken at runtime. The benchmark tolerates medium-
 * confidence findings on CLEAN-* fixtures via `maxTolerated`, so this
 * route is treated as clean at high-confidence gate levels.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const useMock = request.headers.get('x-mock') === 'true';

  const db = useMock
    ? await import('../../../lib/cross-file/cond-db-mock')
    : await import('../../../lib/cross-file/cond-db-real');

  await db.query(`SELECT * FROM users WHERE id = ${body.id}`);

  return NextResponse.json({ ok: true });
}
