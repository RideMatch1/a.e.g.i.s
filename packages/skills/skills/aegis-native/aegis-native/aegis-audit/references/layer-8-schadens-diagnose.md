# Layer 8 Reference — Schadens-Diagnose (SYNTHESIZER + €-Range)

Layer 8 is the consolidator. Reads Layer 1-7 findings, produces the 4-section report, computes €-range estimates via the industry × visibility × competitor formula. **Time:** ~5-10 min after Layer 7 completes.

---

## 4-Section Report Structure

```markdown
# Audit Report — <project_slug | target>

**Date:** YYYY-MM-DD
**Mode:** mid | full
**Target:** <url | repo-path>

---

## 1. Schadens-Diagnose

(Top-level summary, ≤ 200 words. €-range estimate. Status DONE | INCOMPLETE.)

---

## 2. Findings-Tabelle

(Detailed per-finding. Severity + layer + ID + evidence + recommendation + citation. Ordered KRITISCH → HOCH → MITTEL → LOW.)

---

## 3. Anwalts-Anhang

(Legal citations + court-decisions referenced. Per finding, the source-of-law that justifies the severity-classification.)

---

## 4. Abmahn-Simulation

(Probability-weighted cost model. Industry × Visibility × Competitor-Pressure → € range over 12 months.)

---

**Disclaimer:** Estimates are advisory; not legal advice. Verify with a Fachanwalt für IT-Recht / Wettbewerbsrecht / Gewerblichen Rechtsschutz before relying on them.
```

---

## Section 1: Schadens-Diagnose

```markdown
## 1. Schadens-Diagnose

**Status:** DONE | INCOMPLETE
**AEGIS-Score (when scan-mode):** N/1000 / Grade <S|A|B|C|D|F> / Bracket <FORTRESS|HARDENED|...>
**Findings-Total:** K KRITISCH / H HOCH / M MITTEL / L LOW
**€-Range (12 months):** €<low> - €<high>
**Top-3-Risks:**
1. <ID>: <one-sentence-summary>. Risk: €<low>-<high>.
2. <ID>: ...
3. <ID>: ...

**Composite-Findings (cross-correlation pass):**
- <ID-A> + <ID-B> + <ID-C> → composite KRITISCH (€<low>-<high>)
```

---

## Section 2: Findings-Tabelle

```markdown
## 2. Findings-Tabelle

| Severity | Layer | ID | Title | €-Range | Citation |
|---|---|---|---|---|---|
| KRITISCH | 4 | L4-DSE-DRITTLAND-MISSING | DSE fehlt Drittlandtransfer-Section | €2000-15000 | DSGVO Art. 13/46; EuGH C-311/18 |
| KRITISCH | 5 | L5-PRE-CONSENT-TRACKER | _ga + _fbp set before banner-acceptance | €500-5000 | TTDSG §25; BGH I ZR 7/16 |
| HOCH | 1 | L1-CSP-UNSAFE-INLINE | CSP allows unsafe-inline on script-src | €0 (no direct abmahn) | OWASP CSP-3 |
| HOCH | 3 | L3-IMPRESSUM-VAT-MISSING | Impressum fehlt USt-IdNr | €500-2000 | DDG §5 Abs. 1 Nr. 6 |
| ... | ... | ... | ... | ... | ... |

(Then per finding, expand with Evidence + Recommendation block.)

### KRITISCH 1: L4-DSE-DRITTLAND-MISSING

**Severity:** KRITISCH
**Layer:** 4
**Found at:** /datenschutz (line 47)
**Evidence:**
- 3rd-parties detected: fonts.googleapis.com, www.google-analytics.com, connect.facebook.net
- DSE-mentions-Drittland: false
- DSE-mentions-SCC: false

**Recommendation:**
Add Drittlandtransfer-section listing US-3rd-parties (Google Fonts, Google Analytics, Facebook Pixel), reference SCC + TIA per Schrems-II EuGH C-311/18, Art. 46 DSGVO Schutzgarantien.

**Citation:** DSGVO Art. 13 Abs. 1 lit. f; Art. 46; EuGH C-311/18 (Schrems-II); LG München I 3 O 17493/20 (Google Fonts).

**€-Range:** €2000-15000 over 12 months (industry × visibility-dependent).
```

---

## Section 3: Anwalts-Anhang

```markdown
## 3. Anwalts-Anhang

### DSGVO (Verordnung (EU) 2016/679)

- **Art. 13** — Informationspflicht bei Erhebung beim Betroffenen (referenced by L4-DSE-*)
- **Art. 46** — Übermittlung vorbehaltlich geeigneter Garantien (referenced by L4-DSE-DRITTLAND-MISSING)
- **Art. 7 Abs. 1** — Einwilligung nachweisen (referenced by L5-PRE-CONSENT-*)
- **Art. 28** — Auftragsverarbeitung (referenced by L4-DSE-AVV-MISSING)

### TTDSG / TDDDG

- **§ 25 Abs. 1** — Einwilligung erforderlich für Speicherung von Informationen / Zugriff darauf (Cookies, fingerprinting)

### DDG (vormals TMG)

- **§ 5 Abs. 1** — Allgemeine Informationspflichten (Impressum)
- **§ 5 Abs. 1 Nr. 6** — USt-IdNr. (when § 27a UStG applies)

### Court Decisions

- **EuGH 2020-07-16 C-311/18 (Schrems-II)** — Privacy-Shield invalid; SCC + TIA required for US-Drittlandtransfer
- **BGH 2020-05-28 I ZR 7/16** — Cookie-Banner: einseitige Klick-Lösung unzulässig
- **LG München I 2022-01-20 3 O 17493/20** — Google Fonts via Google CDN = Drittlandtransfer ohne Rechtsgrundlage; €100 Schadensersatz pro Betroffenem
- **EuGH 2008-10-16 C-298/07** — § 5 TMG (= jetzt DDG §5) ist auch B2B-Pflicht
- **OLG Düsseldorf 2019-03-26 I-20 U 75/18** — DSE als wettbewerbsrechtlich relevante Pflicht (UWG-Abmahnung möglich)

### Industry-specific (Layer 6)

(Listed per industry detected — BORA / HWG / LMIV / etc.)
```

