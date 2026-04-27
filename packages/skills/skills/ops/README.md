# Operations Skills — `ops/`

Operational runbooks for the AEGIS workflow itself — how to triage
findings, when to suppress, when to escalate, how to respond to
exploited vulnerabilities. These skills wrap the AEGIS CLI + reporters
in process-discipline so teams use AEGIS consistently rather than
ad-hoc.

## Sources

| Source dir | License | Skills |
|---|---|---|
| `aegis-native/` | MIT (AEGIS-original) | 3 |

## AEGIS-native skills

| Skill | When to use |
|---|---|
| `triage-finding` | Receiving a new AEGIS finding (PR comment, JSON, SARIF). Triage decision tree: severity → confidence → verify → fix-vs-suppress-vs-defer. |
| `suppress-correctly` | About to add a suppression; reviewing existing suppressions for staleness; auditing suppressions before a security review. Three legitimate cases + anti-patterns + audit-trail expectations. |
| `escalation-runbook` | A BLOCKER reached `main`; a finding suggests active exploitation; a credential leak detected; a suppression has been gamed. Severity ladders, immediate-containment playbook, notification triggers, post-incident review structure. |

License: MIT. See top-level [`ATTRIBUTION.md`](../../ATTRIBUTION.md) for
attribution chain.

## Roadmap

Future expansions:

- `evidence-gathering` — collect evidence for review when AEGIS surfaces a real finding.
- `false-positive-handling` — FP triage workflow + scanner-rule refinement feedback loop.
- `post-incident-review` — review-meeting structure after a security incident.
- `fix-mode-discipline` — operational discipline around `aegis fix` (LLM-driven remediation safety).
- `compliance-audit-prep` — preparing AEGIS evidence for SOC 2 / ISO 27001 / PCI-DSS audits.
- `ci-gating-tuning` — when to fail the build vs warn vs annotate.

## See also

- AEGIS suppressions docs — `docs/suppressions.md`.
- AEGIS confidence-rules — top-level `README.md` § "Scoring".
- AEGIS incident-response convention — top-level `SECURITY-INCIDENT-RESPONSE.md`.
