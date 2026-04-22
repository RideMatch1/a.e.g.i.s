# AEGIS Wizard Pattern Catalog

> Auto-generated from pattern frontmatter. Regenerate via `node scripts/gen-pattern-index.mjs`.

Total patterns: 8. Grouped by category; within each category sorted alphabetically by name.

## Foundation

- **[Authentication Flows with Supabase (login + signup + password-reset + MFA + magic-link)](./foundation/auth-supabase-full.md)** — Complete authentication UI + server-actions + callbacks for Supabase Auth. Includes optional MFA (TOTP) and passwordless magic-link flows. Depends on multi-tenant-supabase for the profiles table.
- **[Internationalization with next-intl (DE + EN)](./foundation/i18n-next-intl.md)** — Locale-routing (/de/… + /en/…), message-catalogs, server-component + client-component translation, language-switcher, timezone/date-formatting. Default languages DE + EN, extendable.
- **[PII-Safe Logger (deep-sanitize, cyclic-safe)](./foundation/logger-pii-safe.md)** — Structured logger that automatically redacts sensitive keys at any nesting depth. Safe against cyclic references via WeakSet. Redacts 30+ default patterns (passwords, tokens, emails, phone-numbers) plus project-specific additions.
- **[Hardened Next.js Middleware (CSP + HSTS + Rate-Limit + Auth-Gates)](./foundation/middleware-hardened.md)** — Next.js middleware layer enforcing Content-Security-Policy, HSTS, XFO, rate-limits, and authenticated-route protection. First-class line-of-defense before any route handler runs.
- **[Multi-Tenancy with Supabase (tenants + profiles + RLS)](./foundation/multi-tenant-supabase.md)** — Establishes tenants + profiles tables with Row-Level-Security. Every domain-table FK-refs tenants and filters via tenant_id in app-layer + RLS-layer. Adds the secureApiRouteWithTenant guard that extracts tenant_id from the authenticated user's profile and enforces CSRF-protection on mutating routes.
- **[Role-Based Access Control with requireRole()](./foundation/rbac-requirerole.md)** — Layered RBAC on top of tenant-isolation. Defense-in-depth: secureApiRouteWithTenant checks auth+tenant, requireRole() checks permission. Sensitive fields are filtered via filterSensitiveFields() based on requester's role.

## Compliance

- **[DSGVO Kit (Cookie-Banner + Data-Export + Account-Deletion + Consent-Versioning)](./compliance/dsgvo-kit.md)** — Complete DSGVO-compliance package. Cookie-banner with granular-consent (Art. 7), data-export per Art. 15, account-deletion per Art. 17, consent-versioning for T&C changes, DSB-ready audit-log. EU/DE-focused but extensible to GDPR/CCPA.
- **[Legal Pages (Impressum + Datenschutzerklärung + AGB — DE templates)](./compliance/legal-pages-de.md)** — German-legal-required pages: Impressum (§5 TMG/DDG), Datenschutzerklärung (DSGVO Art. 13), and optional AGB (Terms). Templates with placeholders that the wizard fills from company-info. Editable by admins at runtime.

