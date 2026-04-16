/**
 * Shadowed Sink — POST /api/clean-06-shadowed-sink
 *
 * Internal DSL runner with a function deliberately named `exec` — it
 * collides lexically with child_process.exec but has nothing to do with
 * process execution. Pure string-match scanners FP here; type-aware
 * resolution correctly sees the LOCAL declaration and suppresses.
 *
 * This fixture proves Phase 3c's resolveSinkSymbol: without type-awareness
 * AEGIS would flag `exec(body.cmd)` as CWE-78 Command Injection; with
 * type-awareness it stays clean.
 */
import { NextRequest, NextResponse } from 'next/server';

// Local function — intentionally named `exec` to collide with child_process.exec
function exec(cmd: string): string {
  const whitelist = ['help', 'ping', 'version'];
  if (!whitelist.includes(cmd)) {
    throw new Error('invalid command');
  }
  return `executed: ${cmd}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.cmd || typeof body.cmd !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'cmd is required' } },
        { status: 400 },
      );
    }

    const result = exec(body.cmd);
    return NextResponse.json({ success: true, result });
  } catch {
    return NextResponse.json(
      { error: { code: 'EXEC_FAILED', message: 'internal DSL error' } },
      { status: 500 },
    );
  }
}
