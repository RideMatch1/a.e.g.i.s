<!-- aegis-local: AEGIS-native skill, MIT-licensed; cross-walks AEGIS scanner findings to MITRE ATT&CK Enterprise v15 (latest stable as of 2026-04-27). -->

---
name: mitre-mapping-overview
description: "Top-level cross-walk between AEGIS scanner findings and MITRE ATT&CK Enterprise v15 techniques. Provides the per-finding-CWE → ATT&CK-technique mapping with rationale, plus per-tactic coverage summary. Use when integrating AEGIS findings into a MITRE-aligned threat-model, mapping AEGIS reports to D3FEND defensive countermeasures, building executive risk reports framed in MITRE language, or aligning AEGIS coverage with NIST CSF 2.0 / NIST AI RMF tagged controls."
---

# MITRE ATT&CK Mapping — AEGIS Scanner Findings

## Why this matters

Many security teams operate in MITRE-language. AEGIS findings are CWE-tagged; this skill translates them into ATT&CK techniques so AEGIS reports can be consumed alongside SIEM / EDR / IR-tool reports without manual re-mapping.

**Mapping target:** MITRE ATT&CK Enterprise v15 (https://attack.mitre.org/).
**Companion frameworks:** MITRE D3FEND v1.0 (defensive countermeasures), NIST CSF 2.0, NIST AI RMF.

## Coverage summary by tactic

ATT&CK has 14 tactics (TA0001..TA0040). AEGIS findings concentrate on a subset:

| Tactic | ATT&CK ID | AEGIS coverage strength |
|---|---|---|
| Initial Access | TA0001 | High — SQLi/XSS/SSRF/RCE/auth-bypass |
| Execution | TA0002 | Medium — eval injection, prompt injection, command injection |
| Persistence | TA0003 | Low — most persistence is post-RCE; AEGIS's mass-assignment + auth findings prevent the entry point |
| Privilege Escalation | TA0004 | Medium — RLS bypass, JWT misuse, role-escalation patterns |
| Defense Evasion | TA0005 | Low — out of scope for static analysis |
| Credential Access | TA0006 | High — entropy-scanner, jwt-detector, next-public-leak, crypto-auditor |
| Discovery | TA0007 | Low — defensive scanner |
| Lateral Movement | TA0008 | Out of scope — runtime-only |
| Collection | TA0009 | Low — sensitive-data flagging via PII patterns |
| Command and Control | TA0011 | Out of scope — runtime-only |
| Exfiltration | TA0010 | Medium — SSRF, server-component data leak (CWE-200) |
| Impact | TA0040 | Low — DoS findings (CWE-770, CWE-1333) |

Out-of-scope tactics are intentionally not covered — AEGIS is a SAST + light DAST tool, not an EDR.

## Per-CWE → ATT&CK mapping

The complete mapping lives in the AEGIS scanner inventory; the high-leverage entries are:

| AEGIS scanner | CWE | ATT&CK technique | ATT&CK ID |
|---|---|---|---|
| `taint-analyzer` (SQLi) | CWE-89 | Exploit Public-Facing Application | T1190 |
| `template-sql-checker` | CWE-89 | Exploit Public-Facing Application | T1190 |
| `sql-concat-checker` | CWE-89 | Exploit Public-Facing Application | T1190 |
| `xss-checker` | CWE-79 | Drive-by Compromise (when stored XSS used as initial access) | T1189 |
| `ssrf-checker` | CWE-918 | Cloud Metadata Discovery / Internal Service Discovery | T1552.005 / T1538 |
| `path-traversal-checker` | CWE-22 | Exploit Public-Facing Application | T1190 |
| `crypto-auditor` (eval injection) | CWE-94 | Command and Scripting Interpreter | T1059 |
| `prompt-injection-checker` | CWE-77, CWE-1426 | Direct/Indirect Prompt Injection (ATLAS) | AML.T0051.000 / AML.T0051.001 |
| `auth-enforcer` | CWE-285, CWE-306 | Valid Accounts | T1078 |
| `middleware-auth-checker` | CWE-285 | Valid Accounts | T1078 |
| `jwt-checker` | CWE-327, CWE-345 | Forge Web Credentials (Web Cookies / SAML / Tokens) | T1606 |
| `jwt-detector` | CWE-798 | Valid Accounts (cloud accounts) | T1078.004 |
| `next-public-leak` | CWE-200, CWE-798 | Unsecured Credentials (Credentials in Files) | T1552.001 |
| `entropy-scanner` | CWE-798 | Unsecured Credentials | T1552 |
| `tenant-isolation-checker` | CWE-639 | Authorization Bypass / IDOR | T1565 (Data Manipulation) when used for cross-tenant write; T1530 (Data from Cloud Storage) for read |
| `rls-bypass-checker` | CWE-863 | Authorization Bypass | T1078 (Valid Accounts) when service_role escalates |
| `rsc-data-checker` | CWE-200 | Sensitive Data Discovery / Exfiltration Over Web Service | T1530 / T1567 |
| `mass-assignment-checker` | CWE-915 | Modify Authentication Process | T1556 |
| `open-redirect-checker` | CWE-601 | Spearphishing Link | T1566.002 |
| `cors-checker` | CWE-346 | Cross-Origin / Browser Session Hijack | T1539 |
| `csrf-checker` | CWE-352 | Drive-by Compromise (CSRF as initial access) | T1189 |
| `header-checker` | CWE-693 | Generic — defense-in-depth, maps to D3FEND DOM-ALL |
| `cookie-checker` | CWE-614, CWE-1004 | Steal Web Session Cookie | T1539 |
| `timing-safe-checker` | CWE-208 | Brute Force | T1110 |
| `upload-validator` | CWE-434 | Exploitation for Privilege Escalation (file upload to RCE) | T1068 |

## ATLAS — AI/ML threat model overlay

For AI/LLM-touching findings, AEGIS also maps to MITRE ATLAS (Adversarial Threat Landscape for AI Systems):

| AEGIS scanner | ATLAS technique | ATLAS ID |
|---|---|---|
| `prompt-injection-checker` (direct) | LLM Prompt Injection: Direct | AML.T0051.000 |
| `prompt-injection-checker` (indirect) | LLM Prompt Injection: Indirect | AML.T0051.001 |
| `prompt-injection-checker` (system prompt extraction) | Retrieve Sensitive ML Capabilities | AML.T0019 |

ATLAS is the AI-specific companion to ATT&CK. For LLM apps, both maps are relevant simultaneously.

## D3FEND — defensive countermeasure mapping

D3FEND is MITRE's defensive countermeasure ontology. AEGIS findings naturally map to D3FEND techniques the scanner is enforcing:

| AEGIS scanner | D3FEND technique | What the scanner enforces |
|---|---|---|
| `ssrf-checker` | Outbound Traffic Filtering | D3-OTF |
| `crypto-auditor` | Strong Password Policy / Cryptographic Authentication | D3-SPP / D3-CA |
| `csrf-checker` | Authentication Cache Invalidation / Session Token | D3-ACI |
| `header-checker` | Domain Account Monitoring (via CSP/HSTS) | D3-DAM |
| `auth-enforcer` | Process Self-Modification Detection | D3-PSMD |
| `tenant-isolation-checker` | Resource Access Pattern Analysis | D3-RAPA |
| `rate-limit-checker` | Inbound Traffic Filtering | D3-ITF |

## NIST CSF 2.0 — high-level alignment

NIST CSF 2.0 organizes around 6 functions: Govern, Identify, Protect, Detect, Respond, Recover. AEGIS contributes primarily to:

- **Identify (ID)** — `supply-chain`, `dep-confusion-checker`, `getAllScanners()` registry, scanner-coverage README all support asset-management + threat-identification.
- **Protect (PR)** — every defensive scanner contributes (auth, crypto, headers, cookies, CSP, CSRF, SSRF, RLS, etc.).
- **Detect (DE)** — `[LOW-CONFIDENCE]` PR badge + per-finding confidence-rules support detection-of-detection-gaps.
- **Respond (RS)** — out of scope (runtime-only).
- **Recover (RC)** — out of scope.
- **Govern (GV)** — the OWASP-APTS conformance posture (`docs/compliance/owasp-apts/`) directly contributes to GV.PO (Policy) and GV.OV (Oversight).

## NIST AI RMF — AI/LLM-specific alignment

For LLM-touching code, AEGIS contributes to NIST AI RMF Map / Measure / Manage functions:

- **Map** — `prompt-injection-checker` identifies AI risk surface.
- **Measure** — confidence-scoring on AI-related findings; FP rate disclosure.
- **Manage** — `aegis fix` provides a remediation workflow for AI-related findings.

## How to use this mapping

1. **For executive reports** — translate each AEGIS finding's CWE to its ATT&CK technique using the per-CWE table; group by tactic for a "what the attacker could do with what we ship" narrative.
2. **For threat models** — overlay AEGIS scanner coverage onto your team's threat model. Gaps in tactics (TA0008 lateral movement, TA0011 C2) need other tools (EDR, SIEM, network).
3. **For compliance crosswalk** — when an auditor asks "what NIST CSF controls does this tool implement?", point to the function-level alignment above.
4. **For SOC integration** — if your SIEM ingests SARIF, the SARIF emitter already includes the CWE; configure the SIEM to tag inbound findings with the corresponding ATT&CK technique using this mapping table.

## See also

- `mitre-t1190-exploit-public-app` skill — deep-dive on T1190 coverage.
- `mitre-t1078-valid-accounts` skill — deep-dive on T1078 coverage.
- AEGIS scanner inventory in `README.md` — authoritative per-scanner CWE list.
- MITRE ATT&CK — https://attack.mitre.org/
- MITRE ATLAS — https://atlas.mitre.org/
- MITRE D3FEND — https://d3fend.mitre.org/
