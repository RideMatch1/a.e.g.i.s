# Anhang D — Audit-Klausel-Varianten

**Version**: v1.0 (2026-05-05)
**Rechtsgrundlage**: Art. 28 Abs. 3 lit. h DSGVO; § 8 AVV (siehe `AVV-standard-DE.md`).
**Anwendungsfall**: Anhang D des AVV; eine der drei Varianten ist zu wählen — abhängig von Risiko, Vendor-Maturität und Verantwortlichen-Ressourcen.
**Disclaimer**: Keine Rechtsberatung im Sinne § 2 RDG. Audit-Rechte sind unabdingbarer DSGVO-Pflichtbestandteil; Verzicht oder pauschale Verweigerung durch den Auftragsverarbeiter ist unwirksam.

---

## Übersicht — Wann welche Variante?

| Variante | Geeignet für | Risiko-Profil | Aufwand Verantwortlicher |
|----------|--------------|---------------|--------------------------|
| **A. Vor-Ort-Audit** | Hochrisiko-Verarbeitung; sensible Daten Art. 9/10; Großmengen-Verarbeitung; spezifische Bedenken | hoch | hoch (Reise + Auditor + Zeit) |
| **B. Remote-Audit** | Standard-SaaS; mittleres Risiko; etablierte Vendoren ohne aktive Vorfälle | mittel | mittel |
| **C. SOC-2- / ISO-27001-Stellvertreter-Audit** | Cloud-Hyperscaler (AWS, GCP, Azure); zertifizierte Großvendoren mit gut etabliertem Trust-Center | niedrig–mittel | niedrig |

**Praxis-Empfehlung**: Hybrid — Variante C als Default, Variante B bei begründetem Verdacht, Variante A nur bei Vorfall oder substanziellem Risiko.

---

## Variante A — Vor-Ort-Audit

**Klausel-Wortlaut**:

> Der Verantwortliche hat das Recht, durch von ihm selbst oder durch einen von ihm beauftragten qualifizierten Dritten (z. B. Wirtschaftsprüfer, IT-Sicherheits-Auditor, akkreditierter Datenschutz-Auditor) **Vor-Ort-Audits** an den Verarbeitungs-Standorten des Auftragsverarbeiters durchzuführen.
>
> 1. **Häufigkeit**: einmal jährlich; anlassbezogen darüber hinaus bei (a) begründetem Verdacht eines DSGVO-Verstoßes, (b) Datenschutzvorfall mit Bezug zur Verarbeitung, (c) Aufsichtsbehörden-Anordnung.
> 2. **Vorlauffrist**: mindestens **14 Kalendertage** in Textform; bei Anlassfällen mindestens **48 Stunden**.
> 3. **Umfang**: Einsicht in TOMs-Implementierung, Audit-Logs, Sub-Auftragsverarbeiter-Verträge, Datenschutz-Schulungs-Nachweise, Backup-Restore-Tests, Berechtigungs-Reviews — soweit für die im Auftrag erfolgende Verarbeitung relevant.
> 4. **Auditor-Qualifikation**: Auditor verpflichtet sich auf Vertraulichkeit (NDA); fachliche Qualifikation durch Zertifizierung (CISA, CIPP/E, Datenschutzbeauftragten-Zertifikat o. ä.) nachgewiesen.
> 5. **Mitwirkungspflicht**: Auftragsverarbeiter stellt zumutbare Räumlichkeiten + Zugang zu Mitarbeitern + Systemen bereit.
> 6. **Beschränkungen**: Audit darf den Geschäftsbetrieb nicht unverhältnismäßig beeinträchtigen; Einsicht in fremde Mandanten-Daten wird durch geeignete Maßnahmen ausgeschlossen (Mandanten-Trennung, anonymisierte Test-Daten).
> 7. **Kosten**: Jede Partei trägt eigene Kosten. Bei Feststellung wesentlicher Mängel trägt der Auftragsverarbeiter die angemessenen Auditor-Kosten zusätzlich.
> 8. **Bericht**: Auditor erstellt Bericht; Auftragsverarbeiter erhält Mängel-Liste mit Frist zur Behebung (i. d. R. 30 Kalendertage; bei kritischen Mängeln 7 Tage).

