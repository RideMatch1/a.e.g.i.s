<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: js-internal-hostname-intelligence
description: Deep JavaScript bundle analysis focused on extracting internal hostnames, fleet/cluster naming conventions, obfuscated infrastructure references, and non-API internal service URLs that reveal backend topology
---

# JavaScript Bundle — Internal Hostname & Infrastructure Intelligence

Standard JS analysis extracts API endpoints and secrets. This skill goes deeper: extracting **internal hostnames** that reveal backend infrastructure topology, fleet naming conventions, internal service mesh references, and obfuscated hostnames (hex-encoded, base64-encoded, or split across variables).

**Why this matters:** Internal hostnames in JS bundles are almost always unintentional leaks. They reveal:
- Internal service names that are publicly routable (misconfigured cluster ingress)
- Fleet/Kubernetes namespace naming conventions (`.fleet.live.`, `.dev.solo.`, `.internal.`)
- Backend service URLs that can be probed directly
- Infrastructure geography (region names, availability zones embedded in hostnames)

---

## STEP 1 — Broad Internal URL Extraction (Beyond API Paths)

```bash
# Standard JS analysis only extracts API paths. This extracts ALL URLs including internal ones.
# Download JS files first (see javascript_analysis.md STEP 1-2)

# Extract ALL https:// URLs, including non-CDN internal ones
grep -roh 'https\?://[a-zA-Z0-9._:/-]\{6,150\}' output/js_files/ 2>/dev/null \
  | sed 's/["\`'"'"'].*$//' \
  | sort -u \
  | tee output/js_all_urls.txt

# NOW: Split into external (known CDN/tracking) vs internal (potentially sensitive)
grep -vE '(cdn\.|static\.|fonts\.|analytics\.|google\.|facebook\.|twitter\.|cloudflare\.|amazonaws\.com/cdn|jsdelivr\.|unpkg\.|w3\.org|schema\.org|mozilla\.|apple\.|microsoft\.|github\.com$|npmjs\.)' \
  output/js_all_urls.txt \
  | sort -u \
  | tee output/js_internal_candidate_urls.txt

echo "=== Internal URL candidates ==="
cat output/js_internal_candidate_urls.txt
echo "Total: $(wc -l < output/js_internal_candidate_urls.txt)"
```

---

## STEP 2 — Fleet & Cluster Naming Convention Detection

Infrastructure domains follow predictable patterns. Detect them:

```bash
# Kubernetes fleet / internal cluster patterns
grep -iE '\.(fleet|cluster|internal|k8s|kube|svc|local|mesh|private|corp|intra)\.' \
  output/js_internal_candidate_urls.txt | tee output/js_fleet_hostnames.txt

# Environment-tagged hostnames (live/prod/staging/dev/solo/sandbox)
grep -iE '\.(live|prod|staging|dev|sandbox|qa|uat|test|solo|preview)\.' \
  output/js_internal_candidate_urls.txt >> output/js_fleet_hostnames.txt

# Naming patterns: service-name.namespace.cluster.tld
grep -oE '[a-z][a-z0-9-]{2,40}\.[a-z]{2,20}\.[a-z]{2,20}\.[a-z]{2,10}' \
  output/js_internal_candidate_urls.txt \
  | grep -vE '\.(com|net|org|io|co)\.[a-z]{2}$' \
  >> output/js_fleet_hostnames.txt

sort -u output/js_fleet_hostnames.txt | tee output/js_fleet_hostnames_dedup.txt
echo "Fleet/cluster hostnames found: $(wc -l < output/js_fleet_hostnames_dedup.txt)"
```

---

## STEP 3 — Obfuscated Hostname Detection

Developers sometimes hex-encode or encode infrastructure hostnames to obscure them:

```python
# tools/decode_obfuscated_hostnames.py
"""
Detect and decode obfuscated hostnames in JS bundles.
Common patterns:
- Hex-encoded: "6f74656c" → "otel"
- Base64-encoded: "b3RlbA==" → "otel"
- Split strings: "ot" + "el" assembled at runtime
- Reversed: "leto" → "otel"
- ROT13: "bgrj" → "otel"
"""
import os, re, binascii, base64, codecs

js_dir = "output/js_files"
results = []

for fname in os.listdir(js_dir):
    if not fname.endswith('.js'):
        continue
    with open(f"{js_dir}/{fname}", 'r', errors='ignore') as f:
        content = f.read()

    # Pattern 1: Hex-encoded strings that decode to valid hostname parts
    hex_candidates = re.findall(r'"([0-9a-f]{6,32})"', content)
    for h in hex_candidates:
        try:
            decoded = binascii.unhexlify(h).decode('ascii')
            # Only keep if decoded result looks like a hostname component
            if re.match(r'^[a-z][a-z0-9-]{2,20}$', decoded):
                results.append(f"HEX: {h} → {decoded}")
        except Exception:
            pass

    # Pattern 2: Base64 strings that decode to hostnames
    b64_candidates = re.findall(r'"([A-Za-z0-9+/]{8,50}={0,2})"', content)
    for b in b64_candidates:
        try:
            decoded = base64.b64decode(b).decode('ascii')
            if re.match(r'^[a-z][a-z0-9.-]{4,60}$', decoded):
                results.append(f"B64: {b} → {decoded}")
        except Exception:
            pass

    # Pattern 3: Subdomain that is hex-encoded (e.g., "6f74656c-http.target.com")
    hex_subdomain = re.findall(r'([0-9a-f]{6,16})-[a-z]{2,10}\.[a-z0-9.-]+\.[a-z]{2,6}', content)
    for h in hex_subdomain:
        try:
            decoded = binascii.unhexlify(h).decode('ascii')
            results.append(f"HEX-SUBDOMAIN: {h} → {decoded} (likely: {decoded}-*.<domain>)")
        except Exception:
            pass

for r in sorted(set(results)):
    print(r)

if not results:
    print("[*] No obfuscated hostnames detected")
```

```bash
python3 tools/decode_obfuscated_hostnames.py | tee output/js_obfuscated_hostnames.txt
```

---

## STEP 4 — Probe All Internal Hostname Candidates

```python
# tools/probe_internal_hosts.py
"""
Probe every internal hostname candidate extracted from JS bundles.
Test for HTTP/HTTPS accessibility on standard ports.
Record: status code, response size, Content-Type, Server header, response body preview.
"""
import urllib.request, urllib.error, ssl, re, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

results = []

with open("output/js_internal_candidate_urls.txt") as f:
    urls = [line.strip() for line in f if line.strip() and line.startswith("http")]

print(f"Probing {len(urls)} internal URL candidates...")

for url in urls:
    # Normalize to just the base URL (no path) for initial probe
    base_match = re.match(r'(https?://[a-zA-Z0-9._:-]+)', url)
    if not base_match:
        continue
    base_url = base_match.group(1)

    for probe_url in [url, base_url]:
        try:
            req = urllib.request.Request(
                probe_url,
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json, text/html"}
            )
            with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                body = r.read(500).decode('utf-8', 'ignore')
                ct = r.headers.get('Content-Type', '')
                server = r.headers.get('Server', '')
                results.append({
                    'status': r.status, 'url': probe_url,
                    'ct': ct[:50], 'server': server[:30],
                    'body': body[:200].replace('\n', ' ')
                })
                print(f"[{r.status}] {probe_url}")
                print(f"  Content-Type: {ct[:60]}")
                print(f"  Server: {server}")
                print(f"  Body: {body[:150]}")
                break  # Don't probe base_url if full URL worked
        except urllib.error.HTTPError as e:
            body = e.read(300).decode('utf-8', 'ignore')
            results.append({'status': e.code, 'url': probe_url, 'body': body[:100]})
            # Non-404/non-connection errors are interesting
            if e.code not in (404, 400):
                print(f"[{e.code}] {probe_url}: {body[:120]}")
            break
        except Exception as ex:
            # Connection refused / DNS fail → not publicly accessible
            pass
        time.sleep(0.3)

# Write results
import json
with open("output/js_internal_hosts_probe.txt", "w") as f:
    for r in results:
        f.write(json.dumps(r) + "\n")

# Highlight interesting findings
print("\n=== INTERESTING FINDINGS (non-404, public access) ===")
for r in results:
    if r['status'] not in (404, 400, 0) and r['status'] < 500:
        print(f"[{r['status']}] {r['url']}: {r.get('ct','')} | {r.get('body','')[:100]}")
```

