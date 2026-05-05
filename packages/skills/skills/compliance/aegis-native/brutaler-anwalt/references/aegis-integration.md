# AEGIS-Integration

> Wenn das Projekt das AEGIS-Scanner-System hat (Indikator: `src/scanner/`-Folder
> mit tier1/tier2/tier3, oder `aegis.config.json` im Repo-Root), kann der
> brutaler-anwalt-Skill die AEGIS-Findings als Eingabe konsumieren und in
> rechtliche Bewertungen ueberfuehren.

---

## Projekt-Erkennung

```
File-Indikatoren:
- /src/scanner/{tier1,tier2,tier3}/index.ts
- /aegis.config.json
- /aegis-reports/*.json
- package.json mit "aegis" oder "@aegis/*" deps oder scripts:aegis
```

Wenn keiner davon vorhanden → AEGIS-Integration ueberspringen, normalen SCAN-Modus fahren.

---

## AEGIS-Modul-Mapping

### Tier-1 Module (Infrastruktur / Headers)

| AEGIS-Modul | Pruefung | Rechts-Bezug | Wenn AEGIS critical/high → Anwalt-Bewertung |
|------------|----------|--------------|---------------------------------------------|
| `dns.ts` / `dns.dnssec.ts` | DNS / DNSSEC-Validation | BSI-Empfehlung, NIS2 angemessene TOMs | Eher BSIG/NIS2-Layer, nicht direkt UWG-relevant |
| `geo-ip.ts` | Server-Standort | DSGVO Art. 44 (Drittlandtransfer) wenn US-Server | KRITISCH wenn Server in USA + keine Erwaehnung in DSE |
| `headers.ts` | Security-Headers (CSP, X-Frame, X-Content-Type) | BSI-Empfehlung, Art. 32 DSGVO TOMs | HOCH wenn fehlt + Datenpanne moeglich |
| `hsts-preload.ts` | HSTS-Aktivierung | BSI-Empfehlung | MITTEL — Empfehlung, kein direkter Verstoss |
| `http-status.ts` | Site-Erreichbarkeit | nicht direkt rechtlich | Nicht relevant fuer Anwalt |
| `lang-canonical.ts` | hreflang / canonical | SEO + DSGVO Sprachpflichten Art. 12 (verstaendlich) | NIEDRIG — nur bei mehrsprachiger Seite mit anderssprachigem DSE |
| `linked-pages.ts` | Footer-Pflicht-Links | § 5 DDG Impressum-Erreichbarkeit | KRITISCH wenn Impressum/DSE/AGB nicht in 2 Klicks |
| `ports.ts` | Offene Ports | BSI / NIS2 | Nicht direkt rechtlich |
| `schema-org.ts` | strukturierte Daten | SEO, nicht direkt rechtlich | NIEDRIG — bestenfalls Vertrauenssignal |
| `security-txt.ts` | security.txt | BSI-Empfehlung | NIEDRIG |
| `server-stack.ts` | Stack-Erkennung | bei veralteten Versionen → Art. 32 TOMs | HOCH wenn EOL-Versionen erkannt |
| `block-lists.ts` | Threat-Intel-Listen | Reputation, nicht direkt rechtlich | NIEDRIG |

### Tier-2 Module (DSGVO-Kern)

| AEGIS-Modul | Pruefung | Rechts-Bezug | Wenn AEGIS critical/high |
|------------|----------|--------------|--------------------------|
| `cookie-audit.ts` | Cookie-Inventar vor Consent | § 25 TTDSG, Art. 6 DSGVO | KRITISCH — direkt abmahnbar (LG Muenchen, OLG Koeln) |
| `embeds-consent.ts` | Iframe/Embed vor Consent | Art. 26 DSGVO Mit-Verantwortlichkeit (Fashion-ID) | KRITISCH — Vimeo/YouTube/Spotify ohne Consent → Verstoss |
| `font-provider.ts` | Externe Fonts | LG Muenchen 3 O 17493/20 | KRITISCH — Google Fonts extern = Massen-Abmahn-Risiko |
| `links-footer.ts` | Footer-Pflicht-Links | § 5 DDG, § 13 DSGVO | KRITISCH wenn Impressum/DSE-Link fehlt |
| `tracking-scan.ts` | Tracker vor Consent | § 25 TTDSG | KRITISCH — Google Analytics/Pixel ohne Consent |

