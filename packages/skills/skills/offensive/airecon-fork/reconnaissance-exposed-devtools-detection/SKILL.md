<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: exposed-devtools-detection
description: Detect and assess publicly exposed development tools including Storybook component libraries, serial terminals, hardware debug interfaces, admin panels on dev clusters, and developer-only services that should never be internet-facing
---

# Exposed Development Tools & Dev Cluster Detection

Development tools accidentally exposed to the internet are consistently underreported in bug bounties but accepted as valid findings. Unlike production vulnerabilities, these require no exploitation — existence on the public internet without authentication IS the vulnerability.

**High-value targets:**
- Storybook instances (expose UI component architecture)
- Hardware interface tools (serial terminals, JTAG interfaces)
- Developer-only admin panels and dashboards
- Internal documentation sites (Notion self-hosted, Confluence, GitBook internal)
- Database admin UIs (pgAdmin, Adminer, MongoDB Compass web)
- Container/Kubernetes dashboards (Kubernetes Dashboard, Portainer, k9s web)

---

## STEP 1 — Identify Dev/Staging Subdomain Patterns

```bash
# From subdomains.txt, identify development cluster patterns
grep -iE '(dev|staging|stage|qa|uat|sandbox|preview|test|solo|personal|local|internal)\.' \
  output/subdomains.txt | sort -u | tee output/dev_subdomains.txt

# More aggressive: any subdomain with dev-related keywords
grep -iE '(dev\.|\.dev\.|staging\.|stg\.|qa\.|uat\.|test\.|sandbox\.|preview\.|solo\.|canary\.|beta\.|nightly\.|alpha\.)' \
  output/subdomains.txt | sort -u >> output/dev_subdomains.txt

# Kubernetes cluster patterns specifically
grep -iE '(\.(k8s|kube|cluster|node|pod|svc|namespace)|\.(dev|staging)\.solo\.|\.dev\.cluster\.)' \
  output/subdomains.txt | sort -u >> output/dev_subdomains.txt

sort -u output/dev_subdomains.txt > output/dev_subdomains_dedup.txt
echo "Dev subdomains found: $(wc -l < output/dev_subdomains_dedup.txt)"
cat output/dev_subdomains_dedup.txt
```

---

## STEP 2 — Storybook Detection

Storybook has unique fingerprints detectable without authentication:

```python
# tools/detect_storybook.py
"""
Storybook fingerprints:
1. Title: "<x> - Storybook" or "Storybook"
2. Body contains: "storybook-root", "sb-show-main", "@storybook/", "storybook.js.org"
3. Route: /stories.json (machine-readable story index)
4. Route: /index.json (Storybook 7+ stories index)
5. Route: /iframe.html (story rendering iframe)
6. Static assets: /sb_dll/, /sb-addons/
"""
import urllib.request, urllib.error, ssl, json, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

STORYBOOK_INDICATORS = [
    "storybook-root", "sb-show-main", "@storybook/",
    "storybook.js.org", "- Storybook</title>",
    "Storybook</title>", "STORYBOOK_ENV"
]

STORYBOOK_PATHS = [
    "/stories.json",      # Storybook 6 story index
    "/index.json",        # Storybook 7+ story index
    "/iframe.html",       # Story rendering iframe
    "/project.json",      # Storybook project config
    "/sb-addons/",        # Addon assets
]

def check_storybook(base_url):
    findings = []

    # Check main page for fingerprints
    try:
        req = urllib.request.Request(base_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            body = r.read(5000).decode('utf-8', 'ignore')

            for indicator in STORYBOOK_INDICATORS:
                if indicator.lower() in body.lower():
                    findings.append(f"INDICATOR: {indicator}")

            # Extract title
            title = re.search(r'<title>([^<]+)</title>', body)
            if title and 'storybook' in title.group(1).lower():
                findings.append(f"TITLE: {title.group(1)}")

            # Extract package name from title (usually "<package> - Storybook")
            if title:
                pkg_match = re.match(r'^(.+?)\s*-\s*Storybook', title.group(1))
                if pkg_match:
                    findings.append(f"PACKAGE: {pkg_match.group(1)}")
    except Exception as ex:
        return None

    # Check for stories.json (complete component inventory)
    for path in STORYBOOK_PATHS:
        try:
            req = urllib.request.Request(
                base_url.rstrip('/') + path,
                headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                body = r.read(10000).decode('utf-8', 'ignore')
                findings.append(f"PATH_EXISTS: {path} [{r.status}]")

                # Parse stories.json to extract component names
                if path in ('/stories.json', '/index.json'):
                    try:
                        data = json.loads(body)
                        stories = data.get('stories', data.get('entries', {}))
                        components = set()
                        for story_id, story_data in stories.items():
                            if isinstance(story_data, dict):
                                kind = story_data.get('kind', story_data.get('title', ''))
                                if kind:
                                    components.add(kind)
                        findings.append(f"COMPONENTS ({len(components)} total): {', '.join(list(components)[:10])}...")
                    except Exception:
                        pass
        except urllib.error.HTTPError as e:
            pass
        except Exception:
            pass

    return findings if findings else None

# Load live hosts and check each
with open("output/live_hosts.txt") as f:
    hosts = [line.strip() for line in f if line.strip()]

print("=== Scanning for exposed Storybook instances ===")
for host_line in hosts:
    # Parse "https://example.com [200]" format
    parts = host_line.split()
    if not parts:
        continue
    host = parts[0]
    if not host.startswith("http"):
        host = f"https://{host}"

    result = check_storybook(host)
    if result:
        print(f"\n[STORYBOOK FOUND] {host}")
        for f in result:
            print(f"  {f}")
        with open("output/exposed_storybook.txt", "a") as out:
            out.write(f"{host}\n")
            for r in result:
                out.write(f"  {r}\n")
```

