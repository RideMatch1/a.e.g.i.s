/**
 * Generic pass-through Command Injection — POST /api/vuln-20-identity-cmdi
 *
 * VULN-20: tainted request body flows through an imported identity
 * function back into the route's scope, then into child_process.exec.
 * AEGIS v0.8 Phase 3 must propagate return-taint across the module
 * boundary (policy §2) so the single-file sink check fires on `r`.
 * Expected: taint-analyzer, CWE-78, CRITICAL (single-file sink on
 * taint inherited via cross-file pass-through).
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { identity } from '../../../lib/cross-file/vuln-20-identity';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // VULNERABLE: identity returns its tainted param verbatim; Phase 3
  // propagates taint to `r`, so the sink on the next line fires.
  const r = identity(body.cmd);
  exec(r, () => {});

  return NextResponse.json({ ok: true });
}
