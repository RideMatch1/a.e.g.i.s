import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

// VULNERABLE: parses webhook body without calling stripe.webhooks.constructEvent
// Anyone who finds /api/webhooks/stripe can POST a fabricated 'checkout.session.completed'
// event and trigger arbitrary db writes via the handler's switch-case.
export async function POST(req: NextRequest) {
  const event = await req.json();
  if (event.type === 'checkout.session.completed') {
    await db.orders.update({
      where: { stripeSessionId: event.data.object.id },
      data: { status: 'paid' },
    });
  }
  return NextResponse.json({ received: true });
}
