# Branchen-spezifisches Recht

> Lade diese Datei wenn die zu pruefende Site einer regulierten Branche zugehoert.
> Branchen-Identifikation moeglich aus: siteConfig.serviceType, Domain-Name,
> Page-Content (Hero/Headlines), strukturierte Daten (schema.org).
> Bei mehreren Branchen → alle relevanten Sektionen pruefen.

---

## Heilberufe (Aerzte, Heilpraktiker, Zahnaerzte)

### Heilmittelwerbegesetz (HWG)
- **Volltext**: https://www.gesetze-im-internet.de/heilmwerbg/
- Verbot bestimmter Werbung fuer Arzneimittel und Heilbehandlungen
- § 3 HWG: Verbot irrefuehrender Werbung
- § 11 HWG: Verbot Werbung mit Erfolgsgarantien, Vorher/Nachher-Bildern (eingeschraenkt)

### Berufsordnung Aerzte (Musterberufsordnung MBO-AE)
- Standesregeln der Landesaerztekammern
- Kein anpreisendes Werben (§ 27 MBO-AE), nur sachliche Information
- Patienten-Bewertungen / Rezensionen: Heikel — keine selektive Praesentation

### Patientenrechtegesetz (BGB §§ 630a ff.)
- Behandlungsvertrag, Aufklaerungs- und Dokumentationspflichten
- Bei Online-Terminbuchung: Aufklaerungspflicht beachten

### Pruefpunkte fuer Skill (Aerzte/Heilberufe-Sites)
- [ ] Berufsbezeichnung + Staat der Verleihung im Impressum (§ 5 DDG)
- [ ] Zustaendige Aerztekammer
- [ ] Berufsrechtliche Regelungen mit Fundstelle (Link auf Kammer)
- [ ] Keine irrefuehrende Werbung, keine Erfolgsgarantien
- [ ] Bei Heilmittel-Werbung: HWG-Compliance (§§ 3, 11)
- [ ] Bei Praxisinformation: Praxisgemeinschaft vs. Berufsausuebungsgemeinschaft korrekt benennen
- [ ] Notfallbereitschaft / Vertretungsregelung im Verhinderungsfall

### Typische Verstoesse
- Vorher/Nachher-Bilder bei Schoenheits-OPs ohne klar dokumentierte Aufklaerung
- Werbe-Slogans wie „bester Arzt in [Stadt]" → § 11 HWG
- Online-Terminbuchung ohne Hinweis auf Behandlungsvertrag
- Patientenrezensionen-Ausschnitte (selektive Cherry-Picking)

---

## Spa / Wellness / Kosmetik / Massage (V4-Pattern, post-Art-9-Workflow-Audit 2026-05-03)

### Trigger
- URL-Pattern: `*-spa.*`, `*-wellness.*`, `*-kosmetik.*`, `*-beauty.*`, `*-massage.*`, `*hotel*spa*`, `*beauty-salon*`
- Content-Keywords: „Anamnese", „Allergien", „Kontraindikationen", „Hauttyp", „Schwangerschaftsmassage", „Behandlungsraeume"
- schema.org @type: `BeautySalon`, `DaySpa`, `HealthAndBeautyBusiness`
- Cross-Branche: oft gemischt mit `LodgingBusiness` (Hotel-Spa) oder `MedicalBusiness` (Med-Spa mit Heilpraktiker)

### Branchen-Klassifikation (KRITISCH fuer Rechtsfolge)

| Setup | Rechtsregime | Aufbewahrung | DSGVO-Rechtsgrundlage |
|-------|--------------|--------------|------------------------|
| Reine Wellness/Kosmetik (kein Heilpraktiker) | § 823 BGB Verkehrssicherungspflicht + § 280 BGB Pflichtverletzung | BGB § 195 (3 Jahre) + § 199 Abs. 4 (10 Jahre Hoechstfrist) | Art. 9 Abs. 2 lit. a DSGVO (Einwilligung) |
| Medizinisches Spa mit Heilpraktiker | § 630a-h BGB Behandlungsvertrag | BGB § 630f Abs. 3 (10 Jahre) | § 22 Abs. 1 Nr. 1 lit. b BDSG (Gesundheitsvorsorge) ODER Art. 9 Abs. 2 lit. h |
| Aerztliche Leistung im Spa (Botox, Filler) | § 630a-h BGB voll | BGB § 630f Abs. 3 (10 Jahre) | § 22 BDSG (Berufsgeheimnistraeger) |

### Pflicht-Pruefungen

- [ ] **Anamnese-Beweis-Workflow** (Art. 9 Abs. 2 lit. a + Art. 7 Abs. 1 DSGVO): Wer Gesundheitsdaten erhebt, muss Einwilligung **kryptographisch beweisbar** dokumentieren. Mindestens eines:
  - Tablet-Signatur (eIDAS Art. 3 Nr. 10 — eES) mit Audit-Trail
  - Eigenhaendige Unterschrift auf Papier + gescannt + Hash-Bindung (SHA-256) in DB
  - Mitarbeiter-Abtipp + Pflicht-Original-Scan + Mitarbeiter-Co-Signatur
- [ ] **Branchen-Klassifikation explizit** in Datenschutzerklaerung: Wellness vs. Heilpraktiker vs. Aerztlich. Falsche Annahme der Heilberufs-Privilegien (§ 22 BDSG) ist verbreiteter Verstoss.
- [ ] **DSFA-Pflicht** (Art. 35 Abs. 3 lit. b DSGVO): bei systematischer Erhebung Art-9-Daten (jeder Spa-Gast bekommt Anamnese erfasst). KMU-Privileg gilt **nicht** fuer DSFA bei Art-9.
- [ ] **Aufbewahrungsfrist** dokumentiert + automatisiert (Cron / Scheduled-Job): 3 Jahre Wellness, 10 Jahre Heilpraktiker. Verlaengerung bei dokumentiertem Schadensfall (BGB § 199 Abs. 2: bis 30 Jahre bei Personenschaden).
- [ ] **Encryption at-rest** fuer alle Art-9-Felder (AES-256-GCM mit AAD-Bindung an Row-ID, Defense gegen Block-Swap-Attacks).
- [ ] **Audit-Log** fuer JEDEN Lese-Zugriff auf Anamnese (Art. 5 Abs. 2 Rechenschaftspflicht).
- [ ] **Widerrufs-Workflow** Art. 7 Abs. 3 DSGVO als sichtbarer Button + Pflicht-Audit-Log mit Begruendung.
- [ ] **Heilpraktiker-Erlaubnis-Check**: wenn Akupunktur, Schroepfen, Massagen mit Heilversprechen, Lymphdrainage etc. angeboten werden — Heilpraktiker-Erlaubnis (HeilprG) **Pflicht**, sonst Strafbar (§ 5 HeilprG).
- [ ] **HWG-Compliance** wenn Heilversprechen beworben (Anti-Aging, Faltenglaettung, Cellulite-Reduktion mit Wirknachweis-Behauptung).

