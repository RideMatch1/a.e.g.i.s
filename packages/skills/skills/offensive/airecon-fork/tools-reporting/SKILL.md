<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Reporting Workflow for AIRecon

Use the reporting tools to keep working evidence organized during testing and to write final findings only after validation.

## Working Notes

Use these tools throughout the engagement to preserve observations and reasoning:

- `create_note`: Store hypotheses, observations, task plans, and partial evidence.
- `list_notes`: Review what has already been documented before repeating work.
- `search_notes`: Find prior observations, payloads, targets, or evidence quickly.
- `read_note`: Retrieve the full note when a search result looks relevant.
- `export_notes_wiki`: Export notes into a single markdown wiki for appendix-style documentation.

Notes are not final vulnerability reports. They are working memory.

## Final Findings

Use `create_vulnerability_report` only for confirmed issues.

Minimum expectations before writing a final report:

1. The target, endpoint, or affected component is clearly identified.
2. The proof of concept is reproducible and tied to the same target.
3. The observed impact is explicit: data exposure, auth bypass, code execution, privilege gain, or another concrete security consequence.
4. The technical analysis explains root cause, not only symptoms.

## Practical Flow

1. Save raw observations with `create_note`.
2. Re-check notes with `search_notes` or `list_notes`.
3. Confirm the issue with replay evidence.
4. Write the final entry with `create_vulnerability_report`.
5. Export supporting notes with `export_notes_wiki` if needed.

## Report Quality Rules

- Do not report speculation as a confirmed vulnerability.
- Do not rely on status codes alone without explaining what changed or what was exposed.
- Do not omit the exact attack path, parameter, or request context.
- Prefer short, concrete PoC steps over vague prose.

## When Unsure

If the evidence is incomplete, keep documenting with notes and continue testing. Do not promote the issue to a final vulnerability report until the impact is demonstrated.
