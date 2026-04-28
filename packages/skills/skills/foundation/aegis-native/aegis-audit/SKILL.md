<!-- aegis-local: AEGIS-native skill, MIT-licensed; 8-Layer paranoid-audit skill. Headers / HTML / Impressum / DSE / Cookie / Branche / Code-Cross-Check / Schadens-Diagnose. Runs against built customer-site, gegen Live-URL, oder gegen lokales Repo. Output 4-section format (Schadens-Diagnose / Findings-Tabelle / Anwalts-Anhang / Abmahn-Simulation). Pattern ported from a private operational reference; this is the public OSS variant. -->
---
name: aegis-audit
description: 8-Layer paranoid-audit skill. Headers / HTML / Impressum / DSE / Cookie / Branche / Code-Cross-Check / Schadens-Diagnose. Runs against built site, live URL, or local repo. Output 4-section - Schadens-Diagnose / Findings-Tabelle / Anwalts-Anhang / Abmahn-Simulation. Trigger keywords - audit, paranoid-audit, AAA+++ check, 8-layer, security-audit, full-audit.
model: opus
license: MIT
metadata:
  required_tools: "shell-ops,file-ops,curl,playwright,aegis-scan"
  required_audit_passes: "1"
  enforced_quality_gates: "0"
  pre_done_audit: "true"
---

# aegis-audit — 8-Layer Paranoid Audit

The Foundation's audit skill. Runs an 8-layer audit against a target (customer-site / live URL / local repo), produces a 4-section structured report, classifies findings by severity (KRITISCH / HOCH / MITTEL / LOW), estimates €-risk per finding via the industry × visibility × competitor formula. Used by customer-build's Phase 6 (mid-audit, topic-scoped) and Phase 7 (final, full-pass).

---

## HARD-CONSTRAINT — Layer-Order, Reference-Loading, No Mocks

This skill MUST:

1. **Load all 8 layer-references** in `references/layer-1-headers.md` through `references/layer-8-schadens-diagnose.md` BEFORE producing any finding. Skipping a layer-reference = guaranteed false-negatives or false-positives.
2. **Execute layers in fixed order** (1 → 8). Earlier layers feed later ones (e.g., Layer 1 HTTP-headers feed Layer 5 cookie-detection). Out-of-order execution skips signal.
3. **No mocks.** Every layer hits the real target via real HTTP / curl / Playwright. If the target is unreachable — report NO-RESPONSE; never infer findings from chat-context.
4. **Cross-check with brutaler-anwalt** (`compliance/aegis-native/brutaler-anwalt/SKILL.md`). aegis-audit is the technical pass; brutaler-anwalt is the legal pass. They share Layer 3 (Impressum) + Layer 4 (DSE) + Layer 5 (Cookie). Findings get cross-validated.
5. **Output the canonical 4-section format.** Schadens-Diagnose / Findings-Tabelle / Anwalts-Anhang / Abmahn-Simulation. No deviation; downstream tooling parses this format.
6. **Include €-range estimates** per Layer 8 formula (industry × visibility × competitor-pressure). Estimates are advisory, not legal advice — disclaimer required.

If any layer cannot run (e.g., Playwright not installed) — STOP, report which layer + why. Don't silent-skip.

---

## Mission

Eliminate the failure-mode where "the site looks fine" turns into a €15k abmahnung 3 weeks after launch. Catch the legal + technical regressions that scanners-alone miss because they don't cross-correlate (e.g., a tracker loaded before consent + impressum missing VAT-ID + cookie-banner with no equal-prominence reject = composite finding worth €5-15k).

Be the audit that:

- Hits every layer that abmahnanwalts inspect.
- Cross-correlates findings (a single scanner-hit might be 0 €; a 3-finding-cluster might be €15k).
- Estimates €-risk (operator can prioritize).
- Produces a 4-section report that operator + legal + dev can all consume.
- Distinguishes between "fix-now KRITISCH" and "fix-this-quarter MITTEL".

