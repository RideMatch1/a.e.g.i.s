import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

// SAFE: verifies Stripe signature via stripe.webhooks.constructEvent before processing
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  if (event.type === 'checkout.session.completed') {
    await db.orders.update({
      where: { stripeSessionId: event.data.object.id },
      data: { status: 'paid' },
    });
  }
  return NextResponse.json({ received: true });
}
