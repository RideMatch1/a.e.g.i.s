<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: unhandled-exception-differential
description: Detect unhandled exceptions in security-sensitive endpoints via differential error analysis — comparing HTTP status codes for well-formed-invalid vs. malformed inputs to identify missing exception handlers in token parsing, JSON processing, and auth validation paths
---

# Unhandled Exception via Differential Error Analysis

## Core Concept (Read This First)

This is **not** about exploiting a bug to gain access. It is about proving that an exception handler is **missing** in a security-critical code path.

**The fundamental test:**
```
Well-formed-but-invalid token  →  HTTP 403 "Invalid Session/Token"   (expected fail-closed)
Malformed token (wrong format)  →  HTTP 500 "Internal Server Error"   (unexpected = no handler)
```

The differential (403 vs 500) is the evidence. A 500 on the same endpoint where the baseline is 403 proves that the server's token validation code throws an uncaught exception for certain input shapes — it does not "fail closed," it **crashes**.

**Why this matters on security endpoints:**
- OTP generation, login, password reset, session refresh = pre-authentication critical paths
- 500 on these endpoints = logs flooded with stack traces (log noise can mask real attacks)
- Exception-based code divergence exposes different internal code paths than normal operation
- Availability risk: exception handling is typically more expensive than normal flow
- Defensive bypass potential: 500 responses may have different behavior (no rate limiting increment, no audit log, different response headers)

**Reasoning required by the model:** This finding requires multi-step differential reasoning, not just "found a 500 error." The model must:
1. Establish a clear baseline (what the endpoint returns for well-formed-but-invalid tokens)
2. Systematically test the malformation battery
3. Confirm the differential is consistent and deterministic
4. Identify which malformation type triggers the divergence
5. Assess which code path is affected (parser? decoder? validator?)
6. Rule out false positives (is the 500 actually meaningful?)

---

## STEP 1 — Identify High-Value Target Endpoints

Pre-authentication endpoints that process tokens/credentials are the highest-value targets:

```bash
TARGET="https://TARGET"

# These endpoint patterns handle tokens BEFORE auth is established
# They are the most impactful because they're reachable without any credentials

PRE_AUTH_PATTERNS=(
  # OTP generation / validation
  "/otp/generate" "/otp/verify" "/otp/send" "/otp/validate"
  "/api/otp" "/auth/otp" "/v1/otp"
  # Login / session creation
  "/login" "/signin" "/auth/login" "/api/login" "/v1/auth/login"
  "/session" "/sessions" "/token" "/tokens"
  # Password reset (critical path)
  "/password/reset" "/password/forgot" "/account/reset"
  "/api/reset-password" "/auth/reset"
  # Token refresh (processes existing tokens)
  "/token/refresh" "/auth/refresh" "/session/refresh"
  "/api/refresh" "/v1/refresh"
  # Two-factor / MFA
  "/2fa/verify" "/mfa/verify" "/auth/2fa" "/verify"
  # Banking/financial specific
  "/iamng/otp" "/ibng/otp" "/digital-bank/auth"
  "/internet-banking/login" "/netbank/auth"
)

echo "=== Mapping pre-auth auth endpoints ==="
for pattern in "${PRE_AUTH_PATTERNS[@]}"; do
  result=$(curl -sk -o /dev/null -w "%{http_code}" \
    -X POST "$TARGET$pattern" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test" \
    -d '{}' 2>/dev/null)
  # Any response that isn't 404 is worth testing
  [ "$result" != "404" ] && [ "$result" != "000" ] && \
    echo "[$result] $TARGET$pattern"
done | tee output/preauth_endpoints.txt
```

---

## STEP 2 — Establish Baseline (Well-Formed-Invalid Token)

Before testing malformed tokens, **confirm what a "normal bad token" returns**.
A proper security implementation should return 401 or 403 for all invalid tokens, regardless of format.

