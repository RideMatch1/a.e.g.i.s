---
name: i18n-next-intl
category: foundation
title: Internationalization with next-intl (DE + EN)
description: >
  Locale-routing (/de/… + /en/…), message-catalogs, server-component + client-component
  translation, language-switcher, timezone/date-formatting. Default languages DE + EN,
  extendable.
version: 1
dependencies:
  npm:
    - "next-intl"
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard). Used in file-headers and path hints.
    required: true
  - name: LOCALES_JSON
    description: JSON-encoded array of locale-codes the app ships (e.g. `["de", "en"]`).
    default: '["de", "en"]'
    type: json
  - name: DEFAULT_LOCALE
    description: Fallback locale
    default: "de"
brief_section: Foundation
estimated_files: 7
tags: [i18n, l10n, next-intl, de, en]
related:
  - foundation/multi-tenant-supabase
  - compliance/legal-pages-de
---

# Internationalization with next-intl

Next.js 16 App Router + `next-intl` is the canonical stack for i18n today. Lightweight, type-safe, SSR+RSC-compatible, minimal runtime cost.

**What you get:**
- URL-based locale routing: `/de/admin/dashboard`, `/en/admin/dashboard`
- Auto-detect + cookie-persist user-locale preference
- Type-safe translation keys (TypeScript-infers valid keys from JSON)
- Server-component + client-component translation functions
- Date + number + relative-time formatting per locale
- Pluralization + ICU-message-format
- Language-switcher UI

---

## Commands to run

```bash
npm install next-intl
```

---

## Files to create

### `src/i18n/routing.ts`

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: {{LOCALES_JSON}},    // ['de', 'en']
  defaultLocale: '{{DEFAULT_LOCALE}}',
  localePrefix: 'always',        // /de/… and /en/…, never bare paths
  pathnames: {
    '/': '/',
    '/admin/dashboard': {
      de: '/admin/dashboard',
      en: '/admin/dashboard',
    },
    // Add aliases per locale if URL-names differ (e.g. /de/kontakt vs /en/contact)
  },
});

export type Locale = (typeof routing.locales)[number];
```

### `src/i18n/navigation.ts`

```typescript
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Thin wrappers around next/link + next/navigation for locale-aware routing
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

### `src/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // Resolve locale from URL / cookie / fallback
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Timezone affects Date formatting
    timeZone: 'Europe/Berlin',
    now: new Date(),
  };
});
```

### `src/middleware.ts` (extend existing middleware from `middleware-hardened`)

```typescript
// If you have an existing middleware.ts from middleware-hardened pattern,
// add the next-intl matcher alongside. Otherwise wrap existing middleware.

