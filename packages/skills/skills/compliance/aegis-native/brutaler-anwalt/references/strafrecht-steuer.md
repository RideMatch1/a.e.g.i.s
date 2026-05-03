# Strafrecht (IT-Bezug) und Steuerrecht / GoBD

> Lade diese Datei bei: Datenpannen, Hacking-Vorwurf, Kryptografie-Pflichten,
> Buchhaltungs-Compliance, Fakturierung, Steuerprueferzugriff (GoBD).

---

## Strafrechtliche IT-Tatbestaende (StGB)

### § 202a StGB — Ausspaehen von Daten
- Tatbestand: Unter Ueberwindung einer Sicherung Daten erschleichen, die nicht fuer einen bestimmt sind.
- Schutzmassnahme „besonderes Sicherheitsverfahren" Pflicht: passwoerter, Verschluesselung, Zugriffskontrolle.
- Strafe: bis 3 Jahre Freiheitsstrafe oder Geldstrafe.
- Praxis-Hinweis: Wenn ein Web-Server keine Verschluesselung verwendet, koennen abgegriffene Daten i.d.R. NICHT als § 202a-Vorfall gelten („keine Sicherung" = nicht strafbar). Aber: Datenpanne nach DSGVO Art. 33 trotzdem moeglich.

### § 202b StGB — Abfangen von Daten
- Tatbestand: Daten waehrend Uebertragung abfangen
- Vor allem: WLAN-Sniffing, Man-in-the-Middle ohne TLS

### § 202c StGB — Vorbereiten des Ausspaehens („Hackertools-Paragraph")
- Tatbestand: Herstellen, Vertreiben, Verschaffen von Tools mit Tatabsicht
- Praxis: Pen-Testing-Tools nur mit Einverstaendnis nutzen

### § 263a StGB — Computerbetrug
- Tatbestand: Vermoegens-Schaedigung durch Manipulation eines Datenverarbeitungsvorgangs
- Beispiel: Manipulierte Online-Shop-Bestellung, die Bezahlung umgeht

### § 269 StGB — Faelschung beweiserheblicher Daten
- Tatbestand: digitale Daten so manipulieren, dass sie als echt erscheinen (z.B. gefaelschte E-Mail-Header, Logs)

### § 303a StGB — Datenveraenderung
- Tatbestand: Loeschen, Unterdruecken, Veraendern fremder Daten

### § 303b StGB — Computersabotage
- Tatbestand: Stoerung der Datenverarbeitung von erheblicher Bedeutung
- DDoS-Attacken, Ransomware

### Strafrechtliche Verantwortung des Geschaeftsfuehrers
- Wenn Datenpanne erfolgt + GF-Pflichten verletzt → § 130 OWiG (Aufsichtspflichtverletzung) ODER strafrechtliche Beihilfe
- Bei NIS2 (ab 2024): persoenliche Haftung Geschaeftsleitung verschaerft

### Pruefpunkte fuer Skill
- [ ] HTTPS auf gesamter Site (sonst § 202a wirft tief)
- [ ] TLS 1.2+, korrekte Cipher-Suite
- [ ] Verschluesselung sensibler Daten in Datenbank (z.B. AES-256)
- [ ] Pen-Test-Hinweis auf Site? — Erklaerung dass Tests nur mit Einverstaendnis gemacht werden
- [ ] Bei ehemaligen Mitarbeitern: Logs-Loesch-Konzept (sonst § 303a moeglich bei Manipulation)
- [ ] DDoS-Schutz: zumindest Cloudflare-Free oder Vercel-Edge

---

## Datenpannen-Anzeigepflicht

### Strafrechtlich
- Datenpanne selbst i.d.R. nicht strafbar
- ABER wenn vorsaetzlich versteckt: § 263 StGB (Betrug) oder § 130 OWiG moeglich
- Bei Beteiligung an strafbaren Handlungen Dritter: Strafvereitelung § 258 StGB

### Verwaltungsrechtlich (DSGVO)
- 72 h Meldung an Aufsichtsbehoerde (Art. 33)
- Unverzueglich Betroffene informieren (Art. 34)

### Anzeigepflicht zivilrechtlich (BGB)
- Schadensersatzanspruch Art. 82 DSGVO (immateriell auch ohne realen Missbrauch, EuGH C-340/21)
- Im B2B: vertragliche Haftung fuer Datenpannen (oft in AGB ausgeschlossen — § 307 BGB pruefen)

### Vorgehen bei Datenpanne (Skill-Pattern)
1. Erkennung dokumentieren (Datum, Zeitstempel, Ausmass)
2. Innerhalb 72 h: Aufsichtsbehoerde-Meldung (Art. 33). Spaeter ist Bussgeld zu erwarten.
3. Bei hohem Risiko fuer Betroffene: zusaetzlich Art. 34-Information unverzueglich
4. Forensik einschalten
5. Anzeige bei Polizei wenn Hacking erkennbar (§§ 202a/263a/303a/b StGB)
6. Pressemitteilung vorbereiten (PR-Schaden minimieren)
7. Anwalts-Briefing fuer Schadensersatz-Verteidigung

---

## GoBD (Grundsaetze ordnungsgemaesser Buchfuehrung)

### Volltext / Grundlage
- BMF-Schreiben 28.11.2019 + Aktualisierung 11.07.2023
- https://www.bundesfinanzministerium.de
- Konkretisiert Buchfuehrungs-Pflichten aus § 145 ff. AO + § 257 HGB im digitalen Zeitalter

### Kerngrundsaetze
- **Vollstaendigkeit**: Alle Geschaeftsvorfaelle erfasst
- **Richtigkeit**: Daten korrekt
- **Zeitgerechte Buchungen**: Belege binnen 10 Tagen, Buchungen lfd.
- **Ordnung**: Systematische Ablage
- **Unveraenderbarkeit**: Aenderungen nachvollziehbar protokolliert
- **Maschinelle Auswertbarkeit**: Daten in maschinenlesbarem Format archivieren

### Aufbewahrungsfristen
- Buchungsbelege: **10 Jahre** (§ 147 AO)
- Geschaeftsbriefe: **6 Jahre** (§ 257 HGB)
- E-Mails mit handelsrechtlichem Bezug: **6 Jahre** (gilt wie Geschaeftsbrief!)
- Vertrags-Dokumente: 10 Jahre (Pflicht) oder bis Ende Mandanten-Beziehung

### Datenzugriff durch Steuerprueferin (§ 147 Abs. 6 AO)
- Z1: Unmittelbarer Zugriff auf System (Lesemodus)
- Z2: Mittelbarer Zugriff (Auswertungen via Steuerpflichtiger)
- Z3: Datentraegerueberlassung (Format konform GDPdU/GoBD)

### Pruefpunkte fuer Online-Shops / SaaS
- [ ] Rechnungen revisionssicher archiviert (Manipulations-geschuetzt)
- [ ] E-Mail-Archivierung mit Verschlagwortung + Suchbarkeit
- [ ] PDF-Rechnungen mit qualifizierter elektronischer Signatur (qeS) ODER Aufbewahrung im urspruenglichen Format
- [ ] Buchhaltungs-Tool zertifiziert (z.B. lexoffice, sevDesk, DATEV) ODER eigene Loesung mit Verfahrens-Dokumentation
- [ ] Verfahrens-Dokumentation vorhanden (welche Software, welche Prozesse, welche Sicherungen)
- [ ] Bei Steuerpruefung: Z1/Z2/Z3-Zugriff vorbereitet
- [ ] Aufbewahrungsfristen eingehalten — keine vorzeitige Loeschung von Belegen

### Risiko bei Verstoss
- Schaetzungsbescheid (§ 162 AO): Steuerprueferin schaetzt Umsatz / Gewinn — meist hoch
- Bussgeld (§ 379 AO): bis 25.000 € pro Verstoss
- Strafrechtlich: § 370 AO Steuerhinterziehung bei Vorsatz

### Skill-Pattern fuer GoBD-Audit
Bei E-Commerce-/SaaS-Sites pruefen:
- [ ] Verfahrens-Dokumentation auffindbar?
- [ ] Belegarchivierung Online-Tool oder lokal?
- [ ] Bei Subscription-SaaS: Wiederkehrende Rechnungen + Storno-Vermerke korrekt?
- [ ] Stripe/PayPal-Pay-Outs korrekt verbucht (USt korrekt nach Lieferschwelle / OSS)?
- [ ] OSS-Verfahren bei EU-B2C-Vertrieb genutzt (One-Stop-Shop seit 2021)?

---

## Beschaeftigtendatenschutz (§ 26 BDSG)

### Rahmen
- Verarbeitung von Mitarbeiter-Daten nur zu Zwecken des Beschaeftigungsverhaeltnisses
- Einwilligung selten wirksam (Machtgefaelle)
- Betriebsrat-Mitbestimmung (§ 87 BetrVG) bei IT-Systemen die Verhalten ueberwachen

### Pruefpunkte fuer Web-Apps mit Mitarbeiter-Daten
- [ ] Mitarbeiter-Login-System: Logs aufbewahren wie lange? § 26 BDSG begrenzt
- [ ] Videoueberwachung (z.B. CMS mit Kamerafeed): § 4 BDSG
- [ ] Tracking von Mitarbeiter-Productivity: i.d.R. ohne Betriebsvereinbarung unzulaessig
- [ ] HR-Daten: AVV mit HR-SaaS-Anbieter

### Cross-Risiko mit Skill
Wenn die Site Mitarbeiter-Login enthaelt + keine separate Beschaeftigten-Datenschutzerklaerung → KRITISCH (Notebooksbilliger-Bussgeld 10,4 Mio.).

---

## Anti-Geldwaesche (GwG)

### Bei Online-Bezahlung > 1.000 € regelmaessig
- Identifikation Geschaeftspartner (KYC)
- Sorgfaltspflichten § 10 ff. GwG
- Verdachtsanzeige FIU bei Verdacht

### Pruefpunkte
- [ ] Bei B2C > 1.000 €: KYC-Prozess?
- [ ] Bei B2B: UBO (Ultimate Beneficial Owner) bekannt?
- [ ] Verdachtsmeldungen-Prozess dokumentiert?

---

## Kryptografie-Pflichten

### Nichts explizit gesetzlich, aber:
- Art. 32 DSGVO: „angemessene TOMs" — TLS, Verschluesselung at-rest, Pseudonymisierung
- BSI IT-Grundschutz: Ciphersuite-Empfehlungen
- bei NIS2 (kritische Sektoren): Verschluesselungs-Pflichten verschaerft

### Pruefpunkte
- [ ] HTTPS auf gesamter Domain
- [ ] TLS 1.2+ (TLS 1.0/1.1 deaktiviert)
- [ ] HSTS aktiv
- [ ] Bei Datenbank: AES-256 oder vergleichbar bei sensiblen Feldern
- [ ] Bei Backups: Verschluesselt (idealerweise asymmetrisch fuer Master-Key)

---

## Skill-Pattern Strafrecht / GoBD

```
Finding: Datenpanne nicht innerhalb 72 h gemeldet
- §: Art. 33 DSGVO + § 130 OWiG (Aufsichtspflicht)
- Az.: OLG Hamm 11 U 88/22 (20.01.2023) — auch versehentliche Mails sind Datenpannen, 100 EUR Schadensersatz pro Betroffenem
- Strafrechtlich: § 263 StGB falls vorsaetzliche Verschleierung erkennbar
- Bussgeld DSGVO: Stufe 1 (Art. 83 Abs. 4)
- Risiko-Vektor:
  - Aufsichtsbehoerde: 5.000–500.000 € je nach Schwere
  - Strafanzeige durch Betroffene: moeglich bei Vorsatz
  - Schadensersatz Art. 82: typisch 100–5.000 € pro Betroffenem
- Fix:
  1. Sofort Aufsichtsbehoerde-Meldung (Formular auf Behoerden-Website)
  2. Bei hohem Risiko: Art. 34-Information an Betroffene
  3. Forensik einschalten
  4. Anwalt fuer Schadensersatz-Verteidigung beauftragen
```
