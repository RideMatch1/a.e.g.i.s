# Phase 5 Reference — Integration (API-Routes + Forms + Chatbot + Scanner)

Phase 5 wires up the dynamic backends. Outputs: API-routes under `app/api/`, form-submission handlers, chatbot mount in `app/layout.tsx`, scanner mount under `app/scan/`. **Time budget:** 30-45 min.

---

## API-Route Template (canonical)

Every API-route uses the `secureApiRoute` wrapper. Canonical shape:

```ts
// app/api/<endpoint>/route.ts
import { secureApiRoute } from '@/lib/api/secure-route';
import { z } from 'zod';

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  message: z.string().min(10).max(5000),
});

export const POST = secureApiRoute({
  schema: requestSchema,
  rateLimit: { perIpPerHour: 30 },
  origins: ['https://<production-domain>', 'http://localhost:3000'],
  handler: async ({ body, req }) => {
    // body is typed + validated per requestSchema
    const result = await processSubmission(body);
    return Response.json({ success: true, id: result.id });
  },
});
```

**`secureApiRoute` wraps:**

1. Origin-check (allow-list per `origins[]`; rejects cross-origin POST).
2. Rate-limit (Redis-backed or in-memory per IP).
3. Body-parse + Zod validation (returns 400 on validation-fail).
4. Honeypot field check (rejects if `_honey` field non-empty).
5. Handler invocation (passes typed body + raw req).
6. Error-mapping (maps thrown errors to clean JSON responses).

The wrapper itself lives in `lib/api/secure-route.ts` — copy from foundation template.

---

## Form-Pattern (Contact Form)

Canonical contact-form with double-opt-in:

```tsx
// components/forms/ContactForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema } from '@/lib/schemas/contact';

export function ContactForm() {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data) => {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    // Show "We sent you a confirmation email" UI
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="text" {...register('name')} aria-invalid={!!formState.errors.name} />
      <input type="email" {...register('email')} />
      <textarea {...register('message')} />
      {/* Honeypot — bots fill, humans don't */}
      <input type="text" name="_honey" style={{ position: 'absolute', left: '-9999px' }} tabIndex={-1} aria-hidden="true" />
      {/* DSGVO-consent */}
      <label>
        <input type="checkbox" {...register('consent')} />
        Ich willige in die Verarbeitung meiner Daten ein. <a href="/datenschutz">Datenschutz</a>
      </label>
      <button type="submit" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? 'Wird gesendet...' : 'Senden'}
      </button>
    </form>
  );
}
```

**DSGVO-Discipline:**

- Consent-checkbox required before submit (no pre-checked checkbox — must be explicit user-action).
- "Datenschutz" link visible next to consent-text.
- Server-side: store consent-timestamp + IP-hash for audit trail (Art. 7 Abs. 1 DSGVO).
- Double-opt-in: send confirmation email; don't store final submission until user clicks the email link.

---

## Chatbot Mount Pattern

If `briefing.integrations` includes `chatbot.public-llm`:

```tsx
// app/layout.tsx
import { ChatWidget } from '@/components/chat/ChatWidget';

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        {children}
        <ChatWidget endpoint="/api/chat" persona={chatPersona} />
      </body>
    </html>
  );
}
```

```ts
// app/api/chat/route.ts
import { secureApiRoute } from '@/lib/api/secure-route';
import { z } from 'zod';
import { chatPersona } from '@/lib/chat/persona';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).max(10),
});

export const POST = secureApiRoute({
  schema: messageSchema,
  rateLimit: { perIpPerHour: 60 },
  handler: async ({ body }) => {
    // Sanitize user input (anti-prompt-injection)
    const sanitized = sanitizeInput(body.message);
    // Redact PII before sending to LLM
    const redacted = redactPii(sanitized);
    // Stream response via SSE
    const stream = await callLlm({
      systemPrompt: chatPersona.systemPrompt,
      messages: [...body.history, { role: 'user', content: redacted }],
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  },
});
```

**Anti-Injection-Defense-Layer:**

- Sanitize user input (strip suspicious patterns: `system:`, `assistant:`, `<|im_start|>`, base64-blobs > 100 chars).
- PII-redact before LLM-call (regex + named-entity).
- Persona system-prompt with explicit "stay in role" rules.
- Output-filter (strip any "I cannot..." that leaks training-data; strip markdown-headers from responses).
- Rate-limit + per-IP cooldown.

