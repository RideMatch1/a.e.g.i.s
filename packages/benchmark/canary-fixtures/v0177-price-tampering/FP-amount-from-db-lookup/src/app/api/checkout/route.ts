// Canonical safe pattern. Client supplies only the productId. Amount and
// currency are loaded from the database; the request body is never trusted
// for monetary values. payment-flow-checker must not fire.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(request: Request) {
  const { productId } = await request.json();
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: product.currency,
          product_data: { name: product.name },
          unit_amount: product.priceCents,
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
