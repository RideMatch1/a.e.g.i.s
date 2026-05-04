<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: api-schema-exposure
description: Public OpenAPI/Swagger specification exposure - detection, deep content analysis, internal hostname extraction, endpoint inventory, and attack chain building
---

# API Schema Exposure (OpenAPI / Swagger / Redoc)

Publicly accessible API documentation (OpenAPI, Swagger, Redoc) reveals the full attack surface of an API to unauthenticated attackers: endpoint inventory, parameter names, authentication schemes, internal server hostnames, and error response shapes. Even when endpoints enforce auth, the spec eliminates all reconnaissance effort.

---

## Why This Matters

A typical API doc exposure provides:
1. **Internal hostnames** in `servers[]` → SSRF pivot, internal network mapping
2. **Full endpoint inventory** → skip discovery entirely, jump to exploitation
3. **Auth scheme details** → exact header names, token formats, security flows
4. **Parameter names/types** → craft precise injection payloads without guessing
5. **Unauthenticated endpoints** → paths with `security: []` are public by design — test for abuse
6. **Error/response shapes** → differential oracle for blind attacks

---

## Detection: All API Doc Paths

Framework-specific default documentation paths:

```python
API_DOC_PATHS = [
    # Generic / framework-agnostic
    "/docs", "/docs/", "/docs.json", "/docs.html", "/docs.yaml",
    "/doc", "/doc/", "/doc.json",
    "/swagger", "/swagger/", "/swagger.json", "/swagger.yaml",
    "/swagger-ui", "/swagger-ui.html", "/swagger-ui/index.html",
    "/swagger/index.html",
    "/api-docs", "/api-docs/", "/api-docs.json", "/api-docs.yaml",
    "/api/docs", "/api/docs.json", "/api/swagger.json",
    "/openapi", "/openapi.json", "/openapi.yaml",
    "/openapi/v1", "/openapi/v2", "/openapi/v3",
    "/redoc", "/redoc/", "/redoc.html",
    "/reference", "/reference.json",

    # Version-prefixed
    "/v1/docs", "/v1/docs.json", "/v1/swagger.json", "/v1/openapi.json", "/v1/api-docs",
    "/v2/docs", "/v2/docs.json", "/v2/swagger.json", "/v2/openapi.json", "/v2/api-docs",
    "/v3/docs", "/v3/docs.json", "/v3/swagger.json", "/v3/openapi.json", "/v3/api-docs",
    "/api/v1/docs", "/api/v1/swagger.json", "/api/v1/openapi.json",
    "/api/v2/docs", "/api/v2/swagger.json",
    "/api/v3/docs", "/api/v3/swagger.json",

    # Framework-specific defaults
    # NestJS → /docs, /docs.json, /docs.html, /api, /api-json
    "/api", "/api/", "/api-json",
    # Fastify (swagger plugin) → /documentation, /documentation/json, /documentation/yaml
    "/documentation", "/documentation/json", "/documentation/yaml",
    "/documentation/static/index.html",
    # Spring Boot (springdoc-openapi) → /v3/api-docs, /swagger-ui.html
    "/v3/api-docs", "/v3/api-docs.yaml",
    "/v3/api-docs/swagger-config",
    "/actuator/openapi",
    # FastAPI → /docs, /redoc, /openapi.json
    # Flask-RESTx / Flasgger → /apispec.json, /apispec_1.json
    "/apispec.json", "/apispec_1.json",
    # Django REST Framework → /schema/, /schema.json, /schema.yaml
    "/schema/", "/schema.json", "/schema.yaml",
    # Hapi.js (hapi-swagger) → /documentation
    # Go (swaggo) → /swagger/doc.json
    "/swagger/doc.json",
    # Laravel (l5-swagger) → /api/documentation
    "/api/documentation",
    # Ruby on Rails (rswag) → /api-docs/v1, /api-docs/v2
    "/api-docs/v1", "/api-docs/v2",
    # .NET → /swagger/v1/swagger.json, /swagger/v2/swagger.json
    "/swagger/v1/swagger.json", "/swagger/v2/swagger.json",
    "/swagger/v1/swagger.yaml",
    # Express (express-openapi) → /api-doc
    "/api-doc",
    # Pydantic/FastAPI alternatives
    "/openapi.json", "/openapi.yaml",
    # Admin and internal variants
    "/internal/docs", "/internal/swagger",
    "/admin/docs", "/admin/swagger", "/admin/openapi.json",
    "/private/docs", "/private/openapi.json",
    "/_docs", "/_swagger",
]
```

