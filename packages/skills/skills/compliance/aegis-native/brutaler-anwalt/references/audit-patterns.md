# Audit-Patterns — Standardisierte HUNTER-Methodik

> Erfahrungs-extrahierte Audit-Patterns aus realen Live-Audits.
> Wenn der Skill einen Web-Audit fuehrt, soll er DIESE Pattern-Reihenfolge
> systematisch durchlaufen. Lieber zu paranoid als zu lax.

---

## Phase 1: HEADER-AUDIT (curl -sSI)

### CSP-Anti-Patterns (sofort 🔴 KRITISCH)

| Pattern | Kritikalitaet | Empfehlung | Az. / Quelle |
|---------|--------------|-----------|--------------|
| `script-src ... 'unsafe-inline'` | 🔴 KRITISCH | strict-dynamic + per-request-nonce migrieren | Mozilla A+ / OWASP CSP Cheat Sheet |
| `style-src ... 'unsafe-inline'` | 🟡 HOCH | nonce oder hashes; bei Tailwind: kein Workaround → akzeptiert | Mozilla A+ |
| `script-src ... 'unsafe-eval'` (Production) | 🔴 KRITISCH | wasm-unsafe-eval reicht meist; eval = XSS-Vektor | OWASP |
| `default-src *` oder `default-src 'unsafe-inline'` | 🔴 KRITISCH | nicht zulaessig; explizite Whitelists | OWASP |
| `frame-ancestors 'none'` fehlt + X-Frame-Options fehlt | 🔴 KRITISCH | Clickjacking-Vektor | BSI |
| Keine `frame-ancestors` und keine X-Frame-Options | 🔴 KRITISCH | siehe oben |  |

### CSP-Drittland-Auto-Detection (🔴 KRITISCH bei Match)

Pruefe ob folgende Domains in CSP `script-src`, `style-src`, `font-src`, `connect-src`, `img-src`, `frame-src`:

| Domain in CSP | Auto-Finding |
|---------------|--------------|
| `fonts.googleapis.com` | 🔴 KRITISCH — LG Muenchen I 3 O 17493/20, Schadensersatz 100€/Visitor, Massen-Abmahn-Pattern |
| `fonts.gstatic.com` | 🔴 KRITISCH — siehe oben |
| `googletagmanager.com` | 🟡 HOCH wenn aktiv — § 25 TTDSG Consent-Pflicht, EuGH C-673/17 |
| `google-analytics.com` | 🟡 HOCH wenn aktiv — § 25 TTDSG + Drittlandtransfer USA |
| `connect.facebook.net` / `*.facebook.com` | 🔴 KRITISCH — Fashion-ID-Mit-Verantwortlichkeit, EuGH C-40/17 |
| `*.linkedin.com` (Insight Tag) | 🟡 HOCH — § 25 TTDSG Consent |
| `*.x.com` / `*.twitter.com` (Embeds) | 🟡 HOCH — Fashion-ID-Pattern |
| `*.tiktok.com` / `tiktokapis.com` | 🟡 HOCH — China-Drittland-Layer; CCP-Datenzugriff-Risiko |
| `*.stripe.com` | 🟢 MITTEL — US-Drittland; Stripe ist DSGVO-konform aber Erwaehnung in DSE Pflicht |
| `*.youtube.com` | 🟡 HOCH — wenn nicht youtube-nocookie.com → § 25 TTDSG |
| `youtube-nocookie.com` | 🟢 NIEDRIG (akzeptiert, DSE-Erwaehnung trotzdem) |
| `vimeo.com` / `player.vimeo.com` | 🟡 HOCH — Drittland + Tracking-Cookies |
| `*.openstreetmap.org` / `nominatim.openstreetmap.org` | 🟢 MITTEL — UK-Foundation; Drittland-Hinweis in DSE noetig |
| `maps.googleapis.com` | 🔴 KRITISCH ohne ConsentGate — Google Maps API loadet ohne Consent direct, Daten-Uebertragung an Google |
| `js.stripe.com` | 🟢 MITTEL — US, aber DSGVO-OK mit DSE-Erwaehnung |

### Sicherheits-Header-Vollstaendigkeit (1 Punkt pro vorhandenem Header)

