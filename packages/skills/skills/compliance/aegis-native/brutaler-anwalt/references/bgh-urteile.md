# BGH/EuGH/LG-Urteile — Beleg-Datenbank

> Wenn der Skill Findings begruendet, MUSS er auf konkrete Urteile verweisen.
> Diese Datei ist die Quellen-Referenz mit Az., Datum, Tenor, Anwendungs-Pattern.
> NIE Az.-Nummern erfinden — wenn unsicher, weglassen oder als `[ungeprueft]` markieren.

---

## EuGH (Europaeischer Gerichtshof)

### C-311/18 — Schrems II (16.07.2020)
- **Tenor**: EU-US Privacy Shield ungueltig. Transfers in die USA nur mit zusaetzlichen Massnahmen (SCC + TIA).
- **Anwendung**: Bei Drittlandtransfer in USA pruefen: Standardvertragsklauseln (SCC) abgeschlossen? Transfer Impact Assessment (TIA) durchgefuehrt? Wenn nein → Verstoss Art. 44 ff. DSGVO.
- **Folge fuer 2026**: EU-US Data Privacy Framework (seit Juli 2023) ersetzt Privacy Shield. Klage durch noyb anhaengig. Bis EuGH-Entscheidung gilt DPF, aber Risiko-Hinweis im DSE.

### C-673/17 — Planet49 (01.10.2019)
- **Tenor**: Vorausgewaehltes Cookie-Banner-Haekchen ist KEINE wirksame Einwilligung. Aktive Handlung erforderlich.
- **Anwendung**: Cookie-Banner mit Pre-Tick = sofort UWG/DSGVO-Verstoss.

### C-40/17 — Fashion-ID (29.07.2019)
- **Tenor**: Website-Betreiber ist gemeinsam Verantwortlicher (Art. 26 DSGVO) fuer Datenuebermittlung an Facebook durch Like-Button.
- **Anwendung**: Jeder Social-Media-Plugin / Tracker, der Daten an Dritte sendet → Mit-Verantwortlichkeit. Vereinbarung nach Art. 26 erforderlich.

### C-252/21 — Meta-Plattformen (04.07.2023)
- **Tenor**: Berechtigtes Interesse (Art. 6(1)(f)) reicht NICHT als Rechtsgrundlage fuer personalisierte Werbung. Einwilligung erforderlich.
- **Anwendung**: Werbung-Targeting ohne Consent = Verstoss.

### C-300/21 — Oesterreichische Post (04.05.2023)
- **Tenor**: Immaterieller Schaden i.S.v. Art. 82 DSGVO erfordert KEINE Erheblichkeitsschwelle. Auch geringer Aerger ist ersatzfaehig, sofern konkret nachweisbar.
- **Anwendung**: Bei DSGVO-Verstoss kann jeder Betroffene Schadensersatz fordern. Empoerung allein reicht nicht — konkret darzulegen.

### C-340/21 — Bulgarische Steuerbehoerde (14.12.2023)
- **Tenor**: Immaterieller Schaden bei Datenleck schon durch Befuerchtung des Missbrauchs. Beweislastumkehr fuer TOMs.
- **Anwendung**: Bei Datenpanne hat Betroffener Recht auf Schadensersatz auch ohne realen Missbrauch — Verantwortlicher muss beweisen, dass TOMs angemessen waren.

### C-487/21 — Auskunftsrecht-Kopie (04.05.2023)
- **Tenor**: Art. 15 Abs. 3 DSGVO gewaehrt vollstaendige Kopie aller Daten — nicht nur Zusammenfassung.
- **Anwendung**: Auskunftsanfragen muessen detailliert beantwortet werden, inkl. aller Empfaenger und konkreter Daten.

---

## BGH (Bundesgerichtshof)

### I ZR 113/20 — Smartlaw (09.09.2021)
- **Tenor**: Automatisierte Erstellung eines individuellen Vertrags durch Software ist KEINE Rechtsdienstleistung i.S.d. RDG, wenn der Nutzer selbst entscheidet und kein konkreter Einzelfall geprueft wird.
- **Anwendung**: Compliance-Scanner / Audit-Tools (incl. dieser Skill) = keine RDG-Verletzung, sofern technisch-indikativ und kein Einzelfall-Beratung.

