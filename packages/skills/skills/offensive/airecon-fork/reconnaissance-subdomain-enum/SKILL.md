<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Subdomain Enumeration — Full Spectrum Playbook

## Overview
Three-layer coverage: Passive (no DNS noise), Active (DNS queries), Manual (logic-driven).
Goal: maximum surface with minimum noise.

---

## Setup

```bash
TARGET="example.com"
OUT="/workspace/output/${TARGET}"
mkdir -p "$OUT"

# Core tools
# go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
# go install github.com/owasp-amass/amass/v4/...@latest
# go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
# go install github.com/projectdiscovery/httpx/cmd/httpx@latest
# go install github.com/d3mondev/puredns/v2@latest
# go install github.com/tomnomnom/assetfinder@latest
# go install github.com/tomnomnom/anew@latest
# go install github.com/Josue87/gotator@latest
# go install github.com/projectdiscovery/alterx/cmd/alterx@latest
# go install github.com/lc/subjs@latest
# go install github.com/tomnomnom/waybackurls@latest
# go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
# pip install dnsgen
```

---

## PHASE 1 — PASSIVE ENUMERATION (No Active DNS)

### 1.1 Aggregator Tools

```bash
# subfinder with all sources
subfinder -d $TARGET -all -recursive -silent \
  | anew $OUT/passive_subfinder.txt

# assetfinder
assetfinder --subs-only $TARGET \
  | anew $OUT/passive_assetfinder.txt

# amass passive only
amass enum -passive -d $TARGET -o $OUT/passive_amass.txt
```

### 1.2 Certificate Transparency

```bash
# crt.sh — best free CT source
curl -s "https://crt.sh/?q=%25.$TARGET&output=json" \
  | python3 -c "
import json,sys
data=json.load(sys.stdin)
subs={e['name_value'] for e in data}
for s in sorted(subs):
    for line in s.split('\n'):
        line=line.strip().lstrip('*.')
        if line: print(line)
" | sort -u | anew $OUT/passive_crtsh.txt

# certspotter
curl -s "https://api.certspotter.com/v1/issuances?domain=$TARGET&include_subdomains=true&expand=dns_names" \
  | python3 -c "
import json,sys
for entry in json.load(sys.stdin):
    for name in entry.get('dns_names',[]):
        print(name.lstrip('*.'))
" | sort -u | anew $OUT/passive_certspotter.txt

# Censys (requires API key)
# curl -s "https://search.censys.io/api/v1/search/certificates" \
#   -u "$CENSYS_API_ID:$CENSYS_API_SECRET" \
#   -d "{\"query\":\"parsed.names: $TARGET\",\"fields\":[\"parsed.names\"]}" \
#   | python3 -c "import json,sys; [print(n) for r in json.load(sys.stdin)['results'] for n in r.get('parsed.names',[])]"
```

### 1.3 DNS History & Passive DNS

```bash
# VirusTotal passive DNS (free tier)
curl -s "https://www.virustotal.com/api/v3/domains/$TARGET/subdomains?limit=40" \
  -H "x-apikey: $VT_API_KEY" \
  | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data.get('data',[]):
    print(item['id'])
" | anew $OUT/passive_virustotal.txt

# SecurityTrails (requires API key)
# curl -s "https://api.securitytrails.com/v1/domain/$TARGET/subdomains" \
#   -H "APIKEY: $SECURITYTRAILS_KEY" \
#   | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'{s}.{d[\"apex_domain\"]}') for s in d.get('subdomains',[])]"

# HackerTarget
curl -s "https://api.hackertarget.com/hostsearch/?q=$TARGET" \
  | cut -d',' -f1 | anew $OUT/passive_hackertarget.txt

# RapidDNS
curl -s "https://rapiddns.io/subdomain/$TARGET?full=1#result" \
  | grep -oP '(?<=<td>)[a-zA-Z0-9._-]+\.'$TARGET | sort -u \
  | anew $OUT/passive_rapiddns.txt
```

### 1.4 Search Engine Dorking

