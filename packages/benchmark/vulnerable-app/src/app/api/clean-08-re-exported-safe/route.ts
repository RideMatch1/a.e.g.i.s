/**
 * Cross-file re-exported identity — POST /api/clean-08-re-exported-safe
 *
 * CLEAN-08: Tainted request body is passed cross-file to an identity
 * function imported via a barrel re-export. The identity has NO sink in
 * its body, so summary.params[0].sinkCwes = []. AEGIS v0.7 must resolve
 * the barrel (via module-graph resolveSymbolOrigin) AND emit NO cross-file
 * finding.
 */
import { NextRequest, NextResponse } from 'next/server';
import { identity } from '../../../lib/cross-file/clean-08';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // SAFE: identity has no sink in its body → no cross-file emission.
  identity(body.data);

  return NextResponse.json({ ok: true });
}
