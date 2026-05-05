---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: MPDG Audit-Relevance — Medizinprodukte / Software-as-Medical-Device.
---

# MPDG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites / Apps mit:
- Health-Tracking (Vital-Werte, EKG, Blutzucker, Schlaf-Apnoe etc.)
- Symptom-Checker / Diagnose-Tools
- Therapie-Apps / Coaching mit medizinischem Zweck
- Diabetes-/Asthma-Management
- DiGA (BfArM-gelistet oder im Antrag)
- Wearables mit Gesundheitsmessung
- AI-basierten medizinischen Diagnose-Outputs

## Trigger im Code/UI

- **„Symptom-Check" + Diagnose-Output** → Software-as-MedDevice, MDR Klasse IIa+ → CE-Mark Pflicht (§ 7)
- **Vital-Daten-Tracking + Empfehlung** („nehmen Sie Insulin XX") → Klasse IIb möglich → CE-Mark Pflicht
- **App-Store ohne CE-Mark + Diagnose-Funktion** → § 7 + § 92 Strafrisiko
- **Englische Gebrauchsanweisung für DE-Endkunden** → § 4 Sprach-Verstoß
- **Non-EU-Hersteller ohne Bevollmächtigten** → § 6
- **Fehlende UDI-Kennzeichnung** → MDR Art. 27 + § 94 OwiG

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Inverkehrbringen ohne CE-Mark | § 7 + § 92 Abs. 1 | Freiheitsstrafe bis 3 Jahre / Geldstrafe; bes. schwerer Fall bis 10 Jahre | § 92 MPDG |
| Klin. Prüfung ohne Genehmigung | §§ 14ff + § 92 | bis 3 Jahre | § 92 MPDG |
| Sprache / Kennzeichnung | § 4 + § 93 | bis 1 Jahr / Geldstrafe | § 93 MPDG |
| Formal-Pflichten OwiG | § 94 | bis 30.000 € (Standard) / bis 50.000 € | § 94 Abs. 5 MPDG |

## Top-Az.

- **EuGH C-329/16 SNITEM/Philips** (07.12.2017) — Software kann eigenständig Medizinprodukt sein, wenn medizinischer Zweck
- **OLG Frankfurt 6 U 175/18** — „Symptom-Checker" als Klasse-IIa-MedDevice eingestuft
- **BfArM-Bekanntmachung MDCG 2019-11** — Software-Klassifizierungs-Leitlinie (kein Az., aber zentrale Verwaltungs-Vorgabe)

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/HWG/` für Werbung über CE-MDP-Produkte (HWG seit 26.05.2021 erweitert)
- `references/gesetze/AMG/` für Abgrenzung Arzneimittel-vs-Medizinprodukt
- `references/gesetze/DiGAV/` für DiGA-spezifische Datenschutz-/Sicherheits-Vorgaben (BSI TR-03161)
- `references/gesetze/EU-Verordnungen/MDR-2017-745/` für direkt anwendbare EU-Norm
- `references/dsgvo.md` Art. 9 für Health-Daten-Verarbeitung

## Klassifizierungs-Hilfe (MDR Annex VIII Rule 11 — Software)

| Klasse | Bedingung | Beispiel |
|---|---|---|
| I | Software, die Daten speichert / archiviert ohne Diagnose | Patientenakte-App ohne Auswertung |
| IIa | Diagnose-/Therapie-Entscheidungen unterstützen | Symptom-Tracker mit Empfehlung |
| IIb | Ernster Schaden bei Fehlentscheidung möglich | Insulin-Dosis-Berechnung |
| III | Tod oder schwere Verschlechterung möglich | Beatmungssteuerung, Strahlentherapie |

DiGA = typisch IIa (gelegentlich IIb).
