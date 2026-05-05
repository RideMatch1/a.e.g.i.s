---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: VDuG Audit-Relevance — Massen-Klage-Risiko durch Verbraucherverbände.
---

# VDuG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDEM B2C-Operator mit größerer Nutzerbasis (i.d.R. ≥ 50 betroffene Verbraucher), insb.:
- Cookie-Tracking-Heavy-Sites
- AGB mit umstrittenen Klauseln
- Subscription-Modelle (Auto-Renewal)
- Banking / Insurance / Telco-Tarife
- Online-Marktplätze
- Reise-Buchungs-Plattformen
- Energie-Versorger / Stromtarife

## Trigger im Code/UI / Doku

- **Auto-Renewal-Klauseln** ohne klare Kündigungs-Logik → Klage-Risiko
- **Zinsanpassungs-Klauseln** in Bank-/Bausparkassen-Verträgen → Klage-Risiko
- **Cookie-Tracking ohne Consent** → Massen-Klage Cookie-Schadensersatz
- **Sale-Streichpreis-Verstöße** → Aggregat-Schadensersatz
- **Versicherungs-Tarif-Anpassungs-Mechaniken** → Klassische Klage-Anker
- **Compliance-Defizit-Persistenz** (UWG-Abmahnung ignoriert) → Klage-Eskalation

## Wirkung + Konsequenzen

| Klagetyp | Effekt | Quelle |
|---|---|---|
| Abhilfeklage erfolgreich | Aggregat-Schadensersatz an alle angemeldeten Verbraucher | § 14 + § 28 VDuG |
| Musterfeststellung erfolgreich | Verbindliche tatsächliche/rechtliche Feststellung | § 41 VDuG |
| Eintrag im Klagen-Register | Öffentliche Reputation-Schädigung | § 16 VDuG |
| Vergleich gerichtlich genehmigt | Bindung an angemeldete Verbraucher | § 22 VDuG |

**Schadens-Risiko**: Aggregat aus Einzel-Schäden × angemeldete Nutzer. Bei DSGVO-Cookie-Bannern hat EuGH C-300/21 (04.05.2023) Schadensersatz auch für „Ärger" anerkannt — meist 50-500 € pro Person nach OLG-Maßstäben.

## Top-Az.

- **vzbv vs. Mercedes-Benz Bank** (LG Stuttgart 2024) — laufende Abhilfeklage
- **vzbv vs. Klarna** — Cookie-/Tracking-Klage
- **EuGH C-300/21** „UI vs Österreichische Post" — Schadensersatz-Begriff bei DSGVO-Verletzung
- **BGH VI ZR 1244/22** — DSGVO-Schadensersatz-Maßstab in DE post-EuGH
- **OLG Stuttgart 1 U 16/21** — Schadensersatz-Höhe Cookie-Verletzung

## Cross-Reference (zu anderen Skill-Files)

- `references/dsgvo.md` Art. 82 (Schadensersatz) — Hebel für Massen-Schaden
- `references/gesetze/UWG/audit-relevance.md` § 8 (Klagebefugnis-Vorstufe)
- `references/gesetze/PAngV/` — typischer Anker für Sale-Klagen
- `references/gesetze/TDDDG/` — typischer Anker für Cookie-Klagen
- `references/audit-patterns.md` Phase 6 — Compliance-Doku zur Verteidigung

## Verteidigungs-Pfad bei VDuG-Klage

1. **Prüfung Klagebefugnis** der klagebefugten Stelle (Eintrag UKlaG-Register?)
2. **Prüfung Anmelde-Schwelle** (50 betroffene Verbraucher mindestens)
3. **Inhaltliche Verteidigung** zum behaupteten Verstoß
4. **Vergleichs-Verhandlungen** vor mündlicher Verhandlung (kosten-effizienter)
5. **Veröffentlichungs-Klausel** im Vergleich begrenzen (Reputations-Schutz)

## Praktischer Audit-Checklist

- [ ] AGB-Klauseln OLG-/BGH-konform (Cross-Ref §§ 305-310 BGB)
- [ ] Cookie-Banner DSGVO + TDDDG-konform
- [ ] Streichpreis-Logik PAngV-konform (30-Tage-Min)
- [ ] Auto-Renewal-Logik § 312k BGB-konform (Kündigungs-Button)
- [ ] Tarif-Anpassungs-Klauseln transparent + transparency-rechtlich abgesichert
- [ ] Verbandsklagen-Register-Watch (gh-Action / regelmäßige BfJ-Abfrage) für eigene Brand-Namen
