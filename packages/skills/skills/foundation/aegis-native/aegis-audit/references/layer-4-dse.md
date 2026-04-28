# Layer 4 Reference — DSE (Datenschutzerklärung, DSGVO Art. 13/14)

Layer 4 verifies the Datenschutzerklärung against DSGVO Art. 13 (Informationspflicht bei Erhebung beim Betroffenen) + Art. 14 (Erhebung bei Dritten) + Drittlandtransfer-Konformität (Schrems-II / SCC). **Time:** ~5-10 min per target.

---

## Art. 13 Pflichtangaben Checklist

| # | Field | Severity if missing |
|---|---|---|
| 1 | Verantwortlicher (Name + Anschrift) | KRITISCH |
| 2 | Vertreter in der EU (when applicable) | HOCH |
| 3 | Datenschutzbeauftragter (when applicable per Art. 37) | HOCH (when pflicht) |
| 4 | Verarbeitungszwecke + Rechtsgrundlage (Art. 6 / Art. 9) | KRITISCH |
| 5 | Berechtigte Interessen (when Art. 6 Abs. 1 lit. f) | HOCH |
| 6 | Empfänger / Empfängerkategorien | HOCH |
| 7 | Drittlandtransfer + Schutzgarantien | KRITISCH (when transfer happens but DSE absent) |
| 8 | Speicherdauer / Löschkonzept | HOCH |
| 9 | Betroffenenrechte (Art. 15-22) | KRITISCH |
| 10 | Beschwerderecht bei Aufsichtsbehörde | HOCH |
| 11 | Pflicht zur Bereitstellung + Folgen | MITTEL |
| 12 | Automatisierte Entscheidung / Profiling | HOCH (when applicable) |

---

## Probe Pattern

```bash
# Resolve DSE-URL (often /datenschutz, /privacy, /datenschutzerklaerung)
DSE_URL=$(node -e "
  const html = require('fs').readFileSync('/tmp/audit-html-static.html', 'utf-8');
  const match = html.match(/href=['\"]([^'\"]*(datenschutz|privacy)[^'\"]*)['\"]/i);
  console.log(match ? new URL(match[1], '$TARGET').href : '');
")

curl -sL -A "Mozilla/5.0" "$DSE_URL" > /tmp/audit-dse.html
```

---

## Per-Field Detection Patterns

```bash
# Verantwortlicher (matches typical phrasing)
grep -E 'Verantwortliche[r]?\s+i[mn]?\s+Sinne' /tmp/audit-dse.html

# Datenschutzbeauftragter
grep -iE '(Datenschutzbeauftragte[rn]|Data Protection Officer|DSB)' /tmp/audit-dse.html

# Verarbeitungszwecke (look for Art. 6 references)
grep -E 'Art\.\s*6\s*Abs\.\s*1\s*lit\.\s*[abcdef]' /tmp/audit-dse.html

# Drittlandtransfer (US, GB post-Brexit)
grep -iE '(Drittland|USA|United States|Standardvertragsklauseln|SCC|Privacy Shield|TIA)' /tmp/audit-dse.html

# Speicherdauer
grep -iE '(Speicherdauer|Löschkonzept|Aufbewahrungsfrist)' /tmp/audit-dse.html

# Betroffenenrechte (Art. 15-22)
grep -E 'Art\.\s*1[5-9]|Art\.\s*2[0-2]' /tmp/audit-dse.html
grep -iE '(Auskunftsrecht|Berichtigung|Löschung|Einschränkung|Datenübertragbarkeit|Widerspruch)' /tmp/audit-dse.html

# Beschwerderecht
grep -iE '(Beschwerderecht|Aufsichtsbehörde|Datenschutzbeauftragte des Landes)' /tmp/audit-dse.html
```

---

## Drittland-Transfer Detection (cross-check Layer 1 + Layer 5)

Layer 4 cross-references with Layer 1 (CDN / 3rd-party domains in HTTP-headers) + Layer 5 (cookies set by 3rd-party trackers) to detect:

```bash
# 3rd-party domains active on the page (from Layer 1 / Layer 5)
3p_domains=$(grep -oE 'https?://[^/]+' /tmp/audit-html-dynamic.html | sort -u | grep -v "$TARGET_DOMAIN")

# For each 3rd-party, check if DSE mentions it
for domain in $3p_domains; do
  if grep -q "$domain" /tmp/audit-dse.html; then
    echo "L4-DSE-MENTIONS: $domain ✓"
  else
    echo "L4-DSE-3P-NOT-MENTIONED: $domain (HOCH)"
  fi
done
```

US-headquartered 3rd-parties (Google, Meta, Cloudflare, AWS) trigger Drittlandtransfer concerns. DSE MUST mention:

