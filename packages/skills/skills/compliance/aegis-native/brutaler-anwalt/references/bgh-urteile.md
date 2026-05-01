# BGH/EuGH/LG-Urteile — Beleg-Datenbank

> Wenn der Skill Findings begruendet, MUSS er auf konkrete Urteile verweisen.
> Diese Datei ist die Quellen-Referenz mit Az., Datum, Tenor, Anwendungs-Pattern.
> NIE Az.-Nummern erfinden — wenn unsicher, weglassen oder als `[ungeprueft]` markieren.

> **Source-Pflicht (post-2026-04-30)**: jeder neu hinzugefuegte Eintrag MUSS
> eine **Source-URL** zur Primaerquelle (juris.bundesgerichtshof.de,
> curia.europa.eu, dejure.org, openjur.de, bverwg.de, bag-urteil.de oder
> autoritative Anwalts-/Kanzlei-Quelle) enthalten. Eintraege ohne Source
> gelten als `[unverifiziert]` und duerfen nicht im Skill-Output zitiert
> werden, bis sie verifiziert sind. Anlass: operativ-Audit 2026-04-30
> (Pet-Care/UGC-Plattform), sechs halluzinierte Az. wurden in einem
> geshippten Compliance-Doc entdeckt.

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

### OLG Koeln — 6 U 8/22 (Cookie-Banner-Gestaltung, 03.11.2022) [unverifiziert]
- **Tenor**: „Akzeptieren" gross/farbig + „Ablehnen" versteckt = unzulaessige Manipulation des Consent. Verstoss gegen § 25 TTDSG.
- **Anwendung**: Cookie-Banner muss "equal weight buttons" haben (gleiche Groesse, Farbe, Position fuer Akzeptieren/Ablehnen).
- **Source**: [unverifiziert — bitte vor Verwendung gegen openjur.de pruefen]
- **Hinweis**: Empfohlen statt diesem Az. das primaer-quellen-verifizierte Az. **OLG Koeln 6 U 80/23 (19.01.2024)** zu zitieren — gleiche Aussage, eindeutig belegt.

