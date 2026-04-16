/**
 * HOC cross-file Command Injection — POST /api/vuln-19-hoc-cmdi
 *
 * VULN-19: withAuth HOC wraps an inline arrow whose body calls
 * child_process.exec. AEGIS v0.8 Phase 2 must detect the HOC binding as
 * a sink-proxy and emit a cross-file finding at the `withAuth(...)` call
 * site (policy §9 — before any tainted invocation reaches the proxy).
 * Expected: taint-analyzer, CWE-78, CRITICAL (cross-file, HOC binding).
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { withAuth } from '../../../lib/cross-file/vuln-19-hoc';

// VULNERABLE: binding passes an inline fn that calls child_process.exec.
// Phase 2 flags this line — any later invocation of `handler` with
// tainted input funnels into `exec` without visible signal at the call.
const handler = withAuth((cmd: string) => exec(cmd, () => {}));

export async function POST(request: NextRequest) {
  const body = await request.json();
  handler(body.cmd);
  return NextResponse.json({ ok: true });
}