```python
# dork_subdomain.py — Google/Bing programmatic subdomain harvest
import re, time, sys, urllib.request, urllib.parse

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
DORKS = [
    f'site:{TARGET} -www',
    f'site:*.{TARGET}',
    f'inurl:{TARGET} filetype:txt',
]
PATTERN = re.compile(r'(?:https?://)?([a-zA-Z0-9._-]+\.' + re.escape(TARGET) + r')')
found = set()

headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}

for dork in DORKS:
    url = "https://www.bing.com/search?q=" + urllib.parse.quote(dork) + "&count=50"
    try:
        req = urllib.request.Request(url, headers=headers)
        body = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
        matches = PATTERN.findall(body)
        found.update(m.lower() for m in matches)
        time.sleep(2)
    except Exception as e:
        print(f"[!] {dork}: {e}", file=sys.stderr)

for s in sorted(found):
    print(s)
```

```bash
python3 dork_subdomain.py $TARGET | anew $OUT/passive_dorks.txt
```

### 1.5 Web Archive Sources

```bash
# Wayback Machine
echo $TARGET | waybackurls \
  | grep -oP '(?:https?://)\K[a-zA-Z0-9._-]+(?=/)' \
  | grep -E "\.${TARGET}$" | sort -u \
  | anew $OUT/passive_wayback.txt

# Common Crawl index API
curl -s "https://index.commoncrawl.org/CC-MAIN-2024-10-index?url=*.$TARGET&output=json&limit=500" \
  | python3 -c "
import sys,json
for line in sys.stdin:
    try:
        d=json.loads(line)
        u=d.get('url','')
        if '://' in u:
            host=u.split('://')[1].split('/')[0].split(':')[0]
            print(host)
    except: pass
" | sort -u | anew $OUT/passive_commoncrawl.txt
```

### 1.6 ASN → IP Ranges → Reverse DNS

```python
# asn_reverse_dns.py — find all org IP ranges, reverse DNS → subdomains
import subprocess, sys, re, ipaddress

TARGET_ORG = sys.argv[1] if len(sys.argv) > 1 else "Example Inc"
TARGET_DOMAIN = sys.argv[2] if len(sys.argv) > 2 else "example.com"

import urllib.request, json

# Get ASN from bgpview
url = f"https://api.bgpview.io/search?query_term={urllib.parse.quote(TARGET_ORG)}"
try:
    import urllib.parse
    data = json.loads(urllib.request.urlopen(url, timeout=15).read())
    asns = [a['asn'] for a in data.get('data', {}).get('asns', [])]
except Exception as e:
    print(f"[!] BGPView lookup failed: {e}", file=sys.stderr)
    asns = []

print(f"[*] Found ASNs: {asns}", file=sys.stderr)
found_subs = set()

for asn in asns[:5]:  # cap at 5 ASNs
    try:
        prefixes_url = f"https://api.bgpview.io/asn/{asn}/prefixes"
        prefix_data = json.loads(urllib.request.urlopen(prefixes_url, timeout=15).read())
        for p in prefix_data.get('data', {}).get('ipv4_prefixes', [])[:20]:
            cidr = p.get('prefix', '')
            if not cidr:
                continue
            print(f"[*] Scanning {cidr}", file=sys.stderr)
            # Use host command for reverse lookup on first /24 subset
            net = ipaddress.ip_network(cidr, strict=False)
            for ip in list(net.hosts())[:50]:
                try:
                    result = subprocess.run(['host', str(ip)], capture_output=True, text=True, timeout=3)
                    if 'domain name pointer' in result.stdout:
                        ptr = result.stdout.split('domain name pointer')[1].strip().rstrip('.')
                        if TARGET_DOMAIN in ptr:
                            found_subs.add(ptr)
                except:
                    pass
    except Exception as e:
        print(f"[!] ASN {asn}: {e}", file=sys.stderr)

for s in sorted(found_subs):
    print(s)
```

### 1.7 SPF/DMARC/MX DNS Record Mining