```python
# tools/establish_baseline.py
"""
Establish the expected error response for well-formed-but-invalid tokens.
This is the 'control group' for the differential test.
"""
import base64, json, time, urllib.request, urllib.error, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def make_jwt_like_token(alg="HS256"):
    """Create a structurally valid JWT that will fail signature validation"""
    header = b64url_encode(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    payload = b64url_encode(json.dumps({
        "sub": "test-user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
        "jti": "baseline-test"
    }).encode())
    sig = b64url_encode(b"invalid_signature_for_testing")
    return f"{header}.{payload}.{sig}"

def test_endpoint(url, token, method="POST", body="{}", extra_headers=None):
    """Send a request and record the response details"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    req = urllib.request.Request(
        url,
        data=body.encode() if isinstance(body, str) else body,
        headers=headers,
        method=method
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            elapsed = time.time() - t0
            response_body = r.read(500).decode('utf-8', 'ignore')
            return {
                "status": r.status,
                "body": response_body,
                "elapsed": round(elapsed, 3),
                "headers": dict(r.headers)
            }
    except urllib.error.HTTPError as e:
        elapsed = time.time() - t0
        response_body = e.read(500).decode('utf-8', 'ignore')
        return {
            "status": e.code,
            "body": response_body,
            "elapsed": round(elapsed, 3),
            "headers": dict(e.headers)
        }
    except Exception as ex:
        return {"status": 0, "body": str(ex), "elapsed": time.time() - t0}

# Test baseline
endpoint = "TARGET_ENDPOINT"  # Replace with actual endpoint
baseline_token = make_jwt_like_token()
result = test_endpoint(endpoint, baseline_token)

print(f"=== BASELINE RESPONSE ===")
print(f"Token: {baseline_token[:50]}...")
print(f"Status: {result['status']}")
print(f"Body: {result['body'][:200]}")
print(f"Time: {result['elapsed']}s")
print()
print(f"Expected: 401 or 403 (fail-closed for invalid token)")
if result['status'] in (401, 403):
    print(f"✓ Endpoint correctly rejects well-formed-invalid tokens with {result['status']}")
elif result['status'] == 200:
    print(f"⚠ WARNING: Endpoint ACCEPTS invalid tokens (auth bypass?)")
elif result['status'] == 500:
    print(f"⚠ Endpoint already returns 500 for well-formed tokens — different issue")
```

---

## STEP 3 — Token Malformation Battery

