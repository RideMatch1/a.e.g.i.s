---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: PAngV Audit-Relevance — E-Commerce-Preise, Streichpreis-Logik, BNPL.
---

# PAngV — Audit-Relevance

## Auto-Loading-Trigger

Bei E-Commerce / SaaS-Pricing / Subscription-Sites mit:
- B2C-Verkauf
- Werbung mit Rabatt / Streichpreis / „Sale"
- Versandkosten / Verpackung-Aufschlag
- BNPL / Ratenkauf-Optionen
- Lebensmittel- / Drogerie-Mengen-Produkte
- Versicherungs-Vergleichs-Ergebnisse
- Reisebuchungs-Plattformen

## Trigger im Code/UI

- **„Plus Versand"** ohne konkreten Versand-Preis am Produkt → § 3
- **Brutto-Netto-Switch nicht klar in B2C-Modus** → § 3
- **Strike-Through-Element ohne 30-Tage-Min-Validierung** → § 11
- **„UVP" oder „statt 99 €" als Streichpreis-Default** → § 11 (UVP ist nicht Vor-Eigen-Preis)
- **Lebensmittel ohne Grundpreis (kg/l)** → § 4
- **BNPL-Werbung ohne Effektivzins** → § 6
- **Black-Friday-Sale-Logik ohne Roll-Out-30-Tage-Test** → § 11
- **Preis-Update-Logik täglich (z.B. Uber-Surge-Pricing)** ohne Streichpreis-Hinweis → § 11

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Gesamtpreis-Pflicht | § 3 + § 19 | bis 25.000 € + UWG-Abmahnung | § 19 PAngV |
| Streichpreis falsch | § 11 + § 19 | bis 25.000 € + UWG-Abmahnung | § 19 PAngV |
| Grundpreis fehlt | § 4 + § 19 | bis 25.000 € + UWG-Abmahnung | § 19 PAngV |
| Verbraucherkredit-Effektivzins | § 6 + § 19 | bis 25.000 € + UWG-Abmahnung | § 19 PAngV |
| § 130 OWiG-Aufsichtspflicht | § 19 i.V.m. § 130 | bis 10.000.000 € | § 130 OWiG |

UWG-§-3a-Abmahnung: typische Streitwerte 5.000-50.000 € pro abmahnender Wettbewerber/Verband.

## Top-Az.

- **EuGH C-330/23** (26.09.2024) — Aldi-Lidl-Streichpreis-Vorlagebeschluss → 30-Tage-Logik bestätigt bei Werbung mit Reduktion
- **BGH I ZR 220/22** „Aldi" (10.07.2024) — Streichpreis-Auslegung post-EuGH-C-330/23
- **BGH I ZR 119/19** — UVP-Werbung-Anforderungen
- **OLG Köln 6 U 60/22** — Streichpreis bei kontinuierlicher Reduktion
- **EuGH C-356/04 Lidl Belgium** — Vergleichende Werbung mit Preisen

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/UWG/audit-relevance.md` § 3a (Rechtsbruch) + § 5 (Irreführung) + § 5a Abs. 4 (kommerzielle Komm.)
- `references/gesetze/BGB/` §§ 312-312k (Verbraucher-Online)
- `references/audit-patterns.md` Phase 3 für E-Commerce-Pricing-Surface

## Streichpreis-Implementierung (§ 11) — technische Compliance

Code-Anforderungen:
- 30-Tage-Rolling-Min pro SKU + Variante (Größe, Farbe, Region)
- Bei Multi-Vertriebs-Plattform: Min über alle eigenen Kanäle (nicht UVP)
- Snapshot-Logik bei jedem Preis-Wechsel + Persistenz mind. 60 Tage zur Prüfbarkeit
- Streichpreis-UI-Element rendert Min-30-Tage-Wert NICHT „letzten höheren Preis"
- Sale-Ende-Logik: nach Sale wird Streichpreis NICHT mehr gezeigt

## Praktischer Audit-Checklist

- [ ] Brutto-Preis-Pflicht in B2C-Strecke
- [ ] Versandkosten klar erkennbar pro Produkt + Warenkorb
- [ ] Grundpreis bei Lebensmittel / Drogerie ≥ 250g/250ml
- [ ] Streichpreis-Logik: 30-Tage-Min-Tracking + Snapshot-DB
- [ ] BNPL-Block zeigt Effektivzins
- [ ] AGB enthalten Versand-/Liefer-Bedingungen klar
- [ ] „UVP"-Hinweise nicht als Streichpreis
- [ ] Versicherungs-Vergleichs-Ergebnis-Anzeige zeigt Gesamtpreis
- [ ] Reise-Buchung: Endpreis = Flug + Steuer + Service-Gebühr