```python
# dns_record_harvest.py — extract subdomains from TXT/MX/NS/SOA records
import dns.resolver, re, sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
resolver = dns.resolver.Resolver()
resolver.timeout = 5
resolver.lifetime = 5

RECORD_TYPES = ['MX', 'NS', 'SOA', 'TXT']
found = set()
pattern = re.compile(r'([a-zA-Z0-9._-]+\.' + re.escape(TARGET) + r')')

for rtype in RECORD_TYPES:
    try:
        answers = resolver.resolve(TARGET, rtype)
        for r in answers:
            raw = r.to_text()
            matches = pattern.findall(raw)
            for m in matches:
                m = m.rstrip('.')
                if m != TARGET:
                    found.add(m)
                    print(f"[{rtype}] {m}")
    except Exception as e:
        print(f"[!] {rtype}: {e}", file=sys.stderr)

# SPF includes — often reveal infra subdomains
try:
    for r in resolver.resolve(TARGET, 'TXT'):
        raw = r.to_text()
        if 'spf' in raw.lower() or 'include:' in raw:
            includes = re.findall(r'include:([^\s"]+)', raw)
            redirects = re.findall(r'redirect=([^\s"]+)', raw)
            for host in includes + redirects:
                print(f"[SPF-INCLUDE] {host}")
                # Recurse one level
                try:
                    for r2 in resolver.resolve(host, 'TXT'):
                        for inc2 in re.findall(r'include:([^\s"]+)', r2.to_text()):
                            print(f"[SPF-INCLUDE-L2] {inc2}")
                except:
                    pass
except Exception as e:
    print(f"[!] SPF: {e}", file=sys.stderr)
```

```bash
python3 dns_record_harvest.py $TARGET | anew $OUT/passive_dns_records.txt
```

### 1.8 JavaScript & Response Header Mining

```bash
# Extract subdomains from JS files
echo "https://$TARGET" | subjs \
  | xargs -P5 -I{} curl -sk {} \
  | grep -oP "(?:https?://)[a-zA-Z0-9._-]+\.${TARGET}" \
  | sort -u | anew $OUT/passive_js.txt

# GitHub code search for target domain mentions
# Requires: gh auth login
# gh search code "$TARGET" --limit 100 --json path,url \
#   | python3 -c "import json,sys; [print(r['url']) for r in json.load(sys.stdin)]"
```

---

## PHASE 2 — ACTIVE ENUMERATION (DNS Queries)

### 2.1 Zone Transfer Attempt (AXFR)

```bash
# Enumerate nameservers first
dig NS $TARGET +short | tee $OUT/active_nameservers.txt

# Attempt AXFR on each NS
while read ns; do
    ns=$(echo $ns | tr -d '.')
    echo "[*] Trying AXFR from $ns"
    dig AXFR $TARGET @$ns | tee $OUT/active_axfr_${ns}.txt
    # If successful, extract all hostnames
    if grep -q "SOA\|A\|AAAA\|CNAME" $OUT/active_axfr_${ns}.txt 2>/dev/null; then
        awk '{print $1}' $OUT/active_axfr_${ns}.txt \
          | grep -E "\.${TARGET}\.?$" \
          | sed 's/\.$//' | anew $OUT/active_axfr_found.txt
        echo "[!] AXFR SUCCESS on $ns"
    fi
done < $OUT/active_nameservers.txt
```

### 2.2 Wildcard Detection

```bash
# Detect wildcard before brute forcing — prevents false positives
python3 -c "
import dns.resolver, random, string, sys

TARGET = sys.argv[1]
resolver = dns.resolver.Resolver()
resolver.timeout = 3

# Test 3 random subdomains
wildcards = []
for _ in range(3):
    rand = ''.join(random.choices(string.ascii_lowercase, k=12))
    test = f'{rand}.{TARGET}'
    try:
        resolver.resolve(test, 'A')
        wildcards.append(test)
    except:
        pass

if wildcards:
    print(f'[!] WILDCARD DETECTED: {TARGET} resolves random subdomains')
    print('[!] Brute force will produce false positives — filter by wildcard IP')
    # Get wildcard IPs to exclude
    try:
        wc_ips = [r.to_text() for r in resolver.resolve(wildcards[0], 'A')]
        print(f'[!] Wildcard IPs: {wc_ips}')
        with open('wildcard_ips.txt', 'w') as f:
            f.write('\n'.join(wc_ips))
    except:
        pass
else:
    print(f'[OK] No wildcard detected on {TARGET}')
" $TARGET
```

### 2.3 DNS Brute Force (puredns + massdns)

