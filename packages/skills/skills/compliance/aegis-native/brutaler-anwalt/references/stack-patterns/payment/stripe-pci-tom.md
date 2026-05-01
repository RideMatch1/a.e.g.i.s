---
license: MIT (snippet)
provider: Stripe Inc. (USA)
provider-AVV-status: Standardvertrag verfügbar (Stripe DPA + SCC)
last-checked: 2026-05-01
---

# Stripe — PCI-DSS-konformer Checkout + DSE-Wording

## 1. PCI-DSS-Strategie: Stripe-hosted Checkout (Pflicht für KMU)

Pflicht-Strategy: **Stripe Elements oder Stripe Checkout** — Karten-Daten passieren **nie** den eigenen Server.

- ✅ `stripe-js` mit `<CardElement />`: Karten-Daten gehen direkt vom Browser zu Stripe
- ✅ `Stripe.redirectToCheckout()`: hosted-Page bei Stripe
- ❌ NICHT: Karten-Daten über eigenen Server entgegennehmen — würde PCI-DSS-Audit-Pflicht triggern (Self-Audit oder QSA)

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|--------|---------|-----|
| Sub-Processor in USA | Drittland-Transfer | DPA + SCC + DSE-Erwähnung |
| Risiko-Score-Cookies | TDDDG § 25 | Pre-Consent: kein Stripe-Skript |
| Webhook-Signatur-Prüfung fehlt | Unauthorized Charge / IDOR | `stripe.webhooks.constructEvent()` Pflicht |
| `card.number` im Server-Log | PCI-DSS-Verstoss + Datenschutz | Logger sanitisieren |

## 3. Code-Pattern (sanitized)

```ts
// File: src/app/api/stripe/webhook/route.ts
// Webhook-Signatur-Verifikation (CWE-345 Schutz)
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-06-30.basil' });

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const buf = await req.text(); // raw body Pflicht für Signatur
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature mismatch: ${err}` }, { status: 400 });
  }

  // Idempotency: bei replay-Webhook keine doppelte Aktion
  // ... handle event types ...

  return NextResponse.json({ received: true });
}
```

```tsx
// File: src/components/checkout/StripeButton.tsx
// Pre-consent OHNE Stripe-Skript-Load
'use client';
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

export function StripeButton({ priceId }: { priceId: string }) {
  const [stripe, setStripe] = useState<any>(null);

  useEffect(() => {
    // Erst nach Consent (oder hier explizit beim Klick erst loadStripe rufen)
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!).then(setStripe);
  }, []);

  async function handleCheckout() {
    if (!stripe) return;
    const res = await fetch('/api/stripe/checkout-session', { method: 'POST', body: JSON.stringify({ priceId }) });
    const { sessionId } = await res.json();
    await stripe.redirectToCheckout({ sessionId });
  }

  return <button onClick={handleCheckout}>Zahlungspflichtig bestellen</button>;
  //                                       ^^^ Pflicht-Wording § 312j Abs. 3 BGB
}
```

## 4. AVV / DPA

- **DPA-Link**: https://stripe.com/legal/dpa
- **SCC**: Modul 2 + 3 (Stripe als Processor + Sub-Processor-Liste)
- **Sub-Processors**: https://stripe.com/legal/data-processing-providers

## 5. DSE-Wording-Vorlage

> **Zahlungsabwicklung (Stripe).** Für Zahlungen nutzen wir den Service von
> Stripe Payments Europe Limited (1 Grand Canal Street Lower, Grand Canal
> Dock, Dublin, Irland) sowie Stripe Inc. (354 Oyster Point Boulevard,
> South San Francisco, CA 94080, USA) als Auftragsverarbeiter im Sinne
> von Art. 28 DSGVO. Karten-Daten werden direkt von Ihrem Browser an
> Stripe übermittelt — wir verarbeiten diese nicht selbst. Für die
> Datenübermittlung in die USA gelten die EU-Standardvertragsklauseln
> (Modul 2 + 3) sowie das EU-US Data Privacy Framework (Stripe Inc. ist
> DPF-zertifiziert). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
> (Vertragserfüllung). Datenschutz Stripe: https://stripe.com/de/privacy.

## 6. Verify-Commands

```bash
# Webhook-Konfiguration
stripe webhooks list

# Test-Webhook lokal
stripe listen --forward-to https://<your-domain>/api/stripe/webhook

# Verify Pflicht-Header an Webhook-Endpoint
curl -X POST https://<your-domain>/api/stripe/webhook -H "stripe-signature: invalid"
# erwarte: 400 mit "signature mismatch"
```

## 7. Az.-Anker

- BGH I ZR 161/24 (Kuendigungsbutton, 22.05.2025) — § 312k betrifft Stripe-Subscription-Modelle
- BGH VIII ZR 70/08 (Widerrufsbelehrung) — Pflicht-Belehrung vor Zahlung
