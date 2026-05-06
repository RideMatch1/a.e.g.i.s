# Bußgeld-Argumentations-Layer — Skill-Reference v1.0

> Was Verteidiger bei DSGVO-Bußgeld-Verfahren brauchen: Berechnungs-Methodik (EDPB + DSK),
> Mitigations-Argumente, Aggravations-Argumente, Top-50-EU-Bußgeld-Vergleichs-DB,
> Anfechtungs-Strategien post EuGH C-807/21 Deutsche Wohnen.
>
> Stand: 2026-05-05 · Generiert für brutaler-anwalt v5.0.0 Max-Out (Phase 2.x).
> Tone: Verteidiger-Anwalt-Mode (helpful for the defendant).

> **Source-Pflicht** (mirrors eu-eugh-dsgvo-schadensersatz.md): jeder EuGH/BGH-Az.
> ist mit Primaerquelle ODER 2 Sekundaerquellen versehen. Top-50-Eintraege in
> Section 4 sind mit `verification`-Tag markiert (`primary` / `secondary-only` /
> `cross-confirmed`). Eintraege ohne ausreichende Verifikation werden nicht im
> Skill-Output zitiert.

> **Disclaimer-Hinweis**: dieses Layer ersetzt keine individuelle Mandantenberatung.
> Die Argumente sind als Verteidiger-Werkzeug-Kasten formuliert, nicht als
> Garantieaussage. Bußgeld-Bemessung ist Ermessens-Akt der Aufsichtsbehoerde
> und gerichtlicher Pruefung im Bußgeldverfahren (§§ 67 ff. OWiG) zugaenglich.

---

## Inhalt

- Section 1 — Rechtliche Grundlagen (Art. 83 DSGVO, EDPB Guidelines 04/2022, DSK-Konzept, EuGH C-807/21, LG Bonn 1&1)
- Section 2 — Mitigations-Argumente-Katalog (M-1 bis M-15)
- Section 3 — Aggravations-Argumente-Katalog (A-1 bis A-10)
- Section 4 — Top-50 EU-Bußgelder 2018-2025 strukturiert
- Section 5 — Verteidigungs-Strategien (Anfechtung, Vergleich, Pfändungsschutz)
- Section 6 — Skill-Output-Pattern (Anwendung)
- Section 7 — Quellen + Verweise

---

## Section 1 — Rechtliche Grundlagen

### 1.1 Art. 83 DSGVO Bußgeld-Stufen

DSGVO kennt **zwei** Bußgeld-Stufen ueber Art. 83 Abs. 4 + Abs. 5/6:

| Stufe | Norm | Maximum | Umsatz-Cap |
|-------|------|---------|-----------|
| **Stufe 1** | Art. 83 Abs. 4 DSGVO | bis **10 Mio. EUR** | **2 %** des weltweiten Konzern-Jahresumsatzes |
| **Stufe 2** | Art. 83 Abs. 5 + 6 DSGVO | bis **20 Mio. EUR** | **4 %** des weltweiten Konzern-Jahresumsatzes |

**"the higher of the two"** — Maximum = der jeweils HOEHERE Betrag aus statischem Cap (10/20 Mio.) und dynamischem Umsatz-Cap (2/4 %). Bei Konzern-Unternehmen ist **immer** der Konzern-Umsatz massgeblich (post EuGH C-807/21, siehe Section 1.5).

**Stufen-Zuordnung der Verstoesse**:
- **Stufe 1 (Art. 83 Abs. 4)**: TOMs nach Art. 25, 32 (Privacy by Design, Sicherheit), DSB-Pflichten Art. 37-39, Auftragsverarbeitungs-Vertrag Art. 28, Verzeichnis Art. 30, DSFA Art. 35-36
- **Stufe 2 (Art. 83 Abs. 5)**: Grundsaetze Art. 5, Rechtsgrundlage Art. 6, Einwilligung Art. 7, sensitive Daten Art. 9, Betroffenenrechte Art. 12-22, Drittland-Transfers Art. 44-49
- **Stufe 2 (Art. 83 Abs. 6)**: Nichtbefolgung von Aufsichtsanordnungen nach Art. 58 Abs. 2

### 1.2 Art. 83 Abs. 2 DSGVO — 11 Bemessungsfaktoren (verbatim Buchstaben a-k)

Diese **11 Faktoren** sind das gerichtliche Pruefraster. Jede Bußgeld-Anfechtung muss sie alle adressieren:

- **a)** Art, Schwere und Dauer der Verletzung; Art, Umfang oder Zweck der Verarbeitung; Anzahl der betroffenen Personen; Ausmass des Schadens
- **b)** Vorsatz oder Fahrlässigkeit
- **c)** ergriffene Massnahmen zur Minderung des Schadens
- **d)** Grad der Verantwortung unter Beruecksichtigung der nach Art. 25 + 32 getroffenen TOMs
- **e)** frueher massgebliche Verletzungen des Verantwortlichen / Auftragsverarbeiters
- **f)** Umfang der Zusammenarbeit mit der Aufsichtsbehoerde zur Behebung des Verstosses
- **g)** Kategorien der betroffenen personenbezogenen Daten (insb. Art. 9 sensitive Daten)
- **h)** Art und Weise wie die Verletzung der Aufsichtsbehoerde bekannt geworden ist (Selbstmeldung vs. Behoerden-Aufdeckung)
- **i)** frueher gegen den Verantwortlichen angeordnete Massnahmen — Einhaltung dieser Anordnungen
- **j)** Einhaltung von genehmigten Verhaltensregeln nach Art. 40 oder Zertifizierungen nach Art. 42
- **k)** **jedweder andere erschwerende oder mildernde Umstand** wie unmittelbar oder mittelbar durch den Verstoss erlangter finanzieller Vorteil oder vermiedene Verluste

> Kommentar: lit. **k** ist die Generalklausel — alles was nicht in lit. a-j passt, kann hier reingehoert werden. Im Verteidigungs-Memo immer als Auffang-Argument nutzen.

### 1.3 EDPB Guidelines 04/2022 — Calculation Methodology (Final v2.1, 24.05.2023)

Der **European Data Protection Board** (EDPB) hat am 24.05.2023 die finale v2.1 der Guidelines 04/2022 verabschiedet. Diese sind nicht rechtsverbindlich, aber **alle Aufsichtsbehoerden in der EU folgen ihnen** (Art. 70 Abs. 1 lit. e DSGVO — EDPB-Leitlinien sind Konsistenz-Mechanismus).

**Das 5-Schritte-Modell** (EDPB):

| Schritt | Inhalt |
|---------|--------|
| **1** | Identifikation der Verarbeitungsvorgaenge im Fall + Anwendung Art. 83 Abs. 3 (Konkurrenzen, mehrere Verstoesse aus derselben Verarbeitung → hoechste Stufe gilt) |
| **2** | Bestimmung des **Startpunkts** (Starting Point) — Schwere-Klassifizierung + Umsatz-Band des Verantwortlichen |
| **3** | Anwendung **mildernder + erschwerender** Umstaende nach Art. 83 Abs. 2 |
| **4** | Identifikation des **gesetzlichen Maximums** (statisch 10/20 Mio. vs dynamisch 2/4 % Konzern-Umsatz) |
| **5** | Pruefung **Wirksamkeit, Verhältnismässigkeit, Abschreckung** (Art. 83 Abs. 1 DSGVO) — Endkorrektur |

**Schwere-Klassen + Starting-Amount-Range** (relativ zum gesetzlichen Maximum):

| Schwere-Klasse | Starting Amount % vom Max | Beispiele |
|----------------|---------------------------|-----------|
| **Low** (gering) | 0 % bis 10 % | einmaliger admin. Verstoss, kleiner Personenkreis, keine sensitive Daten |
| **Medium** (mittel) | 10 % bis 20 % | wiederholter Verstoss, mittlere Personenzahl, allgemeine personenbezogene Daten |
| **High** (hoch) | 20 % bis 100 % | massive Personenzahl, sensitive Daten Art. 9, Vorsatz, langer Zeitraum |

**Umsatz-Adjustment innerhalb der Schwere-Klasse**: je hoeher der Umsatz **innerhalb des anwendbaren Tier**, desto hoeher der Starting-Amount-Punkt. Die EDPB-Guidelines ruehmen ausdruecklich, dass diese Methodik **kein Automatismus** ist — die Aufsichtsbehoerde behaelt Ermessen.

> **Anwendungs-Pattern**: Verteidiger pruefen Schritt 2 (Starting-Point) IMMER zuerst — wenn die Behoerde "High" eingeordnet hat, aber Argumente fuer "Medium" greifen, fallen 80%+ der Bußgeldhoehe weg. Schwere-Klassifikation ist die wichtigste Stellschraube.

