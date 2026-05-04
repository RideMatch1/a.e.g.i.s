<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: dorking
description: Google dorking and OSINT search techniques for passive reconnaissance — find exposed panels, leaked credentials, sensitive files, and attack surface using web_search without API keys
---

# Dorking & OSINT Reconnaissance

Dorking = leveraging search engine operators to find exposed systems, sensitive files, credentials, and configuration information without touching the target directly.

**Tool to use**: `web_search` (SearXNG backend — supports full Google dork operators, no API key required)
**Results**: auto-saved to `output/dork_results.txt`

> NOTE: Shodan, Censys, FOFA require API keys not available here. Use Google dork equivalents via `web_search` instead.

---

## Google Dork Operators

    site:target.com                          # Restrict to domain
    inurl:admin site:target.com             # URL contains "admin"
    intitle:"index of" site:target.com      # Page title contains text
    filetype:pdf site:target.com            # File extension filter
    intext:"password" site:target.com       # Body text contains
    ext:env site:target.com                 # File extension (same as filetype)

---

## High-Value Google Dorks

### Exposed Admin Panels

    site:target.com inurl:admin
    site:target.com inurl:login
    site:target.com inurl:dashboard
    site:target.com inurl:"/wp-admin/"           # WordPress admin
    site:target.com inurl:"/administrator/"      # Joomla admin
    site:target.com inurl:"/phpmyadmin/"
    site:target.com inurl:"/manager/html"        # Tomcat manager
    site:target.com inurl:"/jenkins/"
    site:target.com inurl:"/kibana/"
    site:target.com inurl:"/grafana/"

### Sensitive Files

    site:target.com filetype:env
    site:target.com filetype:log
    site:target.com filetype:sql
    site:target.com filetype:bak
    site:target.com filetype:conf
    site:target.com filetype:xml inurl:config
    site:target.com ext:php.bak
    site:target.com ext:old
    site:target.com ext:txt inurl:password

### Exposed Credentials / Secrets

    site:target.com intext:"DB_PASSWORD"
    site:target.com intext:"api_key"
    site:target.com intext:"BEGIN RSA PRIVATE KEY"
    site:target.com intext:"AWS_SECRET_ACCESS_KEY"
    site:target.com filetype:env intext:"SECRET_KEY"

### Directory Listing

    site:target.com intitle:"index of"
    site:target.com intitle:"index of /" inurl:backup
    site:target.com intitle:"index of" intext:".sql"
    site:target.com intitle:"index of" intext:"id_rsa"

### Vulnerable Parameters

    site:target.com inurl:".php?id="              # Potential SQLi
    site:target.com inurl:"?redirect="            # Open redirect
    site:target.com inurl:"?file="                # LFI potential
    site:target.com inurl:"?page="
    site:target.com inurl:"/cgi-bin/"
    site:target.com inurl:"upload.php"

### Git Exposure

    site:target.com inurl:"/.git/config"
    site:target.com intitle:"index of /.git"

### Error Messages

    site:target.com intext:"Warning: mysql_"
    site:target.com intext:"PHP Warning"
    site:target.com intext:"Error in your SQL syntax"
    site:target.com intext:"Traceback (most recent call last)"

---

## GitHub / Code Repository Dorking

Search GitHub for secrets related to target — no API key needed:

    site:github.com "target.com" "api_key"
    site:github.com "target.com" password
    site:github.com "target.com" "DB_PASSWORD"
    site:github.com "target.com" "BEGIN RSA PRIVATE KEY"
    site:github.com "target.com" "SECRET_KEY"
    site:github.com "@target.com" password
    site:github.com org:target-org ".env"

---

## Certificate Transparency (Subdomain Discovery)

Find ALL subdomains including internal/staging via TLS cert logs:

    # Search crt.sh for subdomains:
    web_search("site:crt.sh %.target.com")
    web_search("crt.sh target.com subdomains")

    # Direct URL to browse manually:
    # https://crt.sh/?q=%.target.com

---

## Passive Subdomain Enumeration via Dorking

    site:target.com -www                         # Exclude www, find subdomains
    site:*.target.com                            # Wildcard subdomain search
    web_search("site:dnsdumpster.com target.com")

---

## Pastebin / Paste Sites

    site:pastebin.com target.com
    site:pastebin.com "target.com" password
    site:paste.ee target.com

---

## Using web_search for Dorking

All dorks run via AIRecon's `web_search` tool — no API key needed:

    # Pattern: web_search("<dork query>")

    web_search("site:target.com filetype:env")
    web_search("site:target.com inurl:admin intitle:login")
    web_search("site:target.com intext:\"DB_PASSWORD\"")
    web_search("site:target.com intitle:\"index of\" intext:.sql")
    web_search("site:github.com \"target.com\" api_key")
    web_search("site:crt.sh %.target.com")

    # Results are auto-saved to output/dork_results.txt

---

## Shodan / Censys / FOFA

> These tools require API keys. If the user provides an API key, use it via web_search:
> - `web_search("shodan target.com port:6379")` → redirects to Shodan results page
> - Without API key: use Google dork equivalents above instead

---

## Pro Tips

1. Start with `site:target.com` — discover ALL indexed pages and unexpected subdomains
2. `filetype:env` + `filetype:log` + `filetype:sql` = highest-value dorks for credential exposure
3. `intitle:"index of"` reveals backup files, SQL dumps, key files
4. GitHub dorking finds internal tools and hardcoded secrets deleted from main but still searchable
5. Certificate transparency (`crt.sh`) finds ALL subdomains including internal/staging
6. Run all dorks in sequence — results accumulate in `output/dork_results.txt`

## Summary

Dorking strategy (zero API key required):
1. `site:target.com` → map all indexed pages and subdomains
2. `filetype:env|log|sql|bak` → find sensitive files
3. `inurl:admin|login|api` → identify attack surfaces
4. `intext:"DB_PASSWORD|api_key|SECRET"` → find leaked credentials
5. `site:github.com "target.com"` → GitHub secret search
6. `site:crt.sh %.target.com` → full subdomain list from cert transparency

All results via `web_search()` — auto-saved to `output/dork_results.txt`.
