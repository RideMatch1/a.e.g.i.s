<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Wapiti & Nikto — Web Vulnerability Scanning

## When to Use Wapiti vs Nikto vs Nuclei

| Tool    | Best for | Output |
|---------|----------|--------|
| **wapiti** | Full crawl + automated vuln testing in one pass. Auth support (form login, cookies, headers, Selenium). 30+ vuln modules. | json, html, csv, xml, md, txt |
| **nikto** | Quick fingerprinting: server misconfigs, dangerous files, outdated software. Very fast, no crawling. | plain text, xml, csv, html |
| **nuclei** | Template-based CVE matching, passive detection, large community template coverage. | json per-finding |

**Use wapiti when**: target has dynamic content, login forms, or you need comprehensive automated testing with structured JSON output.

**Use nikto when**: you need a fast 60-second baseline — server headers, default files, CGI vulnerabilities.

**Do NOT replace nuclei with wapiti** — they're complementary. Wapiti = crawl-based detection, nuclei = CVE template matching.

---

## Wapiti: Module Reference

Run `wapiti --list-modules` in the container to see all modules.

**Default modules** (run without `-m` flag):
`exec`, `file`, `permanentxss`, `redirect`, `sql`, `ssl`, `ssrf`, `upload`, `xss`

**Full module list:**

| Module | Detects |
|--------|---------|
| `backup` | Backup files (.bak, .old, ~, .orig, etc.) |
| `brute_login_form` | Weak credentials on login forms (admin/admin, etc.) |
| `buster` | Brute-force hidden files and directories |
| `crlf` | CRLF injection vulnerabilities |
| `csrf` | Forms missing CSRF protection |
| `exec` | Command/code execution (RCE) — **default** |
| `file` | LFI, path traversal, include() — **default** |
| `htaccess` | Bypass access controls via custom HTTP methods |
| `htp` | Technology fingerprinting via HashThePlanet database |
| `ldap` | LDAP injection |
| `log4shell` | CVE-2021-44228 (Log4Shell) |
| `methods` | Dangerous HTTP methods (PUT, DELETE, TRACE) |
| `network_device` | Exposed network device admin panels |
| `nikto` | Nikto-style brute-force for known dangerous scripts |
| `permanentxss` | Stored XSS — **default** |
| `redirect` | Open redirect — **default** |
| `shellshock` | CVE-2014-6271 (Shellshock) |
| `spring4shell` | CVE-2022-22965 (Spring4Shell) |
| `sql` | Error-based + boolean blind SQLi — **default** |
| `ssl` | SSL/TLS certificate misconfiguration — **default** |
| `ssrf` | Server-Side Request Forgery — **default** |
| `takeover` | Subdomain takeover via dangling CNAME |
| `timesql` | Time-based blind SQL injection |
| `upload` | Unrestricted file upload — **default** |
| `wapp` | Technology fingerprinting via Wappalyzer |
| `wp_enum` | WordPress plugin enumeration with versions |
| `xss` | Reflected XSS — **default** |
| `xxe` | XML External Entity injection |

---

## Wapiti: Key Commands

### Basic scan (default modules only — fastest)
```bash
wapiti -u https://target.com -f json -o output/wapiti_default.json
```

### All high-value modules (comprehensive)
```bash
wapiti -u https://target.com \
  -m xss,permanentxss,sql,timesql,exec,file,ssrf,xxe,upload,redirect,crlf,backup,log4shell,spring4shell,shellshock,methods,csrf,brute_login_form \
  --scope domain \
  -f json -o output/wapiti_full.json \
  --max-scan-time 600 --max-attack-time 120
```

### Targeted scan — injection focus
```bash
wapiti -u https://target.com \
  -m xss,sql,timesql,exec,file,ssrf,xxe,crlf \
  --scope folder \
  -d 3 --max-links-per-page 50 \
  -f json -o output/wapiti_injections.json \
  --max-scan-time 300
```

### Authenticated — cookie-based
```bash
wapiti -u https://app.target.com/dashboard \
  -C "session=abc123; auth_token=xyz" \
  -m xss,sql,timesql,exec,file,upload,csrf \
  --scope folder \
  -f json -o output/wapiti_auth.json \
  --max-scan-time 300
```

### Authenticated — form login (wapiti handles login automatically)
```bash
wapiti -u https://target.com \
  --form-url https://target.com/login \
  --form-user admin --form-password password123 \
  -m xss,sql,exec,upload,csrf \
  --scope folder \
  -f json -o output/wapiti_form_auth.json
```

### Authenticated — API with JWT / custom headers
```bash
wapiti -u https://api.target.com/v1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -m sql,timesql,xss,ssrf,xxe \
  --scope domain \
  -f json -o output/wapiti_api.json \
  --max-scan-time 300
```

### API scan via Swagger/OpenAPI spec
```bash
wapiti -u https://api.target.com \
  --swagger https://api.target.com/openapi.json \
  -m sql,xss,ssrf,xxe,exec \
  -f json -o output/wapiti_swagger.json
```

### WordPress scan
```bash
wapiti -u https://target.com \
  --cms wp \
  -m wp_enum,xss,sql,backup,brute_login_form \
  --scope domain \
  -f json -o output/wapiti_wp.json
```

