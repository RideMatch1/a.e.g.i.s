---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: BetrVG Audit-Relevance — KI-Mitbestimmung, Tech-Stack-Mitbestimmungsrechte.
---

# BetrVG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDEM Tech-Tool im DE-Beschäftigtenkontext, das:
- Verhalten überwacht (E-Mail, Chat, Browsing, Video)
- Leistung erfasst (Time-Tracking, KPIs, Dashboards)
- KI-Entscheidungen trifft (Recruiting, Performance-Bewertung)
- Standort/Telematik erfasst (Außendienst, Logistik)
- Mitarbeiter-Daten verarbeitet, die Verhaltens-/Leistungs-Rückschlüsse ermöglichen

## Trigger im Code/UI

- **HR-Tool ohne BV-Hinweis** im Onboarding → § 87 Abs. 1 Nr. 6
- **Slack/Teams-Audit-Logs** ohne BR-Vereinbarung → § 87 Abs. 1 Nr. 6
- **GitHub-Copilot-Telemetrie** für Mitarbeiter ohne BV → § 87 Abs. 1 Nr. 6
- **CRM mit Performance-Score** (Salesforce, HubSpot) ohne BV → § 87 Abs. 1 Nr. 6
- **KI-Recruiting / CV-Parser** ohne BV → § 87 + § 95 doppelt
- **Tool-Einführung ohne § 90-Beratung** vor Vertragsunterzeichnung → § 90 Abs. 1
- **Home-Office-Regelung einseitig** ohne BV → § 87 Abs. 1 Nr. 14

## Verstoss-Klassen + Konsequenz

| Verstoss | § | Konsequenz | Quelle |
|---|---|---|---|
| Tool ohne BV (technische Einrichtung) | § 87 Abs. 1 Nr. 6 | Unterlassung + Beseitigung | § 23 Abs. 3 BetrVG / § 1004 BGB analog |
| Information § 90 verweigert | § 90 + § 121 | bis 10.000 € + Unterlassung | § 121 Abs. 2 BetrVG |
| BR-Behinderung | § 78 + § 119 | Freiheitsstrafe bis 1J / Geldstrafe | § 119 BetrVG |
| KI-Auswahlrichtlinien ohne BV | § 95 + § 87 | Unterlassung Tool-Einsatz | BAG-Praxis |

**Hauptrisiko**: einstweilige Verfügung. Gericht stoppt Tool sofort, bis BV verhandelt ist. Operator-Schaden = Tool-Lizenzkosten + Migrations-Aufwand zurück.

## Top-Az.

- **BAG 1 ABR 22/21** (13.09.2022) — Arbeitszeit-Aufzeichnungs-Pflicht (auch BetrVG-Kontext, Initiativrecht verneint, weil gesetzliche Pflicht)
- **BAG 1 ABR 51/20** — Microsoft-Office-365-Telemetrie als § 87-mitbestimmungspflichtige Einrichtung
- **BAG 1 ABR 7/12** — GPS-Tracking in Außendienst-Fahrzeugen
- **BAG 1 ABR 28/16** — Facebook-Page-Insights als „Verhalten überwachen"
- **LAG Hamm 7 TaBV 79/22** — Microsoft Teams-Telemetrie

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/AI-Act-2024-1689/` Hochrisiko-KI-System (Annex III Nr. 4)
- `references/dsgvo.md` Art. 88 + BDSG § 26 (Beschäftigtendaten)
- `references/gesetze/AGG/` § 22 Beweislast bei diskriminierenden Algorithmen
- `references/gesetze/ArbZG/` § 16 Aufzeichnungspflicht (oft mitbestimmungspflichtig § 87 Abs. 1 Nr. 6)
- `references/audit-patterns.md` Phase 5f für HR-/Workforce-Surface

## „Tech-Stack-BV"-Compliance-Pfad

Wenn Operator > 5 MA + DE-Sitz + neue Software einführt:
1. **§ 90 Beratung VOR Vertragsabschluss mit Software-Anbieter** — frühzeitig informieren
2. **§ 87 Abs. 1 Nr. 6 — Mitbestimmung Einführung** — BV verhandeln (Datenschutz-Art, Zweckbindung, Dauer-Speicherung, Zugriffe)
3. **§ 95 Mitbestimmung Auswahlrichtlinien** falls Auswahl-Algorithmus
4. **DSGVO Art. 88 / BDSG § 26 — Beschäftigtendatenschutz** — Rechtsgrundlage in BV festlegen
5. **AI-Act Compliance** falls Hochrisiko-System (ab 02.08.2026 voll)

Bei Konflikt → Einigungsstelle (§ 76 BetrVG) entscheidet. Bei BR-Initiativ-Klage → Arbeitsgericht erlässt Verfügung.

## Praktischer Audit-Checklist

- [ ] Liste aller Tools mit MA-Daten-Bezug erstellt
- [ ] Pro Tool: Existiert eine Betriebsvereinbarung?
- [ ] BV deckt: Zweck, Erfasste Daten, Dauer, Zugriffe, Löschung, Mitarbeiter-Rechte
- [ ] § 90-Beratung dokumentiert (Email-Trail / BV-Niederschrift)
- [ ] BR-Schulung zu KI-Tools angeboten (§ 80 Abs. 3)
- [ ] BR-Sachverständigen-Zuziehung erlaubt (§ 80 Abs. 3) für KI-Tool-Bewertung