---

## Script 1 — API Doc Scanner

Scans all known paths and finds accessible API documentation endpoints.

```python
#!/usr/bin/env python3
"""
API documentation endpoint scanner.
Finds exposed OpenAPI/Swagger specs across all framework-specific paths.

Usage: python3 api_doc_scan.py --url https://api.target.com [--threads 30]
       python3 api_doc_scan.py --hosts live_hosts.txt [--threads 30]
"""
import ssl, json, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from concurrent.futures import ThreadPoolExecutor, as_completed

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

API_DOC_PATHS = [
    "/docs", "/docs.json", "/docs.html", "/docs.yaml",
    "/doc.json", "/doc",
    "/swagger", "/swagger.json", "/swagger.yaml", "/swagger-ui.html",
    "/swagger-ui/index.html", "/swagger/index.html",
    "/api-docs", "/api-docs.json", "/api-docs.yaml",
    "/api/docs", "/api/docs.json", "/api/swagger.json",
    "/openapi.json", "/openapi.yaml",
    "/redoc", "/redoc.html",
    "/v1/api-docs", "/v2/api-docs", "/v3/api-docs",
    "/v3/api-docs", "/v3/api-docs.yaml",
    "/v1/swagger.json", "/v2/swagger.json", "/v3/swagger.json",
    "/documentation", "/documentation/json", "/documentation/yaml",
    "/apispec.json", "/apispec_1.json",
    "/schema.json", "/schema.yaml",
    "/swagger/doc.json",
    "/api/documentation",
    "/api-docs/v1", "/api-docs/v2",
    "/swagger/v1/swagger.json", "/swagger/v2/swagger.json",
    "/api-doc",
    "/api-json",
]

OPENAPI_SIGNALS = ["openapi", "swagger", "paths", "components", "info", "servers"]
HTML_SIGNALS = ["swagger-ui", "redoc", "openapi", "ReDoc", "API Documentation"]

def is_api_spec(body_bytes, content_type):
    """Returns True if response looks like an OpenAPI spec or UI."""
    try:
        text = body_bytes[:2000].decode(errors='replace').lower()
    except Exception:
        return False
    if "json" in (content_type or "") or "yaml" in (content_type or ""):
        return any(sig in text for sig in ["openapi", "swagger", '"paths"', '"info"'])
    if "html" in (content_type or ""):
        return any(sig.lower() in text for sig in HTML_SIGNALS)
    return any(sig in text for sig in OPENAPI_SIGNALS)

def check_path(base, path):
    url = base.rstrip("/") + path
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/html, */*"})
        resp = urlopen(req, context=ctx, timeout=8)
        body = resp.read()
        ct = resp.headers.get("Content-Type", "")
        if resp.status == 200 and len(body) > 200 and is_api_spec(body, ct):
            return {
                "url": url,
                "path": path,
                "status": resp.status,
                "size": len(body),
                "content_type": ct,
                "body": body
            }
    except HTTPError:
        pass
    except URLError:
        pass
    return None

def scan_host(base, paths, max_workers=30):
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(check_path, base, p): p for p in paths}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                results.append(r)
    return results

parser = argparse.ArgumentParser()
parser.add_argument("--url", help="Single target base URL")
parser.add_argument("--hosts", help="File with host URLs")
parser.add_argument("--threads", type=int, default=30)
parser.add_argument("--save-specs", action="store_true", help="Save raw spec bodies to disk")
args = parser.parse_args()

targets = []
if args.url:
    targets.append(args.url)
if args.hosts:
    targets += [l.strip() for l in open(args.hosts) if l.strip()]

all_found = []
for target in targets:
    print(f"[*] Scanning {target} ({len(API_DOC_PATHS)} paths)")
    found = scan_host(target, API_DOC_PATHS, args.threads)
    for r in found:
        print(f"  [FOUND] {r['url']} → HTTP {r['status']} ({r['size']}B) {r['content_type']}")
        if args.save_specs:
            fname = r['url'].replace('https://', '').replace('http://', '').replace('/', '_') + ".json"
            open(fname, 'wb').write(r['body'])
            print(f"    Saved: {fname}")
        all_found.append(r)

print(f"\n[*] Total specs found: {len(all_found)}")
for r in all_found:
    print(f"  {r['url']}")
```

