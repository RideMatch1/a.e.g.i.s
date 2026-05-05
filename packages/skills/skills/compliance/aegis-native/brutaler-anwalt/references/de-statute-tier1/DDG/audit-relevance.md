---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: DDG Audit-Relevance — Impressum, Hosting-Privileg, DSA-Begleitvorschriften.
---

# DDG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDER geschäftlich-betriebenen Site (auch ohne Gewinn):
- Webseiten / Online-Shops
- Apps / SaaS
- Online-Marketplaces
- Soziale Netzwerke
- Cloud-/Hosting-Services
- UGC-Plattformen

## Trigger im Code/UI

- **Footer ohne Impressum-Link** → § 5
- **Impressum > 2 Klicks weg** → § 5 (nicht „leicht erreichbar")
- **Fehlende USt-ID** bei umsatzsteuerpflichtigen Anbietern → § 5 Abs. 1 Nr. 6
- **Affiliate-Link ohne Werbe-Hinweis** → § 6
- **Notice-and-Action-Endpoint fehlt** auf UGC-Plattform → § 10 + DSA Art. 16
- **Behörden-/Nutzer-Single-Point-of-Contact fehlt** → § 18 + DSA Art. 11/12
- **Algorithmus-Transparenz fehlt** auf Recommendation-System (für VLOPs) → DSA Art. 27

## Verstoss-Klassen + €-Range

| Surface | DDG-§ | Range | Quelle |
|---|---|---|---|
| Impressum | § 5 + § 33 | bis 50.000 € + UWG-Abmahnung | § 33 Abs. 4 DDG |
| Werbung-Kennzeichnung | § 6 + § 33 | bis 50.000 € + UWG-Abmahnung | § 33 Abs. 4 DDG |
| DSA-Begleit-Verstoß | §§ 18-22 + § 33 | bis 6 % Umsatz | § 33 Abs. 4 DDG (an DSA gespiegelt) |
| UGC-Hosting-Privileg-Verlust | § 10 | Haftung für Inhalt + DSA Art. 14 | § 10 DDG |

## Pflicht-Surfaces

| Surface | DDG-§ |
|---|---|
| Impressum | § 5 |
| Werbung-Kennzeichnung | § 6 |
| UGC-Hosting-Privileg | §§ 7-10 |
| DSA-Umsetzungs-Pflichten | §§ 18-22 |

## Top-Az.

- **BGH I ZR 158/15** „Anwalt-Impressum" — vollständige Berufsregelungen-Verlinkung
- **BGH I ZR 228/03** — „leicht erkennbar + ständig verfügbar"
- **BGH I ZR 27/19** — telefonische Erreichbarkeit als hinreichender Kontakt
- **OLG Hamburg 5 U 105/20** — Online-Shop-Impressum bei mehreren Marken

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/DSA-2022-2065/` für direkte EU-Vorgaben (Art. 14 Notice-and-Action, Art. 16 Notice-Endpoint, Art. 22 Out-of-Court-Dispute)
- `references/gesetze/UWG/audit-relevance.md` § 3a (DDG-Verstöße sind Marktverhaltens-Reg → abmahnbar)
- `references/gesetze/TDDDG/` für Cookies (separat regulated, NICHT DDG)
- `references/audit-patterns.md` Phase 3 (Impressum-Audit-Surface)

## Praktischer Audit-Checklist (Impressum § 5)

- [ ] „Impressum"-Link im Footer auf jeder Seite
- [ ] Impressum auf eigener Page (nicht modal-overlay)
- [ ] Name + vollständige Anschrift
- [ ] Vertretungsberechtigter bei juristischer Person
- [ ] Email + ein weiterer Kontaktweg
- [ ] Handelsregister + Nummer (bei jur. Person)
- [ ] USt-ID (DE + 9 Ziffern, korrektes Format)
- [ ] Aufsichtsbehörde bei zulassungspflichtigen Tätigkeiten
- [ ] Reglementierte Berufe: Berufsbezeichnung + Verleihungs-Staat + Kammer-Link + Berufsordnungs-Link
- [ ] Bei Konzern-Brands: separate Impressum-Pages je Brand
