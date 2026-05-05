---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: AMG Audit-Relevance — Arzneimittel-Verkehr / Zulassung.
---

# AMG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites mit:
- Online-Apotheken / Versandapotheken
- E-Commerce mit „Supplements / Vital-Mitteln" mit Heilversprechen
- CBD-/Cannabis-Produkten mit Krankheitsbezug
- Marketplace-Modell für Heilprodukte
- Influencer-Werbung für Health-Produkte mit Indikationen

## Trigger im Code/UI

- **Heilversprechen + Stoff** ohne Zulassungsnachweis → § 21 Verstoß (Funktions-Arzneimittel)
- **Online-Verkauf Rx-Mittel** ohne Versanderlaubnis → § 43 + § 95
- **Rabatt-Coupons** für DE-Rx-Mittel von DE-Apotheke → § 78 / AMPreisV
- **Marketplace ohne Hersteller-Prüfung** für Apothekenpflicht-Produkte → § 95 (Beihilfe-Risiko Plattform)
- **Compassionate-Use-Vermarktung** über öffentliche Site → § 21 Abs. 2 Ausnahme greift NICHT bei Werbung

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Nicht zugelassenes Arzneimittel im Verkehr | § 21 + § 95 | Freiheitsstrafe bis 3 Jahre / Geldstrafe; bes. schwerer Fall 1-10 Jahre | § 95 AMG |
| Apothekenpflicht-Verstoß | § 43 + § 95 | Freiheitsstrafe bis 3 Jahre / Geldstrafe | § 95 AMG |
| Verschreibungspflicht-Verstoß | § 48 + § 96 | Freiheitsstrafe bis 1 Jahr / Geldstrafe | § 96 AMG |
| Werbe-/Kennzeichnungs-OwiG | § 97 | bis 25.000 € (Standard) / bis 50.000 € (benannte Fälle) | § 97 AMG |
| Preisbindung Rx (DE-Apotheke) | § 78 + AMPreisV | Wettbewerbsverstoß + UWG-Abmahnung | § 78 AMG |

## Top-Az.

- **EuGH C-148/15** „Deutsche Parkinson Vereinigung" (19.10.2016) — ausländische Versandapotheken nicht an DE-Rx-Preisbindung gebunden
- **BGH I ZR 26/14** „Marketplace-Verantwortung" — Plattform-Prüfpflicht für Apothekenpflicht-Produkte
- **BGH I ZR 95/14** „MagForce" — Funktions-Arzneimittel-Abgrenzung zu Medizinprodukt
- **BGH I ZR 245/15** „CBD-Hanf-Tee" — Funktions-Arzneimittel-Test bei pflanzlichen Produkten

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/HWG/` für Werbung über zugelassene Arzneimittel
- `references/gesetze/MPDG/` für Medizinprodukt-Abgrenzung
- `references/gesetze/LFGB/` für Lebensmittel-Abgrenzung (Nahrungsergänzungsmittel)
- `references/gesetze/UWG/` § 3a (Rechtsbruch über AMG) — Wettbewerber-Abmahnung möglich

## Sektor-Abgrenzung

| Produkt | Maßgebliches Recht |
|---|---|
| Fertigarzneimittel, Indikation laut Beipackzettel | AMG (zugelassen) |
| Wirkstoff + Heilversprechen, ohne Zulassung | AMG-Verstoß § 21 |
| CE-Mark-Produkt (Hardware/Software) mit medizinischer Zweckbestimmung | MPDG (NICHT AMG) |
| Lebensmittel ohne Heilversprechen | LFGB |
| Lebensmittel mit Heilversprechen → Funktions-Arzneimittel-Risiko | AMG (BGH-Maßstab) |
