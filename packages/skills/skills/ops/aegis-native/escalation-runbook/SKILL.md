<!-- aegis-local: AEGIS-native skill, MIT-licensed; escalation runbook for severe AEGIS findings. -->

---
name: ops-escalation-runbook
description: "Escalation runbook for severe AEGIS findings — what to do when a BLOCKER reaches main, when a finding suggests active exploitation, when a credential leak is detected, or when a suppression has been gamed. Covers immediate-containment steps, internal communication, legal/compliance notification triggers, post-incident review structure, and the AEGIS-specific forensic tooling. Use when responding to a high-severity AEGIS finding outside normal triage."
---

# Escalation Runbook — Severe AEGIS Findings

## When to use this skill

You are escalating one of:

- A BLOCKER finding has reached `main` (failed CI gate, was force-merged, or AEGIS was bypassed).
- A finding suggests active exploitation (credential leak in source, public-key/private-key pair leaked, hardcoded admin password in production code).
- An AEGIS suppression has been gamed (review found a "FP" suppression covering a real vulnerability).
- A new scanner update has produced findings on previously-shipping code (regression in coverage).

## Severity ladders — when to escalate

| Trigger | Escalate to | Within |
|---|---|---|
| BLOCKER on main | sec-team-lead + module owner | 1 hour |
| Credential leaked in source (jwt-detector / entropy-scanner) | sec-team-lead, IT ops, vendor-mgmt (if vendor cred) | 30 min — rotate IMMEDIATELY |
| RLS / tenant-isolation finding suggesting cross-tenant exposure | sec-team-lead, legal, DPO | 1 hour |
| GDPR-engine finding involving production PII handling | sec-team-lead, DPO, legal | 4 hours, GDPR Art. 33 timer starts |
| Multiple new BLOCKERs after a scanner-rule update (regression) | sec-team-lead | 2 hours |
| Suppression-gaming detected during audit | sec-team-lead + module owner + author of suppression | 24 hours |

If you're not sure whether to escalate — escalate. False alarms cost you 30 minutes; missed escalations cost you a breach.

## Immediate-containment playbook (post-finding)

Order matters. Don't skip steps.

### Step 1 — Stop the bleeding

For active-exposure findings:

```
Credential leaked → rotate the credential RIGHT NOW; don't wait to investigate
Auth-bypass on prod → block the affected route at the WAF / load balancer
RLS bypass → disable the affected query at the gateway, NOT in code (deploy lag is a window)
```

The runtime-stop happens BEFORE code-fix because deploys take time and the finding is publicly visible the moment AEGIS surfaces it.

### Step 2 — Assess reach

```bash
# What did this credential / route / query touch in the last N days?
aegis history . --blame --since "30 days ago"

# Forensic logs — pull the affected window
# (project-specific — ingestion logs, audit logs, app logs)
```

Bound the exposure: which users? which data classes? which time range? The answer drives notification scope.

### Step 3 — Patch and verify

1. Code-fix per the appropriate defensive skill (`defensive-rls-defense`, `defensive-tenant-isolation`, `defensive-ssrf`, etc.).
2. Add a regression test that the fix prevents re-exploitation.
3. Re-deploy.
4. Verify the runtime-stop can be lifted (the WAF block / route disable from Step 1).

### Step 4 — Notify

| Trigger | Notification |
|---|---|
| PII exposure | GDPR Art. 33: 72 hours to supervisory authority. CCPA equivalent for CA residents. |
| Cardholder data exposure | PCI-DSS req 12.10 — incident response plan kicks in. |
| Vendor credentials leaked | Notify the vendor immediately — they need to rotate on their side. |
| Material breach | SEC rule 1.05 (4-day disclosure window for material cybersecurity incidents). |
| User credentials leaked | Notify affected users; recommend password change. |

If unsure whether a notification trigger applies, consult legal counsel before notifying. Premature disclosure of an unconfirmed incident has its own risks.

### Step 5 — Post-incident review (within 7 days)

Structure:

1. **Timeline** — when was the vulnerable code introduced (use `git blame`); when was AEGIS run on it; when did AEGIS first flag it; when was it triaged; when was it merged; when was it discovered.
2. **Root cause** — code-level + process-level. "We bypassed the AEGIS gate because we were rushing the release" is a legitimate process root cause.
3. **Impact** — who/what was exposed, for how long.
4. **Action items** — code fix (already done), process fix (e.g., revoke `--no-verify` permission, mandate sec-team review for any AEGIS-bypass), tooling fix (e.g., scanner-rule that would have caught this earlier).

The review document goes to a permanent location (security-incident log) and gets auditor-readable for the next compliance review.

## When AEGIS is the alerting source

AEGIS is a SAST + light DAST tool. It surfaces findings in:

- PR comments (CI integration)
- SARIF (GitHub Code Scanning)
- Terminal / JSON (`aegis scan` direct output)
- MCP server (AI-coding-agent surface)

When a finding ESCALATES to incident-level, AEGIS is the source of the lead, not the source of truth. The source of truth is the runtime evidence:

- Audit logs from the affected service.
- Cloud provider logs (CloudTrail, Cloud Audit Logs, Activity Logs).
- DB query logs.
- WAF / proxy logs.

Cross-reference the AEGIS finding with these to determine whether code-vulnerable + actually-exploited.

## When AEGIS finds a regression in coverage (post-update)

If a scanner-rule update triggers new findings on shipping code, the situation is:

- The shipping code was previously vulnerable.
- AEGIS is now telling you about it.
- The exposure window is everything-since-the-vulnerable-code-shipped, NOT since-the-scanner-update.

Treat as a real finding (not as scanner noise). The right response:

1. Verify (per `ops-triage-aegis-finding`) — false positive, or real?
2. If real, escalate per the severity ladder above.
3. Code-fix.
4. Post-incident review specifically asks: "why did the previous scanner version miss this?" (and: "what other patterns might it still miss?").

## Anti-patterns

### Anti-pattern 1 — "It's been there forever, can't be that bad"

Tenure does not establish safety. SQL injection that's been in the codebase for 4 years is exactly as exploitable as one introduced yesterday — the attacker doesn't care about the tenure.

### Anti-pattern 2 — "Wait for next sprint"

For BLOCKERS and credential leaks, "next sprint" is unacceptable. The exposure is active until you fix it.

### Anti-pattern 3 — Suppress under pressure

A pressured "suppress to ship" decision is exactly when post-incident reviews most often find process root causes. Resist; document; if you must bypass AEGIS, do it explicitly with the sec-team-lead's signature, time-boxed, and post-incident-reviewed.

### Anti-pattern 4 — Silent fix

Fixing a BLOCKER with a one-line PR titled "small fix" hides the incident from future audit. Use a clear PR title (`fix(security): SQL-injection in /api/foo route`); cross-reference the post-incident review document.

## See also

- `ops-triage-aegis-finding` — the upstream triage decision.
- `ops-suppress-correctly` — when suppression is the right call (it isn't, in escalation context).
- `defensive-rls-defense` / `defensive-tenant-isolation` / `defensive-ssrf` — domain-specific patch playbooks.
- AEGIS `SECURITY-INCIDENT-RESPONSE.md` — the project's own incident-response convention.
- GDPR Art. 33 — https://gdpr-info.eu/art-33-gdpr/
