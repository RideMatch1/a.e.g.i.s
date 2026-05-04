import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';

// SAFE: verifies signature via svix Webhook.verify (Clerk / Resend / SendGrid pattern)
export async function POST(req: NextRequest) {
  const wh = new Webhook(process.env.WEBHOOK_SECRET!);
  const body = await req.text();
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };
  let payload: any;
  try {
    payload = wh.verify(body, headers);
  } catch {
    return NextResponse.json({ error: 'unverified' }, { status: 401 });
  }
  return NextResponse.json({ event: payload.type });
}
