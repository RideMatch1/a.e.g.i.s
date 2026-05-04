<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Tool Catalog — AIRecon Kali Linux Sandbox

All tools are pre-installed in the Kali Linux Docker container.
Before first use of any CLI tool, verify it: which <tool> && <tool> --help

---

## Git-Cloned Tools Location

    /home/pentester/tools/
    Run: ls /home/pentester/tools/   to see all available tools.
    Python tools:  python3 /home/pentester/tools/<toolname>/<script.py> [args]
    Bash tools:    bash /home/pentester/tools/<toolname>/<script.sh> [args]

---

## Self-Install Capability (Full Authorization)

You run as pentester with FULL sudo access and internet access.
If a tool is NOT installed, install it immediately. Do NOT skip the task.

    sudo apt-get install -y <tool>
    pip3 install <package> --break-system-packages
    pipx install <package> --break-system-packages
    go install github.com/<repo>@latest
    npm install -g <package>
    git clone https://github.com/<repo>.git /home/pentester/tools/<name>
    wget <url> -O /tmp/tool && chmod +x /tmp/tool && sudo mv /tmp/tool /usr/local/bin/

---

## Subdomain Discovery

    subfinder, amass (v3.23.3), assetfinder, dnsx, shuffledns, massdns, sublist3r, hakip2host, cut-cdn
    dnstake, dsieve, VhostFinder

## DNS & IP Intelligence

    dnsx, tlsx, dig, nslookup, whois, dnsrecon, dnsenum, nrich, notify (Slack/Discord alerts)
    hakoriginfinder

## Port Scanning

    naabu, masscan (IP-only — resolve domain first!), netcat
    MASSCAN NOTE: Accepts IP addresses ONLY. Always resolve domains with dig or python before passing.

    nmap / naabu — REQUIRES reading nmap skill first. Has mandatory pre-conditions.
                   Load with: read_file on the nmap skill before any nmap/naabu usage.
                   The "vuln" NSE script category is FORBIDDEN at all times.

## Web Crawling & URL Discovery

    katana, gospider, gau, waybackurls, meg, httprobe, httpx, waymore, dirsearch, feroxbuster
    subjs, urlfinder, xnLinkFinder, cariddi, kr

## Technology Fingerprinting

    whatweb, httpx (-tech-detect flag), tlsx, wafw00f, nikto, wapiti, fingerprintx
    wappalyzer (npm):   wappalyzer https://target.com
    retire (npm):       retire --js --jspath output/js_files/
    eslint, jshint, js-beautify (deobfuscate + lint JS)

## CMS & Platform Scanners

    wpscan:    wpscan --url https://target.com --enumerate p,u,t
    joomscan:  joomscan -u https://target.com
    CMSeeK:    python3 /home/pentester/tools/CMSeeK/cmseek.py -u https://target.com

## JavaScript Analysis

    jsleak, jsluice, gf, trufflehog
    /home/pentester/tools/JS-Snooper/js_snooper.sh
    /home/pentester/tools/jsniper.sh/jsniper.sh
    /home/pentester/tools/LinkFinder/linkfinder.py
    /home/pentester/tools/LinksDumper/LinksDumper.py
    /home/pentester/tools/jsfinder/jsfinder.py
    /home/pentester/tools/JS-Scan/

## Parameter, Fuzzing & Directory Brute-Force

    ffuf, feroxbuster, x8, headi, arjun, dalfox (XSS), dirsearch
    qsreplace, cewler

## Browser & Agentic Tools

    browser_action — headless Chromium (goto, click, type_text, scroll, execute_js, view_source, get_console_logs)
    web_search     — DuckDuckGo search for payloads, CVEs, techniques
    param-miner    — discover hidden HTTP parameters

## Password Attacks & Brute-Force

    hydra          — multi-protocol login brute-force (SSH, FTP, HTTP, SMB)
    medusa         — fast parallel login brute-force
    hashcat        — GPU hash cracking
    john           — John the Ripper
    Wordlists: /usr/share/seclists/Passwords/  |  /usr/share/wordlists/rockyou.txt

## CVE & Vulnerability Intelligence

    cvemap / vulnx:   cvemap -q nginx  OR  cvemap -cve CVE-2024-xxxx
    searchsploit:     searchsploit apache 2.4

## JWT & Auth Testing

    python3 /home/pentester/tools/jwt_tool/jwt_tool.py — full JWT attack suite (alg:none, weak secret, RS256->HS256)
    jwt-cracker (npm)

