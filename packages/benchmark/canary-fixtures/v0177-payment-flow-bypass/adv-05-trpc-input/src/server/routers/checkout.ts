import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import Stripe from 'stripe';

const t = initTRPC.create();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export const checkoutRouter = t.router({
  charge: t.procedure
    .input(z.object({ amount: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return stripe.paymentIntents.create({
        amount: input.amount,
        currency: 'usd',
      });
    }),
});