```bash
# Download wordlist
WORDLIST="/usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt"
# Or: curl -sL https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/DNS/subdomains-top1million-20000.txt -o /tmp/dns_wordlist.txt

# Resolvers — curated public DNS resolvers
curl -sL https://raw.githubusercontent.com/trickest/resolvers/main/resolvers.txt \
  -o /tmp/resolvers.txt

# puredns brute force (handles wildcards automatically)
puredns bruteforce $WORDLIST $TARGET \
  --resolvers /tmp/resolvers.txt \
  --wildcard-tests 3 \
  --write $OUT/active_bruteforce.txt

# Alternative: dnsx direct bruteforce
# dnsx -d $TARGET -w $WORDLIST -r /tmp/resolvers.txt -o $OUT/active_bruteforce.txt
```

### 2.4 Permutation & Alteration

```bash
# Merge all discovered subdomains so far
cat $OUT/passive_*.txt $OUT/active_bruteforce.txt 2>/dev/null \
  | sort -u > $OUT/all_so_far.txt

# gotator — generate permutations
gotator -sub $OUT/all_so_far.txt \
  -perm /usr/share/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt \
  -depth 1 -numbers 3 -md \
  | anew $OUT/active_permutations_raw.txt

# alterx — pattern-based alteration
cat $OUT/all_so_far.txt | alterx | anew $OUT/active_permutations_raw.txt

# dnsgen
cat $OUT/all_so_far.txt | dnsgen - | anew $OUT/active_permutations_raw.txt

# Resolve all permutations
puredns resolve $OUT/active_permutations_raw.txt \
  --resolvers /tmp/resolvers.txt \
  --write $OUT/active_permutations_resolved.txt
```

### 2.5 Recursive Active Enumeration

```bash
# amass active — uses brute force, TLS certs, scraping
amass enum -active -d $TARGET \
  -brute -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -o $OUT/active_amass_active.txt \
  -timeout 30

# Extract from amass output
cat $OUT/active_amass_active.txt | anew $OUT/all_so_far.txt
```

### 2.6 TLS Certificate SAN Probe

```python
# tls_san_probe.py — connect to discovered subdomains, extract SANs from TLS cert
import ssl, socket, sys

def get_sans(host, port=443, timeout=5):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                sans = [v for t, v in cert.get('subjectAltName', []) if t == 'DNS']
                return sans
    except Exception as e:
        return []

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
input_file = sys.argv[2] if len(sys.argv) > 2 else None

hosts = []
if input_file:
    with open(input_file) as f:
        hosts = [l.strip() for l in f if l.strip()]
else:
    hosts = [TARGET]

found = set()
for host in hosts:
    sans = get_sans(host)
    for san in sans:
        san = san.lstrip('*.')
        if TARGET in san:
            found.add(san)

for s in sorted(found):
    print(s)
```

```bash
python3 tls_san_probe.py $TARGET $OUT/all_so_far.txt \
  | anew $OUT/active_tls_sans.txt
```

### 2.7 Virtual Host (VHOST) Fuzzing

```bash
# Discover hidden vhosts on a target IP
TARGET_IP=$(dig +short $TARGET | head -1)

ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u "https://$TARGET_IP/" \
  -H "Host: FUZZ.$TARGET" \
  -fs $(curl -sk -o /dev/null -w "%{size_download}" "https://$TARGET_IP/" -H "Host: nonexistent123.$TARGET") \
  -t 50 -mc 200,301,302,403 \
  -o $OUT/active_vhost.json -of json

# Extract found vhosts
cat $OUT/active_vhost.json \
  | python3 -c "
import json,sys
data=json.load(sys.stdin)
for r in data.get('results',[]):
    print(r['input']['FUZZ'] + '.$TARGET')
" | anew $OUT/active_vhost_found.txt
```

---

## PHASE 3 — MANUAL TECHNIQUES (Logic-Driven)

### 3.1 robots.txt / sitemap.xml Mining