import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
// ... import existing security-middleware code from middleware-hardened pattern ...

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run security-headers + rate-limit + auth-gate first (from middleware-hardened)
  // ... existing code from middleware-hardened pattern ...

  // 2. Then i18n routing
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all except internals + static assets
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
    // Include locale-less paths for auto-redirect to default-locale
    '/',
  ],
};
```

**Note:** if the two middleware-purposes conflict, run security-headers first (applies to response), then use `NextResponse.rewrite()` to pass-through to `intlMiddleware`. See `next-intl/middleware` docs for composition-patterns.

### `messages/de.json`

```json
{
  "Navigation": {
    "home": "Start",
    "dashboard": "Dashboard",
    "customers": "Kunden",
    "appointments": "Termine",
    "settings": "Einstellungen",
    "logout": "Abmelden"
  },
  "Common": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "loading": "Lädt …",
    "error": "Ein Fehler ist aufgetreten",
    "success": "Erfolgreich gespeichert",
    "confirm": "Bestätigen",
    "search": "Suchen",
    "backToHome": "Zurück zur Startseite"
  },
  "Auth": {
    "login": "Anmelden",
    "signup": "Registrieren",
    "email": "E-Mail",
    "password": "Passwort",
    "forgotPassword": "Passwort vergessen?",
    "noAccountYet": "Noch kein Konto?",
    "createAccount": "Konto erstellen",
    "alreadyHaveAccount": "Bereits ein Konto?"
  },
  "Dashboard": {
    "welcome": "Willkommen, {name}",
    "totalCustomers": "Kunden gesamt",
    "newThisWeek": "Neue diese Woche",
    "revenue": "Umsatz",
    "lastUpdated": "Zuletzt aktualisiert {date}"
  },
  "Validation": {
    "required": "Pflichtfeld",
    "invalidEmail": "Ungültige E-Mail",
    "passwordTooShort": "Passwort zu kurz (min. 12 Zeichen)",
    "passwordComplexity": "Passwort benötigt Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen",
    "passwordsMustMatch": "Passwörter stimmen nicht überein"
  },
  "Errors": {
    "notFound": "Nicht gefunden",
    "unauthorized": "Nicht autorisiert",
    "forbidden": "Keine Berechtigung",
    "rateLimit": "Zu viele Anfragen",
    "serverError": "Server-Fehler"
  }
}
```

### `messages/en.json`

```json
{
  "Navigation": {
    "home": "Home",
    "dashboard": "Dashboard",
    "customers": "Customers",
    "appointments": "Appointments",
    "settings": "Settings",
    "logout": "Sign out"
  },
  "Common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading …",
    "error": "An error occurred",
    "success": "Saved successfully",
    "confirm": "Confirm",
    "search": "Search",
    "backToHome": "Back to home"
  },
  "Auth": {
    "login": "Sign in",
    "signup": "Create account",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot password?",
    "noAccountYet": "No account yet?",
    "createAccount": "Create an account",
    "alreadyHaveAccount": "Already have an account?"
  },
  "Dashboard": {
    "welcome": "Welcome, {name}",
    "totalCustomers": "Total customers",
    "newThisWeek": "New this week",
    "revenue": "Revenue",
    "lastUpdated": "Last updated {date}"
  },
  "Validation": {
    "required": "Required",
    "invalidEmail": "Invalid email",
    "passwordTooShort": "Password too short (min. 12 characters)",
    "passwordComplexity": "Password requires upper + lower case, digit, and special character",
    "passwordsMustMatch": "Passwords don't match"
  },
  "Errors": {
    "notFound": "Not found",
    "unauthorized": "Unauthorized",
    "forbidden": "Forbidden",
    "rateLimit": "Too many requests",
    "serverError": "Server error"
  }
}
```

### `next.config.ts` update

```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  // your existing config
};

export default withNextIntl(nextConfig);
```

### `src/app/[locale]/layout.tsx`

Move your root layout under a `[locale]` dynamic segment:

```typescript
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { setRequestLocale, getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### `src/components/language-switcher.tsx`

```typescript
'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LOCALE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function onSelect(newLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  return (
    <Select value={locale} onValueChange={onSelect} disabled={isPending}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((l) => (
          <SelectItem key={l} value={l}>
            {LOCALE_LABELS[l] ?? l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

## Usage examples

### In Server Components

```typescript
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('Dashboard');
  return (
    <div>
      <h1>{t('welcome', { name: 'Alice' })}</h1>
      <p>{t('totalCustomers')}</p>
    </div>
  );
}
```

### In Client Components

```typescript
'use client';

import { useTranslations } from 'next-intl';

export function SaveButton() {
  const t = useTranslations('Common');
  return <button>{t('save')}</button>;
}
```

### Date/Number formatting

```typescript
'use client';

import { useFormatter } from 'next-intl';