---

## Script 2 — OpenAPI Spec Deep Analyzer

Parses a found spec and extracts all intelligence: internal hostnames, security schemes, unauthenticated endpoints, sensitive paths.

```python
#!/usr/bin/env python3
"""
OpenAPI spec deep analyzer.
Extracts: internal hostnames, security schemes, unauthenticated endpoints,
sensitive paths, parameter inventory, response shapes.

Usage: python3 openapi_analyze.py --url https://api.target.com/docs.json
       python3 openapi_analyze.py --file spec.json
"""
import ssl, json, re, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import urlparse

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

INTERNAL_HOST_PATTERNS = [
    r'https?://[a-z0-9\-]+\.internal\.[a-z0-9\-\.]+',       # *.internal.*
    r'https?://[a-z0-9\-]+\.(?:internal|local|corp|lan|intra|private|priv)',  # TLD
    r'https?://(?:10|172|192\.168)\.[0-9.]+',                # RFC1918 IP
    r'https?://localhost[:/]',                                # Localhost
    r'https?://[a-z0-9\-]+-(?:internal|int|priv|private)\.',  # suffix pattern
    r'https?://(?:dev|stg|staging|uat|ppd|preprod)\.[a-z0-9\-\.]+',  # Env subdomains
]

SENSITIVE_PATH_KEYWORDS = [
    "admin", "internal", "debug", "private", "secret", "management",
    "impersonate", "sudo", "superuser", "system", "audit", "config",
    "backup", "export", "migrate", "reset", "revoke", "purge",
]

SENSITIVE_PARAM_KEYWORDS = [
    "password", "secret", "token", "key", "credential", "auth",
    "ssn", "tax", "credit_card", "card_number", "cvv",
    "admin", "role", "permission", "scope",
]

def fetch_spec(url):
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        resp = urlopen(req, context=ctx, timeout=20)
        return json.loads(resp.read())
    except Exception as e:
        print(f"[-] Failed to fetch spec: {e}")
        return None

def analyze_spec(spec, source_url=None):
    report = {
        "meta": {},
        "internal_hostnames": [],
        "security_schemes": {},
        "unauthenticated_endpoints": [],
        "sensitive_endpoints": [],
        "all_endpoints": [],
        "sensitive_params": [],
        "total_paths": 0,
        "total_operations": 0,
    }

    # ── 1. Metadata ────────────────────────────────────────────
    info = spec.get("info", {})
    report["meta"] = {
        "title": info.get("title"),
        "version": info.get("version"),
        "openapi": spec.get("openapi") or spec.get("swagger"),
        "description": (info.get("description") or "")[:200],
    }

    # ── 2. Internal hostnames in servers[] ─────────────────────
    servers = spec.get("servers", [])
    if isinstance(servers, list):
        for srv in servers:
            url = srv.get("url", "")
            for pat in INTERNAL_HOST_PATTERNS:
                if re.search(pat, url, re.IGNORECASE):
                    report["internal_hostnames"].append({
                        "url": url,
                        "pattern": pat,
                        "description": srv.get("description", "")
                    })
                    break
    # Swagger 2.0 style: host + basePath
    if "host" in spec:
        host = spec["host"]
        base = spec.get("basePath", "")
        for pat in INTERNAL_HOST_PATTERNS:
            if re.search(pat, host, re.IGNORECASE):
                report["internal_hostnames"].append({"url": f"https://{host}{base}", "pattern": pat})

    # ── 3. Security schemes ────────────────────────────────────
    components = spec.get("components", spec.get("securityDefinitions", {}))
    sec_schemes = components.get("securitySchemes", components) if "securitySchemes" in components else spec.get("securityDefinitions", {})
    for name, scheme in (sec_schemes or {}).items():
        report["security_schemes"][name] = {
            "type": scheme.get("type"),
            "in": scheme.get("in"),          # header, query, cookie
            "name": scheme.get("name"),      # Header/param name
            "scheme": scheme.get("scheme"),  # bearer, basic
            "flows": list(scheme.get("flows", {}).keys()) if "flows" in scheme else None,
        }

    # ── 4. Global security requirement ─────────────────────────
    global_security = spec.get("security", None)
    global_unauth = (global_security == [] or global_security == [{}])

    # ── 5. Enumerate all paths ─────────────────────────────────
    paths = spec.get("paths", {})
    report["total_paths"] = len(paths)
    HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"]

    for path, path_item in paths.items():
        for method in HTTP_METHODS:
            op = path_item.get(method)
            if not op:
                continue
            report["total_operations"] += 1

            op_id = op.get("operationId", "")
            summary = op.get("summary", "")
            tags = op.get("tags", [])

            # Per-operation security
            op_security = op.get("security", None)
            is_unauth = (op_security == [] or op_security == [{}]) or (op_security is None and global_unauth)

            # Collect params
            params = []
            for p in (op.get("parameters") or []):
                pname = p.get("name", "")
                ploc = p.get("in", "")
                params.append({"name": pname, "in": ploc})
                if any(k in pname.lower() for k in SENSITIVE_PARAM_KEYWORDS):
                    report["sensitive_params"].append({
                        "path": path, "method": method.upper(),
                        "param": pname, "in": ploc
                    })

            entry = {
                "path": path,
                "method": method.upper(),
                "operationId": op_id,
                "summary": summary,
                "tags": tags,
                "authenticated": not is_unauth,
                "params": params,
            }
            report["all_endpoints"].append(entry)

            if is_unauth:
                report["unauthenticated_endpoints"].append(entry)

            # Sensitive path detection
            if any(k in path.lower() or k in op_id.lower() or k in summary.lower()
                   for k in SENSITIVE_PATH_KEYWORDS):
                report["sensitive_endpoints"].append(entry)

    return report

def print_report(report, source_url=None):
    print(f"\n{'='*70}")
    print(f"API SCHEMA EXPOSURE ANALYSIS")
    if source_url:
        print(f"Source: {source_url}")
    print(f"{'='*70}")

    m = report["meta"]
    print(f"\n[META]")
    print(f"  Title:   {m.get('title')}")
    print(f"  Version: {m.get('version')}")
    print(f"  OpenAPI: {m.get('openapi')}")
    print(f"  Paths:   {report['total_paths']}  |  Operations: {report['total_operations']}")

    if report["internal_hostnames"]:
        print(f"\n[INTERNAL HOSTNAMES EXPOSED] ← HIGH VALUE for SSRF/network mapping")
        for h in report["internal_hostnames"]:
            print(f"  {h['url']}")
            if h.get("description"):
                print(f"    Description: {h['description']}")
    else:
        print(f"\n[Hostnames] No internal hostnames detected in servers[]")

    if report["security_schemes"]:
        print(f"\n[SECURITY SCHEMES]")
        for name, scheme in report["security_schemes"].items():
            print(f"  {name}:")
            print(f"    Type: {scheme['type']} | In: {scheme['in']} | Name/Header: {scheme['name']}")
            if scheme.get("scheme"):
                print(f"    Scheme: {scheme['scheme']}")
            if scheme.get("flows"):
                print(f"    OAuth Flows: {scheme['flows']}")

    if report["unauthenticated_endpoints"]:
        print(f"\n[UNAUTHENTICATED ENDPOINTS] ({len(report['unauthenticated_endpoints'])}) ← Test for abuse/enumeration")
        for ep in report["unauthenticated_endpoints"][:20]:
            params = ", ".join([p['name'] for p in ep['params']]) if ep['params'] else "(no params)"
            print(f"  {ep['method']:6} {ep['path']} [{params}]")
    else:
        print(f"\n[Unauthenticated Endpoints] All endpoints require auth (per spec)")

    if report["sensitive_endpoints"]:
        print(f"\n[SENSITIVE ENDPOINTS] ({len(report['sensitive_endpoints'])}) ← Priority targets")
        for ep in report["sensitive_endpoints"][:20]:
            auth_flag = "AUTH" if ep['authenticated'] else "NO-AUTH"
            print(f"  [{auth_flag}] {ep['method']:6} {ep['path']} ({ep.get('summary','')[:60]})")

    if report["sensitive_params"]:
        print(f"\n[SENSITIVE PARAMETERS] ({len(report['sensitive_params'])})")
        for p in report["sensitive_params"][:15]:
            print(f"  {p['method']} {p['path']} — param '{p['param']}' in {p['in']}")

    print(f"\n[SAMPLE ENDPOINTS] (first 15 of {report['total_paths']})")
    for ep in report["all_endpoints"][:15]:
        auth_flag = "✓" if ep['authenticated'] else "✗UNAUTH"
        print(f"  [{auth_flag}] {ep['method']:6} {ep['path']}")

parser = argparse.ArgumentParser()
parser.add_argument("--url", help="URL of the spec (e.g. https://api.target.com/docs.json)")
parser.add_argument("--file", help="Local spec file path")
parser.add_argument("--out", help="Save full report as JSON")
args = parser.parse_args()

if args.url:
    print(f"[*] Fetching spec from {args.url}")
    spec = fetch_spec(args.url)
    source = args.url
elif args.file:
    with open(args.file) as f:
        spec = json.load(f)
    source = args.file
else:
    print("Specify --url or --file")
    exit(1)

if spec:
    report = analyze_spec(spec, source)
    print_report(report, source)
    if args.out:
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\n[*] Full report saved: {args.out}")
```

