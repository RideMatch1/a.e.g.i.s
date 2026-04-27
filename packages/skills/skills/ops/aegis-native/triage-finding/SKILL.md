<!-- aegis-local: AEGIS-native skill, MIT-licensed; operational runbook for triaging an AEGIS finding. -->

---
name: ops-triage-aegis-finding
description: "Operational runbook for triaging an AEGIS finding. Covers severity-priority, evidence verification, false-positive determination, fix-vs-suppress decision-tree, ownership routing, and SLA expectations. Use when receiving a new AEGIS finding (PR comment, JSON output, SARIF in code-scanning), reviewing a backlog of findings, or onboarding a team to AEGIS workflow."
---

# Triage an AEGIS Finding — Operational Runbook

## When to use this skill

- A PR has new AEGIS findings and you need to decide what to fix vs accept vs defer.
- You're reviewing the AEGIS backlog (existing findings on main).
- You're onboarding a new team member to the AEGIS triage workflow.
- An AEGIS finding has been disputed and you need a structured re-triage.

## The triage decision tree

```
For each finding:
  1. Severity check
     ├── BLOCKER  → Stop the line; fix before merge.
     ├── HIGH     → Fix in this sprint; backlog with deadline.
     ├── MEDIUM   → Triage: fix / suppress-with-reason / defer.
     └── LOW      → Triage: fix-when-touching-the-code / suppress-with-reason.

  2. Confidence check
     ├── high     → Trust the finding.
     ├── medium   → Verify before deciding. ~30% FP-rate at this level historically.
     └── low      → Always verify. >50% FP-rate. Many low-confidence findings exist because external tools were missing.

  3. Verification
     - Open the file at the finding's line range
     - Read the code; reproduce the vulnerable shape mentally
     - If you can't reproduce → likely FP, suppress with rationale
     - If you can reproduce → it's a real finding

  4. Decision
     ├── Fix       → Default for BLOCKER + verified-real findings
     ├── Suppress  → Verified FP or compensating control elsewhere
     ├── Defer     → Real but non-blocker, scheduled in backlog with owner + deadline
     └── Dispute   → Open issue requesting scanner-rule refinement
```

## Severity is not optional

AEGIS uses 4 severity levels: BLOCKER / HIGH / MEDIUM / LOW. **BLOCKER and CRITICAL are semantically equivalent**, both forcing the score to 0 / grade F.

Examples:

- BLOCKER — eval injection, hardcoded production secret, unauthed admin route, SQL injection on unscoped query.
- HIGH — missing CSRF on mutation, missing rate-limit on auth endpoint, weak crypto.
- MEDIUM — header missing, unstructured logging, missing pagination.
- LOW — debug artifact, minor doc gap.

If you're triaging a BLOCKER and considering "defer", **stop**. BLOCKERs are by definition not deferrable. Either it's actually a BLOCKER (fix it now) or it's been mis-classified (file a scanner-rule refinement issue).

## Confidence is the FP-rate signal

AEGIS findings carry `confidence: 'high' | 'medium' | 'low'`. The signal:

- **high (default)** — scanner has high confidence based on per-CWE rules. Trust it, fix it.
- **medium** — scanner has reasonable confidence, but the rule's per-CWE FP-rate hasn't been measured at scale. Common for cross-file taint (today). Verify before fixing.
- **low** — scanner ran without one or more external tools (e.g., Semgrep not installed). The finding may be incomplete; the report shows a `[LOW-CONFIDENCE]` PR badge.

Always inspect the finding's source code before suppressing a `medium` or `low` confidence finding.

## How to verify a finding (15-minute drill)

For each finding:

1. **Read the rule.** AEGIS's README scanner inventory tells you what each scanner detects. If the rule description matches the code, it's likely real.
2. **Read the code.** Open the file, read 10 lines above + below the flagged line. Mental model: "could an attacker make this code do something the author didn't intend?".
3. **Trace the data flow.** Where does the vulnerable input come from? Where does it end up (the sink)? Are there sanitizers in between?
4. **Check the per-CWE sanitizer awareness.** AEGIS doesn't false-positive on `parseInt` blocking SQLi, `DOMPurify` blocking XSS, etc. If a sanitizer exists and AEGIS still flags, either the sanitizer doesn't cover this CWE, or there's a real gap.
5. **Reproduce mentally.** Walk through an attacker payload in your head. If you can construct one, fix the code. If you can't, it's likely a FP.

## Fix-vs-suppress decision

**Fix** is the default. Suppress is for these specific cases:

1. **Verified FP** — your verification showed the code is safe; AEGIS over-matched. Suppress with rationale; file a scanner-rule refinement issue.
2. **Compensating control elsewhere** — the code is vulnerable in isolation but safe in context (e.g., a route is auth-bypass-prone in source, but lives behind a proxy that strips auth-bypass headers). Suppress with rationale; document the compensating control's location.
3. **Architectural decision documented as risk-accepted** — the team has decided this risk class is accepted (e.g., "internal admin tool, accept lower auth bar"). Document in a risk register; suppress with reference.

Never suppress to silence noise without one of the above.

## Ownership routing

| Finding category | Default owner |
|---|---|
| Security (BLOCKER + HIGH) | security team |
| Compliance (gdpr-engine, soc2-checker, etc.) | security + compliance |
| Quality (logging-checker, console-checker, http-timeout-checker) | the owning team / module owner |
| i18n | frontend team |
| Dependencies (supply-chain, dep-confusion-checker) | platform / infra team |

Wire ownership in `aegis.config.json`'s notification channels per category, or in your team's CODEOWNERS.

## SLA defaults

The AEGIS-recommended SLA defaults (these are guidelines, not enforced):

| Severity | Time-to-fix |
|---|---|
| BLOCKER | Stop the line — fix before merge OR within 24h on main |
| HIGH | Sprint-level (1-2 weeks) |
| MEDIUM | Backlog — reviewed quarterly |
| LOW | Best-effort; fix when touching the code |

If a BLOCKER must merge for emergency reasons (e.g., the BLOCKER itself is blocking a more urgent fix), document the temporary acceptance + owner + deadline; bypass is possible via `--no-verify` on the pre-push hook (pair with explicit team Slack post).

## How to record triage decisions

For findings that are accepted (suppressed or deferred), record the decision in a way the next person can audit:

```typescript
// Inline suppression
// aegis-disable: <scanner-name> — <one-line rationale + date + owner>
const code = doSomething();

// Or in aegis.config.json:
{
  "suppressions": [
    {
      "scanner": "ssrf-checker",
      "file": "lib/internal-fetch.ts",
      "line": 42,
      "rationale": "Internal fetch wrapper; URL validated against tenant-allowlist by line 38. Reviewed by sec-team 2026-04-22.",
      "owner": "sec-team",
      "added": "2026-04-22"
    }
  ]
}
```

The `aegis history . --blame` command exposes which suppressions are stale (older than N days, owner left team, etc.).

## See also

- `ops-suppress-correctly` skill — when and how to suppress, with the suppression-template.
- `ops-escalation-runbook` skill — what to do when a BLOCKER reaches main without proper triage.
- AEGIS suppressions docs — `docs/suppressions.md`.
- AEGIS confidence-rules — `README.md` § "Scoring" + per-scanner README sections.
