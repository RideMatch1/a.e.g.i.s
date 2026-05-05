---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: VVG Audit-Relevance — Insurtech-/Online-Versicherungs-Vertrieb.
---

# VVG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites/SaaS für:
- Online-Versicherungs-Vergleich (Check24, Verivox, CHECK24-Whitelabel)
- Insurtech-Direktvertrieb
- Robo-Advisor mit Versicherungs-Modul
- Maklerverwaltungs-Programme (MVP, Akquise-Tools)
- B2B2C-Versicherungs-Plattform für Banken / Mobility / Energie

## Trigger im Code/UI

- **Online-Antragsstrecke ohne Bedarfs-Frage-Flow** → § 6
- **Beratungsdoku NICHT vor Vertragsschluss** verfügbar → § 6 Abs. 2 + § 62
- **Widerrufsbelehrung fehlerhaft / fehlt** → § 8 + ewiges Widerrufsrecht-Risiko
- **Allgemeine Gesundheitsfragen** statt konkreter Textform-Fragen → § 19 (Versicherer kann nicht zurückweisen)
- **Ausschluss-Klauseln in AGB ohne Hinweis** → § 7 vor-vertragliche Info-Pflicht
- **Vertragsschluss < 14 Tage Aufbewahrung der Doku** → § 6 Abs. 2 (Doku-Anspruch)
- **„Selbst-Berater"-Online-Tool** ohne § 6-Beratungs-Workflow → § 6 + IDD-Verstoß

## Verstoss-Klassen + Konsequenz

| Verstoss | § | Konsequenz | Quelle |
|---|---|---|---|
| Beratungspflicht-Verletzung | § 6 + § 63 | Schadensersatz | § 6 Abs. 5 / § 63 VVG |
| Vor-vertragliche Info fehlt | § 7 | Widerrufsrecht-Verlängerung + Schadensersatz | BGH-Praxis |
| Widerrufsbelehrung falsch | § 8 | „ewiges" Widerrufsrecht möglich | BGH XI ZR 33/08 |
| Anzeigepflicht-Frage unzureichend | § 19 | Versicherer kann nicht anfechten | § 19 Abs. 5 VVG |
| Maklerpflicht | § 60-62 | Schadensersatz; ggf. IHK-Sanktion | § 63 VVG / § 34d GewO |

VAG-/BaFin-Sanktionen für Versicherer-Aufsicht parallel möglich (Bußgelder bis 5 Mio € / 10 % Jahresumsatz nach VAG § 332).

## Top-Az.

- **BGH IV ZR 73/13** — Widerrufsbelehrung-Anforderungen
- **BGH IV ZR 76/11** — „Ewiges Widerrufsrecht" bei fehlerhafter Belehrung
- **BGH IV ZR 247/11** — Anzeigepflicht in Textform
- **EuGH C-209/12** — Widerrufsrecht-Frist-Beginn
- **BGH I ZR 220/13** — Online-Vergleichsportal-Beratungs-Pflichten

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/IDD-2016-97/` — Insurance Distribution Directive
- `references/gesetze/BGB/` § 312f-§ 312k (Verbraucher-Online-Geschäfte)
- `references/gesetze/UWG/` § 5a (Irreführung) + § 7 (Cold-Outreach)
- `references/dsgvo.md` Art. 9 (Health-Daten bei PKV / BU)
- `references/audit-patterns.md` Phase 5e für Checkout / Vertragsabschluss-Surface

## Praktischer Audit-Checklist

- [ ] Bedarfs-Frage-Flow in Online-Antrag (§ 6)
- [ ] Pflicht-Info (§ 7) als PDF-Download VOR „Jetzt-bestellen"
- [ ] Widerrufsbelehrung 1:1 nach Anlage zu Art. 246 EGBGB
- [ ] Beratungs-Doku (Beratungsprotokoll) PDF-Generation
- [ ] Anzeigepflicht-Fragen konkret in Textform pro Risiko-Bereich
- [ ] AVB / Bedingungswerk auf Site downloadbar
- [ ] Gerichtsstand-Klausel = Verbraucher-Wohnsitz
- [ ] Beschwerdeverfahren-Hinweis (BaFin / Versicherungs-Ombudsmann)
