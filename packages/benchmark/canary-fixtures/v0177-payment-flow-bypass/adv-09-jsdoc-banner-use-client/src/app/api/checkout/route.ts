/**
 * ============================================================================
 * Copyright (c) 2026 Example Inc. — All Rights Reserved.
 * ----------------------------------------------------------------------------
 * Licensed under the proprietary terms governing this codebase. Redistribution
 * is permitted only under the conditions of the parent organisation. This
 * banner is intentionally long-form because the corporate-template demands it.
 * ============================================================================
 */
'use client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(request: Request) {
  const body = await request.json();
  return stripe.paymentIntents.create({ amount: body.amount, currency: 'usd' });
}
