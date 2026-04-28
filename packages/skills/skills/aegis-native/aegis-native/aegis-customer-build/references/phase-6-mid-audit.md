# Phase 6 Reference — Mid-Audit (AEGIS-Scan + Anwalt Spot-Check + Repair Loop)

Phase 6 is MANDATORY. It catches regressions early — before Phase 7 has to find them in a fully-built artifact (which is more expensive to repair). **Time budget:** 20-30 min, plus repair iterations if any gates are red.

**Subagent dispatch:** optional. If used, dispatch one Auditor-subagent (model: opus) to run the audits in parallel with Phase 5's tail-end integrations.

---

## Mid-Audit Scope

Phase 6 runs a SUBSET of the final-verify gates — the cheap ones that catch most regressions:

| Gate | Mid-audit threshold | Final-verify threshold |
|---|---|---|
| build | exit 0 | exit 0 |
| tsc | 0 errors | 0 errors |
| lint | 0 errors | 0 errors |
| tests | 100% pass | 100% pass |
| aegis-scan | score ≥ 900 | score ≥ 950 |
| brutaler-anwalt (HUNT mode, topic-scoped) | 0 KRITISCH | 0 KRITISCH, ≤ 2 HOCH |
| Lighthouse | _(skipped — too slow for mid)_ | mobile ≥ 75, desktop ≥ 90 |
| skillforge-validate | _(N/A unless skills touched)_ | 16/17+ per touched skill |
| briefing-coverage | _(skipped — pages still being filled)_ | 100% |

**Rationale:** the cheap gates (build/tsc/lint/tests/aegis-scan + scoped anwalt) catch ≥ 80% of regressions. Lighthouse + briefing-coverage are deferred to Phase 7 because they require a fully-built artifact.

---

## AEGIS-Scan Invocation Pattern

Mid-audit AEGIS-scan runs against the local dev-build:

```bash
# Build first (or run dev-server)
cd customers/<slug>
pnpm run build
pnpm run start &        # or: pnpm dev
SERVER_PID=$!

# Wait for server-ready (max 30s)
until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done

# Run scan
npx -y @aegis-scan/cli scan http://localhost:3000 \
  --output ./audits/mid-audit-aegis.json \
  --format json

kill $SERVER_PID
```

Parse the JSON:

```ts
const result = JSON.parse(readFileSync('./audits/mid-audit-aegis.json'));
if (result.score < 900 || result.grade === 'F') {
  // RED — repair-attempt loop
}
```

---

## Brutaler-Anwalt HUNT-Mode Pattern

Mid-audit anwalt run is SCOPED — focuses on the most regression-prone topics, not the full 8-layer audit:

```
Invoke: compliance/aegis-native/brutaler-anwalt skill in HUNT mode
Topics: impressum + cookie + dse (the bug-prone surface)
Target: http://localhost:3000
Output: customers/<slug>/audits/mid-audit-anwalt.md
Format: 4-section (Schadens-Diagnose / Findings / Anwalts-Anhang / Abmahn-Simulation)
```

**Skill-invocation pattern** (Claude Code):

```
Skill: compliance/aegis-native/brutaler-anwalt
Args: --mode=hunt --topics=impressum,cookie,dse --target=http://localhost:3000
```

Or via CLI:

```bash
npx -y @aegis-scan/skills run compliance/brutaler-anwalt \
  --mode=hunt \
  --topics=impressum,cookie,dse \
  --target=http://localhost:3000 \
  --output=./audits/mid-audit-anwalt.md
```

---

## Repair-Attempt Loop

If any gate is red, enter repair-attempt loop:

