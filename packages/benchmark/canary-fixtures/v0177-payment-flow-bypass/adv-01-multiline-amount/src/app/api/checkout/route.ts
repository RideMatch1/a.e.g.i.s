import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(request: Request) {
  const body = await request.json();
  const session = await stripe.paymentIntents.create({
    amount:
      body.amount,
    currency: 'usd',
  });
  return NextResponse.json({ id: session.id });
}