**Pros**:
- Tiefste Einsicht; nichts versteckt
- Direkte Kommunikation mit Operations-/Security-Team
- Höchste Glaubwürdigkeit für eigene Compliance-Dokumentation

**Cons**:
- Hoher logistischer Aufwand (Reise, Termin-Koordination, Auditor-Honorar)
- Operatives Risiko für Auftragsverarbeiter (Geschäftsstörung)
- Bei Cloud-Hyperscalern unrealistisch (RZ-Zugang nicht für Einzelkunden)

---

## Variante B — Remote-Audit

**Klausel-Wortlaut**:

> Der Verantwortliche hat das Recht, durch von ihm selbst oder durch einen von ihm beauftragten qualifizierten Dritten **Remote-Audits** durchzuführen — bestehend aus:
>
> a) Dokumentenprüfung (TOM-Beschreibung, Verfahrensverzeichnis Auftragsverarbeiter, Sub-Auftragsverarbeiter-Verträge, Audit-Log-Auszüge, Pen-Test-Berichte, Sicherheits-Zertifikate);
> b) System-Review per Screen-Sharing oder Remote-Inspection (Konfigurations-Walkthrough, Audit-Log-Demo, Berechtigungs-Matrix-Demo);
> c) Schriftlichem Fragenkatalog mit dokumentierter Beantwortung (z. B. CAIQ — Consensus Assessment Initiative Questionnaire der Cloud Security Alliance).
>
> 1. **Häufigkeit**: einmal jährlich + anlassbezogen.
> 2. **Vorlauffrist**: mindestens **10 Kalendertage** in Textform.
> 3. **Beantwortungsfrist** für Fragenkatalog: **30 Kalendertage**.
> 4. **Sample-Auditing**: Auditor wählt Stichproben (z. B. zufällige Berechtigungs-Reviews, Audit-Log-Auszüge eines Zeitfensters, Backup-Restore-Demo).
> 5. **Vertraulichkeit**: NDA für Auditor; geheime Geschäftsinformationen werden geschützt (Schwärzung, sample-only).
> 6. **Kosten** + **Bericht**: wie Variante A.
> 7. **Eskalations-Recht**: Bei begründetem Zweifel an der Belastbarkeit der Remote-Antworten kann der Verantwortliche auf Variante A (Vor-Ort) eskalieren.

**Pros**:
- Wesentlich geringerer logistischer Aufwand
- Weltweit durchführbar
- Geschäftsbetrieb beim Auftragsverarbeiter weniger gestört

**Cons**:
- Weniger Tiefe als Vor-Ort-Audit
- Manipulation von Demo-Antworten theoretisch möglich (durch Stichproben + Eskalations-Recht abgemildert)
- Erfordert mature Dokumentations-Lage beim Auftragsverarbeiter

---

## Variante C — SOC-2- / ISO-27001-Stellvertreter-Audit

**Klausel-Wortlaut**:

> Der Verantwortliche akzeptiert als Nachweis der Einhaltung der TOMs den **aktuellen, durch unabhängigen Drittprüfer erstellten Audit-Bericht** des Auftragsverarbeiters, sofern folgende Voraussetzungen erfüllt sind:
>
> 1. **Akzeptierte Standards**:
>    - SOC 2 Type II (AICPA, mindestens "Security" Trust Service Criterion; idealerweise zusätzlich "Confidentiality" + "Privacy"),
>    - ISO/IEC 27001:2022 (durch akkreditierte Zertifizierungsstelle),
>    - BSI IT-Grundschutz (für DE-Verantwortliche),
>    - branchenspezifische Standards (TISAX für Automotive, KRITIS-Audit für kritische Infrastrukturen, PCI-DSS Level 1 für Zahlungsdaten).
> 2. **Aktualität**: Bericht nicht älter als **12 Monate**.
> 3. **Scope-Match**: Audit-Scope umfasst die im Auftrag durchgeführten Verarbeitungs-Tätigkeiten + Standorte.
> 4. **Bridge-Letter**: bei Ablauf der Re-Zertifizierung schriftliche Bestätigung des Auftragsverarbeiters, dass keine wesentlichen Änderungen seit dem letzten Audit bestehen.
> 5. **Zugang**: Auftragsverarbeiter stellt Bericht (oder zumindest "Public Bericht" + auf Anforderung "Customer Bericht" unter NDA) binnen **5 Werktagen** bereit.
> 6. **Komplementäre Maßnahmen**: Bei Gap zwischen Audit-Scope und tatsächlicher Verarbeitung unterzieht sich Auftragsverarbeiter einer ergänzenden Variante-A- oder B-Prüfung für die Lücken.
> 7. **Eskalations-Recht**: Bei substantiellen Findings im Drittprüfer-Bericht oder bei Datenschutzvorfall kann Verantwortlicher auf Variante A oder B eskalieren — Drittprüfer-Bericht ersetzt dann nicht das Anlass-Audit.

