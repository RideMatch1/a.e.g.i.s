---
license: MIT (snippet)
provider: Django (Open-Source)
last-checked: 2026-05-05
purpose: Django Middleware Pattern fuer Consent-Cookie-Read + Conditional Tracker-Render.
---

# Django — Cookie-Banner Middleware Pattern

## Trigger / Detection

Repo enthaelt:
- `django` in `requirements.txt` / `pyproject.toml`
- `settings.py` mit `MIDDLEWARE` Liste
- `urls.py` URL-Routing
- Optional: `django-cookie-consent` Package

## Default-Verhalten (was passiert ohne Konfiguration)

- Django-Default-Session-Cookies ohne `SESSION_COOKIE_SECURE = True` in DEBUG
- `csrftoken` Cookie ohne `SameSite=Lax`-Hinweis
- Tracker-Tags hardcoded in `base.html` Template
- `CSRF_COOKIE_HTTPONLY = False` Default → JS kann CSRF-Token lesen (notwendig)
- Default-Logger schreibt Klartext-IP via `request.META['REMOTE_ADDR']`

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker-Tag in `base.html` | § 25 TDDDG | KRITISCH | `{% if request.consent.analytics %}` Conditional |
| `SESSION_COOKIE_SECURE = False` | Art. 32 DSGVO | KRITISCH | True in production settings |
| `SESSION_COOKIE_SAMESITE` ungesetzt | Art. 32 DSGVO | HOCH | `'Lax'` setzen |
| Klartext-IP in Logs | Art. 5 lit. f | HOCH | Custom Logging-Filter |
| Drittland-Tracker via CDN | Art. 44 DSGVO | KRITISCH | EU-Provider + AVV |

## Code-Pattern (sanitized)

```python
# File: app/middleware/consent.py
import json
from typing import Callable
from django.http import HttpRequest, HttpResponse


DEFAULT_CONSENT = {
    'necessary': True,
    'analytics': False,
    'marketing': False,
    'version': '1.0',
}


class ConsentMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        raw = request.COOKIES.get('cookie_consent')
        consent = dict(DEFAULT_CONSENT)

        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    consent.update({k: v for k, v in parsed.items() if k in DEFAULT_CONSENT})
            except (json.JSONDecodeError, ValueError):
                pass

        request.consent = consent
        return self.get_response(request)
```

```python
# File: app/views/consent.py
import hashlib
import json
from datetime import datetime, timezone, timedelta

from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect

from app.models import ConsentLog


@require_POST
@csrf_protect
def store_consent(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest('Invalid JSON')

    if not isinstance(body.get('analytics'), bool) or not isinstance(body.get('marketing'), bool):
        return HttpResponseBadRequest('Invalid payload')

    consent = {
        'necessary': True,
        'analytics': body['analytics'],
        'marketing': body['marketing'],
        'version': '1.0',
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }

    # Server-Log
    ip = (request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
    salt = getattr(settings, 'IP_HASH_SALT', '')
    ip_hash = hashlib.sha256(f'{ip}{salt}'.encode()).hexdigest()[:16]

    ConsentLog.objects.create(
        ip_hash=ip_hash,
        user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:200],
        consent=consent,
    )

    response = JsonResponse({}, status=204)
    response.set_cookie(
        'cookie_consent',
        json.dumps(consent),
        max_age=int(timedelta(days=365).total_seconds()),
        secure=not settings.DEBUG,
        httponly=False,  # Banner-JS muss lesen
        samesite='Lax',
        path='/',
    )
    return response
```

```python
# File: app/models/consent_log.py
from django.db import models


class ConsentLog(models.Model):
    ip_hash = models.CharField(max_length=16)
    user_agent = models.CharField(max_length=200)
    consent = models.JSONField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['timestamp'])]

    def __str__(self) -> str:
        return f'ConsentLog #{self.pk} @ {self.timestamp.isoformat()}'
```

```python
# File: settings.py (Auszug)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'app.middleware.consent.ConsentMiddleware',
    # ...
]

# Cookie-Security
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = 'Lax'

# HSTS (nur in production)
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Salt fuer IP-Hash
IP_HASH_SALT = os.environ['IP_HASH_SALT']
```

```python
# File: urls.py
from django.urls import path
from app.views.consent import store_consent

urlpatterns = [
    path('api/consent-log', store_consent, name='consent-store'),
    # ...
]
```