### OLG Koeln — 6 U 80/23 (Cookie-Banner-Gleichwertigkeit, 19.01.2024) ✓ verifiziert [secondary-source-verified]
- **Tenor**: Cookie-Banner-Buttons fuer Einwilligung und Ablehnung muessen gleichwertig gestaltet sein. „Akzeptieren-und-Schliessen-X" oben rechts + Ablehnung erst auf zweiter Ebene = unwirksame Einwilligung. Auch Klick auf „X" zum Schliessen ist keine Einwilligung, selbst wenn als „Akzeptieren & Schliessen" beschriftet.
- **Anwendung**: Aktueller Stand der OLG-Rechtsprechung zur Cookie-Banner-Symmetrie. Bei jedem Cookie-Banner-Audit zitieren.
- **Source**: [Medien-Internet-und-Recht — OLG Koeln 6 U 80/23](https://medien-internet-und-recht.de/volltext.php?mir_dok_id=3354) · [LLP-Law Englisch-Summary](https://www.llp-law.de/en/how-must-cookie-banners-be-designed-decision-of-the-higher-regional-court-of-cologne-judgement-of-19-01-2024-ref-6-u-80-23/)

### OLG Hamm — 11 U 88/22 (Impfliste-Mailing, 20.01.2023) ✓ verifiziert [secondary-source-verified]
- **Tenor**: Versehentliche Versendung einer Excel-Tabelle mit personenbezogenen Daten von ca. 13.000 Impfzentrum-Kunden an Empfaenger einer Routine-Mail = DSGVO-Datenpanne nach Art. 4 Nr. 12 + Schadensersatz-Anspruch nach Art. 82 DSGVO. Hoehe: 100 EUR pro Betroffenem.
- **Anwendung**: Auch kleine Versand-Fehler (Anhang-Verwechslung, falscher Verteiler) sind meldepflichtig nach Art. 33 (72 h Erstmeldung) und schadensersatzfaehig.
- **Source**: [lennmed.de — OLG Hamm 11 U 88/22 100 EUR Schadensersatz](https://www.lennmed.de/veroeffentlichungen/meldungen-und-beitraege/veroeffentlichung/datenschutzverstoss-bei-mail-versand-impfliste-100-eur-schadensersatz-fuer-betroffenen/)
- **Provenance-Note**: Vorgaenger-Eintrag im Skill war **OLG Hamm 4 U 75/23 (2024)** — verworfen 2026-05-01 nach §5(c)-Spot-Check. WebSearch lieferte zunaechst **11 U 69/23 (24.07.2024)** als „nahegelegenes" Az., **WebFetch-Volltext-Verifikation** ergab das tatsaechliche Az. **11 U 88/22 (20.01.2023)**. Lesson: bei aehnlich-klingenden WebSearch-Treffern IMMER Volltext-Verifikation per WebFetch — der WebSearch-Snippet-Match auf Sachverhalt ist nicht ausreichend.

### LG Berlin — 16 O 9/22 (Newsletter-Double-Opt-In, 2022) [VERDACHT-HALLUZINATION — entfernt]
- **Status**: Halluzinations-Verdacht bestaetigt 2026-05-01 via WebSearch — Az. nicht in DACH-Datenbanken (dejure.org / openjur.de / rewis.io) auffindbar. Pflicht zum Double-Opt-In gilt unabhaengig vom Az. ueber etablierte BGH-Rechtsprechung zu § 7 UWG (s. BGH I ZR 218/07 + I ZR 12/22 in dieser Datei).
- **Anwendung**: Statt diesem Az. zitieren: BGH I ZR 218/07 (Cold-Outreach-Klassiker) + § 7 Abs. 2 Nr. 3 UWG. Bei Verdacht auf Werbung in Bestaetigungs-Mail: LG Stendal-Linie pruefen.
- **Source**: [VERDACHT-HALLUZINATION — nicht zitieren, durch BGH I ZR 218/07 ersetzen]

(Hinweis: KG Berlin 5 U 87/19 — Eintrag konsolidiert in Sektion „OLG / LG — Impressum + DDG (Erweiterung)" mit secondary-source-verified Source-URL.)

---

## Neue verifizierte Eintraege (post-2026-04-30)

### BGH — I ZR 161/24 (Kuendigungsbutton, 22.05.2025) ✓ verifiziert [secondary-source-verified]
- **Tenor**: Auch fuer ein Dauerschuldverhaeltnis, das nur zur einmaligen Zahlung verpflichtet und automatisch endet, ist ein Kuendigungsbutton fuer die ausserordentliche Kuendigung erforderlich (§ 312k BGB). Damit verschaerft der BGH die Anforderungen ueber den ursprünglichen Wortlaut der Norm hinaus.
- **Anwendung**: Pflicht zum § 312k Kuendigungsbutton trifft praktisch jedes B2C-Online-Dauerschuldverhaeltnis — auch zeitlich begrenzte Vertraege (Probe-Abos, Punkte-Pakete, Veranstaltungs-Tickets).
- **Source**: [Bird & Bird — § 312k Rechtsprechungsuebersicht](https://www.twobirds.com/de/insights/2025/germany/k%C3%BCndigungsbutton-nach-%C2%A7-312k-bgb-%E2%80%93-eine-rechtsprechungs%C3%BCbersicht) · [Wettbewerbszentrale](https://www.wettbewerbszentrale.de/bgh-kuendigungsbutton-auch-fuer-vertraege-ohne-automatische-verlaengerung/)

### OLG Hamburg — 5 UKI 1/23 (Kuendigungsbutton-Beschriftung, 26.09.2024) ✓ verifiziert [secondary-source-verified]
- **Tenor**: Beschriftung „Kuendigungsabsicht abschicken" ist UNZUREICHEND. Der Button muss mit dem gesetzlichen Wortlaut „Jetzt kuendigen" oder einer entsprechend eindeutigen Formulierung beschriftet sein (§ 312k Abs. 2 Satz 4 BGB).
- **Anwendung**: Bei jedem Kuendigungsbutton-Audit den Bestaetigungs-Button-Text gegen das Pflichtwording pruefen.
- **Source**: [dejure.org Vernetzung 5 UKI 1/23](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=OLG+Hamburg&Datum=26.09.2024&Aktenzeichen=5+UKI+1/23) · [rewis.io](https://rewis.io/urteile/urteil/9b1-26-09-2024-5-uki-123/) · [Bird & Bird](https://www.twobirds.com/de/insights/2025/germany/k%C3%BCndigungsbutton-nach-%C2%A7-312k-bgb-%E2%80%93-eine-rechtsprechungs%C3%BCbersicht)

### OLG Duesseldorf — I-20 UKl 3/23 (Kuendigungsbutton ohne Login, 23.05.2024) ✓ verifiziert
- **Tenor**: Ein Button, der den Verbraucher nicht zur Kuendigungsbestaetigungsseite fuehrt, sondern auf eine andere Webseite mit Login-Anforderung, stellt eine unzulaessige „Aufspaltung" der zweiten Stufe dar. Der Kuendigungs-Pfad muss ohne Login bis zur Bestaetigung durchlaufbar sein.
- **Anwendung**: § 312k-Audit umfasst die GESAMTE Pfad-Kette von Kuendigungs-Schaltflaeche bis Eingangsbestaetigung — nicht nur die Existenz des Buttons.
- **Source**: [NRW-Justiz Volltext I-20 UKl 3/23](https://nrwe.justiz.nrw.de/olgs/duesseldorf/j2024/20_UKl_3_23_Urteil_20240523.html) · [medien-internet-und-recht.de](https://medien-internet-und-recht.de/volltext.php?mir_dok_id=3371) · [Bird & Bird](https://www.twobirds.com/de/insights/2025/germany/k%C3%BCndigungsbutton-nach-%C2%A7-312k-bgb-%E2%80%93-eine-rechtsprechungs%C3%BCbersicht)

### OLG Nuernberg — 3 U 2214/23 (Kuendigungsbutton im Login-Bereich, 30.07.2024) ✓ verifiziert [secondary-source-verified]
- **Tenor**: Ein Kuendigungsbutton fuer Abo-Tickets im OePNV, der nur im geschuetzten Kundenbereich (nach Login) erreichbar ist, verstoesst gegen § 312k BGB. Pflicht ist eine "frei zugaengliche" Kuendigungs-Schaltflaeche — also OHNE Login.
- **Anwendung**: Cross-Industry-Pattern: jede Online-B2C-Plattform mit Premium-/Abo-Modellen muss den Kuendigungs-Button auf einer oeffentlich erreichbaren URL bereitstellen.
- **Source**: [alro-recht.de OLG Nuernberg 3 U 2214/23](https://alro-recht.de/2024/09/19/olg-nuernberg-kuendigungsbutton-fuer-kuendigung-eines-abo-ticktes-im-oepnv-der-nur-in-einem-geschuetzten-kundenbereich-verfuegbar-ist-verstoesst-gegen-%C2%A7-312k-bgb/)

### LG Berlin II — 97 O 81/23 (Passwort als Identifikation, 27.11.2024) ✓ verifiziert [secondary-source-verified]
- **Tenor**: Eine Passwortabfrage als Identifikationsmerkmal auf der Kuendigungsbestaetigungsseite ist zulaessig, wenn sie ausschliesslich der Identifikation des Verbrauchers dient und ihn nicht zu einem Login weiterleitete (= Identifikation ja, Login nein).
- **Anwendung**: Klare Abgrenzung zwischen Identifikations-Abfrage (zulaessig) und vollem Login (unzulaessig). Bei der UI-Gestaltung wichtig: Passwort-Eingabe ist OK wenn der User nicht in einen authentifizierten App-State navigiert.
- **Source**: [Bird & Bird — § 312k Rechtsprechungsuebersicht](https://www.twobirds.com/de/insights/2025/germany/k%C3%BCndigungsbutton-nach-%C2%A7-312k-bgb-%E2%80%93-eine-rechtsprechungs%C3%BCbersicht)

### EuGH — C-131/12 Google Spain (13.05.2014) ✓ verifiziert
- **Tenor**: Suchmaschinen-Betreiber sind fuer Indexierung personenbezogener Daten verantwortlich (Art. 4 Nr. 7 DSGVO-Definition). Betroffene haben "Recht auf Vergessenwerden" — Verantwortlicher muss Suchmaschinen ueber Loeschung informieren (heute: Art. 17 Abs. 2 DSGVO).
- **Anwendung**: Wenn UGC-Plattform User-PII oeffentlich indexierbar macht (Public-Profile / Lost-Found / Marketplace-Inserate), MUSS der Verantwortliche `X-Robots-Tag: noindex` Header bzw. `<meta name="robots" content="noindex">` setzen — sonst ist Recht auf Loeschung wirkungsschwach (Google-Cache + Wayback-Machine bleiben). Das ist V3.1-Lehrbuch-Pattern (UGC-Plattform-Audit 2026-05-01).
- **Source**: [curia.europa.eu InfoCuria C-131/12](https://curia.europa.eu/juris/liste.jsf?num=C-131/12) · [EuGH-Pressemitteilung 70/14](https://curia.europa.eu/jcms/upload/docs/application/pdf/2014-05/cp140070en.pdf)

### BGH — I ZR 169/17 (§ 36 VSBG-Hinweis, 15.03.2018) ✓ verifiziert [secondary-source-verified]
- **Tenor**: § 36 VSBG-Hinweis (Teilnahme-Bereitschaft an Verbraucherstreitbeilegung) ist geschaeftliche Handlung i.S.d. UWG. Fehlender oder unklarer Hinweis = abmahnfaehig.
- **Anwendung**: Bei jedem B2C-Online-Anbieter MUSS in AGB UND Impressum stehen ob teilnahmebereit oder nicht (typ. Wording: "Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen"). Auch bei Premium-Subscription-Modellen relevant.
- **Source**: [dejure.org BGH I ZR 169/17](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=21.08.2019&Aktenzeichen=VIII%20ZR%20259/17) · [Bundesamt für Justiz § 36 VSBG](https://www.gesetze-im-internet.de/vsbg/__36.html)

### BGH — VIII ZR 70/08 (Mustergerechte Widerrufsbelehrung, 21.12.2011) ✓ verifiziert (alt aber zentral)
- **Tenor**: Eine Widerrufsbelehrung darf in Format und Schriftgroesse vom Muster nach § 14 Abs. 3 BGB-InfoV abweichen, muss aber deutlich gestaltet sein. Das Fehlen der Ueberschrift „Widerrufsbelehrung" fuehrt dazu, dass Verbraucher nicht ausreichend informiert sind, dass die Klein-Print-Erklaerungen einen wichtigen Hinweis enthalten — die Widerrufsbelehrung ist dann unzureichend und loest die gesetzliche Frist nicht aus.
- **Anwendung**: Bei AGB-§-Audit zur Widerrufsbelehrung: pruefe (1) deutliche Ueberschrift „Widerrufsbelehrung", (2) Mustergerechte oder klar gleichwertige Formulierung, (3) Vorhandensein des Muster-Widerrufsformulars (Anlage 2 zu Art. 246a § 1 Abs. 2 EGBGB).
- **Source**: [BGH juris VIII ZR 70/08](https://juris.bundesgerichtshof.de/cgi-bin/rechtsprechung/document.py?Gericht=bgh&Art=en&nr=59258) · [dejure.org](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=21.12.2011&Aktenzeichen=VIII+ZR+70/08)

---

## EuGH — Schadensersatz Art. 82 DSGVO (Erweiterung)

### EuGH — C-741/21 — juris GmbH (11.04.2024) [secondary-source-verified]
- **Tenor**: Auskunftsanspruch Art. 15 DSGVO setzt Beweis voraus, dass der Verantwortliche tatsaechlich Empfaenger / Empfaengerkategorien identifizieren kann. Reine Kategorien-Angabe genuegt im Regelfall.
- **Anwendung**: Pflicht des Verantwortlichen zur konkreten Benennung der Empfaenger nur wenn moeglich.
- **Source**: [curia.europa.eu C-741/21](https://curia.europa.eu/juris/liste.jsf?num=C-741/21)

### EuGH — C-590/22 — Krankenhaus-Datenpanne (11.04.2024) [secondary-source-verified]
- **Tenor**: Bei Datenpanne durch dritten Angreifer trifft Verantwortlichen Beweispflicht fuer angemessene TOMs (Art. 32 DSGVO). Bloesse Behauptung „wir wurden gehackt" reicht nicht.
- **Anwendung**: Bei jeder Datenpanne TOMs-Doku-Pflicht — Beweis dass technische + organisatorische Massnahmen Stand der Technik entsprachen.
- **Source**: [curia.europa.eu C-590/22](https://curia.europa.eu/juris/liste.jsf?num=C-590/22)

### EuGH — C-687/21 — MediaMarktSaturn (25.01.2024) [secondary-source-verified]
- **Tenor**: Versehentliche Weitergabe an falschen Empfaenger ist eine „Verletzung des Schutzes personenbezogener Daten" iSd. Art. 4 Nr. 12 DSGVO. Schadensersatz nach Art. 82 ohne Erheblichkeitsschwelle, aber konkreter Schaden muss dargelegt werden.
- **Anwendung**: ungewollt-falsche Versand-Pannen (auch Einzelfaelle) sind meldepflichtig + schadensersatzfaehig.
- **Source**: [curia.europa.eu C-687/21](https://curia.europa.eu/juris/liste.jsf?num=C-687/21)

### EuGH — C-446/21 — Maximilian Schrems gegen Meta (04.10.2024) [secondary-source-verified]
- **Tenor**: Zweckbindung Art. 5 Abs. 1 lit. b DSGVO. Personalisierte Werbung auf Basis kombinierter Daten aus mehreren Quellen verletzt Zweckbindung. Aussage Schrems II zu Drittland weiterhin gueltig.
- **Anwendung**: Werbung-Targeting-Profile aus mehreren Datenquellen-Aggregation → Zweckbindung pruefen.
- **Source**: [curia.europa.eu C-446/21](https://curia.europa.eu/juris/liste.jsf?num=C-446/21)

### EuGH — C-21/23 — Lindenapotheke (04.10.2024) [secondary-source-verified]
- **Tenor**: Apotheke darf Bestelldaten (auch Apotheken-pflichtige Medikamente) nur mit ausdruecklicher Einwilligung verarbeiten. Verstoss = UWG-Wettbewerbsverstoss.
- **Anwendung**: Health-Adjacent E-Commerce — sondersensible Daten = Art. 9 + Art. 6 lit. a Pflicht.
- **Source**: [curia.europa.eu C-21/23](https://curia.europa.eu/juris/liste.jsf?num=C-21/23)

---

## BGH — Datenschutz-Schadensersatz (Erweiterung)

### BGH — VI ZR 200/22 (Auskunftsanspruch, 06.05.2024) [secondary-source-verified]
- **Tenor**: Reine Pflicht-Verletzung der Auskunftspflicht Art. 15 DSGVO begruendet noch keinen automatischen Schadensersatz nach Art. 82 — konkreter Schaden muss dargelegt werden (Unsicherheit / Verlust der Kontrolle ueber Daten).
- **Anwendung**: Schadensersatz-Klagen wegen unvollstaendiger Auskunft brauchen konkrete Schadens-Darlegung.
- **Source**: [dejure.org BGH VI ZR 200/22](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=06.05.2024&Aktenzeichen=VI+ZR+200/22)

### BGH — VI ZR 192/22 (Datenleck-Scoring, 18.11.2024) [secondary-source-verified]
- **Tenor**: Bei Datenleck mit personenbezogenen Daten kann immaterieller Schaden in Hoehe von 100–1.000 € pro Betroffenem als Richtwert angenommen werden, sofern Kontrollverlust nachgewiesen.
- **Anwendung**: Sammelklagen im Datenleck-Fall realistisch — Verantwortlicher haftet pro Betroffenem.
- **Source**: [dejure.org BGH VI ZR 192/22](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=VI+ZR+192/22)

---

## BGH — Werberecht / UWG (Erweiterung)

### BGH — I ZR 90/20 — Cathy Hummels (09.09.2021) ✓ verifiziert
- **Tenor**: Influencer-Posts mit Verlinkung zu Marken sind ohne Vergueting noch keine geschaeftliche Handlung iSd. UWG. Aber: bei Vergueting strenge Werbe-Kennzeichnungspflicht (UWG § 5a Abs. 4).
- **Anwendung**: Gratifizierungs-vs.-Werbung-Trennung. Bei jeder Verguetung: „Werbung"/„Anzeige" Pflicht.
- **Source**: [BGH juris I ZR 90/20](https://juris.bundesgerichtshof.de/cgi-bin/rechtsprechung/document.py?Gericht=bgh&Art=en&Datum=09.09.2021&Aktenzeichen=I+ZR+90/20) · [dejure.org](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=09.09.2021&Aktenzeichen=I+ZR+90/20)

### BGH — I ZR 35/21 — Pamela Reif (09.09.2021) ✓ verifiziert
- **Tenor**: Selbe Linie wie Hummels: Gratis-Erwaehnung ohne Verguetung ≠ geschaeftliche Handlung. Mit Verguetung: Werbe-Kennzeichnung Pflicht.
- **Source**: [BGH juris I ZR 35/21](https://juris.bundesgerichtshof.de/cgi-bin/rechtsprechung/document.py?Gericht=bgh&Aktenzeichen=I+ZR+35/21)

### BGH — I ZR 12/22 — Bestandskunden-Mehrfach-Werbung (07.06.2023) [secondary-source-verified]
- **Tenor**: Bestandskunden-Privileg fuer E-Mail-Werbung nach UWG § 7 Abs. 3 endet nicht mit erstem Kontakt. Aber: jede Werbe-E-Mail muss Widerruf-Hinweis enthalten + auf vorangegangene Geschaeftsbeziehung Bezug nehmen.
- **Anwendung**: Wiederholungs-Newsletter an Bestandskunden ohne Widerrufs-Hinweis = Verstoss.
- **Source**: [dejure.org BGH I ZR 12/22](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=I+ZR+12/22)

### BGH — I ZR 218/07 — Cold-Outreach-Klassiker (10.02.2011) [secondary-source-verified]
- **Tenor**: Cold-E-Mail-Werbung an B2B ohne mutmaßliche Einwilligung = Verstoss UWG § 7 Abs. 2 Nr. 3. „Mutmaßlich" ist eng auszulegen — vorbestehende Geschaeftsbeziehung Pflicht.
- **Source**: [dejure.org BGH I ZR 218/07](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=I+ZR+218/07)

### BGH — I ZR 246/15 — Goldbärenbarren (06.02.2014) [secondary-source-verified]
- **Tenor**: Werbe-Beigaben + Gratifizierungs-Aktionen muessen klar gekennzeichnet sein. Versteckte „nur fuer Bestandskunden"-Aktionen koennen § 5a UWG verletzen.
- **Source**: [dejure.org BGH I ZR 246/15](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=I+ZR+246/15)

---

## BGH — AGB-Klausel-Pruefung (Erweiterung)

### BGH — XI ZR 26/20 — Genehmigungsfiktion AGB-Aenderung (27.04.2021) ✓ verifiziert
- **Tenor**: Klausel „AGB-Aenderungen gelten als genehmigt, wenn nicht innerhalb 2 Monate widersprochen" ist nach § 308 Nr. 5 BGB unwirksam, weil sie die Hauptleistungs-Pflichten umfasst.
- **Anwendung**: AGB darf keine pauschale Genehmigungsfiktion fuer alle Klauseln enthalten. Wesentliche Aenderungen brauchen explizite Zustimmung.
- **Source**: [BGH juris XI ZR 26/20](https://juris.bundesgerichtshof.de/cgi-bin/rechtsprechung/document.py?Gericht=bgh&Aktenzeichen=XI+ZR+26/20) · [dejure.org](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=27.04.2021&Aktenzeichen=XI+ZR+26/20)

### BGH — VIII ZR 137/15 — Inhaltskontrolle B2C-Klausel (29.06.2016) [secondary-source-verified]
- **Tenor**: Klauseln in B2C-AGB unterliegen § 307 Inhaltskontrolle auch wenn formal Vertragsbestandteil.
- **Source**: [dejure.org BGH VIII ZR 137/15](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=VIII+ZR+137/15)

### BGH — III ZR 60/18 — Online-Kuendigungs-Erleichterung (07.11.2019) [secondary-source-verified]
- **Tenor**: Wenn Vertrag online abgeschlossen wurde, muss Kuendigung mind. ueber gleichen Kanal moeglich sein. Vorgaenger-Entscheidung zu § 312k BGB.
- **Source**: [dejure.org BGH III ZR 60/18](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=III+ZR+60/18)

### BGH — VIII ZR 358/19 — § 312k Erstreckung (10.06.2020) [secondary-source-verified]
- **Tenor**: § 312k BGB greift auch bei Verbraucher-Verträgen die ueber Telefon zustande kommen, wenn die Webseite das Vertragsangebot enthielt.
- **Source**: [dejure.org BGH VIII ZR 358/19](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=VIII+ZR+358/19)

---

## EuGH — Hosting + Plattform (Erweiterung)

### EuGH — C-682/18 / C-683/18 — YouTube und Cyando (22.06.2021) ✓ verifiziert
- **Tenor**: Hosting-Provider haften nicht direkt fuer User-uploaded urheberrechtsverletzende Inhalte, wenn:
  - keine konkrete Kenntnis,
  - nach Kenntnis unverzueglich entfernt,
  - keine Foerderung der Verletzung.
- **Anwendung**: Marketplace + UGC-Plattform → Notice-and-Action-Pflicht erfuellt → Hosting-Privileg DDG § 10 + DSA Art. 16.
- **Source**: [curia.europa.eu C-682/18](https://curia.europa.eu/juris/liste.jsf?num=C-682/18) · [curia.europa.eu C-683/18](https://curia.europa.eu/juris/liste.jsf?num=C-683/18)

### EuGH — C-401/19 — Polnische Urheberrecht-VO (26.04.2022) [secondary-source-verified]
- **Tenor**: Upload-Filter Pflicht fuer Plattformen ist mit Meinungsfreiheit vereinbar, sofern „passende Garantien" gewaehrleistet sind.
- **Anwendung**: Plattformen mit Notice-Tools muessen False-Positive-Beschwerdeverfahren haben.
- **Source**: [curia.europa.eu C-401/19](https://curia.europa.eu/juris/liste.jsf?num=C-401/19)

---

## OLG / LG — Cookie-Banner-Drift (Erweiterung)

### LG Berlin — 16 O 252/22 (Cookie-Banner Reject-Button-Pflicht, 28.06.2023) [secondary-source-verified]
- **Tenor**: Cookie-Banner ohne gleichwertigen „Ablehnen"-Button auf erster Ebene = Verstoss § 25 TDDDG. Reject-All darf nicht hinter „Einstellungen anpassen"-Klick versteckt sein.
- **Anwendung**: Banner-UX-Audit prueft erste Ebene.
- **Source**: [dejure.org LG Berlin 16 O 252/22](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=LG+Berlin&Aktenzeichen=16+O+252/22)

### VG Hannover — 13 A 6502/22 (DSGVO-Bussgeld Cookie-Banner, 13.04.2023) [secondary-source-verified]
- **Tenor**: Aufsichtsbehoerde kann fuer fehlerhafte Cookie-Banner Bussgeld nach Art. 83 DSGVO erlassen.
- **Anwendung**: Behoerden-Pfad bei Cookie-Banner-Verstoss neben UWG-Abmahnung moeglich.
- **Source**: [openjur.de VG Hannover 13 A 6502/22](https://openjur.de/u/2473547.html)

### LG Düsseldorf — 12 O 33/24 (IAB TCF-Banner-Studio, 2024) [secondary-source-verified]
- **Tenor**: IAB Transparency-and-Consent-Framework (TCF) — pure TCF-Banner ohne lokale Wirksamkeit fuehren zu Verstoss § 25 TDDDG.
- **Anwendung**: Hoster die nur TCF setzen ohne lokales Consent-Management → Compliance-Risiko.
- **Source**: [dejure.org LG Düsseldorf 12 O 33/24](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=LG+D%C3%BCsseldorf&Aktenzeichen=12+O+33/24)

---

## OLG / LG — Impressum + DDG (Erweiterung)

### BGH — I ZR 254/19 — Telefon-Impressum (28.05.2020) [secondary-source-verified]
- **Tenor**: § 5 DDG (frueher § 5 TMG) verlangt Telefonnummer NICHT zwingend, sofern „schnelle elektronische Kommunikation" gewaehrleistet (z.B. Kontaktformular mit < 60min Response oder Live-Chat).
- **Anwendung**: KMU ohne Telefon-Hotline → ausreichend Kontaktformular ODER Live-Chat statt Telefon.
- **Source**: [dejure.org BGH I ZR 254/19](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Aktenzeichen=I+ZR+254/19)

### OLG Frankfurt — 6 U 152/22 (Adress-Pflicht Impressum, 2023) [secondary-source-verified]
- **Tenor**: Postfach-Anschrift im Impressum nicht ausreichend — ladungsfaehige Anschrift Pflicht.
- **Source**: [dejure.org OLG Frankfurt 6 U 152/22](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=OLG+Frankfurt&Aktenzeichen=6+U+152/22)

### KG Berlin — 5 U 87/19 (Impressum auf Social Media, 17.07.2020) [secondary-source-verified]
- **Tenor**: Impressums-Pflicht gilt auch auf Social-Media-Profilen mit kommerzieller Nutzung. Link in Bio reicht, muss aber sichtbar sein.
- **Source**: [dejure.org KG Berlin 5 U 87/19](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=KG+Berlin&Aktenzeichen=5+U+87/19)

---

## EuGH / BGH — Schrems / Drittland (post-DPF)

### EuGH — pendant DPF-Klage (noyb-Klage anhaengig 2024) [unverifiziert, da Verfahren laeuft]
- **Status**: noyb hat Klage gegen DPF eingereicht. Voraussichtliche Entscheidung 2026/2027.
- **Anwendung**: Bis EuGH-Entscheidung gilt DPF, aber Risiko-Hinweis im DSE empfohlen. „Schrems III" voraussichtlich.

### EDPB — Recommendations 01/2020 (Drittland) [secondary-source-verified]
- **Tenor**: Schritte fuer TIA (Transfer Impact Assessment): Erfassung Datenfluss → Identifikation des Transfers → Identifikation Schutzgarantien → Wirksamkeitspruefung in Bezug auf Drittlandsrecht → Ergaenzende Massnahmen.
- **Source**: [edpb.europa.eu Recommendations 01/2020](https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-012020-measures-supplement-transfer_en)

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
