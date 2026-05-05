---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/pangv_2022/
last-checked: 2026-05-05
purpose: PAngV (Preisangabenverordnung) — Pflichten zur Preisangabe + Streichpreis-Regelung. Novellierung 28.05.2022 (RL 98/6/EG modernisiert).
---

# PAngV — Kern-Paragraphen

> Preisangabenverordnung (PAngV), Neufassung 28.05.2022.
> Volltext: https://www.gesetze-im-internet.de/pangv_2022/

## § 1 — Anwendungsbereich

**Wortlaut (Kern)**: PAngV gilt für gewerbsmäßiges + regelmäßiges Anbieten von Waren / Leistungen an Verbraucher in Werbung / Schaufenster / Online-Shops / Print-Anzeigen. Geschützt: Preisklarheit + Preiswahrheit für Verbraucher.

---

## § 3 — Gesamtpreis

**Wortlaut (Kern, Abs. 1)**: Wer Verbrauchern gewerbs- oder geschäftsmäßig Waren oder Leistungen anbietet oder als Anbieter dieser Waren oder Leistungen gegenüber Verbrauchern unter Angabe von Preisen wirbt, hat den **Gesamtpreis** anzugeben — d.h. den Preis, der einschließlich Umsatzsteuer + sonstiger Preisbestandteile zu zahlen ist.

**§ 3 Abs. 2 — B2B-Ausnahme**: Im B2B-Geschäft kann Netto-Preis genannt werden („zzgl. gesetzlicher MwSt."). Bei B2C: ZWINGEND Brutto-Preis.

**Audit-Relevanz**: E-Commerce-Site MUSS Brutto-Preis anzeigen + USt + ggf. Versand am Produkt klar ausweisen. „Plus Versand" reicht nicht.

---

## § 4 — Grundpreis

**Wortlaut (Kern)**: Bei losen Waren + abgepackten Waren in bestimmten Mengen-Verpackungen ist zusätzlich zum Gesamtpreis der **Grundpreis pro Mengeneinheit** (1 kg, 1 l, 1 m, 100 g, 100 ml, 1 m²) anzugeben.

**§ 4 Abs. 4 — Ausnahmen**: Mengen unter 250g/250ml fallen nicht zwangsweise in Grundpreis-Pflicht; Bagatell-Schwelle.

**Audit-Relevanz**: Lebensmittel-/Drogerie-/Reinigungs-Online-Shops müssen Grundpreis pro Produkt anzeigen.

---

## § 6 — Preisangaben für Verbraucherkredite

**Wortlaut (Kern)**: Bei Werbung mit Zinssätzen / Kosten für Verbraucherkredite muss zusätzlich der **effektive Jahreszins** klar + verständlich angegeben werden.

**Audit-Relevanz**: BNPL (Buy-Now-Pay-Later) Klarna / PayPal-Pay-in-Later / Affirm-Modelle: Pflichtangabe Effektivzins. Im UI muss klar werden „0%" vs. „14,9% effektiv".

---

## § 11 — Vergleichspreise (Streichpreis)

**Wortlaut (Kern, Abs. 1)**: Wer für eine Preisermäßigung wirbt, muss als Vergleichspreis (durchgestrichener Preis) den **niedrigsten Gesamtpreis** angeben, den der Anbieter innerhalb der letzten **30 Tage** vor Anwendung der Preisermäßigung verlangt hat.

**§ 11 Abs. 2 — Ausnahme bei kontinuierlicher Reduktion**: Bei „immer weiter reduziert"-Verläufen muss der niedrigste Preis innerhalb der vor Beginn der Preisermäßigungs-Phase geltenden 30 Tage angegeben werden.

**§ 11 Abs. 3 — Verderbliche Waren**: Ausnahme für leicht verderbliche Lebensmittel (Markdown am letzten Verkaufstag).

**Audit-Relevanz**: HARTER Hebel. Klassischer „UVP statt eigener Vorpreis"-Trick ist Verstoß. Online-Shop-Code muss 30-Tage-Rolling-Min-Tracking pro SKU haben + im Streichpreis-Element rendern. Black-Friday / Sale-Aktionen sind kritischer Audit-Surface.

---

## § 12 — Preisaushang in Geschäftsräumen

**Wortlaut (Kern)**: Bei stationärem Handel: Preisauszeichnung an der Ware oder am Regal, gut lesbar.

---

## § 14 — Werbung mit Preisen

**Wortlaut (Kern)**: Werbung mit Preisen muss klare Zuordnung zu Ware + alle weiteren Preisbestandteile (Versand, Gebühren, USt) erkennbar machen.

---

## § 19 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer fahrlässig oder vorsätzlich gegen Preisangabe-Pflichten der PAngV verstößt.

**§ 19 Abs. 2 — Bußgeld-Rahmen** (Verweis auf § 19 Abs. 1 PAngV i.V.m. § 9 OWiG / § 130 OWiG):
- Standardfall: bis **fünfundzwanzigtausend Euro (25.000 €)**
- in besonders gelagerten Fällen über § 130 OWiG (Aufsichtspflichten-Verletzung) bis **zehn Millionen Euro (10.000.000 €)** Bußgeldhöchstbetrag möglich.

**Audit-Relevanz**: Hauptauslöser ist UWG-§-3a-Abmahnung durch Wettbewerber + Wettbewerbszentrale. Bußgeld kommt bei Behörden-Aufmerksamkeit.

---

## Wettbewerbsrechtlicher Hebel: UWG § 3a + § 5

PAngV-Verstöße sind Marktverhaltensregelungen → UWG-§-3a-abmahnbar. PAngV-Streichpreis-Verstoß = klassischer „Mondpreis"-Vorwurf, der unter UWG § 5 Abs. 4 (Irreführung) zusätzlich fällt.
