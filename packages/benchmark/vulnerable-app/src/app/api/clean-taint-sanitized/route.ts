/**
 * CLEAN-05: parseInt sanitizes SQLi, encodeURIComponent sanitizes SSRF
 * Should NOT be flagged by taint-analyzer for these CWEs
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const rawId = request.nextUrl.searchParams.get('id');
  const id = parseInt(rawId!, 10);
  client.query(`SELECT * FROM users WHERE id = ${id}`);

  const rawUrl = request.nextUrl.searchParams.get('url');
  const safeUrl = encodeURIComponent(rawUrl!);
  fetch(`https://api.example.com/proxy?url=${safeUrl}`);

  return NextResponse.json({ ok: true });
}
