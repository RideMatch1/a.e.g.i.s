---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/arbzg/
last-checked: 2026-05-05
purpose: ArbZG (Arbeitszeitgesetz) — Höchstarbeitszeit, Pausen, Ruhezeit. Post-EuGH-CCOO und BAG 1 ABR 22/21 → Pflicht zur Arbeitszeit-Aufzeichnung.
---

# ArbZG — Kern-Paragraphen

> Arbeitszeitgesetz (ArbZG), Stammgesetz 1994 (Umsetzung RL 93/104/EG, später 2003/88/EG).
> Volltext: https://www.gesetze-im-internet.de/arbzg/

## § 2 — Begriffsbestimmungen

**Wortlaut (Kern)**: Arbeitszeit = Zeit vom Beginn bis zum Ende der Arbeit ohne Ruhepausen. Ruhezeit = arbeitsfreie Zeit zwischen zwei Arbeitstagen.

**Audit-Relevanz**: definitorischer Anker für Tracking-Tools.

---

## § 3 — Tägliche Höchstarbeitszeit

**Wortlaut (Kern)**: Die werktägliche Arbeitszeit der Arbeitnehmer darf **acht Stunden** nicht überschreiten. Sie kann auf bis zu **zehn Stunden** verlängert werden, wenn innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht überschritten werden.

**Audit-Relevanz**: HR-Software muss 10h-Grenze + 6-Monats-Mittel rechnen können. Auch Mobile-Work / Home-Office-Erfassung.

---

## § 4 — Ruhepausen

**Wortlaut (Kern)**: Die Arbeit ist durch im Voraus feststehende Ruhepausen zu unterbrechen:
- mindestens **30 Minuten** bei Arbeitszeit über 6 bis 9 Stunden,
- mindestens **45 Minuten** bei Arbeitszeit über 9 Stunden.

Pausen können in Zeitabschnitte von je mindestens 15 Minuten aufgeteilt werden. Länger als 6 Stunden hintereinander dürfen Arbeitnehmer ohne Ruhepause nicht beschäftigt werden.

**Audit-Relevanz**: Tracking-Tool muss Pausen-Pflicht erkennen + automatisch fordern oder protokollieren.

---

## § 5 — Ruhezeit

**Wortlaut (Kern)**: Arbeitnehmer müssen nach Beendigung der täglichen Arbeitszeit eine ununterbrochene Ruhezeit von mindestens **elf Stunden** haben.

**§ 5 Abs. 2** — Verkürzung in bestimmten Branchen (Krankenhäuser, Gaststätten etc.) auf **zehn Stunden** zulässig, wenn jede Verkürzung innerhalb eines Kalendermonats durch Verlängerung einer anderen Ruhezeit ausgeglichen wird.

**Audit-Relevanz**: Schicht-Planer-Software muss 11h/10h-Pause zwischen End und Beginn enforce-en.

---

## § 6 — Nacht- und Schichtarbeit

**Wortlaut (Kern)**: Nachtarbeitszeit = Zeit von 23:00 Uhr bis 06:00 Uhr. Nachtarbeitnehmer haben Anspruch auf bezahlte Freizeit oder angemessenen Zuschlag.

---

## § 16 Abs. 2 — Aufzeichnungspflicht

**Wortlaut (Kern)**: Der Arbeitgeber ist verpflichtet, die über die werktägliche Arbeitszeit des § 3 Satz 1 hinausgehende Arbeitszeit der Arbeitnehmer aufzuzeichnen + diese Aufzeichnungen mindestens **zwei Jahre** aufzubewahren.

**Audit-Relevanz**: Mindest-Pflicht. Aber durch BAG 1 ABR 22/21 (13.09.2022) erweitert → systematische Pflicht zur Aufzeichnung der **gesamten** Arbeitszeit (nicht nur Überstunden) — basierend auf EuGH C-55/18 „CCOO" (14.05.2019). Gesetzgeber-Reform steht 2026 noch aus, aber Pflicht gilt aus EuGH-/BAG-Auslegung sofort.

---

## § 22 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer als Arbeitgeber vorsätzlich oder fahrlässig
- Höchstarbeitszeit überschreitet (§ 3),
- Pausen nicht gewährt (§ 4),
- Ruhezeit nicht einhält (§ 5),
- Aufzeichnungspflicht (§ 16) verletzt.

**§ 22 Abs. 2 — Bußgeld-Rahmen**: Geldbuße bis zu **fünfzehntausend Euro (15.000 €)** pro Verstoß.

**Audit-Relevanz**: € 15k pro Verstoß = bei mehreren Mitarbeitern × mehrere Tage schnell sechsstellig.

---

## § 23 — Strafvorschriften

**Wortlaut (Kern)**: Mit Freiheitsstrafe bis zu einem Jahr oder Geldstrafe wird bestraft, wer beharrlich gegen Höchstarbeitszeit / Ruhezeit verstößt + dadurch Gesundheit von Arbeitnehmern gefährdet.

---

## EuGH-/BAG-Anker

- **EuGH C-55/18** „CCOO" (14.05.2019) — RL 2003/88/EG verlangt von Mitgliedstaaten Pflicht zur objektiven, verlässlichen, zugänglichen Arbeitszeit-Aufzeichnung
- **BAG 1 ABR 22/21** (13.09.2022) — § 3 Abs. 2 Nr. 1 ArbSchG enthält bereits eine Pflicht zur Arbeitszeit-Aufzeichnung; BAG-Mitbestimmungs-Initiativrecht abgelehnt, weil Pflicht von Gesetzes wegen besteht
- **BMAS-Referentenentwurf 2023** — vorsah Pflicht zur elektronischen Aufzeichnung, ist 2026 noch nicht in Kraft. Gesetzeslage: BAG-Maßstab gilt sofort, aber Sanktion-Vorschriften sind Reform-pending.
