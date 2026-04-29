import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) =>
      walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isTestFile: (filePath: string) =>
      /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath),
  };
});

import { paymentFlowCheckerScanner } from '../../src/quality/payment-flow-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-payment-flow-test-'));
}

function writeRoute(projectPath: string, route: string, content: string): string {
  const routeDir = join(projectPath, 'src', 'app', 'api', route);
  mkdirSync(routeDir, { recursive: true });
  const file = join(routeDir, 'route.ts');
  writeFileSync(file, content);
  return file;
}

describe('paymentFlowCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    const ok = await paymentFlowCheckerScanner.isAvailable(projectPath);
    expect(ok).toBe(true);
  });

  it('flags Stripe Checkout when unit_amount is sourced from request body — CRITICAL', async () => {
    writeRoute(
      projectPath,
      'checkout',
      `import Stripe from 'stripe';
       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
       export async function POST(request: Request) {
         const { priceAed, currency, listingTitle } = await request.json();
         const session = await stripe.checkout.sessions.create({
           line_items: [{
             price_data: {
               currency: currency || 'aed',
               product_data: { name: listingTitle },
               unit_amount: priceAed * 100,
             },
             quantity: 1,
           }],
           mode: 'payment',
         });
         return Response.json({ url: session.url });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find(
      (f) => f.cwe === 602 && f.severity === 'critical',
    );
    expect(finding).toBeDefined();
    expect(finding!.title).toMatch(/unit_amount|price-tampering/i);
  });

  it('flags Stripe paymentIntents.create when amount is from searchParams.get(...) — CRITICAL', async () => {
    writeRoute(
      projectPath,
      'pay',
      `import Stripe from 'stripe';
       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
       export async function GET(request: Request) {
         const { searchParams } = new URL(request.url);
         const amount = searchParams.get('amount');
         const intent = await stripe.paymentIntents.create({
           amount: Number(amount),
           currency: 'usd',
         });
         return Response.json({ clientSecret: intent.client_secret });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
    expect(finding!.title).toMatch(/amount|price-tampering/i);
  });

  it('flags Razorpay orders.create when amount is from request body — CRITICAL', async () => {
    writeRoute(
      projectPath,
      'razorpay-order',
      `import Razorpay from 'razorpay';
       const razorpay = new Razorpay({ key_id: '...', key_secret: '...' });
       export async function POST(request: Request) {
         const body = await request.json();
         const order = await razorpay.orders.create({
           amount: body.amount,
           currency: 'INR',
           receipt: body.receipt,
         });
         return Response.json({ orderId: order.id });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('does NOT flag when amount is from a server-side DB lookup', async () => {
    writeRoute(
      projectPath,
      'safe-checkout',
      `import Stripe from 'stripe';
       import { db } from '@/lib/db';
       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
       export async function POST(request: Request) {
         const { productId } = await request.json();
         const product = await db.product.findUnique({ where: { id: productId } });
         if (!product) return Response.json({ error: 'Not found' }, { status: 404 });
         const session = await stripe.checkout.sessions.create({
           line_items: [{
             price_data: {
               currency: product.currency,
               product_data: { name: product.name },
               unit_amount: product.priceCents,
             },
             quantity: 1,
           }],
           mode: 'payment',
         });
         return Response.json({ url: session.url });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'payment-flow-checker')).toEqual([]);
  });

  it('does NOT flag hardcoded numeric amounts', async () => {
    writeRoute(
      projectPath,
      'fixed-fee',
      `import Stripe from 'stripe';
       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
       export async function POST() {
         const intent = await stripe.paymentIntents.create({
           amount: 1000,
           currency: 'usd',
         });
         return Response.json({ clientSecret: intent.client_secret });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'payment-flow-checker')).toEqual([]);
  });

  it('does NOT flag client-controlled values inside Stripe metadata', async () => {
    writeRoute(
      projectPath,
      'metadata-only',
      `import Stripe from 'stripe';
       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
       export async function POST(request: Request) {
         const { userTrackingTag } = await request.json();
         const intent = await stripe.paymentIntents.create({
           amount: 1000,
           currency: 'usd',
           metadata: {
             amount: userTrackingTag,
             price: userTrackingTag,
           },
         });
         return Response.json({ clientSecret: intent.client_secret });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'payment-flow-checker')).toEqual([]);
  });

  it('does NOT scan files marked "use client" (browser code)', async () => {
    const file = writeRoute(
      projectPath,
      'client-form',
      `'use client';
       import { useState } from 'react';
       import Stripe from 'stripe';
       export default function Page() {
         const [body, setBody] = useState({ priceAed: 0 });
         const stripe = new Stripe('...');
         async function pay() {
           await stripe.paymentIntents.create({ amount: body.priceAed, currency: 'aed' });
         }
         return null;
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(
      result.findings.filter((f) => f.scanner === 'payment-flow-checker' && f.file === file),
    ).toEqual([]);
  });

  it('handles indirect taint chain (const body = await req.json(); body.X)', async () => {
    writeRoute(
      projectPath,
      'indirect-taint',
      `import Stripe from 'stripe';
       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
       export async function POST(request: Request) {
         const body = await request.json();
         const intent = await stripe.paymentIntents.create({
           amount: body.amount,
           currency: 'usd',
         });
         return Response.json({ clientSecret: intent.client_secret });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('handles createCheckoutSession custom wrapper with destructured tainted source', async () => {
    writeRoute(
      projectPath,
      'wrapper',
      `import { createCheckoutSession } from '@/lib/stripe-helpers';
       export async function POST(request: Request) {
         const { amount, productName } = await request.json();
         const session = await createCheckoutSession({
           amount,
           currency: 'usd',
           productName,
         });
         return Response.json({ url: session.url });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('skips empty project gracefully', async () => {
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
    expect(result.available).toBe(true);
  });

  it('skips files without payment-SDK call patterns (cheap reject)', async () => {
    writeRoute(
      projectPath,
      'unrelated',
      `export async function POST(request: Request) {
         const { amount } = await request.json();
         return Response.json({ amount });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
  });

  // v0.17.8 bypass-class regression-guards (post external-audit)

  it('flags nested destructure: const { data: { amount } } = await req.json() (HIGH-001)', async () => {
    writeRoute(
      projectPath,
      'nested-destructure',
      `import Stripe from 'stripe';
       const stripe = new Stripe('...');
       export async function POST(req: Request) {
         const { data: { amount } } = await req.json();
         return stripe.paymentIntents.create({ amount, currency: 'usd' });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('flags spread-rebound: const data = { ...(await req.json()) } (HIGH-002)', async () => {
    writeRoute(
      projectPath,
      'spread-rebound',
      `import Stripe from 'stripe';
       const stripe = new Stripe('...');
       export async function POST(req: Request) {
         const data = { ...(await req.json()) };
         return stripe.paymentIntents.create({ amount: data.amount, currency: 'usd' });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('flags cookies()-sourced amount: const a = Number(cookies().get(...)?.value) (HIGH-003)', async () => {
    writeRoute(
      projectPath,
      'cookie-amount',
      `import { cookies } from 'next/headers';
       import Stripe from 'stripe';
       const stripe = new Stripe('...');
       export async function POST() {
         const amount = Number(cookies().get('amount')?.value);
         return stripe.paymentIntents.create({ amount, currency: 'usd' });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
  });

  it('flags headers()-sourced amount as taint (header-tampering class) (HIGH-003)', async () => {
    writeRoute(
      projectPath,
      'header-amount',
      `import { headers } from 'next/headers';
       import Stripe from 'stripe';
       const stripe = new Stripe('...');
       export async function POST() {
         const amount = Number(headers().get('x-amount'));
         return stripe.paymentIntents.create({ amount, currency: 'usd' });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
  });

  it('flags tRPC procedure input.amount (HIGH-004)', async () => {
    writeRoute(
      projectPath,
      'trpc-input',
      `import { z } from 'zod';
       import { initTRPC } from '@trpc/server';
       import Stripe from 'stripe';
       const t = initTRPC.create();
       const stripe = new Stripe('...');
       export const r = t.router({
         charge: t.procedure
           .input(z.object({ amount: z.number() }))
           .mutation(async ({ input }) => {
             return stripe.paymentIntents.create({ amount: input.amount, currency: 'usd' });
           }),
       });`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
  });

  it('flags tainted quantity in line_items (HIGH-005 — refund-forge / arbitrary-multiplier)', async () => {
    writeRoute(
      projectPath,
      'quantity-tampering',
      `import Stripe from 'stripe';
       const stripe = new Stripe('...');
       export async function POST(req: Request) {
         const { quantity } = await req.json();
         return stripe.checkout.sessions.create({
           line_items: [{ price: 'price_FIXED_ID', quantity }],
           mode: 'payment',
         });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
    expect(finding!.title).toMatch(/quantity/i);
  });

  it('flags Server Action with formData.get binding + shorthand (HIGH-006)', async () => {
    writeRoute(
      projectPath,
      'server-action',
      `'use server';
       import Stripe from 'stripe';
       const stripe = new Stripe('...');
       export async function checkout(formData: FormData) {
         const amount = Number(formData.get('amount'));
         return stripe.paymentIntents.create({ amount, currency: 'usd' });
       }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 602);
    expect(finding).toBeDefined();
  });

  it('does NOT fire on a client-side file with a long JSDoc banner before "use client" (MED-001)', async () => {
    const banner = '/**\n' + ' * '.repeat(60) + 'Long banner over 200 bytes\n */\n';
    writeRoute(
      projectPath,
      'client-with-banner',
      banner +
        `'use client';
         import Stripe from 'stripe';
         const stripe = new Stripe('...');
         export default function Page() {
           const amount = 0;
           stripe.paymentIntents.create({ amount, currency: 'usd' });
         }`,
    );
    const result = await paymentFlowCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'payment-flow-checker')).toEqual([]);
  });
});