### Tier-3 Module (Rechtliche Vollpruefung)

| AEGIS-Modul | Pruefung | Rechts-Bezug | Wenn AEGIS critical/high |
|------------|----------|--------------|--------------------------|
| `a11y.ts` | Barrierefreiheit | BFSG (ab 28.06.2025 verpflichtend!) | HOCH — ab Jun 2025 abmahnbar fuer B2C-Sites |
| `branche.ts` | Branchen-spezifische Pflichten | BORA, HOAI, HWG, LMIV, MPDG | KRITISCH wenn Branche identifiziert + Pflichten fehlen |
| `carbon.ts` / `carbon-status.ts` | CO2-Footprint | Nicht direkt rechtlich (noch) | NIEDRIG — kann unter Greenwashing-UWG fallen |
| `cookie-compliance.ts` | Cookie-Banner-Compliance Detail | § 25 TTDSG + Art. 7 DSGVO | KRITISCH bei Pre-Tick / Cookie-Wall / Dark-Pattern |
| `datenschutz-check.ts` | DSE-Vollpruefung | Art. 13/14 DSGVO | KRITISCH bei fehlenden Pflichtangaben |
| `impressum-check.ts` | Impressum-Vollpruefung | § 5 DDG | KRITISCH bei fehlenden Pflichtangaben |
| `lighthouse.ts` | Performance / SEO / A11y | Mittelbar BFSG/Verbraucherschutz | MITTEL |
| `seo-quality.ts` | SEO-Audit | UWG bei Black-Hat / Schleichwerbung | NIEDRIG-MITTEL |

---

## Schweregrad-Mapping AEGIS → Anwalt

| AEGIS-Severity | Anwalt-Kritikalitaet | Wahrsch.-Default | Bemerkung |
|----------------|---------------------|------------------|-----------|
| `critical` | 🔴 KRITISCH | 70–95 % | direkt verifiziert; Wahrsch. konkret aus Branche/Sichtbarkeit |
| `high` | 🟡 HOCH | 40–70 % | verifiziert mit potentieller Schutzlinie |
| `medium` | 🟢 MITTEL | 10–40 % | nur wenn weitere Faktoren zusammenkommen |
| `low` | (i.d.R. ignorieren) | < 10 % | nur erwaehnen, nicht in Findings-Tabelle |
| `info` | (ignorieren) | n/a | Hintergrund-Info, kein Finding |

**CHALLENGER-Test fuer AEGIS-Findings**:
- AEGIS findet technisch X (z.B. fehlender HSTS-Header).
- Frage: Hat das DIRECT rechtliche Konsequenz, oder nur indirekt ueber Datenpanne-Auswirkung?
- Wenn nur indirekt → Finding nicht als KRITISCH einstufen, sondern als MITTEL mit Hinweis „TOM-Empfehlung Art. 32 DSGVO, kein Direktverstoss".

---

## Konsumieren von AEGIS-JSON-Output

AEGIS-Output-Format (typisch, kann projektspezifisch variieren):

```json
{
  "url": "https://example.com",
  "scannedAt": "2026-04-27T20:15:00Z",
  "score": 950,
  "grade": "S",
  "tier1": {
    "headers": { "severity": "high", "findings": [...] }
  },
  "tier2": {
    "cookie-audit": { "severity": "critical", "findings": [
      { "name": "_ga", "category": "analytics", "setBeforeConsent": true }
    ]}
  },
  "tier3": { ... }
}
```

**Skill-Vorgehen**:
1. Lese JSON aus `aegis-reports/latest.json` oder `/tmp/aegis-scan.json`.
2. Iteriere ueber alle Module. Fuer jedes Modul mit severity `critical|high`:
   - Mappe via Tabelle oben auf Rechts-Bezug.
   - HUNTER notiert das als Finding.
3. CHALLENGER prueft jedes Finding gegen den Modul-spezifischen Test (siehe Bemerkungs-Spalte oben).
4. SYNTHESIZER konsolidiert + erkennt Cross-Risiken (z.B. fehlender Impressum-Link in Footer + DSE-Verstoss = doppeltes Abmahnrisiko ueber UWG § 3a).

---

## Cross-Module-Patterns (Synthesizer)

