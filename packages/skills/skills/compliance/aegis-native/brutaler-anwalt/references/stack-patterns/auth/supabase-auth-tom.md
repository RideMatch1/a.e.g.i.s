---
license: MIT (snippet) / Vendor-Doc separat
provider: Supabase Inc. (Delaware, USA)
provider-AVV-status: Standardvertrag verfügbar (DPA + EU-SCC)
last-checked: 2026-05-01
---

# Supabase Auth — TOMs + DPA + DSE-Wording

## 1. Default-Verhalten ohne Konfiguration

- Datenstandort konfigurierbar (eu-central-1 / eu-west-2 / ap-southeast-1 / us-east-1 / etc.)
- **Default-Cookie**: `sb-<project>-auth-token`, HttpOnly, Secure, SameSite=Lax (in @supabase/ssr v0.5+)
- Authentifizierungs-Daten in PostgreSQL-Schema `auth` mit RLS
- Sub-Auftragsverarbeiter: AWS (Hosting), CloudFlare (CDN), Stripe (Billing für Pro-Tier)

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|--------|---------|-----|
| Default-Region us-east-1 | Drittland-Transfer USA | EU-Region setzen (eu-central-1 = Frankfurt) |
| Sub-Processor AWS | weiterer Transfer | DPA-Sub-Liste anhängen |
| `auth.users.email` ohne Verschlüsselung | DSGVO Art. 32 — minimal-akzeptabel | Plus: PII-pseudonymized columns |
| Magic-Link via E-Mail | Phishing-Risiko | DMARC + SPF + DKIM auf custom-Sending-Domain |

## 3. Code-Pattern (sanitized)

```ts
// File: src/lib/supabase/client.ts
// SSR-safe pattern with @supabase/ssr v0.5+
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce', // PKCE statt implicit — Pflicht für Sicherheit
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookies: {
        // Cookie-Hardening
        sameSite: 'lax',
        secure: true,
      },
    },
  );
```

```sql
-- Pflicht: RLS auf jeder Tabelle die User-Daten enthält
ALTER TABLE public.<your_table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
ON public.<your_table>
FOR SELECT
USING (user_id = auth.uid());

-- Anti-Pattern (KEINE!) für public-schema RPCs:
-- CREATE FUNCTION public.foo(p_user_id uuid) ... SECURITY DEFINER
-- → CWE-863 Anti-Pattern (siehe AEGIS rls-defense skill)
```

## 4. AVV / DPA

- **DPA-Link**: https://supabase.com/legal/dpa
- **SCC-Modul**: Module 2 (Controller-Processor) + Module 3 für Sub-Processors
- **AVV-Stand**: 2024-Q1 (mit DPF-Erweiterung)
- **Sub-Processors**: https://supabase.com/legal/sub-processors

## 5. DSE-Wording-Vorlage

> Wir nutzen den Auth- und Datenbank-Service von Supabase Inc. (970 Toa
> Payoh North #07-04, Singapur 318992, mit Headquarters in Delaware/USA)
> als Auftragsverarbeiter im Sinne von Art. 28 DSGVO. Daten werden in
> der EU-Region (Frankfurt, eu-central-1) gespeichert. Für unvermeidbare
> Datenübermittlungen in die USA (Stripe-Billing, US-Sub-Processors)
> haben wir EU-Standardvertragsklauseln (Modul 2/3) abgeschlossen.
> Datenschutzhinweise von Supabase: https://supabase.com/privacy.

## 6. Verify-Commands

```bash
# Region-Check
curl -s "https://<project>.supabase.co/rest/v1/" \
  -H "apikey: $ANON_KEY" -I | grep -i "region\|x-region"

# Cookie-Inspection
curl -sI https://<your-domain>/api/auth/callback | grep -i set-cookie
# erwarte: HttpOnly, Secure, SameSite=Lax

# RLS-Probe (anon-Token darf NICHT alle rows sehen)
curl -s "https://<project>.supabase.co/rest/v1/<table>?select=*" \
  -H "apikey: $ANON_KEY" | jq 'length'
# erwarte: 0 (anon hat keine Rows ohne Login)
```

## 7. Az.-Anker

- AEGIS-Lessons: 21 CWE-863 IDOR-Vulns aus public-schema-SECURITY-DEFINER-RPCs (operativer Audit 2026-04-29 einer Pet-Care-Plattform)
- Pattern: SECURITY-DEFINER-Functions in `public` brauchen `auth.uid()`-Guard + REVOKE FROM PUBLIC
