---
license: MIT (snippet) / Vendor-Doc separat
provider: Clerk (Clerk Inc., USA)
provider-AVV-status: Standardvertrag verfuegbar (DPA + EU-SCC)
last-checked: 2026-05-02
purpose: Clerk TOMs + DPA + DSE-Wording.
---

# Clerk — TOMs + DPA + DSE-Wording

## 1. Default-Verhalten

- Datenstandort: US (default)
- EU-Region verfuegbar via Setting (frankfurt-1)
- Sub-Auftragsverarbeiter: AWS, CloudFlare
- Cookies: `__session`, `__client`, `__refresh` — HttpOnly / Secure / SameSite=Lax

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Default-Region US | Drittland-Transfer | EU-Region setzen (Dashboard > Settings > Region) |
| Sub-Processor AWS | weiterer Transfer | DPA-Sub-Liste anhaengen |
| MFA-Default off | Auth-Sicherheit | MFA aktivieren |

## 3. Code-Pattern (Next.js)

```ts
// File: src/middleware.ts
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: ['/', '/datenschutz', '/impressum'],
  ignoredRoutes: ['/api/health'],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

```tsx
// File: src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      // EU-Region via Dashboard-Setting; URL muss frankfurt-1 sein
      appearance={{ /* ... */ }}
    >
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

## 4. EU-Region aktivieren

Dashboard-Setting:
- Settings > Region > Frankfurt
- Bei Migration aus US: Daten-Migration via Clerk-Support

## 5. AVV / DPA

- **DPA-Link**: https://clerk.com/legal/dpa
- **SCC-Modul**: Module 2
- **Sub-Processors**: https://clerk.com/legal/subprocessors

## 6. DSE-Wording-Vorlage

> Wir nutzen den Identity-Service Clerk (Clerk Inc., 660 King St, San Francisco, USA)
> als Auftragsverarbeiter im Sinne von Art. 28 DSGVO. Datenstandort: EU-Region (Frankfurt-1).
> EU-SCC Modul 2 abgeschlossen. Datenschutzhinweise von Clerk: https://clerk.com/legal/privacy-notice.

## 7. Verify

```bash
# Region-Check
curl -sI "https://<your-clerk-domain>/api/v1/region" | grep -i "X-Region"
# Erwartung: frankfurt-1
```
