---
license: MIT (snippet)
provider: Next.js (Vercel) — Framework
last-checked: 2026-05-02
purpose: Pattern fuer korrekt-konfigurierte Dynamic-Rendering + Cookie/Headers-Read.
---

# Next.js — Dynamic-Rendering + Headers (Pattern)

## 1. Default-Verhalten

Next.js (App-Router) versucht **Static-Rendering** wo moeglich. Wenn Component `cookies()`, `headers()`, `searchParams` liest, wird automatisch dynamic.

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Static-Render mit Veraltetem Stand-Datum | DSE Z. 1 zeigt 2024 obwohl Code 2026 | `force-dynamic` oder ISR |
| Cookie-Read in Static-Path | Funktion-Aufruf-Fehler in Build | `dynamic = 'force-dynamic'` |
| GET-Form ohne Headers-Read | CSRF-Anfaelligkeit | `cookies()` auslesen |

## 3. Code-Pattern

```ts
// File: src/app/datenschutz/page.tsx
export const dynamic = 'force-dynamic';  // Pflicht wenn DSE Stand-Datum aktuell sein muss

export default async function DSE() {
  const dseStand = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  return (
    <main>
      <h1>Datenschutzerklaerung</h1>
      <p>Stand: {dseStand}</p>
      ...
    </main>
  );
}
```

```ts
// File: src/app/api/csrf/route.ts (CSRF-Token-Handler)
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = randomBytes(32).toString('hex');
  cookies().set({
    name: 'csrf-token',
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60,
  });
  return Response.json({ token });
}
```

## 4. Anti-Pattern (NICHT)

```ts
// ❌ NICHT — Static-Render mit hardcoded Datum
export default function DSE() {
  return <p>Stand: 25.04.2024</p>;
  // Drift-Style 2 (Falschangabe)
}
```

## 5. Verify

```bash
# Verify dass DSE Stand-Datum aktuell ist
curl -s https://example.com/datenschutz | grep -oE "Stand:[^<]{0,30}"
# Erwartung: aktueller Monat
```

## 6. Cross-Reference

- Audit-Pattern Phase 4 (DSE-Drift-Audit, Stand-Datum-Hygiene)
- audit-patterns.md Phase 4
