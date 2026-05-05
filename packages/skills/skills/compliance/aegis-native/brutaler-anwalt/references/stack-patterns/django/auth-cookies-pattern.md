---
license: MIT (snippet)
provider: Django + django-csp (Open-Source)
last-checked: 2026-05-05
purpose: Django Auth-Cookies + django-csp + DSGVO-konforme Session-Konfiguration.
---

# Django — Auth-Cookies + CSP-Pattern

## Trigger / Detection

Repo enthaelt:
- `django.contrib.auth` aktiviert
- `django-csp` Package (`csp.middleware.CSPMiddleware` in MIDDLEWARE)
- `LOGIN_URL`, `LOGIN_REDIRECT_URL` in settings
- Optional: `django-allauth` / `dj-rest-auth` / `django-axes`

## Default-Verhalten (was passiert ohne Konfiguration)

- Default-Login schickt UserExists-Errors → User-Enumeration moeglich
- `SESSION_COOKIE_AGE = 1209600` (2 Wochen Default) → zu lang fuer DSGVO
- Failed-Login-Logging mit Klartext-Username
- CSP-Default ohne nonce → Inline-Scripts unsicher
- `LOGIN_RATE_LIMIT` nicht gesetzt → Brute-Force-Vektor

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Session-Lifetime zu lang | Art. 5 lit. e DSGVO | MITTEL | `SESSION_COOKIE_AGE = 3600` (1h) + Refresh |
| Failed-Login mit Klartext-Username in Logs | Art. 5 lit. f | HOCH | Custom-Logger mit User-Hash |
| User-Enumeration via Login-Form | Art. 32 DSGVO | HOCH | Generic-Error-Message |
| CSP `unsafe-inline` global | Art. 32 DSGVO | KRITISCH | Nonce-basierte CSP |
| Brute-Force ohne Lockout | Art. 32 DSGVO | KRITISCH | `django-axes` Middleware |
| Klartext-Password im Form-Log bei Validation-Fehler | Art. 5 lit. f | KRITISCH | Logging-Filter mit Pattern-Stripping |

## Code-Pattern (sanitized)

```python
# File: settings.py
import os

# Auth + Sessions
SESSION_COOKIE_AGE = 60 * 60  # 1 Stunde
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = True  # Sliding-Expiration

# CSRF
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # JS muss CSRF-Header setzen
CSRF_USE_SESSIONS = False  # Cookie-basiert, kein DB-Roundtrip

# Password
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 12},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Argon2 als Default-Hasher
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

# Brute-Force-Schutz (django-axes)
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 0.5  # 30 Minuten
AXES_LOCK_OUT_AT_FAILURE = True
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_PARAMETERS = ['ip_address', 'username']

# CSP
MIDDLEWARE = [
    # ...
    'csp.middleware.CSPMiddleware',
    'axes.middleware.AxesMiddleware',
]

CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", 'https://<placeholder-eu-analytics-host>')
CSP_CONNECT_SRC = ("'self'", 'https://<placeholder-eu-analytics-host>')
CSP_IMG_SRC = ("'self'", 'data:', 'https://<placeholder-eu-image-cdn>')
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_FONT_SRC = ("'self'", 'https://<placeholder-eu-font-cdn>')
CSP_INCLUDE_NONCE_IN = ['script-src', 'style-src']
CSP_REPORT_URI = '/api/csp-report'

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesBackend',
    'django.contrib.auth.backends.ModelBackend',
]
```

```python
# File: app/views/auth.py
import time
import logging
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache

logger = logging.getLogger('auth')


@require_POST
@csrf_protect
@never_cache
def login(request):
    import json
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest('Invalid JSON')

    username = body.get('username', '').strip()
    password = body.get('password', '')

    if not username or not password:
        return JsonResponse({'error': 'Login-Daten ungueltig'}, status=401)

    # Konstante Zeit (Timing-Attack-Schutz)
    start = time.time()
    user = authenticate(request, username=username, password=password)
    elapsed = time.time() - start
    if elapsed < 0.2:
        time.sleep(0.2 - elapsed)

    if user is None:
        # Generic-Error: kein User-Enumeration
        logger.info('login_failed', extra={'username_hash': _hash_user(username)})
        return JsonResponse({'error': 'Login-Daten ungueltig'}, status=401)

    if not user.is_active:
        return JsonResponse({'error': 'Login-Daten ungueltig'}, status=401)

    django_login(request, user)
    logger.info('login_success', extra={'user_id': user.id})

    return JsonResponse({
        'user': {'id': user.id, 'email': user.email},
        'expires_in': 3600,
    })


@require_POST
@login_required
def logout(request):
    logger.info('logout', extra={'user_id': request.user.id})
    django_logout(request)
    return JsonResponse({}, status=204)


def _hash_user(username: str) -> str:
    import hashlib
    return hashlib.sha256(username.encode()).hexdigest()[:16]
```

