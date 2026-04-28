# Layer 6 Reference — Branche-Specific (Industry Compliance)

Layer 6 applies industry-specific pflichtangaben + werbevorschriften per the target's branch. Industries handled: BORA (Anwalt), HWG (Heilwesen), LMIV (Lebensmittel), MPDG (Medizinprodukte), GlüStV (Glücksspiel), FernUSG (Fernunterricht), HWO/HwO (Handwerk), GewO (Gewerbeordnung). **Time:** ~5-10 min per target after industry-detection.

---

## Industry Detection

Industry is detected from:

1. The briefing's `industry` field (if customer-build invocation)
2. The target's NAICS / WZ-Code (if available)
3. Heuristic from page-content (keyword-density)

Detection-fallback (heuristic):

```bash
# Anwaltskanzlei
grep -iqE '(Rechtsanwalt|Kanzlei|Fachanwalt|BORA|RVG)' /tmp/audit-html-static.html && industry="anwalt"

# Heilwesen (Arzt, Psychotherapie, Heilpraktiker)
grep -iqE '(Arzt|Ärztin|Praxis|Heilpraktiker|Psychotherapie|Diagnose|Therapie)' /tmp/audit-html-static.html && industry="heilwesen"

# Lebensmittel (Online-Shop)
grep -iqE '(Lebensmittel|Bio-|Allergene|Nährwert|LMIV)' /tmp/audit-html-static.html && industry="lebensmittel"

# Medizinprodukte
grep -iqE '(MPDG|CE-Kennzeichen|Medizinprodukt|UDI|EUDAMED)' /tmp/audit-html-static.html && industry="medizinprodukte"

# Steuerberater
grep -iqE '(Steuerberater|StBerG|StBVV|Steuerkanzlei)' /tmp/audit-html-static.html && industry="steuerberater"

# Architekt
grep -iqE '(Architekt|Architektenkammer|HOAI)' /tmp/audit-html-static.html && industry="architekt"

# Handwerk
grep -iqE '(HwO|Handwerk|Meisterprüfung|Innung)' /tmp/audit-html-static.html && industry="handwerk"

# Default
[ -z "$industry" ] && industry="generic"
```

If detection ambiguous — ask operator. Don't apply Branchen-checks based on weak signal.

---

## BORA — Anwaltskanzlei

| # | Pflichtangabe | Severity if missing |
|---|---|---|
| 1 | Berufsbezeichnung "Rechtsanwalt"/"Rechtsanwältin" + verleihender Staat | KRITISCH |
| 2 | Zuständige Rechtsanwaltskammer | KRITISCH |
| 3 | Berufshaftpflichtversicherung (Versicherer + räumlicher Geltungsbereich) | KRITISCH |
| 4 | Berufsrechtliche Regelungen + zugängliche Quelle (BORA, BRAK, RVG) | HOCH |
| 5 | Fachanwaltsbezeichnungen (when used) — verleihender Staat | HOCH |
| 6 | Hinweis Streitbeilegung (RVG, ZAR) | MITTEL |

**Werbevorschriften (BORA + UWG):**

- Keine reißerische Werbung (BORA § 6)
- Keine vergleichende Werbung mit Mitbewerbern (BORA + UWG)
- Erfolgshonorar-Hinweis (BORA + RVG-Reform 2021) — only when applicable

```bash
# Detection patterns
grep -iE '(garantiere(n)?\s+(Erfolg|Sieg)|100%\s+Erfolg|absolute\s+Sicherheit)' /tmp/audit-html-static.html | head -3
# If matches → L6-BORA-ERFOLGSREKLAME: KRITISCH
```

---

## HWG — Heilwesen (Arzt, Psychotherapie, Heilpraktiker)

| # | Pflichtangabe | Severity |
|---|---|---|
| 1 | Berufsbezeichnung "Arzt"/"Ärztin"/"Heilpraktiker" + verleihender Staat | KRITISCH |
| 2 | Zuständige Aufsichtsbehörde (Landesärztekammer / Gesundheitsamt) | KRITISCH |
| 3 | Berufshaftpflicht | KRITISCH |
| 4 | Approbationsstaat | HOCH |
| 5 | Schwerpunkte / Zusatzbezeichnungen (when used) | HOCH |
| 6 | Berufsordnung-Verweis | MITTEL |

**HWG-Werbevorschriften (Heilmittelwerbegesetz):**

- Kein Werbung mit "neu", "garantiert wirksam", "vollständig heilbar"
- Keine Patientenfotos / -berichte ohne Einwilligung + Datenschutz-Hinweis
- Keine vergleichende Werbung gegenüber anderen Methoden
- Hinweis "Zu Risiken und Nebenwirkungen..." bei Medikamenten

```bash
# Common HWG-Verstöße
grep -iE '(garantierte\s+Heilung|100%\s+wirksam|vollständig\s+heilbar|nebenwirkungs\s*frei)' /tmp/audit-html-static.html
```

