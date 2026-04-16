/**
 * Cross-file SQL Injection — POST /api/vuln-16-cross-file-sqli
 *
 * VULN-16: Tainted request body flows cross-file into a db.query() wrapper
 * exported from lib. AEGIS v0.7 must detect the taint path across the
 * module boundary and emit a finding with crossFile=true.
 * Expected: taint-analyzer, CWE-89, CRITICAL (cross-file).
 */
import { NextRequest, NextResponse } from 'next/server';
import { runUserQuery } from '../../../lib/cross-file/vuln-16-query';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // VULNERABLE: tainted body.id reaches db.query inside the imported wrapper.
  const results = await runUserQuery(body.id);

  return NextResponse.json({ ok: true, results });
}
