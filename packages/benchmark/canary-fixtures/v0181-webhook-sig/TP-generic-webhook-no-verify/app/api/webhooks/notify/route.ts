import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

// VULNERABLE: generic webhook endpoint that triggers a side effect (email send)
// without any signature/auth verification.
export async function POST(req: NextRequest) {
  const payload = await req.json();
  await sendEmail({
    to: payload.recipient,
    subject: payload.subject,
    body: payload.body,
  });
  return NextResponse.json({ ok: true });
}
