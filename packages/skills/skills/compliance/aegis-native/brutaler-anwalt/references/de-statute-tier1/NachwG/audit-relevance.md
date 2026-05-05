---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: NachwG Audit-Relevance — HR-Onboarding-Pflicht-Schriftform.
---

# NachwG — Audit-Relevance

## Auto-Loading-Trigger

Bei HR-/People-Ops-Software in DE-Kontext:
- Onboarding-Workflows
- E-Signature-Plattformen für Arbeitsverträge
- HRIS-Systeme

## Trigger im Code/UI

- **Onboarding-Workflow nur mit DocuSign/qeS** ohne handschriftliche Unterschrift-Option → § 2 Abs. 1 Satz 3
- **Vertragstemplate ohne 14 Pflichtfelder** → § 2 Abs. 1
- **Aushändigung erst nach Probearbeit** → § 3 Frist-Verstoß
- **Befristete Verträge ohne Endzeitpunkt im Nachweis** → § 2 Abs. 1 Nr. 3
- **Fehlender Hinweis Klagefrist 3 Wochen § 4 KSchG** → § 2 Abs. 1 Nr. 13

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Niederschrift fehlt / unvollständig | § 2 + § 4 | bis 2.000 € pro Verstoß | § 4 Abs. 2 NachwG |
| Frist überschritten | § 3 + § 4 | bis 2.000 € pro Verstoß | § 4 Abs. 2 NachwG |
| Elektronische Form statt Schriftform | § 2 + § 4 | bis 2.000 € pro Verstoß | § 4 Abs. 2 NachwG |

**Hauptrisiko**: Beweislast-Umkehr im Arbeitsgericht — bei fehlendem Nachweis trägt Arbeitgeber Beweislast für mündliche Vereinbarung. Bei Streit über Kündigungsfrist / Vergütungs-Höhe / Urlaub: AG verliert ohne Nachweis.

## Top-Az.

- **BAG 5 AZR 545/12** — Beweislast-Verschiebung bei fehlendem Nachweis
- **BAG 6 AZR 366/22** — Tarifvertrags-Hinweis-Pflicht in Niederschrift

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/ArbZG/` § 16 Abs. 2 für Arbeitszeit-Aufzeichnung
- `references/gesetze/BGB/` § 126 (Schriftform), § 126a (qeS) — NachwG-Schriftform = § 126
- `references/audit-patterns.md` Phase 5f für HR-Onboarding-Surface
- BMAS-Hinweise zu RL 2019/1152

## Praktischer Audit-Checklist

- [ ] Vertragstemplate enthält alle 14 Pflicht-Felder (§ 2 Abs. 1)
- [ ] Workflow generiert PDF mit Druck-Option für handschr. Unterschrift
- [ ] Aushändigung am ersten Arbeitstag protokolliert (Nachweis)
- [ ] Tarifvertrags-/BV-Verzeichnis im Vertragstemplate verlinkt
- [ ] Bei befristeten Verträgen: Endzeitpunkt + Befristungsgrund klar
- [ ] Klagefrist 3 Wochen § 4 KSchG explizit erwähnt
- [ ] Backlog-Process für Pre-2022-Verträge auf Verlangen
