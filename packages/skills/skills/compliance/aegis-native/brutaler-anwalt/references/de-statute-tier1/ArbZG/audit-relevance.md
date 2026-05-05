---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: ArbZG Audit-Relevance — HR-Software, Time-Tracking, Schicht-Planung.
---

# ArbZG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites/SaaS für:
- HR-Tools / People-Ops-Software
- Time-Tracking-Apps (Mitarbeiter-Stundenerfassung)
- Schichtplanungs-Software (Krankenhäuser, Gastronomie, Logistik)
- Field-Service-Apps mit Zeiterfassung
- Self-Hosted Workforce-Management

## Trigger im Code/UI

- **Tracking-Tool ohne Pausen-Pflicht-Hinweis** (≥ 6 / 9h) → § 4
- **Schicht-Planer akzeptiert < 11h Ruhezeit** ohne Compensation-Logik → § 5
- **Tagessumme akzeptiert > 10h ohne 6-Monats-Mittel** → § 3
- **Aufzeichnung NUR bei Überstunden** (alte ArbZG § 16 Abs. 2-Logik) → BAG-1-ABR-22/21-Verstoß
- **Datenexport für Behörden-Prüfung fehlt** → § 16 Abs. 2 + behördliche Praxis
- **Manuelle Tasten-Erfassung statt objektive Messung** → EuGH-CCOO-Maßstab fragwürdig

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Höchstarbeitszeit-Verstoß | § 3 + § 22 | bis 15.000 € pro Verstoß | § 22 Abs. 2 ArbZG |
| Pausen-Verstoß | § 4 + § 22 | bis 15.000 € pro Verstoß | § 22 Abs. 2 ArbZG |
| Ruhezeit-Verstoß | § 5 + § 22 | bis 15.000 € pro Verstoß | § 22 Abs. 2 ArbZG |
| Aufzeichnungsverstoß | § 16 + § 22 | bis 15.000 € pro Verstoß | § 22 Abs. 2 ArbZG |
| Vorsätzliche Gesundheitsgefährdung | § 23 | Freiheitsstrafe bis 1 Jahr / Geldstrafe | § 23 ArbZG |
| BAG-Aufzeichnungs-Pflicht (post-CCOO) | § 3 Abs. 2 Nr. 1 ArbSchG | unklar; Klagen Betriebsrat möglich | EuGH C-55/18 + BAG 1 ABR 22/21 |

## Top-Az.

- **EuGH C-55/18 CCOO** (14.05.2019) — Pflicht zur objektiven, verlässlichen, zugänglichen Arbeitszeit-Aufzeichnung
- **BAG 1 ABR 22/21** (13.09.2022) — bestätigt Aufzeichnungs-Pflicht aus § 3 Abs. 2 Nr. 1 ArbSchG; Initiativrecht Betriebsrat verneint, Pflicht besteht aus Gesetz
- **BAG 5 AZR 553/17** — Kontrolle über Mehrarbeit Beweislast Arbeitgeber
- **BAG 8 AZR 23/16** — Bereitschaftsdienst-Bewertung post-Jaeger (EuGH C-151/02)

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/BetrVG/` § 87 Abs. 1 Nr. 2 (Mitbestimmung Arbeitszeit) + Nr. 6 (technische Einrichtungen-Tracking)
- `references/gesetze/NachwG/` § 2 Abs. 1 Nr. 7 (Arbeitszeit-Nennung im Nachweis)
- `references/dsgvo.md` Art. 88 (Beschäftigtendaten) + BDSG § 26 für Tracking-Daten
- `references/audit-patterns.md` Phase 5f für HR-Software-Surface

## EuGH-CCOO-Implementierungs-Checklist

- [ ] System erfasst Arbeitsbeginn + Arbeitsende objektiv (nicht „vom Mitarbeiter freigegeben")
- [ ] Pausen werden separat erfasst (Pflicht-Pausen ≥ 6/9h nachweisbar)
- [ ] Daten 2 Jahre aufbewahrt (Mindest-§-16) + ggf. länger für DSGVO-Beschäftigten-Logik
- [ ] Mitarbeiter hat Zugriff auf eigene Zeitdaten (Art. 15 DSGVO)
- [ ] Aufzeichnung nicht manipulierbar (Audit-Trail / Hash-Chain)
- [ ] Behörden-Export verfügbar (CSV/PDF)
- [ ] Interaktion mit DSGVO Art. 22 (automatisierte Entscheidung) bei Schicht-Algorithmen
