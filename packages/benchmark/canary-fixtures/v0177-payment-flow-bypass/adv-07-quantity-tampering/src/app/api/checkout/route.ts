import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(req: Request) {
  const { quantity } = await req.json();
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: 'price_FIXED_ID',
        quantity,
      },
    ],
    mode: 'payment',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  });
  return NextResponse.json({ url: session.url });
}