---

## Script 3 — Multi-Host API Doc Hunter

Scans all live hosts for exposed API docs in a single pass — designed for mass reconnaissance.

```python
#!/usr/bin/env python3
"""
Mass API doc scanner + internal hostname extractor.
Takes a list of hosts and finds all exposed OpenAPI specs.
For each found spec, immediately extracts internal hostnames.

Usage: python3 mass_api_doc_hunt.py -f live_hosts.txt [--analyze]
"""
import ssl, json, re, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from concurrent.futures import ThreadPoolExecutor, as_completed

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

# High-priority paths to check first (fastest hits)
PRIORITY_PATHS = [
    "/docs.json", "/openapi.json", "/swagger.json",
    "/v3/api-docs", "/api-docs.json", "/api-docs",
    "/docs", "/swagger-ui.html", "/redoc",
    "/documentation/json", "/swagger/doc.json",
    "/v1/api-docs", "/v2/api-docs",
    "/api/swagger.json", "/api/openapi.json",
    "/swagger/v1/swagger.json",
    "/apispec.json", "/schema.json",
]

INTERNAL_PATTERNS = [
    re.compile(r'https?://[a-z0-9\-]+\.internal\.[a-z0-9\-\.]+', re.I),
    re.compile(r'https?://[a-z0-9\-]+\.(?:internal|local|corp|lan|intra|priv)', re.I),
    re.compile(r'https?://(?:10|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.\d+\.\d+', re.I),
]

def looks_like_spec(body_bytes):
    try:
        text = body_bytes[:500].decode(errors='replace')
        return any(x in text for x in ['"openapi"', '"swagger"', '"paths"', '"info":{'])
    except Exception:
        return False

def find_internal_hosts_fast(body_bytes):
    try:
        text = body_bytes.decode(errors='replace')
    except Exception:
        return []
    found = []
    for pat in INTERNAL_PATTERNS:
        found.extend(pat.findall(text))
    return list(set(found))

def check(base, path):
    url = base.rstrip("/") + path
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "application/json, */*"})
        resp = urlopen(req, context=ctx, timeout=7)
        body = resp.read()
        if resp.status == 200 and len(body) > 300 and looks_like_spec(body):
            internals = find_internal_hosts_fast(body)
            try:
                spec = json.loads(body)
                path_count = len(spec.get("paths", {}))
                title = spec.get("info", {}).get("title", "Unknown")
            except Exception:
                path_count = 0
                title = "Unknown (YAML?)"
            return {
                "base": base, "path": path, "url": url,
                "size": len(body), "title": title,
                "path_count": path_count,
                "internal_hosts": internals,
                "body": body
            }
    except (HTTPError, URLError, Exception):
        pass
    return None

def scan_host(base):
    for path in PRIORITY_PATHS:
        result = check(base, path)
        if result:
            return result
    return None

parser = argparse.ArgumentParser()
parser.add_argument("-f", "--file", required=True, help="File with live host URLs")
parser.add_argument("--threads", type=int, default=30)
parser.add_argument("--analyze", action="store_true", help="Run deep analysis on found specs")
args = parser.parse_args()

hosts = [l.strip() for l in open(args.file) if l.strip()]
print(f"[*] Scanning {len(hosts)} hosts for exposed API docs...")

findings = []
with ThreadPoolExecutor(max_workers=args.threads) as ex:
    futs = {ex.submit(scan_host, h): h for h in hosts}
    for fut in as_completed(futs):
        r = fut.result()
        if r:
            findings.append(r)
            print(f"\n[API SPEC FOUND] {r['url']}")
            print(f"  Title: {r['title']} | Paths: {r['path_count']} | Size: {r['size']}B")
            if r["internal_hosts"]:
                print(f"  [INTERNAL HOSTS LEAKED]: {r['internal_hosts']}")

print(f"\n{'='*60}")
print(f"[*] Exposed specs found: {len(findings)}")
specs_with_internal = [f for f in findings if f["internal_hosts"]]
print(f"[*] With internal hostname disclosure: {len(specs_with_internal)}")
for f in specs_with_internal:
    for h in f["internal_hosts"]:
        print(f"  {f['base']} → INTERNAL: {h}")
```

