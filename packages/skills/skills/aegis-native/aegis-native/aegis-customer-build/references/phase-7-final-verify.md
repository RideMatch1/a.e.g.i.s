# Phase 7 Reference — Final-Verify (9-Gate Loop + Briefing-Coverage + Status-Report)

Phase 7 is the final pass. All 9 quality-gates run. Briefing-coverage check. Lighthouse mobile + desktop. Final brutaler-anwalt full-pass. Status-report DONE or INCOMPLETE. **Time budget:** 30-45 min plus repair-iterations if needed.

---

## The 9 Gates (full-final mode)

Per `aegis-quality-gates` skill, the canonical sequence:

| # | Gate | Threshold | When red, action |
|---|---|---|---|
| 1 | build | exit 0 | Fix compile error, re-run |
| 2 | tsc | 0 errors | Fix type error, re-run |
| 3 | lint | 0 errors | Auto-fix or manual fix |
| 4 | tests | 100% pass | Fix test or fix code |
| 5 | aegis-scan | score ≥ 950, grade S/FORTRESS | Identify failing tier, repair, re-scan |
| 6 | brutaler-anwalt full-pass | 0 KRITISCH, ≤ 2 HOCH | Fix legal-finding, re-run |
| 7 | lighthouse | Mobile ≥ 75, Desktop ≥ 90, A11y/SEO/BP = 100 | Optimize, re-run |
| 8 | skillforge-validate | 16/17+ per touched skill | Fix skill-structure, re-validate |
| 9 | briefing-coverage | 100% pages exist | Build missing page, re-check |

Each gate writes a structured result to `.aegis/verify-report.json`. The post-build status-report reads from this JSON.

---

## Gate 9: Briefing-Coverage Check

The most foundation-specific gate. Verifies every page in the briefing exists in the artifact.

```ts
// scripts/check-briefing-coverage.ts
import { readFileSync, existsSync } from 'node:fs';

const briefing = JSON.parse(readFileSync('.aegis/briefing-parsed.json', 'utf-8'));
const expectedPages = briefing.pages;
const missing: string[] = [];
const incomplete: string[] = [];

for (const page of expectedPages) {
  const filePath = page.slug === 'home' 
    ? 'app/page.tsx' 
    : `app/${page.slug}/page.tsx`;
  
  if (!existsSync(filePath)) {
    missing.push(`${page.slug}: file not found at ${filePath}`);
    continue;
  }
  
  const content = readFileSync(filePath, 'utf-8');
  
  // Verify metadata exported
  if (!content.includes('export const metadata') && !content.includes('export async function generateMetadata')) {
    incomplete.push(`${page.slug}: missing metadata export`);
  }
  
  // Verify each section in briefing.sections[] is present
  for (const section of page.sections) {
    if (!sectionPresent(content, section)) {
      incomplete.push(`${page.slug}: section "${section}" not found in JSX`);
    }
  }
}

if (missing.length || incomplete.length) {
  console.error('Briefing-coverage RED:', { missing, incomplete });
  process.exit(1);
}
console.log(`Briefing-coverage OK: ${expectedPages.length}/${expectedPages.length} pages`);
```

`sectionPresent` is a heuristic: looks for component-name-match or comment-marker. Customize per project's library naming.

---

## Lighthouse Invocation (Mobile + Desktop)

```bash
# Build production
cd customers/<slug>
pnpm run build
pnpm run start &
SERVER_PID=$!
until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done

# Mobile
npx -y @lhci/cli@latest collect \
  --url=http://localhost:3000 \
  --settings.preset=mobile \
  --output-path=./audits/lhci-mobile.json

# Desktop
npx -y @lhci/cli@latest collect \
  --url=http://localhost:3000 \
  --settings.preset=desktop \
  --output-path=./audits/lhci-desktop.json

kill $SERVER_PID

# Parse
node scripts/parse-lhci.mjs ./audits/lhci-mobile.json ./audits/lhci-desktop.json
```

`parse-lhci.mjs`:

```js
import { readFileSync } from 'node:fs';

const mobile = JSON.parse(readFileSync(process.argv[2]));
const desktop = JSON.parse(readFileSync(process.argv[3]));

const m = mobile.lhr.categories;
const d = desktop.lhr.categories;

const result = {
  mobile: {
    performance: Math.round(m.performance.score * 100),
    accessibility: Math.round(m.accessibility.score * 100),
    seo: Math.round(m.seo.score * 100),
    bestPractices: Math.round(m['best-practices'].score * 100),
  },
  desktop: {
    performance: Math.round(d.performance.score * 100),
    accessibility: Math.round(d.accessibility.score * 100),
    seo: Math.round(d.seo.score * 100),
    bestPractices: Math.round(d['best-practices'].score * 100),
  },
};

const fails: string[] = [];
if (result.mobile.performance < 75) fails.push(`mobile.performance ${result.mobile.performance} < 75`);
if (result.desktop.performance < 90) fails.push(`desktop.performance ${result.desktop.performance} < 90`);
if (result.mobile.accessibility < 100) fails.push(`mobile.a11y ${result.mobile.accessibility} < 100`);
// ... etc

console.log(JSON.stringify(result, null, 2));
if (fails.length) {
  console.error('Lighthouse RED:', fails);
  process.exit(1);
}
```