export function RevenueCard({ amount, asOf }: { amount: number; asOf: Date }) {
  const format = useFormatter();
  return (
    <div>
      <p>{format.number(amount, { style: 'currency', currency: 'EUR' })}</p>
      <p>{format.dateTime(asOf, { dateStyle: 'long' })}</p>
      <p>{format.relativeTime(asOf)}</p>
    </div>
  );
}
```

### Pluralization (ICU)

```json
// messages/en.json
{
  "Inbox": {
    "unread": "{count, plural, =0 {No unread messages} =1 {# unread message} other {# unread messages}}"
  }
}
```

```typescript
const t = useTranslations('Inbox');
t('unread', { count: 0 });  // "No unread messages"
t('unread', { count: 1 });  // "1 unread message"
t('unread', { count: 5 });  // "5 unread messages"
```

---

## Type-safe translations (optional but recommended)

Add `declarations/next-intl.d.ts`:

```typescript
import type messages from '../messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof messages;
  }
}
```

Now `t('SomeKeyThatDoesNotExist')` is a TypeScript-error at compile-time.

---

## Required environment variables

No new env-vars. `next-intl` reads config from `i18n/request.ts`.

---

## Translation-workflow for teams

- **Source-of-truth:** English (`messages/en.json`). Add all new keys here first.
- **Translator-tools:** Lokalise, Crowdin, Transifex integrate with JSON-files.
- **AI-assist:** For quick translations, feed `en.json` to an LLM with instructions "Translate all string-values to DE, preserve keys + ICU-patterns". Review with native speaker.
- **CI-check:** Fail-build if `en.json` and `de.json` have mismatched key-sets.

Ship a tiny checker-script:

```typescript
// scripts/i18n-check.ts
import enJson from '../messages/en.json';
import deJson from '../messages/de.json';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

const en = new Set(collectKeys(enJson));
const de = new Set(collectKeys(deJson));
const missing = [...en].filter((k) => !de.has(k));
const extra = [...de].filter((k) => !en.has(k));

if (missing.length || extra.length) {
  console.error('i18n mismatch:');
  if (missing.length) console.error('Missing in de:', missing);
  if (extra.length) console.error('Extra in de (unused):', extra);
  process.exit(1);
}

console.log('i18n keys match across all locales ✅');
```

Add to `package.json`:
```json
{
  "scripts": {
    "i18n:check": "tsx scripts/i18n-check.ts"
  }
}
```

---

## Common pitfalls

1. **Forgetting `setRequestLocale(locale)` in server-components.** Translations work but SSR-cache is sub-optimal.
2. **Hardcoded strings in components.** `<button>Save</button>` won't translate. Use `t('save')`.
3. **Not adding new keys to ALL locale-files.** `t('newKey')` in `en.json` without counterpart in `de.json` falls back to English — invisible-to-developer. Use `i18n:check` script.
4. **Date-formatting with JavaScript's `toLocaleString()` directly.** Inconsistent across browsers. Use `useFormatter` for predictable results.
5. **Route-level-redirect-loop.** If `pathname` includes locale and you use the raw `useRouter` (not `@/i18n/navigation`), the locale gets duplicated. Always use the wrapped `useRouter`.
6. **SEO: not setting `<html lang={locale}>` .** Loss of search-ranking-signal. The locale-layout above sets this.
7. **Marketing/landing-pages not translated.** If you translate only the admin area, your marketing-funnel leaks non-German users. Plan both at once.

---

## Related patterns

- `foundation/middleware-hardened` — the middleware that next-intl piggybacks on
- `foundation/multi-tenant-supabase` — per-tenant-locale preference stored in profile
- `compliance/legal-pages-de` — DE-legal-pages; EN-versions can be added under `/[locale]/impressum`

---

## Quality-gate

```bash
# i18n keys consistent across all locales
npm run i18n:check

# Build
npm run build

# Manual tests:
# - /de/admin/dashboard renders German
# - /en/admin/dashboard renders English
# - Language-switcher changes URL + content
# - Cookie-persist: refresh after switch → stays on chosen locale

# Type-safety
npx tsc --noEmit
# expect: no errors on translation keys (if type-safe setup complete)
```

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-foundation**
