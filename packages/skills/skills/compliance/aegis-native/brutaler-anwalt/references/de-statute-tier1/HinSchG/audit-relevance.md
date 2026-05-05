---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: HinSchG Audit-Relevance — Whistleblower-Kanal-Pflicht, Vertraulichkeits-Tech-Stack.
---

# HinSchG — Audit-Relevance

## Auto-Loading-Trigger

Bei Operatoren mit:
- ≥ 50 MA in DE (Pflicht seit 17.12.2023)
- regulierter Branche (Finance, TK, Energie, etc. unabhängig MA-Anzahl)
- Tochter-/Zweigniederlassung-Sitz DE

## Trigger im Code/UI / Doku

- **Kein Hinweisgeberkanal** in Compliance-Doku → § 12 Abs. 1
- **Hinweisgeber-Form ohne anonyme Option** → § 16 (Best-Practice fehlt)
- **Identitäts-leak: HR sieht Hinweisgeber-Name** → § 13 Verletzung
- **E-Mail-Versand ohne Verschlüsselung** → § 13 (technisch) + DSGVO Art. 32
- **Aufbewahrung > Notwendigkeitsdauer** → § 18 + DSGVO-Datenminimierung
- **Bestätigung > 7 Tage / Folge-Mitteilung > 3 Monate** → § 17

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Meldestelle nicht eingerichtet | § 12 + § 40 | bis 20.000 € | § 40 Abs. 2 HinSchG |
| Behinderung Meldung | § 40 Nr. 2 | bis 20.000 € | § 40 Abs. 2 HinSchG |
| Vertraulichkeits-Verstoß | § 13 + § 40 | bis 20.000 € | § 40 Abs. 2 HinSchG |
| Repressalie | § 33 + § 40 | bis 50.000 € + Schadensersatz | § 40 Abs. 2 + § 37 HinSchG |
| Falschmeldung wissentlich | § 40 Nr. 5 | bis 20.000 € | § 40 Abs. 2 HinSchG |

**Hauptrisiko**: § 36 Beweislastumkehr — bei berufl. Nachteil für Hinweisgeber = vermutete Repressalie. Schadensersatz-Klagen können sechsstellig werden.

## Top-Az. + Behörden-Praxis

- **BfJ Tätigkeitsbericht 2024** (zentrale externe Meldestelle) — Statistik der bisherigen Verfahren
- **EuGH C-560/22** (Hinweisgeber-Schutz aus RL 2019/1937 — direkte Anwendbarkeit pre-Umsetzung)
- **OLG Frankfurt 6 W 41/22** — interne Meldestelle ohne Pflichtinhalt = unzureichend

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/AGG/` § 22 Beweislastumkehr (parallele Mechanik)
- `references/dsgvo.md` Art. 32 (Vertraulichkeits-Tech) + Art. 6 Abs. 1 lit. c (Rechtsgrundlage)
- `references/gesetze/BetrVG/` § 87 Abs. 1 Nr. 6 — Whistleblower-Tool ist mitbestimmungspflichtig
- `references/audit-patterns.md` Phase 5f (HR-Compliance) + Phase 6 (Doku)

## Tech-Stack-Compliance-Pfad

1. **Tool-Auswahl**: Anonyme Meldung + Verschlüsselung + Audit-Trail. Beispiele: EQS Compliance, Whistlelink, Hintbox, Convercent, Whistleblower-System d.R.
2. **§ 87 BetrVG**: Tool ist mitbestimmungspflichtig → BV erforderlich
3. **DSGVO Art. 32**: TLS 1.3, AES-256, Zugriffe getrennt (Meldestelle ≠ HR ≠ GL)
4. **DSGVO Art. 30**: Verzeichnis von Verarbeitungstätigkeiten ergänzen
5. **§ 17 HinSchG-Fristen**: 7 Tage Bestätigung + 3 Monate Folge-Mitteilung als SLA-Pflicht
6. **AVV mit Tool-Provider** (Auftragsverarbeitung)
7. **Mitarbeiter-Schulung jährlich** über Meldekanal-Existenz + Verfahren

## Praktischer Audit-Checklist

- [ ] Hinweisgeberkanal eingerichtet + dokumentiert (Hosting in EU)
- [ ] Anonyme Meldung möglich (technisch + organisatorisch)
- [ ] Verschlüsselte Übertragung (HTTPS + ggf. Email-Verschlüsselung)
- [ ] Zugriff: nur § 14-Meldestellen-Mitarbeiter (rollenbasiert)
- [ ] Mitarbeiter-Information über Kanal (Intranet-Link, Aushang)
- [ ] Schulung Meldestellen-Personal (Strafrechts-Grundlagen, GwG-Verdachtsmomente, DSGVO)
- [ ] § 17-Fristen in SLA-Tool gemonitort
- [ ] Repressalie-Schutz-Klausel in Mitarbeiter-Handbuch
- [ ] BV mit Betriebsrat über Tool-Einsatz (BetrVG § 87)