Wenn mehrere AEGIS-Findings zusammenkommen, kombiniere sie:

| AEGIS-Findings (zusammen) | Synthesizer-Cross-Risiko |
|---------------------------|--------------------------|
| `cookie-audit critical` + `tracking-scan critical` | Verdoppelter § 25 TTDSG-Hebel; Abmahn-Wahrsch. > 80% wenn Site B2C-DACH |
| `font-provider critical` + `embeds-consent critical` | Google-Fonts-Welle 2022 Pattern; mehrere Abmahn-Anwaelte aktiv; € 170-500 pro Fall |
| `impressum-check critical` + `linked-pages critical` (Footer) | UWG § 3a Marktverhaltensregel; jeder Mitbewerber kann abmahnen |
| `datenschutz-check critical` + `branche.ts critical` | DSGVO + branchenrechtliche Pflicht (z.B. BORA, HWG); doppeltes Bussgeldrisiko |
| `geo-ip US` + `tracking-scan` (US-Tracker) + `datenschutz-check` (kein Drittland-Hinweis) | Schrems-II-Kombi; Bussgeldrisiko Stufe 2 |

---

## Beispiel-Output bei AEGIS-Input

Wenn das Projekt einen AEGIS-Scan mit folgenden critical-Findings hat:
- `cookie-audit`: Google Analytics setzt `_ga` vor Consent
- `font-provider`: 3x `fonts.googleapis.com` extern eingebunden
- `impressum-check`: Telefonnummer fehlt

dann generiert HUNTER:

```
Finding 1: Tracking-Cookie vor Consent (cookie-audit)
- Wahrsch.: 87% (B2C-DACH-Site, sichtbar, Konkurrenz aktiv)
- Kritikalitaet: 🔴 KRITISCH
- §: 25 TTDSG + Art. 6 DSGVO
- €-Range: 5.000–15.000 (UWG-Streitwert) + bis 4 % JU (DSGVO-Bussgeld)
- Belege: EuGH C-673/17 Planet49, BGH I ZR 7/16

Finding 2: Externe Google Fonts (font-provider)
- Wahrsch.: 92% (LG-Muenchen-Welle aktiv, Massen-Abmahnung)
- Kritikalitaet: 🔴 KRITISCH
- §: Art. 6 DSGVO + § 13 GG
- €-Range: 170-500 pro Abmahnung; bei Welle: x10-x100
- Belege: LG Muenchen I 3 O 17493/20

Finding 3: Impressum unvollstaendig (impressum-check)
- Wahrsch.: 64% (UWG-Mitbewerber-Abmahnungen aktiv)
- Kritikalitaet: 🟡 HOCH
- §: § 5 DDG (Telefon empfohlen, nicht zwingend; Mail Pflicht)
- €-Range: 800–4.000 (UWG-Streitwert)
- Belege: KG Berlin 5 U 87/19, allg. UWG-Abmahnpraxis

CHALLENGER-Tests:
- Finding 1: Verifiziert (Tracker fix vor Consent → keine Schutz-Linie).
- Finding 2: Verifiziert (Font extern, kein Loading-Trick erkennbar).
- Finding 3: Disputed → § 5 DDG verlangt nicht zwingend Telefon (E-Mail reicht).
  Downgrade auf MITTEL, 31% Wahrsch., €-Range 0-1.500.

SYNTHESIZER:
- Cross-Risiko: Finding 1 + Finding 2 = doppelter UWG § 3a-Hebel.
  Kombinierter Streitwert: 25.000 €. Massen-Abmahn-Welle moeglich.
- Worst-Case-Frist: 6-8 Wochen bis erste Abmahnung wahrscheinlich.
- Top-Fix-Prio: 1) Cookie-Banner Consent-vor-Tracker, 2) Fonts lokal hosten,
  3) Impressum optional vervollstaendigen.
```

---

## Trigger-Pattern in Code

Wenn der User in einem AEGIS-Repo arbeitet und Audit anfragt:

```
1. Pruefe ob aktueller AEGIS-Scan-Output existiert:
   - aegis-reports/latest.json
   - /tmp/aegis-scan-${timestamp}.json
   
2. Wenn ja → konsumiere als HUNTER-Eingabe
   Wenn nein → schlage Scan-Run vor:
   `pnpm aegis scan` oder `npm run aegis:scan` (je nach package.json)
   
3. Nach Scan: Konsumiere JSON, fuehre Multi-Persona-Audit aus.
```

