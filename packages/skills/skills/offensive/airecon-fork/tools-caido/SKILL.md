<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Caido CLI — Complete GraphQL API Guide for AIRecon

Caido is a web proxy tool (similar to Burp Suite) controlled entirely via a GraphQL API.
In the AIRecon sandbox it runs on port **48080** and is managed by `caido-setup`.

Schema source: https://graphql-explorer.caido.io/ (200 operations: 77 queries + 123 mutations)

---

## STARTUP — Always Run First

```bash
caido-setup
```

Output on success:
```
✅ Caido Web Proxy successfully booted!
📡 Management UI: http://127.0.0.1:48080
🔑 Access Token: eyJ...
```

Save the token:
```bash
TOKEN="eyJ..."  # copy from caido-setup output
```

If already running, re-fetch token:
```bash
TOKEN=$(curl -sL -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { loginAsGuest { token { accessToken } } }"}' \
  http://127.0.0.1:48080/graphql | jq -r '.data.loginAsGuest.token.accessToken')
echo "TOKEN=$TOKEN"
```

---

## GraphQL Endpoint — Standard curl Wrapper

```bash
# Replace QUERY with any query/mutation string below
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"QUERY"}' \
  http://127.0.0.1:48080/graphql | jq .
```

For mutations with variables:
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation NAME($var: Type!) { op(input: $var) { ... } }", "variables": {"var": {...}}}' \
  http://127.0.0.1:48080/graphql | jq .
```

---

## Using Caido as HTTP Proxy (Capture Traffic)

All traffic routed through port 48080 is logged to the active project.

```bash
# curl through Caido proxy (use -k to accept Caido's CA cert)
curl -x http://127.0.0.1:48080 -k https://target.com/api/endpoint

# Set proxy environment variables for tools that respect them
export http_proxy=http://127.0.0.1:48080
export https_proxy=http://127.0.0.1:48080
export HTTPS_PROXY=http://127.0.0.1:48080
export HTTP_PROXY=http://127.0.0.1:48080

# Python httpx
import httpx
client = httpx.Client(
    proxies={"http://": "http://127.0.0.1:48080", "https://": "http://127.0.0.1:48080"},
    verify=False
)

# Python requests
import requests
session = requests.Session()
session.proxies = {"http": "http://127.0.0.1:48080", "https": "http://127.0.0.1:48080"}
session.verify = False
```

---

## HTTP History — Query Captured Requests

### List recent requests (paginated)
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requests(first: 50) { edges { node { id method host path port isTls response { statusCode length roundtripTime } createdAt } } pageInfo { hasNextPage endCursor } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.requests.edges[].node'
```

### Filter requests using HTTPQL
HTTPQL is Caido's filter language. Operators: `eq`, `like`, `gt`, `lt`, `preset`.

```bash
# By host
FILTER='host.eq:"target.com"'

# By HTTP method
FILTER='method.eq:"POST"'

# By path pattern
FILTER='path.cont:"/api/"'

# By response status code
FILTER='resp.code.eq:200'

# By response length
FILTER='resp.length.gt:1000'

# Combine filters (AND)
FILTER='host.eq:"target.com" and method.eq:"POST"'

# Combine filters (OR)
FILTER='resp.code.eq:401 or resp.code.eq:403'

curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"query { requests(first:100, filter: {httpql: \\\"$FILTER\\\"}) { edges { node { id method host path response { statusCode } } } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.requests.edges[].node'
```

### Get raw request + response by ID
```bash
REQUEST_ID="abc123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"query { request(id: \\\"$REQUEST_ID\\\") { id method host path port isTls raw response { statusCode length raw roundtripTime } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.request'
```

Note: `raw` field is base64-encoded. Decode with:
```bash
... | jq -r '.data.request.raw' | base64 -d
```

### Query requests with offset pagination (for large sets)
```bash
# count returns { value, snapshot } — use count { value } not count directly
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requestsByOffset(limit: 100, offset: 0, filter: {httpql: \"host.eq:target.com\"}) { edges { node { id method path response { statusCode length } } } count { value } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.requestsByOffset'
```

---

## Intercept — Pause and Modify Traffic in Real Time

