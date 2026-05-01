---
license: MIT (snippet)
provider: NextAuth.js / Auth.js (selbstgehostet)
provider-AVV-status: nicht relevant (Self-hosted Library)
last-checked: 2026-05-01
---

# NextAuth.js / Auth.js — Self-hosted Auth + DSE-Wording

## 1. Default-Verhalten

- Self-hosted Library (npm: `next-auth` v4 / `@auth/nextjs` v5)
- Sessions: **JWT (default)** ODER Database-Sessions
- Cookie: `next-auth.session-token`, HttpOnly, Secure, SameSite=Lax
- Provider-Drittland-Risiken nur durch externe Auth-Provider (Google/GitHub/Apple)

## 2. Compliance-Risiken (typische Konfigurationsfehler)

| Risiko | Wirkung | Fix |
|--------|---------|-----|
| `JWT_SECRET` in Repo | Vollständiger Auth-Bruch | env-only + Secret-Rotation |
| OAuth-Callback ohne CSRF-Token-Validierung | CSRF-Bug | Default-Verhalten von next-auth nutzen, NICHT custom |
| Session-Cookie ohne `Secure` | Session-Hijack über HTTP | `cookies.sessionToken.options.secure: true` |
| OAuth-Provider USA (Google, Apple, GitHub) | Drittland | DSE-Erwähnung pro Provider |
| Magic-Link via E-Mail (Email Provider) | Phishing | DKIM + SPF + DMARC + Rate-Limit |

## 3. Code-Pattern (Auth.js v5, sanitized)

```ts
// File: src/auth.ts (Auth.js v5)
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Resend({ from: 'no-reply@<your-domain>' }),
  ],
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 }, // 30 Tage
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login?error',
  },
  events: {
    async signIn({ user }) {
      // Audit-Log
      await prisma.authLog.create({
        data: { userId: user.id, event: 'sign_in', timestamp: new Date() },
      });
    },
  },
});
```

## 4. DSE-Wording-Vorlage

> **Authentifizierung (NextAuth / Auth.js).** Für die Anmeldung an
> unserem Dienst nutzen wir die Open-Source-Library NextAuth.js (selbst
> auf unseren EU-Servern gehostet). Wir bieten folgende Anmeldemethoden:
>
> - **E-Mail-Magic-Link** (E-Mail-Versand via Resend / All-Inkl-SMTP, je nach Konfiguration).
> - **Google-Login** (Google Ireland Limited / Google LLC, USA — Drittland-Transfer mit DPF + SCC).
> - **GitHub-Login** (GitHub Inc., USA — Drittland-Transfer mit DPF + SCC).
> - **Apple Sign-In** (Apple Distribution International, Irland).
>
> Bei Nutzung eines OAuth-Providers (Google / GitHub / Apple) werden
> Daten an den jeweiligen Anbieter übermittelt. Rechtsgrundlage: Art. 6
> Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie für Drittlandtransfer
> Art. 45/46 DSGVO. Wir speichern lokal: Provider-User-ID, E-Mail,
> Profilbild-URL (sofern vom Provider freigegeben), Login-Zeitpunkt.

## 5. Verify-Commands

```bash
# Cookie-Inspektion nach Login
curl -sI -b /tmp/auth-cookies.txt -c /tmp/auth-cookies.txt \
  https://<your-domain>/api/auth/session
# erwarte: __Secure-next-auth.session-token mit HttpOnly, Secure, SameSite=Lax

# CSRF-Token-Endpoint (next-auth's automatic CSRF-Schutz)
curl -s https://<your-domain>/api/auth/csrf | jq .csrfToken
# erwarte: 64-char Token

# Brute-Force-Test (manuell — sollte nach 5 Versuchen drosseln)
# Implementiere selbst Rate-Limit auf /api/auth/callback/credentials
```

## 6. Az.-Anker

- LG Berlin II 97 O 81/23 (Passwort-Identifikation, 27.11.2024)
- DSGVO Art. 32 (TOMs für Auth-Cookies — HttpOnly + Secure + SameSite)