| Header | Pflicht | Score wenn fehlt | Note |
|--------|---------|-----------------|------|
| `Strict-Transport-Security` (HSTS) | ✅ | -10 | Plus `preload` Bonus |
| `X-Frame-Options: DENY` oder `SAMEORIGIN` | ✅ | -10 | wenn frame-ancestors da, optional |
| `X-Content-Type-Options: nosniff` | ✅ | -5 | |
| `Referrer-Policy` | ✅ | -5 | strict-origin-when-cross-origin empfohlen |
| `Permissions-Policy` | ✅ | -5 | mind. camera/microphone/geolocation regulieren |
| `Cross-Origin-Opener-Policy` (COOP) | empf | -3 | same-origin-allow-popups |
| `Cross-Origin-Embedder-Policy` (COEP) | empf | -3 | credentialless empfohlen |
| `Cross-Origin-Resource-Policy` (CORP) | empf | -3 | same-origin |
| `X-XSS-Protection: 0` ODER nicht gesetzt | best-practice | 0 (no penalty) | "1; mode=block" ist veralteter Pattern |
| `X-Permitted-Cross-Domain-Policies: none` | optional | 0 | Anti-Adobe-Flash |
| `Content-Security-Policy` (mit nonce + strict-dynamic) | ✅ | -20 | wichtigster Header |

---

## Phase 2: HTML-LIVE-PROBE

### Pflicht-Checks

```
- Title gesetzt
- Genau 1 H1
- H1 hat sichtbaren Text (nicht nur Bild oder leerer span)
- H1 nicht initial opacity:0 (LCP-Killer Pattern empirisch beobachtet 2026-04-27 — wenn Above-the-Fold-CSS das H1 mit `opacity:0` ausblendet und JS-Animation das nicht innerhalb des LCP-Fensters wieder aufdeckt, liest Lighthouse das H1 als nicht-sichtbar und bricht den LCP-Score ein)
- meta-description vorhanden
- canonical-Link
- hreflang bei mehrsprachigen Sites
- Cookie-Banner-Indikator (vanilla-cookieconsent / cookiebot / usercentrics / borlabs / tarteaucitron)
- KEIN direkter <script src="https://www.googletagmanager.com"> ohne Consent
- KEIN direkter <link href="https://fonts.googleapis.com"> (KRITISCH — LG Muenchen)
- KEIN <iframe src="https://www.youtube.com/..."> (sondern youtube-nocookie.com oder ConsentGate)
```

### Image-Source-Audit

Sammle alle `<img src="https://...">` und `<picture>` external sources. Map auf Drittland:
- *.amazonaws.com → US
- *.googleapis.com / lh3.googleusercontent.com → US
- *.cloudfront.net → US
- *.unsplash.com → US
- *.shopify.com → US/Cookie
- *.ggpht.com → US (Google)
- *.supabase.co → meist EU (eu-central-1) wenn richtig konfiguriert; sonst US

→ Cross-Check: Sind alle in DSE erwaehnt + Drittland-Hinweis?

---

## Phase 3: IMPRESSUM-AUDIT

### Pflicht-Felder (§ 5 DDG)

| Pflicht | Pattern-Hinweis | Bei Fehlen |
|---------|----------------|------------|
| Vollstaendiger Name (Person) ODER Firma + Rechtsform | "Inhaber: …", "Firma … UG/GmbH/GbR" | KRITISCH — Anbieter-Identifikation |
| Postanschrift (kein Postfach) | PLZ + Ort + Strasse | KRITISCH |
| Kontakt: E-Mail (Pflicht), Telefon (empfohlen, nicht zwingend laut BGH) | mailto-Link / `+49 …` | E-Mail KRITISCH, Telefon HOCH |
| USt-IdNr. (wenn vorhanden) | DE\d{9} | nur wenn UStG-relevant |
| Wirtschafts-ID (wenn) | § 139c AO | optional |
| Handelsregister + Nummer (bei Eintragung) | HRB \d+ + Registergericht | KRITISCH wenn UG/GmbH ohne |
| Vertretungsberechtigte (jur. Personen) | "vertreten durch …" | KRITISCH bei UG/GmbH |
| Aufsichtsbehoerde (falls relevant) | "Zustaendige Behoerde …" | bei reg. Berufen Pflicht |
| Berufsbezeichnung + Verleihungsstaat (Heilberufe/Anwaelte) | … | Branchen-spezifisch Pflicht |
| Verantwortlich nach § 18 Abs. 2 MStV (journalistisch) | "Verantwortlich i.S.d. …" | nur bei Blog/News |
| EU-Streit-Plattform-Link | https://ec.europa.eu/consumers/odr | KRITISCH bei B2C-Online-Shops |
| Verbraucherschlichtung-Hinweis (ja/nein) | "nicht teil…", "bereit, an …" | empf bei B2C |
| DDG statt TMG (seit 14.05.2024) | "§ 5 DDG" / "§ 7 Abs. 1 DDG" | Modernitaets-Indikator |

### Anbieter-Identifikations-Patterns (robust)