---

## Script 4 — Endpoint Inventory to Attack Matrix

Converts a discovered spec into a prioritized attack checklist.

```python
#!/usr/bin/env python3
"""
Convert OpenAPI spec to prioritized attack matrix.
Groups endpoints by risk and generates targeted test commands.

Usage: python3 spec_to_attack.py --url https://api.target.com/docs.json \
       --token "Bearer <token>"
"""
import ssl, json, argparse, re
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

# Priority scoring for endpoints
def score_endpoint(path, method, op):
    score = 0
    reasons = []
    path_l = path.lower()
    op_str = json.dumps(op).lower()

    # High-value path keywords
    HIGH_KEYWORDS = ["admin", "user", "account", "billing", "invoice", "payment",
                     "export", "import", "upload", "download", "report", "key",
                     "token", "secret", "password", "reset", "impersonate", "role",
                     "permission", "config", "setting", "internal", "delete", "purge"]
    for kw in HIGH_KEYWORDS:
        if kw in path_l:
            score += 2
            reasons.append(f"path:{kw}")

    # Methods that modify state
    if method in ("POST", "PUT", "PATCH", "DELETE"):
        score += 1
        reasons.append(f"mutating:{method}")

    # Has ID parameters (IDOR candidate)
    if re.search(r'\{[a-z_]*id[a-z_]*\}', path, re.I):
        score += 3
        reasons.append("id-param:IDOR-candidate")

    # Has multiple ID params (compound IDOR)
    id_params = re.findall(r'\{([a-z_]*id[a-z_]*)\}', path, re.I)
    if len(id_params) > 1:
        score += 2
        reasons.append(f"multi-id:{id_params}")

    # Unauthenticated (security: [])
    if op.get("security") == [] or op.get("security") == [{}]:
        score += 2
        reasons.append("unauthenticated")

    return score, reasons

def fetch_spec(url):
    req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    resp = urlopen(req, context=ctx, timeout=20)
    return json.loads(resp.read())

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True, help="Spec URL")
parser.add_argument("--base-url", help="Override base URL for attack commands")
parser.add_argument("--token", default="YOUR_TOKEN_HERE")
args = parser.parse_args()

spec = fetch_spec(args.url)

# Determine base URL from spec
base_url = args.base_url
if not base_url:
    servers = spec.get("servers", [])
    if servers:
        base_url = servers[0]["url"]
    else:
        base_url = args.url.rsplit("/", 1)[0]

# Global auth requirement
global_security = spec.get("security")
global_unauth = (global_security == [] or global_security == [{}])

# Score and sort all endpoints
scored = []
paths = spec.get("paths", {})
for path, path_item in paths.items():
    for method in ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]:
        op = path_item.get(method.lower())
        if not op:
            continue
        score, reasons = score_endpoint(path, method, op)
        scored.append({
            "score": score,
            "path": path,
            "method": method,
            "op": op,
            "reasons": reasons,
            "summary": op.get("summary", ""),
            "operationId": op.get("operationId", ""),
        })

scored.sort(key=lambda x: x["score"], reverse=True)

print(f"\n{'='*70}")
print(f"ATTACK MATRIX — {spec.get('info', {}).get('title', 'Unknown API')}")
print(f"Base URL: {base_url}")
print(f"Total endpoints: {len(scored)}")
print(f"{'='*70}")

# Top 20 priority endpoints
print(f"\n[TOP PRIORITY ENDPOINTS]")
for ep in scored[:20]:
    auth_flag = "UNAUTH" if any("unauthenticated" in r for r in ep["reasons"]) else "AUTH"
    idor_flag = " [IDOR?]" if any("IDOR" in r for r in ep["reasons"]) else ""
    print(f"\n  Score {ep['score']:2d} | [{auth_flag}]{idor_flag} {ep['method']} {ep['path']}")
    print(f"    Summary: {ep['summary'][:60]}")
    print(f"    Reasons: {', '.join(ep['reasons'])}")

    # Generate test command
    url = base_url.rstrip("/") + ep["path"]
    # Replace path params with test values
    url_test = re.sub(r'\{[^}]+\}', '1', url)
    if ep["method"] == "GET":
        print(f"    Test: curl -s -H 'Authorization: {args.token}' '{url_test}'")
    else:
        print(f"    Test: curl -s -X {ep['method']} -H 'Authorization: {args.token}' -H 'Content-Type: application/json' -d '{{}}' '{url_test}'")

# Unauthenticated endpoints
unauth = [ep for ep in scored if any("unauthenticated" in r for r in ep["reasons"])]
if unauth:
    print(f"\n[UNAUTHENTICATED ENDPOINTS — no token needed]")
    for ep in unauth:
        url = base_url.rstrip("/") + re.sub(r'\{[^}]+\}', '1', ep["path"])
        print(f"  {ep['method']} {ep['path']}")
        print(f"    curl -s '{url}'")

# Internal server URLs for SSRF
servers = spec.get("servers", [])
internal = [s["url"] for s in servers if re.search(r'internal|local|corp|\.priv', s.get("url", ""), re.I)]
if internal:
    print(f"\n[SSRF TARGETS — internal hostnames from servers[]]")
    for h in internal:
        print(f"  {h}")
        print(f"  → Test SSRF: inject into any URL parameter pointing to {h}")
```