### Check intercept status
```bash
# interceptStatus is a scalar enum (RUNNING | PAUSED) — no subfields
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { interceptStatus interceptOptions { request { enabled } response { enabled } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data'
```

### Enable intercept (resume capturing)
```bash
# pauseIntercept / resumeIntercept return { status } — status is a scalar enum
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { resumeIntercept { status } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.resumeIntercept'
```

### Configure intercept options (which traffic to intercept)
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation SetOpts($input: InterceptOptionsInput!) { setInterceptOptions(input: $input) { options { request { enabled } response { enabled } } } }",
    "variables": {
      "input": {
        "request": {"enabled": true},
        "response": {"enabled": false},
        "streamWs": {"enabled": false}
      }
    }
  }' \
  http://127.0.0.1:48080/graphql | jq '.data.setInterceptOptions'
```

### List pending intercepted messages
```bash
# interceptMessages requires kind argument: REQUEST | RESPONSE | STREAM_WS
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { interceptMessages(first: 10, kind: REQUEST) { edges { node { id ... on InterceptRequestMessage { request { id method host path } } } } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.interceptMessages'
```

### Forward an intercepted message (let it pass through)
```bash
MSG_ID="msg123"
# Use inline fragments for union return type
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation ForwardMsg(\$id: ID!, \$input: ForwardInterceptMessageInput!) { forwardInterceptMessage(id: \$id, input: \$input) { ... on ForwardInterceptMessageSuccess { deletedId } ... on Error { code message } } }\",
    \"variables\": {\"id\": \"$MSG_ID\", \"input\": {}}
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.forwardInterceptMessage'
```

### Forward with modified request (edit before forwarding)
```bash
MSG_ID="msg123"
# Encode modified raw HTTP request
MODIFIED_RAW=$(printf 'GET /api/admin HTTP/1.1\r\nHost: target.com\r\nAuthorization: Bearer INJECTED\r\n\r\n' | base64 -w0)
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation ForwardMsg(\$id: ID!, \$input: ForwardInterceptMessageInput!) { forwardInterceptMessage(id: \$id, input: \$input) { ... on ForwardInterceptMessageSuccess { deletedId } ... on Error { code message } } }\",
    \"variables\": {\"id\": \"$MSG_ID\", \"input\": {\"request\": {\"updateRaw\": \"$MODIFIED_RAW\", \"updateContentLength\": true}}}
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.forwardInterceptMessage'
```

### Drop an intercepted message (block it)
```bash
MSG_ID="msg123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation DropMsg(\$id: ID!) { dropInterceptMessage(id: \$id) { ... on DropInterceptMessageSuccess { deletedId } ... on Error { code message } } }\",
    \"variables\": {\"id\": \"$MSG_ID\"}
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.dropInterceptMessage'
```

### Pause intercept (stop capturing)
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { pauseIntercept { status } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.pauseIntercept'
```

---

## Replay — Send Modified Requests

Replay sends a single raw HTTP request to a target. Two steps: create session → start replay task.

### Step 1 — Create a Replay Session (from existing request ID)
```bash
REQUEST_ID="abc123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation { createReplaySession(input: { requestSource: { id: \\\"$REQUEST_ID\\\" } }) { session { id name } } }\"
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.createReplaySession.session'
# Save: SESSION_ID="..."
```

### Step 2 — Start Replay Task (send the request)
The `raw` field is the full HTTP request as a base64-encoded string.

```bash
# Encode the raw request
RAW_REQUEST=$(printf 'GET /api/v1/admin HTTP/1.1\r\nHost: target.com\r\nAuthorization: Bearer STOLEN_TOKEN\r\nUser-Agent: Mozilla/5.0\r\n\r\n' | base64 -w0)

SESSION_ID="session123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation StartReplay(\$sessionId: ID!, \$input: StartReplayTaskInput!) { startReplayTask(sessionId: \$sessionId, input: \$input) { task { id } } }\",
    \"variables\": {
      \"sessionId\": \"$SESSION_ID\",
      \"input\": {
        \"connection\": {
          \"host\": \"target.com\",
          \"port\": 443,
          \"isTLS\": true
        },
        \"raw\": \"$RAW_REQUEST\",
        \"settings\": {
          \"connectionClose\": false,
          \"updateContentLength\": true,
          \"placeholders\": []
        }
      }
    }
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.startReplayTask'
```

### List all Replay Sessions
```bash
# ReplayEntry does not have a response field directly — use request { response }
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { replaySessions(first: 20) { edges { node { id name activeEntry { id request { id method host path response { statusCode length } } } } } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.replaySessions.edges[].node'
```

### Get Replay Session with all entries
```bash
SESSION_ID="session123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"query { replaySession(id: \\\"$SESSION_ID\\\") { id name entries { edges { node { id request { raw } response { statusCode raw } } } } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.replaySession'
```

---

## Automate — Fuzzing / Intruder

Automate injects payloads at byte-offset positions in a raw HTTP request.
Three steps: create session → update with raw request + settings → start task.

### Step 1 — Create Automate Session
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createAutomateSession(input: {}) { session { id name } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.createAutomateSession.session'
# Save: AUTO_SESSION_ID="..."
```

### Step 2 — Configure Session (raw request + payload settings)

Placeholders are byte offsets `{start, end}` in the raw request where payloads are injected.
Find offsets: encode the request, then calculate the byte position of the value to fuzz.

```python
# Helper: find placeholder offsets for a value in a raw HTTP request
raw = b"POST /login HTTP/1.1\r\nHost: target.com\r\nContent-Type: application/json\r\n\r\n{\"password\":\"FUZZ\"}"
start = raw.index(b"FUZZ")
end = start + len(b"FUZZ")
# start=87, end=91 — use these as placeholder {start: 87, end: 91}
import base64
print(base64.b64encode(raw).decode())
```

```bash
# Encode raw request
RAW=$(printf 'POST /login HTTP/1.1\r\nHost: target.com\r\nContent-Type: application/json\r\n\r\n{"username":"admin","password":"FUZZ"}' | base64 -w0)
# Byte offsets: FUZZ is at position 94 (length 4) → start:94, end:98

AUTO_SESSION_ID="auto123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation Update(\$id: ID!, \$input: UpdateAutomateSessionInput!) { updateAutomateSession(id: \$id, input: \$input) { session { id } } }\",
    \"variables\": {
      \"id\": \"$AUTO_SESSION_ID\",
      \"input\": {
        \"connection\": {
          \"host\": \"target.com\",
          \"port\": 443,
          \"isTLS\": true
        },
        \"raw\": \"$RAW\",
        \"settings\": {
          \"closeConnection\": false,
          \"updateContentLength\": true,
          \"strategy\": \"SEQUENTIAL\",
          \"concurrency\": {\"workers\": 10, \"delay\": 0},
          \"redirect\": {\"max\": 3, \"strategy\": \"ALWAYS\"},
          \"retryOnFailure\": {\"maximumRetries\": 0, \"backoff\": 1000},
          \"placeholders\": [{\"start\": 94, \"end\": 98}],
          \"payloads\": [
            {
              \"preprocessors\": [],
              \"options\": {
                \"simpleList\": {
                  \"list\": [\"password\",\"123456\",\"admin\",\"letmein\",\"Password1\",\"qwerty\"]
                }
              }
            }
          ]
        }
      }
    }
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.updateAutomateSession'
```

### Payload Types

```
simpleList   — list of strings:  {"simpleList": {"list": ["val1","val2","val3"]}}
number       — numeric range:    {"number": {"range": {"min":1,"max":100}, "increments":1, "minLength":1}}
hostedFile   — file by ID:       {"hostedFile": {"id": "file_id", "delimiter": "\n"}}
null         — no value (N qty): {"null": {"quantity": 5}}
```

### Payload Strategies
```
SEQUENTIAL  — one payload at a time per placeholder (like Burp Sniper)
PARALLEL    — same index across all placeholders simultaneously (like Burp Pitchfork)
MATRIX      — all combinations (like Burp Cluster Bomb)
ALL         — all payloads to all positions
```

### Payload Preprocessors (optional transforms)
```json
{"preprocessors": [
  {"options": {"urlEncode": {"charset": null, "percentEncode": false}}},
  {"options": {"prefix": {"value": "' OR "}}},
  {"options": {"suffix": {"value": "--"}}}
]}
```

### Step 3 — Start Automate Task
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"mutation { startAutomateTask(automateSessionId: \\\"$AUTO_SESSION_ID\\\") { automateTask { id paused } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.startAutomateTask'
# Save: TASK_ID="..."
```

