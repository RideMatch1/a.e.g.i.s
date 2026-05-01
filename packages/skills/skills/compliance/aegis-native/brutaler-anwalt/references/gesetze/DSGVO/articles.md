---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679
last-checked: 2026-05-01
purpose: Audit-relevante DSGVO-Artikel mit Tenor-Kurzfassung + Audit-Mapping
---

# DSGVO (VO 2016/679) — Audit-relevante Artikel

> Strukturierter Auszug. Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679

## Kapitel I — Allgemeine Bestimmungen

### Art. 4 — Begriffsbestimmungen
Definiert: personenbezogene Daten (Nr. 1), Verarbeitung (Nr. 2), Verantwortlicher (Nr. 7), Auftragsverarbeiter (Nr. 8), Empfänger (Nr. 9), Dritter (Nr. 10), Einwilligung (Nr. 11), Aufsichtsbehörde (Nr. 21).
**Audit-Relevanz:** jede DSE-Aussage muss konsistent zu Art. 4 sein. „Wir geben Daten weiter an Dienstleister X" → Auftragsverarbeiter (AVV nach Art. 28 nötig) oder Dritter (eigene Rechtsgrundlage nötig)?

## Kapitel II — Grundsätze (Art. 5–11)

### Art. 5 — Grundsätze für die Verarbeitung
- Abs. 1 lit. a: Rechtmäßigkeit, Verarbeitung nach Treu und Glauben, Transparenz
- Abs. 1 lit. b: Zweckbindung
- Abs. 1 lit. c: Datenminimierung
- Abs. 1 lit. d: Richtigkeit
- Abs. 1 lit. e: Speicherbegrenzung
- Abs. 1 lit. f: Integrität und Vertraulichkeit (TOMs)
- **Abs. 2: Rechenschaftspflicht** — Verantwortlicher muss Compliance NACHWEISEN können
**Audit-Relevanz:** lit. e triggert Lösch-Cron-Audit (Phase 5i Skill). Abs. 2 triggert VVT-/DSFA-/Audit-Trail-Doku-Pflicht.

### Art. 6 — Rechtmäßigkeit der Verarbeitung
- Abs. 1 lit. a: Einwilligung
- Abs. 1 lit. b: Vertragserfüllung
- Abs. 1 lit. c: rechtliche Verpflichtung
- Abs. 1 lit. d: lebenswichtige Interessen
- Abs. 1 lit. e: öffentliche Aufgabe
- **Abs. 1 lit. f: berechtigtes Interesse** — Drei-Stufen-Test (Interesse + Erforderlichkeit + Abwägung)
**Audit-Relevanz:** Pflicht-Angabe in DSE Art. 13 lit. c. Bei lit. f: Interessenabwägung dokumentiert? EuGH C-252/21 Meta: Werbung ≠ berechtigtes Interesse.

### Art. 7 — Bedingungen für die Einwilligung
- Abs. 1: Nachweispflicht der Einwilligung
- Abs. 2: hervorgehoben + verständlich + von anderen Punkten getrennt
- Abs. 3: jederzeit widerrufbar (so einfach wie Erteilung)
- Abs. 4: Kopplungsverbot
**Audit-Relevanz:** Cookie-Banner-Pflicht (Akzeptieren + Ablehnen gleichwertig). Newsletter-Anmeldung darf nicht an AGB-Akzeptanz gekoppelt sein (Az. BGH I ZR 218/19).

### Art. 8 — Kinder
Einwilligung Kinder ≥ 16 Jahre wirksam (DE: § 21 BDSG bestätigt). Bei < 16 Jahren: Eltern-Zustimmung nötig.
**Audit-Relevanz:** EdTech / Social-Plattform / Gaming → Altersgate? Verifikation?

### Art. 9 — Besondere Kategorien (Sondersensible Daten)
Verbot mit Erlaubnisvorbehalt. Zulässig nur wenn: ausdrückliche Einwilligung (Abs. 2 lit. a), Beschäftigungsrecht (lit. b), öffentliches Interesse (lit. g), Gesundheitsschutz (lit. h), Forschung (lit. j) etc.
**Audit-Relevanz:** Heilberuf / Telemedizin / Dating-Apps / Pet-Care mit Krankheits-Daten. Trigger DSFA Art. 35.

## Kapitel III — Rechte der betroffenen Person (Art. 12–23)

