import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(_request: Request) {
  const amount = Number(cookies().get('amount')?.value);
  const session = await stripe.paymentIntents.create({ amount, currency: 'usd' });
  return NextResponse.json({ id: session.id });
}