---

## Intelligence Extraction Framework

### What to Look For in Every Exposed Spec

```
1. servers[] → Internal hostnames (SSRF targets, network topology)
2. info.version → Environment hints (0.1.0 = dev/alpha, internal build)
3. security: [] → Global empty = ALL endpoints unauthenticated
4. paths[*][method].security: [] → Per-operation unauthenticated overrides
5. components.securitySchemes → Exact auth header names + token types
6. paths with {id} params → IDOR candidates (every one needs testing)
7. paths with "admin", "internal" keywords → Vertical access testing
8. paths with "export", "report", "download" → Data exposure testing
9. requestBody.content schema → Exact param names for injection/mass assignment
10. responses[4xx/5xx] schemas → Error oracle shapes for blind testing
```

### Internal Hostname Chain: Spec → SSRF

When `servers[]` contains internal hostnames:
```python
# Example: spec returns "servers": [{"url": "https://api.glob-use1.internal.faros.ai"}]
# Attack chain:
# 1. Note the internal hostname: api.glob-use1.internal.faros.ai
# 2. Find URL-accepting parameters in the API (webhook URLs, redirect URIs, callback URLs)
# 3. Test SSRF: does the API make requests to attacker-supplied URLs?
# 4. If yes: target internal hostname → access internal API without auth

# Find URL-type params in spec:
for path, ops in spec["paths"].items():
    for method, op in ops.items():
        for param in (op.get("parameters") or []):
            if any(k in (param.get("name") or "").lower()
                   for k in ["url", "uri", "callback", "redirect", "webhook", "endpoint", "target"]):
                print(f"URL PARAM: {method.upper()} {path} → {param['name']}")
```