```
attempts=0
while [ $attempts -lt 3 ]; do
  attempts=$((attempts+1))
  
  # Identify failing gates
  failing=$(jq -r '.gates_failed[]' .aegis/state.json)
  
  # For each failing gate:
  for gate in $failing; do
    case $gate in
      tsc)         repair_tsc_errors    ;;
      lint)        repair_lint_errors   ;;
      tests)       repair_test_failures ;;
      aegis-scan)  repair_aegis_findings ;;
      anwalt)      repair_anwalt_findings ;;
    esac
  done
  
  # Re-run mid-audit
  re_run_mid_audit
  
  # Check if all gates green now
  if all_gates_green; then
    break
  fi
done

if [ $attempts -ge 3 ] && ! all_gates_green; then
  echo "Mid-audit INCOMPLETE after 3 repair-attempts"
  echo "Open: $(jq -r '.gates_failed[]' .aegis/state.json)"
  # escalate to Phase 7 with explicit INCOMPLETE-Status
fi
```

**Repair-action mapping:**

| Failing gate | Common cause | Repair-action |
|---|---|---|
| tsc | Missing prop type, undefined import | Find file, add type annotation |
| lint | Unused var, missing dep | Auto-fix via `pnpm run lint --fix` |
| tests | New code lacks test, broken existing test | Either write missing test or fix code |
| aegis-scan: T1 (DNS) | Missing DNSSEC / CAA | Operator-action (DNS-level) — report as DEFER |
| aegis-scan: T1 (HTTP-headers) | Missing CSP / HSTS / X-Frame | Add to next.config.js or middleware |
| aegis-scan: T2 (HTML) | Missing alt-text / heading-hierarchy | Edit page.tsx |
| aegis-scan: T3 (Impressum) | Footer-link missing / 404 | Fix footer-link |
| anwalt KRITISCH (Impressum) | DDG §5 fields missing | Add to /impressum page |
| anwalt KRITISCH (Cookie) | Pre-consent tracker | Move tracker behind cookie-banner |
| anwalt KRITISCH (DSE) | Missing Art. 13 fields | Update /datenschutz page |

---

## State.json Update per Repair-Attempt

```json
{
  "phase": 6,
  "status": "in-repair",
  "attempts": 2,
  "max_attempts": 3,
  "mid_audit_score": 887,
  "mid_audit_grade": "B+",
  "gates_failed": ["aegis-scan:t1-headers", "anwalt:cookie-banner-pre-checked"],
  "repairs_applied": [
    {"gate": "tsc:missing-import", "fix": "add 'import { Hero }' in app/page.tsx", "result": "passed"},
    {"gate": "anwalt:impressum-missing-vat-id", "fix": "added VAT-ID to footer", "result": "passed"}
  ],
  "next_action": "repair-attempt-3"
}
```

---

## Phase 6 Completion Criteria

Mid-audit is complete when EITHER:

- All mid-audit gates green (proceed to Phase 7)
- 3 repair-attempts exhausted with red gates remaining (proceed to Phase 7 with INCOMPLETE-Status flagged)

NEVER proceed to Phase 7 without writing the mid-audit checkpoint:

```json
{
  "phase": 6,
  "status": "complete-green" | "complete-incomplete",
  "mid_audit_score": <N>,
  "mid_audit_grade": "<G>",
  "anwalt_findings": {"kritisch": <N>, "hoch": <N>, "mittel": <N>},
  "open_after_repair": [<list>]
}
```

---

## Anti-Patterns specific to Phase 6

- ❌ Skipping mid-audit "to save time" — Phase 6 catches > 80% of regressions cheaper than Phase 7 would.
- ❌ Running full 9-gate sweep in mid-audit — too slow; mid-audit is a subset.
- ❌ Looping repair-attempts beyond 3 — diminishing returns; escalate to Phase 7 with INCOMPLETE.
- ❌ Marking phase 6 complete without writing the checkpoint — next agent (or Phase 7 itself) loses context.
- ❌ Repairing only the first failing gate and re-running — repair all failing gates per attempt, then re-run once.
- ❌ Inferring repair-actions from chat-context — read the gate-output (JSON for aegis-scan, MD for anwalt), don't guess.
- ❌ Ignoring brutaler-anwalt HOCH findings as "not blocking mid-audit" — track in checkpoint; final pass must address them.