---

## A.E.G.I.S Standalone-CLI (optional Add-On)

Es gibt ZUSAETZLICH den **a.e.g.i.s** Standalone-Scanner als open-source npm-Paket (MIT-Lizenz):

- **Repo**: https://github.com/RideMatch1/a.e.g.i.s
- **NPM**: `@aegis-scan/cli`
- **Stack**: Next.js + Supabase + React (framework-spezifische Rules)
- **Komponenten**: 40 regex-Scanner + 1 AST-Taint-Analyzer + 1 RPC-SQLi-Scanner + 16 external-tool-Wrapper (Semgrep, Gitleaks, ZAP, Trivy, Nuclei, Bearer, Checkov, Hadolint, TruffleHog, OSV-Scanner, testssl.sh, React Doctor, Lighthouse, Axe, ...) + 5 live-attack-Probes + 4 Compliance-Frameworks (GDPR/SOC2/ISO27001/PCI-DSS) + MCP-Server fuer AI-Agents + GitHub-Actions-Recipe.

### Verwendung als Erweiterung zum Skill

Wenn der User explizit eine **tiefere technische Pruefung** (Code-Taint, SAST, Compliance-Frameworks) wuenscht ueber die Page-Content-Analyse hinaus:

```bash
# In ein beliebiges Repo (Next.js/React/Supabase)
npx @aegis-scan/cli scan --output aegis-report.json

# Ergebnis: aegis-report.json mit 40 Scanner-Findings + Taint-Analysis +
# externe-Tool-Outputs + 0-1000 Score + FORTRESS→CRITICAL Grade.
```

Der Skill kann dann den `aegis-report.json` analog zu jedem operator-internen
Scanner konsumieren (selbe Schweregrad-Mapping-Tabelle).

### Compliance-Frameworks-Mapping (a.e.g.i.s → Anwalts-Bewertung)

| a.e.g.i.s Framework | Anwalts-Aequivalent |
|--------------------|---------------------|
| GDPR (4 Rules) | DSGVO-Layer (`references/dsgvo.md`) |
| SOC 2 | ISO 27001 / Art. 32 DSGVO TOMs (`references/it-recht.md` NIS2) |
| ISO 27001 | Art. 32 DSGVO TOMs / NIS2 |
| PCI-DSS | nur relevant bei Kreditkarten-Verarbeitung — Bank/Versicherungs-Layer (`references/branchenrecht.md`) |

Bei DSGVO-spezifischen a.e.g.i.s-Findings: pruefe Cross-Risiko mit Pages-Content-Analyse, da DSGVO oft sowohl Code-Layer (Datenflusss) als auch Inhalts-Layer (DSE-Erwaehnung, Consent-Banner) betrifft.

### Nutzungs-Empfehlung

- **Default-SCAN-Modus des Skills**: Nutze nur den operator-internen Scanner (falls vorhanden) ODER reine Pages-Content-Analyse. Schnell + token-effizient.
- **Tiefe-Mode**: Wenn User `/anwalt scan --deep` oder Aehnliches anfragt: Schlage zusaetzlich `@aegis-scan/cli` vor.
- **CI-Mode**: a.e.g.i.s liefert eine GitHub-Actions-Recipe (`ci/github-action/`) — koennte vom User in CI eingebunden werden, dann konsumiert der Skill die PR-Comments mit Score + Top-Findings.

### Hinweis fuer Skill-Output

Wenn ein Audit a.e.g.i.s-Ergebnisse einbezieht, in der Disclaimer-Note erwaehnen:
> Tiefenscanning durch a.e.g.i.s (open-source @aegis-scan/cli, MIT-Lizenz, ergaenzend zu Semgrep/CodeQL — nicht Ersatz). Findings sind technisch-indikativ; rechtliche Bewertung durch Anwalts-Anhang dieses Skills, nicht durch a.e.g.i.s selbst.

---

## AEGIS-False-Positives — Häufige Patterns (post-2026-05-05)

Aus realen Audits zusammengetragen. Wenn AEGIS einen dieser Befunde
meldet, sollte der CHALLENGER ihn als `false-positive` oder `disputed`
einordnen, **nachdem** der Code-Kontext verifiziert wurde.

