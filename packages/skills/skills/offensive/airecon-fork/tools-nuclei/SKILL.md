<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Nuclei — Usage Guide for AIRecon

Nuclei is a template-based vulnerability scanner. It is powerful ONLY when used with the right
context. Without knowing the target's tech stack and input surface first, nuclei produces noise —
not findings. Treat it as a precision instrument, not a spray can.

---

## DECIDE FIRST: Full Recon vs Specific Task

Read the user's request and apply the correct mode:

  [FULL RECON] — "recon target.com", "full pentest", "bug bounty recon"
    → All 5 pre-conditions below MUST be satisfied before nuclei.
    → Do not shortcut. Gate is strict.

  [SPECIFIC TASK] — "scan this endpoint for CVEs", "check if nginx version X is vulnerable",
                    "test this URL for misconfigs", "I already know it's WordPress 5.9"
    → Use the SPECIFIC TASK FAST PATH below.
    → Skip host_profiles.json requirement if you have gathered equivalent info in this session.

---

## SPECIFIC TASK FAST PATH (for targeted, scoped nuclei use)

When the user gives you a specific host + specific technology or vulnerability class:

  You MAY run nuclei immediately if ALL of these are true:
    [x] You know the exact target URL (not a list of unknowns)
    [x] You know what technology/framework is running (from user, from curl headers, from JS)
    [x] You have a specific template category or CVE ID in mind — NOT the entire template library
    [x] You are NOT doing bulk scanning (no -l with unexamined host lists)

  Example legitimate fast-path use:
    User: "check if login.target.com Grafana is vulnerable to CVE-2021-43798"
    → nuclei -u https://login.target.com -id CVE-2021-43798 -o output/nuclei_grafana_cve.txt
    → No host_profiles.json required. No phase gate. Run immediately.

    User: "I found /actuator/env exposed, check for Spring misconfigs"
    → nuclei -u https://target.com/actuator -t http/misconfiguration/springboot.yaml
    → Fine. You already have the endpoint from manual finding.

  STILL FORBIDDEN even in specific task mode:
    ✗ nuclei -l output/live_hosts.txt -t http/   (bulk + all templates)
    ✗ nuclei -u target.com -t http/              (whole category without justification)
    ✗ nuclei on any URL from crawler output without reading what it does first

---

## MANDATORY PRE-CONDITIONS (Full Recon mode only)

Before nuclei can be used in a FULL RECON engagement, all must be satisfied:

  [ ] The host has been manually visited in the browser — you have seen what the application does.
  [ ] The technology stack is confirmed from observed evidence (response headers, JS, error pages).
  [ ] At least 3 distinct endpoints have been manually probed and their behavior documented.
  [ ] output/host_profiles.json contains a complete profile for this specific host.
  [ ] You have selected a specific template category that matches the CONFIRMED tech stack.

If any condition is unmet: do NOT use nuclei. Continue manual analysis until conditions are met.

USING NUCLEI WITHOUT A HOST PROFILE IN FULL RECON MODE IS A TASK FAILURE.

IF YOU ARE STUCK trying to satisfy these conditions and the user asked for a SPECIFIC TASK (not full recon), re-read "SPECIFIC TASK FAST PATH" above and proceed accordingly.

---

## What Nuclei Is Good At (After Manual Analysis)

Once you understand the target, nuclei excels at:

  - Confirming suspected misconfigurations already identified via manual observation
  - Fingerprinting exact versions of a known framework (use technology templates)
  - Checking for known CVEs in a framework version you have already identified
  - Detecting blind/OOB vulnerabilities (SSRF, RCE) at specific endpoints you have already mapped
  - Testing specific vulnerability classes against endpoints you have manually found and understood

