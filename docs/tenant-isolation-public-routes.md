# Tenant-isolation-checker — Public-Route Heuristic (v0.15.4 D-C-002)

The `tenant-isolation-checker` scanner detects service-role-key usage
in Next.js App-Router handlers because the service-role client bypasses
Row-Level-Security entirely. By default such usage emits at
**CRITICAL** severity with rule-id `TENANT-NNN` and CWE-639.

From **v0.15.4** onwards, the scanner also recognises a specific
architectural pattern — **public-by-design routes that carry a
path-parameter serving as the tenant-discriminant**. On matching
files the same finding emits at **INFO** severity with an actionable
context-note rather than CRITICAL, because the path-parameter itself
anchors the tenant-boundary at routing time.

This document covers the heuristic's triggers, configuration knobs,
and stated limitations.

---

## When the downgrade applies

Both of the following must be true:

1. The file-path contains any configured **public-route-prefix**.
   Default: `/api/public/`.
2. The file-path contains a **bracket-segment** (e.g. `[slug]`,
   `[tenant]`) whose inner-name is listed in the
   **tenant-discriminant-allowlist**.
   Default: `slug`, `tenant`, `workspace`, `org`, `handle`.

Examples that **do** downgrade (CRITICAL → INFO):

- `src/app/api/public/spa/[slug]/route.ts`
- `src/app/api/public/[tenant]/data/route.ts`
- `src/app/api/public/spa/[slug]/booking/[token]/route.ts`

Examples that **do not** downgrade (stay CRITICAL):

- `src/app/api/reports/[id]/route.ts` — non-public prefix
- `src/app/api/public/settings/route.ts` — no bracket-param
- `src/app/api/public/items/[itemId]/route.ts` — `itemId` not in the
  discriminant-allowlist
- `src/app/api/bookings/route.ts` — neither public-prefix nor bracket

Case-sensitivity is preserved: capital `Templates*`-style paths do
**not** match lowercase `templates/` and vice versa.

---

## Configuring the heuristic

Configure via `aegis.config.json` under `scanners.tenantIsolation`:

```jsonc
{
  "scanners": {
    "tenantIsolation": {
      // Widen prefix set if your app uses versioned public routes
      "publicRoutePrefixes": ["/api/public/", "/api/v1/public/"],

      // Add project-specific tenant-discriminant parameter names
      "tenantDiscriminantParams": [
        "slug",
        "tenant",
        "workspace",
        "org",
        "handle",
        "tenantSlug",
        "restaurantId"
      ]
    }
  }
}
```

Each field is optional; omitting a field keeps the default set. Both
fields validate via strict Zod schema — typos surface as `ZodError`
rather than silent no-ops.

The existing `additionalBoundaryColumns` and `replaceBoundaryColumns`
fields under `scanners.tenantIsolation` still work via the pre-v0.15.4
forward-compat path.

---

## Limitations — path-heuristic only

The heuristic is **path-pattern-only**. It does **not** verify that
the downstream database chain actually filters by the discriminant
(`supabase.from('bookings').eq('slug', slug)`). A route that matches
the heuristic's path-pattern but fails to call `.eq()` on the
discriminant still gets the severity-downgrade — the context-note
explicitly prompts operator-review so this is an **invitation to
verify** rather than a silent pass.

AST-taint extension for downstream-flow-verification is deferred to
**v0.15.5+**. Once that lands, findings that match the path-heuristic
but fail the flow-check will re-emit at CRITICAL.

---

## Context-note on downgraded findings

When the downgrade applies, the finding's `description` includes the
following trailing note (variable portions shown with `${…}`):

```
[v0.15.4 D-C-002] Public-route with path-param-as-tenant-discriminant
detected ([${param}]). Verify the downstream .eq('${param}', ${param})
scope-filter is actually present — AEGIS's path-heuristic does NOT
verify downstream-flow (deferred to v0.15.5+ AST-taint extension).
```

Operators reading the finding report see the exact parameter name that
matched and the specific `.eq()` call to look for. Downstream tooling
(IDE extension, GitHub Action summary, SARIF) surfaces this note via
the standard `description` field — no new schema field required.

---

## Round-4 audit context

This heuristic closes Round-4 external-review finding
[🔴 D-C-002](../aegis-precision/v0153-round4-dispatch-brief.md) where
the Operator-SaaS-class Spa-App routes
`/api/public/spa/[slug]/{booking,chat,rating,treatments,checkout,[token]/cancel}`
were F-blocking first-scans on 4 of 4 audit-sample CRITICALs despite
`[slug]` being the architectural tenant-discriminant.