Production-bar reference: a previous full-audit on a 13-page site (private operational reference) returned 0 KRITISCH / 0 HOCH / 3 MITTEL / 8 LOW with €-range 200-800 €/quarter (very low) — the bar this skill targets.

---

## Triggers

### Slash-commands

- `/audit` — run full 8-layer audit on the configured target
- `/paranoid-audit` — alias
- `/8-layer` — alias

### Auto-trigger keywords

- audit, paranoid-audit, AAA+++ check, 8-layer, security-audit, full-audit, abmahn-prevention

### Programmatic invocation

Customer-build Phase 6 invokes via:

```
Skill: aegis-native/aegis-audit
Args: --mode=mid --topics=impressum,cookie,dse --target=http://localhost:3000
```

Phase 7 invokes via:

```
Skill: aegis-native/aegis-audit
Args: --mode=full --target=http://localhost:3000 --output=audits/final.md
```

---

## Process

The 8 layers run in fixed order. Each layer has a dedicated reference under `references/`.

### Layer Summary Table

| # | Layer | Mid-mode | Full-mode | Reference |
|---|---|---|---|---|
| 1 | HTTP-Headers | optional | always | layer-1-headers.md |
| 2 | HTML-Live-Probe | always | always | layer-2-html.md |
| 3 | Impressum | always | always | layer-3-impressum.md |
| 4 | DSE (Datenschutzerklärung) | always | always | layer-4-dse.md |
| 5 | Cookie + Consent | always | always | layer-5-cookie.md |
| 6 | Branche-Specific | optional | always | layer-6-branche.md |
| 7 | Code-Cross-Check (when local repo) | full only | always | layer-7-code-cross-check.md |
| 8 | Schadens-Diagnose (Synthesizer) | always | always | layer-8-schadens-diagnose.md |

### Phase 1: Pre-Audit Setup

```bash
# Verify target is reachable
curl -sf -o /dev/null -w "%{http_code}\n" "$TARGET"
# Expected: 200 / 301 / 302; otherwise abort with NO-RESPONSE finding

# Verify Playwright is available (for Layer 2 + Layer 5 deeper probes)
npx playwright --version
# If missing: STOP, ask operator to `npx playwright install chromium`
```

### Phase 2: Layer Execution (1 → 8)

For each enabled layer (per --mode):

1. Read the layer-reference for the patterns + thresholds.
2. Execute the probe(s).
3. Capture findings into the structured findings-list with:
   - `id`: stable identifier (e.g., `L3-IMPRESSUM-VAT-MISSING`)
   - `severity`: KRITISCH | HOCH | MITTEL | LOW
   - `evidence`: the raw observation (URL + HTTP status + HTML snippet + curl output)
   - `recommendation`: the fix
   - `citation`: legal-source (Art. paragraph + court-decision when available)

### Phase 3: Cross-Correlation

After all layers run, run the cross-correlation pass:

- Layer 3 + Layer 5 cluster: Impressum-incomplete + cookie-pre-consent → composite KRITISCH (€5-15k abmahn)
- Layer 4 + Layer 5 cluster: DSE-incomplete + tracker-active → composite KRITISCH
- Layer 1 + Layer 7 cluster: missing CSP + unsafe-eval in code → composite HOCH
- Layer 6 + Layer 3 cluster: industry-specific pflichtangabe + impressum-missing → composite KRITISCH

Cross-correlation often elevates 3 individual MITTEL findings to a single composite KRITISCH — the actual abmahn-target.

### Phase 4: Report Generation (Layer 8 — Schadens-Diagnose)

Produce the 4-section report per the canonical template (see `references/layer-8-schadens-diagnose.md`):

1. **Schadens-Diagnose** — top-level summary + €-range estimate
2. **Findings-Tabelle** — detailed per-finding (severity / layer / evidence / fix / citation)
3. **Anwalts-Anhang** — legal citations (Art. paragraph + court-decisions)
4. **Abmahn-Simulation** — likelihood × industry × visibility = probable cost-range