### Art. 12 — Modalitäten
- Abs. 1: präzise + transparent + verständlich
- Abs. 3: 1 Monat Frist (verlängerbar 2 Monate)
- Abs. 5: i.d.R. unentgeltlich

### Art. 13 — Informationspflicht bei Erhebung
Pflicht-Inhalte für DSE: Identität Verantwortlicher (lit. a), Kontakt DSB (lit. b), Zwecke + Rechtsgrundlage (lit. c), berechtigte Interessen (lit. d), Empfänger (lit. e), Drittlandtransfer + Schutzgarantien (lit. f), Speicherdauer (Abs. 2 lit. a), Rechte (Abs. 2 lit. b), Widerruf (Abs. 2 lit. c), Beschwerderecht (Abs. 2 lit. d).
**Audit-Relevanz:** das ist die DSE-Pflicht-Liste — jede DSE muss alle 11 Punkte enthalten.

### Art. 15 — Auskunftsrecht
Vollständige Kopie aller Daten + Empfänger + Zwecke + Speicherdauer + Rechte (EuGH C-487/21).
**Audit-Relevanz:** Endpoint `/api/user/access` oder Email-basiertes Verfahren? 1-Monat-Frist.

### Art. 16 — Berichtigung
**Audit-Relevanz:** UI-Pfad zur Profil-Bearbeitung dokumentiert?

### Art. 17 — Löschung („Recht auf Vergessenwerden")
- Abs. 1: Lösch-Anspruch wenn Zweck weggefallen, Widerruf, unrechtmäßig, Compliance-Pflicht
- **Abs. 2: Informations-Pflicht an Empfänger** (Suchmaschinen + AVV) — Az. EuGH C-131/12 Google Spain
**Audit-Relevanz:** Account-Delete-Endpoint (`/api/user/delete`)? UGC-Plattformen: X-Robots-Tag noindex auf User-PII (siehe Phase 5c skill).

### Art. 18 — Einschränkung
**Audit-Relevanz:** Endpoint vorhanden? Selten implementiert.

### Art. 19 — Mitteilung an Empfänger
Bei Berichtigung/Löschung/Einschränkung: alle Empfänger informieren.

### Art. 20 — Datenübertragbarkeit
Strukturiertes, gängiges, maschinenlesbares Format (JSON/CSV).
**Audit-Relevanz:** Endpoint `/api/user/export`?

### Art. 21 — Widerspruchsrecht
- Abs. 1: bei berechtigtem Interesse
- **Abs. 2: bei Direktwerbung jederzeit + uneingeschränkt** — Pflicht-Hinweis in DSE
- Abs. 3: nach Widerspruch Direktwerbung darf nicht mehr verarbeitet werden

### Art. 22 — Automatisierte Einzelentscheidung
Verbot mit Erlaubnisvorbehalt (Abs. 2). Bei Erlaubnis: Recht auf menschliches Eingreifen (Abs. 3).
**Audit-Relevanz:** AI-Scoring / KI-Empfehlung mit rechtlicher Wirkung → DSFA + Art. 22-Absicherung. Trigger AI-Act Art. 6+50.

## Kapitel IV — Verantwortlicher + Auftragsverarbeiter (Art. 24–43)

### Art. 25 — Privacy by Design + by Default
**Audit-Relevanz:** Default-Settings analysieren (Newsletter-Opt-In, Profil-Sichtbarkeit, Tracker-Opt-In).

### Art. 28 — Auftragsverarbeiter
- Abs. 3: AVV-Pflichtinhalt (Gegenstand, Dauer, Art, Zweck, Datenkategorien, Personenkreis, Sub-AVV-Klausel, Weisungsbindung, Vertraulichkeit, TOMs, Mit-Unterstützungspflichten, Lösch-/Rückgabe-Klausel)
**Audit-Relevanz:** AVV-Liste in DSE muss matchen mit aktiven Diensten (Drift-Style 1).

### Art. 30 — Verzeichnis von Verarbeitungstätigkeiten (VVT)
Pflicht ≥ 250 MA ODER regelmäßige sensible Verarbeitung. KMU-Privileg Abs. 5.
**Audit-Relevanz:** Vorlage `references/templates/VVT-template.md`.

### Art. 32 — Sicherheit der Verarbeitung (TOMs)
Pseudonymisierung, Verschlüsselung, Verfügbarkeit, Wiederherstellung, regelmäßige Tests.
**Audit-Relevanz:** Pflicht-Inhalt in AVV. Verlinkung mit IT-Sec / NIS2.