```bash
python3 tools/probe_internal_hosts.py
```

---

## STEP 5 — Analyze Error Message Patterns for Infrastructure Intelligence

Error responses from internal services leak more than external services:

```python
# tools/error_intelligence.py
"""
Internal services often return verbose errors that reveal:
- Framework name and version (e.g., Javalin, Spring Boot, Express)
- Internal service names referenced in stack traces
- Database connection strings in error bodies
- Authentication mechanisms (JWT issuer, OAuth server URLs)
- Internal API versioning and routing conventions
"""
import urllib.request, urllib.error, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def extract_error_intelligence(url, params_to_test=None):
    """
    Send malformed requests to trigger verbose errors.
    Tests: missing params, wrong types, extra fields, empty body.
    """
    intelligence = {}

    test_vectors = [
        # Missing required params → often reveals param names
        {"method": "GET", "path": url, "headers": {"Accept": "application/json"}},
        # Wrong content type → may reveal accepted types
        {"method": "POST", "path": url, "body": "invalid_json{{{",
         "headers": {"Content-Type": "text/plain", "Accept": "application/json"}},
        # Empty JSON body → may reveal required fields
        {"method": "POST", "path": url, "body": "{}",
         "headers": {"Content-Type": "application/json", "Accept": "application/json"}},
        # Null bytes → often triggers framework error
        {"method": "GET", "path": url + "?test=\x00", "headers": {}},
    ]

    for vec in test_vectors:
        body_data = vec.get("body", "").encode() if vec.get("body") else None
        req = urllib.request.Request(
            vec["path"],
            data=body_data,
            headers=vec.get("headers", {}),
            method=vec["method"]
        )
        try:
            with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                body = r.read(1000).decode('utf-8', 'ignore')
                print(f"[{r.status}] {vec['method']} {url}: {body[:200]}")
        except urllib.error.HTTPError as e:
            body = e.read(1000).decode('utf-8', 'ignore')
            print(f"[{e.code}] {vec['method']} {url}:")

            # Parse error for intelligence
            try:
                err_json = json.loads(body)
                # Javalin pattern
                if "javalin.io" in str(err_json.get("type", "")):
                    intelligence["framework"] = "Javalin (Kotlin/Java)"
                    intelligence["error_message"] = err_json.get("title", "")
                    print(f"  FRAMEWORK: Javalin detected")
                    print(f"  ERROR: {err_json.get('title')}")
                # Spring Boot actuator pattern
                if "timestamp" in err_json and "path" in err_json:
                    intelligence["framework"] = "Spring Boot"
                # Express/Node pattern
                if err_json.get("name") == "BadRequestError":
                    intelligence["framework"] = "Express.js"
            except Exception:
                pass

            # Progressive param disclosure (e.g., "Missing X parameter")
            import re
            missing_params = re.findall(r'[Mm]issing\s+([a-zA-Z_-]+)\s+param', body)
            required_params = re.findall(r'[Rr]equired.*param.*?["\']([a-zA-Z_-]+)["\']', body)
            all_params = missing_params + required_params
            if all_params:
                intelligence.setdefault("required_params", []).extend(all_params)
                print(f"  PARAM DISCLOSURE: {all_params}")
        except Exception as ex:
            pass

    return intelligence

# Load probe results and analyze non-404 endpoints
with open("output/js_internal_hosts_probe.txt") as f:
    for line in f:
        try:
            r = json.loads(line)
            if r.get("status", 404) not in (404, 0):
                print(f"\n=== Analyzing {r['url']} ===")
                intel = extract_error_intelligence(r['url'])
                if intel:
                    print(f"Intelligence: {json.dumps(intel, indent=2)}")
        except Exception:
            pass
```