### Typische Verstoesse

- **Anamnese ohne Pflicht-Unterschrift erfasst** — Mitarbeiter tippt Allergien direkt im Admin-UI ein, ohne dass Gast bestaetigt. Beweispflicht Art. 7 Abs. 1 nicht erfuellt.
- **Falsche § 22 BDSG-Berufung** — Spa-Mitarbeiter sind keine Berufsgeheimnistraeger im Sinne § 22 Abs. 1 Nr. 1 lit. b BDSG (anders als Aerzte/Heilpraktiker mit § 203 StGB-Schweigepflicht). Rechtsgrundlage **muss** Art. 9 Abs. 2 lit. a DSGVO (ausdrueckliche Einwilligung) sein.
- **Aufbewahrungsfrist zu kurz** — z.B. 12 oder 24 Monate, dann Schaden tritt in Jahr 3 auf. Hotel kann Anamnese nicht mehr vorlegen → § 280 BGB-Beweisproblem.
- **Audit-Log fehlt fuer Anamnese-Lese-Zugriff** — kein Nachweis welcher Mitarbeiter wann welche Gesundheitsdaten gesehen hat. Diskriminierungs-Vorwurf-Defense unmoeglich.
- **Werbung mit Heilversprechen** ohne Heilpraktiker-Erlaubnis → § 5 HeilprG (Strafbarkeit) + § 3 HWG (Wettbewerbsverstoss, UWG-Hebel).
- **Originalpapier ohne kryptographische Bindung** an DB-Eintrag — Mitarbeiter scannt + tippt ab, aber DB-Inhalt ist nicht beweisbar mit Original verknuepft. Im Bestreitungsfall: Inhalts-Diskrepanz nicht aufloesbar.
- **DSFA fehlt** — bei Pruefung durch Aufsichtsbehoerde Art. 35 Verstoss = Stufe 1 Bussgeld (bis 10 Mio EUR / 2%).

### Az.-Anker

- **Beweispflicht Einwilligung Art-9**: etablierte EuGH-Rechtsprechung zu Art. 7 + Art. 9 DSGVO. Spezifische Az. `[ungeprueft, manuelle Verifikation vor Schriftsatz erforderlich]` — Empfehlung: Az. zu Art. 9 + Beweispflicht in `bgh-urteile.md` ergaenzen wenn primaer-quellen-verifiziert (curia.europa.eu / bundesgerichtshof.de).
- **§ 630h BGB Beweislastumkehr**: gilt NUR bei medizinischer Behandlung, NICHT bei Wellness. Wichtige Abgrenzung — Wellness fallback auf § 286 ZPO freie Beweiswuerdigung.
- **§ 5 HeilprG Strafbarkeit**: Heilberufsausuebung ohne Erlaubnis = Strafrechtlich verfolgt, BGH-Linie zu „Heilkunde" weit ausgelegt (bspw. Lymphdrainage, energetische Behandlungen, „Heilmassagen").
- **Hauttyp/Schwangerschaft als Art-9**: defensiv ausgelegt nach ErwGr 35 DSGVO + EuGH-Rechtsprechung zu weitem Gesundheitsdaten-Begriff.

### Cross-Branche-Hinweise

- Hotel-Spa: zusaetzlich `LodgingBusiness`-Layer pruefen (Reisebranche-Sektion)
- Wenn KI-Auswertung der Anamnese (Empfehlungen): EU AI Act + KI-Health-Layer-Sektion zusaetzlich
- Wenn Online-Booking: zusaetzlich E-Commerce-Layer (BFSG seit 28.06.2025)

> Audit-Pattern: siehe `references/audit-patterns.md` Phase 5h (Art-9-Beweis-Workflow-Audit).

---

## Anwaelte / Kanzleien

### Berufsordnung Rechtsanwaelte (BORA)
- **Volltext**: https://www.brak.de/anwaltsrecht/bora-fao/
- § 6 BORA: Werbung — nur sachliche Information ueber Kanzlei und Person
- § 7 BORA: Beratung in eigener Sache; Kollegialitaet
- § 27 BORA: Online-Werbung — gleiche Massstaebe wie Print

### Rechtsanwaltsvergueung (RVG)
- Volltext: https://www.gesetze-im-internet.de/rvg/
- Honorarvereinbarungen oberhalb RVG: schriftlich, nicht in AGB
- Kostenfreie Erstberatung darf nicht beworben werden, wenn nicht universell

### Pruefpunkte fuer Skill (Anwalts-Sites)
- [ ] Berufsbezeichnung + Zulassung
- [ ] Zustaendige Rechtsanwaltskammer mit Link
- [ ] Berufshaftpflicht-Versicherung mit Mindestdeckungssumme (§ 51 BRAO)
- [ ] Streitschlichtung nach VSBG (Hinweis: Teilnahme ja/nein)
- [ ] Keine reisserische Werbung, keine Erfolgs-Statistiken
- [ ] Online-Termine: Hinweis auf Rechtsanwaltsgeheimnis (Verschluesselung)
- [ ] Newsletter-Versand: nicht wahllos an Mandanten — § 5 BORA Vertraulichkeit
- [ ] Tarif/Honorar-Nennung: nicht pauschal, nur Hinweis auf RVG / individuelle Vereinbarung

### Typische Verstoesse
- „Erfolgs-Quote 95%" ohne nachpruefbare Grundlage → § 6 BORA
- Honorarliste fuer Pauschalmandate ohne RVG-Hinweis
- Mandantenstimmen mit Klarnamen ohne Einwilligung

---

## Architekten / Ingenieure

### Bundesarchitektenkammergesetz / Landesgesetze
- Berufsbezeichnung „Architekt" geschuetzt — nur fuer Eingetragene
- Pflichtmitgliedschaft Architektenkammer

### HOAI (Honorarordnung fuer Architekten und Ingenieure)
- **Volltext**: https://www.gesetze-im-internet.de/hoai_2021/
- Stand 2021: HOAI ist Orientierungswert (EuGH C-377/17, 2019), nicht verbindlich; Mindestsaetze entfallen
- Honorar weiterhin in Phasen 1-9 strukturiert

### Pruefpunkte fuer Skill (Architekten-Sites)
- [ ] Architekteneintragung + zustaendige Architektenkammer
- [ ] Berufshaftpflicht (§ 12 BAO)
- [ ] Bei Wettbewerbsausschreibungen: Hinweise auf VOF / GWB
- [ ] Bilder von Bauten: Eigentum / Lizenz dokumentiert (Urheberrecht UrhG § 2)
- [ ] Bei Bildveroeffentlichungen Personen: Einwilligung (KunstUrhG § 22)

