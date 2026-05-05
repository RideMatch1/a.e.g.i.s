---
status: skeleton
purpose: Pro Tech-Stack ein Pattern-File mit Code-Snippet (sanitized) + AVV-/DPA-Quelle + DSE-Wording-Vorlage + bekannte Risiken.
maintainer-note: Auto-Loading-Architektur in SKILL.md ruft diese Files via grep package.json. Befuell-Plan unten.
---

# `references/stack-patterns/` — Skeleton + Befuell-Plan

> Status: **skeleton**. Ziel: pro Stack-Komponente (Framework, Auth-Provider,
> Payment-Provider, Tracking-Provider, AI-Provider) ein Pattern-File mit:
> - Code-Snippet (sanitized — keine Brand-Refs)
> - AVV-/DPA-Quelle des Vendors
> - DSE-Wording-Vorlage (Block-Vorschlag fuer Datenschutzerklaerung)
> - Bekannte Risiken (Drittland, Cookies, Default-Cloud-Settings)
> - Verify-Commands

## Befuell-Reihenfolge

### Frameworks (Foundation)
- [ ] `nextjs/proxy-csp-pattern.md` — Strict-Dynamic-CSP via middleware (siehe templates/proxy-strict-dynamic.ts.example)
- [ ] `nextjs/env-driven-tracking.md` — UmamiScript-Pattern (siehe templates/UmamiScript.tsx.example)
- [ ] `nextjs/dynamic-rendering-headers.md` — `force-dynamic`, `revalidate`, no-cache
- [ ] `nextjs/api-route-bearer-auth.md` — Cron-Routes (siehe templates/data-retention-cron.ts.example)
- [ ] `react/cookie-banner-pattern.md` — Pre-consent-Tracker-Gate
- [ ] `react/consent-gate-pattern.md` — useConsent-Hook
- [ ] `vue/cookie-banner-pattern.md`
- [ ] `astro/cookie-banner-pattern.md`
- [ ] `svelte/cookie-banner-pattern.md`
- [ ] `laravel/cookie-banner-pattern.md`
- [ ] `rails/cookie-banner-pattern.md`
- [ ] `django/cookie-banner-pattern.md`
- [ ] `flask/cookie-banner-pattern.md`
- [ ] `fastapi/cookie-banner-pattern.md`
- [ ] `express/cookie-banner-pattern.md`
- [ ] `nest/cookie-banner-pattern.md`
- [ ] `strapi/cms-pii-pattern.md`

### Auth-Provider
- [ ] `auth/supabase-auth-tom.md` — bcrypt, RLS, MFA-Optional, Audit-Log
- [ ] `auth/nextauth-tom.md` — JWT vs Session, CSRF-Token-Rotate
- [ ] `auth/auth0-tom.md` — Drittland (US) + DPA-Link
- [ ] `auth/clerk-tom.md` — Drittland (US) + DPA-Link + EU-Region-Setting
- [ ] `auth/custom-jwt-tom.md` — KMS, Key-Rotation, RS256-Pflicht

### Payment-Provider
- [ ] `payment/stripe-pci-tom.md` — PCI-DSS via Stripe-hosted, Webhook-Sig-Verify
- [ ] `payment/lemonsqueezy-tom.md` — EU-VAT-Handling
- [ ] `payment/paddle-tom.md` — Merchant-of-Record-Modell
- [ ] `payment/mollie-tom.md` — EU-Anbieter, SEPA
- [ ] `payment/paypal-tom.md` — Drittland (US) + DPA

### Tracking-Provider
- [ ] `tracking/plausible-pattern.md` — cookieless, EU-gehostet
- [ ] `tracking/umami-pattern.md` — selbst-gehostet, cookieless
- [ ] `tracking/google-analytics-consent.md` — GA4, IP-Anonym, Consent-Mode v2, Drittland
- [ ] `tracking/mixpanel-consent.md` — Drittland (US), opt-in only
- [ ] `tracking/posthog-consent.md` — EU-Region verfuegbar
- [ ] `tracking/fathom-pattern.md` — cookieless, EU-Mode

### AI-Provider
- [ ] `ai/openai-dpa.md` — DPA-Link, EU-Data-Boundary-Settings, Trainings-Opt-Out
- [ ] `ai/anthropic-dpa.md` — DPA-Link, Drittland-Mechanismus
- [ ] `ai/mistral-eu.md` — EU-Anbieter (FR), AI-Act-Hochrisiko-Mapping
- [ ] `ai/replicate-dpa.md` — Drittland (US)
- [ ] `ai/self-hosted-llm.md` — On-Prem (Ollama, vLLM, LocalAI) — KEIN Drittland-Trigger

## Format pro File (Vorlage)

```markdown
---
license: MIT (snippet) / vendor-doc-Quellen separat lizenziert
provider: <Vendor-Name>
provider-AVV-status: <Standardvertrag verfuegbar / on-request / nicht verfuegbar>
last-checked: <YYYY-MM-DD>
---

# <Stack-Komponente> — Pattern fuer brutaler-anwalt-Audit

## 1. Default-Verhalten (was passiert ohne Konfiguration)

<z.B.: Default-Region = US, Default-Cookies = on, Default-IP-Anonymisierung = off>

## 2. Compliance-Risiken

| Risiko | Auswirkung | Fix |
|--------|-----------|-----|
| Drittland | Schrems-II | Region setzen + SCC + TIA |
| Cookies | § 25 TDDDG | Consent-Mode oder cookieless |
| Default-Logs | Art. 5 DSGVO | Anonymisierung, Loeschfristen |

## 3. Code-Pattern (sanitized)

```ts
// Brand-agnostisch, mit <placeholder> fuer Operator-Werte
```

## 4. AVV / DPA

- DPA-Link: <URL beim Vendor>
- AVV-Stand: <Datum>
- Sub-Auftragsverarbeiter: <Liste oder Verweis>

## 5. DSE-Wording-Vorlage

> Block fuer eigene Datenschutzerklaerung mit Pflicht-Inhalt.

## 6. Verify-Commands

```bash
# Live-Probe gegen die Domain mit dem Stack-Element
```

## 7. Az.-Anker (wenn vorhanden)

- BGH/OLG/EuGH-Urteil mit Az. + Source-URL
```

## NICHT-Inhalt dieser Files

- KEINE Vendor-Disclosure (nur faktische Compliance-Sicht)
- KEIN Marketing oder Kaufempfehlung
- KEINE alternativen Provider-Vergleiche (das macht der Skill-Output, nicht die Reference)
