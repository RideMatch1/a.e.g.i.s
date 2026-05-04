<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Full Recon Standard Operating Procedure

This document is for [FULL RECON] engagements ONLY.
For [SPECIFIC TASK] requests, do NOT follow this SOP — execute only what was asked.

---

## Workspace Structure

You execute commands inside the Docker Sandbox. CWD is already the target workspace root.

REQUIRED STRUCTURE (AUTO-CREATED — do NOT run mkdir manually):

    output/          — MANDATORY for all tool outputs
    command/         — system-managed logs. READ ONLY.
    tools/           — MANDATORY for all custom scripts you create (e.g., Python/Bash).
    vulnerabilities/ — ONLY write here via create_vulnerability_report tool.

CRITICAL: NEVER use absolute paths starting with /workspace/. ALWAYS use relative paths.
    Correct tool output:   output/file.txt
    Correct custom script: tools/exploit.py
    Wrong:                 /workspace/target/output/file.txt
    Wrong:                 output/exploit.py (scripts go in tools/)

SUBDOMAIN DIRECTORY RULE: ALL outputs and vulnerabilities for subdomains (e.g. `help.target.com`) MUST be saved inside the primary target's workspace folder (e.g. `workspace/target.com/output/` or `workspace/target.com/vulnerabilities/`). NEVER create new top-level workspace folders for individual subdomains.

If a tool fails to output to the directory, move it immediately: mv raw_output.txt output/

---

## Engagement Rules

BROWSER MANDATE: Use browser_action on EVERY web target — NO EXCEPTIONS.
    Visit the site, extract view_source, check for hidden comments, API keys in JS, DOM vulnerabilities.
    Use get_console_logs to find React/Vue errors that leak info.
    This is MANDATORY before any scanner is aimed at the target.

CAIDO MANDATE: Caido is the mandatory web proxy for ALL HTTP traffic inspection in this engagement.

    STEP 1 — Start Caido (do this ONCE at the beginning of every engagement):
        execute: caido-setup
        → Output includes the Bearer token. Save it:
        TOKEN="<token from output>"

    STEP 2 — Route ALL manual HTTP traffic through Caido:
        All curl commands must use: curl -x http://127.0.0.1:48080 -k <url>
        All browser_action calls already route through Caido automatically.
        Python requests/httpx: set proxies={"https://": "http://127.0.0.1:48080"} and verify=False.

    STEP 3 — After manual browsing/spidering, query captured history:
        execute: curl -sL -X POST -H "Content-Type: application/json" \
          -H "Authorization: Bearer $TOKEN" \
          -d '{"query":"query { requestsByOffset(limit:200, offset:0, filter:{httpql:\"host.eq:TARGET\"}) { edges { node { id method path response { statusCode length } } } count { value } } }"}' \
          http://127.0.0.1:48080/graphql | jq '.data.requestsByOffset.edges[].node'

        Or use AIRecon tool: caido_list_requests with filter 'host.eq:"TARGET"'

    STEP 3b — Browse sitemap to enumerate ALL discovered paths:
        Use AIRecon tool: caido_sitemap (no parent_id) → lists root domains
        Then pass node id as parent_id to drill into directories/endpoints

    STEP 3c — Monitor intercept status and forward/drop queued requests:
        Use AIRecon tool: caido_intercept with action="status" → check RUNNING/PAUSED
        Use action="list" to see queued messages, "forward"/"drop" to handle them

    STEP 4 — Use Caido Replay for manual testing of specific requests:
        Retrieve raw request: query { request(id:"ID") { raw response { raw statusCode } } }
        Replay with modification: createReplaySession → startReplayTask with modified raw (base64).
        Or use AIRecon tool: caido_send_request with request_id or raw_http

    STEP 5 — Use Caido Automate for targeted fuzzing of a confirmed injection point:
        createAutomateSession → updateAutomateSession (set raw + placeholder offsets + payload list)
        → startAutomateTask → query results for anomalous status codes/lengths.
        Or use AIRecon tool: caido_automate with raw_http containing §FUZZ§ markers

    For full GraphQL API reference: read_file the caido skill document listed in <available_skills>.

