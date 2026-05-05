---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: DiGAV Audit-Relevance — Health-App / DiGA-Listing-Compliance.
---

# DiGAV — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDER App, die:
- DiGA-Listing beim BfArM beantragt hat oder gelistet ist
- als „App auf Rezept" beworben wird
- per § 139e SGB V Erstattung sucht
- BSI-TR-03161-Zertifikat anstrebt

## Trigger im Code/UI

- **US-Cloud-Hosting** (AWS-US-East, Azure-US, GCP-US ohne EU-Region) → § 4 Datenschutz-Konflikt
- **AI-Provider ohne TIA** (OpenAI direct, Claude direct ohne EU-Region) → § 4 + DSGVO-Schrems-II-Risiko
- **MD5/SHA-1-Hashes** im Code → § 4a + BSI-TR-03161 fail
- **Plain-HTTP-Endpoints** im API-Layer → BSI-TR-03161 fail
- **Fehlendes 2FA-Optionen** für Patienten → BSI-TR-03161 fail
- **Werbe-Cookies / Marketing-Pixel** in App → § 4 (DiGA-Daten dürfen NICHT zu Werbung)
- **Fehlendes Datenexport-Feature** (FHIR/HL7) → § 5
- **AGB ohne klare Sprache** → § 6 + UWG § 5

## Verstoss-Klassen + Konsequenzen

| Verstoss | § | Konsequenz | Quelle |
|---|---|---|---|
| Datenschutz-Verstoß | § 4 | Streichung aus DiGA-Verzeichnis + DSGVO-Bußgeld bis 4% Umsatz | BfArM-Bekanntmachung + DSGVO Art. 83 |
| BSI-TR-03161-Fehler | § 4a | Ablehnung Antrag / Streichung Verzeichnis | DiGAV § 4a |
| Sicherheitsmangel ungemeldet | § 18 | Streichung Verzeichnis | DiGAV § 18 |
| Werbung mit DiGA-Daten | § 4 | Streichung Verzeichnis + BfArM-Bußgeld + DSGVO-Bußgeld | DiGAV + DSGVO |

DiGAV-direkte Bußgelder gibt es nicht — aber Streichung aus Verzeichnis = sofortiger Erstattungs-Stopp = wirtschaftlicher Existenz-Risiko.

## Top-Az. / Verwaltungs-Anker

- **BfArM-DiGA-Leitfaden** (https://www.bfarm.de/diga) — verbindliche Auslegung der DiGAV-Anforderungen
- **BSI TR-03161 v1.0+** — technische Sicherheitsrichtlinie (Pflicht ab 01.01.2025)
- **BfArM Tätigkeitsbericht 2023** — Streichungen wegen Datenschutz-Verstößen dokumentiert

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/MPDG/` für CE-Mark + MDR-Klassifizierung (Vorausetzung DiGA-Antrag)
- `references/gesetze/HWG/` für Werbung über DiGA (HWG voll anwendbar)
- `references/gesetze/BDSG/` für DSGVO-Umsetzung Health-Daten
- `references/dsgvo.md` Art. 9 (Health-Daten = besondere Kategorie)
- `references/audit-patterns.md` Phase 5h für Health-App-Audit-Surface

## Praktischer Audit-Checklist (Code + Infra)

- [ ] EU-only Hosting (Auftragsverarbeiter-Liste prüfen)
- [ ] TLS 1.3 + Cipher-Whitelist
- [ ] Keine MD5/SHA-1 in Crypto-Layer
- [ ] 2FA-Option für Patienten
- [ ] AVV mit allen Auftragsverarbeitern
- [ ] FHIR/HL7-Export-Endpoint
- [ ] Pen-Test-Bericht ≤ 12 Monate
- [ ] BSI-TR-03161-Zertifikat (ab 01.01.2025 Pflicht)
- [ ] DSE in deutscher Sprache + barrierefrei
- [ ] Keine Werbe-/Marketing-Cookies
- [ ] DSFA für Health-Daten-Verarbeitung (DSGVO Art. 35)