---

## Section 4: Abmahn-Simulation

```markdown
## 4. Abmahn-Simulation

### Methodology

For each KRITISCH/HOCH finding, the €-range is computed as:

```
€-range = Base × Industry-Multiplier × Visibility-Multiplier × Competitor-Pressure
```

| Variable | Range |
|---|---|
| Base (per finding-class) | €100-2000 |
| Industry-Multiplier | 0.5 (private blog) - 2.5 (regulated industry: Anwalt, Arzt, Steuerberater) |
| Visibility-Multiplier | 0.3 (Alexa > 1M) - 2.0 (Top-10000) |
| Competitor-Pressure | 0.5 (uncommon abmahn-target) - 2.0 (active abmahn-anwalt watching industry) |

### Example Calculation: L4-DSE-DRITTLAND-MISSING

- Base: €1500 (DSGVO Drittlandtransfer cluster)
- Industry: 1.0 (generic web-business)
- Visibility: 1.5 (Top-100k DACH-traffic)
- Competitor: 1.5 (Google Fonts = active abmahn-anwalt-Linie)
- **Total: €1500 × 1.0 × 1.5 × 1.5 = €3375 mid-estimate**
- Range: €2000-€5000 (varying competitor + industry factors)

### Composite-Findings (cross-correlation)

Composite findings (≥ 2 KRITISCH from related layers) get aggregated:

- DSE incomplete + Pre-consent tracker + Impressum incomplete = **abmahn-cluster** (likely Konkurrenz-Anwalt or Verbraucherschutzverband target).
- Aggregated: €5000-€15000 over 12 months.

### Probability-Weighted Estimate

| Scenario | Probability | Cost |
|---|---|---|
| No abmahnung | 60% | €0 |
| 1 individual abmahnung (Verbraucher) | 25% | €1500-3500 |
| 1 Konkurrenz-Abmahnung | 12% | €5000-10000 |
| Multi-finding abmahn-cluster | 3% | €10000-25000 |

**Expected value:** 0.6 × 0 + 0.25 × 2500 + 0.12 × 7500 + 0.03 × 17500 = **~€2050 over 12 months**.

(Recompute per project. The probabilities shift with industry, visibility, competitor-pressure.)

---

**Disclaimer:** This is a probabilistic risk-model, not legal advice. Actual abmahnungen depend on case-specific factors (timing, abmahn-anwalt activity, court-Linie). For anything ≥ €5000 estimated risk, consult a Fachanwalt für IT-Recht.
```

---

## Computation Algorithm

```ts
// Pseudo-code for €-range computation
function computeEuroRange(finding, context) {
  const base = SEVERITY_BASE[finding.severity]; // KRITISCH: 1000-3000, HOCH: 200-1000, MITTEL: 50-200, LOW: 0-50
  const industry = INDUSTRY_MULTIPLIER[context.industry] ?? 1.0;
  const visibility = visibilityMultiplier(context.alexa_rank ?? 1_000_000);
  const competitor = competitorPressure(context.industry, finding.id);
  const low = base.low * industry * visibility * competitor;
  const high = base.high * industry * visibility * competitor;
  return { low, high };
}

function aggregateComposites(findings) {
  // Find clusters of related KRITISCH findings (cross-correlation pass already classified them)
  const clusters = groupByCluster(findings);
  return clusters.map(cluster => ({
    ids: cluster.map(f => f.id),
    severity: 'COMPOSITE-KRITISCH',
    range: cluster.reduce((acc, f) => ({
      low: acc.low + f.range.low * 0.7,  // 30% discount for composite (single abmahn-letter for multiple findings)
      high: acc.high + f.range.high * 0.85,
    }), { low: 0, high: 0 }),
  }));
}
```

---

## Anti-Patterns specific to Layer 8

- ❌ Reporting €-range without disclaimer — always note "advisory; not legal advice".
- ❌ Hardcoding base-amounts — use a configurable table per `aegis.config.json` `audit.severity_base[]`.
- ❌ Skipping composite-findings cross-correlation — single findings are often €0; clusters are where the abmahn-risk lives.
- ❌ Using Alexa-rank only for visibility — also factor: industry-specific visibility (Top-10 in Anwalt-Verzeichnis = high visibility even at Alexa > 1M).
- ❌ Ignoring competitor-pressure for non-DACH — Layer 8 is calibrated for DACH abmahn-Linien; for US/UK markets, recalibrate.
- ❌ Promising precise €-amount — always range. "€3375 exact" gives false confidence; "€2000-5000" reflects uncertainty.
- ❌ Skipping disclaimer in stdout-summary — every output includes the advisory-not-legal-advice note.