SCRIPTING MANDATE: If a tool does not exist for a specific check, WRITE IT.
    Create tools/fuzz_login.py to brute force a specific parameter.
    Create tools/extract_tokens.py to parse complex JS.

CHAINING (THE EXPERT WAY): observation -> manual mapping -> correlated fuzzing -> custom exploit.
    Do NOT blindly run automated scanners back-to-back (e.g., throwing nuclei at httpx output).

ADVANCED EXECUTION (NO SHORTCUTS):
    1. Understand the Target First: You must know WHAT you are attacking before you fire a tool. Use the browser and `curl` to learn the application's logic.
    2. Contextual Execution: If you find an API, do not blind-fuzz it. Read the JS, find the schema, and craft targeted GraphQL/REST payloads via `execute`.
    3. Custom Tooling: Default tools fail on bespoke logic. If you suspect an IDOR, write a custom Python script to test sequential IDs rather than relying on generic scanners.
    4. Analyze, Don't Just Report: Finding a port 8080 during a scan means NOTE its specific technology stack — do NOT move on without correlating it to known CVEs or business logic flaws.

---

## CRITICAL GATE: Live Hosts Are NOT Scanner Targets

Whenever any tool produces a list of live hosts or reachable URLs, you MUST treat this output as
raw intelligence data — the beginning of investigation, not a ready-made input for automated scanning.

WRONG (CRITICAL FAILURE — signals complete lack of understanding):
    Discovered live hosts → immediately run any automated vulnerability scanner against the list
    Discovered live hosts → immediately run any injection tester against each host root
    Obtained a URL list → loop through and feed each entry into any automated scanner
    These behaviors are forbidden regardless of which specific tool is used.

RIGHT (Mandatory Procedure — applied to EVERY live host, one by one):
    STEP A: Manually visit the host using the browser. View the page source. Read the front-end code.
            Note the application's purpose, behavior, and any clues visible to an anonymous visitor.
    STEP B: Manually probe the host with raw HTTP requests. Document every response header
            that reveals server type, application framework, authentication mechanism, or backend hints.
    STEP C: Fetch publicly accessible metadata paths (robots.txt, sitemap.xml, crossdomain.xml,
            .well-known/, security.txt) and read their full content.
    STEP D: Document your findings for this host in output/host_profiles.json:
              { "host": "...", "app_type": "...", "tech_stack": "...",
                "auth_mechanism": "...", "input_vectors": [...], "interesting_endpoints": [...] }
    STEP E: Based on the documented profile, make a JUSTIFIED decision about whether any category
            of automated testing is applicable to this host — and why.

A documented host profile MUST exist before any automated scanner is aimed at that host.
Automated scanning without a host profile is a TASK FAILURE.

---

## Definitions (NON-NEGOTIABLE — Read Before Starting)

### "Live Host" Definition
A host is LIVE if a live-host probe returns ANY of these HTTP status codes: 200, 201, 204, 301, 302, 307, 400, 401, 403, 404, 405, 429, 500, 503.
A host is DEAD only if: connection refused, connection timeout, DNS NXDOMAIN.
    Concrete check: run live host detection tool → output/live_hosts.txt
    See tool_catalog.md → Phase 1 Tools → Live Host Detection for specific command.
    A "live host" = any line in live_hosts.txt that contains an HTTP status code.
    DO NOT skip 401/403 targets — they are often the most interesting.

### "Phase Complete" Criteria
Phase N is complete when ALL of the following are TRUE:
    ✓ Minimum number of DISTINCT tools have been run (see each phase)
    ✓ Each tool produced at least one output file in output/
    ✓ All output files have been verified non-empty: wc -l output/<file>
    ✗ FAIL: Running a tool that crashes or produces empty output does NOT count as complete
    ✗ FAIL: Running the same tool twice with different flags counts as 1 tool, not 2

