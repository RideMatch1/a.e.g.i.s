import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

// SAFE: verifies x-hub-signature-256 HMAC with timing-safe comparison
export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  const body = await req.text();
  const sig = req.headers.get('x-hub-signature-256') ?? '';
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }
  const event = JSON.parse(body);
  return NextResponse.json({ ok: true, event: event.action });
}
