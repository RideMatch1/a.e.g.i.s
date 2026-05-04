<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Authentication Workflow — Complete Tool Reference

## Quick Reference: Available Auth Actions

| Action | Purpose | Required params |
|--------|---------|-----------------|
| `login_form` | Fill + submit login form | `url`, `username`, `password` |
| `handle_totp` | Generate + submit TOTP code | `totp_secret` |
| `save_auth_state` | Capture cookies + localStorage + sessionStorage | — |
| `inject_cookies` | Restore a saved session | `cookies` (array) |
| `oauth_authorize` | Complete OAuth/SSO flow | `url` |
| `check_auth_status` | Verify if currently logged in | — |
| `wait_for_element` | Wait for a CSS selector to appear | `wait_selector` |
| `request_user_input` | Ask user for CAPTCHA/TOTP/OTP/password | `prompt`, `input_type` |

---

## Decision Tree

```
Need to authenticate?
│
├─ Have username + password?
│   └─ Standard site (all fields visible at once)?
│       ├─ YES → browser_action(action="login_form", url=..., username=..., password=...)
│       └─ NO (Google/GitHub/Microsoft username-first flow)?
│           └─ browser_action(action="login_form", ..., multi_step=true)
│
│   Check response:
│   ├─ login_success=true  → save_auth_state → continue testing
│   ├─ captcha_detected=true
│   │   → captcha_screenshot already saved (see captcha_screenshot in response)
│   │   → request_user_input(input_type="captcha", prompt="Solve CAPTCHA in <path>")
│   │   → type solution → press_key("Enter") → save_auth_state
│   ├─ mfa_required=true   → see TOTP section below
│   └─ login_error="..."   → wrong credentials
│
├─ MFA / TOTP required?
│   ├─ Have TOTP secret (base32)?
│   │   └─ browser_action(action="handle_totp", totp_secret="BASE32SECRET")
│   │      └─ 8-digit code? → add totp_digits=8
│   │      └─ 60s period?   → add totp_period=60
│   │      Check: totp_success=true → save_auth_state
│   │      If totp_success=false → call handle_totp again (code expired, new 30s window)
│   │
│   └─ No secret (user has authenticator app / SMS)?
│       └─ request_user_input(input_type="totp", prompt="Enter 6-digit code for target.com",
│                             timeout_seconds=90)
│          → after user submits: browser_action(action="type", text=<code>)
│          → browser_action(action="press_key", key="Enter")
│          → wait_for_element(wait_selector="div.dashboard", wait_timeout=5)
│          → check_auth_status → save_auth_state
│
├─ CAPTCHA blocking?
│   (Usually auto-detected by login_form — captcha_screenshot auto-taken)
│   └─ request_user_input(input_type="captcha",
│                          prompt="Solve CAPTCHA in /workspace/screenshots/screenshot_XYZ.png")
│      → browser_action(action="type", text=<solution>)
│      → browser_action(action="press_key", key="Enter")
│
├─ Restore a previous session?
│   └─ browser_action(action="inject_cookies", cookies=[{name, value, domain, path}, ...])
│      → browser_action(action="goto", url="https://target.com/dashboard")
│      → check_auth_status to verify
│
├─ OAuth / SSO?
│   └─ browser_action(action="oauth_authorize",
│                      url="https://github.com/login/oauth/authorize?...",
│                      callback_prefix="https://target.com/callback")
│      Check: oauth_token or oauth_callback_url in response
│
└─ Verify if authenticated?
    └─ browser_action(action="check_auth_status")
       Check: is_authenticated (bool), confidence (0-1), username_display
```

---

## Complete Step-by-Step Examples

### Example 1: Standard login (single-step)
```json
{"action": "login_form", "url": "https://target.com/login",
 "username": "admin@target.com", "password": "pass123"}
```
Response: `{login_success: true, auth_cookies: [...], next_action: "Login succeeded. Call save_auth_state."}`
```json
{"action": "save_auth_state"}
```

### Example 2: Username-first (Google/GitHub/Microsoft style)
```json
{"action": "login_form", "url": "https://accounts.google.com",
 "username": "user@gmail.com", "password": "pass123", "multi_step": true}
```

### Example 3: Login + TOTP (you have the secret)
```json
{"action": "login_form", "url": "https://target.com/login",
 "username": "admin", "password": "pass"}
```
Response: `{mfa_required: true, next_action: "MFA/2FA field detected..."}`
```json
{"action": "handle_totp", "totp_secret": "JBSWY3DPEHPK3PXP"}
```
Response: `{totp_success: true, next_action: "TOTP verified. Call save_auth_state."}`
```json
{"action": "save_auth_state"}
```