**Pros**:
- Skalierbar — selbst Cloud-Hyperscaler akzeptierbar (AWS / GCP / Azure publizieren SOC 2 Type II)
- Geringster Aufwand für Verantwortlichen
- Drittprüfer-Glaubwürdigkeit höher als Selbst-Auskunft des Auftragsverarbeiters
- Industrie-Standard für SaaS-Vendor-Onboarding

**Cons**:
- Scope-Match nicht immer gegeben (Bericht oft generisch, nicht auftragsspezifisch)
- Keine direkte Tiefen-Einsicht in operatives Verhalten
- Bridge-Letter zwischen Re-Audits hat Vertrauens-Charakter
- Bei Datenschutzvorfall reicht ein zertifizierter Status nicht — Anlass-Audit (Variante A/B) bleibt erforderlich

---

## Hybrid-Modell — Empfehlung

**Empfohlene Default-Klausel** für Multi-Vendor-Setups:

> 1. **Standardfall**: Variante C — Drittprüfer-Bericht (jährlich aktualisiert).
> 2. **Bei begründetem Verdacht oder Datenschutzvorfall**: Eskalation auf Variante B (Remote-Audit) binnen 30 Tagen ab Anlass.
> 3. **Bei substanzieller Fortdauer der Bedenken oder bei kritischen Findings**: Eskalation auf Variante A (Vor-Ort-Audit).
> 4. **Bei sensiblen Daten Art. 9/10 DSGVO oder Großmengen-Verarbeitung**: jährliches Variante-B-Audit zusätzlich zum Drittprüfer-Bericht.

---

## Audit-Rechte gegenüber Sub-Auftragsverarbeitern

Der Auftragsverarbeiter hat **eigene Audit-Rechte** gegenüber seinen Sub-Auftragsverarbeitern (Art. 28 Abs. 4 DSGVO). Bei begründetem Audit-Anliegen des Verantwortlichen gegen einen Sub-Auftragsverarbeiter:

1. **Erstweg**: Auftragsverarbeiter führt Audit selbst durch + leitet Ergebnis weiter.
2. **Zweitweg (Step-In-Right)**: Verantwortlicher kann bei begründeter Eskalation eine direkte Audit-Vereinbarung mit Sub-Auftragsverarbeiter verlangen — entweder über Auftragsverarbeiter delegiert oder durch zusätzliche Vereinbarung.

---

## Audit-Dokumentation — Pflicht-Inhalte

Jedes Audit (egal welche Variante) endet mit einem schriftlichen Bericht mit Mindest-Inhalten:

- ☐ Audit-Datum + Auditor-Identität + Qualifikation
- ☐ Audit-Scope (welche Verarbeitungs-Tätigkeiten, welche Standorte)
- ☐ Audit-Methode (Vor-Ort / Remote / Drittprüfer-Bericht-Review)
- ☐ Stichproben + Ergebnisse
- ☐ Identifizierte Mängel mit Severity-Einstufung (Critical / High / Medium / Low)
- ☐ Frist zur Behebung pro Mangel
- ☐ Status-Updates bis Abschluss aller Maßnahmen
- ☐ Re-Audit-Datum (bei kritischen Mängeln nach Behebung)

---

## Versionierungs-Hinweis

> Audit-Klausel-Varianten werden im AVV durch ankreuzen / verweisen verbindlich gewählt. Wechsel der Variante während der Vertragslaufzeit erfordert beidseitige Zustimmung in Textform (Vertragsanpassung).