### Security Scheme → Auth Bypass Testing

```python
# Example: spec discloses {"type": "apiKey", "in": "header", "name": "authorization"}
# Use this to:
# 1. Craft requests with exact header name ("authorization" not "Authorization")
# 2. Test header name case sensitivity
# 3. Test JWT alg:none against the apiKey scheme
# 4. Test empty/null/malformed values for 500 vs 401 differential
```

---

## Attack Surface

- `/docs.json`, `/docs.html` (NestJS/Fastify defaults — frequently missed)
- `/v3/api-docs`, `/v3/api-docs.yaml` (Spring Boot springdoc-openapi)
- `/swagger/v1/swagger.json` (.NET / ASP.NET Core)
- `/documentation/json` (Fastify swagger plugin)
- `/apispec.json` (Flask-RESTx / Flasgger)
- `/schema.json`, `/schema/` (Django REST Framework)
- `/api/documentation` (Laravel l5-swagger)
- All paths with Swagger UI (`swagger-ui-bundle.js` in page source = doc UI present)

## Triage

| Finding | Severity | Why |
|---|---|---|
| Internal hostname in `servers[]` | MEDIUM-HIGH | SSRF pivot, network topology |
| Full endpoint inventory exposed | MEDIUM | Eliminates discovery phase for attacker |
| Unauthenticated endpoints documented | MEDIUM | Confirms attack surface, abuse potential |
| Auth scheme + header name disclosed | LOW-MEDIUM | Aids auth bypass attempts |
| Version metadata (`info.version`) | LOW | Environment fingerprinting |
| Admin/internal endpoint names visible | MEDIUM | Targeted vertical access testing |