```python
# tools/malformation_battery.py
"""
Test a systematic battery of malformed token variants.
Each variant targets a different parser stage:
  - Pre-parse: null, empty, undefined, single-char
  - Structure: wrong segment count (0, 1, 2, 4+)
  - Base64url: invalid characters, wrong padding
  - JSON: non-JSON after decoding, truncated JSON
  - Size: very short, very long (but below size limits)
  - Type confusion: number, boolean, array as token
"""
import base64, json, time, sys
# (import test_endpoint from establish_baseline.py or inline it here)

def b64url(s: bytes) -> str:
    return base64.urlsafe_b64encode(s).rstrip(b'=').decode()

# ─────────────────────────────────────────────
# TOKEN MALFORMATION TAXONOMY
# Each entry: (label, token_string, expected_error_type)
# ─────────────────────────────────────────────
MALFORMED_TOKENS = [
    # === Stage 1: Pre-parse / Type coercion ===
    # These test whether the server checks token presence/type before parsing
    ("literal_null",       "null",           "type_coercion"),
    ("literal_undefined",  "undefined",      "type_coercion"),
    ("literal_true",       "true",           "type_coercion"),
    ("literal_false",      "false",          "type_coercion"),
    ("literal_zero",       "0",              "type_coercion"),
    ("literal_number",     "12345",          "type_coercion"),
    ("empty_string",       "",               "type_coercion"),
    ("single_space",       " ",              "type_coercion"),
    ("only_dots",          "...",            "type_coercion"),
    ("only_dot",           ".",              "type_coercion"),

    # === Stage 2: Segment count validation ===
    # JWT = 3 segments (header.payload.signature)
    # Tests whether segment count is validated before decoding
    ("zero_segments",      "nosegments",                        "segment_count"),
    ("one_segment",        "onlyone",                           "segment_count"),
    ("two_segments",       "aaa.bbb",                           "segment_count"),
    ("four_segments",      "a.b.c.d",                           "segment_count"),
    ("five_segments",      "a.b.c.d.e",                         "segment_count"),
    ("many_segments",      ".".join(["x"] * 20),                "segment_count"),
    ("leading_dot",        ".aaa.bbb.ccc",                      "segment_count"),
    ("trailing_dot",       "aaa.bbb.ccc.",                      "segment_count"),
    ("double_dot",         "aaa..bbb.ccc",                      "segment_count"),

    # Three segments but with invalid content ↓
    ("all_dots",           "aaa.bbb.ccc",                       "content"),
    ("single_chars",       "a.b.c",                             "content"),

    # === Stage 3: Base64url decoding ===
    # Tests whether b64url decoding errors are caught
    ("invalid_b64_header", "!!!.bbb.ccc",                       "base64_decode"),
    ("invalid_b64_payload", "aaa.!!!.ccc",                      "base64_decode"),
    ("standard_b64_not_url",
     base64.b64encode(b'{"alg":"HS256"}').decode() + ".payload.sig",
                                                                 "base64_decode"),
    ("b64_with_padding",
     base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode() + ".payload.sig",
                                                                 "base64_decode"),
    ("unicode_header",     "Ω™.payload.sig",                    "base64_decode"),
    ("null_byte",          "aaa\x00.bbb.ccc",                   "base64_decode"),

    # === Stage 4: JSON parsing of decoded segments ===
    # Tests whether JSON parse errors in header/payload are caught
    ("non_json_header",
     b64url(b"NOT_JSON") + "." + b64url(b'{"sub":"x"}') + ".sig",
                                                                 "json_parse"),
    ("truncated_json_header",
     b64url(b'{"alg"') + "." + b64url(b'{"sub":"x"}') + ".sig",
                                                                 "json_parse"),
    ("empty_json_header",
     b64url(b"") + "." + b64url(b'{"sub":"x"}') + ".sig",
                                                                 "json_parse"),
    ("array_as_header",
     b64url(b'["array","not","object"]') + "." + b64url(b'{}') + ".sig",
                                                                 "json_parse"),
    ("null_json_header",
     b64url(b'null') + "." + b64url(b'{"sub":"x"}') + ".sig",   "json_parse"),

    # === Stage 5: Algorithm/signature validation ===
    # Tests whether signature errors during validation are caught
    ("alg_none",
     b64url(b'{"alg":"none","typ":"JWT"}') + "." +
     b64url(b'{"sub":"x","exp":9999999999}') + ".",              "alg_none"),
    ("alg_none_with_sig",
     b64url(b'{"alg":"none"}') + "." + b64url(b'{}') + ".fakesig",
                                                                 "alg_none"),
    ("empty_alg",
     b64url(b'{"alg":"","typ":"JWT"}') + "." + b64url(b'{}') + ".sig",
                                                                 "alg_empty"),
    ("unknown_alg",
     b64url(b'{"alg":"MAGIC2048","typ":"JWT"}') + "." + b64url(b'{}') + ".sig",
                                                                 "alg_unknown"),

    # === Stage 6: Size boundary testing ===
    ("very_short",         "x.y.z",                             "size"),
    ("100kb_header",       ("A" * 100000) + ".b.c",             "size"),  # likely 431
    ("long_payload",
     "aaa." + ("B" * 10000) + ".ccc",                           "size"),
]

def run_malformation_battery(endpoint, baseline_status, extra_headers=None):
    """
    Run all malformed token tests. Report any that differ from baseline.
    baseline_status: the HTTP status code returned for well-formed-invalid tokens (e.g., 403)
    """
    results = []
    differentials = []

    print(f"\n=== MALFORMATION BATTERY: {endpoint} ===")
    print(f"Baseline status: {baseline_status} | Testing {len(MALFORMED_TOKENS)} variants\n")

    for label, token, malform_type in MALFORMED_TOKENS:
        r = test_endpoint(endpoint, token, extra_headers=extra_headers)
        status = r["status"]
        is_differential = (status != baseline_status)
        is_500 = (status == 500)

        results.append({
            "label": label,
            "token": token[:40] + ("..." if len(token) > 40 else ""),
            "malform_type": malform_type,
            "status": status,
            "elapsed": r["elapsed"],
            "body": r["body"][:100],
            "differential": is_differential,
            "is_500": is_500
        })

        if is_500 or is_differential:
            differentials.append(results[-1])
            marker = "🔴 500!" if is_500 else f"⚠ {status}≠{baseline_status}"
            print(f"[{marker}] {label:30s} → {status} ({r['elapsed']}s)")
            print(f"  Token: {token[:60]}")
            print(f"  Body: {r['body'][:120]}")
        else:
            print(f"[OK  {status}] {label:30s} ({r['elapsed']}s)")

        time.sleep(0.4)  # Respectful rate limiting

    return results, differentials

# Usage:
# results, differentials = run_malformation_battery(
#     "https://TARGET/endpoint",
#     baseline_status=403,
#     extra_headers={"clientid": "app", "channelid": "web"}
# )
```

