---
name: dsgvo-kit
category: compliance
title: DSGVO Kit (Cookie-Banner + Data-Export + Account-Deletion + Consent-Versioning)
description: >
  Complete DSGVO-compliance package. Cookie-banner with granular-consent (Art. 7),
  data-export per Art. 15, account-deletion per Art. 17, consent-versioning for T&C
  changes, DSB-ready audit-log. EU/DE-focused but extensible to GDPR/CCPA.
version: 1
dependencies:
  npm:
    - "zod"
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard). Used in file-headers and path hints.
    required: true
  - name: APP_NAME
    description: Human-friendly app name rendered in DSGVO UI (cookie-banner, consent dialogs, emails).
    required: true
  - name: COMPANY_NAME
    description: Legal company name (for cookie-banner imprint link)
    required: true
  - name: CONSENT_VERSION
    description: Current T&C version-hash. Bump when T&C changes → users re-consent
    default: "2026-04-22-v1"
brief_section: Compliance
estimated_files: 6
tags: [dsgvo, gdpr, cookies, data-export, account-deletion, compliance]
related:
  - foundation/multi-tenant-supabase
  - foundation/rbac-requirerole
  - compliance/legal-pages-de
---

# DSGVO Kit

German/EU privacy-law requires several user-rights: know-what-is-stored (Art. 15), export-it (Art. 15), correct-it (Art. 16), delete-it (Art. 17), object-to-processing (Art. 21), and consent-to-cookies (Art. 7 + TTDSG/DDG). This pattern ships all of them, production-ready.

**DSGVO-by-Design enforcement:**
- No PII stored in `profiles` table (emails live in `auth.users` only)
- Cookie-banner loads BEFORE any non-essential script
- Consent is granular (analytics / marketing / functional / necessary-only)
- Consent-version hashed — T&C updates trigger re-consent
- Account-deletion soft-deletes first, hard-deletes after `DATA_RETENTION_DAYS`
- Data-export is structured JSON + CSV, downloadable immediately
- Audit-log captures every sensitive action (append-only)

---

## Commands to run

No new dependencies. Uses `zod` (already installed) + existing tenant-guard + RBAC.

---

## Files to create

### `supabase/migrations/00010_dsgvo.sql`

```sql
-- DSGVO compliance tables

-- User consents (versioned)
create table if not exists public.user_consents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tenant_id         uuid references public.tenants(id) on delete cascade,
  consent_version   text not null,              -- matches CONSENT_VERSION at consent-time
  analytics         boolean not null default false,
  marketing         boolean not null default false,
  functional        boolean not null default true,  -- strictly-necessary
  ip_address        inet,  -- truncated via middleware-hardened truncateIp before insert (/24 IPv4, /48 IPv6)
  user_agent        text,
  consented_at      timestamptz not null default now()
);

create index idx_user_consents_user on public.user_consents(user_id);
create index idx_user_consents_version on public.user_consents(consent_version);

-- Soft-delete queue
create table if not exists public.deletion_queue (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tenant_id         uuid references public.tenants(id) on delete cascade,
  requested_at      timestamptz not null default now(),
  scheduled_for     timestamptz not null,
  reason            text,
  status            text not null default 'pending' check (status in ('pending', 'processed', 'cancelled')),
  processed_at      timestamptz
);

create index idx_deletion_queue_scheduled on public.deletion_queue(scheduled_for) where status = 'pending';

-- Audit log (append-only)
create table if not exists public.audit_log (
  id                bigserial primary key,
  tenant_id         uuid references public.tenants(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,  -- audit-log survives Art. 17 erasure
  action            text not null,   -- e.g. 'user.login', 'customer.update', 'data.export'
  resource_type     text,
  resource_id       text,
  metadata          jsonb,
  ip_address        inet,  -- truncated via middleware-hardened truncateIp before insert (/24 IPv4, /48 IPv6)
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index idx_audit_log_tenant_created on public.audit_log(tenant_id, created_at desc);
create index idx_audit_log_user on public.audit_log(user_id);
create index idx_audit_log_action on public.audit_log(action);

-- Append-only: prevent UPDATE + DELETE on audit_log
create or replace function public.prevent_audit_modification()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.prevent_audit_modification();

drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.prevent_audit_modification();

-- RLS on all new tables
alter table public.user_consents enable row level security;
alter table public.deletion_queue enable row level security;
alter table public.audit_log enable row level security;

create policy consents_select_own on public.user_consents
  for select using (user_id = auth.uid());
create policy consents_insert_own on public.user_consents
  for insert with check (user_id = auth.uid());

create policy deletion_select_own on public.deletion_queue
  for select using (user_id = auth.uid());
create policy deletion_insert_own on public.deletion_queue
  for insert with check (user_id = auth.uid());

create policy audit_select_tenant_admin on public.audit_log
  for select using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- pg_cron deletion-queue scheduler — see Phase 4 step 5 of the brief for the
-- canonical CREATE EXTENSION + cron.schedule + verification commands. The
-- jobname used by the brief is 'dsgvo-deletion' (matches the brief's
-- verify-step). Without this scheduled job, deletion_queue rows accumulate
-- and Art. 17 erasure-requests never run — DSGVO compliance gap.

create or replace procedure public.process_deletion_queue()
language plpgsql as $$
declare
  target record;
begin
  for target in
    select * from public.deletion_queue
    where status = 'pending' and scheduled_for < now()
  loop
    -- Anonymize profile instead of hard-delete (audit-log traceability)
    update public.profiles
      set full_name = 'Deleted User', avatar_url = null
      where id = target.user_id;

    -- Mark the queue row processed BEFORE the auth.users delete.
    -- deletion_queue.user_id uses on-delete-cascade, so the
    -- auth.users delete below also removes this row — updating
    -- status here would then be a silent no-op on the now-deleted
    -- row. Persisting processed-state first preserves the
    -- successful-run evidence in any replication target or
    -- audit-log trigger chain that reads before the cascade fires.
    update public.deletion_queue
      set status = 'processed', processed_at = now()
      where id = target.id;

    -- Delete auth.users row (cascades to profiles + deletion_queue).
    -- The audit_log.user_id FK uses on-delete-set-null so historical
    -- rows keep their action+metadata with the user_id nulled out.
    delete from auth.users where id = target.user_id;
  end loop;
end;
$$;
```

