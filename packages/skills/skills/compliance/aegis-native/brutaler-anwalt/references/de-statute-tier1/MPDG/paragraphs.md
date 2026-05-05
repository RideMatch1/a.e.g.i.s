---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/mpdg/
last-checked: 2026-05-05
purpose: MPDG (Medizinprodukte-Durchführungsgesetz) — DE-Umsetzung der MDR (EU 2017/745). In Kraft seit 26.05.2021, ersetzt das frühere MPG.
---

# MPDG — Kern-Paragraphen

> Medizinprodukte-Durchführungsgesetz (MPDG).
> Volltext: https://www.gesetze-im-internet.de/mpdg/
> Begleit-Verordnung MDR: EU 2017/745 (direkt anwendbar, MPDG enthält DE-Spezifika).

## § 1 — Anwendungsbereich

**Wortlaut (Kern)**: MPDG ergänzt die MDR (EU 2017/745) und IVDR (EU 2017/746) für DE. Regelt insb. nationale Marktüberwachung, Sprache (Deutsch-Pflicht für Gebrauchsanweisung), klinische Prüfungen, Sanktionen.

**Audit-Relevanz**: Wenn Produkt unter MDR fällt (jede „Zweckbestimmung" mit medizinischem Zweck — auch Software-as-Medical-Device DiGA, Tracker-Apps mit Gesundheitsmessung, Hardware-Sensoren), greifen MDR + MPDG kumulativ.

---

## § 4 — Sprachregelungen

**Wortlaut (Kern)**: Gebrauchsanweisungen, Kennzeichnungen, Sicherheitsinformationen müssen in **deutscher Sprache** vorliegen, wenn das Produkt für Anwender (Laien, Patienten) in DE bereitgestellt wird. Für medizinisches Fachpersonal kann englisch unter Voraussetzungen ausreichen.

**Audit-Relevanz**: DiGA / Health-App ohne deutsche Gebrauchsanweisung = MPDG-§-4-Verstoß. Auch In-App-Hilfe + Risiko-Hinweise.

---

## § 6 — Bevollmächtigter

**Wortlaut (Kern)**: Hersteller mit Sitz außerhalb der EU benötigen einen in der EU niedergelassenen Bevollmächtigten (MDR Art. 11). Bevollmächtigter haftet bei fehlerhaften Produkten subsidiär.

**Audit-Relevanz**: US-/UK-Health-App-Anbieter ohne EU-Bevollmächtigten = Marktverbot.

---

## § 7 — Bereitstellung auf dem Markt

**Wortlaut (Kern)**: Medizinprodukte dürfen nur in den Verkehr gebracht / in Betrieb genommen werden, wenn sie die MDR-Anforderungen erfüllen + die CE-Kennzeichnung tragen.

**Audit-Relevanz**: Software / App ohne CE-Mark, die als Medizinprodukt einzustufen ist (Diagnose, Therapie, Krankheitsüberwachung) = § 7-Verstoß. Trigger besonders kritisch bei „Diabetes-Tracker", „EKG-App", „Symptom-Checker mit Diagnose-Output".

---

## § 8 — Aufbereiter

**Wortlaut (Kern)**: Wer Einmalprodukte aufbereitet, übernimmt Hersteller-Pflichten für aufbereitetes Produkt.

**Audit-Relevanz**: B2B-Klinik-Sektor — selten relevant für SaaS-Audits.

---

## §§ 14–28 — Klinische Prüfungen

**Wortlaut (Kern)**: Klinische Prüfungen mit Medizinprodukten erfordern BfArM-Genehmigung + zustimmende Bewertung der Ethik-Kommission. Sponsor hat Anzeige- und Berichtspflichten gegenüber BfArM.

**Audit-Relevanz**: DiGA-Studien für BfArM-Listing-Antrag müssen MPDG-Studien-Vorgaben einhalten.

---

## § 29 — Marktüberwachung

**Wortlaut (Kern)**: Zuständige Behörden (in DE: BfArM + Landesbehörden) überwachen Markt; Hersteller / Bevollmächtigte müssen auf Verlangen Auskünfte / Dokumentation vorlegen.

**Audit-Relevanz**: Behörden-Checks bei Health-Apps zunehmend regelmäßig (BfArM-Beanstandungen 2024-2025 dokumentiert).

---

## § 92 — Strafvorschriften

**Wortlaut (Kern, Abs. 1)**: Mit Freiheitsstrafe bis zu **drei Jahren** oder mit Geldstrafe wird bestraft, wer
- ein Medizinprodukt ohne CE-Kennzeichnung in den Verkehr bringt,
- klinische Prüfung ohne Genehmigung durchführt,
- gefälschte Medizinprodukte in den Verkehr bringt.

**§ 92 Abs. 2 — Besonders schwerer Fall**: Freiheitsstrafe bis **zehn Jahre** bei Gesundheitsgefährdung vieler Menschen oder Vermögensvorteil großen Ausmaßes.

**Audit-Relevanz**: harter Hebel — Software-as-MedDevice ohne CE-Mark + Vermarktung = § 92-Tatbestand.

---

## § 93 — Strafvorschriften (weitere)

**Wortlaut (Kern)**: Freiheitsstrafe bis zu einem Jahr oder Geldstrafe für Verstöße gegen Sprach-, Kennzeichnungs- und Berichts-Pflichten.

---

## § 94 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer fahrlässig oder vorsätzlich gegen formale Pflichten der MDR / MPDG verstößt (Fristen, Anzeigen, Klassifizierungs-Erklärungen).

**§ 94 Abs. 5 — Bußgeld-Rahmen**: Geldbuße bis zu **dreißigtausend Euro (30.000 €)**, in benannten Fällen bis zu **fünfzigtausend Euro (50.000 €)**.

**Audit-Relevanz**: Fall-back für formale Verstöße. Wenn Hauptauslöser ein § 92-Tatbestand ist, eskaliert Strafverfolgung sofort.