---

## Final Brutaler-Anwalt Full-Pass

Unlike Phase 6's HUNT-mode (topic-scoped), Phase 7 runs the FULL 8-layer audit:

```bash
npx -y @aegis-scan/skills run compliance/brutaler-anwalt \
  --mode=full \
  --target=http://localhost:3000 \
  --output=./audits/final-anwalt.md \
  --format=4-section
```

Output is the canonical 4-section format:

1. **Schadens-Diagnose** — top-level summary with €-range estimate.
2. **Findings-Tabelle** — detailed per-finding (severity, layer, evidence, fix-suggestion).
3. **Anwalts-Anhang** — legal citations (Art. paragraph + court-decision references).
4. **Abmahn-Simulation** — likelihood × industry × visibility = probable cost.

**Final-pass thresholds:**

- 0 KRITISCH (any KRITISCH = INCOMPLETE-Status)
- ≤ 2 HOCH (each HOCH explicitly listed in status-report)
- MITTEL + LOW: tracked but non-blocking

If KRITISCH found: enter repair-attempt-loop (max 3) for KRITISCH-only. HOCH/MITTEL are post-launch-tasks.

---

## .aegis/verify-report.json Schema

```json
{
  "timestamp": "2026-04-28T14:00:00Z",
  "project_slug": "test-customer-001",
  "status": "DONE" | "INCOMPLETE",
  "gates": {
    "build": {"pass": true, "duration_ms": 8421},
    "tsc": {"pass": true, "errors": 0},
    "lint": {"pass": true, "errors": 0},
    "tests": {"pass": true, "passed": 145, "total": 145},
    "aegis_scan": {"pass": true, "score": 994, "grade": "S", "bracket": "FORTRESS"},
    "anwalt": {"pass": true, "kritisch": 0, "hoch": 1, "report": "audits/final-anwalt.md"},
    "lighthouse": {
      "pass": true,
      "mobile": {"performance": 82, "accessibility": 100, "seo": 100, "best_practices": 100},
      "desktop": {"performance": 95, "accessibility": 100, "seo": 100, "best_practices": 100}
    },
    "skillforge_validate": {"pass": true, "skills_validated": []},
    "briefing_coverage": {"pass": true, "expected": 13, "actual": 13, "missing": []}
  },
  "open_items": []
}
```

If `status: INCOMPLETE`, `open_items` lists every failing gate-item with severity.

---

## Status-Report Format (post-build)

The customer-build SKILL.md's Process specifies the canonical text. Phase 7 generates it from `.aegis/verify-report.json`:

**DONE template:**

```
Bin fertig, Chef.
- Site unter customers/<slug>/
- AEGIS Score: <score>/<grade>/<bracket>
- Lighthouse: Mobile <m_perf>/Desktop <d_perf> (A11y/SEO/BP all <100|99>)
- brutaler-anwalt: <kritisch> KRITISCH, <hoch> HOCH
- Briefing-Coverage: <built>/<expected> pages (<pct>%)
- Audit-Report: customers/<slug>/audits/final.md
- Bereit für deploy.
```

**INCOMPLETE template:**

```
BUILD INCOMPLETE — folgende Items offen:
- [ ] aegis-scan score 928 < 950 (target). Failing tier: T1-DNS-NO-DNSSEC.
- [ ] anwalt KRITISCH 1: Impressum fehlt VAT-ID (line 47 of /impressum/page.tsx)
- [ ] briefing-coverage 12/13 — fehlt: page "blog/karriere" (briefing line 412)
- [ ] lighthouse mobile.performance 67 < 75. Hauptursache: LCP > 4s.
Repair-attempt-Count: 3/3 erschöpft.
Empfehlung: Operator-Eingriff für T1-DNS (DNS-level), VAT-ID-Eintrag, blog/karriere-page-Build, LCP-Optimierung.
```

Always exact, with concrete file/line/page references.

---

## Phase 7 Completion Criteria

- [ ] All 9 gates ran (no skipping)
- [ ] `.aegis/verify-report.json` written
- [ ] Audit-report `audits/final.md` consolidated (combines AEGIS-scan + anwalt + lighthouse outputs)
- [ ] Status-report printed to operator (DONE or INCOMPLETE template)
- [ ] If DONE: state.json `status: DONE` set
- [ ] If INCOMPLETE: state.json `status: INCOMPLETE`, `open_items[]` populated
- [ ] Operator-actionable (operator can copy-paste status-report into deploy-tracker)

---

## Anti-Patterns specific to Phase 7

- ❌ Reporting "DONE" with score < 950 (never round up)
- ❌ Skipping any gate in final-verify (mid-audit subsetting was Phase 6)
- ❌ Mocking Lighthouse run because "the dev-server isn't started" — start it, run real Lighthouse
- ❌ Reporting briefing-coverage as 100% when one page is a stub (e.g., 50 chars of copy) — coverage requires meta + sections + content
- ❌ Hiding HOCH findings in the status-report — every HOCH gets listed
- ❌ Auto-deploying after DONE status without operator-confirm — deploy is an operator-action
- ❌ Repair-attempt-loop running > 3 iterations on the same gate — escalate to INCOMPLETE
- ❌ Skipping `.aegis/verify-report.json` — downstream tooling depends on it