```bash
python3 tools/detect_storybook.py | tee output/storybook_detection.txt
```

---

## STEP 3 — Serial Terminal & Hardware Interface Detection

```python
# tools/detect_hardware_interfaces.py
"""
Hardware debugging tools exposed to the internet:
- Web-based serial terminals (WebSerial API)
- JTAG/SWD debug interfaces (OpenOCD web UI)
- Hardware-in-the-loop test dashboards
- Firmware update servers

Indicators:
- Origin-Trial header with WebSerial API token
- navigator.serial references in page JS
- "serial port", "baud rate", "COM port" in page content
- Titles: "Serial Terminal", "Console", "Debug Terminal"
"""
import urllib.request, urllib.error, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HARDWARE_INDICATORS = {
    "webserial": [
        "navigator.serial", "requestPort(", "WebSerial",
        "serial-polyfill", "web-serial-polyfill"
    ],
    "serial_ui": [
        "serial terminal", "serial port", "baud rate", "COM port",
        "UART", "RS232", "serial console", "connect to device"
    ],
    "origin_trial": [
        'http-equiv="origin-trial"',
        "origin-trial"
    ],
    "jtag_debug": [
        "OpenOCD", "JTAG", "SWD", "GDB server", "debug probe",
        "firmware flash", "DFU mode"
    ],
    "hardware_test": [
        "hardware in the loop", "HIL test", "device under test",
        "test fixture", "test harness"
    ]
}

def check_hardware_interface(url):
    findings = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            headers = dict(r.headers)
            body = r.read(10000).decode('utf-8', 'ignore')

            # Check Origin-Trial header (indicates experimental API usage)
            origin_trial = headers.get('origin-trial', '')
            ot_meta = re.search(r'origin-trial.*?content="([^"]{20,})"', body, re.I)
            if origin_trial or ot_meta:
                token = origin_trial or (ot_meta.group(1) if ot_meta else '')
                findings.append(f"ORIGIN_TRIAL: {token[:80]}...")

            # Check each indicator category
            body_lower = body.lower()
            for category, indicators in HARDWARE_INDICATORS.items():
                matched = [ind for ind in indicators if ind.lower() in body_lower]
                if matched:
                    findings.append(f"{category.upper()}: {matched}")

            # Extract page title
            title = re.search(r'<title>([^<]+)</title>', body)
            if title:
                findings.append(f"TITLE: {title.group(1)}")

    except Exception as ex:
        return None

    return findings if findings else None

# Check dev subdomains specifically
with open("output/dev_subdomains_dedup.txt") as f:
    dev_hosts = [line.strip() for line in f if line.strip()]

print("=== Scanning dev subdomains for hardware interfaces ===")
for host in dev_hosts:
    url = f"https://{host}" if not host.startswith("http") else host
    result = check_hardware_interface(url)
    if result:
        print(f"\n[HARDWARE INTERFACE] {url}")
        for r in result:
            print(f"  {r}")
```