### Art. 33 — Datenpannenmeldung an Aufsichtsbehörde
**72 Stunden ab Kenntnis** (Werktage zählen nicht — kontinuierlich).
**Audit-Relevanz:** Incident-Response-Plan dokumentiert? Eskalations-Kontakt zu DSB.

### Art. 34 — Benachrichtigung Betroffene
Bei „hohem Risiko" — unverzüglich (kein 72h-Anker).

### Art. 35 — Datenschutz-Folgenabschätzung (DSFA)
- Abs. 3: Pflicht-Trigger (Profiling Abs. 3 lit. a, sensible Daten Abs. 3 lit. b umfangreich, öffentliche Räume systematisch lit. c)
- DSK-Whitelist 2018 + BayLDA-Hinweise
**Audit-Relevanz:** Vorlage `references/templates/DSFA-template.md`. KMU sind NICHT befreit.

### Art. 37 — Benennung DSB
Pflicht bei: Behörde, Kerntätigkeit umfangreiche systematische Überwachung, Kerntätigkeit besondere Kategorien Art. 9. Deutsches Recht erweitert (§ 38 BDSG).

## Kapitel V — Drittland (Art. 44–50)

### Art. 44 — Allgemeiner Grundsatz
Drittlandtransfer nur mit Garantien Art. 45–47.

### Art. 45 — Adequacy-Beschluss
Liste: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
Stand 2026: UK, Schweiz, Israel, Argentinien, Kanada, Andorra, Färöer, Guernsey, Isle of Man, Jersey, Neuseeland, Uruguay, Japan, Südkorea, EU-US DPF (seit 10.07.2023, noyb-Klage anhängig).

### Art. 46 — Standardvertragsklauseln (SCC)
Module 1–4 (Controller-Controller, Controller-Processor, Processor-Processor, Processor-Controller). Aktuelle SCC: VO 2021/914 (seit 27.06.2021).

### Art. 47 — Binding Corporate Rules (BCR)
Konzern-interne Regeln, von Aufsichtsbehörde genehmigt.

### Art. 49 — Ausnahmen
Nur restriktiv (EDPB Guidelines 2/2018). Einwilligung mit Risiko-Hinweis (Abs. 1 lit. a) — nicht für regelmäßige Transfers.

## Kapitel VIII — Rechtsbehelfe + Sanktionen (Art. 77–84)

### Art. 77 — Beschwerderecht bei Aufsichtsbehörde
**Audit-Relevanz:** Pflicht-Hinweis in DSE.

### Art. 79 — Klage gegen Verantwortlichen
**Audit-Relevanz:** Gerichtsstandsklausel bei B2C in AGB beachten (Verbraucher-AGB-Recht § 38 ZPO).

### Art. 82 — Schadensersatz
- Abs. 1: materieller + immaterieller Schaden
- Abs. 3: Beweislast Verantwortlicher (Beweislastumkehr für TOMs)
**Az.-Anker:** EuGH C-300/21 (keine Erheblichkeitsschwelle), C-340/21 (Befürchtung Missbrauch reicht), BGH VI ZR 1370/20 (Kontrollverlust).

### Art. 83 — Geldbußen
- Stufe 1 (bis 10 Mio. €  oder 2% Umsatz): Art. 8, 11, 25–39, 42, 43
- **Stufe 2 (bis 20 Mio. €  oder 4% Umsatz)**: Art. 5, 6, 7, 9, 12–22, 44–49, 58
**Audit-Relevanz:** für €-Range im Skill-Output.

---

## Audit-Mapping-Index (für Skill-Auto-Loading)

| Audit-Surface | Pflicht-Artikel |
|---------------|-----------------|
| DSE-Inhalte | 13, 14, 12 (Modalität) |
| Cookie-Banner | 6 lit. a, 7 |
| Auskunftsanfrage | 15, 12 (1 Monat) |
| Account-Delete-Endpoint | 17 |
| Datenexport-Endpoint | 20 |
| Newsletter-Anmeldung | 6 lit. a, 7, 21 Abs. 2, 13 |
| AVV-Listung | 28 (Abs. 3 Pflichtinhalt) |
| Drittland-Hinweis | 44, 45, 46, 49, 13 lit. f |
| Datenpanne | 33 (72h), 34 |
| KI-Component | 22, 35 |
| TOMs-Doku | 32, 5 Abs. 1 lit. f |
| Sondersensible Daten | 9, 35 |
| VVT | 30 (KMU-Privileg Abs. 5) |
