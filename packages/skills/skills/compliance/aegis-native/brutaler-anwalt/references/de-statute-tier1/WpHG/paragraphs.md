---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/wphg/
last-checked: 2026-05-05
purpose: WpHG (Wertpapierhandelsgesetz) — MiFID-II + MAR-Umsetzung; Wohlverhaltensregeln, Insider-Verbot, Marktmanipulation.
---

# WpHG — Kern-Paragraphen

> Wertpapierhandelsgesetz (WpHG).
> Volltext: https://www.gesetze-im-internet.de/wphg/

## § 2 — Begriffsbestimmungen

**Wortlaut (Kern)**: Wertpapiere sind:
- Aktien + ähnliche Beteiligungswerte,
- Schuldtitel (Anleihen, Genussscheine),
- Anteile an Investmentvermögen.

Finanzinstrumente umfassen zusätzlich Derivate, Geldmarktinstrumente, Emissionszertifikate. Tokenisierte Wertpapiere (eWpG seit 10.06.2021) fallen ebenfalls unter WpHG.

**Audit-Relevanz**: Token-Emissionen mit Wertpapier-Eigenschaften (z.B. Beteiligungs-Token, Dividenden-Token, Anleihe-Token) lösen WpHG aus.

---

## §§ 12–14 — Insider-Recht (MAR-Umsetzung VO 596/2014)

### § 12 — Begriff Insiderpapier

**Wortlaut (Kern)**: Verweis auf MAR Art. 7 — Insiderinformationen + Art. 8 — Insidergeschäfte.

### § 14 — Strafbarkeit Insiderhandel

**Wortlaut (Kern)**: Verweis auf MAR Art. 14 — Verbot des Insiderhandels + § 119 WpHG (Strafvorschriften).

**Audit-Relevanz**: Trading-Plattformen, Crypto-Exchanges (mit MiCA-Markmissbrauchs-Anwendung) müssen interne Insider-Lists + Transaction-Monitoring haben.

---

## §§ 33–36 — Wohlverhaltensregeln (MiFID-II)

### § 33 — Allgemeine Verhaltens- und Organisationspflichten

**Wortlaut (Kern, Abs. 1)**: Wertpapierdienstleistungsunternehmen muss
- mit der erforderlichen Sachkenntnis, Sorgfalt und Gewissenhaftigkeit im bestmöglichen Interesse seiner Kunden tätig werden,
- Interessenkonflikte vermeiden / offenlegen,
- Mitarbeiter angemessen schulen.

**§ 33 Abs. 1 Nr. 7**: Vergütungssystem darf nicht im Konflikt zur Pflicht stehen, im Kundeninteresse zu handeln.

### § 64 — Geeignetheitsprüfung

**Wortlaut (Kern)**: Bei Anlageberatung + Vermögensverwaltung muss Wertpapierdienstleister vom Kunden Informationen einholen über:
- Kenntnisse und Erfahrungen,
- finanzielle Verhältnisse,
- Anlageziele,
- Verlusttragfähigkeit,
und prüfen, ob das Produkt geeignet ist.

**§ 64 Abs. 4**: Geeignetheitserklärung schriftlich vor Geschäftsabschluss.

**Audit-Relevanz**: Robo-Advisor-Onboarding muss Geeignetheits-Frage-Flow korrekt umsetzen + dokumentieren.

### § 80 — Aufzeichnungspflicht (Telefonate + elektronische Kommunikation)

**Wortlaut (Kern)**: Telefonate + elektronische Kommunikationen, die Kundenaufträge enthalten oder dazu führen können, müssen aufgezeichnet + 5 Jahre (max. 7 Jahre nach Auflagen) aufbewahrt werden.

**Audit-Relevanz**: Customer-Service-Software für Trading muss Recording + 5-Jahre-Retention erfüllen.

---

## §§ 33a–33c — Marktmanipulation (MAR Art. 12, 15)

**Wortlaut (Kern)**: Verbote für Geschäfte / Aufträge / Verhaltensweisen, die
- falsche / irreführende Signale senden,
- Preise auf künstlichen Niveaus halten,
- Manipulations-Techniken (Spoofing, Layering, Pump-and-Dump) anwenden.

**Audit-Relevanz**: Crypto-Trading-Plattformen ab MiCA-Anwendung müssen Markmissbrauchs-Detection-Engines bauen.

---

## §§ 105–115 — Sachkundeprüfung + Mitarbeiter-Anzeige

**Wortlaut (Kern)**: Wertpapierdienstleister muss Mitarbeiter mit Anlageberatung-Tätigkeit BaFin anzeigen + Sachkundenachweis vorlegen.

**Audit-Relevanz**: Banking-App-Operator mit Anlageberater-Funktion: Anzeigen-Compliance.

---

## § 119 — Strafvorschriften

**Wortlaut (Kern, Abs. 1)**: Mit Freiheitsstrafe bis zu **fünf Jahren** oder Geldstrafe wird bestraft, wer Insiderhandel (MAR Art. 14) oder Marktmanipulation (MAR Art. 15) begeht.

**§ 119 Abs. 5 — Besonders schwerer Fall**: Freiheitsstrafe ein Jahr bis zehn Jahre bei Vermögensvorteil großen Ausmaßes, gewerbsmäßiger Handlung, Mitgliedschaft in Bande.

---

## § 120 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer
- gegen Wohlverhaltensregeln (§§ 33ff) verstößt,
- gegen Veröffentlichungs-Pflichten (Ad-hoc, Stimmrechtsmeldung),
- gegen Aufzeichnungspflichten verstößt.

**§ 120 Abs. 18 — Bußgeld-Rahmen**:
- bei juristischen Personen: bis **fünfzehn Millionen Euro (15.000.000 €)** oder **15 % Jahresumsatz** (höherer Betrag),
- bei natürlichen Personen: bis **fünf Millionen Euro (5.000.000 €)**,
- Vermögensvorteil-Abschöpfung zusätzlich.

**Audit-Relevanz**: höchste Bußgeld-Rahmen in DE-Compliance-Recht (parallel zu DSGVO Art. 83).

---

## § 26 — Stimmrechtsmeldung

**Wortlaut (Kern)**: Wer Aktien einer börsennotierten Gesellschaft mit Sitz in DE erwirbt / veräußert + dadurch bestimmte Schwellen (3, 5, 10, 15, 20, 25, 30, 50, 75 %) erreicht / unterschreitet, muss BaFin + Emittent unverzüglich melden — spätestens binnen 4 Handelstagen.

**Audit-Relevanz**: bei OTC-Beteiligungs-Plattformen + Crowd-Investing.
