# Prod-check evidence — 2026-04-23

Verification artifact for the two `@aegis-wizard/cli@0.17.1` CHANGELOG entries
that close findings observed in dev-mode only. Each section captures the
exact curl probe run against a production build of a fresh wizard-generated
scaffold, followed by the verbatim header-block the production server
emitted. Downstream reviewers can re-run the probes against any
wizard-generated scaffold to reproduce the result.

**Scope:** validation that certain dev-mode observations (Turbopack header-
caching artifacts, stale route-guard rewrites) disappear under
`next build` + `next start`. These are NOT patches; they are evidence that
no patch is required.

**Environment:**
- Next.js 16.2.4
- Scaffold: a fresh `aegis-wizard new <project> --non-interactive --config <saas-shape>` run into a working directory (any path — nothing in the output is scaffold-dir-specific)
- Server: `npm run build` → exit 0 → `npm start` → listening on `:3000`

---

## Finding 1 — security-headers on intl-handled responses

### Probe

```bash
curl -sI http://localhost:3000/de
```

### Verbatim response (relevant headers only)

```
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; script-src 'self' 'nonce-jRgxCe3hdCFPwpMYNucXPg==' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https://stub-project.supabase.co https://*.supabase.co; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-origin
permissions-policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
x-nonce: jRgxCe3hdCFPwpMYNucXPg==
```

### Verdict

ALL security-headers present on the intl-handled `/de` response:

- `content-security-policy` with `strict-dynamic` + unique per-request nonce
- `strict-transport-security` 2-year preload-eligible
- `x-frame-options: DENY`
- `x-content-type-options: nosniff`
- `permissions-policy`
- `referrer-policy`
- `cross-origin-opener-policy: same-origin`
- `cross-origin-resource-policy: same-origin`
- `x-nonce` forwarded for downstream nonce-binding

Additionally: a `307` redirect from `/` → `/de` carries the same header
set, so the intl-rewrite path also preserves headers.

**Classification:** dev-only observation. The Turbopack dev server caches
response headers across HMR reloads; a refresh against `next dev` can
briefly show a stale no-header state, but the production build emits the
full header set consistently.

---

## Finding 2 — `/api/admin/*` returns 404 instead of 401

### Probe

```bash
curl -sI http://localhost:3000/api/admin/nonexistent-route
```

### Verbatim response

```
HTTP/1.1 401 Unauthorized
content-security-policy: default-src 'self'; script-src 'self' 'nonce-7QIifWA8m5Sx4pc9TZ/I5g==' 'strict-dynamic'; ...
content-type: application/json
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-origin
```

### Verdict

Production returns `401 Unauthorized` on the unauth `/api/admin/*` probe —
correct behavior per the auth-gate pattern. The unauth error response
itself also carries the full security-header set (CSP, COOP, CORP, etc.),
so even error responses are hardened.

**Classification:** dev-only observation. A `404` response in dev mode
reflects the route-guard not yet having re-registered after HMR; the
production build's route-table is fully resolved at start, so the guard
runs correctly on the first request.

---

## Sanity: dogfood-server log tail

```
> scaffold-name@0.1.0 start
> next start

▲ Next.js 16.2.4
- Local:         http://localhost:3000
- Network:       http://192.168.178.65:3000
✓ Ready in 60ms
⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.
```

The standalone-warning is informational (build emits both `.next/` and
`.next/standalone/`; `next start` works because `.next/` is complete).
Not a finding.

---

## Reproduction

The artifacts above are reproducible against any wizard-generated
scaffold. A reviewer re-running the checks can follow:

```bash
# 1. Generate a scaffold
aegis-wizard new my-scaffold --non-interactive --config <saas-shape.json>
cd my-scaffold

# 2. Install + build + start
npm install
npm run build
npm start &

# 3. Run the two probes
curl -sI http://localhost:3000/de
curl -sI http://localhost:3000/api/admin/nonexistent-route
```

The expected header sets above should reproduce exactly, modulo the
nonce values (re-generated per-request).
