/**
 * Cross-file sanitized — POST /api/clean-07-cross-file-sanitized
 *
 * CLEAN-07: Tainted request body is passed cross-file to a wrapper that
 * sanitizes via parseInt() before reaching db.query(). AEGIS v0.7 must
 * recognise the sanitizer (summary.sanitizesCwes) / sink-text mismatch
 * and NOT emit a cross-file finding on this route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { safeUserQuery } from '../../../lib/cross-file/clean-07-safe';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // SAFE: parseInt inside safeUserQuery sanitizes SQLi before db.query.
  await safeUserQuery(body.id);

  return NextResponse.json({ ok: true });
}
