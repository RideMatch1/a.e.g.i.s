import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const billing = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(req: Request) {
  const { amount } = await req.json();
  const session = await billing.paymentIntents.create({ amount, currency: 'usd' });
  return NextResponse.json({ id: session.id });
}
