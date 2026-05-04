<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# JavaScript Endpoint & Secret Extraction

Use this playbook when analyzing any web application that serves JavaScript files.
Modern SPAs (React, Vue, Angular, Next.js) expose almost all API routes and sometimes secrets inside JS bundles.

---

## STEP 1 — Collect All JavaScript File URLs

```bash
# From browser_action output (saved to output/js_files.txt):
cat output/js_files.txt

# OR: extract from raw HTML if browser_action wasn't used:
curl -sk https://TARGET/ | grep -oP '(?<=src=")[^"]+\.js[^"]*' | sed 's|^/|https://TARGET/|' | tee output/js_files.txt

# Also check for chunk manifest / lazy-loaded bundles:
curl -sk https://TARGET/ | grep -oP '(?<=src=")[^"]+' | grep -E '\.(js|chunk)' | tee -a output/js_files.txt
curl -sk https://TARGET/asset-manifest.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); [print(v) for v in d.values() if '.js' in str(v)]"
curl -sk https://TARGET/webpack-manifest.json 2>/dev/null | python3 -c "import sys,json; [print(v) for k,v in json.load(sys.stdin).items() if '.js' in str(v)]"
```

---

## STEP 2 — Download All JS Files

```bash
mkdir -p output/js_files
while IFS= read -r url; do
  [ -z "$url" ] && continue
  # Resolve relative URLs
  [[ "$url" != http* ]] && url="https://TARGET${url}"
  fname=$(echo "$url" | md5sum | cut -d' ' -f1).js
  curl -sk "$url" -o "output/js_files/$fname" && echo "Downloaded: $url -> $fname"
done < output/js_files.txt
echo "Total JS files: $(ls output/js_files/*.js 2>/dev/null | wc -l)"
```

---

## STEP 3 — Extract API Endpoints

```bash
# Pattern 1: quoted string paths starting with / or /api
grep -roh '"\(/[a-zA-Z0-9_/.-]\{2,80\}\)"' output/js_files/ 2>/dev/null \
  | tr -d '"' | sort -u | grep -E '^/(api|v[0-9]|auth|user|admin|account|order|product|data|graphql)' \
  | tee output/js_extracted_endpoints.txt

# Pattern 2: single-quoted paths
grep -roh "'\(/[a-zA-Z0-9_/.-]\{2,80\}\)'" output/js_files/ 2>/dev/null \
  | tr -d "'" | sort -u | grep -E '^/(api|v[0-9]|auth|user|admin)' \
  >> output/js_extracted_endpoints.txt

# Pattern 3: template literals with path
grep -roh '`/[a-zA-Z0-9_/.-]\{2,60\}`' output/js_files/ 2>/dev/null \
  | tr -d '`' | sort -u >> output/js_extracted_endpoints.txt

# Pattern 4: fetch/axios/http calls (finds dynamic routes)
grep -roh 'fetch\s*([^)]\{5,120\})' output/js_files/ 2>/dev/null | head -30 >> output/js_extracted_endpoints.txt
grep -roh 'axios\.[a-z]\+\s*([^)]\{5,120\})' output/js_files/ 2>/dev/null | head -30 >> output/js_extracted_endpoints.txt

# Deduplicate and show results
sort -u output/js_extracted_endpoints.txt | head -50
echo "Total unique endpoints found: $(sort -u output/js_extracted_endpoints.txt | wc -l)"
```

---

## STEP 4 — Scan for Secrets & Hardcoded Credentials

```bash
# API keys and tokens
grep -roh 'api[_-]\?key[^"'"'"'`]\{0,10\}["\`'"'"'][A-Za-z0-9_\-]\{16,64\}' \
  output/js_files/ -i 2>/dev/null | head -20 | tee output/js_secrets.txt

# Auth tokens and secrets
grep -roh '\b\(secret\|token\|password\|passwd\|auth\|credential\)[^"'"'"'`]\{0,15\}["\`'"'"'][A-Za-z0-9_=+/\-]\{8,100\}' \
  output/js_files/ -i 2>/dev/null | head -20 >> output/js_secrets.txt

