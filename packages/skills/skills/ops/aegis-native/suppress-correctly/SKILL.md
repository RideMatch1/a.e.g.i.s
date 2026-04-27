<!-- aegis-local: AEGIS-native skill, MIT-licensed; operational runbook for suppressing AEGIS findings correctly. -->

---
name: ops-suppress-correctly
description: "Operational runbook for suppressing AEGIS findings correctly. Covers when suppression is appropriate (verified FP, compensating control, accepted risk), the per-finding suppression syntax, the config-level suppression syntax, common anti-patterns, suppression-decay (review cadence), and the audit trail expectations. Use when adding any suppression, reviewing an existing suppression, or auditing suppressions for staleness."
---

# Suppress Correctly — AEGIS Suppression Runbook

## When to use this skill

- About to add a suppression — understand the policy + format first.
- Reviewing existing suppressions for staleness.
- Auditing suppressions before a security review or compliance audit.
- A scanner-rule update has produced new findings on previously-suppressed code.

## The three legitimate suppression cases

A suppression is appropriate ONLY in these cases. Anything else is gaming the score.

### Case 1 — Verified false positive

The scanner over-matched. Your verification (per `ops-triage-finding`) showed the code is safe. The right next steps:

1. Add the suppression with a one-line rationale.
2. **File a scanner-rule refinement issue** — link it from the rationale. AEGIS improves precision on real-world FPs; the issue is the feedback loop.
3. Optionally add a regression-test fixture that captures this specific FP shape.

```typescript
// aegis-disable: ssrf-checker — URL is hard-coded to api.partner.com after the line-38 allowlist check. Verified safe 2026-04-22, refinement issue #1234.
await fetch(allowlistedUrl);
```

### Case 2 — Compensating control elsewhere

The code is vulnerable in isolation but safe in context. The compensating control lives outside the scanner's view (often runtime: a WAF rule, a proxy header strip, a network-level deny).

```typescript
// aegis-disable: auth-enforcer — endpoint runs behind internal-only ingress (network-level deny on public traffic). Compensating control: ingress.yaml line 47.
export async function GET() {
  /* ... */
}
```

The rationale MUST identify the compensating control's location precisely. "We have a firewall" is not enough; "ingress.yaml line 47" is.

### Case 3 — Accepted risk (risk-register documented)

The team has formally accepted this risk class. There's a risk register entry (in your tracking system, ideally). The suppression references the entry.

```typescript
// aegis-disable: rate-limit-checker — accepted risk per risk-register entry RR-2026-Q2-04 (internal admin tool, low traffic, MFA-required). Owner: sec-team. Review: 2026-Q3.
```

The risk-register entry must include: risk description, accepting authority (CISO / sec-team-lead), review date, compensating controls.

## Anti-patterns

### Anti-pattern 1 — Naked suppression

```typescript
// aegis-disable: ssrf-checker
await fetch(userInput);
```

Why it's wrong: no rationale. The next reviewer can't tell whether this is a real FP, a compensating control, or just noise-silencing. Fail.

### Anti-pattern 2 — Vague rationale

```typescript
// aegis-disable: ssrf-checker — safe
await fetch(userInput);
```

Why it's wrong: "safe" is an assertion without justification. The reviewer needs to know WHY it's safe.

### Anti-pattern 3 — Wholesale-disable a scanner

```json
// aegis.config.json
{
  "scanners": {
    "ssrf-checker": false
  }
}
```

Why it's wrong: turns off the scanner globally. One real bug in 10K lines and you've exposed the entire codebase. Always suppress per-finding, not per-scanner.

### Anti-pattern 4 — Suppress to ship

If a BLOCKER finding is the only thing blocking a release and the team's response is "suppress it", you're not triaging — you're hiding a real exposure under a permanent rug. The right move: fix the BLOCKER. If you genuinely cannot, file an emergency risk-register entry with the CISO's signature and a 7-day-fix deadline.

### Anti-pattern 5 — Long-lived TODO suppressions

```typescript
// aegis-disable: xss-checker — TODO fix after refactor
```

If the suppression has a "TODO" the rationale already concedes the code is wrong. The "TODO" rots over years. Do not. Either fix it now, or risk-register-accept it formally.

## Suppression syntax

### Inline (single finding at a specific line)

```typescript
// aegis-disable: <scanner-name> — <rationale + date + owner>
<the line being suppressed>
```

The directive applies to the next non-comment line. Place it directly above the offending code. If the scanner emits at a multi-line statement, the directive on the first line covers the whole statement.

### Config-level (persistent suppressions across scans)

```json
{
  "suppressions": [
    {
      "scanner": "ssrf-checker",
      "file": "lib/internal-fetch.ts",
      "line": 42,
      "rationale": "<rationale + date + owner>",
      "owner": "sec-team",
      "added": "2026-04-22",
      "review_by": "2026-10-22"
    }
  ]
}
```

Use config-level when:

- The finding emits at multiple lines (file-level suppression cleaner than 5 inline directives).
- The file is auto-generated (you can't add inline comments without breaking the generator).
- You need centralized auditability (the config is one diff to review, not 20 inline diffs).

### Pattern-level (suppress a class of findings across many files)

Avoid this except for canonical platform-wide compensating controls. If you must:

```json
{
  "suppressions": [
    {
      "scanner": "header-checker",
      "filePattern": "**/*.test.ts",
      "rationale": "Test files do not serve HTTP — header-checker N/A. Reviewed 2026-04-22 by sec-team."
    }
  ]
}
```

The `filePattern` field uses glob syntax. Be conservative; pattern-suppressions hide whole classes of findings.

## Review cadence — suppressions decay

Every suppression has an implicit "decay date" — code changes, the surrounding context shifts, the compensating control gets removed. AEGIS supports a `review_by` field; suppressions past their `review_by` get a `[STALE]` flag in the report.

Recommended cadence:

- **Inline suppressions** — review at the next major refactor of the affected file.
- **Config-level suppressions** — review every 6 months minimum.
- **Pattern-level suppressions** — review every 3 months.

`aegis history . --blame --suppressions` enumerates all suppressions with age + last-reviewed date.

## Audit trail expectations

Every suppression should answer 5 questions for the next reviewer:

1. **Why is this safe?** (the rationale)
2. **What compensating control covers it?** (the location of the compensating control)
3. **Who decided?** (the owner team or individual)
4. **When was it added?** (the date)
5. **When does it need re-review?** (the review-by date)

Suppressions that don't answer these 5 questions are technical debt.

## Compliance audit considerations

Auditors (SOC 2, ISO 27001, PCI-DSS) will ask:

- "Show me your suppressions."
- "Why is this one suppressed?"
- "Who approved it?"
- "When was it last reviewed?"
- "What's your stale-suppression review process?"

If your answer to any of these is "we don't track that" — you're failing audit. The structured-rationale pattern above is the audit-ready shape.

## See also

- `ops-triage-aegis-finding` — the upstream decision: fix or suppress.
- `ops-escalation-runbook` — what to do when suppressions are gamed.
- AEGIS suppressions docs — `docs/suppressions.md`.
- AEGIS scanner-rule refinement issue tracker — file FPs as actionable feedback.