## Chaining to Higher Severity

1. **Spec → SSRF**: Internal hostname in `servers[]` → find URL param in API → SSRF to internal network
2. **Spec → IDOR**: Endpoint with `{userId}` param → test with victim user ID → data exposure
3. **Spec → Mass Assignment**: `requestBody.content` reveals all field names including hidden fields → inject admin flags
4. **Spec → Auth Bypass**: Security scheme discloses exact header name → test null/malformed values → 500 differential
5. **Spec → Unauthenticated Abuse**: `security: []` endpoints → test for rate-limit abuse, enumeration, data scraping

## Validation Requirements

- `GET /docs.json → HTTP 200 (no Authorization header)` — unauthenticated access confirmed
- Spec body contains valid JSON/YAML with `openapi`/`swagger` key
- `servers[]` contains at minimum one URL; note if any match internal hostname patterns
- `components.securitySchemes` documents auth header name/type
- `paths` count > N confirms full inventory exposure
- At least one `security: []` per-operation to confirm unauthenticated endpoint documented

## False Positives

- Intentionally public API docs with no internal topology leakage (servers[] = public URL only)
- Docs behind authentication (check if auth gate on `/docs.json` applies)
- Version metadata with no sensitive content (info.version alone is LOW/informational)

## Bug Bounty Acceptance Scoring

- **Internal hostname in servers[]**: 7/10 — real infrastructure disclosure, chains to SSRF
- **Full endpoint inventory only**: 5/10 — informational unless combined with finding
- **Unauthenticated endpoint via spec**: escalates to 8/10 if data returned
- **Would this be accepted?**: YES for MEDIUM if internal hostname present; YES for LOW if just endpoint count
