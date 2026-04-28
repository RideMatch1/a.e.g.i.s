# Layer 3 Reference — Impressum (DDG §5)

Layer 3 verifies the Impressum (legal notice) per DDG §5 (formerly TMG §5, renamed 2024-05-14 with TDDDG enactment). Catches: missing pflichtangaben, broken links, browser-vs-bot-walled pages. **Time:** ~3-5 min per target.

---

## Pflichtangaben Checklist (DDG §5)

| # | Pflichtangabe | Field-name | Required when |
|---|---|---|---|
| 1 | Name + Anschrift | Geschäftsbezeichnung + Straße + PLZ + Ort | always (geschäftsmäßig) |
| 2 | Vertretungsberechtigter | Geschäftsführer (bei juristischen Personen) | for GmbH/AG/UG/etc. |
| 3 | Kontakt: E-Mail + Telefon | E-Mail + Tel. | always |
| 4 | Handelsregister | HRB-Nummer + Registergericht | for handelsregister-pflichtige Rechtsformen |
| 5 | Umsatzsteuer-ID | USt-IdNr. (`DE...`) | when § 27a UStG applies |
| 6 | Wirtschafts-ID | W-IdNr. | when applicable |
| 7 | Aufsichtsbehörde | Name + Adresse | for state-licensed industries (Anwalt, Arzt, Architekt, Steuerberater, ...) |
| 8 | Berufsbezeichnung + Kammer | Bezeichnung + verleihender Staat + Kammer | for regulated professions |
| 9 | Berufshaftpflicht | Versicherer + räumlicher Geltungsbereich | for regulated professions (Anwalt, Arzt, ...) |
| 10 | Online-Streitbeilegung Hinweis | Link zu ec.europa.eu/consumers/odr | for B2C with online-business |
| 11 | Verbraucherstreitbeilegung Hinweis | Bereit-/Nicht-Bereit-Erklärung | for B2C |
| 12 | Inhaltlich Verantwortlicher (§ 18 Abs. 2 MStV) | Name + Anschrift | for journalistic-redaktional Angebote |

---

## Probe Pattern

```bash
# Resolve impressum-URL
IMPRESSUM_URL=$(node -e "
  const html = require('fs').readFileSync('/tmp/audit-html-static.html', 'utf-8');
  const match = html.match(/href=['\"]([^'\"]*impressum[^'\"]*)['\"]/i);
  console.log(match ? new URL(match[1], '$TARGET').href : '');
")

if [ -z "$IMPRESSUM_URL" ]; then
  echo "L3-IMPRESSUM-NO-FOOTER-LINK: KRITISCH"
  exit 1
fi

# Fetch with browser-UA (some sites bot-wall)
curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "$IMPRESSUM_URL" > /tmp/audit-impressum.html

# Or fall-back to Playwright
[ "$(wc -c < /tmp/audit-impressum.html)" -lt 1000 ] && {
  npx -y playwright-core@latest <<EOF | tee /tmp/audit-impressum.html
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('$IMPRESSUM_URL', { waitUntil: 'networkidle' });
  console.log(await p.content());
  await b.close();
})();
EOF
}
```

---

## Per-Field Detection Patterns

```bash
# Geschäftsbezeichnung + Anschrift (presence check)
grep -E '(GmbH|UG|AG|e\.K\.|[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+)' /tmp/audit-impressum.html | head -3
grep -E '\b[0-9]{5}\b' /tmp/audit-impressum.html  # German postal code

# E-Mail + Telefon
grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' /tmp/audit-impressum.html | head -3
grep -oE '\+?49[ /-]?[0-9 /-]{7,}' /tmp/audit-impressum.html | head -3

# USt-IdNr.
grep -oE 'DE[ ]?[0-9]{9}' /tmp/audit-impressum.html

# Handelsregister
grep -oE 'HRB[ ]?[0-9]+' /tmp/audit-impressum.html
grep -oE 'Amtsgericht [A-ZÄÖÜ][a-zäöü]+' /tmp/audit-impressum.html

# OS-Streitbeilegung Link
grep -E 'ec\.europa\.eu/consumers/odr' /tmp/audit-impressum.html

# Verbraucherstreitbeilegung Hinweis
grep -E '(Verbraucherstreitbeilegung|Streitbeilegungsverfahren)' /tmp/audit-impressum.html
```