# AWS keys
grep -roh 'AKIA[A-Z0-9]\{16\}' output/js_files/ 2>/dev/null | head -5 >> output/js_secrets.txt
grep -roh '"aws[^"]\{0,20\}": *"[A-Za-z0-9/+]\{40\}"' output/js_files/ -i 2>/dev/null >> output/js_secrets.txt

# Internal URLs / backend hosts
grep -roh 'https\?://[a-zA-Z0-9._-]\{4,80\}' output/js_files/ 2>/dev/null \
  | grep -v -E 'cdn\.|static\.|fonts\.|analytics\.|google\.|facebook\.' \
  | sort -u | tee output/js_internal_urls.txt

# Show found secrets
echo "=== Secrets found ==="
cat output/js_secrets.txt
echo "=== Internal URLs ==="
head -20 output/js_internal_urls.txt
```

---

## STEP 5 — Next.js / React Router Route Extraction

```bash
# Next.js: page routes from main-*.js
grep -roh '"pathname":"[^"]\{1,80\}"' output/js_files/ 2>/dev/null \
  | grep -oP '(?<=pathname":")[^"]+' | sort -u | tee output/js_nextjs_routes.txt

# React Router: look for route definitions
grep -roh 'path:\s*["\'"'"'][^"'"'"']\{1,80\}["\'"'"']' output/js_files/ 2>/dev/null \
  | grep -oP '(?<=path: ["\'"'"'])[^"'"'"']+' | sort -u >> output/js_nextjs_routes.txt

# Angular: routerLink / loadChildren
grep -roh 'routerLink:\s*["\'"'"'][^"'"'"']\{1,80\}["\'"'"']' output/js_files/ 2>/dev/null | head -20
grep -roh 'loadChildren.*\.module' output/js_files/ 2>/dev/null | head -10

# Webpack chunk IDs → download extra chunks
grep -roh '"[0-9]\{1,4\}":"[a-f0-9]\{8,16\}"' output/js_files/ 2>/dev/null \
  | python3 -c "
import sys, json, re
chunks = {}
for line in sys.stdin:
    m = re.findall(r'\"(\d+)\":\"([a-f0-9]{8,16})\"', line)
    chunks.update(m)
for cid, chash in list(chunks.items())[:20]:
    print(f'Chunk {cid}: TARGET/static/js/{cid}.{chash}.chunk.js')
" | tee output/js_webpack_chunks.txt
```

---

## STEP 6 — Test Discovered Endpoints

```bash
# Load discovered endpoints and probe each one:
while IFS= read -r endpoint; do
  [ -z "$endpoint" ] && continue
  response=$(curl -sk -o /dev/null -w "%{http_code}" "https://TARGET${endpoint}")
  [ "$response" != "404" ] && echo "[$response] $endpoint"
done < output/js_extracted_endpoints.txt | tee output/js_live_endpoints.txt

# Test with authentication cookie (if you have one):
while IFS= read -r endpoint; do
  [ -z "$endpoint" ] && continue
  response=$(curl -sk -b output/cookies.txt -o /dev/null -w "%{http_code}" "https://TARGET${endpoint}")
  [ "$response" != "404" ] && echo "[$response] $endpoint"
done < output/js_extracted_endpoints.txt | tee output/js_authed_endpoints.txt
```

---

## Key Patterns to Look For

**Unauthenticated API routes** — endpoints that return 200 without a cookie/token
**Admin/internal routes** — `/api/admin`, `/internal/`, `/_/`, `/debug/`
**IDOR candidates** — routes containing `{id}`, `:id`, `[id]`, or numeric path segments
**File operations** — `/upload`, `/download`, `/export`, `/import`
**State-changing ops** — POST/PUT/DELETE endpoints (note them for CSRF/IDOR testing)
**Hardcoded credentials** — any `password:`, `secret:`, `apiKey:` values in plain text

## Common Frameworks Quick Reference

| Framework | Bundle Pattern | Route Location |
|-----------|---------------|----------------|
| Next.js | `_next/static/chunks/` | `pathname:"..."` in main-*.js |
| React CRA | `static/js/main.*.js` | React Router: `path="..."` |
| Vue CLI | `js/app.*.js` | vue-router: `path: '...'` |
| Angular | `main.*.js` | `loadChildren`, `routerLink` |
| Webpack | `*.chunk.js` | Chunk manifest |
