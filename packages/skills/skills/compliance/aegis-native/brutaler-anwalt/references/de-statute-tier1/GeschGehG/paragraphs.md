---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/geschgehg/
last-checked: 2026-05-05
purpose: GeschGehG (Geschäftsgeheimnisgesetz) — DE-Umsetzung Trade-Secret-RL 2016/943. In Kraft seit 26.04.2019.
---

# GeschGehG — Kern-Paragraphen

> Geschäftsgeheimnisgesetz (GeschGehG), in Kraft seit 26.04.2019.
> Volltext: https://www.gesetze-im-internet.de/geschgehg/
> EU-Hintergrund: Trade-Secret-RL 2016/943.

## § 1 — Anwendungsbereich

**Wortlaut (Kern)**: GeschGehG schützt Geschäftsgeheimnisse gegen unrechtmäßiges Erlangen, Nutzen + Offenlegen — auch bei Vertraulichkeitsbruch ehemaliger Mitarbeiter, Reverse-Engineering, Hacking.

**Audit-Relevanz**: zentrales Code-Schutz-Recht neben UrhG. UrhG schützt Code als Werk, GeschGehG schützt das WISSEN dahinter (Algorithmen, Architektur, Trainings-Daten, Kunden-Listen).

---

## § 2 — Begriffsbestimmungen

**Wortlaut**: Geschäftsgeheimnis ist eine Information, die

- **Nr. 1 a)**: weder insgesamt noch in der genauen Anordnung + Zusammensetzung ihrer Bestandteile den Personen in den Kreisen, die üblicherweise mit dieser Art von Informationen umgehen, allgemein bekannt oder ohne Weiteres zugänglich ist und daher von wirtschaftlichem Wert ist, und
- **Nr. 1 b)**: **Gegenstand von den Umständen nach angemessenen Geheimhaltungsmaßnahmen** durch ihren rechtmäßigen Inhaber ist und
- **Nr. 1 c)**: bei der ein berechtigtes Interesse an der Geheimhaltung besteht.

**Audit-Relevanz**: harter Test. „Angemessene Geheimhaltungsmaßnahmen" muss aktiv nachgewiesen werden — sonst KEIN Geheimnis. Operator muss Klassifizierung + Zugriffskontrolle + NDA + Schulung dokumentieren.

---

## § 3 — Erlaubte Handlungen

**Wortlaut (Kern, Abs. 1)**: Erlaubt sind:
- **Nr. 1**: eigenständige Entdeckung / Schöpfung,
- **Nr. 2**: **Reverse Engineering** eines erworbenen / rechtmäßig zugänglich gemachten Produkts (außer vertraglich anders vereinbart),
- **Nr. 3**: Beobachten, Untersuchen, Testen erworbener Produkte,
- **Nr. 4**: jede sonstige rechtmäßige Handlung.

**Audit-Relevanz**: Reverse-Engineering eines Konkurrenz-Produkts ist GRUNDSÄTZLICH erlaubt — nur durch separaten Vertrag (NDA, EULA-Klausel) ausschließbar. SaaS-EULA muss daher RE-Verbots-Klausel explizit enthalten.

---

## § 4 — Verbotene Handlungen (Verletzungs-Tatbestände)

**Wortlaut**: Verboten sind insbesondere:
- **Abs. 1 Nr. 1**: Erlangung durch unbefugten Zugang, Aneignung, Kopie elektronischer Dateien, anderer Weise rechtswidrigen Zugangs,
- **Abs. 1 Nr. 2**: Erlangung durch sonstiges Verhalten, das gegen Treu + Glauben verstößt,
- **Abs. 2**: Nutzung / Offenlegung trotz unrechtmäßiger Erlangung oder Verletzung Geheimhaltungs-Pflicht,
- **Abs. 3**: Nutzung / Offenlegung wider Treu + Glauben (z.B. ehemaliger Mitarbeiter).

**Audit-Relevanz**: ehemalige Mitarbeiter, die mit Customer-Listen / Code zur Konkurrenz wechseln + dort einsetzen → § 4 Abs. 3-Verstoß.

---

## § 5 — Schutz Whistleblower

**Wortlaut (Kern)**: Erlaubt ist die Erlangung / Nutzung / Offenlegung eines Geheimnisses, wenn dies erfolgt:
- **Nr. 1**: zur Aufdeckung rechtswidrigen Handelns / beruflichen / sonstigen Fehlverhaltens,
- **Nr. 2**: zur Wahrung berechtigter Interessen,
- **Nr. 3**: bei Offenlegung gegenüber Arbeitnehmer-Vertretung im Rahmen Mitbestimmung.

**Cross-Ref HinSchG**: Whistleblower-Schutz mit GeschGehG-Whistleblower-Schranke ist parallel.

---

## §§ 6–9 — Rechtsfolgen Verletzung

**Wortlaut (Kern)**:
- **§ 6** — Beseitigung + Unterlassung (auch vorbeugend bei drohender Verletzung).
- **§ 7** — Vernichtung + Rückruf rechtsverletzender Produkte.
- **§ 8** — Auskunftsanspruch (Bezugsquellen, Vertriebs-Mengen, Vertriebs-Wege).
- **§ 10** — Schadensersatz: Lizenzanalogie ODER konkret-Schaden ODER Verletzergewinn (parallel zu UrhG § 97).

**Audit-Relevanz**: Lizenzanalogie-Berechnung kann bei Code-/Algorithmus-Geheimnissen siebenstellig werden.

---

## §§ 16–22 — Verfahrens-Spezifika

**Wortlaut (Kern)**: Spezial-Verfahren:
- **§ 16** — Geheimhaltung im Prozess (Kläger muss Geheimnis nicht öffentlich offenlegen)
- **§ 19** — Geheim-Kammern bei Landgericht
- **§ 20** — Akten-Geheimhaltung
- **§ 22** — Mitwirkungs-Pflichten Beklagte

**Audit-Relevanz**: ohne diese Verfahrens-Schutz wäre Klage praktisch unmöglich (man würde Geheimnis durch Klage offenlegen). § 16 ff macht Trade-Secret-Litigation in DE viable.

---

## § 23 — Strafvorschriften

**Wortlaut (Kern, Abs. 1)**: Mit Freiheitsstrafe bis zu **drei Jahren** oder Geldstrafe wird bestraft, wer
- **Nr. 1**: Geheimnis durch unbefugten Zugang erlangt + nutzt,
- **Nr. 2**: in der Absicht handelt, sich + anderen Vermögensvorteil zu verschaffen,
- **Nr. 3**: zugunsten eines ausländischen Staates / fremder Macht handelt.

**§ 23 Abs. 2 — Besonders schwerer Fall**: Freiheitsstrafe bis zu **fünf Jahren** bei gewerbsmäßiger Begehung / Bandenmäßiger Begehung / großem Schadensausmaß / besonderer Schädigung.

**§ 23 Abs. 4**: Versuch ist strafbar.

**§ 23 Abs. 7**: Strafverfolgung nur auf Antrag, außer überwiegendes öffentliches Interesse.

**Audit-Relevanz**: zentral für Industriespionage-Fälle + ehemalige-Mitarbeiter-Konstellationen.