```python
# sitemap_subdomain.py — recursively parse sitemaps for subdomain mentions
import urllib.request, re, sys
from xml.etree import ElementTree

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
SEEDS = [
    f"https://{TARGET}/robots.txt",
    f"https://{TARGET}/sitemap.xml",
    f"https://{TARGET}/sitemap_index.xml",
    f"https://www.{TARGET}/sitemap.xml",
]

PATTERN = re.compile(r'(?:https?://)?([a-zA-Z0-9._-]+\.' + re.escape(TARGET) + r')')
visited = set()
found = set()

def parse_sitemap(url):
    if url in visited:
        return
    visited.add(url)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        body = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
        # Extract subdomains from raw text
        for m in PATTERN.findall(body):
            found.add(m)
        # Parse sitemap index
        try:
            root = ElementTree.fromstring(body)
            ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            for loc in root.findall('.//sm:loc', ns):
                if loc.text and '.xml' in loc.text:
                    parse_sitemap(loc.text.strip())
        except:
            pass
    except Exception as e:
        print(f"[!] {url}: {e}", file=sys.stderr)

for seed in SEEDS:
    parse_sitemap(seed)

for s in sorted(found):
    print(s)
```

```bash
python3 sitemap_subdomain.py $TARGET | anew $OUT/manual_sitemap.txt
```

### 3.2 App/API Response Subdomain Mining

```python
# response_mining.py — crawl target API/app responses, extract subdomain refs
import urllib.request, urllib.error, re, json, sys, collections

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
BASE_URL = f"https://{TARGET}"
PATTERN = re.compile(r'([a-zA-Z0-9._-]+\.' + re.escape(TARGET) + r')')

COMMON_ENDPOINTS = [
    "/", "/api", "/api/v1", "/api/v2", "/health",
    "/status", "/manifest.json", "/asset-manifest.json",
    "/robots.txt", "/.well-known/security.txt",
    "/static/js/main.chunk.js", "/config.js",
    "/env.js", "/runtime-main.js",
]

found = set()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/json,*/*',
}

for ep in COMMON_ENDPOINTS:
    url = BASE_URL + ep
    try:
        req = urllib.request.Request(url, headers=headers)
        body = urllib.request.urlopen(req, timeout=8).read().decode('utf-8', errors='ignore')
        matches = PATTERN.findall(body)
        if matches:
            new = set(matches) - found
            for m in new:
                print(f"[{ep}] {m}")
            found.update(matches)
    except:
        pass

# Also check response headers for domain hints
for ep in ["/"]:
    url = BASE_URL + ep
    try:
        req = urllib.request.Request(url, headers=headers)
        resp = urllib.request.urlopen(req, timeout=8)
        for h, v in resp.headers.items():
            if h.lower() in ['location', 'set-cookie', 'access-control-allow-origin', 'content-security-policy']:
                for m in PATTERN.findall(v):
                    print(f"[HEADER:{h}] {m}")
                    found.add(m)
    except:
        pass
```

```bash
python3 response_mining.py $TARGET | anew $OUT/manual_response.txt
```

### 3.3 Favicon Hash → Shodan Correlation

```python
# favicon_enum.py — compute favicon hash, query Shodan for same favicon
import urllib.request, base64, struct, sys

def favicon_hash(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        data = base64.encodebytes(urllib.request.urlopen(req, timeout=10).read()).decode()
        # MurmurHash3 compatible with Shodan
        h = 0
        for byte in data.encode():
            h ^= byte
            h = ((h << 5) | (h >> 27)) & 0xFFFFFFFF
            h = (h * 0x5bd1e995) & 0xFFFFFFFF
        # Proper mmh3 — install: pip install mmh3
        try:
            import mmh3
            raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10).read()
            return mmh3.hash(base64.encodebytes(raw).decode())
        except ImportError:
            pass
        return None
    except Exception as e:
        print(f"[!] {e}", file=sys.stderr)
        return None

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
urls = [
    f"https://{TARGET}/favicon.ico",
    f"https://www.{TARGET}/favicon.ico",
    f"https://{TARGET}/favicon.png",
]

for url in urls:
    h = favicon_hash(url)
    if h:
        print(f"[FAVICON HASH] {h}")
        print(f"[SHODAN QUERY] http.favicon.hash:{h}")
        print(f"[FOFA QUERY]   icon_hash=\"{h}\"")
```

```bash
python3 favicon_enum.py $TARGET
# Then search Shodan/FOFA/Censys with the hash to find related infrastructure
```

### 3.4 Mobile App Subdomain Extraction