## GraphQL Testing

    inql (pipx), gqlspection (pipx)
    python3 /home/pentester/tools/GraphQLmap/graphqlmap.py

## Mobile App Security (Android/iOS)

    Android static: apktool, jadx, apksigner, apkleaks, apkid
    Android dynamic: adb, frida-tools, objection (requires emulator/device runtime)
    iOS static (headless): unzip, strings, plist parsing, radare2
    iOS dynamic: requires external environment; not fully supported inside Docker-only engine

## CORS Testing

    python3 /home/pentester/tools/Corsy/corsy.py

## SSL/TLS & Crypto

    testssl.sh — comprehensive TLS audit (heartbleed, BEAST, POODLE, weak ciphers)

## Git Exposure & Secrets

    git-dumper (pipx), gitleaks, trufflehog, git-secrets
    porch-pirate (pipx)
    /home/pentester/tools/GitHunter/

## PostMessage & DOM XSS

    /home/pentester/tools/postMessage-tracker/
    /home/pentester/tools/PostMessage_Fuzz_Tool/

## Cloud & S3 Recon

    s3scanner (pipx), festin (pipx — hidden S3 via DNS and SSL), shodan CLI

## SAST & Code or js file Analysis

    bandit, eslint, jshint, trivy

    semgrep — REQUIRES reading semgrep skill first. Has mandatory pre-conditions.
              Source code or JS files must exist on disk before semgrep is useful.
              Load with: read_file on the semgrep skill before any semgrep usage.

## Vulnerability Scanning

    dalfox, csprecon, nosqli, toxicache, semgrep, trivy, crlfuzz, misconfig-mapper

    wapiti / nikto — REQUIRES reading wapiti skill first.
                     wapiti: crawl-based scanner, 30+ modules, JSON output.
                             Best for: XSS, SQLi, LFI, SSRF, RCE, backup files, misconfigs.
                             JSON output: wapiti -u <target> -f json -o output/wapiti.json
                     nikto: fast misconfig fingerprinting, no crawling, 60-second baseline.
                             Best for: server headers, dangerous files, outdated software.
                     Load with: read_file on the wapiti skill before any wapiti/nikto usage.

    nuclei  — REQUIRES reading nuclei skill first. Has mandatory pre-conditions.
              Load with: read_file on the nuclei skill before any nuclei usage.

    sqlmap / ghauri — REQUIRES reading sqlmap skill first. Has mandatory pre-conditions.
                      Load with: read_file on the sqlmap skill before any sqlmap/ghauri usage.

## Secret & Leak Detection

    gitleaks, trufflehog, bandit, semgrep, git-secrets
    gf with patterns from /home/pentester/.gf/
      (secrets, sqli, xss, ssrf, redirect, rce, lfi, idor, debug-pages, cors, upload-fields, interestingparams)

## Exploitation & Payloads

    dalfox, nosqli, headi, interactsh-client (OOB/blind callback listener), caido-cli
    interlace, xnldorker

    sqlmap / ghauri — See sqlmap skill. Mandatory pre-conditions apply.

## Proxy & Traffic Interception

    caido-setup (auto-boot Caido on port 48080), zaproxy
    nomore403, SwaggerSpy, Spoofy, msftrecon

## Wordlists & Payloads

    /usr/share/seclists/           — full SecLists (Discovery, Fuzzing, Payloads, Passwords, Usernames)
    /home/pentester/wordlists/fuzzdb/  — FuzzDB structured attack payloads
    /usr/share/wordlists/          — rockyou and others
    /usr/share/nmap/scripts/       — NSE scripts

## Scripting (Always Available — Use Aggressively)

    python3, bash, curl, wget, jq, ripgrep, parallel, tmux

## Phase Tool Sequences

Specific tool commands for each phase of the Full Recon SOP.
The SOP references these by section name (e.g., "see tool_catalog.md → Phase 1 Tools → Live Host Detection").
Adapt every command to the actual target — these are patterns, not copy-paste templates.

---