---

## LMIV — Lebensmittel-Online-Shop

| Pflicht | Severity if missing |
|---|---|
| Bezeichnung des Lebensmittels (specific, not just brand) | KRITISCH |
| Zutatenliste (in absteigender Mengenreihenfolge) | KRITISCH |
| Allergene (Hervorhebung) | KRITISCH |
| Nettomenge / Gewicht | HOCH |
| Mindestens-Haltbar-Datum / Verbrauchsdatum | HOCH |
| Hersteller / Inverkehrbringer + Anschrift | KRITISCH |
| Ursprungsland (when applicable) | HOCH |
| Nährwertdeklaration (per 100g/100ml) | KRITISCH |
| Anweisungen zur sachgerechten Aufbewahrung | MITTEL |

---

## MPDG — Medizinprodukte

| Pflicht | Severity |
|---|---|
| CE-Kennzeichnung (mit Notified-Body-Nummer für Klasse Is/IIa+) | KRITISCH |
| UDI-DI / UDI-PI (per EU-Verordnung 2017/745) | HOCH |
| EUDAMED-Eintrag (when produced/imported in EU) | HOCH |
| Hersteller + Adresse | KRITISCH |
| Klassifikation (Klasse I/IIa/IIb/III) | HOCH |
| Bevollmächtigter EU (when ext.-EU manufacturer) | KRITISCH |
| Gebrauchsanweisung (PDF-Link or paper) | KRITISCH |

---

## StBerG — Steuerberater

| Pflicht | Severity |
|---|---|
| Berufsbezeichnung "Steuerberater"/"Steuerbevollmächtigter" + verleihender Staat | KRITISCH |
| Zuständige Steuerberaterkammer | KRITISCH |
| StBVV-Hinweis (Vergütung) | HOCH |
| Berufshaftpflicht | KRITISCH |
| Eintragung Berufsregister | HOCH |

---

## HOAI — Architekt

| Pflicht | Severity |
|---|---|
| Berufsbezeichnung "Architekt"/"Architektin" + verleihender Staat | KRITISCH |
| Architektenkammer (Bundesland) | KRITISCH |
| Eintragsnummer | HOCH |
| HOAI-Hinweis (Vergütung) | MITTEL |
| Berufshaftpflicht | KRITISCH |

---

## HwO — Handwerk

| Pflicht | Severity |
|---|---|
| Handwerksrolle + Eintragsnummer (when zulassungspflichtiges Handwerk) | KRITISCH |
| Meisterprüfung-Nachweis (when rolle-pflichtig) | HOCH |
| Zuständige Handwerkskammer | HOCH |
| Innung-Mitgliedschaft (when applicable) | LOW |

---

## GlüStV — Glücksspiel

For online-Glücksspiel: Stricter regime + license-display per GlüStV-2021. Out-of-scope unless target is licensed gambling.

---

## FernUSG — Fernunterricht

If site sells distance-learning (online-courses with Lehrpersonen + Prüfung):

- Zulassung-Nummer FernUSG (ZFU)
- Vertragsbedingungen klar getrennt von Marketing
- Widerrufsbelehrung verlängert (FernUSG)

---

## Findings Format

```yaml
- id: L6-BORA-NO-VERSICHERER
  layer: 6
  industry: anwalt
  severity: KRITISCH
  evidence:
    detected_industry: anwalt
    detection_signal: "Fachanwalt (line 23), BORA (line 47)"
    impressum_url: <url>
    versicherer_present: false
  recommendation: "Add Berufshaftpflichtversicherung (Versicherer + räumlicher Geltungsbereich) per BORA § 7 + DDG § 5 Abs. 1 Nr. 8"
  citation: "BORA § 7, DDG § 5 Abs. 1 Nr. 8, BRAO § 51"
  abmahn_risk: "€2000-7000 (Kammern + Konkurrenz-Anwalt-Abmahnung)"
```

---

## Anti-Patterns specific to Layer 6

- ❌ Applying BORA-checks to a marketing-website that mentions "Rechtsanwalt" as a stock-image alt-text — verify the site is actually offering legal services.
- ❌ Reporting LMIV-violations on a non-online-shop site (e.g., a restaurant blog without ordering) — LMIV applies to commercial offer of food, not editorial.
- ❌ Reporting HWG on a private-blog about wellness — HWG applies to advertising of medicinal products / treatments by professionals.
- ❌ Skipping Layer 6 for "generic" industry — even generic businesses have GewO basics (Gewerbeschein, GewSt-Nummer when applicable).
- ❌ Inferring industry from a single keyword — require multiple signals (e.g., 2+ industry-specific terms before classification).
- ❌ Hard-coding industry-list — the catalog should grow with operator-feedback; new industries added per `references/layer-6-branche-<industry>.md` extension.