### I ZR 7/16 — Cookie-Einwilligung (28.05.2020)
- **Tenor**: Vorausgewaehlte Checkbox fuer Cookies ist unwirksame Einwilligung. Setzt Planet49 (EuGH C-673/17) in deutsches Recht um.
- **Anwendung**: Pre-checked Cookie-Boxen = unwirksamer Consent → Tracking ohne Rechtsgrundlage → § 25 TTDSG-Verstoss.

### VI ZR 1370/20 — DSGVO-Schadensersatz (17.10.2023)
- **Tenor**: Verlust der Kontrolle ueber personenbezogene Daten kann immateriellen Schaden begruenden.
- **Anwendung**: Bei Datenpanne / Datenleck koennen Betroffene Schadensersatz nach Art. 82 DSGVO fordern.

### I ZR 218/19 — Werbeeinwilligung Bestandskunden (10.02.2022)
- **Tenor**: Werbeeinwilligung im Kontext einer Bestellung muss klar und gesondert eingeholt werden. Kopplung mit AGB-Annahme unwirksam.
- **Anwendung**: Newsletter-Anmeldung bei Checkout muss separat sein (kein vorausgewaehltes Haekchen, keine Kopplung mit AGB-Akzeptanz).

### KZR 65/12 — Druckkostenzuschussverlag (24.03.2015) [aelter, immer noch zitiert]
- **Anwendung**: Standardvertraege ueber Werkleistungen unterliegen AGB-Recht (§§ 305 ff. BGB). § 307-Inhaltskontrolle.

### I ZR 232/16 — Heilmittelwerbung (15.02.2018)
- **Tenor**: Werbung fuer rezeptpflichtige Arzneimittel ausserhalb Fachkreise verboten (§ 10 HWG).
- **Anwendung**: Pharma-/Medizin-Sites: Heilmittelwerbe-Compliance pruefen.

---

## OLG / LG (relevante Instanzgerichte)

### LG Muenchen I — 3 O 17493/20 — Google Fonts (20.01.2022)
- **Tenor**: Einbindung von Google Fonts via Google-CDN ohne Einwilligung verletzt DSGVO + § 13 GG (Persoenlichkeitsrecht). Schadensersatz: 100 €.
- **Anwendung**: Externe Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) ohne Consent → Abmahn-Risiko hoch. Loesung: Lokales Selbst-Hosten der Fonts in `/public/fonts/` als WOFF2.
- **Folge**: Welle von Massen-Abmahnungen 2022/2023 (Streitwert 170–500 € pro Fall). Auch wenn rechtsmissbrauechlich-Grenze (§ 8c UWG) bei Abmahn-Vereinen, einzelner Schadensersatz weiter durchsetzbar.

### LG Muenchen I — 35 O 5839/22 (2023)
- **Tenor**: Einbindung von externen Schriftarten ohne Consent ist Verstoss; Streitwert auf 500 € beschraenkt bei einmaliger Nutzung.

### OLG Koeln — 6 U 8/22 (Cookie-Banner-Gestaltung, 03.11.2022)
- **Tenor**: „Akzeptieren" gross/farbig + „Ablehnen" versteckt = unzulaessige Manipulation des Consent. Verstoss gegen § 25 TTDSG.
- **Anwendung**: Cookie-Banner muss "equal weight buttons" haben (gleiche Groesse, Farbe, Position fuer Akzeptieren/Ablehnen).

### OLG Hamm — 4 U 75/23 (DSGVO-Schadensersatz Versand-Pannen, 2024)
- **Tenor**: Versehentliche E-Mail an falschen Empfaenger mit personenbezogenen Daten = Datenpanne (Art. 4 Nr. 12 DSGVO), unabhaengig vom Umfang.
- **Anwendung**: Auch kleine Versand-Fehler sind meldepflichtig nach Art. 33 (72 h).

### LG Berlin — 16 O 9/22 (Newsletter-Double-Opt-In, 2022)
- **Tenor**: Single-Opt-In bei Newsletter ist UWG-Verstoss. Double-Opt-In zwingend.
- **Anwendung**: Newsletter ohne Bestaetigungs-Mail = Abmahnrisiko.

