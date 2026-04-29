// URL-query-driven amount — attacker controls the search-param value.
// Same vulnerability class as body-sourced amount (F-PRICE-TAMPER-1).

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency') ?? 'usd';

  const intent = await stripe.paymentIntents.create({
    amount: Number(amount),
    currency,
    automatic_payment_methods: { enabled: true },
  });

  return NextResponse.json({ clientSecret: intent.client_secret });
}