```bash
# Decompile APK → grep for domain references
# apktool d target.apk -o /tmp/apk_decompiled
# grep -rE "[a-zA-Z0-9._-]+\.$TARGET" /tmp/apk_decompiled/

# From App Store URL → extract bundle ID → search
# frida-ps -Ua  # list installed apps
# objection --gadget "com.example.app" explore  # dump network calls
```

### 3.5 GitHub/GitLab Dorking

```bash
# GitHub code search — finds hardcoded subdomains in repos
# Requires: gh auth login

gh search code ".$TARGET" --limit 100 --json url,path,textMatches 2>/dev/null \
  | python3 -c "
import json, sys, re
TARGET = '$TARGET'
PATTERN = re.compile(r'([a-zA-Z0-9._-]+\.' + re.escape(TARGET) + r')')
data = json.load(sys.stdin)
found = set()
for item in data:
    for m in item.get('textMatches', []):
        for s in PATTERN.findall(m.get('fragment', '')):
            found.add(s)
for s in sorted(found):
    print(s)
" | anew $OUT/manual_github.txt

# GitLab search
# curl -s "https://gitlab.com/api/v4/search?scope=blobs&search=$TARGET" \
#   -H "Authorization: Bearer $GITLAB_TOKEN"
```

### 3.6 Content Security Policy Mining

```python
# csp_subdomain.py — parse CSP headers and meta tags to find all approved origins
import urllib.request, re, sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
URLS = [f"https://{TARGET}/", f"https://www.{TARGET}/", f"https://app.{TARGET}/"]
PATTERN = re.compile(r'([a-zA-Z0-9._-]+\.' + re.escape(TARGET) + r')')
CSP_HEADERS = ['content-security-policy', 'content-security-policy-report-only']

found = set()
for url in URLS:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=8)
        # Check response headers
        for h, v in resp.headers.items():
            if h.lower() in CSP_HEADERS:
                for m in PATTERN.findall(v):
                    print(f"[CSP-HEADER] {m}")
                    found.add(m)
        # Check meta CSP tags in body
        body = resp.read().decode('utf-8', errors='ignore')
        meta_csp = re.findall(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]+content=["\']([^"\']+)', body, re.I)
        for csp in meta_csp:
            for m in PATTERN.findall(csp):
                print(f"[CSP-META] {m}")
                found.add(m)
    except Exception as e:
        print(f"[!] {url}: {e}", file=sys.stderr)
```

```bash
python3 csp_subdomain.py $TARGET | anew $OUT/manual_csp.txt
```

### 3.7 Email Infrastructure Mining

```bash
# MX → mail server subdomains
dig MX $TARGET +short | awk '{print $2}' | tr -d '.' | while read mx; do
    echo "[MX] $mx.$TARGET"
    # Try common mail-related subs
    for prefix in mail smtp webmail autodiscover autoconfig owa exchange; do
        dig +short $prefix.$TARGET | grep -v "^$" && echo "[MAIL-SUB] $prefix.$TARGET"
    done
done | anew $OUT/manual_mail.txt

# DMARC/DKIM selectors — often reveal more infra
dig TXT _dmarc.$TARGET +short | anew $OUT/manual_dmarc.txt
# Common DKIM selectors
for sel in default google mail smtp selector1 selector2 k1 dkim; do
    result=$(dig TXT ${sel}._domainkey.$TARGET +short 2>/dev/null)
    if [ -n "$result" ]; then
        echo "[DKIM-SELECTOR] $sel: $result" | anew $OUT/manual_dkim.txt
    fi
done
```

---

## PHASE 4 — POST-PROCESSING & VALIDATION

### 4.1 Merge & Deduplicate

```bash
# Merge all sources
cat $OUT/passive_*.txt $OUT/active_*.txt $OUT/manual_*.txt 2>/dev/null \
  | grep -E "^[a-zA-Z0-9._-]+\.${TARGET}$" \
  | sort -u > $OUT/all_subdomains.txt

echo "[*] Total unique: $(wc -l < $OUT/all_subdomains.txt)"
```

### 4.2 DNS Resolution with IP Capture