### URL Filtering

    # Classify all collected URLs by vulnerability class using gf patterns
    # gf patterns are stored in /home/pentester/.gf/
    cat output/urls_all_deduped.txt output/historical_urls.txt | sort -u \
      | gf xss      > output/candidates_xss.txt
    cat output/urls_all_deduped.txt output/historical_urls.txt | sort -u \
      | gf sqli     > output/candidates_sqli.txt
    cat output/urls_all_deduped.txt output/historical_urls.txt | sort -u \
      | gf ssrf     > output/candidates_ssrf.txt
    cat output/urls_all_deduped.txt output/historical_urls.txt | sort -u \
      | gf redirect > output/candidates_redirect.txt
    cat output/urls_all_deduped.txt output/historical_urls.txt | sort -u \
      | gf lfi      > output/candidates_lfi.txt
    cat output/urls_all_deduped.txt output/historical_urls.txt | sort -u \
      | gf rce      > output/candidates_rce.txt
    wc -l output/candidates_*.txt

### Parameter Discovery

    # arjun — smart diff-based discovery (finds accepted GET/POST params)
    arjun -u "http://target.com/api/endpoint" \
      --proxy http://127.0.0.1:48080 \
      -o output/arjun_endpoint.json --stable

    # x8 — wordlist-based hidden parameter discovery (faster)
    x8 -u "http://target.com/endpoint" \
      -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt \
      --proxy http://127.0.0.1:48080 \
      -o output/x8_endpoint.txt

    # kiterunner discovery
    wget -qO /home/pentester/tools/small.json https://raw.githubusercontent.com/assetnote/kiterunner/refs/heads/main/routes/small.json
    kr discovery -u http://target.com -w /home/pentester/tools/small.json -o output/kr_endpoint.txt

### XSS Scanning

    # PREREQUISITE: canary reflection check before running scanner
    curl -sk "http://target.com/path?param=CANARY12345" | grep CANARY12345

    # Run XSS scanner on filtered candidates (pipe mode — all through Caido)
    cat output/candidates_xss.txt | dalfox pipe \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_results.txt 2>&1

    # Authenticated endpoints (session required)
    dalfox url "http://target.com/endpoint?param=test" \
      --cookie "session=VALUE" \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_auth.txt

    # Full dalfox reference: read dalfox.md

### SQLi Probe

    # Three mandatory manual probes per candidate parameter
    curl -sk "http://target.com/path?param=test'" \
      | grep -iE "error|sql|mysql|postgres|syntax|warning"

    curl -sk "http://target.com/path?param=1 AND 1=1" > /tmp/sqli_true.txt
    curl -sk "http://target.com/path?param=1 AND 1=2" > /tmp/sqli_false.txt
    diff /tmp/sqli_true.txt /tmp/sqli_false.txt

    time curl -sk "http://target.com/path?param=1; SELECT SLEEP(3)--" -o /dev/null

    # Only after signal confirmed: run sqlmap (see sqlmap.md)
    sqlmap -u "http://target.com/path?param=VALUE" -p param \
      --batch --level=1 --risk=1 \
      --proxy http://127.0.0.1:48080 \
      --output-dir output/sqlmap/

---

## Commands Reference

IMPORTANT — READ BEFORE USING ANY COMMAND BELOW:
These are structural patterns, NOT execution templates. Every command must be adapted to the
specific target based on manual analysis already completed. Do NOT copy-paste these commands
without first having a documented host profile and a justified reason for the specific command.

Commands marked with [HOST PROFILE REQUIRED] cannot be run until output/host_profiles.json
contains a complete entry for the target host.

Nuclei and sqlmap/ghauri commands are NOT listed here.
Load the nuclei or sqlmap skills for those tools — they have mandatory pre-conditions.

### Nuclei Usage

Nuclei commands are documented in the nuclei skill.
Load it with: read_file on nuclei — mandatory pre-conditions must be met first.

### Advanced Profiling & OOB

```bash
interactsh-client -server oast.pro -o output/oob_callbacks.txt
smuggler.py -u <target> --log-level DEBUG | tee output/smuggling.txt
headi -u <target> | tee output/header_injection.txt
nosqli -u <target> | tee output/nosqli.txt
toxicache -u <url> | tee output/cache_probe.txt
hakip2host <IP> | tee output/virtual_hosts.txt
```
---

## Universal Payload Reference (MANDATORY CHEAT SHEET)

If you need a specific payload for ANY vulnerability class (SQLi, XSS, SSRF, SSTI, LFI, Deserialization, etc.), **DO NOT GUESS OR HALLUCINATE PAYLOADS**.

IMMEDIATELY refer to the comprehensive payload repository at:
**[PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings)**

You can use `web_search` to query specific techniques from it.
Example: `web_search "PayloadsAllTheThings SSRF"`
Example: `web_search "PayloadsAllTheThings JSON Web Token"`