### CMS detection + scan
```bash
# --cms options: drupal, joomla, prestashop, spip, wp
wapiti -u https://target.com --cms drupal,joomla,wp \
  -f json -o output/wapiti_cms.json
```

---

## IMPORTANT: Always Set Time Limits

**Without time limits, wapiti can run for hours and kill the Docker container.**

Always use:
- `--max-scan-time <seconds>` — total scan time limit
- `--max-attack-time <seconds>` — per-module time limit

```bash
# Safe defaults for recon sessions
--max-scan-time 600    # 10 minutes total
--max-attack-time 120  # 2 minutes per module
```

---

## Parsing JSON Results

```bash
# Count findings by type
cat output/wapiti_full.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
vulns = data.get('vulnerabilities', {})
for vtype, findings in sorted(vulns.items()):
    if findings:
        print(f'[{len(findings):2}] {vtype}')
anomalies = data.get('anomalies', {})
for atype, findings in sorted(anomalies.items()):
    if findings:
        print(f'[{len(findings):2}] ANOMALY: {atype}')
"

# Extract all vulnerability details
cat output/wapiti_full.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for vtype, findings in data.get('vulnerabilities', {}).items():
    for f in findings:
        print(f'[{vtype}]')
        print(f'  URL:       {f.get(\"path\",\"\")}')
        print(f'  Method:    {f.get(\"method\",\"\")}')
        print(f'  Parameter: {f.get(\"parameter\",\"\")}')
        print(f'  Info:      {f.get(\"info\",\"\")[:120]}')
        print()
"

# Get Internal Server Errors (high-value for manual testing)
cat output/wapiti_full.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
errs = data.get('anomalies', {}).get('Internal Server Error', [])
print(f'{len(errs)} Internal Server Errors found:')
for e in errs:
    print(f'  {e.get(\"method\",\"GET\")} {e.get(\"path\",\"\")} param={e.get(\"parameter\",\"\")}')
"

# Extract SQLi findings → feed to sqlmap
cat output/wapiti_full.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data.get('vulnerabilities', {}).get('SQL Injection', []):
    print(f'{f.get(\"method\",\"GET\")} {f.get(\"path\",\"\")} -p {f.get(\"parameter\",\"\")}')
"
```

---

## Nikto: Key Commands

```bash
# Basic scan — save output
nikto -h https://target.com -o output/nikto.txt

# XML output for parsing
nikto -h https://target.com -Format xml -output output/nikto.xml

# Quick 60-second check with tuning
# Tuning: 1=interesting, 2=misconfig, 3=info disclosure, 4=injection, 8=XSS, 9=SQL
nikto -h https://target.com -Tuning 1,2,3,4 -maxtime 60 -o output/nikto_quick.txt

# With basic auth
nikto -h https://target.com --auth-user admin --auth-password admin123 -o output/nikto_auth.txt
```

### Parse nikto output
```bash
grep "^+" output/nikto.txt | grep -v "^+ Target\|^+ Server\|^+ Start\|^+ End\|^+ [0-9]" | head -50
```

---

## Integration Workflow

```bash
# Step 1 — Nikto quick fingerprint (60 seconds)
nikto -h https://target.com -Tuning 1,2,3 -maxtime 60 -o output/nikto.txt
grep "^+" output/nikto.txt | grep -v "^+ Target\|^+ Start\|^+ End"

# Step 2 — Wapiti crawl + vuln scan
wapiti -u https://target.com \
  -m xss,sql,timesql,exec,file,ssrf,upload,backup,crlf,redirect,log4shell \
  --scope domain \
  -f json -o output/wapiti_full.json \
  --max-scan-time 600 --max-attack-time 120

# Step 3 — Parse + escalate
# SQLi found → confirm with sqlmap (read sqlmap skill first)
# XSS found → confirm with dalfox (read dalfox skill first)
# Upload found → manual test for webshell
# Backup files → read the backup files for credentials/source code
```

---

## When Wapiti Finds Nothing

```bash
# 1. Try authenticated scan (app may require login)
wapiti -u https://target.com --form-url https://target.com/login \
  --form-user admin --form-password admin ...

# 2. Add timesql for blind SQLi (not in defaults)
wapiti -u https://target.com -m sql,timesql,xss ...

# 3. Add buster for hidden paths
wapiti -u https://target.com -m buster,backup,nikto ...

# 4. Use nuclei for CVE-specific checks (different coverage)
# (read nuclei skill first)

# 5. Use dalfox for dedicated XSS (better DOM mining than wapiti)
# (read dalfox skill first)

# 6. Use nikto specifically for server misconfigs
nikto -h https://target.com -Tuning 1,2,3 ...
```

---

## Common Mistakes to Avoid

1. **No time limit** — always set `--max-scan-time` to prevent container crash from runaway scan
2. **No scope** — default scope is `folder`; use `--scope domain` for full domain coverage
3. **Missing `-f json`** — default output is HTML; always use `-f json` for parseable results
4. **Treating wapiti SQLi as confirmed** — wapiti uses heuristics; confirm with sqlmap before reporting
5. **Not checking anomalies** — `Internal Server Error` entries are high-value leads for manual testing
6. **Running without `--max-links-per-page`** — on large apps, wapiti may crawl thousands of URLs; limit with `--max-links-per-page 100`