### XSS-Checker / Bearer / Semgrep — `dangerouslySetInnerHTML`-FPs

| AEGIS-Pattern | Realität | CHALLENGER-Verify |
|---------------|----------|-------------------|
| `dangerouslySetInnerHTML` mit JSON.stringify(staticObject) | Schema.org JSON-LD aus statischer siteConfig — kein User-Input-Pfad | grep nach `JSON.stringify` direkt davor; pruefen ob Object-Keys aus User-Land oder aus `siteConfig` |
| `dangerouslySetInnerHTML` nach `formatMessageContent(text)` | DOMPurify.sanitize() läuft am Ende der Funktion — AEGIS sieht den Sanitize-Call nicht | grep `DOMPurify.sanitize` in derselben Datei. Wenn vorhanden + `ALLOWED_TAGS`-Whitelist + `ALLOWED_URI_REGEXP`: FP |
| `dangerouslySetInnerHTML` für Animation-Effekt (Style-Tag mit Tailwind-Variablen) | Statisches Style-String, keine User-Inputs | Code-Kontext lesen, prüfen ob String aus Constants oder Props |
| Server-side `escapeHtml()` in E-Mail-Template | Nodemailer-Output, KEIN React-Render — kein XSS-Vektor | Wenn `nodemailer.sendMail()` der Empfänger ist: FP |

### Bearer / Open-Redirect-Pattern

| AEGIS-Pattern | Realität | CHALLENGER-Verify |
|---------------|----------|-------------------|
| `router.push(url)` / `window.location.href = url` | Wenn `url` aus `new URL(window.location.href)` mit `searchParams.delete/set` konstruiert ist: bereits same-origin by construction | grep nach `URL(window.location.href)` direkt darüber. Wenn keine `?callbackUrl=`-Param-Lesung: FP |
| `router.push(callbackUrl)` aus URL-Param | Echter Open-Redirect-Vektor | Allowlist-Check fordern (relative Pfade only, kein Schema, kein `//`) |

### Supply-Chain-Scanner — Typosquatting-FPs

| AEGIS-Pattern | Realität | CHALLENGER-Verify |
|---------------|----------|-------------------|
| `gsap` ↔ `tsup` (L-Distanz 2) | GreenSock-Animation, etabliert seit 2008 | npm download stats > 1M/wk |
| `lenis` ↔ `redis`/`less` (L-Distanz 2) | Darkroom Engineering Smooth-Scroll, etabliert | npm download stats |
| `ogl` ↔ andere | Minimal-WebGL-Lib, etabliert | npm download stats |
| Native binaries (`unrs-resolver`, fsevents, lightningcss) | Build-Dependencies des Frameworks | bekannt aus Tailwind/Next.js-Stack |

### http-timeout-checker

| AEGIS-Pattern | Realität | CHALLENGER-Verify |
|---------------|----------|-------------------|
| `fetch(url, { signal: controller.signal })` mit setTimeout-cleanup | Funktional äquivalent zu `AbortSignal.timeout()` | Code-Lesen: gibt es `setTimeout(..., timeout)` + `clearTimeout`? Dann FP |
| `fetch(url)` ohne signal | Echter Timeout-Bug | Fix fordern: `AbortSignal.timeout(MS)` |

### entropy-scanner — Marketing-Strings

| AEGIS-Pattern | Realität | CHALLENGER-Verify |
|---------------|----------|-------------------|
| Hohe Entropie in `content-map.ts` / FAQ-Strings | Marketing-Text mit Listen, Preisen, Features | Code-Kontext prüfen — wenn Kommentar/JSDoc oder Strings nahe `description:`-Properties: FP |

### Wann KEIN FP angenommen werden darf

CHALLENGER soll NICHT pauschal alle BEARER/Semgrep/Supply-Chain-Findings als FP markieren. Diese Regeln gelten **nur**, wenn:
1. Der Code-Kontext explizit gelesen wurde (`Read`-Tool, nicht nur Filename)
2. Mindestens ein objektiver Verify-Schritt aus der jeweiligen Tabelle erfüllt ist
3. Keine User-Input-Quelle in den letzten 5 Code-Zeilen vor dem AEGIS-Hit liegt

Bei Unsicherheit: `disputed` markieren statt `false-positive`, mit Begründung im Anwalts-Anhang.