```bash
# Resolve all — capture IPs for ASN/cloud analysis
dnsx -l $OUT/all_subdomains.txt \
  -a -aaaa -cname -mx -ns \
  -resp -silent \
  -o $OUT/resolved.txt

# Extract just resolved hosts
cat $OUT/resolved.txt | awk '{print $1}' > $OUT/resolved_hosts.txt

echo "[*] Resolved: $(wc -l < $OUT/resolved_hosts.txt)"
```

### 4.3 Live HTTP Probe

```bash
httpx -l $OUT/resolved_hosts.txt \
  -title -status-code -ip -tech-detect \
  -content-length -follow-redirects \
  -threads 50 -timeout 10 \
  -o $OUT/live_http.txt

echo "[*] Live HTTP: $(wc -l < $OUT/live_http.txt)"
```

### 4.4 Subdomain Takeover Detection

```bash
# nuclei takeover templates
nuclei -l $OUT/resolved_hosts.txt \
  -t takeovers/ \
  -o $OUT/takeovers.txt \
  -silent

# Check dangling CNAMEs
python3 -c "
import subprocess, sys

with open('$OUT/resolved.txt') as f:
    for line in f:
        if 'CNAME' in line:
            parts = line.split()
            if len(parts) >= 3:
                cname_target = parts[-1]
                # Check if CNAME target resolves
                r = subprocess.run(['dig', '+short', cname_target],
                                   capture_output=True, text=True, timeout=5)
                if not r.stdout.strip():
                    print(f'[DANGLING CNAME] {parts[0]} -> {cname_target}')
"
```

### 4.5 Cloud Asset Detection

```bash
# Detect S3, Azure Blob, GCS from subdomains/CNAMEs
python3 - << 'EOF'
import re, sys

CLOUD_PATTERNS = {
    's3': r'\.s3[.-](?:[a-z0-9-]+\.)?amazonaws\.com',
    'azure': r'\.(?:azurewebsites\.net|blob\.core\.windows\.net|azurefd\.net|cloudapp\.azure\.com)',
    'gcs': r'\.storage\.googleapis\.com',
    'github-pages': r'\.github\.io',
    'heroku': r'\.herokuapp\.com',
    'netlify': r'\.netlify\.app',
    'vercel': r'\.vercel\.app',
    'fastly': r'\.global\.fastly\.net',
    'cloudfront': r'\.cloudfront\.net',
}

with open('$OUT/resolved.txt') as f:
    for line in f:
        for provider, pattern in CLOUD_PATTERNS.items():
            if re.search(pattern, line, re.I):
                print(f'[{provider.upper()}] {line.strip()}')
EOF
```

### 4.6 Priority Triage

```bash
# High-value keyword filter
grep -iE "admin|api|app|auth|backend|beta|cms|console|dashboard|dev|git|internal|
jenkins|jira|kibana|ldap|login|mgmt|monitor|ops|panel|portal|prod|secret|
secure|staging|sso|test|vault|vpn|wiki|staging|preprod|sandbox|legacy|
grafana|prometheus|elastic|k8s|kube|docker|registry|ci|cd" \
  $OUT/live_http.txt | tee $OUT/priority_targets.txt

echo ""
echo "=== PRIORITY TARGETS ==="
wc -l $OUT/priority_targets.txt
cat $OUT/priority_targets.txt
```

---

## PHASE 5 — AUTOMATED FULL PIPELINE