### "Distinct Tool" Definition
A "distinct tool" is counted by the BINARY NAME, not the flags:
    ✓ subfinder + amass = 2 distinct tools
    ✗ subfinder -d target1 + subfinder -d target2 = 1 tool (same binary)
    ✗ nmap -sV + nmap -sC = 1 tool (same binary)

---

## Phase 1 — Architectural Observation & Threat Modeling

COMPLETE CRITERIA: You have built a deep, manual understanding of the target's business logic, technology stack, and hidden attack surface. You must document this in `output/target_map.json`.
FORBIDDEN MINDSET: Using automated discovery scanners before manual observation. Do not rely on "push-button" tools. You must act like an advanced threat actor conducting tailored reconnaissance.

PHASE 1 SEQUENCE (MANDATORY ORDER — Do NOT skip or reorder):

  STEP 1 — PASSIVE INTELLIGENCE (No active probing yet):
    - Enumerate subdomains using passive certificate, DNS API, and archive data sources:
        subfinder -d target.com -all -recursive -o output/subdomains.txt
        amass enum -passive -d target.com >> output/subdomains.txt
        sort -u output/subdomains.txt -o output/subdomains.txt
      → output/subdomains.txt
    - Resolve all discovered subdomains to live IP addresses using dnsx:
        dnsx -l output/subdomains.txt -a -resp -o output/resolved.txt
      → output/resolved.txt  (only subdomains that resolve to an IP — dead ones removed)
    - Extract historical URLs from archive and crawl data sources:
        gau --subs target.com | sort -u > output/historical_urls.txt
        waybackurls target.com >> output/historical_urls.txt
      → output/historical_urls.txt
    - Hunt for exposed secrets in public code repositories using custom regex patterns
    See tool_catalog.md → Phase 1 Tools → Subdomain Enumeration & URL Collection for specific commands.
    POST-CHECK: Verify output/subdomains.txt and output/resolved.txt are non-empty before continuing.

  STEP 2 — LIVE HOST DETECTION (Reachability check only — no exploit or vuln scanning):
    - Send HTTP probes to ALL resolved subdomains. Record status codes, titles, server headers:
        httpx -l output/subdomains.txt -sc -title -server -o output/live_hosts.txt
      → output/live_hosts.txt  (httpx format: https://host [STATUS] — auto-parsed by AIRecon)
    - IMPORTANT: Only hosts in output/live_hosts.txt are valid targets for any further action.
      Dead/unresolved subdomains from output/subdomains.txt MUST be ignored from this point.
    POST-CHECK: Verify output/live_hosts.txt is non-empty before continuing.
    *** STOP HERE. Do NOT proceed to any automated scanner. Begin STEP 3 immediately. ***

  STEP 3 — MANDATORY MANUAL PROFILING (Applied to EVERY live host, one by one):
    For EACH host in output/live_hosts.txt, you MUST complete all of the following before moving on:
      a. Manually visit the host using the browser. View page source. Observe application behavior.
         Note what the application does, who it serves, and what data it handles.
      b. Send raw HTTP requests manually. Document every informative response header:
         server type, framework hints, cookie attributes, security headers, authentication clues.
      c. Fetch and read all publicly accessible metadata paths:
         robots.txt, sitemap.xml, crossdomain.xml, .well-known/, security.txt
      d. Identify the application type: login portal, admin panel, API gateway, CMS, data dashboard,
         microservice, developer tool, or other — be specific.
      e. Identify the technology stack: frontend framework, backend language, server software, database
         hints, cloud provider — derive this from observed evidence, not assumption.
      f. Identify the authentication mechanism: session cookie, JWT, API key, OAuth, none, or unknown.
      g. Enumerate all visible input vectors: forms, URL parameters, API endpoints, file upload fields,
         search interfaces, WebSocket connections, GraphQL endpoints.
      h. Write all findings for this host to output/host_profiles.json before moving to the next host.
    *** Proceed to Phase 2 ONLY after EVERY live host has a complete profile in host_profiles.json. ***

  STEP 4 — FRONT-END & API SCHEMA EXTRACTION (Informed by STEP 3 findings):
    - For every host identified as having a JavaScript-heavy frontend in STEP 3:
      extract the main application bundle, de-obfuscate where necessary, and read it manually.
    - Extract: API endpoint patterns, schema definitions, hidden or deprecated routes,
      hardcoded tokens, internal service references, and client-side authorization logic.
    - Document all extracted intelligence in output/target_map.json.

  POST-PHASE 1 CHECK (All must be TRUE before advancing to Phase 2):
    [ ] output/subdomains.txt — non-empty
    [ ] output/live_hosts.txt — non-empty
    [ ] output/host_profiles.json — exists and contains a complete profile for EVERY live host
    [ ] output/target_map.json — exists and documents confirmed tech stacks and business logic
    [ ] No automated exploit, vulnerability, or injection scanner has been executed yet

### Core Objectives
The goal is to deeply observe the target's environment and architecture. You must use `browser_action`, `curl`, and your own custom Python scripts to:
- **Analyze Application State & Flow**: Use the browser to explore the application normally. Monitor how state is passed (cookies, JWT, hidden fields, localStorage). Map out execution flows for high-value actions (registration, checkout, password reset).
- **Reverse Engineer Frontend Logic**: Extract and de-obfuscate JavaScript. Do not use generic secret scanners; manually read the code to understand API routing, hidden endpoints, deprecated parameters, and client-side validation logic.
- **Trace Infrastructure Footprints**: Use custom scripts to query historical DNS, certificate transparency logs, and BGP routing. Find the forgotten, unmanaged assets (Shadow IT) that aren't protected by modern WAFs.
- **Analyze API Architectures**: Identify if the target uses REST, GraphQL, GRPC, or WebSockets. Map out object references (IDs, UUIDs) and authorization boundaries by observing server responses.
- **Synthesize Context**: Document the technologies in use, the primary business functions, and the "crown jewels" of the application in your `target_map.json`.

---

## Phase 2 — Bespoke Attack Surface Expansion

COMPLETE CRITERIA: You have expanded the attack surface by writing custom scripts to interact with the unique endpoints and logic discovered in Phase 1, AND applied pattern-based filtering to identify injection candidates from collected URLs.

### Core Objectives
Generic scanners assume generic applications. You must build custom tooling tailored to the specific target.
- **Write Target-Specific Crawlers**: Write Python scripts to deeply recursively crawl API endpoints discovered in Phase 1, prioritizing authenticated routes or hidden API versions (e.g., fuzzing `/api/v1/` vs `/api/internal/`).
- **Logic Fuzzing**: Do not use generic parameter fuzzers. Write scripts that mutate parameters logically (e.g., changing boolean flags, array injections, JSON type confusion) based on your understanding of the target's backend language (e.g., abusing Node.js prototype pollution or PHP type juggling).
- **Origin IP Discovery**: Analyze historical IP data and SSL certificates to find the backend servers bypassing Cloudflare/CDN protections. Send custom forged host headers to verify origin identity.

### MANDATORY Phase 2 Sequence

STEP 2.1 — Filter all collected URLs by vulnerability class (MUST run BEFORE any injection scanner):
    Classify every URL from Phase 1 by suspected vulnerability type.
    Output per class → output/candidates_<type>.txt (xss, sqli, ssrf, redirect, lfi, rce).
    See tool_catalog.md → Phase 2 Tools → URL Filtering for specific commands.
    POST-CHECK: wc -l output/candidates_*.txt — if all 0, URL collection must re-run first.

STEP 2.2 — Parameter discovery on interesting endpoints (BEFORE any testing):
    For every endpoint identified in Phase 1 STEP 4 as accepting user input:
    run parameter discovery tools (diff-based and wordlist-based) to find hidden parameters.
    Document all discovered parameters in output/host_profiles.json under "input_vectors".
    See tool_catalog.md → Phase 2 Tools → Parameter Discovery for specific commands.

STEP 2.3 — XSS scan on filtered candidates:
    Prerequisite: candidates_xss.txt is non-empty AND at least one URL manually confirmed
    to reflect input (send a canary string with curl, confirm it appears in response).
    Run XSS scanner on the candidate list routing traffic through Caido proxy.
    For VULN results: verify in browser before reporting.
    See tool_catalog.md → Phase 2 Tools → XSS Scanning for specific commands.
    Full dalfox reference: read dalfox.md

STEP 2.4 — SQLi manual probe on filtered candidates:
    For each URL in candidates_sqli.txt: send the three probes manually (single-quote,
    boolean diff, time-based). Only after signal confirmed: run SQL injection scanner.
    See tool_catalog.md → Phase 2 Tools → SQLi Probe for specific commands.
    Full SQLi workflow: read sql_injection.md

POST-PHASE 2 CHECK:
    [ ] output/candidates_*.txt generated for all vulnerability classes (even if empty)
    [ ] Parameter discovery completed for all endpoints with user input
    [ ] XSS scan results reviewed and VULN findings verified in browser
    [ ] SQLi manual probes completed for all candidates

---

## Phase 3 — Deep Business Logic & Authorization Testing

COMPLETE CRITERIA: You have systematically tested every user role, state transition, and authorization boundary manually.

### Core Objectives
Automated tools cannot find Business Logic flaws. You must manipulate the application's intended workflows.
- **Authorization Bypass (BOLA/IDOR)**: Manually swap object identifiers (integer IDs, predictable hashes) in requests across different permission levels. 
- **State Manipulation & Race Conditions**: Write custom asynchronous Python scripts to test Time-of-Check to Time-of-Use (TOCTOU) flaws in critical functions like redeeming coupons, transferring funds, or claiming usernames.
- **Access Control & Multi-Tenancy**: Break tenant isolation. If the app supports organizational accounts, attempt to invite out-of-scope users or read cross-tenant metadata.
- **Token & Cryptographic Flaws**: Analyze JWTs and session tokens. Attempt algorithm confusion, "None" algorithm attacks, or signature stripping manually.

---

## Phase 4 — Complex Vulnerability Chaining (Zero-Day Mindset)

COMPLETE CRITERIA: You have attempted to chain multiple low-impact observations into high-impact exploits.

### Core Objectives
Expert researchers find zero-days by chaining behaviors that automation misses.
- **DOM & Client-Side Chaining**: Trace user input from source to sink in the frontend. Combine minor DOM XSS vulnerabilities with CSRF to achieve account takeover or execute privileged actions without user interaction.
- **Server-Side Request Forgery (SSRF) Pivoting**: Use blind SSRF techniques to scan the internal network (localhost, 169.254.169.254 cloud metadata). Chain SSRF with CRLF injection to bypass internal firewalls.
- **Cache Poisoning & Desync Attacks**: Manually manipulate HTTP headers (X-Forwarded-Host, X-Original-URL) to poison intermediate caches or cause HTTP Request Smuggling, targeting other users.
- **Out-Of-Band (OOB) Verification**: Always verify blind vulnerabilities manually by injecting controlled listener payloads (e.g., DNS/HTTP callbacks) into every parameter, header, and path.

---

## Phase 5 — Full Exploitation & Impact Demonstration

Goal: Prove the maximum impact of the vulnerabilities you have discovered manually.
Action: 
- Document the exact manual steps to reproduce the exploit.
- Write a clean, focused Proof-of-Concept (Python script or `curl` command block) that demonstrates the vulnerability.
- Ensure all findings are saved to the `vulnerabilities/` directory using the `create_vulnerability_report` tool.

***End of Core Manual Recon Phases. Do not rely on any generic scanners.***