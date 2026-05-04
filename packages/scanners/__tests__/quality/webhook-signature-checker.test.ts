import { describe, it, expect, vi } from 'vitest';
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
  };
});

import { webhookSignatureCheckerScanner } from '../../src/quality/webhook-signature-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-webhook-sig-test-'));
}

function writeRoute(dir: string, relPath: string, body: string) {
  const full = join(dir, relPath);
  mkdirSync(full.substring(0, full.lastIndexOf('/')), { recursive: true });
  writeFileSync(full, body, 'utf-8');
}

describe('webhook-signature-checker', () => {
  it('fires on Stripe webhook missing constructEvent', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/stripe/route.ts',
      `export async function POST(req) { const event = await req.json(); return Response.json({ ok: true }); }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.severity).toBe('high');
    expect(r.findings[0]!.cwe).toBe(345);
    expect(r.findings[0]!.title).toContain('Stripe');
  });

  it('does NOT fire on Stripe webhook with stripe.webhooks.constructEvent', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/stripe/route.ts',
      `import { stripe } from '@/lib/stripe';
       export async function POST(req) {
         const body = await req.text();
         const sig = req.headers.get('stripe-signature') ?? '';
         const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_SECRET);
         return Response.json({ ok: true });
       }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('fires on GitHub webhook missing HMAC verification', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/github/route.ts',
      `export async function POST(req) { const event = await req.json(); return Response.json({ ok: true }); }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.title).toContain('GitHub');
  });

  it('does NOT fire on GitHub webhook with createHmac + timingSafeEqual', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/github/route.ts',
      `import crypto from 'node:crypto';
       export async function POST(req) {
         const body = await req.text();
         const sig = req.headers.get('x-hub-signature-256') ?? '';
         const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
         if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new Response('bad', { status: 401 });
         return Response.json({ ok: true });
       }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('does NOT fire on svix Webhook.verify pattern (Clerk / Resend)', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/clerk/route.ts',
      `import { Webhook } from 'svix';
       export async function POST(req) {
         const wh = new Webhook(SECRET);
         const body = await req.text();
         const payload = wh.verify(body, { 'svix-id': '', 'svix-timestamp': '', 'svix-signature': '' });
         return Response.json({ ok: true });
       }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('does NOT fire on non-webhook routes (path filter)', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/users/route.ts',
      `export async function POST(req) { const body = await req.json(); return Response.json({ ok: true }); }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('does NOT fire on GET-only webhook routes (no POST handler)', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/health/route.ts',
      `export async function GET(req) { return Response.json({ ok: true }); }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('fires on generic webhook handler at /api/webhooks/notify', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/notify/route.ts',
      `export async function POST(req) { const payload = await req.json(); await sendEmail(payload); return Response.json({ ok: true }); }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.title).toContain('generic');
  });

  it('does NOT fire on partial HMAC pattern (createHmac without timingSafeEqual)', async () => {
    // Defensive — createHmac alone may be computing hashes for other purposes.
    // The scanner requires CO-OCCURRENCE of createHmac + timingSafeEqual to suppress.
    const dir = makeProject();
    writeRoute(
      dir,
      'app/api/webhooks/payment/route.ts',
      `import crypto from 'node:crypto';
       export async function POST(req) {
         const body = await req.text();
         const expected = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
         // OOPS — comparing with == instead of timingSafeEqual
         if (req.headers.get('x-sig') !== expected) return new Response('bad', { status: 401 });
         return Response.json({ ok: true });
       }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
  });

  it('handles pages-router webhooks under pages/api/webhooks/*', async () => {
    const dir = makeProject();
    writeRoute(
      dir,
      'pages/api/webhooks/stripe.ts',
      `export default async function handler(req, res) { return res.json({ ok: true }); }
       export async function POST(req) { return Response.json({ ok: true }); }`,
    );
    const r = await webhookSignatureCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings.length).toBeGreaterThanOrEqual(1);
  });
});