```html
<!-- File: templates/cookies/banner.html -->
{% if not request.COOKIES.cookie_consent %}
<aside id="cookie-banner" role="dialog" aria-label="Cookie-Einwilligung" class="cookie-banner">
    <p>
        Wir nutzen Cookies fuer notwendige Funktionen. Mit Ihrer Einwilligung
        zusaetzlich fuer Webanalyse. Details:
        <a href="{% url 'legal-privacy' %}">Datenschutzerklaerung</a>.
    </p>
    <div class="cookie-actions">
        <button type="button" data-action="reject-all" class="btn-secondary">Nur Notwendige</button>
        <button type="button" data-action="accept-all" class="btn-primary">Alle akzeptieren</button>
    </div>
</aside>

<script>
(() => {
    const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value
        || document.cookie.match(/csrftoken=([^;]+)/)?.[1];

    const submit = (analytics, marketing) => {
        fetch('{% url "consent-store" %}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf,
            },
            body: JSON.stringify({ analytics, marketing }),
        }).then(() => {
            document.getElementById('cookie-banner').remove();
            if (analytics) {
                const s = document.createElement('script');
                s.src = 'https://<placeholder-eu-analytics-host>/script.js';
                s.async = true;
                document.head.appendChild(s);
            }
        });
    };

    document.querySelector('[data-action="reject-all"]').onclick = () => submit(false, false);
    document.querySelector('[data-action="accept-all"]').onclick = () => submit(true, true);
})();
</script>
{% endif %}
```

```html
<!-- File: templates/base.html -->
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>{% block title %}<placeholder-site-name>{% endblock %}</title>
    {% csrf_token %}
    {# Tracker NUR conditional #}
    {% if request.consent.analytics %}
        <script src="https://<placeholder-eu-analytics-host>/script.js" async></script>
    {% endif %}
</head>
<body>
    {% block content %}{% endblock %}
    {% include 'cookies/banner.html' %}
</body>
</html>
```

## AVV / DPA

- Hosting-Provider (Heroku EU / Render / Fly.io) — Art. 28 DSGVO
- Datenbank (Postgres) — AVV mit EU-Region
- Analytics-Provider (Plausible EU / Matomo) — AVV
- Mailer (SendGrid EU / Postmark / Mailjet) — AVV

## DSE-Wording-Vorlage

```markdown
### Cookies (Django-Anwendung)

Diese Webseite verwendet folgende Cookies:

**Notwendige Cookies (kein Opt-Out):**
- `sessionid` — Session-Verwaltung, Session-Dauer
- `csrftoken` — CSRF-Schutz, 12 Monate
- `cookie_consent` — Speicherung Ihrer Einwilligung, 12 Monate

**Analyse-Cookies (Opt-In):**
- gesetzt durch <placeholder-analytics-provider>
- Speicherdauer: <placeholder-days> Tage
- EU-Hosting: <placeholder-eu-country>

**Rechtsgrundlage:** § 25 TDDDG i.V.m. Art. 6 Abs. 1 lit. a DSGVO.
**Widerruf:** [Cookie-Einstellungen](#cookie-settings) im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Banner sichtbar fuer neue Visitors
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner"

# 2. Cookie-Security-Flags
curl -sI https://<placeholder-domain>/ | grep -iE "set-cookie:.*sessionid"
# Erwartung: HttpOnly; Secure; SameSite=Lax

# 3. HSTS aktiv
curl -sI https://<placeholder-domain>/ | grep -i "strict-transport-security"
# Erwartung: max-age=31536000; includeSubDomains; preload

# 4. Tracker-Conditional Rendering
curl -sS -H 'Cookie: cookie_consent=%7B%22analytics%22%3Afalse%7D' https://<placeholder-domain>/ \
  | grep -ic "<placeholder-eu-analytics-host>"
# Erwartung: 0

curl -sS -H 'Cookie: cookie_consent=%7B%22analytics%22%3Atrue%7D' https://<placeholder-domain>/ \
  | grep -ic "<placeholder-eu-analytics-host>"
# Erwartung: >=1

# 5. CSRF-Schutz erzwungen
curl -X POST https://<placeholder-domain>/api/consent-log \
  -H "Content-Type: application/json" -d '{"analytics":false,"marketing":false}' -i
# Erwartung: 403 Forbidden (CSRF token missing)
```

## Cross-References

- AEGIS-Scanner: `cookie-flags-checker.ts`, `csrf-config-checker.ts`, `consent-flow-checker.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- OLG Koeln 6 U 80/23 (Button-Gleichwertigkeit)
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
