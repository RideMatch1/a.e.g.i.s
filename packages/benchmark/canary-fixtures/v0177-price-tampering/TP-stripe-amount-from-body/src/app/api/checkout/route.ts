// Sanitized from real 2026-04-29 dogfood-scan disclosure-grade finding
// (scootmart-marketplace /api/checkout). Listing price taken from
// request body, passed verbatim to Stripe Checkout. Attacker POSTs
// {priceAed: 1, listingTitle: '...'} → 1-fil checkout for a 50,000-AED bike.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(request: Request) {
  const { listingTitle, priceAed, currency } = await request.json();

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: currency || 'aed',
          product_data: { name: listingTitle },
          unit_amount: priceAed * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
  });

  return NextResponse.json({ url: session.url });
}