- The 3rd-party (by name or category)
- The country of transfer
- The schutzgarantien (SCC + TIA per Schrems-II requirements post-2020-07-16 EuGH C-311/18)

If 3rd-party transfer happens AND DSE doesn't address it → KRITISCH (Schrems-II).

---

## Common Schrems-II Findings

| 3rd-party | DSE-required addressing |
|---|---|
| Google Fonts (when loaded from fonts.googleapis.com) | KRITISCH if not local-bundled (LG München I 2022-01-20 3 O 17493/20) |
| Google Analytics (without IP-anonymization + consent) | KRITISCH |
| Google Maps embed (without consent OR static-image-fallback) | HOCH |
| reCAPTCHA v3 (silent tracking) | KRITISCH |
| Cloudflare (when used as CDN with EU-traffic) | MITTEL (DPA exists; SCC referenced) |
| AWS / Azure / GCP (US-region) | HOCH (require SCC-DPA) |
| Vercel (US-hosted) | MITTEL (Vercel offers DPA) |
| Mailchimp / Sendinblue / Brevo | HOCH (US/EU split, requires SCC) |

For each, check if DSE has the required transfer-section AND processor-AVV (Auftragsverarbeitung) listing.

---

## AVV-List Detection

DSGVO Art. 28 requires AVV (Auftragsverarbeitung-Vertrag) for every processor handling personal data. DSE should reference:

```bash
grep -iE '(Auftragsverarbeitung|Art\.\s*28|AVV)' /tmp/audit-dse.html
```

For each 3rd-party from Layer 1 + 5: AVV must exist (signed contract); DSE should mention by name.

---

## Severity Matrix

| Missing | Severity |
|---|---|
| Verantwortlicher (Art. 13 Abs. 1 lit. a) | KRITISCH |
| Verarbeitungszwecke + Rechtsgrundlage (Art. 13 Abs. 1 lit. c-d) | KRITISCH |
| Betroffenenrechte (Art. 15-22) | KRITISCH |
| Drittlandtransfer + SCC + TIA (when transfer happens) | KRITISCH |
| Speicherdauer (Art. 13 Abs. 2 lit. a) | HOCH |
| Empfänger (Art. 13 Abs. 1 lit. e) | HOCH |
| Beschwerderecht (Art. 13 Abs. 2 lit. d) | HOCH |
| Datenschutzbeauftragter (when pflicht per Art. 37) | HOCH |
| Vertreter in der EU (when ext.-EU controller) | HOCH |
| Automatisierte Entscheidung (when applicable) | HOCH |
| Pflicht zur Bereitstellung (Art. 13 Abs. 2 lit. e) | MITTEL |

---

## Court-Decision References

- EuGH 2020-07-16 (C-311/18) — Schrems-II — invalidation of Privacy Shield; SCC + TIA required
- LG München I 2022-01-20 (3 O 17493/20) — Google-Fonts via Google CDN = Drittlandtransfer ohne Rechtsgrundlage; 100€ Schadensersatz pro Betroffenem
- BGH 2020-05-28 (I ZR 7/16) — Cookie-Banner BGB
- OLG Düsseldorf 2019-03-26 (I-20 U 75/18) — DSE als wettbewerbsrechtliche Pflicht (UWG abmahnbar)
- EDSA Recommendations 01/2020 — Schutzgarantien-Beurteilung TIA-Methodik

---

## Findings Format

```yaml
- id: L4-DSE-DRITTLAND-MISSING
  layer: 4
  severity: KRITISCH
  evidence:
    dse_url: <dse-url>
    detected_3p: ["fonts.googleapis.com", "www.google-analytics.com"]
    dse_mentions_drittland: false
    dse_mentions_scc: false
  recommendation: "Add Drittlandtransfer-section listing US-3rd-parties (Google Fonts, GA), reference SCC + TIA per Schrems-II"
  citation: "DSGVO Art. 13 Abs. 1 lit. f, Art. 46; EuGH C-311/18 (Schrems-II); LG München I 3 O 17493/20"
  abmahn_risk: "€2000-15000 per Betroffenem (LG München-Linie); aggregated risk per visitor-month"
```

---

## Anti-Patterns specific to Layer 4

- ❌ Reporting "Drittlandtransfer missing" without verifying transfer actually happens — first detect 3rd-parties via Layer 1 + 5.
- ❌ Skipping AVV-cross-check — Art. 28 AVV is separate from Art. 13 DSE.
- ❌ Reporting "DSB missing" for small businesses (< 20 employees handling personal data routinely) — Art. 37 thresholds apply.
- ❌ Inferring DSE-completeness from word-count — short DSE can be complete; long DSE can miss fields.
- ❌ Reporting on automatisierte Entscheidung when site has no profiling — only applies when profiling/decisions actually happen.