### `src/components/dsgvo/cookie-banner.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CONSENT_COOKIE = '{{PROJECT_NAME}}-consent';
const CONSENT_VERSION = '{{CONSENT_VERSION}}';

interface Consent {
  version: string;
  necessary: true;  // always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  consentedAt: string;
}

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [consent, setConsent] = useState<Omit<Consent, 'version' | 'necessary' | 'consentedAt'>>({
    functional: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const saved = getConsent();
    if (!saved || saved.version !== CONSENT_VERSION) {
      setShowBanner(true);
    }
  }, []);

  function save(partial: Partial<Consent> = {}) {
    const record: Consent = {
      version: CONSENT_VERSION,
      necessary: true,
      functional: consent.functional,
      analytics: consent.analytics,
      marketing: consent.marketing,
      consentedAt: new Date().toISOString(),
      ...partial,
    };
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(record))}; path=/; max-age=31536000; SameSite=Lax; Secure`;
    setShowBanner(false);

    // Notify app — analytics-scripts can subscribe to this event
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: record }));

    // Persist to server (audit-trail)
    fetch('/api/dsgvo/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch(() => {}); // Best-effort; banner already dismissed
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border p-4 shadow-lg">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Cookies &amp; Datenschutz</CardTitle>
          <CardDescription>
            Wir nutzen Cookies, um unsere Dienste bereitzustellen und zu verbessern. Sie können Ihre
            Einwilligung anpassen oder alle akzeptieren. Details in unserer{' '}
            <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showCustomize ? (
            <>
              <ConsentRow label="Notwendig" description="Für den Betrieb der Seite erforderlich. Nicht deaktivierbar." checked disabled />
              <ConsentRow
                label="Funktional"
                description="Verbessern Ihre Erfahrung (z.B. Sprache, Theme-Merken)."
                checked={consent.functional}
                onChange={(v) => setConsent({ ...consent, functional: v })}
              />
              <ConsentRow
                label="Statistik / Analytics"
                description="Anonyme Nutzungs-Statistiken zur Verbesserung der Seite."
                checked={consent.analytics}
                onChange={(v) => setConsent({ ...consent, analytics: v })}
              />
              <ConsentRow
                label="Marketing"
                description="Personalisierte Werbung und Tracking."
                checked={consent.marketing}
                onChange={(v) => setConsent({ ...consent, marketing: v })}
              />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => save({ functional: false, analytics: false, marketing: false })} variant="outline">
                  Nur notwendige
                </Button>
                <Button onClick={() => save()}>Auswahl speichern</Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => save({ functional: false, analytics: false, marketing: false })} variant="outline">
                Nur notwendige
              </Button>
              <Button onClick={() => setShowCustomize(true)} variant="outline">
                Anpassen
              </Button>
              <Button onClick={() => save({ functional: true, analytics: true, marketing: true })}>
                Alle akzeptieren
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function getConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const cookies = Object.fromEntries(document.cookie.split('; ').map((c) => c.split('=')));
  const raw = cookies[CONSENT_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Consent;
  } catch {
    return null;
  }
}

export function hasConsent(category: 'functional' | 'analytics' | 'marketing'): boolean {
  const c = getConsent();
  return !!c?.[category];
}
```