### Monitor Task Status
```bash
TASK_ID="task123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { automateTasks(first:20) { edges { node { id paused entries { count } } } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.automateTasks.edges[].node'
```

### Pause / Resume / Cancel Automate Task
```bash
# Pause
curl -sL -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"mutation { pauseAutomateTask(id: \\\"$TASK_ID\\\") { automateTask { id paused } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.pauseAutomateTask'

# Resume
curl -sL -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"mutation { resumeAutomateTask(id: \\\"$TASK_ID\\\") { automateTask { id paused } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.resumeAutomateTask'

# Cancel
curl -sL -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"mutation { cancelAutomateTask(id: \\\"$TASK_ID\\\") { cancelledId } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.cancelAutomateTask'
```

### View Automate Results (Entries)
```bash
AUTO_SESSION_ID="auto123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"query { automateSession(id: \\\"$AUTO_SESSION_ID\\\") { entries(first: 100) { edges { node { id error request { id } } } } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.automateSession.entries.edges[].node'
```

---

## Findings — Vulnerability Notes

### Create a Finding (attach to a request)
```bash
REQUEST_ID="req123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation { createFinding(requestId: \\\"$REQUEST_ID\\\", input: { title: \\\"IDOR - User ID Enumeration\\\", reporter: \\\"airecon\\\", description: \\\"GET /api/user?id=X leaks other users data without authorization\\\" }) { finding { id title } } }\"
  }" \
  http://127.0.0.1:48080/graphql | jq '.data.createFinding.finding'
```

