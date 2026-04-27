<!-- aegis-local: AEGIS-native skill, MIT-licensed; deep-dive on MITRE ATT&CK T1078 (Valid Accounts) coverage in AEGIS. -->

---
name: mitre-t1078-valid-accounts
description: "MITRE ATT&CK T1078 (Valid Accounts) — deep-dive coverage map for AEGIS credential-protection scanner family. T1078 is one of the most consistently top-3 Initial Access techniques (Verizon DBIR multi-year). Covers stolen credentials, weak credentials, default accounts, cloud-IAM credentials, and JWT-format credentials. Use when responding to T1078 alerts, building credential-coverage reports, or determining which AEGIS scanners speak to a specific T1078 sub-technique."
---

# T1078 — Valid Accounts

## Why T1078 matters

ATT&CK technique T1078 captures any compromise where the attacker uses credentials they obtained (stolen, leaked, default, weak). Sub-techniques cover Default (T1078.001), Domain (T1078.002), Local (T1078.003), and Cloud (T1078.004) accounts.

T1078 is consistently top-3 in Verizon DBIR. Credential-leak via source-code is among the most common entry-points; AEGIS's credential-protection scanner family is purpose-built for this.

## AEGIS coverage map — credential-protection scanner family

AEGIS ships four scanners that detect credentials at code-review time, plus the `safeFetch` SSRF defense that protects cloud-metadata-IMDSv2-credential-theft adjacent paths.

### entropy-scanner (CWE-798)

Shannon-entropy-based detection of high-entropy strings in source code. Catches credentials that don't match a known format (e.g., random API tokens, custom secret formats).

- **What it catches:** any string with entropy > threshold (configurable).
- **What it misses:** low-entropy credentials (passwords like `Password123!`), structured credentials that look "normal" (e.g., a UUID-shaped token).
- **Sister scanners:** `gitleaks` (external wrapper) covers known-format credentials; `trufflehog` (external) covers verified-credential validation.

### jwt-detector (CWE-798)

Detects literal JWT tokens (`eyJ...` strings) hardcoded in source. Catches:

- Service-role tokens shipped in source.
- Demo / development tokens accidentally committed.
- Tokens copy-pasted into code as hard-coded auth.

Comment-aware via `stripComments` — excluded from doc strings and inline `// example: eyJ...` comments to avoid false positives on documentation.

### next-public-leak (CWE-200, CWE-798)

Specialty scanner for Next.js — catches:

- Secrets accidentally prefixed `NEXT_PUBLIC_*` (which Next.js bundles into client code).
- Server-only env vars read in `'use client'` files (which leaks the value to the bundle).

This is a Next.js-specific T1078.004 (Cloud Accounts) protection because cloud credentials prefixed `NEXT_PUBLIC_` end up in every browser session of every user.

### crypto-auditor (CWE-326, CWE-327, CWE-338, CWE-798)

Detects:

- Weak hash algorithms (MD5, SHA-1) used for security purposes (not just checksumming).
- Insecure RNG (`Math.random()` for security tokens — biased + predictable).
- Hardcoded secret literals (a separate detection path from entropy-scanner; catches structured-format secrets).
- `eval()` injection (CWE-94, adjacent to T1059 but listed here because crypto-auditor is the scanner).

## T1078 sub-technique coverage

### T1078.001 — Default Accounts

| Vector | AEGIS scanner | Strength |
|---|---|---|
| Default credentials shipped in source | `entropy-scanner`, `crypto-auditor` | medium (depends on default value entropy) |
| Default-admin route without auth gate | `auth-enforcer` (CWE-285, CWE-306) | strict |

### T1078.002 — Domain Accounts

Out of scope for SAST — domain accounts are an Active-Directory-runtime concern.

### T1078.003 — Local Accounts

Partially in scope:

| Vector | AEGIS scanner | Strength |
|---|---|---|
| Hardcoded local-account password in source | `entropy-scanner`, `crypto-auditor` | strict-when-entropy-high |
| Service-role-key (Supabase) in source | `next-public-leak`, `entropy-scanner`, `jwt-detector` | strict (multi-layer) |

### T1078.004 — Cloud Accounts

Highest-leverage AEGIS coverage:

| Vector | AEGIS scanner | Strength |
|---|---|---|
| AWS access key in source | `entropy-scanner` (AKIA prefix detection) | strict |
| GCP service-account JSON in source | `entropy-scanner`, `gitleaks` (external) | strict |
| Anthropic / OpenAI API keys in source | `entropy-scanner`, `crypto-auditor` | strict |
| Cloud-metadata-IMDS-credential exfil via SSRF | `ssrf-checker` (cloud-metadata IP block-rules) | strict |
| `NEXT_PUBLIC_` cloud-secret leak | `next-public-leak` | strict (Next.js-specific) |

## What T1078 patterns AEGIS does NOT cover

- **Credential stuffing detection** — runtime concern; no SAST coverage.
- **Brute-force detection** — runtime concern (rate-limit-checker covers the *prevention* side: missing rate-limit on auth endpoints).
- **MFA-fatigue / push-bombing** — runtime-only.
- **Compromised-credential-database lookup** — needs a real-time API like HaveIBeenPwned; out of scope for SAST.

For these, integrate AEGIS findings with your SIEM / EDR / IdP.

## Defensive playbook (T1078 prevention)

### Source-code-side (AEGIS does this)

1. Run `aegis scan .` in CI; fix every `entropy-scanner`, `jwt-detector`, `next-public-leak`, `crypto-auditor` BLOCKER finding.
2. Wire `gitleaks` (external wrapper) for known-format-credentials coverage.
3. Wire `trufflehog` (external wrapper) for verified-credential validation.
4. Pin pre-commit hooks (`.husky/pre-push` runs `aegis scan --fail-on-blocker`).

### Operational-side (out of AEGIS scope)

1. Use a secret manager (Vault, 1Password, AWS Secrets Manager). Never `.env` files in production.
2. Rotate credentials on a schedule; rotate immediately on any credential-related finding.
3. Enable MFA on every cloud-IAM root account.
4. Use short-lived credentials (AWS STS, GCP service account impersonation) wherever possible.
5. Audit IAM roles quarterly — least-privilege is a journey, not a one-shot.

### Detection-side (out of AEGIS scope)

1. SIEM rules for impossible-travel logins.
2. EDR rules for service-account login from unexpected sources.
3. Cloud-provider GuardDuty / Security Hub findings for anomalous IAM use.

## Response runbook (post-credential-leak)

1. **Rotate immediately** — every credential pattern AEGIS flags is potentially compromised; assume worst case.
2. **Audit usage logs** — for each rotated credential, pull the access log for the leak window.
3. **Identify reach** — for each authenticated session, what data / actions did it touch?
4. **Notify** — GDPR Art. 33 if PII reached; SEC-rule disclosures if material; vendor contracts if vendor-credentials.
5. **Patch** — remove the credential from source; replace with secret-manager reference.
6. **Post-incident review** — was there a control gap? Should AEGIS scanner sensitivity be tuned? Should pre-commit hooks be tightened?

## See also

- `mitre-mapping-overview` skill — top-level scanner-to-technique mapping.
- `defensive-rls-defense` — Supabase service-role-key safety.
- AEGIS scaffold's `lib/security/secureApiRouteWithTenant` primitive — wires session-sourced authentication automatically.
- MITRE ATT&CK T1078 — https://attack.mitre.org/techniques/T1078/