### Typische Verstoesse
- Werbung mit „Wir bauen guenstiger als HOAI" — irrefuehrend
- Bild-Galerien fremder Bauten ohne Lizenz-Hinweis (§ 59 UrhG Panoramafreiheit beachten)

---

## Steuerberater / Wirtschaftspruefer

### StBerG (Steuerberatungsgesetz)
- Berufsbezeichnung geschuetzt, Pflichtmitgliedschaft Kammer
- § 8 StBerG: Werbeverbot, nur sachliche Information

### WPO (Wirtschaftspruefer-Ordnung)
- Aehnlich StBerG

### Pruefpunkte
- [ ] Berufsbezeichnung + Verleihungsstaat
- [ ] Zustaendige Steuerberater-/WP-Kammer
- [ ] Berufshaftpflicht mit Mindestdeckungssumme
- [ ] Bei Online-Buchhaltungs-Tools: GoBD-Konformitaet erwaehnen

---

## Lebensmittelbranche

### Lebensmittel-Informationsverordnung (LMIV / EU 1169/2011)
- Verpflichtende Informationen fuer Verbraucher
- Online-Shop: Naehrwerttabelle, Allergene, Herkunftsland, Hersteller — vor Kauf einsehbar

### Lebensmittel- und Futtermittelgesetzbuch (LFGB)
- Werbeverbot fuer gesundheitsbezogene Aussagen ohne Zulassung (§ 11 LFGB)
- Health-Claims-Verordnung (EU 1924/2006)