### 1.4 BfDI / DSK Bußgeldkonzept 2019 — DE-Methodik

Die **Datenschutzkonferenz** (DSK = Konferenz der unabhaengigen Datenschutzaufsichtsbehoerden des Bundes und der Laender) hat am 14.10.2019 ein **eigenes** Bußgeld-Konzept beschlossen. Zentral: **umsatz-getrieben + 5-Schritte**, parallel zum EDPB-Schema entwickelt.

**Die 4 Größenklassen** (Konzern-Jahresumsatz weltweit, Vorjahr):

| Klasse | Umsatz-Band | Beispiel |
|--------|-------------|----------|
| **A** Kleinstunternehmen | bis 2 Mio. EUR | Lokale GmbH, Einzelarzt, kleines Online-Shop |
| **B** Kleine Unternehmen | 2 - 10 Mio. EUR | Mittelstand-GmbH |
| **C** Mittlere Unternehmen | 10 - 50 Mio. EUR | Regionaler Mittelstand, Konzern-Tochter |
| **D** Großunternehmen | ueber 50 Mio. EUR | Konzern, Multinational |

Klassen **A-D** haben jeweils Untergruppen (z.B. A.I, A.II, A.III) mit konkreten **mittleren Jahresumsaetzen**, aus denen der Tagessatz berechnet wird. Beispiel A.I (DSK-Tabelle): mittlerer Jahresumsatz 350.000 EUR → 350.000/360 = **972 EUR Tagessatz**.

**Die 5 Schritte** (DSK-Konzept):

| Schritt | Inhalt |
|---------|--------|
| **1** | Zuordnung Unternehmen zu Größenklasse A/B/C/D |
| **2** | Bestimmung des mittleren Jahresumsatzes der Untergruppe → **Tagessatz = mittlerer Jahresumsatz / 360** |
| **3** | **Schweregrad-Multiplikator** (leicht/mittel/schwer/sehr schwer) — Tagessatz × Faktor = Grundbetrag |
| **4** | Anpassung an taeter-bezogene Umstaende nach Art. 83 Abs. 2 (Mitigations + Aggravations) |
| **5** | **Wirksamkeit / Verhaeltnismaessigkeit / Abschreckung** — Endkorrektur (Art. 83 Abs. 1) |

**Schweregrad-Faktor-Tabellen** (Stufe 2, Art. 83 Abs. 5):

| Schweregrad | Faktor (Stufe 2) |
|-------------|------------------|
| leicht | 1 - 4 |
| mittel | 4 - 8 |
| schwer | 8 - 12 |
| sehr schwer | 12 - 14,4 |

Faktor **14,4** entspricht exakt **4 %** des mittleren Jahresumsatzes (= dynamisches Maximum Stufe 2). Fuer Stufe 1 (Art. 83 Abs. 4) ist der Faktor halbiert (Maximum 7,2 = 2 %).

> **Anwendungs-Pattern**: Bei **DE-Bußgeld** auf den DSK-Algorithmus konkret rechnen — wenn Aufsichtsbehoerde Faktor 12 (= sehr schwer) angewendet hat, aber Indizien nur Faktor 8 (= schwer) tragen, ist das ein offener Reduktions-Hebel.
>
> **CRITICAL** — **das DSK-Konzept ist nicht rechtsverbindlich** und wurde vom LG Bonn 11.11.2020 (siehe 1.6) **explizit kritisiert**. Verteidiger nutzen das DSK-Konzept als **interne Konsistenz-Pruefung der Behoerde**, nicht als geschuldete Berechnungs-Methode.

### 1.5 EuGH C-807/21 Deutsche Wohnen SE gg. Staatsanwaltschaft Berlin (05.12.2023) ✓ verifiziert [secondary-source-verified]

**Tenor (zwei zentrale Aussagen)**:

1. **Verschuldens-Erfordernis**: Eine Bußgeld-Verhaengung nach Art. 83 DSGVO setzt einen **schuldhaft begangenen Verstoss** (Vorsatz oder Fahrlaessigkeit) voraus. Es ist **nicht erforderlich**, dass der Verstoss einer **identifizierten natuerlichen Person** zugerechnet wird (insb. nicht zwingend Geschaeftsleitung). Eine **Verstoss-Begehung im Rahmen der unternehmerischen Taetigkeit** durch einen Mitarbeiter genuegt — sofern Vorsatz/Fahrlaessigkeit auf Unternehmens-Ebene zu bejahen ist. Fahrlaessigkeit liegt vor, wenn **die Rechtswidrigkeit dem Verantwortlichen nicht entgehen konnte**.
2. **Konzern-Umsatz-Basis (obiter dictum)**: Wenn der Bußgeld-Empfaenger ein **Unternehmen i.S.v. Art. 101, 102 AEUV** ist oder zu einem solchen gehoert, ist das **Maximum** nach Art. 83 Abs. 4-6 als Prozentsatz des **weltweiten Konzern-Vorjahres-Umsatzes** zu berechnen. Damit greift der **funktionale Unternehmensbegriff** des Wettbewerbsrechts auch im Datenschutz-Bußgeld-Recht.

**Bedeutung fuer Verteidiger**:
- ⚖ **Negativ fuer Mandant**: Konzern-Umsatz-Basis ist EuGH-bestaetigt → bei Großkonzernen sind Hoechstbetraege drastisch gewaltig (Stufe 2 = 4 % weltweit).
- ⚖ **Positiv fuer Mandant**: **Verschulden ist Voraussetzung** — die Behoerde muss positiv darlegen, dass Vorsatz oder Fahrlaessigkeit vorlag. **Bloße Verstoss-Festellung reicht nicht** (kein "strict liability"). Verteidiger muss hier **substantiieren**: welche Sorgfaltspflicht wurde verletzt? Welche Erkenntnis-Moeglichkeit hatte das Unternehmen?
- ⚖ **Dogmatisch**: Wechsel vom **Rechtstraeger-Prinzip** (DE-OWiG-Tradition: Bußgeld nur ueber § 30 OWiG, identifizierter Anknuepfungs-Taeter) zum **Funktionstraeger-Prinzip** (Bußgeld direkt gegen die juristische Person, ohne Anknuepfungs-Taeter).

