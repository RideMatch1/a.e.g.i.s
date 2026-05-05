---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/tkg_2021/
last-checked: 2026-05-02
purpose: TKG (Telekommunikationsgesetz) — TK-Anbieter-Pflichten.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen gesetze-im-internet.de verifizieren"
last-verified: 2026-05-05
---

# TKG — Audit-relevante Paragraphen

> TKG 2021 (in Kraft seit 01.12.2021).
> Volltext: https://www.gesetze-im-internet.de/tkg_2021/

## Anwendungsbereich (§ 3)

TKG gilt fuer:
- Klassische Telekom-Anbieter (Festnetz / Mobilfunk)
- VoIP-Provider (Skype, RingCentral)
- Email-Provider mit Massentaetigkeit
- Cloud-Communication-APIs (Twilio, MessageBird)

NICHT erfasst:
- Dienste ueber Telekom-Layer (Webseiten, Apps) — diese unterliegen TDDDG / DDG

## § 9 — Anzeigepflicht

Anzeige bei BNetzA bei Aufnahme des Geschaefts.

## § 22 — Pflichten zur Telekommunikations-Sicherheit

- Mind. State-of-the-art TOMs
- Verschluesselungs-Pflicht
- Notruf-Routing zu 110/112

## § 109 — Vertraulichkeit

Vertraulichkeit der Kommunikation Pflicht.

## § 169 — Datenschutz-spezifisch

Verkehrsdaten / Standortdaten / Inhaltsdaten — strenge Loesch-Pflichten.

## §§ 178-180 — Vorratsdatenspeicherung

Status 2026: ausgesetzt nach BVerfG-Urteilen + EuGH-Folgen.
BNetzA hat Aussetzung verkuendet, EU-RL ist offen.

## Notrufpflichten (§§ 164-167)

- Notruf 110 + 112 immer kostenfrei
- Notruf-Routing zu naechstem Leitstand
- Standortuebermittlung Pflicht (e911-Aequivalent)

## Sanktionen

BNetzA-Bussgeld:
- bis 500.000 EUR pro Verstoss
- bei Vertraulichkeits-Verletzung bis 100.000 EUR

## Audit-Trigger

Wenn Site VoIP / Messaging / Email-Massentaetigkeit anbietet:
- BNetzA-Anzeige?
- Notruf-Pflicht (bei VoIP)?
- TLS-Verschluesselung?
- Vorratsdatenspeicherung-Status pruefen

## Source

- [gesetze-im-internet.de — TKG](https://www.gesetze-im-internet.de/tkg_2021/)
- [BNetzA TKG-Page](https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/start.html)
