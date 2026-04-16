/**
 * Cross-file XSS — GET /api/vuln-17-cross-file-xss
 *
 * VULN-17: Tainted searchParam flows cross-file into `new Response(HTML)`
 * inside the imported renderer. AEGIS v0.7 must trace the constructor-sink
 * across the module boundary and emit a finding with crossFile=true.
 * Expected: taint-analyzer, CWE-79, HIGH (cross-file).
 */
import { NextRequest } from 'next/server';
import { renderGreeting } from '../../../lib/cross-file/vuln-17-render';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name') ?? 'Guest';

  // VULNERABLE: tainted name reaches new Response(HTML) inside the wrapper.
  return renderGreeting(name);
}