The detailed defense-layer-list is in `compliance/aegis-native/brutaler-anwalt/references/audit-patterns.md` (cross-skill reference).

---

## Scanner Mount Pattern

If `briefing.integrations` includes `scanner.aegis`:

```tsx
// app/scan/page.tsx
import { ScannerWidget } from '@aegis-scan/react';

export default function ScanPage() {
  return (
    <main>
      <h1>Site-Compliance-Check</h1>
      <ScannerWidget />
    </main>
  );
}
```

```ts
// app/api/scan/route.ts
import { secureApiRoute } from '@/lib/api/secure-route';
import { runScan } from '@aegis-scan/runner';
import { z } from 'zod';

const scanSchema = z.object({
  url: z.string().url(),
  depth: z.enum(['quick', 'full']).default('quick'),
});

export const POST = secureApiRoute({
  schema: scanSchema,
  rateLimit: { perIpPerHour: 5 },
  handler: async ({ body }) => {
    const result = await runScan(body.url, { depth: body.depth });
    return Response.json(result);
  },
});
```

Scanner has tighter rate-limit (5/hr) — scans are expensive + can be abused for reconnaissance.

---

## Cookie-Banner Mount

If `briefing.legal.cookie_strategy != 'none'` (i.e., the site uses cookies that need consent):

```tsx
// app/layout.tsx
import { CookieBanner } from '@/components/layout/CookieBanner';

<CookieBanner
  strategy={briefing.legal.cookie_strategy}  // 'granular' | 'global'
  vendors={[/* per briefing.legal.vendors */]}
/>
```

**TTDSG/TDDDG §25 compliance:**

- No technically-non-required cookie set before user consent.
- Granular > global (per BGH). Each vendor gets its own opt-in checkbox.
- Banner has equal-prominence "Accept" / "Reject all" buttons (no dark-pattern of small "reject" link).
- Re-consent UI at `/cookies/einstellungen` (or footer-link).

Cookie-banner pattern detail belongs in `dsgvo-compliance/references/cookie-pattern.md` (cross-skill reference).

---

## Analytics Mount

If `briefing.integrations.analytics` is set:

| Provider | Consent-required | Mount |
|---|---|---|
| Plausible | No (anonymous, no cookies) | `<script defer src="https://plausible.io/js/script.js" />` in layout.tsx |
| Matomo (self-hosted) | Depends on config | Behind cookie-banner if cookies enabled |
| Google Analytics 4 | Yes | Behind cookie-banner; load only after consent |
| Fathom | No | Anonymous mode default; `<script async src="https://cdn.usefathom.com/script.js" />` |

Default to Plausible for new builds (privacy-friendly + DSGVO-clean by design).

---

## Integration-Completion Checklist

Before marking Phase 5 complete:

- [ ] Every API-route uses `secureApiRoute` wrapper (no raw `export const POST` without wrapper)
- [ ] Every form has DSGVO-consent + honeypot + double-opt-in flow
- [ ] Chatbot (if enabled) has anti-injection defense-layers active
- [ ] Scanner (if enabled) has tight rate-limit (5/hr)
- [ ] Cookie-banner (if needed) is granular per BGH + has equal-prominence accept/reject
- [ ] Analytics (if enabled) is consent-aware per provider
- [ ] All API-routes return JSON (no HTML / unstructured text)
- [ ] All API-routes have unit tests for happy + sad paths

---

## Anti-Patterns specific to Phase 5

- ❌ Skipping `secureApiRoute` wrapper "because the route is internal" — all routes get the wrapper.
- ❌ Forms without honeypot — bots will spam.
- ❌ Forms without double-opt-in — single-opt-in is no longer valid for newsletter under DSGVO + UWG.
- ❌ Chatbot without anti-injection-layer — first jailbreak attempt will leak.
- ❌ Cookie-banner with pre-checked checkboxes — illegal under TTDSG §25.
- ❌ Cookie-banner with prominent "Accept" + tiny "Reject" link — dark-pattern, BGH explicitly disallows.
- ❌ Loading Google Analytics before consent — DSGVO violation.
- ❌ Pre-loading any tracker before consent — TTDSG §25 violation.