```bash
python3 tools/detect_hardware_interfaces.py | tee output/hardware_interface_detection.txt
```

---

## STEP 4 — Generic Dev Tool Fingerprinting

```python
# tools/detect_devtools.py
"""
Fingerprint common development tools that should not be public-facing.
"""
import urllib.request, urllib.error, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Tool fingerprint definitions: (name, path_patterns, body_indicators, title_patterns)
DEV_TOOLS = [
    {
        "name": "Storybook",
        "paths": ["/", "/stories.json", "/iframe.html"],
        "body": ["storybook-root", "sb-show-main", "Storybook"],
        "titles": ["Storybook"]
    },
    {
        "name": "Kubernetes Dashboard",
        "paths": ["/", "/#/overview"],
        "body": ["kubernetes-dashboard", "kubernetesui", "kube-system"],
        "titles": ["Kubernetes Dashboard"]
    },
    {
        "name": "Grafana",
        "paths": ["/", "/login"],
        "body": ["grafana", "Grafana", "grafana-app"],
        "titles": ["Grafana"]
    },
    {
        "name": "pgAdmin",
        "paths": ["/", "/pgadmin4/"],
        "body": ["pgAdmin", "pg4_login"],
        "titles": ["pgAdmin", "pgAdmin 4"]
    },
    {
        "name": "Portainer",
        "paths": ["/", "/#/init/admin"],
        "body": ["portainer", "Portainer"],
        "titles": ["Portainer"]
    },
    {
        "name": "Jupyter Notebook",
        "paths": ["/", "/tree"],
        "body": ["jupyter", "ipython", "notebook_app"],
        "titles": ["Jupyter", "JupyterLab"]
    },
    {
        "name": "Adminer",
        "paths": ["/adminer", "/adminer.php", "/adminer/"],
        "body": ["adminer", "Adminer"],
        "titles": ["Adminer"]
    },
    {
        "name": "RabbitMQ Management",
        "paths": ["/#/", "/api/overview"],
        "body": ["rabbitmq_management", "RabbitMQ"],
        "titles": ["RabbitMQ Management"]
    },
    {
        "name": "Laravel Telescope",
        "paths": ["/telescope", "/telescope/requests"],
        "body": ["telescope", "Laravel Telescope"],
        "titles": ["Telescope"]
    },
    {
        "name": "Django Debug Toolbar",
        "paths": ["/__debug__/"],
        "body": ["djdt", "django-debug-toolbar"],
        "titles": ["Django Debug"]
    },
    {
        "name": "Spring Boot Actuator",
        "paths": ["/actuator", "/actuator/health", "/actuator/env"],
        "body": ["actuator", "springBootVersion"],
        "titles": []
    },
    {
        "name": "Serial Terminal (WebSerial)",
        "paths": ["/"],
        "body": ["navigator.serial", "serial terminal", "serialport"],
        "titles": ["Serial Terminal", "Serial Console", "Console"]
    },
    {
        "name": "Caido (Proxy Tool)",
        "paths": ["/"],
        "body": ["caido", "Caido"],
        "titles": ["Caido"]
    },
    {
        "name": "Ngrok Dashboard",
        "paths": ["/"],
        "body": ["ngrok", "inspect.html"],
        "titles": ["ngrok"]
    },
    {
        "name": "HashiCorp Vault UI",
        "paths": ["/ui/", "/v1/sys/health"],
        "body": ["vault-ui", "HashiCorp Vault"],
        "titles": ["Vault"]
    },
    {
        "name": "GitLab (internal instance)",
        "paths": ["/", "/users/sign_in"],
        "body": ["gitlab", "GitLab"],
        "titles": ["GitLab", "Sign in · GitLab"]
    },
    {
        "name": "ArgoCD",
        "paths": ["/", "/auth/login"],
        "body": ["argo-cd", "argocd"],
        "titles": ["Argo CD"]
    },
    {
        "name": "Rancher",
        "paths": ["/"],
        "body": ["rancher", "Rancher"],
        "titles": ["Rancher"]
    }
]

def fingerprint_host(base_url):
    matches = []
    for tool in DEV_TOOLS:
        for path in tool["paths"]:
            url = base_url.rstrip('/') + path
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                    body = r.read(5000).decode('utf-8', 'ignore')
                    title_match = re.search(r'<title>([^<]+)</title>', body)
                    title = title_match.group(1) if title_match else ''

                    body_hit = any(ind.lower() in body.lower() for ind in tool["body"])
                    title_hit = any(t.lower() in title.lower() for t in tool["titles"]) if tool["titles"] else False

                    if body_hit or title_hit:
                        matches.append({
                            "tool": tool["name"], "url": url,
                            "status": r.status, "title": title[:80]
                        })
                        break
            except urllib.error.HTTPError as e:
                body = e.read(1000).decode('utf-8', 'ignore')
                body_hit = any(ind.lower() in body.lower() for ind in tool["body"])
                if body_hit:
                    matches.append({"tool": tool["name"], "url": url, "status": e.code})
            except Exception:
                pass
    return matches

# Scan all dev subdomains + live hosts
all_hosts = set()
for fname in ["output/dev_subdomains_dedup.txt", "output/live_hosts.txt"]:
    try:
        with open(fname) as f:
            for line in f:
                parts = line.strip().split()
                if parts:
                    h = parts[0]
                    if not h.startswith("http"):
                        h = f"https://{h}"
                    all_hosts.add(h)
    except FileNotFoundError:
        pass

print(f"=== Scanning {len(all_hosts)} hosts for exposed dev tools ===")
found_any = False
for host in sorted(all_hosts):
    matches = fingerprint_host(host)
    if matches:
        found_any = True
        for m in matches:
            print(f"\n[DEV TOOL EXPOSED] {m['tool']}")
            print(f"  URL: {m['url']}")
            print(f"  Status: {m['status']}")
            print(f"  Title: {m.get('title', 'N/A')}")

if not found_any:
    print("[*] No exposed dev tools detected in current host list")
```