---

## STEP 4 — Confirm Differential is Deterministic

A 500 error must be **repeatable** to be a valid finding. Transient 500s (server overload, deployment) are not findings.

```python
# tools/confirm_deterministic.py
"""
For each differential found, confirm it is deterministic (same result every time).
Test each malformed token 3-5 times with delays between requests.
"""
import time

def confirm_deterministic(endpoint, token, expected_500, n=3, delay=2.0, extra_headers=None):
    """
    Send the same malformed token n times and confirm consistent 500 responses.
    Returns True if deterministic.
    """
    statuses = []
    print(f"\n=== Confirming deterministic: {token[:40]} ===")

    for i in range(n):
        r = test_endpoint(endpoint, token, extra_headers=extra_headers)
        statuses.append(r["status"])
        print(f"  Attempt {i+1}/{n}: HTTP {r['status']} | {r['body'][:80]}")
        time.sleep(delay)

    all_same = len(set(statuses)) == 1
    all_expected = all(s == expected_500 for s in statuses)

    if all_same and all_expected:
        print(f"  ✓ DETERMINISTIC: All {n} attempts returned {statuses[0]}")
        return True
    elif all_same:
        print(f"  ✓ Consistent (all {statuses[0]}) but not 500 — re-evaluate")
        return False
    else:
        print(f"  ✗ NON-DETERMINISTIC: Got {statuses} — likely transient, NOT a finding")
        return False

# Example usage after finding differentials:
# confirm_deterministic(endpoint, "aaa.bbb.ccc", expected_500=500)
# confirm_deterministic(endpoint, "null", expected_500=500)
```

---

## STEP 5 — Full Automated Test Runner