### List all Findings
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { findings(first: 50) { edges { node { id title description reporter request { id method host path } } } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.findings.edges[].node'
```

### Export Findings (via list + manual export)
```bash
# exportFindings mutation is not available in this Caido version.
# Instead, list all findings and save to file:
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { findings(first: 200) { edges { node { id title description reporter request { id method host path response { statusCode } } } } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.findings.edges[].node' \
  > output/caido_findings.json
```

---

## Scope — Define Target Scope

### Create a Scope
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { createScope(input: { name: \"Target Scope\", allowlist: [\"target.com\", \"*.target.com\", \"api.target.com\"], denylist: [] }) { scope { id name } } }"
  }' \
  http://127.0.0.1:48080/graphql | jq '.data.createScope.scope'
# Save: SCOPE_ID="..."
```

### List Scopes
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { scopes { id name allowlist denylist } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.scopes'
```

### Filter requests by Scope
```bash
SCOPE_ID="scope123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"query { requests(first: 100, scopeId: \\\"$SCOPE_ID\\\") { edges { node { id method host path response { statusCode } } } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.requests.edges[].node'
```

---

## Sitemap — Browse Discovered Endpoints

### List root sitemap entries
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { sitemapRootEntries { edges { node { id label hasDescendants } } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.sitemapRootEntries.edges[].node'
```

### Get descendants of a sitemap entry
```bash
# depth must be DIRECT (immediate children) or ALL (full subtree)
PARENT_ID="sitemap123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"query { sitemapDescendantEntries(parentId: \\\"$PARENT_ID\\\", depth: DIRECT) { edges { node { id label kind hasDescendants } } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.sitemapDescendantEntries.edges[].node'
```

---

## Projects — Manage Sessions

### List projects
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { projects { id name } currentProject { project { id name } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data'
```

### Switch to a project
```bash
PROJECT_ID="proj123"
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"mutation { selectProject(id: \\\"$PROJECT_ID\\\") { currentProject { project { id name } } } }\"}" \
  http://127.0.0.1:48080/graphql | jq '.data.selectProject'
```

### Create a new project
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createProject(input: { name: \"target_recon\", temporary: false }) { project { id name } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.createProject.project'
```

---

## Tamper Rules — Modify Traffic Automatically

### Create a Tamper Rule Collection
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createTamperRuleCollection(input: { name: \"Auth Header Rules\" }) { collection { id name } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.createTamperRuleCollection.collection'
```

### List Tamper Rule Collections
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { tamperRuleCollections { id name rules { id name enabled } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.tamperRuleCollections'
```

---

## Export Requests to File

### Export all requests for a host to JSON
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requestsByOffset(limit: 500, offset: 0, filter: {httpql: \"host.eq:target.com\"}) { edges { node { id method host path response { statusCode length roundtripTime } createdAt } } count { value } } }"}' \
  http://127.0.0.1:48080/graphql \
  | jq '.data.requestsByOffset.edges[].node' \
  > output/caido_history_target.json

echo "Exported $(jq -s 'length' output/caido_history_target.json) requests"
```

### Find interesting endpoints in history
```bash
# Find 4xx/5xx responses (potential errors worth investigating)
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requestsByOffset(limit: 200, offset: 0, filter: {httpql: \"resp.code.gte:400\"}) { edges { node { id method host path response { statusCode length } } } count { value } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.requestsByOffset.edges[].node'

# Find POST requests (forms, API endpoints)
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requestsByOffset(limit: 200, offset: 0, filter: {httpql: \"method.eq:POST\"}) { edges { node { id method host path response { statusCode } } } count { value } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.requestsByOffset.edges[].node'

# Find unauthenticated API calls
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requestsByOffset(limit: 200, offset: 0, filter: {httpql: \"path.cont:\\\"/api/\\\" and resp.code.eq:200\"}) { edges { node { id method host path response { statusCode length } } } count { value } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.requestsByOffset.edges[].node'
```

---

## Environment Variables (Reusable Values)

### Create an environment for storing tokens/values
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createEnvironment(input: { name: \"target_env\" }) { environment { id name } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.createEnvironment.environment'
```

### List environments and context
```bash
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { environments { id name } environmentContext { environment { id name } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data'
```

---

## Filter Presets — Save Common Filters

```bash
# Create a filter preset for in-scope API calls
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createFilterPreset(input: { name: \"API calls\", clause: \"host.eq:target.com and path.cont:\\\"/api/\\\"\" }) { preset { id name clause } } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.createFilterPreset.preset'

# List presets
curl -sL -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { filterPresets { id name clause } }"}' \
  http://127.0.0.1:48080/graphql | jq '.data.filterPresets'
```

---

## Workflow Integration

USE CAIDO FOR:
  - Intercepting and modifying authenticated API requests on the fly
  - Replaying specific requests with modified parameters or headers
  - Fuzzing a single confirmed injection point (not bulk scanning)
  - Logging all traffic from playwright/browser through the proxy
  - Analyzing response size/timing differences to detect IDORs
  - Creating Findings attached to specific requests for reporting

DO NOT USE CAIDO FOR:
  - Subdomain discovery (use subfinder/amass)
  - Port scanning (use nmap/naabu)
  - Automated vulnerability scanning (use nuclei)
  - Mass fuzzing without a specific hypothesis

TYPICAL PENETRATION TESTING WORKFLOW:
  1. caido-setup → get TOKEN
  2. Set proxy (curl -x or env vars) → browse/spider the target
  3. caido_sitemap (no parent_id) → enumerate discovered hosts → drill into directories
  4. caido_list_requests / requests query → identify interesting endpoints
  5. caido_intercept status → check if RUNNING; use pause/resume/list/forward/drop for live traffic
  6. Pick a target request ID → createReplaySession → startReplayTask (modify and replay)
  7. If injection point found → caido_automate or createAutomateSession → updateAutomateSession → startAutomateTask
  8. createFinding → attach findings to request IDs for report
  9. Export findings

---

## Troubleshooting

Port conflict (48080 in use):
  ss -tlnp | grep 48080

Caido process dead:
  kill -0 $(cat /tmp/airecon_caido.pid) && echo "alive" || echo "dead"
  cat /tmp/caido_startup.log

Re-authenticate (token expired):
  TOKEN=$(curl -sL -X POST \
    -H "Content-Type: application/json" \
    -d '{"query":"mutation { loginAsGuest { token { accessToken } } }"}' \
    http://127.0.0.1:48080/graphql | jq -r '.data.loginAsGuest.token.accessToken')

Debug GraphQL errors:
  ... | jq '.errors'
  # Or check full response:
  ... | jq '.'

Runtime info (version, status):
  curl -sL -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"query":"query { runtime { version platform } }"}' \
    http://127.0.0.1:48080/graphql | jq '.data.runtime'