```bash
python3 tools/error_intelligence.py | tee output/js_error_intelligence.txt
```

---

## STEP 6 — Cross-Reference Internal Hostnames with Subdomains

```bash
# Check if any internally-referenced hostnames are also public subdomains
# This finds cases where "internal" services are accidentally internet-facing

# Extract just hostnames from internal candidates
grep -oE '[a-zA-Z0-9][a-zA-Z0-9._-]{4,80}' output/js_internal_candidate_urls.txt \
  | grep -v '/' \
  | sort -u > output/js_hostname_candidates.txt

# Cross-reference against our subdomain list
while IFS= read -r hostname; do
  if grep -q "$hostname" output/subdomains.txt 2>/dev/null; then
    echo "[IN SCOPE] $hostname is both in JS bundles AND in subdomains list"
  fi
done < output/js_hostname_candidates.txt | tee output/js_subdomain_crossref.txt

# Also resolve any new internal hostnames that aren't in our subdomain list
python3 -c "
import socket, sys
with open('output/js_hostname_candidates.txt') as f:
    for hostname in f:
        hostname = hostname.strip()
        if not hostname or '.' not in hostname:
            continue
        try:
            ip = socket.gethostbyname(hostname)
            print(f'[RESOLVES] {hostname} -> {ip}')
        except socket.gaierror:
            pass
" | tee output/js_new_resolving_hosts.txt
```

---

## Key Patterns to Identify

**Fleet/Cluster naming (indicates internal Kubernetes/container infrastructure):**
- `.fleet.live.<company>.net` — production Kubernetes fleet
- `.fleet.staging.<company>.net` — staging fleet
- `<service>.dev.solo.<company>.com` — individual developer cluster
- `<service>.<namespace>.svc.cluster.local` — internal K8s DNS (not publicly routable but leaks topology)
- `<service>-<env>.<company>.internal` — internal DNS zone

**Environment indicators in hostnames:**
- `dev`, `staging`, `qa`, `uat`, `sandbox`, `preview` — non-production environments
- `solo`, `personal`, `test` — individual developer environments (highest risk of being exposed)
- `live`, `prod` — production (highest value targets)

**Service type indicators:**
- `otel`, `telemetry`, `tracing`, `metrics` — observability infrastructure
- `billing`, `payment`, `checkout` — payment infrastructure
- `auth`, `sso`, `login`, `oauth` — authentication infrastructure
- `api-internal`, `internal-api`, `backend` — internal API services

---

## Pro Tips

1. **The goldmine is in service-worker.js and webpack chunk manifests** — these load lazily and often contain backend configuration not present in the main bundle.
2. **Check `__NEXT_DATA__` in server-rendered pages** — Next.js embeds the initial page props as JSON, which may include internal API responses with full hostnames.
3. **Source maps (.js.map files)** — Unstrip the bundle and find commented-out internal URLs and debug configurations.
4. **React Native / Expo bundles** — Mobile apps served from CDNs often contain more sensitive infrastructure URLs than web apps.
5. **Service worker registration URLs** — `navigator.serviceWorker.register()` paths reveal versioned bundle URLs.
6. **Cross-reference with historical URLs** — `output/historical_urls.txt` from Wayback Machine often has older versions of JS bundles that leaked more before the team cleaned them up.
