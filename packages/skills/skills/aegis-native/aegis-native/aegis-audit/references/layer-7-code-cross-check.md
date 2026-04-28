# Layer 7 Reference — Code-Cross-Check

Layer 7 runs ONLY when aegis-audit has access to the source-code (local repo / customer-build artifact). Catches: hardcoded secrets, unsafe-eval / unsafe-inline patterns, missing CSP-headers in middleware, env-vars-leak in public builds, bug-bounty-known-bad-patterns. **Time:** ~5-15 min per target.

---

## Activation Conditions

Layer 7 runs when:

- Target is a local repo (`--target=./` or `--target=customers/<slug>/`)
- Target is a built artifact with source-maps (`<target>/.next/server/chunks/`)
- Operator passes `--enable-layer-7`

Layer 7 does NOT run on a deployed-only URL — there's no source to inspect.

---

## Hardcoded Secrets Detection

```bash
# Common secret-patterns
TARGETS="src/ app/ pages/ lib/ scripts/ next.config.js next.config.ts middleware.ts"

# API keys
grep -rEn '(api[_-]?key|secret[_-]?key|password|access[_-]?token)\s*[=:]\s*["\x27][^"\x27]{20,}' $TARGETS --include="*.{ts,tsx,js,jsx,json,env*}" 2>/dev/null

# AWS-style
grep -rEn 'AKIA[0-9A-Z]{16}' $TARGETS 2>/dev/null

# JWT-like tokens
grep -rEn 'eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*' $TARGETS 2>/dev/null

# Private keys
grep -rEn -- '-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----' $TARGETS 2>/dev/null
```

| Match | Severity |
|---|---|
| API-key / token in source | KRITISCH |
| Database connection string | KRITISCH |
| JWT-secret in source | KRITISCH |
| Private key in source | KRITISCH |
| `.env` file committed | KRITISCH |
| `.env.local` file committed | HOCH |
| Hardcoded test-credential (e.g., test-stripe-key) | LOW (intentional) |

---

## Public-Build Env-Vars-Leak

Next.js: only `NEXT_PUBLIC_*` env-vars are exposed to client-bundles. Anything else exposed = leak.

```bash
# Find env-vars used on client
grep -rEn 'process\.env\.[A-Z_]+' src/components/ src/app/*/page.tsx src/lib/client/ 2>/dev/null

# For each, verify it's prefixed NEXT_PUBLIC_
# If not — leak
```

| Pattern | Severity |
|---|---|
| `process.env.SECRET_KEY` in 'use client' component | KRITISCH |
| `process.env.STRIPE_SECRET` in client-component | KRITISCH |
| `NEXT_PUBLIC_*` used in server-only context | LOW (just bad style) |

---

## CSP Cross-Check

Layer 1 reports the actual served CSP. Layer 7 reads `next.config.js` / `middleware.ts` to verify CSP-source.

```bash
# Find CSP-source
grep -rEn 'Content-Security-Policy' next.config.* middleware.* src/middleware.* 2>/dev/null

# Verify against served (Layer 1 finding)
diff <(grep -oE "Content-Security-Policy.*" /tmp/audit-headers-get.txt) \
     <(grep -oE "Content-Security-Policy.*" middleware.ts | head -1)
```

| Drift | Severity |
|---|---|
| CSP in middleware but not in served headers | HOCH (proxy stripping it) |
| CSP in next.config but not in served | MITTEL (build-config not active) |
| CSP differs between source + served | HOCH (drift / proxy-rewrite) |

---

## Unsafe Patterns

```bash
# eval / Function-constructor
grep -rEn '\beval\(|new Function\(' src/ 2>/dev/null

# Set innerHTML / dangerouslySetInnerHTML without sanitization
grep -rEn 'dangerouslySetInnerHTML' src/ | xargs -I{} grep -L 'sanitize\|DOMPurify' {} 2>/dev/null

# document.write
grep -rEn 'document\.write\(' src/ 2>/dev/null

# raw HTML construction
grep -rEn 'innerHTML\s*=' src/ 2>/dev/null
```