### Pruefpunkte
- [ ] LMIV-Pflichtangaben am Produkt (Online-Shop): Bezeichnung, Naehrwert, Allergene, Hersteller
- [ ] Health-Claims geprueft auf EU-Liste (https://ec.europa.eu/food/safety/labelling-and-nutrition/nutrition-and-health-claims_en)
- [ ] Bio-/Demeter-Zertifizierung: Kontrollstelle benennen
- [ ] Bei Versand-Frische: Kuehlkette-Hinweis (vermeidet Haftung)

---

## Medizinprodukte

### Medizinprodukterecht-Durchfuehrungsgesetz (MPDG)
- **Volltext**: https://www.gesetze-im-internet.de/mpdg/
- Umsetzung der EU-Verordnung 2017/745 (MDR)
- CE-Kennzeichnung Pflicht
- Werbung nur unter Voraussetzungen

### EU MDR (Medical Device Regulation)
- Risikoklassen I, IIa, IIb, III
- Klinische Bewertung erforderlich

### Pruefpunkte
- [ ] CE-Kennzeichnung mit Benannte-Stelle-Nummer
- [ ] Konformitaetserklaerung auf Anfrage
- [ ] Bei Klassen IIa+: Klinische Daten verfuegbar
- [ ] Werbung auf Online-Shop: keine unbelegten Heilversprechen
- [ ] Vigilanzsystem-Hinweis (BfArM-Meldung)

---

## Gluecksspiel / Wettanbieter

### Gluecksspielstaatsvertrag (GlueStV 2021)
- Lizenz erforderlich, Sitz in Deutschland oder EU
- Werbung beschraenkt (§ 5 GlueStV)
- Spielerschutz, Selbstausschluss-System OASIS

### Pruefpunkte
- [ ] Lizenz-Nummer + Erteilungs-Behoerde (GGL Glueckspiel-Behoerde)
- [ ] Spielerschutz-Hinweise prominent
- [ ] Selbstausschluss-Funktion ueber OASIS
- [ ] Keine Werbung an Minderjaehrige
- [ ] Limitierungs-Tools (Einzahlungs-Limit pro Monat)

---

## Banken / Finanzdienstleister

### KWG (Kreditwesengesetz)
- BaFin-Erlaubnis-Pflicht
- § 2 KWG: erlaubnisfreie Bagatelle

### WpHG (Wertpapierhandelsgesetz)
- Anlageberatung-Pflichten
- Geeignetheits-Pruefung (§ 64 WpHG)

### MaRisk / MaComp (BaFin-Rundschreiben)
- TOMs-Vorgaben fuer Risikomanagement, Compliance

### Pruefpunkte
- [ ] BaFin-Lizenz-Nummer + Aufsichtsbehoerde-Hinweis
- [ ] Risikohinweis bei Anlageprodukten (Verlust-Risiko)
- [ ] Bei P2P-Krediten: KWG-Erlaubnis oder Vermittler-Lizenz
- [ ] EinlagensicherungsfondsHinweis bei Banken

---

## Versicherungen / Vermittler

### VAG (Versicherungsaufsichtsgesetz)
- BaFin-Aufsicht
- § 234c VAG: Wohlverhaltensregeln Vermittlung

### VVG (Versicherungsvertragsgesetz)
- Beratungs- und Dokumentationspflichten

### Pruefpunkte
- [ ] BaFin-Erlaubnis (oder Vermittler-Registrierung IHK)
- [ ] Vermittler-Register-Eintrag im Impressum
- [ ] Berufshaftpflicht
- [ ] Beratungs-Protokoll bei Online-Antraegen
- [ ] Abschlusspflicht-Hinweise (Widerruf 14 Tage)

---

## Reisebranche

### Pauschalreise-Richtlinie (EU 2015/2302) → BGB §§ 651a ff.
- Vorvertragliche Information
- Insolvenzversicherung-Pflicht (§ 651r BGB)

### Pruefpunkte
- [ ] Pauschalreise-Pflichtinformationen vor Buchung
- [ ] Insolvenzschein-Hinweis (Sicherungsschein)
- [ ] Stornoebedingungen klar
- [ ] EU-Fluggastrechte (VO 261/2004) bei Fluganbietern

---

## E-Commerce / Online-Shops

### Verbraucherrechte-Richtlinie → BGB §§ 312-312k
- Vorvertragliche Information
- Widerrufsbelehrung 14 Tage (§ 355 BGB)
- Button-Loesung „zahlungspflichtig bestellen" (§ 312j BGB)

### Preisangabenverordnung (PAngV)
- Brutto-Preis inkl. MwSt
- Grundpreis bei volumen-/gewichtsabhaengigen Waren
- Streichpreise: niedrigster Preis der letzten 30 Tage (§ 11 PAngV — Omnibus-Richtlinie)

### Geoblocking-Verordnung (EU 2018/302)
- Verbot ungerechtfertigter Geoblocking
- Klare Lieferlaender-Angabe

### Pruefpunkte
- [ ] Widerrufsbelehrung mit Muster-Formular
- [ ] Button-Text korrekt: „zahlungspflichtig bestellen" (NICHT „bestellen", „kaufen", „buchen")
- [ ] Bestelluebersicht VOR letztem Klick
- [ ] Bestaetigungs-Mail mit Widerrufsbelehrung
- [ ] Versandkosten transparent vor Bezahl-Schritt
- [ ] PAngV Grundpreis bei Mengen-Waren
- [ ] Streichpreise konform (Omnibus, 30-Tage-Regel)
- [ ] Streit-Plattform-Link (https://ec.europa.eu/consumers/odr)
- [ ] AGB getrennt von Widerrufsbelehrung

### Typische Verstoesse
- Button „Bestellen" statt „zahlungspflichtig bestellen" → Vertrag unwirksam, Abmahnung
- Streichpreis ohne 30-Tage-Bezug → § 11 PAngV
- Versandkosten erst nach Eingabe der Adresse → irrefuehrend

---

## Bildung / Online-Kurse

### FernUSG (Fernunterrichtsschutzgesetz)
- Zulassungspflicht fuer entgeltliche Fernunterrichts-Vertraege
- ZFU = Zentralstelle fuer Fernunterricht (Koeln)
- BGH Urteil 2024: B2B-Online-Coaching nicht generell ZFU-pflichtig, aber Einzelfall-Pruefung

### Pruefpunkte fuer Online-Coaches/Kurse
- [ ] Pruefung: Fernunterrichts-Charakter? (selbstgesteuertes Lernen + Erfolgskontrolle)
- [ ] Wenn ja: ZFU-Zulassung-Nummer im Impressum
- [ ] Wenn nein: klar machen warum nicht (B2B, kein Pruefungs-System, etc.)
- [ ] Widerrufsrecht 14 Tage gewaehren
- [ ] Vorzeitige Loesung bei Lehrgangs-Vertraegen § 21 FernUSG (3-Monats-Frist)

### Typische Verstoesse
- B2C-Coaching ohne ZFU-Zulassung → Vertrag nichtig (etablierte Rechtsprechung zu § 7 Abs. 1 FernUSG; vor Verwendung im Schriftsatz aktuelle Az.-Recherche pflicht — vorheriger Skill-Stand zitierte BGH XI ZR 188/22 mit Coaching-Kontext, das ist tatsaechlich ein bankrechtlicher Beschluss vom 12.09.2023 (XI. Zivilsenat = Bankrecht), der Sachverhalt deckt sich nicht mit Coaching-Vertraegen — Halluzinations-Korrektur 2026-05-05)
- Coaching-Vertrag ohne Widerrufsrecht-Hinweis → Frist beginnt nicht zu laufen

---

## Pet-Care-Apps / Tierhalter-Plattformen (Lesson-Learned: operativ-Audit 2026-04-30)

### HWG-Naehe (Heilmittelwerbegesetz, fuer Tier nicht direkt anwendbar)

Pet-Care ist nicht direkt durch HWG geregelt (das gilt fuer Humanmedizin
+ teils Veterinaerarzneimittel). Aber: Werbung mit "heilbringenden"
Wendungen kann unter UWG-§5 (Irrefuehrung) fallen — besonders bei
Naturheilkunde-Inhalten / KI-Diagnose-Features.

### Pet-Care + KI-Chat (EU AI Act Art. 50)

Wenn die App einen KI-Chat fuer Tier-Gesundheits-Fragen bietet, gilt
ab **02.08.2026** Art. 50 EU AI Act:
- Sichtbarer KI-Hinweis im Chat-UI (nicht nur in DSE)
- Information dass Antworten KI-generiert sind
- Disclaimer-Pflicht: "ersetzt keine tieraerztliche Beratung"

### Pflicht-Disclaimer (in Impressum + AGB + DSE konsistent)

```
Die Inhalte auf [APP-NAME] dienen ausschliesslich der allgemeinen
Information ueber [Themengebiet] und ersetzen keine tieraerztliche
Beratung, Diagnose oder Behandlung. Bei gesundheitlichen Problemen
Ihres Tieres wenden Sie sich bitte immer an einen Tierarzt.
```

### Pruefpunkte fuer Pet-Care/Tierhalter-Apps
- [ ] Disclaimer "ersetzt keinen Tierarzt" in Impressum + AGB + DSE
- [ ] KI-Chat-UI mit sichtbarem KI-Badge (Art. 50 EU AI Act, ab 02.08.2026)
- [ ] AGB mit Haftungs-Klausel fuer Naturheilkunde-Empfehlungen — keine
      pauschale Haftungsablehnung bei Verletzung Leben/Koerper/Gesundheit
- [ ] Kein "Heilmittel"-Wording auf Marketing-Seiten ohne Kontext +
      Disclaimer (Begriff ist HWG-belastet — neutralisieren zu
      "naturheilkundliche Anwendungen" / "Hausmittel")
- [ ] Wenn Marktplatz/Vermittlung von Hundetrainer / Tierheilpraktiker /
      Tierarzt: pruefen ob Plattform-Privileg § 7 DDG greift
- [ ] Wenn Online-Shop fuer Tiernahrung: Lebensmittelrecht (LMIV / LFGB)
      + ggf. Futtermittelhygiene-VO
- [ ] Wenn Online-Apotheke fuer Tiermedizin: ApBetrO + zustaendige
      Apothekerkammer (= reglementierter Beruf, Berufsbezeichnung in
      Impressum)

### Typische Verstoesse (Pet-Care)
- Marketing mit "heilt" / "kuriert" / "wirkt gegen [Krankheit]" ohne
  Kontext + Disclaimer = UWG-§5-Irrefuehrung
- KI-Chat ohne sichtbaren KI-Hinweis (ab 02.08.2026 EU AI Act Art. 50)
- AGB pauschal "keine Haftung fuer Anwendung" → Klausel-Konflikt mit
  unbeschraenkter Haftung fuer Vorsatz/grobe Fahrlaessigkeit (§ 307 BGB)
- Plattform fuer Tierhalter ohne Pruefung ob Vermittlungs-Vertrag dem
  Werkvertragsrecht unterfaellt (Hundesitter, Gassi-Service)

---

## KI-Health-Layer (cross-cutting fuer Health-Apps + KI)

### EU AI Act Risikoklasse fuer Health-AI

| App-Typ | Risikoklasse (EU AI Act) | Pflichten |
|---------|--------------------------|-----------|
| Reine Informations-KI (Chat zu Krankheiten, ohne Diagnose-Output) | Art. 50 — Transparenz (ab 02.08.2026) | KI-Hinweis im UI, Disclaimer "kein Ersatz fuer Arzt/Tierarzt" |
| KI mit Diagnose-Vorschlaegen (auch fuer Tiere) | potenziell Hochrisiko (Anhang III) | Konformitaetsbewertung, CE-Kennzeichnung, technische Doku, Risiko-Management — pruefen mit Fachanwalt |
| KI als Medizinprodukt (Symptom-Checker mit Therapie-Empfehlung) | MDR-pflichtig + EU AI Act Hochrisiko | CE-Mark + benannte Stelle + DiGA-VO Pruefung |

### KI-Output-Pflichten (Art. 50 EU AI Act, Anwendung 02.08.2026)

- Kennzeichnung KI-generierter Inhalte (Art. 50 Abs. 4)
- Bei generierten Bildern/Videos/Audio: maschinenlesbare Markierung
  (z.B. C2PA Content-Credentials)
- Bei Deepfakes: ausdrueckliche Kenntlichmachung als KI-Erzeugnis
- Bei Chatbots: Nutzer muss erkennen, dass es ein KI-System ist
- Bussgeld bis 15 Mio. EUR / 3% Jahresumsatz (Art. 99)

### Pruefpunkte fuer Health/Pet-Care-AI
- [ ] EU AI Act Art. 50 Risikoklasse bestimmt
- [ ] KI-Kennzeichnung im Chat-UI sichtbar (nicht nur in DSE)
- [ ] DSE-Eintrag fuer KI-Anbieter mit Drittland-Hinweis
- [ ] AVV mit KI-Anbieter abgeschlossen
- [ ] Zero-Retention-Vereinbarung (kein Modell-Training mit Kundendaten)
- [ ] Disclaimer "keine medizinische Beratung" / "kein Ersatz fuer
      Arzt/Tierarzt" persistent im UI

---

## SaaS-Subscription / Premium-Webdienst

### Trigger
URL-Pattern: `*-app.*`, `*-saas.*`, `*-pro.*`. Content: „Abo", „Premium", „Subscription", „Trial". Tech-Stack: Stripe + Supabase / Auth0 / Clerk + Subscription-Modul.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| Button-Loesung „zahlungspflichtig bestellen" | § 312j Abs. 3 BGB | DOM-Probe |
| Online-Kuendigungsbutton | § 312k BGB | DOM-Probe Footer + Account-Page |
| Kuendigungsfrist max. 1 Monat nach Erstlaufzeit | § 309 Nr. 9 lit. b BGB | AGB-§-Audit |
| Auto-Renewal-Hinweis vor Erst-Abschluss | BGB § 312j | Checkout-Flow-Audit |
| Trial-to-Paid-Konvertierung mit Pflicht-Bestaetigung | BGB § 312j Abs. 3 | UI-Audit |
| DSE: Verarbeitungs-Zwecke fuer SaaS-Daten | DSGVO Art. 13 | DSE-Audit |
| AVV mit Stripe + Auth-Provider | DSGVO Art. 28 | DSE-Listing |

### Typische Verstoesse
- „Jetzt Abo abschliessen" statt „zahlungspflichtig bestellen" → § 312j Abs. 3 BGB
- Versteckter Cancel-Pfad (mehr als 3 Klicks tief) → § 312k BGB + DSA Art. 25 Dark Pattern
- Auto-Renewal ohne Hinweis 14 Tage vor Verlaengerung → § 309 Nr. 9 BGB

### Az.-Anker
- BGH I ZR 161/24 (§ 312k Kuendigungsbutton, 22.05.2025)
- LG Berlin II 97 O 81/23 (Passwort-Identifikation, 27.11.2024)

---

## Marketplace / Online-Plattform

### Trigger
URL-Pattern: `*-marketplace.*`, `*-kleinanzeigen.*`, content: „inserieren", „verkaufen", „Anzeige aufgeben". Mehrere Anbieter / Trader.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| Trader-Verifikation (KYC) | DSA Art. 30 | Onboarding-Flow |
| Gewerblich/privat-Trennung im Listing | DSA Art. 30 + UWG | Listing-Detail-Page |
| Notice-and-Action-Endpoint | DSA Art. 16 | `/api/.../report`-Existenz |
| Beschwerdemanagement | DSA Art. 20 | Documented-Process |
| Statement of Reasons bei Loeschung | DSA Art. 17 | Moderations-Pfad |
| Werbung-Transparenz | DSA Art. 26 | Ad-Labelling |
| AGB Inhaltsmoderations-Kriterien | DSA Art. 14 | AGB-Audit |
| AVV mit allen Sub-Auftragsverarbeitern | DSGVO Art. 28 | AVV-Liste |
| UGC-PII-Audit (siehe `audit-patterns.md` Phase 5c) | Art. 5 + 17 DSGVO + EuGH C-131/12 | curl-Probe |

### Typische Verstoesse
- Privat-Trader ohne Kennzeichnung verkauft gewerblich → § 5a UWG + DSA Art. 30
- Notice-Form fehlt → DSA Art. 16-Verstoss
- User-Telefonnummern oeffentlich indexierbar ohne X-Robots-Tag noindex → Art. 5 lit. e DSGVO

### Az.-Anker
- EuGH C-682/18 / C-683/18 YouTube + Cyando (Hosting-Privileg, 22.06.2021)
- EuGH C-131/12 Google Spain (13.05.2014)

---

## Influencer / Creator / Content-Plattform

### Trigger
URL-Pattern: `*-blog.*`, `*-creator.*`. Content: Empfehlungen, Affiliate-Links, Produkt-Reviews, Sponsored-Posts.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| „Werbung"/„Anzeige"-Kennzeichnung bei jedem bezahlten Post | UWG § 5a Abs. 4 | Post-Audit |
| Affiliate-Disclaimer auf Empfehlungs-Seiten | UWG § 5a + DDG § 6 | siehe `references/templates/AffiliateDisclaimer.tsx.example` |
| Trennung redaktionell vs. werblich | UWG § 5a Abs. 4 | Strukturanalyse |
| Bei Vergueting: Sender klar erkennbar | UWG § 5a Abs. 4 | Footer-Disclosure |
| Newsletter mit Affiliate: „Werbehinweis" im Header | UWG § 5a + § 7 Abs. 3 | E-Mail-Audit |

### Typische Verstoesse
- Sponsored-Post mit nur „#ad" am Ende eines langen Captions → BGH I ZR 90/20-Linie verletzt
- Affiliate-Page ohne klar sichtbaren Hinweis → Abmahnung vzbv

### Az.-Anker
- BGH I ZR 90/20 Cathy Hummels (09.09.2021)
- BGH I ZR 35/21 Pamela Reif (09.09.2021)
- LG Muenchen I 4 HK O 14302/15 (Brand Ambassador, 29.04.2019)

---

## News / Verlag / Online-Medium

### Trigger
URL-Pattern: `*-news.*`, `*-zeitung.*`, `*-verlag.*`. schema.org @type: NewsArticle, NewsMediaOrganization.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| MStV § 18 — Verantwortlicher iSd. Pressrechts | MStV (Medienstaatsvertrag) § 18 | Impressum + V.i.S.d.P. |
| Trennungsgrundsatz Werbung/Redaktion | UWG § 5a + MStV | Layout-Audit |
| Urheberrecht-Compliance bei Bildern | UrhG | Image-Source-Audit |
| Pflicht-Hinweis auf KI-generierte Inhalte | AI-Act Art. 50 Abs. 5 | Article-Footer |
| Quellen-Angabe bei Zitaten | UrhG § 51 | Manuelles Audit |
| Leistungsschutzrecht-Pflicht bei Snippets | UrhG § 87f | LSR-Quellenliste |

### Typische Verstoesse
- Pressefoto ohne korrekte Lizenz → UrhG-Abmahnung (Vincent + Lockhart, etc.)
- KI-generierter Artikel ohne Hinweis ab 02.08.2026 → AI-Act-Verstoss

### Az.-Anker
- EuGH C-401/19 (Upload-Filter, 26.04.2022)
- BGH I ZR 192/12 (Goldbärenbarren, 12.12.2013) — TV-Werbung-Kinder/Jugendliche-Adressaten-Frage nach § 3 Abs. 2 Satz 3 UWG (siehe `bgh-urteile.md` Provenance-Note: vorheriger Eintrag `I ZR 246/15 06.02.2014` war Halluzination)

---

## B2B-SaaS / Cold-Outreach / Lead-Generation

### Trigger
Tech-Stack: Apollo, Hunter, Outreach.io, Lemlist + Scraping-Tools. URL: `*-leads.*`, `*-outbound.*`.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| Cold-E-Mail-B2B mit „mutmasslichem Interesse" | UWG § 7 Abs. 2 Nr. 3 (eng auszulegen) | Sample-Mail-Review |
| Datenschutzerklaerung beim Empfaenger-Erstkontakt | DSGVO Art. 13/14 | Mail-Footer |
| Bestandskunden-Werbung mit Widerrufs-Hinweis | UWG § 7 Abs. 3 | Mail-Audit |
| Unsubscribe-Link in jeder Mail | UWG + Art. 21 DSGVO | Mail-Audit |
| Scraped-Daten-Quelle dokumentiert | DSGVO Art. 14 + 6 lit. f | VVT |
| LinkedIn / Apollo / Hunter als Auftragsverarbeiter | DSGVO Art. 28 | AVV |

### Typische Verstoesse
- Cold-E-Mail an private Adressen → UWG § 7 Abs. 2 Nr. 3 (B2C-Pflicht-Einwilligung)
- Cold-E-Mail an business@ ohne mutmaßliches Interesse → ebenfalls Verstoss
- Auskunfts-Anfrage Art. 15 unvollstaendig (Quelle nicht genannt) → Art. 14 DSGVO + Art. 82 Schaden

### Az.-Anker
- BGH I ZR 218/07 (Cold-Outreach-Klassiker, 10.02.2011)
- BGH I ZR 12/22 (Bestandskunden-Mehrfach-Werbung, 07.06.2023)
- BGH I ZR 218/19 (Werbeeinwilligung Bestandskunden, 10.02.2022)

---

## Crypto / Web3 / Token-Plattform

### Trigger
URL-Pattern: `*-crypto.*`, `*-defi.*`, `*-nft.*`, `*-token.*`. Tech-Stack: ethers.js, viem, wagmi, RPC-Provider (Alchemy, Infura).

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| MiCA-Pflicht bei Krypto-Token-Issuance | EU-VO 2023/1114 (MiCA, ab 30.12.2024 voll anwendbar) | White-Paper-Pflicht |
| Crypto-Asset-Service-Provider (CASP) Lizenz | MiCA Art. 59 | BaFin-Listing |
| KryptoWAEG (DE-Umsetzung MiCA) | KryptoWAEG §§ 1 ff. | Lizenz-Status |
| KYC / AML beim Onboarding | GwG § 10 | Identifikations-Pfad |
| Wallet-Adressen + Tracking → personenbezogen | DSGVO Art. 4 Nr. 1 | DSE-Block |
| Risiko-Hinweis bei Investment-Werbung | KAGB / BaFin | Marketing-Audit |
| Steuerrechtliche Hinweise (StGB / EStG) | Steuerrecht | FAQ + AGB |

### Typische Verstoesse
- Token-Sale ohne MiCA-konforme White-Paper → bis 5 Mio. € + 5% Umsatz Bussgeld
- Werbung mit Renditeversprechen ohne Risiko-Hinweis → § 5 UWG + KAGB

### Az.-Anker (allgemein)
- BaFin-Verfügungen (publiziert auf bafin.de)
- (Branche zu jung fuer umfassende EuGH/BGH-DB)

---

## Telemedizin / Health-Adjacent SaaS

### Trigger
URL-Pattern: `*-telemed.*`, `*-doc.*`, `*-arzt.*`. Content: Online-Sprechstunde, KI-Diagnose, Medikamenten-Empfehlung.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| Heilberufsgesetz (HBG) der Laender | HBG | Berufsrecht |
| Berufsordnung-Konformitaet (Online-Behandlung) | MBO-AE / BORA | Standes-Audit |
| Datenschutz Gesundheitsdaten | DSGVO Art. 9 + § 22 BDSG | DSE + DSFA Pflicht |
| TI-Anschluss-Pflicht (gematik) | gematik-Anschluss-Verpflichtung | Tech-Audit |
| KI-Diagnose: Hochrisiko-AI | AI-Act Art. 6 + Annex III Nr. 5 | DSFA + FRIA + Art. 50 |
| Medikamenten-Werbung | HWG (Heilmittelwerbegesetz) | Page-Content-Audit |
| eRezept-Anbindung | E-Rezept-Verordnung | API-Compliance |

### Typische Verstoesse
- KI-Diagnose ohne menschlichen Aufsichtskanal (Art. 14 AI-Act-Pflicht) → Hochrisiko-Verstoss
- Health-Daten-Verarbeitung ohne explizite Einwilligung (Art. 9 lit. a DSGVO) → bis 4% Umsatz
- Werbung mit Heilversprechen → HWG § 3

### Az.-Anker
- BGH I ZR 232/16 (Heilmittelwerbung, 15.02.2018)
- EuGH C-21/23 Lindenapotheke (04.10.2024)

---

## HR-Tech / Personal / Recruiting-AI

### Trigger
URL-Pattern: `*-jobs.*`, `*-recruit.*`, `*-hr.*`. Content: Bewerber-Tracking, AI-Screening, Performance-Tools, Mitarbeiter-Geo-Tracking.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| Beschaeftigtendatenschutz | § 26 BDSG | DSE-Block + AVV |
| Betriebsrat-Mitbestimmung bei AI-Tools | BetrVG § 87 Abs. 1 Nr. 6 | Betriebsvereinbarung |
| AI-Bewerber-Screening = Hochrisiko | AI-Act Art. 6 + Annex III Nr. 4 | FRIA + DSFA |
| Automatisierte Entscheidung Art. 22 | DSGVO Art. 22 | menschliches Eingreifen |
| EU-Whistleblower-Pflicht (intern. Hinweisgebersystem) | HinSchG (DE-Umsetzung 2023) | Hinweisgeber-System |
| Geo-Tracking Mitarbeiter nur mit BR-Zustimmung | BetrVG + § 26 BDSG | Doku |

### Typische Verstoesse
- AI-CV-Screening ohne Bewerber-Information → Art. 13 + Art. 22 DSGVO
- Mitarbeiter-Mood-Tracking ohne BR-Vereinbarung → BetrVG § 87 + § 26 BDSG
- Whistleblower-System ohne Anonymitaets-Garantie → HinSchG-Verstoss + Bussgeld

### Az.-Anker
- LfDI Niedersachsen — Notebooksbilliger 10,4 Mio. € (2021)
- HmbBfDI — H&M 35,3 Mio. € (2020)

---

## Energie / Strom / Gas — kritische Infrastruktur

### Trigger
URL-Pattern: `*-stadtwerke.*`, `*-energie.*`. Content: Strom/Gas/Fernwaerme. § 8 EnWG-Status, KRITIS-Schwellwerte.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| KRITIS-Sektoren-Pflicht | BSIG § 8a (Energie ab 250.000 EW) | KRITIS-Status |
| NIS2-Anwendbarkeit | NIS2-Umsetzungsgesetz (BGBl. I 2024) | NIS2-Pflicht |
| BSI-Mindestanforderungen | BSIG | TOM-Audit |
| EnWG Tarif-Transparenz | EnWG §§ 41 ff. | Tarif-Page |
| GDPR + Smart-Meter-Daten | DSGVO + § 21 EnWG | Smart-Meter-DSE |

### Typische Verstoesse
- Smart-Meter-Daten ohne Einwilligung weitergegeben → DSGVO + EnWG
- KRITIS-Pflicht-Meldung bei Vorfall ueberzogen → BSIG-Bussgeld

---

## Mobility / Transport — kritische Infrastruktur

### Trigger
URL-Pattern: `*-mobility.*`, `*-bahn.*`, `*-bus.*`, `*-taxi.*`. Content: Personenbefoerderung, Logistik.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| Personenbefoerderungsgesetz (PBefG) Lizenz | PBefG | Lizenz-Status |
| KRITIS-Verkehr (Bahn/Flughafen) | BSIG | KRITIS-Pflicht |
| BFSG-Barrierefreiheit (Personenbefoerderungs-App) | BFSG § 1 | WCAG-Audit |
| ePrivacy + Geo-Daten | DSGVO + § 25 TDDDG | Geo-Consent |
| Fahrer-Daten / Plattform-Vermittlung | § 26 BDSG (wenn Beschaeftigte) | DSE |

### Typische Verstoesse
- Geo-Tracking ohne Consent in App → § 25 TDDDG + Art. 6 DSGVO
- Barrierefreiheit fehlt in Booking-App ab 28.06.2025 → BFSG bis 100.000 €

---

## Open-Source-Projekt / Skill / Library

### Trigger
URL-Pattern: `*-github.io`, `*-readthedocs.*`. Repo-Struktur: package.json mit `license: MIT/Apache-2.0/GPL`. CONTRIBUTING.md vorhanden.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| LICENSE-File im Repo-Root | OSS-Best-Practice | git ls-files \| grep LICENSE |
| Pro File: License-Header (optional, oft empfohlen) | OSS-Best-Practice | grep -L `^//` src/*.ts |
| Bug-Bounty-Policy / responsible-disclosure | RFC 9116 (security.txt) | /.well-known/security.txt |
| CONTRIBUTING.md Datenschutz-Hinweis (Issue-Daten) | DSGVO Art. 13 | CONTRIBUTING-Inhalt |
| Telemetry-Opt-Out wenn Anonymous-Telemetrie | DSGVO Art. 6 | Default-Opt-Out |
| Trademark-Liste | MarkenG | NOTICE / TRADEMARKS |
| Imprint nur wenn kommerzielle Vermarktung | DDG § 5 | Site-Pruefung |

### Typische Verstoesse
- LICENSE fehlt → All-Rights-Reserved Default → Forks rechtlich unklar
- Telemetry-On-by-Default ohne Opt-Out → DSGVO + dejure-Gemeinschaft
- security.txt mit Placeholder-Tokens (siehe `audit-patterns.md` Phase 2)

---

## MedTech / DiGA / Health-Apps

### Trigger
URL-Pattern: `*-health.*`, `*-medizin.*`, `*-symptom.*`, `*-diagnose.*`. Tech-Stack: Health-related libs (e.g. `@medplum/*`, FHIR-Clients), Symptom-Checker-APIs. Content: "Diagnose", "Behandlung", "Symptom-Check", "Therapie-Empfehlung".

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| MDR-Klassifizierung der App (Klasse I/IIa/IIb/III) | MDR Art. 51 + Anhang VIII | CE-Pruefung |
| Klinische Bewertung dokumentiert | MDR Art. 61 + Anhang XIV | interner Vault |
| BfArM-Listung als DiGA (wenn anwendbar) | DiGAV + § 139e SGB V | https://diga.bfarm.de/ |
| EUDAMED-Registrierung | MDR Art. 33 | EUDAMED-DB |
| Vigilanz-Meldungs-Prozess | MDR Art. 87-89 | interne Procedure |
| AI-Act-Hochrisiko-Pruefung (wenn AI-Diagnose) | AI-Act Annex III Nr. 5.d | FRIA + DSFA |
| DSGVO Art. 9 (Gesundheitsdaten) | Art. 9 + § 22 BDSG | DSE + DSFA Pflicht |
| Heilmittelwerbe-Pruefung | HWG | Marketing-Audit |
| Zero-Retention-AVV bei AI-Vendor | DSGVO Art. 28 + 32 | AVV-Pruefung |

### Typische Verstoesse
- KI-Diagnose ohne CE-Mark als SaMD = MDR-Verstoss + Art. 50 AI-Act
- Heilversprechen ohne klinische Bewertung = HWG § 3
- Health-Daten-Drittlandtransfer ohne SCC + TIA = Art. 44 DSGVO + Stufe 2

### Az.-Anker
- BGH I ZR 232/16 (Heilmittelwerbung, 15.02.2018)
- EuGH C-21/23 Lindenapotheke (04.10.2024)

### Cross-Reference
- MedTech-Gesetze: `gesetze/MedTech/MDR-2017-745.md`, `gesetze/MedTech/IVDR-2017-746.md`, `gesetze/MedTech/DiGAV.md`
- AI-Act: `gesetze/EU-Verordnungen/AI-Act-2024-1689/`

---

## Public-Sector / E-Government

### Trigger
URL-Pattern: `*.bund.de`, `*.land.*.de`, `*.kommune.*`, `*.behoerde.*`. Auftraggeber: oeffentliche Stelle. schema.org @type: GovernmentOrganization, GovernmentService.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| EGovG-Konformitaet | EGovG (Bund + Laender) | Doku |
| OZG-Anbindung | OZG (Onlinezugangsgesetz) | Service-Anbindung |
| BFSG Pflicht (auch fuer Behoerden) | BFSG | WCAG 2.1 AA |
| BSI-Mindestanforderungen | BSIG / IT-Grundschutz | Audit |
| Beschaffungsrecht | UVgO / VgV | Vergabeverfahren |
| IT-PLR-Konsolidierung-Konformitaet | Bund-IT-Standard | wenn Bund-Auftrag |
| Datenschutz | DSGVO + BDSG + LDSG | Datenschutz-Konzept |
| Barrierefreiheit | BITV 2.0 | WCAG-Audit |

### Typische Verstoesse
- BITV-Verstoss bei Behoerden-Site = direkter Pruefungs-Anlass
- Vergabe-Verstoss bei Beschaffung = Vergabe-Aufhebung
- Datenpanne in Behoerden-Kontext = besondere oeffentliche Wirkung

### Cross-Reference
- BFSG: `gesetze/BFSG/audit-relevance.md`

---

## Telekommunikation / VoIP / Messaging

### Trigger
URL-Pattern: `*-call.*`, `*-voip.*`, `*-messenger.*`, `*-sms.*`. Tech-Stack: Twilio, MessageBird, Vonage, RingCentral. Content: "Telefonie", "SMS", "VoIP", "Messaging-Service".

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| BNetzA-Anzeige | TKG § 9 | BNetzA-Listung |
| Notruf-Pflicht (110/112) | TKG §§ 164-167 | Notruf-Routing |
| Vertraulichkeits-Pflicht | TKG § 109 + Art. 5 ePrivacy-RL | Verschluesselungs-Audit |
| Telekom-Daten-Loesch-Pflicht | TKG § 169 + DSGVO Art. 5 lit. e | Cron-Audit |
| Verkehrsdaten-Pflicht | TKG | Loesch-Konzept |
| Kunden-Identifikations-Pflicht | TKG bei Prepaid | KYC-Pflicht |

### Cross-Reference
- TKG: `gesetze/TKG/articles.md`
- ePrivacy-RL: `gesetze/ePrivacy-RL-2002-58/`

---

## Streaming / Medien / Verlag

### Trigger
URL-Pattern: `*-tv.*`, `*-stream.*`, `*-news.*`, `*-zeitung.*`, `*-verlag.*`. schema.org @type: NewsArticle, NewsMediaOrganization, VideoObject, BroadcastService.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| MStV § 18 V.i.S.d.P. | Medienstaatsvertrag § 18 | Impressum + V.i.S.d.P. |
| Trennungsgrundsatz | UWG § 5a + MStV | Layout-Audit |
| Urheberrecht-Compliance | UrhG | Image-/Video-Source-Audit |
| KI-generierte-Inhalte-Pflicht | AI-Act Art. 50 Abs. 5 | Article-Footer ab 02.08.2026 |
| Quellen-Angabe bei Zitaten | UrhG § 51 | manuelles Audit |
| Leistungsschutzrecht | UrhG § 87f | LSR-Quellenliste |
| Jugendschutz-Beschraenkung | JMStV §§ 4-5 | Age-Gate / AVS |
| Kinder-Werbungs-Verbot | DSA Art. 28 + JMStV § 6 | Targeting-Audit |
| Streaming-Lizenz-Compliance | UrhG | Lizenz-Vertrag-Pruefung |

### Cross-Reference
- AI-Act Art. 50: `gesetze/EU-Verordnungen/AI-Act-2024-1689/transparenz-art-50.md`
- JuSchG / JMStV: `gesetze/JuSchG-JMStV/articles.md`

---

## Kinder- / Jugendschutz Online

### Trigger
URL-Pattern: `*-kids.*`, `*-jugend.*`, `*-school.*`, `*-game.*`. Content: an Kinder oder Jugendliche gerichtet. AGE-Gate < 18 vorhanden.

### Pflicht-Pruefungen
| Check | Rechtsgrundlage | Verify |
|-------|-----------------|--------|
| AGE-Gate bei Onboarding | DSA Art. 28 + JMStV § 4 | Onboarding-Flow |
| DSGVO Art. 8 Eltern-Einwilligung < 16 J | DSGVO Art. 8 + § 21 BDSG | Consent-Flow |
| Profiling-Werbung-Verbot < 18 J | DSA Art. 28 | Ad-Configuration-Audit |
| Trennungsgrundsatz Werbung | JMStV § 6 | Layout-Audit |
| Spiel-Verkaufs-Beschraenkung | JuSchG § 14 | Inhalts-Audit |
| Zugangsbarriere bei entwicklungsbeeintraechtigenden Inhalten | JMStV §§ 4-5 | technisches Mittel |
| Kinder-Cookies-Sonderregeln | EuGH-Auslegung Art. 6 lit. f | Consent-Banner |
| BzKJ / KJM Compliance | JMStV § 7 (Anbieter-Beauftragter) | Anbieter-Doku |

### Cross-Reference
- JuSchG / JMStV: `gesetze/JuSchG-JMStV/articles.md`
- DSA Art. 28: `gesetze/EU-Verordnungen/DSA-2022-2065/articles.md`

---

## Cross-Branchen-Patterns

### Wenn Branche identifiziert + entsprechende Pflichten verletzt:
- Cross-Risiko: § 5 DDG (Impressum) + Branchen-Pflicht-Verletzung = doppelter Hebel
- Beispiel Heilberuf: Telefon im Impressum fehlt + Werbeverstoss HWG → 2 Abmahnungen denkbar

### Wenn keine Branche identifiziert (generische Site):
- Default: B2B-DACH-Annahme
- Aber: bei Erstgespraech Branche klaeren (Klaerungsfrage 🔴 Pflicht)

### Multi-Branchen-Stack
Wenn Site mehrere Branchen-Layer beruehrt (z.B. Hotel-Portal = Reise + KRITIS-trigger + DSA fuer Reviews + AI fuer Empfehlungen):
- ALLE betroffenen Branchen-Sections laden
- Cross-Risiken explizit pruefen
- Bei Konflikt zwischen Pflichten: stets strikteste Norm anwenden