### Phase 5: Output

Write the report to:

- `customers/<slug>/audits/<mode>-<date>.md` (when invoked from customer-build)
- `audits/<mode>-<date>.md` (when invoked standalone)
- stdout summary (1-line per finding) + path to full report

---

## Verification / Success Criteria

Before declaring the audit complete:

- [ ] All enabled layers executed (no silent-skip)
- [ ] Each layer's findings captured with full evidence (no hand-wavy "looks bad")
- [ ] Cross-correlation pass run after all layers
- [ ] Schadens-Diagnose €-range computed via Layer 8 formula
- [ ] 4-section report written + stdout summary printed
- [ ] No KRITISCH finding without a citation
- [ ] No HOCH finding without a fix-recommendation
- [ ] No "TODO" or placeholder text in the final report

If any unmet → audit is incomplete. Re-run failing layers + regenerate report.

---

## Anti-Patterns

- ❌ Skipping a layer "because it doesn't apply to this target" — every layer applies; if none apply, report NOT-APPLICABLE in the layer-section, don't omit.
- ❌ Mocking HTTP-responses — every probe hits real target.
- ❌ Inferring findings from chat-context — read the raw output, cite line/byte.
- ❌ Hand-wavy severities — every severity has a defined criteria (per layer-reference); apply consistently.
- ❌ Composite findings without explicit cross-correlation logic — Phase 3 is mandatory.
- ❌ €-range without disclaimer — "Estimates are advisory; not legal advice. Verify with a Fachanwalt."
- ❌ Skipping Layer 8 (Schadens-Diagnose) "because no findings exist" — Layer 8 still produces a report stating "0 findings, low €-risk".
- ❌ Out-of-order layer execution — Layer 5 (cookie) needs Layer 1 (headers) data; running L5 before L1 misses signals.
- ❌ False-positive on a 3rd-party-CDN that's actually 1st-party-CNAME-aliased — verify via `dig CNAME` before reporting.
- ❌ Missing citation for KRITISCH — no Art./§/court-decision = downgrade to HOCH at most.

---

## Extension Points

- **New layer**: add `references/layer-9-<name>.md` + add to the Layer Summary Table here. Phase 2 reads the layer-references list dynamically.
- **Industry-specific Layer 6**: per industry (legal, medical, financial, ...) extend `references/layer-6-branche.md` with industry-section. Phase 2 detects industry from the target's NAICS/WZ-code (or briefing.industry field).
- **Custom severity thresholds**: a project might want stricter KRITISCH thresholds. Override in `aegis.config.json` `audit.severities.kritisch.threshold` per layer.
- **Different target-types**: this skill audits a URL by default. Extend with `--mode=local-repo` (audits source-code without running build) or `--mode=tarball` (audits a published artifact) by adding probe-implementations per layer.
- **Multi-language support**: for non-DE/EU jurisdictions, add `references/layer-<N>-<jurisdiction>.md` (e.g., layer-3-impressum-uk.md for UK pflichtangaben). Layer 2 (HTML), Layer 1 (Headers), Layer 7 (Code) are jurisdiction-agnostic and reused.
- **Output format**: the 4-section format is canonical. Extension-formats (HTML / SARIF / JSON) live in `packages/reporters` and consume the audit's structured findings-list.
- **Continuous audit**: a project can run aegis-audit on every commit (CI integration) or on every URL-change (production-watch). Add `--mode=ci` (fast, layer 1+2+3+5 only) and `--mode=watch` (Layer 1+2+5).
- **Whitelisted-finding suppression**: some findings are project-accepted (e.g., a CSP `unsafe-inline` for a specific 3rd-party script). Add to `aegis.config.json` `audit.suppressions[]` with `id` + `rationale` + `expiry-date`. Suppressions expire by default (no permanent suppressions).