```python
# tools/differential_exception_tester.py
"""
Complete automated test for unhandled exception via differential error analysis.
Combines: baseline → malformation battery → differential confirmation → report generation.

Usage:
  python3 tools/differential_exception_tester.py \
    --url "https://TARGET/endpoint" \
    --method POST \
    --body '{}' \
    --header "clientid:myapp" \
    --header "channelid:web"
"""
import argparse, base64, json, time, urllib.request, urllib.error, ssl, sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def b64url(s: bytes) -> str:
    return base64.urlsafe_b64encode(s).rstrip(b'=').decode()

# Condensed battery (most impactful variants)
CORE_BATTERY = [
    ("jwt_like_invalid_sig",
     b64url(b'{"alg":"HS256","typ":"JWT"}') + "." +
     b64url(b'{"sub":"x","exp":9999999999}') + ".invalidsig"),
    ("literal_null", "null"),
    ("literal_undefined", "undefined"),
    ("two_segments", "aaa.bbb"),
    ("four_segments", "a.b.c.d"),
    ("non_json_header",
     b64url(b"NOT_JSON") + "." + b64url(b'{"sub":"x"}') + ".sig"),
    ("alg_none",
     b64url(b'{"alg":"none","typ":"JWT"}') + "." +
     b64url(b'{"sub":"x","exp":9999999999}') + "."),
    ("empty_alg",
     b64url(b'{"alg":"","typ":"JWT"}') + "." + b64url(b'{"sub":"x"}') + ".sig"),
    ("unknown_alg",
     b64url(b'{"alg":"NONE256","typ":"JWT"}') + "." + b64url(b'{"sub":"x"}') + ".sig"),
    ("all_dots", "aaa.bbb.ccc"),
    ("empty_string", ""),
    ("null_byte_in_token", "aaa\x00bbb.ccc.ddd"),
]

def run_test(url, method, body, headers):
    results = {}

    # 1. Run baseline
    print("[1/3] Running baseline...")
    baseline_token = (
        b64url(b'{"alg":"HS256","typ":"JWT"}') + "." +
        b64url(json.dumps({"sub":"test","iat":int(time.time()),"exp":int(time.time())+60}).encode()) +
        ".invalidsig_baseline"
    )
    baseline = send_request(url, method, body, headers, baseline_token)
    print(f"  Baseline: HTTP {baseline['status']} — {baseline['body'][:80]}")

    if baseline['status'] == 200:
        print("  ⚠ WARNING: Endpoint accepts the baseline token (possible auth bypass)")
        sys.exit(1)
    if baseline['status'] not in (400, 401, 403):
        print(f"  ⚠ Unusual baseline status {baseline['status']} — proceed with caution")

    # 2. Run malformation battery
    print(f"\n[2/3] Running {len(CORE_BATTERY)}-item malformation battery...")
    differentials = []
    for label, token in CORE_BATTERY:
        r = send_request(url, method, body, headers, token)
        is_diff = (r['status'] != baseline['status'])
        is_500 = (r['status'] == 500)
        marker = "🔴 DIFF" if is_diff else "✓"
        print(f"  [{marker}] {label:30s} → HTTP {r['status']}")
        if is_diff:
            differentials.append({"label": label, "token": token, **r})

    # 3. Confirm differentials
    if not differentials:
        print("\n[3/3] No differentials found — endpoint handles all malformed tokens correctly")
        return None

    print(f"\n[3/3] Confirming {len(differentials)} differential(s) are deterministic...")
    confirmed = []
    for diff in differentials:
        is_det = check_deterministic(url, method, body, headers, diff['token'], diff['status'])
        if is_det:
            confirmed.append(diff)
            print(f"  ✓ CONFIRMED: {diff['label']} → HTTP {diff['status']} (deterministic)")

    if confirmed:
        print(f"\n{'='*60}")
        print(f"FINDING: {len(confirmed)} unhandled exception(s) confirmed")
        print(f"Baseline:     HTTP {baseline['status']}")
        for c in confirmed:
            print(f"  {c['label']}: HTTP {c['status']} | Body: {c['body'][:100]}")
        print(f"{'='*60}")
        return {"baseline": baseline, "confirmed": confirmed}
    else:
        print("\n[*] All differentials were non-deterministic (transient) — not a finding")
        return None

def send_request(url, method, body, headers, token):
    h = {**headers, "Authorization": f"Bearer {token}",
         "Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(
        url, data=body.encode(), headers=h, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            return {"status": r.status, "body": r.read(300).decode('utf-8','ignore'),
                    "elapsed": round(time.time()-t0, 3)}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read(300).decode('utf-8','ignore'),
                "elapsed": round(time.time()-t0, 3)}
    except Exception as ex:
        return {"status": 0, "body": str(ex), "elapsed": round(time.time()-t0, 3)}

def check_deterministic(url, method, body, headers, token, expected_status, n=3):
    statuses = []
    for _ in range(n):
        r = send_request(url, method, body, headers, token)
        statuses.append(r['status'])
        time.sleep(1.5)
    return all(s == expected_status for s in statuses)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--method", default="POST")
    parser.add_argument("--body", default="{}")
    parser.add_argument("--header", action="append", default=[])
    args = parser.parse_args()

    extra_headers = {}
    for h in args.header:
        if ":" in h:
            k, v = h.split(":", 1)
            extra_headers[k.strip()] = v.strip()

    run_test(args.url, args.method, args.body.encode(), extra_headers)
```

```bash
# Run against target
python3 tools/differential_exception_tester.py \
  --url "https://TARGET/api/otp/generate" \
  --method POST \
  --body '{}' \
  --header "clientid:app" \
  --header "channelid:web" \
  --header "API-version:1.0" \
  | tee output/differential_exception_results.txt
```

---

## STEP 6 — Extend Beyond JWT: Other Input Surfaces

The same differential technique applies to any parsed input:

```bash
# Test for unhandled exceptions in other header/body surfaces

TARGET_ENDPOINT="https://TARGET/api/endpoint"

echo "=== Testing non-Authorization headers ==="

# API-Key header malformation
for val in "null" "" "!!!" "a.b.c" $'key\x00null'; do
  status=$(curl -sk -o /dev/null -w "%{http_code}" \
    -X POST "$TARGET_ENDPOINT" \
    -H "X-API-Key: $val" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "[$status] X-API-Key: $val"
done

# JSON body type confusion (send wrong types for expected fields)
echo ""
echo "=== Testing JSON body type confusion ==="
for body in \
  'null' \
  '"string_not_object"' \
  '[]' \
  '{"id": null}' \
  '{"id": []}' \
  '{"id": {"nested": true}}' \
  '{"id": 9999999999999999999}' \
  '{"id": "../../etc/passwd"}' \
  '{'; do
  status=$(curl -sk -o /dev/null -w "%{http_code}" \
    -X POST "$TARGET_ENDPOINT" \
    -H "Authorization: Bearer test.test.test" \
    -H "Content-Type: application/json" \
    -d "$body")
  echo "[$status] Body: $body"
done

# Content-Type mismatch (server expects JSON but receives other types)
echo ""
echo "=== Testing Content-Type mismatch ==="
for ct in \
  "text/xml" \
  "application/xml" \
  "multipart/form-data" \
  "text/plain" \
  "application/x-www-form-urlencoded" \
  "application/octet-stream"; do
  status=$(curl -sk -o /dev/null -w "%{http_code}" \
    -X POST "$TARGET_ENDPOINT" \
    -H "Authorization: Bearer a.b.c" \
    -H "Content-Type: $ct" \
    -d '{"test":1}')
  echo "[$status] Content-Type: $ct"
done
```

---

## STEP 7 — Timing Differential Analysis

Sometimes 500 responses are timing-different from 403 responses, revealing the code path divergence:

```python
# tools/timing_differential.py
"""
Measure response time differential between:
- Normal invalid token (fast rejection)
- Malformed token that causes 500 (may involve stack unwinding, logging)

Significant timing difference indicates different code paths.
"""
import statistics

def timing_profile(endpoint, token_variants, n=5, extra_headers=None):
    timings = {}
    for label, token in token_variants:
        times = []
        for _ in range(n):
            r = send_request(endpoint, "POST", b"{}", extra_headers or {}, token)
            times.append(r['elapsed'])
            time.sleep(0.5)
        timings[label] = {
            "status": r['status'],
            "mean": round(statistics.mean(times), 3),
            "stdev": round(statistics.stdev(times) if len(times) > 1 else 0, 3),
            "times": times
        }
        print(f"  {label:30s}: {r['status']} | mean={timings[label]['mean']}s ±{timings[label]['stdev']}s")

    # Compare timings
    baseline_time = timings.get("baseline_jwt", {}).get("mean", 0)
    for label, data in timings.items():
        if label != "baseline_jwt" and baseline_time > 0:
            ratio = data['mean'] / baseline_time
            if ratio > 2.0:
                print(f"  ⚠ TIMING ANOMALY: {label} is {ratio:.1f}x slower than baseline")
                print(f"    This may indicate expensive exception handling (stack trace logging, etc.)")

    return timings
```

---

## Differential Analysis Matrix — What Each 500 Indicates

| Malformed Input | Likely Code Path | Missing Handler | Probable Root Cause |
|----------------|-----------------|-----------------|---------------------|
| `null` | Token presence check | Null check before parsing | `token.split(".")` without null guard |
| `aaa.bbb` (2 segments) | Segment count validation | Array length check | `parts[2]` without index check |
| `aaa.bbb.ccc.ddd` (4 seg) | Same | Same | Same |
| Non-JSON after b64 decode | JSON parse | `try/catch` around `JSON.parse()` | Exception propagates from parser |
| `{"alg":""}` empty alg | Algorithm selection | Algorithm whitelist check | `switch(alg)` falls to default |
| `{"alg":"UNKNOWN"}` | Same | Same | Unsupported algorithm exception |
| `alg:none` + 500 | Special case handling | `none` algorithm handling | Exception in no-op signature path |
| Size boundary (100KB) | Header size limit | Expected → 431/400 normal | If 500: size limit handler missing |