```
1. <h2|h3>Anbieter (gemaess|nach) § 5 DDG?</h2|h3>
   → next <p>|<address> ist der Anbieter-Block
2. <h2|h3>Angaben (gemaess|nach) § 5 DDG?</h2|h3>
   → next <p>|<address> ist der Anbieter-Block
3. Direkt am Page-Anfang (bei einfachen Impressums)
4. <address>...</address> Tag (semantisches Markup)
5. Microdata: itemscope itemtype="http://schema.org/Organization"
```

Wenn KEINER dieser Patterns matched → KRITISCH-Finding: Anbieter unklar identifizierbar.

---

## Phase 4: DSE-AUDIT

### Pflicht-Sektionen (Art. 13 DSGVO)

| # | Sektion | Pflicht | Bei Fehlen |
|---|---------|---------|------------|
| 1 | Verantwortlicher (Name, Adresse, Kontakt) | ✅ | KRITISCH |
| 2 | Datenschutzbeauftragter (wenn vorhanden) | ✅ falls Pflicht (>20 MA mit reg. Verarbeitung) | HOCH wenn Pflicht aber fehlt |
| 3 | Zwecke + Rechtsgrundlagen pro Verarbeitung | ✅ | KRITISCH |
| 4 | Empfaenger / Kategorien von Empfaengern | ✅ | KRITISCH |
| 5 | Drittland-Transfer + Garantien (SCC/Adequacy) | ✅ wenn Drittland | KRITISCH bei US-Diensten ohne Hinweis |
| 6 | Speicherdauer pro Datenkategorie | ✅ | HOCH |
| 7 | Betroffenenrechte: Auskunft (Art. 15), Berichtigung (16), Loeschung (17), Einschraenkung (18), Portabilitaet (20), Widerspruch (21), Beschwerde Aufsichtsbehoerde | ✅ | KRITISCH wenn unvollstaendig |
| 8 | Widerrufsrecht fuer Einwilligungen | ✅ | KRITISCH bei consent-basierten Diensten |
| 9 | Quelle der Daten (bei Dritterhebung Art. 14) | ✅ wenn relevant | HOCH |
| 10 | Automatisierte Entscheidungen / Profiling | ✅ wenn vorhanden | HOCH wenn vorhanden aber nicht erwaehnt |
| 11 | Fuer JEDEN aktiven externen Dienst: eigener Block mit Anbieter, Adresse, Datentyp, Rechtsgrundlage, Speicherdauer, Drittland-Hinweis | ✅ | je 1 Punkt pro fehlendem Dienst |

### Service-zu-DSE Cross-Check (Service-Inventory)

```
1. Sammle ALLE in CSP whitelisted Drittland-Domains.
2. Sammle alle in src/ tatsaechlich genutzten externen Services (grep -E 'fetch|axios|XMLHttpRequest' + URL-Match).
3. Sammle alle <script src="..."> + <link href="..."> + <iframe src="..."> in HTML.
4. Konsolidiere: aktive externe Services.
5. Cross-check gegen DSE-Erwaehnung (ggf. Synonym-Liste: "Stripe" auch "Stripe Inc.", "Stripe Payments")
6. Pro NICHT-erwaehnter aktiver Service:
   - Wahrscheinlichkeit: hoch wenn Drittland (Schrems-II-Cluster)
   - Schadensvektor: Aufsichtsbehoerden-Bussgeld + Schadensersatz Art. 82
   - Fix-Vorschlag: konkreter Text-Block-Vorschlag fuer DSE
```

---

## Phase 5: COOKIE-/CONSENT-AUDIT

### Pflicht-Checks (§ 25 TTDSG)

```
1. Cookie-Banner sichtbar bei Erstbesuch?
2. Banner zeigt Akzeptieren + Ablehnen + Anpassen — gleichwertig (gleiche Groesse/Farbe/Position)?
3. Pre-Checked-Boxen? (UNZULAESSIG — EuGH C-673/17 Planet49)
4. Cookie-Wall (Inhalte gesperrt bis Akzeptieren)? (Borderline — OLG Muenchen erlaubt mit gleichwertiger Alternative)
5. Tracking-Tools laden VOR Consent? (KRITISCH — gtag, _ga, fbq, etc. duerfen erst nach Consent)
6. Widerrufs-Mechanismus (Cookie-Settings-Link im Footer)?
7. Consent dokumentiert (Backend-Log mit consentId, Zeitpunkt, Umfang, Version)?
8. Cookie-Tabelle in DSE: konkrete Cookie-Namen + Zweck + Speicherdauer?
```

### Cookie-Banner-Live-Detection

```bash
# Header-Indikator
curl -sS https://example.com | grep -iE 'cookieconsent|cookiebot|usercentrics|borlabs|tarteaucitron|cmplz|complianz'

# Wenn keine Library erkennbar + JS-Tracker geladen → SOFORT KRITISCH
# Lass dann den User die Library benennen oder beweisen dass kein Tracker laeuft
```