```python
# File: app/logging_filters.py
import logging
import re

EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w-]+')
PASSWORD_KEY_RE = re.compile(r'(["\']?password["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE)


class PiiFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, 'msg'):
            msg = str(record.msg)
            msg = EMAIL_RE.sub('[EMAIL_REDACTED]', msg)
            msg = PASSWORD_KEY_RE.sub(r'\1[PASSWORD_REDACTED]\3', msg)
            record.msg = msg
        return True


# Settings.py:
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'pii_filter': {'()': 'app.logging_filters.PiiFilter'},
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'filters': ['pii_filter'],
        },
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
```

```python
# File: app/middleware/recent_auth.py
import time
from django.shortcuts import redirect
from django.urls import reverse


class RequireRecentAuthForSensitive:
    SENSITIVE_PATHS = ['/account/email-change', '/account/password-change', '/account/2fa']
    RECENT_WINDOW = 5 * 60  # 5 Minuten

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.path in self.SENSITIVE_PATHS:
            recent = request.session.get('recent_auth_at', 0)
            if time.time() - recent > self.RECENT_WINDOW:
                request.session['return_to'] = request.path
                return redirect(reverse('confirm-password'))
        return self.get_response(request)
```

## AVV / DPA

- Datenbank (User-Tabelle, axes_accessattempt) — AVV mit IP-Hash-Garantie
- Mailer (Reset-Mails / 2FA) — AVV
- Optional: SSO-Provider (Auth0 EU / Keycloak self-host) — AVV mit TIA bei Drittland

## DSE-Wording-Vorlage

```markdown
### Login-Sicherheit und Session-Verwaltung

Beim Login verarbeiten wir folgende Daten:

- E-Mail / Username (zur Identifizierung)
- Password (gehasht via Argon2, niemals im Klartext)
- Hash der IP-Adresse (Brute-Force-Schutz, max. 5 Fehlversuche binnen 30 Min.)
- Session-Cookie (Lifetime: 1 Stunde, Sliding-Expiration)

**Failed-Login-Schutz (django-axes):**
- 5 fehlgeschlagene Versuche je IP/Username = 30 Minuten Lockout
- Speicherung: Hash der IP + Username, kein Klartext-Password

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag) +
Art. 6 Abs. 1 lit. f DSGVO (Sicherheit).
**Speicherdauer Login-Logs:** 30 Tage, danach Loeschung.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Login mit falschen Credentials = Generic Error
curl -X POST https://<placeholder-domain>/api/login \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <placeholder-csrf>" \
  -d '{"username":"nonexistent","password":"WRONG"}' -i
# Erwartung: 401 mit "Login-Daten ungueltig"

# 2. Brute-Force-Lockout nach 5 Versuchen (django-axes)
for i in {1..6}; do
  curl -X POST https://<placeholder-domain>/api/login \
    -d '{"username":"test","password":"wrong"}' -s -o /dev/null -w "%{http_code}\n"
done
# Erwartung: nach 5 Versuchen: 403 (axes-Lockout)

# 3. Session-Lifetime kurz (1h)
curl -i https://<placeholder-domain>/api/login \
  -d '{"username":"<placeholder>","password":"<placeholder>"}' \
  | grep -i "set-cookie:.*sessionid.*max-age"
# Erwartung: max-age=3600

# 4. CSP-Header korrekt
curl -sI https://<placeholder-domain>/ | grep -i "content-security-policy"
# Erwartung: default-src 'self'; script-src 'self' https://<placeholder-eu-analytics-host>; ...

# 5. Logs ohne PII
tail -100 /var/log/django.log | grep -E '[\w.+-]+@[\w-]+\.[\w-]+' | head -5
# Erwartung: 0 Treffer oder ausschliesslich [EMAIL_REDACTED]
```

## Cross-References

- AEGIS-Scanner: `auth-flow-checker.ts`, `csp-config-checker.ts`, `bcrypt-argon-checker.ts`, `rate-limit-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 32 (Sicherheit)
- BSI-Grundschutz: ORP.4 Identitaets- und Berechtigungsmanagement
- Audit-Pattern: `references/audit-patterns.md` Phase 7 (Security-Headers), Phase 9 (Auth-Audit)
