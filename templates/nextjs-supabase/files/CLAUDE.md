# {{PROJECT_NAME}} — Project Instructions

Auto-generated from the AEGIS v{{AEGIS_VERSION}} scaffold template.
Edit freely — the scaffold is opinionated about security rules but
agnostic about product shape.

## Context

Multi-tenant SaaS built on Next.js and Supabase. Fill in the project-specific
context below (target users, key differentiators, current milestones) — this
file is the first thing AI assistants read before touching the code.

---

## Tech stack (do not change without discussion)

Next.js (App Router), React, TypeScript (strict), Tailwind CSS, Radix UI / shadcn,
Supabase Auth + PostgreSQL with Row-Level Security, Zustand, TanStack React Query,
React Hook Form + Zod.

---

## Core rules

1. **Multi-tenant:** EVERY table has `tenant_id`. EVERY query filters by it. No exceptions.
2. **UI locale:** UI strings use native encoding for the target locale — no ASCII
   transliteration (e.g. `ae`/`oe`/`ue`/`ss` only belongs in code, URL slugs, and DB keys).
3. **`npm run build`** at the end — exit 0 is mandatory.
4. **Optimistic updates** on EVERY mutation (`onMutate` + `onError` rollback).
5. **Zod `.strict()`** on ALL API schemas — unknown keys must error.
6. **`requireRole()`** on EVERY route — `secureApiRouteWithTenant` alone is NOT enough.
7. **No new dependencies** without discussion.
8. **Minimalistic** — no over-engineering.
9. **Vitest + Playwright** from day 1 — no code without tests.
10. **Atomic commits** — one logical change per commit, descriptive messages.

---

## GDPR-by-design (from day 1)

1. **No PII in `profiles`** — only `auth.users` holds email (Supabase-internal).
2. **`pg_cron` retention** for user-generated data (define retention windows up front).
3. **Structured sensitive fields** — use enum codes for categorical data, never free-text
   blobs for things that need to be queryable or redactable.
4. **Encryption** for passwords / API keys stored in DB (AES-256-GCM via `encrypt()`).
5. **Logger with PII sanitization** — sensitive patterns redacted before any log write.
6. **Privacy policy + imprint** from the start, not retrofitted.

---

## Security core (from day 1)

### Auth pattern (REQUIRED on every route)

```typescript
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api/require-role';

export async function GET(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  requireRole(context, ['admin', 'manager']);
  const supabase = await createServerSupabaseClient();
  // ...
}
```

### Utilities — do not rebuild

| Area | Helper | Purpose |
|---|---|---|
| Auth | `secureApiRouteWithTenant` | Session + `tenant_id` resolution |
| Role | `requireRole`, `requireRoleOrSelf`, `isManager` | RBAC checks |
| Fetch | `safeFetch` | SSRF-safe (DNS rebind, timeout, size cap) |
| Crypto | `timingSafeStringEqual` | Constant-time secret comparison |
| Client-IP | `getTrustedClientIp` | Rate-limit-safe IP resolution |
| Rate | `checkIPRateLimit` | Brute-force protection |
| Validate | `isValidUUID`, `sanitizeString`, `escapePostgrestLike` | Input validation |
| Logging | `logger` | PII-safe deep sanitization |
| Encrypt | `encrypt` / `decrypt` (AES-256-GCM) | Secret-at-rest |
| Errors | `ForbiddenError`, `UnauthorizedError`, `ValidationError`, `NotFoundError` | AppError hierarchy |

---

## Quality gates (ALL must pass before merge)

| Gate | Command | Threshold |
|------|---------|-----------|
| Build | `npm run build` | Exit 0 |
| Locale check | project-specific grep for ASCII transliteration in UI strings | 0 hits |
| Type check | `npx tsc --noEmit` | 0 errors |
| Tests | `npm run test` | All green |
| PII gate | PII-check script (scans for re-introduced PII columns) | 0 findings |

---

## Workflow philosophy

### Complete solutions
AI delivers the FULL solution — no partial work, no "this is a starting point".

### Search before building
Before ANY implementation: does it already exist? Is there an established pattern?

### Diff-aware testing
Focus tests on the changed surface, not the entire app.

### Localhost-first
NEVER push without local test sign-off.

---

## Commit rules

- Atomic commits: one logical change per commit.
- Ordering: dead-code removal → DB migration → API → frontend → tests.
- ALWAYS `npm run build` before committing.

---

## Skills (optional)

If the project uses Claude skills, place them under `.claude/skills/<your-skill>/skill.md`
and reference them here so future AI sessions know where the playbooks live.

---

## CI/CD pipeline

- **Build gate:** `npm run build` must exit 0.
- **PII gate:** scans for re-introduced PII columns (GitHub Action).
- **Security review:** `anthropics/claude-code-security-review@main` on every PR.
- **AEGIS scan:** repo is scanned by AEGIS on each PR (see `.github/workflows/aegis-pr-gate.yml`).