---

## Phase 6: BRANCHEN-LAYER (wenn identifizierbar)

Branchen-Identifikation ueber:
- siteConfig.serviceType / industry
- Domain-Name-Patterns (anwalt.example.com, .arzt-, kanzlei-)
- Page-Content (Hero/H1)
- schema.org Organization @type
- Footer-Hinweise (Kammer, Berufsbezeichnung)

→ Lade `references/branchenrecht.md` mit der passenden Sektion.

### Sonder-Patterns

| Branche-Hint | Zusatz-Pruefung |
|--------------|------------------|
| Pet-Health-/Tier-Apps mit KI-Diagnose | HWG-naehe — KI darf NICHT als Heilmittel-Empfehlung framed sein. Disclaimer "ersetzt keinen Tierarzt" Pflicht. |
| Online-Coaching / Kurse | FernUSG-Check (BGH 2024 — ZFU-Pflicht?) |
| Online-Shop B2C | Button-Loesung "zahlungspflichtig bestellen", Widerrufsbelehrung, PAngV |
| Anwalt | BORA-Werbeverbot pruefen |
| Heilberuf | HWG + Berufsordnung |
| Architekt | HOAI-Hinweise |
| KI-Funktionen | EU AI Act Risikoklasse + Disclaimer |

---

## Phase 7: CSP-CODE-CROSS-CHECK (Code-Layer)

Wenn lokal Repo-Zugriff vorhanden:

```bash
# Fuer jede in CSP allowed Domain:
grep -rEn "DOMAIN" src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js"

# Wenn 0 Treffer (ausser proxy.ts/middleware.ts/csp-config) → CSP-Tightening empfohlen
# Wenn Treffer → bestaetigt aktiv → DSE-Erwaehnungs-Check
```

Wenn lokale Code-Pfade nicht vorhanden:
- Live-HTML-Scan + Network-Analyse (JS-loaded resources)
- Performance-Tab Approximation: alle externen Requests die von der Site ausgehen

---

## Phase 8: SCHADENS-DIAGNOSE-FORMEL (Synthesizer)

### Wahrscheinlichkeits-Berechnung

```
P(Abmahnung 90 Tage) = base_rate × industry_factor × visibility_factor × competitor_activity × verstoss_kombination

base_rate (DACH): 0.10–0.40 fuer KMU mit 1+ verifiziertem Verstoss
industry_factor:
  - Anwaelte/Heilberufe = 1.5 (mehr Konkurrenz, mehr Abmahn-Anwaelte)
  - E-Commerce B2C = 1.7 (Pflicht-Pflicht-Pflicht-Falle)
  - SaaS B2B = 0.8 (weniger Abmahn-Druck)
  - Pet-/Tier-Apps = 1.0
visibility_factor:
  - viel SEO + Werbung = 1.3
  - eher unterhalb-Radar = 0.7
competitor_activity:
  - bekannte Abmahn-Welle (Google Fonts 2022) = 2.0
  - normal = 1.0
verstoss_kombination:
  - 1 Verstoss = 1.0
  - 2 Verstoesse synergistisch = 1.4
  - 3+ Verstoesse synergistisch = 1.8
```

### €-Schadensschaetzung

```
- Abmahnung Wettbewerber: Streitwert × 0.13 (RVG 1,3 Geschaeftsgebuehr)
  - Streitwert siehe abmahn-templates.md Tabelle
- Aufsichtsbehoerde-Bussgeld: pruefe Stufe 1 (10 Mio./2%) vs Stufe 2 (20 Mio./4%); fuer KMU realistisch 5.000–50.000 €
- Schadensersatz Art. 82 DSGVO (immaterieller): 100–5.000 € pro Betroffener; bei Datenleck mit vielen Betroffenen schnell 6-stellig
- Bei Massen-Abmahnung (Google Fonts-Pattern): 170-500 € pro Visitor × Anzahl Visitors mit Anzeige
```

---

## Anti-Pattern (was Skill nicht tun darf)

- ❌ KEINE pauschalen %-Schaetzungen ohne Begruendungs-Kette aus den oberen Faktoren
- ❌ KEINE Annahme dass Skipping ein bestimmtes Audit-Phase „ok" ist; minimal alle 8 Phasen abklopfen
- ❌ KEINE False-Positive-Aktion: Wenn Header X fehlt, IMMER CHALLENGER fragen „aber wirkt sich das tatsaechlich aus, oder ist es nur Defense-in-depth?"
- ❌ KEIN „CSP-allowed = aktiv" — IMMER Code-Cross-Check oder Live-HTML-Verifikation