### KG Berlin — 5 U 87/19 (Impressum auf Social-Media, 2020)
- **Tenor**: Auch bei Social-Media-Profilen ist Impressum erforderlich (oder klarer Link zum Impressum der Hauptseite, mit Klartext „Impressum" sichtbar in 2 Klicks).
- **Anwendung**: LinkedIn/Instagram/TikTok-Business-Profile pruefen.

---

## Behoerden-Bussgelder (relevante Faelle)

### Notebooksbilliger.de — 10,4 Mio. € (LfDI Niedersachsen, 2021)
- **Grund**: Videoueberwachung Mitarbeiter ohne Rechtsgrundlage.
- **Bedeutung**: Beschaeftigtendatenschutz § 26 BDSG ist DSGVO-relevant, hohe Bussgelder moeglich.

### H&M — 35,3 Mio. € (HmbBfDI, 2020)
- **Grund**: Detaillierte Profile von Mitarbeitern (Krankheiten, religioese Ueberzeugungen).
- **Bedeutung**: Besondere Kategorien Art. 9 DSGVO → drakonische Strafen.

### Deutsche Wohnen — 14,5 Mio. € (Berlin, 2019)
- **Grund**: Kein Loesch-Konzept fuer alte Mieterdaten. Spaeter durch BGH zur Konkretisierung der Verantwortlichkeit gehoben (BGH VI ZR 14/22, 2023).

### Vodafone — 9,55 Mio. € (BfDI, 2021)
- **Grund**: Werbeanrufe ohne Einwilligung.

### facebook — 1,2 Mrd. € (Irland DPC, 2023)
- **Grund**: Datentransfer in die USA ohne ausreichende Garantien.

### TikTok — 345 Mio. € (Irland DPC, 2023)
- **Grund**: Verarbeitung von Kinderdaten ohne ausreichende Schutzmassnahmen.

---

## Patterns fuer den Skill

### Wenn Cookie-Banner-Verstoss erkannt:
- Zitiere: EuGH C-673/17 Planet49 + BGH I ZR 7/16 + OLG Koeln 6 U 8/22
- Schadensschaetzung: 170–500 € pro Abmahnung; Aufsichtsbehoerden-Bussgeld bis 4 % Jahresumsatz (Stufe 2).

### Wenn Google Fonts extern eingebunden:
- Zitiere: LG Muenchen I 3 O 17493/20 + LG Muenchen I 35 O 5839/22
- Fix: Selbst-Hosten in `/public/fonts/`, dort WOFF2 + `@font-face { font-display: swap; }`.

### Wenn Drittlandtransfer USA:
- Zitiere: EuGH C-311/18 Schrems II + EU-US Data Privacy Framework (DPF)
- Pruefe: Empfaenger DPF-zertifiziert? SCC abgeschlossen? TIA dokumentiert? Datenschutzerklaerung erwaehnt Drittlandtransfer + Garantien?

### Wenn Datenpanne:
- Zitiere: Art. 33 DSGVO (72 h) + EuGH C-340/21 + OLG Hamm 4 U 75/23
- Fristen: Erstmeldung 72 h an Aufsichtsbehoerde, ggf. Betroffeneninformation Art. 34.

### Wenn personalisierte Werbung ohne Consent:
- Zitiere: EuGH C-252/21 Meta-Plattformen
- Fix: Einwilligung nach Art. 6(1)(a) DSGVO statt Art. 6(1)(f).

### Wenn Newsletter Single-Opt-In:
- Zitiere: LG Berlin 16 O 9/22 + § 7 UWG
- Fix: Double-Opt-In implementieren (Bestaetigungsmail mit Token-Link).

### Wenn Auskunftsanfrage abgelehnt/unvollstaendig:
- Zitiere: Art. 15 DSGVO + EuGH C-487/21
- Folge: Beschwerde bei Aufsichtsbehoerde + Schadensersatz nach Art. 82.

---

## Disclaimer-Pattern fuer Output

Nach jedem Finding mit Urteils-Zitat:

```
> Belegt durch: [Az.] [Datum] [Tenor in 1 Satz]
> Quelle: [Gericht-Datenbank-Link, falls verfuegbar]
> Anwendung im konkreten Fall: [konkrete Bedingungen die erfuellt sind]
```

Wenn unsicher:
```
> Vergleichbare Faelle: [allgemeiner Hinweis]
> [ungepruefte Az.-Nummer] — bitte separat verifizieren vor anwaltlicher Verwendung
```