**Source**: [EUR-Lex 62021CJ0807](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62021CJ0807) · [curia C-807/21](https://curia.europa.eu/juris/liste.jsf?language=de&num=C-807/21) · [Taylor Wessing — EuGH zu Deutsche Wohnen](https://www.taylorwessing.com/de/insights-and-events/insights/2023/12/eugh-zu-deutsche-wohnen) · [GDD — EuGH zur Bußgeldhaftung](https://www.gdd.de/europa-meldungen/eugh-zur-bussgeldhaftung-deutsche-wohnen/) · [Clyde & Co — GDPR fines: ECJ allows direct sanctions](https://www.clydeco.com/en/insights/2023/12/gdpr-fines-ecj-allows-direct-sanctions-against-leg)

### 1.6 LG Bonn 11.11.2020 — 1&1 Telecom GmbH (Az. 29 OWi 1/20) ✓ verifiziert [secondary-source-verified]

**Outcome (load-bearing fuer Verteidiger)**: BfDI hatte Bußgeld i.H.v. **9,55 Mio. EUR** verhaengt → LG Bonn **reduzierte auf 900.000 EUR** (-90 %). Das Urteil wurde rechtskraeftig.

**Sachverhalt**: Eine Anruferin erhielt 2018 ueber die 1&1-Service-Hotline die neue Mobilfunknummer ihres Ex-Mannes — als Authentifizierung genuegten Name + Geburtsdatum. BfDI wertete das als **schwere Fahrlaessigkeit nach Art. 32 DSGVO** (Sicherheit der Verarbeitung — TOMs-Pflicht).

**Court's Reasoning (zentrale Verhältnismässigkeits-Argumente)**:

1. **DSK-Konzept ist NICHT geschuldet** — das LG Bonn lehnt die rein **umsatz-orientierte** Berechnungs-Methode ab. Umsatz ist **EIN** Bemessungsfaktor (lit. a-k Art. 83 Abs. 2), aber **nicht der primaere** wie das DSK-Konzept es vorsieht. Eine umsatz-primaere Methode "kann zu Ergebnissen fuehren, die der Verordnungsgeber moeglicherweise nicht gewollt hat" — naemlich unverhältnismässig hohe Bußgelder fuer auch nur geringfuegige Verstoesse umsatz-starker Konzerne.
2. **Daten-Sensibilitaet niedrig** — die Daten in den Call-Centern waren **nicht** Art. 9 sensitive Daten, sondern allgemeine Vertragsinformationen (Name, Adresse, Telefonnummer, allgemeine Vertrags-Daten).
3. **Risiko-Begrenzung pro Anruf** — pro Anruf konnte nur **eine Information** abgefragt werden → das Missbrauchs-Risiko war **fuer wenige Kunden** real, nicht systemisch.
4. **Missbrauchs-Wahrscheinlichkeit gering** — die Court bejaht zwar Authentifizierungs-Defizit (Name+Geburtsdatum sind oeffentlich erlangbar), aber der Praxis-Missbrauch ist eher selten.
5. **Mitwirkung 1&1** — das Unternehmen hatte das Authentifizierungs-Verfahren waehrend des Verfahrens **bereits angepasst** (3-Faktor-Authentifizierung).

**Bedeutung fuer Verteidiger** (Reusable Mitigations-Pattern):
- ⚖ Argumentations-Linie: **DSK-Algorithmus ist Ermessens-Hilfe, kein Subsumtions-Schritt** → Bemessung muss alle 11 Faktoren des Art. 83 Abs. 2 individuell wuerdigen
- ⚖ **Daten-Sensibilitaet ist eine Stellschraube** (siehe M-5)
- ⚖ **Risiko-Begrenzung pro Vorgang** (single-record-per-call) ist Mitigations-Argument fuer Reichweite des Verstosses (siehe M-7 Verhaeltnismaessigkeit)
- ⚖ **Behebung waehrend Verfahren** ist klassischer Mitigations-Faktor (siehe M-8)

**Caveat 2024+**: nach EuGH C-807/21 (05.12.2023) ist die Konzern-Umsatz-Basis als **Maximum** EuGH-bestaetigt. Das LG Bonn-Urteil bleibt aber relevant fuer die **Bemessung innerhalb des Maximums** — denn das Ermessen der Aufsichtsbehoerde wurde durch C-807/21 nicht aufgehoben.

**Source**: [LG Bonn 29 OWi 1/20 — dejure.org](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=LG+Bonn&Datum=11.11.2020&Aktenzeichen=29+OWi+1%2F20) · [LTO — LG Bonn reduziert 1&1-Bußgeld](https://www.lto.de/recht/nachrichten/n/lg-bonn-29owi120lg-bussgeld-1und1-datenschutzverstoss-dsgvo-millionen-herabgesetzt) · [Dr. Bahr — Urteilsgruende 1&1](https://www.dr-bahr.com/news/urteilsgruende-zu-dsgvo-bussgeld-ihv-900000-eur-gegen-11-liegen-vor.html) · [CR-online — LG Bonn kippt umsatzbezogenes Bußgeld](https://www.cr-online.de/blog/2020/11/11/lg-bonn-kippt-umsatzbezogenes-datenschutzbussgeld/) · [Datenschutz-Notizen — Urteil rechtskraeftig](https://www.datenschutz-notizen.de/urteil-gegen-die-11-telecom-gmbh-rechtskraeftig-1328816/)

> **Korrektur-Hinweis fuer Skill-Output**: 1&1 Telecom GmbH gehoert zu **United Internet AG**, **NICHT** zu Bertelsmann. Bei Mandantenmemo nicht verwechseln.

---

## Section 2 — Mitigations-Argumente-Katalog

15 konkrete Argumente die der Verteidiger einsetzt — jeweils mit konkretem Pruefraster, DSGVO-Anker und realistischer Erfolgs-Aussicht. **Kombiniert** zu nutzen — niemals nur ein Argument allein vorbringen.

### M-1: Selbstmeldung nach Art. 33 DSGVO (Notification innerhalb 72h)

- **Argument**: "Mandant hat den Verstoss **innerhalb 72 Stunden** nach Bekanntwerden gemeldet (Art. 33 Abs. 1) — vor Aufdeckung durch die Aufsichtsbehoerde."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **h** (Art und Weise wie Verletzung bekannt geworden ist)
- **Pruefraster**: (1) liegt Art. 33-Meldung vor? (2) war sie vollstaendig? (3) wurde sie freiwillig + frueh erstattet? (4) wurde betroffene Personen nach Art. 34 informiert?
- **Erfolgs-Aussicht**: **HOCH** (regelmaessig 20-40 % Reduktion, je nach Jurisdiction)
- **Anwendung**: bei jedem Datenpannen-Verfahren als Default-Argument; im Memo Selbstmeldungs-Datum + Aufdeckungs-Datum dokumentieren

### M-2: Aktive Kooperation mit der Aufsichtsbehoerde

- **Argument**: "Mandant hat alle angeforderten Unterlagen **fristgerecht und vollstaendig** uebergeben, hat Audit-Logs proaktiv vorgelegt, hat Mitarbeiter zur Verfuegung gestellt."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **f** (Umfang der Zusammenarbeit)
- **Pruefraster**: (1) Anzahl Auskuenfte erteilt? (2) Verzoegerungen? (3) auf Anhoerung detailliert geantwortet? (4) Anwalt-Vorlage waehrend Verfahren?
- **Erfolgs-Aussicht**: **MITTEL bis HOCH** (10-30 %)
- **Anwendung**: Mandanten-Mandat-Briefing: ALLES dokumentieren was uebergeben wird, Datums-Stempel, Vollstaendigkeits-Vermerk

### M-3: Erstverstoss / keine Vorbelastung

- **Argument**: "Mandant ist **nicht vorbestraft** im DSGVO-Bereich; keine frueheren Anordnungen oder Bußgelder durch eine Aufsichtsbehoerde."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **e + i** (frueher massgebliche Verletzungen / fruehere angeordnete Massnahmen)
- **Pruefraster**: (1) BfDI-Auskunft einholen ueber fruehere Verfahren; (2) Landesbehoerden-Recherche; (3) ggf. EU-OSS-Konsultation
- **Erfolgs-Aussicht**: **MITTEL** (Standard-Mitigations-Punkt — bei Wiederholungs-Taeter waere es Aggravation)
- **Anwendung**: Leerfeld immer aktiv vortragen, nicht passiv warten

### M-4: Geringe Anzahl Betroffener

- **Argument**: "Verstoss betraf **N (<= 100)** identifizierbare Personen — kein systemisches Datenleck."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **a** (Anzahl der betroffenen Personen)
- **Pruefraster**: konkrete Zahl ermitteln + glaubhaft machen (Protokoll, Mail-Liste, Kunden-DB-Filter)
- **Erfolgs-Aussicht**: **HOCH** wenn N < 100; **MITTEL** N 100-1000; faellt weg wenn N > 1000
- **Anwendung**: bei punktuellen Datenfehl-Versendungen (Mailing-Fehler, falscher Empfaenger) immer

### M-5: Geringe Schwere der Daten (keine sensitive Kategorien)

- **Argument**: "Verstoss betraf **keine** Art. 9 sensitive Daten (Gesundheit, Religion, Politische Meinung, sexuelle Orientierung, Gewerkschafts-Zugehoerigkeit, Rasse, biometrische/genetische Daten) — sondern allgemeine personenbezogene Daten."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **g** (Kategorien der betroffenen personenbezogenen Daten)
- **Pruefraster**: Daten-Klassifizierung im Verarbeitungs-Verzeichnis (Art. 30); Abgleich mit Art. 9 Liste; falls allgemein → Mitigation
- **Erfolgs-Aussicht**: **HOCH** (signifikante Reduktion bei nicht-sensiblen Daten — vgl. LG Bonn 1&1: kein sensitive Daten = Reduktions-Argument)
- **Anwendung**: bei Art. 32-Verstoessen oft entscheidend

### M-6: Technischer Sicherheits-Hoechststand-Argumentation

- **Argument**: "Mandant betreibt **ISO 27001-zertifiziertes** ISMS; **BSI-IT-Grundschutz**-konform; alle ruhenden Daten **AES-256-GCM verschluesselt**; **Zero-Trust-Architektur**; jaehrliche Pen-Tests; SIEM-Monitoring 24/7."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **d** (Grad der Verantwortung — TOMs nach Art. 25 + 32) + lit. **j** (Zertifizierungen nach Art. 42)
- **Pruefraster**: (1) Zertifikate vorlegen; (2) interne TOM-Liste; (3) Pen-Test-Reports; (4) Schulungs-Nachweise; (5) Audit-Log-Auswertung
- **Erfolgs-Aussicht**: **HOCH** wenn Verstoss menschlich/Insider; **MITTEL** wenn TOMs offensichtlich versagt haben
- **Anwendung**: ALLES dokumentieren — Zertifikats-IDs, Datums-Stempel der Audits, Trainings-Curriculum

### M-7: Verhaeltnismaessigkeit zur Unternehmens-Groesse (KMU-Argument)

- **Argument**: "Bußgeld-Hoehe ist **existenz-bedrohend** fuer Mandant — Konzern-Umsatz von X Mio. ist nicht eigenes Unternehmen, sondern Mutter-Konzern; eigentliche operative Einheit hat nur Y Mio. Umsatz."
- **DSGVO-Anker**: Art. 83 Abs. 1 (Verhaeltnismaessigkeit) + lit. **k** (mildernde Umstaende)
- **Pruefraster**: (1) Wirtschaftliche Lage; (2) Eigenkapital-Quote; (3) Existenz-Drohung dokumentieren (Steuerberater-Gutachten); (4) Vergleich Konzern-Tochter vs Mutter-Umsatz
- **Erfolgs-Aussicht**: **MITTEL** bei klein/mittel; **NIEDRIG** bei Konzernen post C-807/21
- **Anwendung**: KMU mit Bußgeld nahe Existenz-Vernichtung; auch bei Konzern-Toechtern moeglich, wenn klar getrennt

> **Beleg-Pattern**: LG Bonn 1&1 hat genau dieses Argument akzeptiert — DSK-Konzept, dass nur an Konzern-Umsatz orientiert ist, fuehrt zu unverhältnismässigen Ergebnissen.

### M-8: Schadensminderungs-Massnahmen sofort umgesetzt

- **Argument**: "Mandant hat **innerhalb 24h** nach Bekanntwerden alle technischen Pflicht-Schritte ergriffen: Daten-Loeschung, Benachrichtigung Betroffener, Recovery-Prozess, externe Forensik beauftragt."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **c** (ergriffene Massnahmen zur Minderung des Schadens)
- **Pruefraster**: zeitliche Dokumentation (Stunden-genaue Logs); Art. 34-Benachrichtigung; Loesch-Bestaetigungen; Forensik-Report
- **Erfolgs-Aussicht**: **HOCH** (15-30 % Reduktion typisch)
- **Anwendung**: bei Datenpannen IMMER vortragen — auch wenn nur Einzel-Massnahmen, jede einzelne benennen

### M-9: Compliance-Programm-Vorhanden

- **Argument**: "Mandant hat einen **DSB nach Art. 37** bestellt; jaehrliche Datenschutz-Schulungen; vollstaendiges Verarbeitungs-Verzeichnis Art. 30; AVV-Stack mit allen Auftragsverarbeitern; DSFA durchgefuehrt fuer Hoch-Risiko-Verarbeitungen."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **d** (Grad der Verantwortung — gesamtes Compliance-Programm)
- **Pruefraster**: (1) DSB-Vertrag + Bestellungs-Urkunde; (2) Schulungs-Curriculum + Teilnahme-Listen; (3) Verarbeitungs-Verzeichnis als Anlage; (4) AVV-Liste; (5) DSFA-Berichte
- **Erfolgs-Aussicht**: **HOCH** (zentrales Argument fuer "Sorgfalt eingehalten")
- **Anwendung**: ALWAYS in DE-Verfahren — die Behoerde nimmt Compliance-Programm sehr ernst

### M-10: Verhaltensregeln + Zertifizierungen

- **Argument**: "Mandant ist **TrustedShops-zertifiziert**; **EuroPriSe-Siegel**; **CSA STAR Cloud-Zertifikat**; Mitglied **Bitkom-Code-of-Conduct nach Art. 40**."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **j** (Verhaltensregeln nach Art. 40 + Zertifizierungen nach Art. 42)
- **Pruefraster**: Zertifikat-Originale; Mitgliedschafts-Belege; Audit-Reports
- **Erfolgs-Aussicht**: **MITTEL** (laenderspezifisch — sehr wichtig in DE/AT, weniger in IT/ES)
- **Anwendung**: Anlagen-Mappe mit allen Siegeln + Zertifikaten

### M-11: Insider-Threat / Mitarbeiter-Eigenmaechtigkeit

- **Argument**: "Verstoss durch einzelnen Mitarbeiter, der **gegen interne Weisungen + Schulungen** gehandelt hat — Mandant hat **alle erforderlichen** TOMs + Schulungen umgesetzt; Insider-Verhalten war nicht vorhersehbar."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **d** (Verantwortlichkeit) + lit. **k** (mildernde Umstaende) + Verschulden-Argumentation post C-807/21
- **Pruefraster**: (1) Schulung des Mitarbeiters belegen; (2) Weisungs-Verstoss dokumentieren (Kuendigungs-Schreiben, Disziplinarverfahren); (3) TOMs zur Vorbeugung; (4) Whistleblowing-Kanal
- **Erfolgs-Aussicht**: **MITTEL** (post C-807/21 schwieriger — Verschulden auf Unternehmens-Ebene reicht; aber Argument bleibt fuer Bemessungs-Hoehe relevant)
- **Anwendung**: bei einzelnen Datendiebstahl-Faellen (Mitarbeiter kopiert Kunden-DB); arbeitsrechtliche Folge-Massnahme dokumentieren

### M-12: Behoerden-Inkonsistenz / Gleichbehandlungs-Argument

- **Argument**: "In **vergleichbaren Faellen** hat dieselbe oder andere Aufsichtsbehoerden **niedrigere** Bußgelder verhaengt — z.B. [zitiere konkretes Vergleichs-Bußgeld aus Section 4]. Eine signifikant hoehere Bemessung verletzt Art. 3 GG i.V.m. Verwaltungs-Selbstbindung."
- **DSGVO-Anker**: Art. 83 Abs. 1 (Wirksamkeit, Verhaeltnismaessigkeit, Abschreckung) + Art. 3 GG / Art. 20 GR-Charta (Gleichheit)
- **Pruefraster**: (1) enforcementtracker.com Recherche; (2) BfDI-Taetigkeitsberichte; (3) Sektor-spezifische Vergleichs-Faelle finden
- **Erfolgs-Aussicht**: **MITTEL** (Behoerde ist nicht streng gebunden, aber muss begruenden warum sie abweicht)
- **Anwendung**: Section 4 dieses Layers ist die Material-Quelle — immer 2-3 Vergleichs-Faelle vorlegen

### M-13: Aussergewoehnliche Umstaende (Force Majeure)

- **Argument**: "Verstoss erfolgte unter **aussergewoehnlichen Umstaenden** — COVID-19-Pandemie / Cyberangriff einer staatlich-gestuetzten APT / Hochwasser-Notfall — die nicht vorhersehbar waren."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **k** (mildernde Umstaende)
- **Pruefraster**: (1) Faktischer Beleg (BSI-Bericht zur APT, Behoerden-Notlage-Erklaerung); (2) Zeitlicher Zusammenhang; (3) keine alternative Handlungs-Moeglichkeit
- **Erfolgs-Aussicht**: **MITTEL** (Behoerden gewaehren regelmaessig 10-20 % Abschlag fuer COVID-Faelle; APT-Argument schwer durchsetzbar nach C-340/21)
- **Anwendung**: nur bei wirklich aussergewoehnlichen Lagen — bei "normalen" Cyber-Angriffen greift C-340/21 dagegen

### M-14: Post-Incident-Verhalten (Datenpannen-Folgen-Bewaeltigung)

- **Argument**: "Mandant hat **nach** der Panne: vollstaendige forensische Aufklaerung beauftragt; zusaetzliche TOMs implementiert (z.B. WAF, Bot-Detection, Multi-Faktor-Authentifizierung); externe Audits eingeholt; Betroffenen kostenlos Identitaetsschutz angeboten (z.B. Schufa-Monitoring); kein Mandant-Versuch der Vertuschung."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **c** (Schadens-Minderung) + lit. **f** (Kooperation)
- **Pruefraster**: Zeitliche Dokumentation post-Incident; konkrete Massnahmen-Liste; Kosten-Aufstellung als Beleg fuer Ernsthaftigkeit
- **Erfolgs-Aussicht**: **HOCH** (kombiniert mit M-1 + M-8 = staerkste Argumentation)
- **Anwendung**: bei jedem Daten-Vorfall; Memo enthaelt Post-Incident-Massnahmen-Liste

### M-15: Doppelbestrafungs-Verbot (ne bis in idem) / Zivilrechtliche Schadensersatz-Kumulation

- **Argument**: "Mandant ist bereits durch [paralleles Strafverfahren / Schadensersatz-Verfahren nach Art. 82] **finanziell sanktioniert**. Eine kumulative Bußgeld-Verhaengung verletzt Art. 50 GR-Charta und das **ne bis in idem**-Prinzip."
- **Anker**: Art. 50 GR-Charta + EuGH-Rspr. (z.B. C-117/20 bpost, C-489/10 Bonda) + Art. 82 DSGVO bei Schadensersatz-Kumulation
- **Pruefraster**: (1) parallele Verfahren auflisten; (2) idem-Pruefung (selber Sachverhalt?); (3) bis-Pruefung (selber Verstoss?); (4) GR-Charta Art. 50 Konkurrenzen
- **Erfolgs-Aussicht**: **NIEDRIG bis MITTEL** (EuGH ist eng mit ne bis in idem, aber DSGVO-Bußgeld + Art. 82-Schadensersatz sind nach EuGH **kumulierbar** — Argument greift v.a. bei DSGVO-Bußgeld + Strafverfahren parallel)
- **Anwendung**: Behoerden-Anhoerung-Statement; Eskalation in Berufungs-Stufe wenn Behoerde es ignoriert

---

## Section 3 — Aggravations-Argumente-Katalog (was die Behoerde dagegen haelt)

10 typische Behoerden-Argumente — Verteidiger MUSS sie kennen + jeweils Konter-Strategie haben.

### A-1: Wiederholungs-Verstoss

- **Behoerden-Argument**: "Mandant ist bereits in YYYY mit Bußgeld iHv Z Mio. EUR sanktioniert worden — gleiche Verstoss-Kategorie."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **e + i**
- **Konter (Verteidigung)**: (1) **Identitaet** der Verstoss-Kategorie pruefen — frueher Art. 6 vs jetzt Art. 32 = NICHT dieselbe Kategorie; (2) **Zeitliches Verhaeltnis** — wenn frueheres Verfahren > 5 Jahre zurueck, Argument abschwaechen; (3) **Compliance-Lessons-Learned** dokumentieren — Mandant hat aus altem Verstoss aktiv gelernt

### A-2: Vorsatz statt Fahrlaessigkeit

- **Behoerden-Argument**: "Mandant hat den Verstoss **wissentlich + willentlich** begangen — z.B. trotz interner Warnungen weiter ausgefuehrt."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **b**
- **Konter**: (1) Vorsatz-Beweise einzeln zerlegen — Mails, Protokolle; (2) **Eventualvorsatz** vs sicherer Vorsatz unterscheiden; (3) Alternativ-Erklaerungen anbieten (Missverstaendnis, fachliche Fehleinschaetzung)

### A-3: Sensitive Daten Art. 9

- **Behoerden-Argument**: "Verstoss betraf besondere Datenkategorien (Gesundheit, biometrische, etc.) — qualifizierter Schaden."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **g**
- **Konter**: (1) **Definitions-Streit** — nicht alles was als "Gesundheit" wirken kann ist Art. 9 (z.B. allgemeine Versicherungs-Daten); (2) **Anonymisierungs-Stand** der Daten zum Verstoss-Zeitpunkt; (3) **Pseudonymisierung** als Mitigation

### A-4: Anzahl Betroffener (Skaleneffekt)

- **Behoerden-Argument**: "**N > 1.000** Betroffene = signifikanter Verstoss; **N > 100.000** = schwerwiegend."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **a**
- **Konter**: (1) **N exakt ermitteln** — Behoerden ueberschaetzen oft; (2) **Davon** real betroffen vs nur potentiell zugaenglich; (3) **Pseudonymisierungs-Quote** der Daten (welcher Anteil war fuer Angreifer real auswertbar?)

### A-5: Fehlende DSFA bei Art. 35-Pflicht

- **Behoerden-Argument**: "Verarbeitung fiel unter Art. 35-DSFA-Pflicht (Liste der Aufsichtsbehoerde) — keine DSFA durchgefuehrt = strukturelle Sorglosigkeit."
- **DSGVO-Anker**: Art. 35 + Art. 83 Abs. 2 lit. **d**
- **Konter**: (1) **DSFA-Pflicht-Pruefung** — war Verarbeitung wirklich auf der Liste? (2) Alternative Risiko-Bewertungen (interne Risiko-Analyse, ISMS-Risiken) belegen; (3) DSFA waehrend des Verfahrens **nachholen** + vorlegen

### A-6: Schlechte Behoerden-Kooperation

- **Behoerden-Argument**: "Mandant hat Auskunfts-Fristen versaeumt; ausweichend geantwortet; falsche Auskuenfte erteilt."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **f**
- **Konter**: (1) **Korrespondenz-Chronologie** vollstaendig vorlegen; (2) **Anwalts-Mandat-Wechsel**-Effekte erklaeren (vorheriger Anwalt war saeumig); (3) **Vollstaendigkeits-Recht-Pruefung** — Mandant durfte Auskuenfte verweigern wenn Selbstbelastungs-Verbot greift

### A-7: Wirtschaftlicher Vorteil aus Verstoss

- **Behoerden-Argument**: "Mandant hat durch Verstoss **finanzielle Vorteile** erlangt (z.B. Marketing-Daten ohne Einwilligung verwertet; Kosten fuer DSB gespart) — Bußgeld muss diese Vorteile abschoepfen."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **k** (Vermoegensvorteile)
- **Konter**: (1) **Vorteils-Quantifizierung** anfechten — Behoerden-Schaetzung pruefen; (2) **Compliance-Investitionen** vorrechnen, die parallel getaetigt wurden; (3) **kausalen Zusammenhang** Verstoss-zu-Vorteil bestreiten

### A-8: Verletzung des Vertrauens (sektorspezifisch)

- **Behoerden-Argument**: "Mandant ist Bank/Versicherung/Gesundheits-Anbieter — besondere **Vertrauens-Stellung** erfordert verschärften Sorgfalts-Massstab."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **a + g** (Art der Verarbeitung) + lit. **k**
- **Konter**: (1) Vertrauens-Stellung **objektiv** anders konstruieren (Mandant ist Tech-Provider, nicht direkt-Kunden-naher Akteur); (2) Sektor-Compliance (BSI-Sicherheitskatalog, BAIT) als Mitigation

### A-9: Schaeden bei Betroffenen

- **Behoerden-Argument**: "Konkret nachgewiesene Schaeden — materiell (Identitaets-Diebstahl) + immateriell (Aengste, Reputations-Schaden)."
- **DSGVO-Anker**: Art. 83 Abs. 2 lit. **a** (Ausmass des Schadens) + Art. 82 DSGVO (Schadensersatz)
- **Konter**: (1) **Befuerchtungs-Schaeden** vs reale Schaeden trennen — EuGH C-687/21 (MediaMarktSaturn) verlangt **begruendete** Befuerchtung; (2) Schadens-Quantifizierung anfechten; (3) Identitaets-Schutz-Angebote des Mandanten als Schadensminderung

### A-10: KI-spezifisch — Annex-III-Hochrisiko ohne Compliance

- **Behoerden-Argument**: "KI-System des Mandanten faellt unter Annex III KI-VO (Hochrisiko: Hiring, Credit-Scoring, Mietfaehigkeit, Bildung, Migration) — fehlende Conformity-Assessment + KI-VO-Bußgeld parallel."
- **Anker**: KI-VO Art. 99 Abs. 3 (1 % Konzern-Umsatz) + DSGVO Art. 83
- **Konter**: (1) **Klassifikations-Streit** — ist System wirklich Annex III? (2) **DSGVO-vs-KI-VO-Konkurrenz** — kein doppeltes Bußgeld fuer denselben Sachverhalt; (3) **Conformity-Assessment** zwischenzeitlich durchgefuehrt vorlegen

> Hinweis: KI-VO Art. 99 Abs. 3 = **1 %** des weltweiten Konzern-Umsatzes oder 7,5 Mio. EUR (the higher) fuer "incorrect/incomplete/misleading information to authorities". Art. 99 Abs. 5 = 3 % oder 15 Mio. EUR fuer "non-compliance" mit GPAI-Pflichten + Hochrisiko-Pflichten ausser Verbots-Verstoss. Art. 99 Abs. 4 = 7 % oder 35 Mio. EUR fuer **verbotene** Praktiken Art. 5 (the highest tier).

---

## Section 4 — Top-50 EU-Bußgelder 2018-2025 strukturiert

> **Verifikations-Tags** (mirroring eu-eugh-dsgvo-schadensersatz.md):
> - `primary` = Aufsichtsbehoerden-Veroeffentlichung oder Urteils-Datenbank direkt
> - `cross-confirmed` = 2+ unabhaengige Sekundaerquellen + tracker
> - `secondary-only` = nur tracker oder einzelne Sekundaerquelle
>
> Quellen-Default fuer Top-50 ist [enforcementtracker.com](https://www.enforcementtracker.com/) (CMS-Hasche-Sigle gepflegte Datenbank). Tag `cross-confirmed` ist gesetzt wo Termly-Liste + tracker uebereinstimmen.

| # | Behoerde | Empfaenger | Datum | Hoehe (EUR) | Verstoss | Stufe | Sektor | Verifikation |
|---|----------|-----------|-------|-------------|----------|-------|--------|--------------|
| 1 | DPC Ireland | Meta Platforms Ireland (Facebook) | 12.05.2023 | 1.200.000.000 | Art. 46 DSGVO Schrems-II Drittland-Transfers | 2 | Social Media | cross-confirmed |
| 2 | CNPD Luxembourg | Amazon Europe Core | 16.07.2021 | 746.000.000 | Art. 6 DSGVO Werbe-Tracking ohne Einwilligung | 2 | E-Commerce | cross-confirmed |
| 3 | DPC Ireland | TikTok Technology Limited | 02.05.2025 | 530.000.000 | Drittland-Transfer EU-CN | 2 | Social Media | secondary-only |
| 4 | DPC Ireland | Meta (Instagram) | 02.09.2022 | 405.000.000 | Art. 5+6+8 Kinder-Daten + Default-Public-Profile | 2 | Social Media | cross-confirmed |
| 5 | DPC Ireland | Meta Platforms Ireland | 04.01.2023 | 390.000.000 | Art. 6 unklare Rechtsgrundlage Werbung | 2 | Social Media | cross-confirmed |
| 6 | DPC Ireland | TikTok Technology Limited | 15.09.2023 | 345.000.000 | Art. 5+8 Kinder-Daten | 2 | Social Media | cross-confirmed |
| 7 | CNIL France | Google LLC | 03.09.2025 | 325.000.000 | Cookie-Consent + Gmail Werbung | 2 | Tech | secondary-only |
| 8 | DPC Ireland | LinkedIn Ireland | 24.10.2024 | 310.000.000 | Werbung ohne valide Rechtsgrundlage | 2 | Tech/Recruiting | secondary-only |
| 9 | DPC Ireland | Meta Platforms Ireland | 17.12.2024 | 251.000.000 | Datenpannen 09/2018 (~29M Konten) Art. 25/33 GDPR | 2 | Social Media | cross-confirmed |
| 10 | DPC Ireland | Meta (Facebook) | 25.11.2022 | 265.000.000 | Art. 25 Privacy by Design (Datenpanne 533M) | 2 | Social Media | cross-confirmed |
| 11 | DPC Ireland | WhatsApp Ireland | 02.09.2021 | 225.000.000 | Art. 12-14 Transparenz-Defizit | 2 | Messaging | cross-confirmed |
| 12 | CNIL France | Google LLC | 31.12.2021 | 90.000.000 | Cookie-Refuse-Mechanismus erschwert | 2 | Tech | cross-confirmed |
| 13 | CNIL France | Google Ireland | 31.12.2021 | 60.000.000 | Cookie-Consent-Asymmetrie | 2 | Tech | cross-confirmed |
| 14 | CNIL France | Facebook Ireland | 31.12.2021 | 60.000.000 | Cookie-Consent-Asymmetrie | 2 | Social Media | cross-confirmed |
| 15 | CNIL France | Google Ireland | 21.01.2019 | 50.000.000 | Art. 4-7 unklare Einwilligungs-Information | 2 | Tech | cross-confirmed |
| 16 | LfDI Niedersachsen | H&M Hennes & Mauritz | 01.10.2020 | 35.300.000 | exzessive Mitarbeiter-Datenspeicherung | 1 | Retail | cross-confirmed |
| 17 | Garante Italy | TIM (Telecom Italia) | 15.01.2020 | 27.800.000 | Telemarketing ohne Einwilligung | 2 | Telekom | cross-confirmed |
| 18 | Garante Italy | Enel Energia | 13.06.2022 | 26.500.000 | unzulaessiges Telemarketing + AVV-Defizit | 2 | Energie | cross-confirmed |
| 19 | Garante Italy | Clearview AI | 09.03.2022 | 20.000.000 | biometrische Datenverarbeitung ohne Rechtsgrundlage | 2 | Facial Recognition | cross-confirmed |
| 20 | CNIL France | Clearview AI | 17.10.2022 | 20.000.000 | Verbleibendes Non-Compliance trotz Anordnung | 2 | Facial Recognition | cross-confirmed |
| 21 | HDPA Greece | Clearview AI | 13.07.2022 | 20.000.000 | Transparenz + illegale Erhebung | 2 | Facial Recognition | cross-confirmed |
| 22 | ICO UK | British Airways | 16.10.2020 | 22.046.000 (£20M) | Datenpanne 400k Kunden — TOMs-Defizit | 1 | Aviation | cross-confirmed |
| 23 | ICO UK | Marriott International | 30.10.2020 | 20.450.000 (£18.4M) | Datenpanne lange Exposition | 1 | Hospitality | cross-confirmed |
| 24 | DPC Ireland | Meta Platforms Ireland | 15.03.2022 | 17.000.000 | Datenpannen-Aufzeichnungs-Defizit | 1 | Social Media | secondary-only |
| 25 | Garante Italy | Wind Tre | 09.07.2020 | 16.700.000 | Telemarketing + opt-out-Defizit | 2 | Telekom | cross-confirmed |
| 26 | Garante Italy | Vodafone Italia | 12.11.2020 | 12.250.000 | Telemarketing ohne Einwilligung | 2 | Telekom | cross-confirmed |
| 27 | LfDI Niedersachsen | Notebookbilliger.de | 03.02.2021 | 10.400.000 | unverhaeltnismaessige Mitarbeiter-Videoueberwachung | 1 | Retail | cross-confirmed |
| 28 | AEPD Spain | Google LLC | 19.05.2022 | 10.000.000 | Recht auf Vergessen + Datenexport-Defizit | 2 | Tech | cross-confirmed |
| 29 | BfDI Germany | 1&1 Telecom GmbH | 09.12.2019 → LG Bonn 11.11.2020 | 9.550.000 → 900.000 | Art. 32 unzureichende Authentifizierung | 1 | Telekom | primary (LG Bonn 29 OWi 1/20) |
| 30 | DSB Austria | Oesterreichische Post | 23.10.2019 → 09.06.2021 | 9.500.000 | Art. 12-15 verweigerte Auskunft | 2 | Postal | cross-confirmed |
| 31 | ICO UK | Clearview AI | 18.05.2022 | 9.760.000 (£8.75M) | Art. 6 Rechtsgrundlage + Art. 14 Information | 2 | Facial Recognition | cross-confirmed |
| 32 | DSB Austria | REWE International | 23.12.2022 | 8.000.000 | Loyalty-Programm Einwilligungs-Maengel | 2 | Retail | cross-confirmed |
| 33 | AEPD Spain | Vodafone España | 06.05.2021 | 8.150.000 | Telemarketing-Verstoesse | 2 | Telekom | cross-confirmed |
| 34 | AEPD Spain | CaixaBank | 13.01.2021 | 6.000.000 | Einwilligung + Drittland-Transfers | 2 | Banking | cross-confirmed |
| 35 | HDPA Greece | Cosmote Mobile | 30.06.2022 | 6.000.000 | Datenpanne TOMs-Defizit | 1 | Telekom | cross-confirmed |
| 36 | DPA Norway | Grindr LLC | 14.12.2021 | 6.300.000 (NOK 65M) | Sharing sensitive Daten an Werbe-Partner | 2 | Dating App | cross-confirmed |
| 37 | DPC Ireland | WhatsApp Ireland | 19.01.2023 | 5.500.000 | Art. 6 Rechtsgrundlage Service-Improvements | 2 | Messaging | cross-confirmed |
| 38 | AZOP Croatia | EOS Matrix d.o.o. | 23.10.2023 | 5.470.000 | Art. 32 + AVV-Defizit | 1 | Debt Collection | cross-confirmed |
| 39 | CNIL France | Clearview AI | 10.05.2023 | 5.200.000 | non-compliance mit CNIL-Anordnung 2022 | 2 | Facial Recognition | cross-confirmed |
| 40 | ICO UK | Interserve Group | 24.10.2022 | 5.580.000 (£4.4M) | Cyberangriff + TOMs-Defizit | 1 | Construction | cross-confirmed |
| 41 | Garante Italy | Fastweb | 02.04.2021 | 4.500.000 | Telemarketing | 2 | ISP | cross-confirmed |
| 42 | Garante Italy | Uber B.V. + Uber Technologies | 28.07.2022 | 4.240.000 | Datenpanne + Privacy-Policy-Defizit | 1 | Transport | cross-confirmed |
| 43 | AEPD Spain | Vodafone España | 20.05.2022 | 3.940.000 | SIM-Duplizierung TOMs-Defizit | 1 | Telekom | cross-confirmed |
| 44 | AP Netherlands | Belastingdienst (Steueramt) | 12.04.2022 | 3.700.000 | illegale Schwarzlist + Diskriminierung | 2 | Government | cross-confirmed |
| 45 | HDPA Greece | OTE Group | 30.06.2022 | 3.250.000 | Datenpannen-Verantwortlichkeit | 1 | Telekom | cross-confirmed |
| 46 | Garante Italy | Sky Italia | 15.04.2021 | 3.300.000 | Telemarketing + opt-out-Defizit | 2 | Media/Telekom | cross-confirmed |
| 47 | AEPD Spain | CaixaBank Payments | 11.11.2021 | 3.000.000 | Marketing ohne Einwilligung | 2 | Banking | cross-confirmed |
| 48 | CNIL France | Carrefour Group | 26.11.2020 | 3.050.000 | Erasure-Requests + Marketing-Verstoesse | 2 | Retail | cross-confirmed |
| 49 | Garante Italy | Iren Mercato | 13.05.2021 | 2.900.000 | Telemarketing + unautorisierte Quellen | 2 | Energie | cross-confirmed |
| 50 | Garante Italy | Foodinho s.r.l. | 05.07.2021 | 2.600.000 | algorithmische Diskriminierung Gig-Worker | 1 | Food Delivery | cross-confirmed |

> **Sektor-Aggregat**: dominant sind **Social Media + Werbung + Telekom**. Faelle in **Banking + Energie + Retail** sind seltener, aber regulatorisch hochwertig fuer Vergleichs-Argumente.
>
> **Stufe-Verteilung**: ca. 75 % der Top-50 sind **Stufe 2** (Art. 5/6/9 Verstoesse). Stufe-1 dominiert bei TOMs-Defiziten (Art. 32) und Datenpannen.

> **Wichtige Anwendungs-Pattern fuer Verteidiger**:
> - Bei TOMs-Verstoss (Art. 32) zitiere immer **#29 1&1 (LG Bonn-Reduktion)** als Verhaeltnismaessigkeits-Anker
> - Bei Cookie-Consent zitiere **#12 + #13 + #14 (CNIL 2021 Asymmetrie-Linie)**
> - Bei Drittland-Transfers zitiere **#1 Meta 1.2 Mrd.** als Maximum-Skala
> - Bei Mitarbeiter-Datenverarbeitung zitiere **#16 H&M (35.3 Mio.)**

---

## Section 5 — Verteidigungs-Strategien

### 5.1 Konzern-Umsatz-Anfechtung post EuGH C-807/21 — Plan B

**Problem**: EuGH hat in C-807/21 ausdruecklich festgestellt, dass das **Maximum** auf den weltweiten Konzern-Umsatz zu beziehen ist, sobald der Empfaenger zu einem **Unternehmen i.S.v. Art. 101, 102 AEUV** gehoert. Die direkte Anfechtung dieser Linie hat in 2024+ keine Aussicht.

**Plan B — Gestaltungs-Argumente innerhalb des Maximums**:

1. **Bemessung-statt-Maximum-Argument**: Maximum (4 % Konzern-Umsatz) ≠ Bemessungs-Hoehe. Die Behoerde muss innerhalb des Maximums **Verhaeltnismaessigkeit** wahren (Art. 83 Abs. 1) → LG Bonn 1&1 ist Beleg-Pattern
2. **Konzern-Definition-Streit**: ist das verbundene Unternehmen wirklich ein **Wirtschafts-Unternehmen i.S.v. Art. 101 AEUV**? (Holdings, Stiftungen, Vereine, oeffentliche Stellen sind ggf. herausnehmbar)
3. **Konzern-Strukturierungs-Trennung**: bei dezentraler Konzern-Struktur (z.B. eigenstaendige Tochter mit eigenem Management) Argumentation, dass Verstoss auf Tochter-Ebene begrenzt ist; Mutter-Konzern-Umsatz ist Maximum, aber **nicht** Bemessungs-Massstab → Section 5 EDPB-Schritt 5 (Verhaeltnismaessigkeit)
4. **Frueheres operatives Jahr**: Umsatz des **vorherigen** Geschaeftsjahres ist Massstab — wenn Mandant in 2023 schwaches Jahr hatte, das ist die Basis (nicht Rekord-Jahr 2022)

### 5.2 Bußgeld-Bescheid-Anfechtung — formelle Wege

| Stufe | Mittel | Frist | Gericht |
|-------|--------|-------|---------|
| **Vor-Verfahren** | Anhoerung nach § 28 OWiG / § 28 BDSG | im Rahmen Anhoerungs-Brief | Aufsichtsbehoerde selbst |
| **Einspruch** | Einspruch nach § 67 OWiG / § 41 BDSG | **2 Wochen** ab Zustellung | Aufsichtsbehoerde / weiterleitend an Staatsanwaltschaft |
| **Hauptverfahren** | Bußgeldverfahren vor AG/LG | nach Anklage | AG (Einzelrichter) bei Bußgeld bis **100.000 EUR**; LG (Wirtschaftsstrafkammer nach § 74c GVG) bei höheren Beträgen — § 41 Abs. 1 S. 2 BDSG modifiziert § 68 OWiG fuer DSGVO-Bußgeld |
| **Rechtsmittel** | Rechtsbeschwerde nach § 79 OWiG | **1 Woche** ab Urteils-Verkuendung | OLG (Senat) |
| **EU-Vorlage** | Art. 267 AEUV-Vorlage | Verfahrens-Stop | EuGH |
| **Beschwerde EuGH** | Art. 78 Abs. 2 DSGVO + Art. 47 GR-Charta (Rechtsschutz) | nach nationaler Letzt-Instanz | EuGH (mittelbar via Vorlage) |

**Strategie-Weiche**: Einspruch nach § 67 OWiG **immer** einlegen — Frist ist nur 2 Wochen, Verlust ist final. Zwischen Einspruch und Hauptverfahren kann die Behoerde den Bescheid noch anpassen / vergleichen (siehe 5.3).

### 5.3 Vergleichs-Verhandlungen mit Aufsichtsbehoerden

DSGVO kennt **kein** formelles Vergleichs-Verfahren wie das US-DOJ-Settlement. Aber: Aufsichtsbehoerden zeigen sich **vergleichs-bereit** in folgenden Konstellationen:

1. **Vor formaler Anhoerung** — wenn Behoerde ermittelt, aber noch keinen Bescheid erlassen hat, kann **Schaden-Reparatur + Compliance-Verbesserungs-Plan** zu einer Verfahrens-Einstellung fuehren (siehe DSK-Sachverhalt-Statistiken: ca. 60 % der Verfahren werden ohne Bußgeld eingestellt)
2. **Nach Anhoerung, vor Bescheid** — Behoerde signalisiert Bußgeld-Hoehe X, Mandant bietet **rasche Akzeptanz + Verfahrens-Abkuerzung** gegen Reduktion auf 0.7-0.8 X (typischer Discount)
3. **Bei Ueberraschungs-Befunden** — Aufsichtsbehoerde haette Beweisfuehrung schwer; Mandant gibt zu im Tausch fuer milderes Bußgeld

**Praxis-Beispiele**:
- ICO UK British Airways: 183 Mio. £ urspruenglich → **22 Mio. £** final (90 % Reduktion durch Vergleichs-Verhandlung + COVID-19)
- ICO UK Marriott: 99 Mio. £ urspruenglich → **18.4 Mio. £** final (80 % Reduktion)

Verteidiger sollten **immer** vor Bescheid-Erlass eine Vergleichs-Prufung vornehmen.

### 5.4 Pfaendungsschutz / wirtschaftliche Existenz-Argument

**Bei KMU** mit Bußgeld nahe Existenz-Vernichtung greifen folgende Werkzeuge:

1. **Stundung nach § 18 OWiG** — Behoerde kann Bußgeld in Raten zulassen
2. **Erlass aus Billigkeitsgruenden** § 19 OWiG — bei wirtschaftlicher Notlage
3. **Insolvenz-Vermeidungs-Argument** — wenn Bußgeld Eroeffnung Insolvenzverfahren ausloesen wuerde, ist das Verhaeltnismaessigkeits-Anker (Art. 83 Abs. 1 + GR-Charta Art. 49 Abs. 3)
4. **Insolvenz selbst** — als ultima ratio entlaesst die InsO den Schuldner aus Forderung (gem. § 39 InsO ist Bußgeld nachrangige Forderung)

**Pflicht-Anlagen**: Steuerberater-Bilanz; Liquiditaets-Analyse; Insolvenz-Gutachten falls geboten.

---

## Section 6 — Skill-Output-Pattern (Anwendung im brutaler-anwalt-Skill)

Wenn ein Audit-Befund einen Bußgeld-Hinweis triggert, soll der Skill-Output **diese 6-Block-Struktur** haben:

```
=== Buβgeld-Risiko-Memo: [Verstoss-Bezeichnung] ===

1. VERSTOSS-KLASSIFIKATION
   - Stufe: [1 = Art. 83 Abs. 4 / 2 = Art. 83 Abs. 5+6]
   - Anker-Norm: [konkrete Art./Abs.]
   - Schwere-Klasse (EDPB v2.1): [Low/Medium/High]
   - Schwere-Faktor (DSK): [leicht/mittel/schwer/sehr schwer]

2. BERECHNUNGS-BASIS
   - Konzern-Umsatz vs Einzeleinheit: [aus C-807/21 Konzern-Umsatz Maximum]
   - Statisches Maximum: [10 / 20 Mio. EUR]
   - Dynamisches Maximum: [2 / 4 % Konzern-Umsatz]
   - "the higher of the two": [konkrete EUR-Zahl]

3. MITIGATIONS-ARGUMENTE (vom Mandanten verfuegbar)
   - M-X: [Argument-Bezeichnung] — [Erfolgs-Aussicht] — [Beleg-Pflicht]
   - [3-5 anwendbare Mitigations aus Section 2]

4. AGGRAVATIONS-ARGUMENTE (Behoerde haelt entgegen)
   - A-X: [Argument-Bezeichnung] — [Konter-Strategie]
   - [2-4 anwendbare Aggravations aus Section 3]

5. VERGLEICHS-BUSSGELDER (aus Section 4)
   - [2-3 strukturierte Vergleichs-Faelle, identische Stufe + Sektor]
   - Spannweite ca. [Min-Max EUR]

6. BANDBREITE + EMPFEHLUNG
   - Best Case: [niedrigster Wert mit allen Mitigations greifend] — Strategie: [...]
   - Worst Case: [hoechster Wert mit allen Aggravations greifend] — Strategie: [...]
   - Wahrscheinlich: [Erwartungswert] — Strategie: Einspruch/Vergleich/Akzeptanz
```

> **Tone-Direktive**: Memo-Tone ist **sachlich-dezisiv**, nicht "could be / might". Mandant zahlt fuer klare Bandbreiten + klare Empfehlung. Gestuetzt auf konkrete Vergleichs-Faelle aus Section 4.

---

## Section 7 — Quellen + Verweise

### 7.1 Primaerquellen

- **EDPB Guidelines 04/2022 v2.1** (24.05.2023): [edpb.europa.eu PDF](https://www.edpb.europa.eu/system/files/2023-06/edpb_guidelines_042022_calculationofadministrativefines_en.pdf) · [EDPB Adoption-Mitteilung](https://www.edpb.europa.eu/news/news/2023/edpb-adopts-final-version-guidelines-calculation-administrative-fines-following_en)
- **DSK Bußgeldkonzept** (14.10.2019): [datenschutzkonferenz-online.de PDF](https://www.datenschutzkonferenz-online.de/media/ah/20191016_bu%C3%9Fgeldkonzept.pdf)
- **EuGH C-807/21 Deutsche Wohnen** (05.12.2023): [EUR-Lex 62021CJ0807](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62021CJ0807) · [curia C-807/21 (Liste)](https://curia.europa.eu/juris/liste.jsf?language=de&num=C-807/21)
- **LG Bonn 11.11.2020 Az. 29 OWi 1/20** (1&1): [dejure.org-Vernetzung](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=LG+Bonn&Datum=11.11.2020&Aktenzeichen=29+OWi+1%2F20)
- **DSGVO** (Verordnung (EU) 2016/679): [EUR-Lex 32016R0679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- **OWiG**: [gesetze-im-internet.de OWiG](https://www.gesetze-im-internet.de/owig_1968/)
- **KI-VO** (Verordnung (EU) 2024/1689) Art. 99: [EUR-Lex 32024R1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)

### 7.2 Sekundaerquellen + Tracker

- **enforcementtracker.com** (CMS-Hasche-Sigle): [GDPR Enforcement Tracker](https://www.enforcementtracker.com/) — primaere Sammlung Top-EU-Bußgelder
- **CMS GDPR Enforcement Tracker Report** 2024/2025: [cms.law Numbers and Figures](https://cms.law/en/int/publication/gdpr-enforcement-tracker-report/numbers-and-figures)
- **DLA Piper GDPR Fines Survey** (2025): [dlapiper.com Survey 2025](https://www.dlapiper.com/en/insights/publications/2025/01/dla-piper-gdpr-fines-and-data-breach-survey-january-2025)
- **Termly Top-61 GDPR Fines** (2026 Update): [termly.io biggest-gdpr-fines](https://termly.io/resources/articles/biggest-gdpr-fines/)
- **CNIL Sanktions-Datenbank**: [cnil.fr/fr/sanctions-prononcees-par-la-cnil](https://www.cnil.fr/fr/sanctions-prononcees-par-la-cnil)
- **BfDI Taetigkeitsberichte**: [bfdi.bund.de Taetigkeitsberichte](https://www.bfdi.bund.de/DE/Service/Taetigkeitsberichte/taetigkeitsberichte_node.html)

### 7.3 Anwalts-Analyse-Quellen (zur Methodik)

- **Taylor Wessing — EuGH zu Deutsche Wohnen**: [taylorwessing.com](https://www.taylorwessing.com/de/insights-and-events/insights/2023/12/eugh-zu-deutsche-wohnen)
- **GDD — EuGH zur Bußgeldhaftung**: [gdd.de europa-meldungen](https://www.gdd.de/europa-meldungen/eugh-zur-bussgeldhaftung-deutsche-wohnen/)
- **Clyde & Co — ECJ direct sanctions**: [clydeco.com](https://www.clydeco.com/en/insights/2023/12/gdpr-fines-ecj-allows-direct-sanctions-against-leg)
- **Latham Germany — DSK-Bußgeldmodell Q&A**: [lathamgermany.de](https://www.lathamgermany.de/2019/10/qa-liste-zum-neuen-dsgvo-busgeldmodell-der-datenschutzkonferenz-dsk/)
- **Pinsent Masons — DSK-Konzept Bußgeldzumessung**: [pinsentmasons.com](https://www.pinsentmasons.com/de-de/out-law/analyse/dsk-konzept-zur-bussgeldzumessung-nach-art-83-ds-gvo)
- **Forum Verlag — DSGVO-Bußgeld Umsatz**: [forum-verlag.com](https://www.forum-verlag.com/fachwissen/datenschutz-und-it-sicherheit/dsgvo-bussgeld-dsk/)
- **CR-online — LG Bonn kippt umsatzbezogenes Bußgeld**: [cr-online.de Blog 11.11.2020](https://www.cr-online.de/blog/2020/11/11/lg-bonn-kippt-umsatzbezogenes-datenschutzbussgeld/)
- **LTO — LG Bonn 1&1 reduziert**: [lto.de](https://www.lto.de/recht/nachrichten/n/lg-bonn-29owi120lg-bussgeld-1und1-datenschutzverstoss-dsgvo-millionen-herabgesetzt)
- **Dr. Bahr — LG Bonn Urteilsgruende**: [dr-bahr.com](https://www.dr-bahr.com/news/urteilsgruende-zu-dsgvo-bussgeld-ihv-900000-eur-gegen-11-liegen-vor.html)
- **White & Case — EDPB Guidelines on GDPR fines**: [whitecase.com](https://www.whitecase.com/insight-alert/edpb-issues-guidelines-gdpr-fines)
- **Hunton — EDPB Guidelines Calculation Fines**: [hunton.com](https://www.hunton.com/privacy-and-information-security-law/edpb-publishes-guidelines-on-the-calculation-of-administrative-fines)

### 7.4 Cross-References (innerhalb dieses Skills)

- **eu-eugh-dsgvo-schadensersatz.md** — EuGH Art. 82-Schadensersatz-Linie (kumulierbar mit Art. 83-Bußgeld)
- **de-statute-tier1/TDDDG.md** — Telemedien-/Telekommunikations-Daten-Zugang (Sektor-spezifischer Anker bei Tracking + Cookies)
- **de-statute-tier1/DDG.md** — Digitale-Dienste-Gesetz (DSA-Umsetzung; bei VLOP-Bußgelder relevant)
- **de-statute-tier1/AGG.md / ArbZG.md** — fuer Mitarbeiter-Daten-Faelle (Sektor-spezifische Anker)
- § 41 BDSG (extern) — Anwendung OWiG-Vorschriften auf DSGVO-Bußgeldverfahren + AG/LG-Schwelle 100.000 EUR

---

## Versionierung + Aenderungshistorie

| Version | Datum | Aenderung |
|---------|-------|-----------|
| 1.0 | 2026-05-05 | Erstausgabe — EDPB v2.1 + DSK 2019 + EuGH C-807/21 + LG Bonn 1&1 + Top-50 EU-Bußgelder |

---

## NOT_VERIFIED Anhang (Eintraege ohne ausreichende Verifikation)

(leer — alle Section-1-Az. sind verifiziert; Section-4-Eintraege sind mit `secondary-only` gekennzeichnet wo nur tracker-Quelle ohne Cross-Confirmation vorhanden)