What nuclei is BAD at (and must NOT be used for):
  - Replacing manual application understanding
  - Discovering what an application does (that is browser + curl's job)
  - Bulk-scanning a list of unknown hosts to "see what comes up"

---

## Template Selection — Context Required

Template categories and their mandatory prerequisites:

  TECHNOLOGY FINGERPRINTING (http/technologies/)
    Prerequisite: You suspect a specific framework but need version confirmation.
    Use: After manually identifying the framework from headers or JS.
    Select: Only templates matching the confirmed framework name.

  MISCONFIGURATION DETECTION (http/misconfiguration/)
    Prerequisite: You have observed behavior suggesting a misconfiguration (e.g., directory listing,
    exposed config endpoint, CORS wildcard in response header you read manually).
    Use: To confirm and document a suspected misconfiguration.
    Select: Only templates relevant to the specific misconfiguration type observed.

  CVE SCANNING (http/vulnerabilities/, cves/)
    Prerequisite: You have confirmed the exact software name AND version from real evidence.
    Use: To check if the confirmed version is affected by specific CVEs.
    Select: Only CVE templates for the confirmed software + version. Never run all CVE templates.

  OOB / BLIND DETECTION (tags: oast, ssrf, rce)
    Prerequisite: You have a specific endpoint or parameter that you manually identified as a
    potential blind injection point. You have an active interactsh listener running.
    Use: To confirm blind behavior at a SPECIFIC known endpoint — not across all URLs.
    Select: Only templates matching the injection class you suspect at that specific endpoint.

  DEFAULT CREDENTIALS / LOGIN PANELS (http/default-logins/, tags: panel)
    Prerequisite: You have manually confirmed a login panel exists at a specific path.
    Use: To check for default credentials on that specific panel type (e.g., confirmed Grafana login).
    Select: Only templates for the confirmed panel software.

  DNS / NETWORK / SSL (dns/, network/, ssl/)
    Prerequisite: You have resolved hostnames and understand the infrastructure.
    Use: For domain takeover checks on subdomains showing NXDOMAIN on CNAME targets,
    or TLS misconfiguration checks after port scanning confirms HTTPS services.
    Select: Appropriate category only.

---

## Usage Pattern (After Pre-Conditions Are Met)

The correct pattern is: SPECIFIC TARGET + SPECIFIC TEMPLATES — not lists + all templates.

  Targeting a single confirmed host with confirmed tech:
    nuclei -u <specific_host> -t http/technologies/<confirmed_framework>.yaml

  Targeting a specific endpoint with confirmed vulnerability class:
    nuclei -u <specific_url_with_params> -t http/vulnerabilities/<class>/

  Targeting confirmed CVE on confirmed software version:
    nuclei -u <specific_host> -id <cve-id>

  Authenticated scan on a confirmed authenticated surface:
    nuclei -u <specific_host> -H "Authorization: Bearer <token>" -t http/misconfiguration/

  Stealth mode when target shows rate limiting behavior:
    Add: -rl 5 -c 2 -delay 3

NEVER use these patterns:
  nuclei -l output/live_hosts.txt              (no template filter, no prior analysis)
  nuclei -l output/live_hosts.txt -t http/     (entire category on unknown hosts)
  nuclei -l output/urls_all_deduped.txt        (raw crawler output as scanner input)

---

## Output and Triage

  Write output: -o output/nuclei_<context>.txt  (e.g., nuclei_grafana_cve.txt)
  For JSON output: -json -o output/nuclei_<context>.json

After nuclei completes:
  1. Read every finding manually — do NOT accept nuclei output as confirmed vulnerability.
  2. For every finding marked [medium] or above: manually reproduce it with curl or browser.
  3. Only escalate to create_vulnerability_report after manual verification with working PoC.
  4. Discard informational findings unless they inform a manual attack chain.

A nuclei finding is NOT a vulnerability. It is a signal that requires manual verification.

---

## Workflow Integration (Where Nuclei Fits)

  Phase 1 (Manual Profiling): DO NOT use nuclei.
  Phase 2 (Bespoke Expansion): Nuclei may be used ONLY for fingerprinting confirmed frameworks.
  Phase 3+ (Logic & Auth Testing): Nuclei may support OOB blind detection at specific endpoints.
  Phase 4+ (Vulnerability Chaining): Nuclei may confirm suspected CVEs on confirmed versions.

Nuclei is a supporting instrument for hypotheses formed through manual analysis.
It is never the primary discovery mechanism.