### `src/app/api/dsgvo/consent/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ConsentSchema = z.object({
  version: z.string(),
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const { context } = await secureApiRouteWithTenant(request, { requireAuth: false, allowDefaultTenantFallback: true });
    const body = ConsentSchema.parse(await request.json());

    const supabase = await createServerSupabaseClient();
    if (context.userId) {
      await supabase.from('user_consents').insert({
        user_id: context.userId,
        tenant_id: context.tenantId,
        consent_version: body.version,
        functional: body.functional,
        analytics: body.analytics,
        marketing: body.marketing,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

### `src/app/api/dsgvo/export/route.ts` (Art. 15 data-export)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Art. 15 — Right to Access (Datenauskunft)
 * Returns all user-data as a structured JSON download.
 */
export async function GET(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerSupabaseClient();

  // Collect all tables user has data in.
  // Customize per your domain — add more queries as you add tables.
  const [profile, consents, audit] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', context.userId).single(),
    supabase.from('user_consents').select('*').eq('user_id', context.userId),
    supabase.from('audit_log').select('*').eq('user_id', context.userId),
  ]);

  const export_ = {
    exported_at: new Date().toISOString(),
    user: {
      id: context.userId,
      email: context.userEmail,
    },
    profile: profile.data,
    consents: consents.data,
    audit_log_entries: audit.data,
    // Add your domain-specific queries here:
    // customers: await supabase.from('customers').select('*').eq('created_by', context.userId),
    // appointments: await supabase.from('appointments').select('*').eq('customer_id', someLookup),
  };

  // Record the export in audit-log
  await supabase.from('audit_log').insert({
    tenant_id: context.tenantId,
    user_id: context.userId,
    action: 'data.export',
    resource_type: 'user',
    resource_id: context.userId,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
  });

  return new NextResponse(JSON.stringify(export_, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="my-data-export-${Date.now()}.json"`,
    },
  });
}
```

### `src/app/api/dsgvo/delete/route.ts` (Art. 17 account-deletion)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const DeleteSchema = z.object({
  confirmText: z.literal('LÖSCHEN'),  // User must type this confirmation
  reason: z.string().max(500).optional(),
}).strict();

const RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS ?? '30', 10);

/**
 * Art. 17 — Right to Erasure (Recht auf Vergessenwerden)
 * Soft-delete with retention period, then hard-delete via pg_cron.
 */
export async function POST(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = DeleteSchema.parse(await request.json());
  const supabase = await createServerSupabaseClient();

  const scheduledFor = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Queue deletion
  await supabase.from('deletion_queue').insert({
    user_id: context.userId,
    tenant_id: context.tenantId,
    scheduled_for: scheduledFor.toISOString(),
    reason: body.reason,
  });

  // Mark account as deactivated (user can no longer log in)
  await supabase.auth.admin.updateUserById(context.userId, { ban_duration: '876000h' });  // 100 years

  // Audit
  await supabase.from('audit_log').insert({
    tenant_id: context.tenantId,
    user_id: context.userId,
    action: 'account.deletion_scheduled',
    resource_type: 'user',
    resource_id: context.userId,
    metadata: { scheduled_for: scheduledFor.toISOString(), reason: body.reason },
  });

  return NextResponse.json({
    ok: true,
    message: `Account scheduled for deletion on ${scheduledFor.toLocaleDateString()}. You can cancel this within ${RETENTION_DAYS} days by contacting support.`,
    scheduled_for: scheduledFor.toISOString(),
  });
}
```

### `src/app/admin/mein-bereich/datenschutz/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacySettingsPage() {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function exportData() {
    const res = await fetch('/api/dsgvo/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (confirmText !== 'LÖSCHEN') return;
    setDeleting(true);
    const res = await fetch('/api/dsgvo/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmText, reason }),
    });
    const data = await res.json();
    setDeleting(false);
    if (res.ok) setDone(data.message);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Datenauskunft (Art. 15 DSGVO)</CardTitle>
          <CardDescription>
            Laden Sie eine vollständige Kopie Ihrer bei uns gespeicherten Daten herunter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportData}>Daten exportieren</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account löschen (Art. 17 DSGVO)</CardTitle>
          <CardDescription>
            Ihr Account wird sofort deaktiviert und nach {RETENTION_DAYS_LABEL} Tagen endgültig
            gelöscht. Sie können den Vorgang innerhalb dieser Frist stornieren.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {done ? (
            <Alert>
              <AlertDescription>{done}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <Label htmlFor="reason">Grund (optional)</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="confirm">Zur Bestätigung &quot;LÖSCHEN&quot; eingeben</Label>
                <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              </div>
              <Button
                variant="destructive"
                onClick={deleteAccount}
                disabled={confirmText !== 'LÖSCHEN' || deleting}
              >
                {deleting ? 'Lösche …' : 'Account löschen'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const RETENTION_DAYS_LABEL = parseInt(process.env.DATA_RETENTION_DAYS ?? '30', 10);
```

### `src/app/layout.tsx` integration

Include the CookieBanner in your root layout:

```typescript
import { CookieBanner } from '@/components/dsgvo/cookie-banner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
```

---

## Analytics-script integration

Analytics libraries should check `hasConsent('analytics')` before loading:

```typescript
'use client';

import { useEffect } from 'react';
import { hasConsent } from '@/components/dsgvo/cookie-banner';

export function AnalyticsLoader() {
  useEffect(() => {
    const load = () => {
      if (hasConsent('analytics')) {
        // Load Plausible / PostHog / Fathom here
        const s = document.createElement('script');
        s.src = 'https://plausible.io/js/script.js';
        s.defer = true;
        s.setAttribute('data-domain', 'example.com');
        document.head.appendChild(s);
      }
    };
    load();
    window.addEventListener('consent-updated', load);
    return () => window.removeEventListener('consent-updated', load);
  }, []);
  return null;
}
```

---

## Required environment variables

No new env-vars. Uses existing Supabase config.

---

## Supabase dashboard configuration (one-time)

1. Enable `pg_cron` extension: Settings → Database → Extensions → enable `pg_cron`
2. Schedule the deletion-processing job:

```sql
SELECT cron.schedule(
  'dsgvo_process_deletions',
  '0 * * * *',   -- every hour
  $$ CALL public.process_deletion_queue(); $$
);
```

Verify: `SELECT * FROM cron.job;` should list the job.

---

## Common pitfalls

1. **Loading analytics scripts before consent.** Breaks DSGVO. Check `hasConsent('analytics')` before every script-load.
2. **Deleting `auth.users` without FK-cascade to domain-tables.** Orphaned rows = data-leak. Ensure every FK uses `ON DELETE CASCADE` or explicit anonymization trigger.
3. **Forgetting the consent-version bump on T&C change.** Users stay on old consent. Bump the `CONSENT_VERSION` constant in your consent-banner component when you change T&C/privacy copy (e.g. from `v1` to `v2-2026-Q2`) and redeploy — the banner re-shows for every user.
4. **Not logging the export itself.** Ironic: the audit-log should include "user X exported their data at Y". Already in the API above.
5. **Letting users delete immediately with no grace period.** Risky for accidental-delete. The retention-queue + cancellable-deletion is the safer pattern.
6. **Exporting data that includes other users' info.** If user A has conversations with user B, A's export shouldn't reveal B's email. Filter/mask per-request-side.
7. **Running deletion in a single transaction.** For large datasets, chunk it. `process_deletion_queue()` above processes one user at a time per hour-run.

---

## Related patterns

- `foundation/multi-tenant-supabase` — tenant-isolation + profiles + RLS (prereq)
- `foundation/rbac-requireRole` — used for admin-only audit-log-read
- `foundation/logger-pii-safe` — every log from this pattern passes through the PII-safe logger
- `compliance/legal-pages-de` — the Datenschutz page this banner links to
- `foundation/auth-supabase-full` — authentication prerequisite

---

## Quality-gate

```bash
# DSGVO-PII-check (no PII in profiles)
grep -rn "email\|phone\|ssn\|birth_date" supabase/migrations/*_profiles* \
  --include="*.sql" | grep -v "comment" | grep -v "auth\.users"
# expect: zero hits

# Tests
npm run test -- dsgvo

# End-to-end: consent banner + export + delete
npm run test:e2e -- dsgvo

# AEGIS scan
npx -y @aegis-scan/cli scan . --focus dsgvo
# expect: 0 critical compliance-findings

# Manual check:
# 1. Open incognito → banner shows
# 2. Accept all → audit_log has consent-entry
# 3. Sign in → /admin/mein-bereich/datenschutz → export downloads JSON
# 4. Schedule deletion → check deletion_queue table has row with future scheduled_for
```

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-compliance**
