# {{PROJECT_NAME}}

AEGIS-scaffolded Next.js + Supabase project.

Scaffold version: `v{{AEGIS_VERSION}}`.

## Quick Start

```bash
npm install
cp .env.local.example .env.local    # fill in Supabase keys
npm run dev                          # http://localhost:3000
```

Run the security scan:

```bash
npx aegis scan .
```

## Project Structure

```
app/                         Next.js App Router (layout, pages, API routes)
lib/api/                     Tenant-guard (secureApiRouteWithTenant) + RBAC (requireRole)
lib/security/                Crypto (AES-256-GCM, timing-safe-compare), rate-limit, SSRF-safe fetch
lib/validation/              Zod-strict schemas + input sanitizers (UUID, escape, etc.)
lib/supabase/                Server-side Supabase client (anon-key, cookie-aware)
lib/logger.ts                PII-sanitizing logger (50+ redaction patterns)
lib/errors.ts                AppError hierarchy (Forbidden, Unauthorized, Validation, NotFound)
middleware.ts                CSRF + security headers + IP rate-limit
supabase/migrations/         RLS-bootstrap migration (tenants + profiles + policies)
.github/workflows/aegis.yml  PR gate — runs AEGIS on every pull request
```

## Security Features

This scaffold ships with AEGIS security primitives pre-wired:

- **Multi-tenant boundary** — every DB query is scoped via `tenant_id` and enforced by Row-Level Security policies (see `supabase/migrations/0000_rls_bootstrap.sql`).
- **RBAC** — call `requireRole(context, ['admin', 'manager'])` inside every privileged route handler.
- **Input validation** — Zod schemas with `.strict()` mode reject unknown keys on every API payload.
- **PII-safe logging** — `logger` redacts 50+ regex patterns (email, token, passwords, names, IDs) from log output.
- **AES-256-GCM encryption** — `encrypt()` / `decrypt()` for at-rest secrets stored in your DB.
- **SSRF-safe fetch** — `safeFetch()` wraps outbound HTTP with DNS-rebind guards, size caps, and timeouts.
- **IP rate-limiting** — `checkIPRateLimit` (in-memory, per-instance) + `getTrustedClientIp` (X-Forwarded-For aware).
- **CSRF + security headers** — enforced by `middleware.ts` with Origin/Referer validation on unsafe methods.
- **AI-safety rules** — `CLAUDE.md` documents the conventions an AI assistant must follow when extending the project.

## Enabling the full pipeline

AEGIS is a **unified SAST pipeline orchestrator**. Running `aegis audit`
(or the GitHub Action with `mode: audit`) invokes AEGIS's 41 built-in
scanners today; v0.13+ extends audit to unify findings from up to 16
industry-standard external tools in a single normalised report with
confidence scoring.

### CI-installed scanners (4)

The pre-wired workflow at `.github/workflows/aegis.yml` installs these
automatically on every run:

- [Semgrep](https://semgrep.dev/) — pattern-based static analysis
- [OSV-Scanner](https://google.github.io/osv-scanner/) — dependency vulnerability detection
- [Gitleaks](https://github.com/gitleaks/gitleaks) — secret-leak detection
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) — high-entropy secret discovery

Bump the pinned versions in the `env:` block at the top of the workflow file.

### Local install (full 16-tool pipeline)

To run the full AEGIS audit locally, install the remaining CLI scanners per
their official documentation. The Docker-based scanners (OWASP ZAP,
Lighthouse CI) require a `docker-compose` overlay documented in the AEGIS
project docs.

```bash
npx aegis audit .      # run the audit (built-ins today; unified with externals from v0.13+)
```

### Version requirements

- `mode: audit` runs AEGIS's 41 built-in scanners today (v0.12+).
- The external tools installed by the workflow become part of audit's
  unified finding-pipeline from `aegis-scan@^0.13.0`. Until then, the
  binaries are on PATH but not invoked automatically — the scaffold is
  forward-compat, so upgrading aegis-scan needs no workflow changes.

### Known baseline findings

When scanned fresh, this scaffold produces 3 known MEDIUM findings
(score 999/S/0-BLOCKER). Each is intentional — review rather than suppress:

- **SUPPLY-001/002/003:** Next.js ecosystem (esbuild postinstall + @next/swc
  + @rollup native binaries). Unavoidable without replacing Next.js.

These findings are documented visibility — the scaffold does not suppress
them. Upgrading AEGIS may reduce this set as scanner rules evolve.

## Next Steps

1. Edit `.env.local` with your Supabase project URL + anon key.
2. Apply migrations: use your Supabase CLI (e.g. `supabase db push`) or SQL editor to run the files under `supabase/migrations/`.
3. Edit `aegis.config.json` to tune the PR-gate threshold (default: `score >= 950`, `blocker = 0`).
4. Open a pull request. The AEGIS workflow in `.github/workflows/aegis.yml` runs on every PR and blocks merge until the threshold is met.
5. Common optional env vars to add later:
   - `SUPABASE_SERVICE_ROLE_KEY` — for admin / webhook routes that legitimately bypass RLS (create `lib/supabase/admin.ts`).
   - `ENCRYPTION_KEY` (32 bytes hex) — passed to `encrypt()` / `decrypt()` for at-rest secrets. Generate: `openssl rand -hex 32`.

See `CLAUDE.md` for extended AI-safety rules and the discipline enforced by the PR gate.