```python
# subdomain_pipeline.py — orchestrate all phases, structured output
import subprocess, os, sys, json, datetime

TARGET = sys.argv[1] if len(sys.argv) > 1 else "example.com"
OUT = f"/workspace/output/{TARGET}"
os.makedirs(OUT, exist_ok=True)

def run(cmd, output_file=None, shell=True):
    print(f"[*] {cmd[:80]}")
    try:
        result = subprocess.run(cmd, shell=shell, capture_output=True, text=True, timeout=300)
        if output_file and result.stdout:
            with open(output_file, 'a') as f:
                f.write(result.stdout)
        return result.stdout
    except subprocess.TimeoutExpired:
        print(f"[!] Timeout: {cmd[:60]}")
        return ""
    except Exception as e:
        print(f"[!] {e}")
        return ""

# Phase 1: Passive
run(f"subfinder -d {TARGET} -all -silent", f"{OUT}/passive_subfinder.txt")
run(f"assetfinder --subs-only {TARGET}", f"{OUT}/passive_assetfinder.txt")
run(f'curl -s "https://crt.sh/?q=%25.{TARGET}&output=json" | python3 -c "import json,sys; [print(e[\'name_value\'].lstrip(\'*.\')) for e in json.load(sys.stdin)]"', f"{OUT}/passive_crtsh.txt")
run(f"curl -s 'https://api.hackertarget.com/hostsearch/?q={TARGET}' | cut -d, -f1", f"{OUT}/passive_hackertarget.txt")
run(f"echo {TARGET} | waybackurls | grep -oP '(?:https?://)\\K[^/]+' | grep '\\.{TARGET}$'", f"{OUT}/passive_wayback.txt")

# Merge passive
run(f"cat {OUT}/passive_*.txt | sort -u", f"{OUT}/all_passive.txt")
print(f"[*] Passive: {len(open(f'{OUT}/all_passive.txt').readlines())} subdomains")

# Phase 2: Active
run(f"puredns bruteforce /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt {TARGET} --write {OUT}/active_bruteforce.txt")
run(f"cat {OUT}/all_passive.txt | alterx | puredns resolve --write {OUT}/active_permutations.txt")

# Merge all
run(f"cat {OUT}/passive_*.txt {OUT}/active_*.txt | sort -u", f"{OUT}/all_subdomains.txt")
total = len(open(f"{OUT}/all_subdomains.txt").readlines())
print(f"[*] Total unique: {total}")

# Phase 4: Validation
run(f"dnsx -l {OUT}/all_subdomains.txt -silent -a -resp", f"{OUT}/resolved.txt")
run(f"cat {OUT}/resolved.txt | awk '{{print $1}}' | httpx -silent -title -status-code -ip", f"{OUT}/live_http.txt")

live = len(open(f"{OUT}/live_http.txt").readlines())
print(f"[*] Live HTTP: {live}")

# Report
report = {
    "target": TARGET,
    "date": datetime.datetime.now().isoformat(),
    "total_subdomains": total,
    "live_http": live,
    "output_dir": OUT,
}
with open(f"{OUT}/summary.json", "w") as f:
    json.dump(report, f, indent=2)

print(f"\n[+] Summary written to {OUT}/summary.json")
```

```bash
python3 subdomain_pipeline.py $TARGET
```

---

## Summary Table

| Phase | Technique | Noise | Coverage |
|-------|-----------|-------|----------|
| Passive | subfinder/amass/assetfinder | None | Medium |
| Passive | CT logs (crt.sh, certspotter) | None | High |
| Passive | DNS history (VirusTotal, SecurityTrails) | None | Medium |
| Passive | Web archives (Wayback, CommonCrawl) | None | Low-Medium |
| Passive | SPF/MX/NS record mining | None | Low |
| Passive | JS file mining | None | Medium |
| Passive | GitHub code search | None | Medium |
| Active | Zone transfer (AXFR) | Low | High (if open) |
| Active | DNS brute force (puredns) | Medium | High |
| Active | Permutation/alteration | Medium | High |
| Active | VHOST fuzzing (ffuf) | High | Medium |
| Active | TLS SAN probe | Low | Medium |
| Manual | Sitemap/robots.txt | None | Low |
| Manual | Response/header mining | Low | Medium |
| Manual | CSP origin extraction | None | Medium |
| Manual | Favicon hash → Shodan | None | Low-Medium |
| Manual | ASN → reverse DNS | Medium | Medium |
| Manual | Email infra (MX/DKIM) | None | Low |

---

indicators: subdomain enumeration, subdomain enum, subfinder, amass, assetfinder, dns brute, subdomain bruteforce, subdomain passive, subdomain active, certificate transparency, crt.sh, ct logs, zone transfer, axfr, dns axfr, wildcard dns, vhost fuzzing, virtual host, permutation subdomain, alterx, gotator, dnsgen, puredns, massdns, dnsx, passive recon subdomain, active recon subdomain, subdomain takeover detection, dangling cname, spf record subdomain, mx record enum, js subdomain, csp subdomain, favicon hash subdomain, asn subdomain, reverse dns, waybackurls subdomain, github dork subdomain, airecon subdomain
