---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: GeschGehG Audit-Relevance — Trade-Secret-Schutz, NDA, Mitarbeiter-Compliance.
---

# GeschGehG — Audit-Relevance

## Auto-Loading-Trigger

Bei Operatoren mit:
- proprietärem Code / Algorithmen / KI-Modellen
- Kunden-/Vendor-Listen
- Pricing-Logik / Margen-Modellen
- Trainings-Daten / Curated-Datasets
- internen Prozessen / Workflows
- Forschungs-/Entwicklungs-Output
- Custom-Konfigurationen / Architecture-Diagramms

## Trigger im Code/UI / Doku

- **Code-Repo public** ohne RE-Klausel-EULA → § 3 Abs. 1 Nr. 2 erlaubt RE
- **Mitarbeiter ohne NDA + Vertraulichkeits-Klausel** → § 2 Nr. 1 b) „angemessene Maßnahmen" fragwürdig
- **Vertraulichkeits-Klassifizierung fehlt** im Confluence/Notion → § 2 Nr. 1 b) Beweis-Risiko
- **Public-S3-Bucket mit internen Doku** → § 4 Abs. 1 Nr. 1 erlaubt für Dritte
- **Ehemaliger Mitarbeiter zur Konkurrenz** ohne Wettbewerbsverbot → § 4 Abs. 3
- **Open-Source-Veröffentlichung interner Tools** ohne Lizenz-Strategie → Geheimnis verloren
- **Customer-List in CSV-Export für Vertrieb** ohne Tracking → § 4 Abs. 3-Risiko bei Mitarbeiter-Wechsel

## Verstoss-Klassen + Konsequenz

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Unrechtmäßige Erlangung | § 4 + § 6-10 | Beseitigung, Unterlassung, Schadensersatz (Lizenzanalogie) | § 6-10 GeschGehG |
| Nutzung durch Mitarbeiter post-Wechsel | § 4 Abs. 3 + § 10 | Schadensersatz (oft 5-7-stellig) | § 10 GeschGehG |
| Strafvorschrift einfach | § 23 Abs. 1 | Freiheitsstrafe bis 3 Jahre / Geldstrafe | § 23 GeschGehG |
| Strafvorschrift schwer | § 23 Abs. 2 | bis 5 Jahre | § 23 GeschGehG |
| RE-Verbot vertraglich | § 3 + Vertrag | Vertragsstrafe + Unterlassung | individuell |

## Top-Az.

- **OLG Düsseldorf I-15 U 6/22** — „angemessene Geheimhaltungsmaßnahmen" konkretisiert
- **OLG Düsseldorf I-15 U 12/19** — IT-Sicherheits-Mindeststandard für Trade-Secret
- **BGH I ZR 17/22** — Mitarbeiter-Wechsel + Customer-List als Geschäftsgeheimnis
- **BGH 5 StR 401/20** — Strafrecht § 23 Anforderungen
- **EuGH C-145/22** — Trade-Secret-RL Auslegung „angemessene Schritte"

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/UrhG-UrhDaG/` für Code als Werk-Schutz
- `references/gesetze/StGB/` § 202a-c (Computer-Spionage / unbefugter Zugang)
- `references/gesetze/HinSchG/` § 5 GeschGehG-Whistleblower-Schranke
- `references/dsgvo.md` Art. 32 (Vertraulichkeits-TOM analog)
- `references/audit-patterns.md` Phase 4 (Zugriffs-/Auth-Surface)

## „Angemessene Geheimhaltungsmaßnahmen" — Mindest-Audit-Pfad

Operator muss vorhalten + dokumentieren:

### Organisatorisch
- [ ] NDA mit Mitarbeitern (allgemein + projektbezogen)
- [ ] Wettbewerbsverbot post-Vertragsende für Schlüssel-Personal
- [ ] Vertraulichkeits-Klassifizierung (Public / Internal / Confidential / Strictly Confidential)
- [ ] Need-to-Know-Prinzip in Zugriffsrechten
- [ ] Schulung jährlich (Phishing-Awareness + Trade-Secret-Sensibilisierung)
- [ ] Off-Boarding-Prozess (Zugang sofort revoke + Asset-Rückgabe + Erinnerung Vertraulichkeit)

### Technisch
- [ ] Zugriffs-Kontrolle (RBAC + ggf. Just-in-Time)
- [ ] Verschlüsselung at-rest + in-transit
- [ ] DLP (Data-Loss-Prevention) für sensitive Doku
- [ ] Audit-Log + Anomaly-Detection für Mass-Downloads
- [ ] Repo-Access-Reviews quartalsweise
- [ ] Customer-Lists mit Watermark / personalisierten Identifiern (forensisches Tracing)
- [ ] Endpoint-Security (MDM, USB-Restrictions, Print-Logs)

### Vertraglich
- [ ] AGB / EULA mit RE-Verbot
- [ ] Mit Vendoren AVV + zusätzliche Vertraulichkeits-Klausel
- [ ] Mit Beratern Werkvertragsklauseln zur Eigentums-Übertragung + Vertraulichkeit

## Praktischer Ablauf bei Verdacht ehemaliger MA → Konkurrenz

1. Forensische Sicherung der relevanten Audit-Logs vor Termination
2. Cease-and-Desist-Brief mit § 4-Hinweis + § 23-Strafanzeige-Drohung
3. § 8-Auskunfts-Klage zur Aufdeckung Vertriebs-/Nutzungs-Wege
4. Einstweilige Verfügung wenn drohender Schaden absehbar
5. Strafanzeige bei besonders schweren Fällen (§ 23 Abs. 2)
6. Hauptklage auf Schadensersatz / Beseitigung