---

## Severity Matrix

| Missing field | Severity |
|---|---|
| Geschäftsbezeichnung + Anschrift | KRITISCH |
| Vertretungsberechtigter (when GmbH/AG/UG) | KRITISCH |
| E-Mail | KRITISCH |
| Telefon | HOCH (some courts accept E-Mail-only; abmahn-risk) |
| HRB + Registergericht (when handelsregister-pflichtig) | KRITISCH |
| USt-IdNr. (when § 27a UStG applies) | KRITISCH |
| Aufsichtsbehörde (for regulated industries) | KRITISCH |
| Berufshaftpflicht (for regulated professions) | KRITISCH |
| OS-Streitbeilegung Link (when B2C online) | HOCH |
| Verbraucherstreitbeilegung Hinweis (B2C) | MITTEL |
| Inhaltlich Verantwortlicher (when journalistic) | KRITISCH |

---

## Cross-Check: Code-Repo (when Layer 7 enabled)

If aegis-audit runs against a local repo (Layer 7 enabled), cross-check:

```bash
# Find impressum data in code
find . -path ./node_modules -prune -o -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' \) -print | xargs grep -lE 'impressum|HRB|USt-IdNr' 2>/dev/null

# Verify code-data matches rendered-data
# E.g., site says HRB 12345 but code has HRB 67890 — drift
```

If drift detected → L3-IMPRESSUM-CODE-DRIFT: HOCH (data inconsistency).

---

## Court-Decision References

For findings, cite court-decisions where applicable:

- KG Berlin 2010-04-21 (5 W 39/10) — vollständiger Name + Anschrift Pflicht
- LG Düsseldorf 2008-05-21 (12 O 250/07) — Telefon Pflicht für unmittelbare Kontaktaufnahme
- EuGH 2008-10-16 (C-298/07) — § 5 TMG (= jetzt DDG §5) ist Verbraucherinformations-Pflicht; B2B + B2C
- BGH 2007-09-20 (I ZR 88/05) — Impressum 2-clicks-rule (vom Footer aus erreichbar)
- LG München I 2022-01-20 (3 O 17493/20) — Google-Fonts (cross-layer with L4 + L5)

---

## Findings Format

```yaml
- id: L3-IMPRESSUM-VAT-MISSING
  layer: 3
  severity: KRITISCH
  evidence:
    url: <impressum-url>
    field: USt-IdNr.
    matches: []
    detection: "no DE-prefixed VAT-ID found in /impressum HTML"
  recommendation: "Add 'Umsatzsteuer-Identifikationsnummer: DE123456789' under § 27a UStG section"
  citation: "DDG § 5 Abs. 1 Nr. 6, § 27a UStG"
  abmahn_risk: "€500-2000 per finding (industry × visibility-dependent)"
```

---

## Anti-Patterns specific to Layer 3

- ❌ Reporting "USt-IdNr. missing" for a Kleinunternehmer (§ 19 UStG) — only § 27a UStG businesses need to publish.
- ❌ Reporting "OS-Streitbeilegung missing" for B2B-only sites — only B2C requires this.
- ❌ Skipping browser-UA fallback — many sites bot-wall scanners; without browser-UA the impressum returns 403.
- ❌ Inferring "Aufsichtsbehörde missing" without first detecting industry — non-regulated industries don't need this.
- ❌ Reporting on Inhaltlich-Verantwortlicher (§ 18 MStV) for non-journalistic sites — pure commercial sites don't need.
- ❌ Reporting "missing Berufshaftpflicht" for unregulated professions — pflicht only for Anwalt / Arzt / Steuerberater / Architekt.