### Example 4: Login + TOTP (user has authenticator app)
```json
{"action": "login_form", "url": "https://target.com/login",
 "username": "admin", "password": "pass"}
```
Response: `{mfa_required: true}`

Call `request_user_input`:
```json
{"name": "request_user_input",
 "prompt": "MFA required for target.com. Enter 6-digit code from your authenticator app.",
 "input_type": "totp", "timeout_seconds": 90}
```
User enters code → value returned:
```json
{"action": "type", "text": "123456"}
```
```json
{"action": "press_key", "key": "Enter"}
```
```json
{"action": "wait_for_element", "wait_selector": ".dashboard,.home-page", "wait_timeout": 8}
```
```json
{"action": "check_auth_status"}
```

### Example 5: CAPTCHA handling (auto-screenshot)
```json
{"action": "login_form", "url": "https://target.com/login",
 "username": "admin", "password": "pass"}
```
Response: `{captcha_detected: true, captcha_type: "recaptcha", captcha_screenshot: "/workspace/screenshots/screenshot_20241201_120000.png"}`

```json
{"name": "request_user_input",
 "prompt": "CAPTCHA detected. Screenshot saved at /workspace/screenshots/screenshot_20241201_120000.png. Type the CAPTCHA text you see.",
 "input_type": "captcha", "timeout_seconds": 300}
```
User solves it → value returned:
```json
{"action": "type", "text": "abc123"}
```
```json
{"action": "press_key", "key": "Enter"}
```

### Example 6: 8-digit TOTP (enterprise apps)
```json
{"action": "handle_totp", "totp_secret": "BASE32SECRET", "totp_digits": 8}
```

### Example 7: 60-second TOTP window (non-standard)
```json
{"action": "handle_totp", "totp_secret": "BASE32SECRET", "totp_period": 60}
```

### Example 8: Session restoration
```json
{"action": "inject_cookies",
 "cookies": [{"name": "session_id", "value": "abc123", "domain": "target.com", "path": "/"}]}
```
```json
{"action": "goto", "url": "https://target.com/dashboard"}
```
```json
{"action": "check_auth_status"}
```

---

## Response Field Reference

### login_form response
| Field | Type | Meaning |
|-------|------|---------|
| `login_success` | bool | True = authenticated |
| `captcha_detected` | bool | CAPTCHA is blocking the form |
| `captcha_type` | str | `recaptcha`, `hcaptcha`, `cloudflare_turnstile`, `unknown` |
| `captcha_screenshot` | str | **Auto-taken screenshot path** (no need to call screenshot separately) |
| `mfa_required` | bool | 2FA/TOTP field appeared |
| `login_error` | str | Error message from page |
| `url_changed` | bool | Redirect happened after submit |
| `auth_cookies` | list | Session cookies captured |
| `next_action` | str | **Always read this** — tells you what to do next |

### handle_totp response
| Field | Type | Meaning |
|-------|------|---------|
| `totp_success` | bool | Code accepted |
| `totp_error` | str | Error message if rejected |
| `totp_code_used` | str | The 6-digit code submitted |
| `auth_cookies` | list | Session cookies after TOTP |
| `next_action` | str | What to do next |

### check_auth_status response
| Field | Type | Meaning |
|-------|------|---------|
| `is_authenticated` | bool | True = logged in |
| `confidence` | float | 0.0–1.0 confidence score |
| `score` | int | Raw auth signal score |
| `has_logout` | bool | Logout link found |
| `has_profile` | bool | User menu/avatar found |
| `has_login_form` | bool | Login form still visible |
| `username_display` | str | Detected username (if any) |

---

## Custom Selectors (when defaults fail)

First inspect the page:
```json
{"action": "view_source"}
```
Then pass explicit selectors:
```json
{
  "action": "login_form",
  "url": "https://target.com/login",
  "username": "admin",
  "password": "pass",
  "username_selector": "input#email-address",
  "password_selector": "input.pwd-field",
  "submit_selector": "button.login-btn"
}
```

---

## Common Mistakes

1. **CAPTCHA screenshot is auto-taken** — `captcha_screenshot` field has the path. Do NOT call `screenshot` again separately before `request_user_input`.

2. **TOTP expires every 30 seconds** — if `totp_success=false`, call `handle_totp` again immediately (new code generated automatically).

3. **Multi-step vs single-step** — if username fills but password field never appears, try `multi_step=true`. Google/Microsoft/GitHub all use username-first flows.

4. **Always `save_auth_state` after success** — cookies alone aren't enough; `localStorage`/`sessionStorage` may hold auth tokens (JWT, access tokens).

5. **`check_auth_status` after every login** — don't assume success from URL alone. Some apps redirect to login page with error message (same URL, different content).
