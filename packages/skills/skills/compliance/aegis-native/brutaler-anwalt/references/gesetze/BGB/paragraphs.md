---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/bgb/
last-checked: 2026-05-01
purpose: BGB — AGB-Recht (§§ 305–310), Verbraucherschutz (§§ 312–312k), Widerruf (§§ 355–357d), Pauschalreise (§§ 651a–y). Audit-relevant.
---

# BGB — Audit-relevante Paragraphen

> Volltext: https://www.gesetze-im-internet.de/bgb/

## AGB-Recht (§§ 305–310)

### § 305 — Einbeziehung Allgemeiner Geschäftsbedingungen
- Abs. 2: AGB werden Vertragsbestandteil nur wenn ausdrücklicher Hinweis + zumutbare Möglichkeit der Kenntnisnahme + Einverständnis
- Abs. 3: Rahmenvereinbarung möglich (z.B. fortlaufende Geschäftsbeziehung)
**Audit-Relevanz:** AGB-Akzeptanz im Bestellprozess sichtbar + zumutbar lesbar (nicht nur Footer-Link).

### § 305c — Überraschende und mehrdeutige Klauseln
Klauseln, mit denen Vertragspartner nicht zu rechnen brauchte → werden NICHT Vertragsbestandteil.
Mehrdeutige Klauseln gehen zu Lasten des Verwenders.
**Audit-Relevanz:** AGB-Klausel „Haftung ausgeschlossen für jede Schadensart" → überraschend → unwirksam.

### § 307 — Inhaltskontrolle (Generalklausel)
- Abs. 1: unangemessene Benachteiligung → unwirksam
- Abs. 1 S. 2: intransparente Klauseln → unangemessen
- Abs. 2 Nr. 1: Abweichung von gesetzlichen Grundgedanken
- Abs. 2 Nr. 2: Aushöhlung des Vertragszwecks
**Audit-Relevanz:** Generalprüfung jeder AGB-Klausel.

### § 308 — Klauselverbote mit Wertungsmöglichkeit
- Nr. 1: unangemessene Annahme-/Lieferfristen
- Nr. 4: einseitige Leistungsänderungs-Vorbehalte (BGH XI ZR 26/20: nur mit Wesentlichkeit-Schwelle)
- **Nr. 5: Genehmigungsfiktion bei AGB-Änderungen** — strenge Voraussetzungen (BGH XI ZR 26/20)

### § 309 — Klauselverbote ohne Wertungsmöglichkeit
- Nr. 7 lit. a: Haftungsausschluss bei Vorsatz/grober Fahrlässigkeit + Personenschäden = unwirksam
- **Nr. 9 lit. b: Verbrauchervertrag mit Laufzeit > 1 Jahr → max. 1 Monat Kündigungsfrist nach Erstlaufzeit** (Faires-Verbraucher-Vertraege-Gesetz 2022)

### § 310 — Anwendungsbereich
- Abs. 1: § 309 + Klauselverbote nur ggü. Verbraucher (B2C)
- Abs. 4: gilt nicht für Arbeitsverträge

## Verbraucherschutz (§§ 312–312k)

### § 312 — Anwendungsbereich
B2C-Verbrauchervertrag bei entgeltlichen Leistungen.

### § 312a — Allgemeine Pflichten + Grundsätze
- Abs. 2: Vorvertragliche Informationspflicht (Art. 246a EGBGB Anlage)
- Abs. 3: Buttontext-Pflicht „zahlungspflichtig bestellen" (auch hier verankert)
- Abs. 4: keine pre-checked-Zusatzleistungen

### § 312g — Widerrufsrecht
- Abs. 1: bei Fernabsatzverträgen (Art. 312c) und außerhalb Geschäftsräumen
- Abs. 2: Ausnahmen (Sonderanfertigungen, schnell verderbliche Waren, versiegelte Hygiene-Artikel, etc.)

### § 312i — Allgemeine Pflichten im elektronischen Geschäftsverkehr
- Abs. 1: technische Mittel zur Erkennung + Korrektur von Eingabefehlern

### § 312j — Besondere Pflichten bei Verbrauchervertraegen im elektronischen Geschäftsverkehr
- Abs. 1: vor Abgabe der Bestellung Pflicht-Informationen
- **Abs. 2: konkrete UI-Anforderungen** — wesentliche Merkmale, Gesamtpreis, Laufzeit, Mindestlaufzeit + Kündigung gut sichtbar direkt vor Bestellung
- **Abs. 3: Button-Lösung „zahlungspflichtig bestellen"** — Pflicht-Wording. Alternativen: „kostenpflichtig bestellen", „kaufen". NICHT akzeptiert: „Anmelden", „weiter", „bestellen", „Auftrag erteilen"

### § 312k — Online-Kündigungsbutton
- Abs. 1: bei B2C-Dauerschuldverhältnissen über Webseite Pflicht
- Abs. 2: Button beschriftet mit „Verträge hier kündigen" oder eindeutig vergleichbar
- Abs. 3: Bestätigungsseite mit Kündigungs-Daten
- Abs. 4: unverzügliche elektronische Empfangsbestätigung
**Az.-Anker:** BGH I ZR 161/24 (22.05.2025) zu § 312k.

## Widerrufsrecht (§§ 355–357d)

### § 355 — Widerrufsrecht
- Abs. 1: 14 Tage ab Vertragsschluss (oder Erhalt Ware)
- Abs. 2: Frist beginnt nicht ohne Widerrufsbelehrung
**Audit-Relevanz:** Widerrufsbelehrung muss „deutlich" sein (BGH VIII ZR 70/08). Mustertext aus Anlage 1 zu Art. 246a § 1 Abs. 2 EGBGB.

### § 356 — Widerrufsrecht im Fernabsatz / außerhalb Geschäftsräume
- Abs. 1: 14 Tage
- Abs. 3: bei fehlender Belehrung 12 Monate + 14 Tage Höchstfrist

### § 357 — Rechtsfolgen Widerruf
Rückzahlung binnen 14 Tagen. Hin- und Rücksendekosten.

### § 357a — Bei digitalen Produkten
Bei Bereitstellung digitaler Inhalte: Widerruf endet wenn Verbraucher zugestimmt hat.

## Pauschalreise (§§ 651a–y)

### § 651a — Pflichten Reiseveranstalter
Definitionen, Anwendungsbereich.

### § 651k — Sicherungspflicht
Reise-Sicherungs-Schein vor Anzahlung.
**Audit-Relevanz:** Reise-Sites brauchen Sicherungs-Schein-Hinweis VOR Bestellung.

---

## Audit-Mapping

| Audit-Surface | BGB-§ |
|---------------|-------|
| AGB-Klauseln | § 305c, § 307, § 308, § 309, § 310 |
| AGB Genehmigungsfiktion | § 308 Nr. 5 + BGH XI ZR 26/20 |
| Mindestlaufzeit B2C | § 309 Nr. 9 lit. b |
| Vorvertragliche Pflicht-Info | § 312a Abs. 2 + Art. 246a EGBGB |
| Button-Lösung | § 312j Abs. 3 |
| Kündigungsbutton | § 312k + BGH I ZR 161/24 |
| Widerrufsbelehrung | §§ 355, 356, 357 + BGH VIII ZR 70/08 |
| Pauschalreise | §§ 651a–y |