```bash
python3 tools/detect_devtools.py | tee output/devtools_detection.txt
```

---

## STEP 5 — Assess Impact of Exposed Dev Tool

Once a dev tool is found, collect evidence:

```bash
# For Storybook: extract full component inventory
STORYBOOK_URL="https://TARGET_STORYBOOK_URL"

# Get all stories
curl -sk "$STORYBOOK_URL/stories.json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
stories = data.get('stories', data.get('entries', {}))
components = {}
for sid, sdata in stories.items():
    if isinstance(sdata, dict):
        title = sdata.get('kind', sdata.get('title', ''))
        name = sdata.get('name', '')
        if title:
            components.setdefault(title, []).append(name)
print(f'Total components: {len(components)}')
for comp, stories in sorted(components.items()):
    print(f'  {comp}: {stories}')
" | tee output/storybook_components.txt

# Screenshot the tool (via browser_action) as evidence
# browser_action: take_screenshot of STORYBOOK_URL
```

---

## Severity Assessment

| Tool | No Auth Required | Auth Required | Severity |
|------|-----------------|---------------|----------|
| Serial terminal (prod) | CRITICAL | HIGH | — |
| Serial terminal (dev) | HIGH | MEDIUM | — |
| Kubernetes Dashboard | CRITICAL | HIGH | — |
| Storybook | MEDIUM | LOW | — |
| Grafana (unauthenticated) | HIGH | MEDIUM | — |
| Spring Boot Actuator (/env) | HIGH | MEDIUM | — |
| pgAdmin | CRITICAL | HIGH | — |
| Jupyter Notebook | CRITICAL | HIGH | — |
| Internal GitLab | HIGH | MEDIUM | — |
| ArgoCD | HIGH | MEDIUM | — |

---

## Pro Tips

1. **`dev.solo.` and `dev.personal.` patterns are highest risk** — these are individual developer namespaces that bypass security review processes.
2. **Storybook on `circuit.*/design.*/ui.*` subdomains** — design system Storybooks contain payment form components and auth UI that map directly to production XSS surfaces.
3. **Check for unauthenticated stories.json** — even if the main Storybook UI requires auth, `stories.json` is often a static file served without auth checks.
4. **Hardware terminals on payment companies** — if the target makes physical payment devices (card readers, POS terminals), serial terminals are used for firmware debugging. Finding one exposed = critical.
5. **Origin-Trial tokens are time-limited** — capture the token and decode the JWT to see the origin and expiry. If not expired, the WebSerial API is live on that page.
6. **Cluster namespace enumeration** — once you find one `service.dev.solo.target.com`, DNS-brute other common service names on the same cluster (`api.dev.solo.target.com`, `admin.dev.solo.target.com`).