---

## Impact Assessment Framework

```
Severity calculation for this vulnerability class:

BASE: MEDIUM (no authentication bypass, no data exposure)

INCREASE if:
  + Endpoint is pre-authentication (no token required to trigger)        → +1
  + Endpoint is security-critical (OTP, login, password reset, MFA)     → +1
  + 500 response contains internal error details / stack trace          → +1
  + No rate limiting on 500-triggering requests (availability risk)     → +1
  + Multiple malformed patterns trigger 500 (wide exploit surface)      → +0.5
  + Financial/banking application context                               → +1

DECREASE if:
  - Error response is generic (no information leakage)                  → -0.5
  - Rate limiting or WAF present                                        → -0.5
  - Application has compensating controls (circuit breaker, etc.)       → -0.5

FINAL RANGE: LOW-MEDIUM (3.1) to HIGH (7.5)
DBS OTP example: MEDIUM 5.3 (pre-auth + security-critical + no rate limit + financial)
```

---

## Ruling Out False Positives

Before reporting, verify ALL of the following:

1. **Baseline is genuinely 403/401** — not 200 (which would be auth bypass, different finding) and not 500 already
2. **Differential is deterministic** — same token returns same status on 3+ independent attempts
3. **500 is not from WAF/proxy** — check response body; WAF 500s have different response formats (Cloudflare, AWS WAF patterns)
4. **Not a generic "server restart" 500** — time multiple requests over 5+ minutes to confirm consistency
5. **Not intentional** — some endpoints return 500 for unrecognized request formats by design (rarely, but verify)

```bash
# Quick false-positive check: is this a WAF/Cloudflare 500 or a real 500?
curl -sk "https://TARGET/endpoint" \
  -X POST \
  -H "Authorization: Bearer null" \
  -H "Content-Type: application/json" \
  -d '{}' -v 2>&1 | grep -E "CF-RAY|x-amzn|x-cache|server:|cf-request"

# If response contains CF-RAY or x-amzn-RequestId → might be CDN/WAF 500, not application 500
# Check the response body format:
# Cloudflare 500: "Error 500" with Cloudflare branding
# Application 500: {"code":500,"reason":"Internal Server Error"} (application JSON)
```

---

## Response Format for This Finding

**Title:** Unhandled Exception on [Endpoint Name] via Malformed Bearer Token

**Minimum required evidence:**
1. Baseline request + response (well-formed-invalid → 403)
2. Malformed token request + response (→ 500) — at least 2 different malformed variants
3. Repetition proof (same result on 3 attempts each)
4. Note: no authentication bypass was achieved, no data was exposed

**CVSS note:** Score this as MEDIUM (5.x) for pre-auth security endpoints. Key factors:
- `AV:N/AC:L/PR:N/UI:N` (network, no complexity, no auth, no user interaction)
- `S:U` (scope unchanged — not a data breach)
- `C:N/I:N/A:L` (no confidentiality/integrity impact, low availability impact)

---

## Pro Tips

1. **The critical insight** — a 403 and a 500 on the same endpoint with different token shapes is NOT a coincidence. It proves two different code paths exist: one with a handler (→403), one without (→500).
2. **Financial and banking apps are highest value** — OTP generation, PIN reset, and session endpoints at banks are security-critical, making this finding more impactful than on a generic API.
3. **Start with `null` and `aaa.bbb.ccc`** — these are the most reliably triggering variants across all JWT libraries. Test these two first before the full battery.
4. **Custom headers matter** — many banking apps require additional headers (`clientid`, `channelid`, `actionId`) without which the request returns 404. Get these from browser traffic analysis before testing.
5. **Rate limiting asymmetry** — some implementations apply rate limiting to 401/403 paths but NOT to 500 paths (since 500 is "unexpected" and may not hit the rate-limit middleware). This can be noted as an additional risk.
6. **The timing differential is bonus evidence** — if the 500 takes 3x longer than the 403 baseline, mention it in the report. It suggests expensive exception handling (stack trace serialization, full log writes).
7. **This is a robustness finding, not an auth bypass** — frame it as "server does not fail closed for all input shapes" rather than "authentication bypassed." The security argument is correctness under adversarial input.
