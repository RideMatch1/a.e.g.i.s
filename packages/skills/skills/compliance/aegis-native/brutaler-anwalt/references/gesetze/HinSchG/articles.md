---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/hinschg/
last-checked: 2026-05-02
purpose: HinSchG (Hinweisgeberschutzgesetz) — interne Meldekanal-Pflicht.
verification-status: verified
skill-output-disclaimer: "Top-Layer-verifiziert (gesetze-im-internet.de) — Sanktions-Hoehen + Schwellwerte primaer-verifiziert"
last-verified: 2026-05-05
---

# HinSchG — Audit-relevante Paragraphen

> Hinweisgeberschutzgesetz, in Kraft seit 02.07.2023.
> Volltext: https://www.gesetze-im-internet.de/hinschg/

## Pflicht-Schwellen

| MA | Pflicht-Status | Stichtag |
|---|---|---|
| >= 250 MA | Meldekanal Pflicht | seit 02.07.2023 |
| 50-249 MA | Meldekanal Pflicht | seit 17.12.2023 |
| < 50 MA | Keine Pflicht (ausser regulierte Branchen) | -- |

## §§ 12-21 — Interne Meldekanaele

### § 12 — Pflicht-Aufbau

- Meldekanal vertraulich + sicher
- Erreichbar fuer:
  - Schriftlich (Email / Form)
  - Muendlich (Telefon / persoenlich auf Wunsch)
- Innerhalb 7 Tagen Bestaetigung an Hinweisgeber
- Innerhalb 3 Monaten Folge-Mitteilung

### § 13 — Verschwiegenheits-Pflicht

Identitaet des Hinweisgebers strikt geschuetzt — auch gegenueber dem Vorgesetzten.

### § 14 — Meldekanal-Aufbau

- Eigener interner Channel ODER
- Externer Dienstleister (zertifiziert)

### § 16 — Anonyme Meldungen

Sollen entgegengenommen + bearbeitet werden (kein „muss" — aber Best-Practice).

## § 36 — Schutz vor Repressalien

Hinweisgeber duerfen nicht benachteiligt werden:
- Kuendigung
- Versetzung
- Gehaltskuerzung
- Mobbing

Beweislastumkehr: Bei Repressalien-Vorwurf muss Arbeitgeber beweisen dass Massnahme nicht repressalien-motiviert.

## § 40 — Bussgeld

- Verhindern einer Meldung: bis **20.000 EUR**
- Verstoss gegen Verschwiegenheitspflicht: bis **20.000 EUR**
- Repressalien: bis **50.000 EUR**

In Kraft seit 01.12.2023 (verzoegerte Sanktions-Anwendung).

## Audit-Relevanz fuer Skill

Wenn Site-Operator > 50 MA hat:

```
Pflicht-Surfaces:
- Internal Channel: /api/hinweis oder externer Provider
- AGB / Compliance-Doku: Hinweisgeberschutz-Paragraph
- Mitarbeiter-Information: Pflicht zur jaehrlichen Schulung empfohlen
- Datenschutz: AVV mit externem Hinweisgeber-Provider
```

## Audit-Pattern

```
**Finding**: 80-MA-Operator ohne dokumentierten Hinweisgeber-Meldekanal
**Wahrsch.**: 30% (BfDI-/Bundesamt-Pruefung haeufig nur bei Anlass)
**§**: § 12 + § 40 HinSchG
**€-Range**: bis 20.000 EUR + Repressalien-Risiko 50.000 EUR
**Fix**:
- Meldekanal aufbauen (intern oder extern)
- Mitarbeiter-Info-Mail mit Kanal-Beschreibung
- AGB / Compliance-Handbuch ergaenzen
- AVV mit Provider falls extern
```

## Source

- [gesetze-im-internet.de — HinSchG](https://www.gesetze-im-internet.de/hinschg/)
- [IHK Stuttgart — HinSchG-FAQ](https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/arbeitsrecht/whistleblowing-5169770)
- [BMJ HinSchG-Page](https://www.bmj.de/DE/themen/strafrecht/whistleblowing/whistleblowing_node.html)