| Pattern | Severity |
|---|---|
| `eval()` in production code | HOCH (CSP-cross-check: needs `unsafe-eval`) |
| `dangerouslySetInnerHTML` without DOMPurify-or-equivalent | HOCH |
| `document.write` | MITTEL |
| `innerHTML =` with untrusted input | KRITISCH |
| `target="_blank"` without `rel="noopener noreferrer"` | MITTEL (window-opener attack) |

---

## API-Route Wrapper Coverage

Verify every API-route uses `secureApiRoute`:

```bash
# Find all api routes
find app/api -name "route.ts" -o -name "route.tsx" 2>/dev/null

# For each, verify wrapper used
for f in $(find app/api -name "route.ts" 2>/dev/null); do
  if ! grep -q "secureApiRoute\|requireRole\|withAuth" "$f"; then
    echo "L7-API-ROUTE-NO-WRAPPER: $f (HOCH)"
  fi
done
```

Routes without wrapper bypass: rate-limit + Origin-check + body-validation. KRITISCH for state-mutating routes (POST/PUT/DELETE).

---

## Form Honeypot + DSGVO-Consent Coverage

```bash
# Find form components
grep -rln '<form' src/components/forms/ src/components/ 2>/dev/null

# Verify honeypot present
for f in $(grep -rln '<form' src/components/ 2>/dev/null); do
  if ! grep -qE '_honey|honeypot|hidden\s+input' "$f"; then
    echo "L7-FORM-NO-HONEYPOT: $f (MITTEL)"
  fi
  if ! grep -qE 'consent\|dsgvo\|datenschutz' "$f"; then
    echo "L7-FORM-NO-CONSENT: $f (HOCH)"
  fi
done
```

---

## Dependency Vulnerability Scan

```bash
# pnpm audit (or npm audit)
pnpm audit --json > /tmp/audit-deps.json 2>/dev/null

# Parse high/critical
high_count=$(jq -r '.metadata.vulnerabilities.high // 0' /tmp/audit-deps.json)
crit_count=$(jq -r '.metadata.vulnerabilities.critical // 0' /tmp/audit-deps.json)

[ $crit_count -gt 0 ] && echo "L7-DEPS-CRITICAL: $crit_count (KRITISCH)"
[ $high_count -gt 0 ] && echo "L7-DEPS-HIGH: $high_count (HOCH)"
```

---

## License-Cross-Check (compliance-relevant)

```bash
# Find dependencies with non-permissive licenses (GPL, AGPL)
npx license-checker --json 2>/dev/null | jq -r 'to_entries[] | select(.value.licenses | tostring | test("GPL|AGPL")) | "\(.key): \(.value.licenses)"'
```

| Issue | Severity |
|---|---|
| AGPL dep in proprietary build | KRITISCH (license-incompatible) |
| GPL dep in proprietary build | HOCH |
| Unknown license | MITTEL |

---

## Findings Format

```yaml
- id: L7-API-ROUTE-NO-WRAPPER
  layer: 7
  severity: HOCH
  evidence:
    file: app/api/contact/route.ts
    line_range: [1, 30]
    detected_pattern: "export const POST = async (req) => { ... }"
    expected_pattern: "export const POST = secureApiRoute({...})"
  recommendation: "Wrap POST handler in secureApiRoute (rate-limit + Origin-check + Zod-validation)"
  citation: "BSI TR-03116-4 §4.5; OWASP API Top-10 #4 (Lack of Resources & Rate Limiting)"
  abmahn_risk: "Indirect — facilitates DoS / spam / credential-stuffing; €0 direct, escalates incident-cost when exploited"
```

---

## Anti-Patterns specific to Layer 7

- ❌ Running Layer 7 on a deployed-only URL — needs source-code.
- ❌ Reporting "secret in source" for a `.env.example` template file — verify it's a real env-file.
- ❌ Marking `dangerouslySetInnerHTML` as KRITISCH without checking for sanitization — DOMPurify or equivalent makes it acceptable.
- ❌ Skipping `pnpm audit` because "deps look fine" — CVE-database changes daily.
- ❌ Reporting "GPL dep" when project is also GPL — license-conflict only when target's license differs.
- ❌ Inferring CSP-drift without serving the build first — middleware might be overridden by reverse-proxy in production.
