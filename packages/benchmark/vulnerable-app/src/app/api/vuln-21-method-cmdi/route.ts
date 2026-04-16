/**
 * Method-call cross-file Command Injection — POST /api/vuln-21-method-cmdi
 *
 * VULN-21: tainted request body flows into an imported object's method
 * whose body calls child_process.exec. AEGIS v0.8 Phase 4 must resolve
 * the method via TypeChecker (module-graph stops at the exported const)
 * and emit a cross-file finding at the binding site. Expected: taint-
 * analyzer, CWE-78, CRITICAL (cross-file, method-call).
 */
import { NextRequest, NextResponse } from 'next/server';
import { commandRunner } from '../../../lib/cross-file/vuln-21-command';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // VULNERABLE: commandRunner.run's body calls exec(cmd). Phase 4
  // resolves the method via TypeChecker and emits a cross-file finding.
  commandRunner.run(body.cmd);

  return NextResponse.json({ ok: true });
}
