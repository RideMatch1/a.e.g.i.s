# Anhang E2 — Standardvertragsklauseln (SCC) Modul 3 — Processor → Sub-Processor

**Version**: v1.0 (2026-05-05)
**Rechtsgrundlage**: Durchführungsbeschluss (EU) 2021/914 der Kommission vom 4. Juni 2021.
**Anwendungsfall**: Der Datenexporteur ist Auftragsverarbeiter (Processor) im EU/EWR; der Datenimporteur ist Sub-Auftragsverarbeiter (Sub-Processor) in einem Drittland ohne Angemessenheitsbeschluss. Die Übermittlung erfolgt mit Genehmigung des ursprünglichen Verantwortlichen (Controller) gemäß Art. 28 Abs. 4 DSGVO.
**Disclaimer**: Keine Rechtsberatung im Sinne § 2 RDG. Vor Verwendung anwaltliche Prüfung empfohlen.

---

## Hinweis zur Verwendung

Modul 3 ist anwendbar, wenn der Datenexporteur selbst nur Auftragsverarbeiter ist (z. B. Hosting-Provider, der einen CDN- oder Email-Sub-Auftragsverarbeiter in einem Drittland einsetzt). Das Modul stellt sicher, dass die Pflichten des ursprünglichen Verantwortlichen entlang der Verarbeitungskette weitergegeben werden.

**Schlüssel-Unterschiede zu Modul 2**:

- Klausel 8.1 (Anweisungen) — Anweisungen werden vom Verantwortlichen über den Datenexporteur weitergegeben.
- Klausel 8.5 (Speicherbegrenzung) — Löschung/Rückgabe richtet sich nach Anweisungen des Verantwortlichen.
- Klausel 8.9 (Dokumentation und Compliance) — Audit-Rechte des Verantwortlichen werden dem Sub-Auftragsverarbeiter ausdrücklich zugesprochen.
- Klausel 9 (Sub-Auftragsverarbeiter weiter unten in der Kette) — analoge Genehmigungspflichten, Anzeige beim Verantwortlichen.
- Klausel 10–11 (Rechte der betroffenen Personen / Rechtsbehelfe) — Drittbegünstigtenrechte gegenüber Sub-Auftragsverarbeiter.

**Vollständiges Klauselwerk**: https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj — die Klauseln sind wortwörtlich zu übernehmen.

---

## Annex I — Liste der Parteien, Beschreibung der Übermittlung, Zuständige Aufsichtsbehörde

### A. Liste der Parteien

**Datenexporteur (Auftragsverarbeiter — Processor)**:

| Feld | Angabe |
|------|--------|
| Name | <Auftragsverarbeiter — Firma> |
| Anschrift | <…> |
| Kontaktperson Name, Funktion | <Name, Funktion> |
| Kontakt Email & Telefon | <…> |
| Tätigkeiten relevant für die Daten-Übermittlung | <Beschreibung der eigenen Verarbeitung im Auftrag des Verantwortlichen> |
| Unterschrift & Datum | <s. Vertrag mit Sub-Auftragsverarbeiter> |
| Rolle | Processor (im Verhältnis zum Verantwortlichen) |

**Datenimporteur (Sub-Auftragsverarbeiter — Sub-Processor)**:

| Feld | Angabe |
|------|--------|
| Name | <Sub-Auftragsverarbeiter — Firma> |
| Anschrift | <…> |
| Kontaktperson Name, Funktion | <Name, Funktion> |
| Kontakt Email & Telefon | <…> |
| Tätigkeiten relevant für die Daten-Übermittlung | <Beschreibung der Sub-Verarbeitung — z. B. CDN, E-Mail-Versand, Bilderkennung-API> |
| Unterschrift & Datum | <…> |
| Rolle | Sub-Processor |

**Ursprünglicher Verantwortlicher (Controller — informativ)**:

| Feld | Angabe |
|------|--------|
| Name | <Controller — Firma; Endkunde des Datenexporteurs> |
| Anschrift | <…> |
| Verweis auf Hauptvertrag | <AVV zwischen Controller und Processor — Datum> |

> *Der Controller ist nicht Vertragspartei der Modul-3-SCC, ihm stehen jedoch Drittbegünstigtenrechte nach Klausel 3 zu.*

### B. Beschreibung der Übermittlung

| Feld | Angabe |
|------|--------|
| Kategorien betroffener Personen | <…> |
| Kategorien personenbezogener Daten | <…> |
| Sensible Daten (Art. 9/10 DSGVO) | <…> |
| Häufigkeit der Übermittlung | <…> |
| Art der Verarbeitung | <…> |
| Zweck(e) der Übermittlung | <z. B. Bereitstellung Subdienstleistung — CDN-Caching, Email-Delivery, Push-Notifications> |
| Speicherdauer | <…> |
| Bei weiteren Sub-Sub-Auftragsverarbeitern: Beschreibung | <… / nicht zutreffend> |

### C. Zuständige Aufsichtsbehörde

> Maßgebliche Aufsichtsbehörde nach Art. 51 DSGVO ist die Datenschutzaufsichtsbehörde des Mitgliedstaats, in dem der **ursprüngliche Verantwortliche (Controller)** niedergelassen ist.
>
> **Zuständige Aufsichtsbehörde**: <z. B. BayLDA, Promenade 18, 91522 Ansbach, https://www.lda.bayern.de>
>
> Anschrift: <…>
> Web: <…>

---

## Annex II — Technische und organisatorische Maßnahmen (TOMs)

> **Verweis**: Vollständiger TOM-Katalog in `AVV-anhang-TOMs.md`. Die TOMs des Sub-Auftragsverarbeiters müssen mindestens das Niveau der TOMs zwischen Controller und Processor erreichen.

| Kategorie | Mindest-Maßnahmen Sub-Auftragsverarbeiter |
|-----------|-------------------------------------------|
| 1. Pseudonymisierung & Verschlüsselung | TLS ≥ 1.2; AES-256 at rest |
| 2. Vertraulichkeit | RBAC + MFA, mandantenfähige Trennung |
| 3. Integrität | Signierte API-Calls, Audit-Logs ≥ 90 Tage |
| 4. Verfügbarkeit | ≥ 99,9 % SLA |
| 5. Wiederherstellbarkeit | RPO ≤ 24h, RTO ≤ 4h |
| 6. Regelmäßige Überprüfung | ISO 27001 oder SOC 2 Type II zertifiziert |
| 7. Anpassung der Maßnahmen | Jährliches Review + Change-Management |

---

## Annex III — Liste der weiteren Sub-Auftragsverarbeiter (Sub-Sub-Processor-Chain)

Falls der Sub-Auftragsverarbeiter selbst weitere Sub-Auftragsverarbeiter einsetzt, sind diese hier zu listen — mit Genehmigung über die gesamte Vertragskette zurück zum Verantwortlichen.

| Nr. | Name | Anschrift | Beschreibung der Verarbeitung | Standort | Genehmigung erteilt am |
|-----|------|-----------|------------------------------|----------|------------------------|
| 1 | <…> | <…> | <…> | <…> | <Datum> |

---

## Konfigurations-Hinweise (Modul 3 spezifisch)

**Klausel 8.1 (Anweisungen)**:
- Anweisungen werden vom Datenexporteur (Processor) weitergegeben — Beruhend auf Anweisungen des ursprünglichen Verantwortlichen.
- Der Sub-Auftragsverarbeiter darf direkte Weisungen des ursprünglichen Verantwortlichen nur entgegennehmen, wenn der Datenexporteur dem zustimmt.

**Klausel 8.9 (Audit)**:
- Audits können sowohl vom Datenexporteur (Processor) als auch — über den Datenexporteur — vom ursprünglichen Verantwortlichen durchgeführt werden.
- Die Sub-Sub-Auftragsverarbeiter-Kette muss audit-zugänglich sein.

**Klausel 9 (weitere Sub-Auftragsverarbeiter)**:
- Hinzuziehung erfordert vorherige Genehmigung des Datenexporteurs UND — durch Weitergabe — des ursprünglichen Verantwortlichen.
- Vorlauffrist und Widerspruchsrecht entsprechend AVV zwischen Controller und Processor.

**Klausel 16 (Beendigung)**:
- Bei Verstoß durch den Sub-Auftragsverarbeiter kann der Datenexporteur die Übermittlung aussetzen.
- Der ursprüngliche Verantwortliche kann den Datenexporteur auffordern, die Übermittlung auszusetzen.

---

## Transfer Impact Assessment (TIA) — Pflicht

TIA für jeden Sub-Auftragsverarbeiter mit Drittlandbezug separat erforderlich. Insbesondere zu prüfen:

- Aggregations-Risiko: führt die Sub-Verarbeitung zu zusätzlicher Drittlandsexposition über die ursprüngliche Übermittlung hinaus?
- Gerichtsbarkeits-Kollision: unterliegt der Sub-Auftragsverarbeiter zusätzlichen Drittland-Überwachungsgesetzen?
- Supplementary Measures: BYOK / Schlüsseltrennung / Pseudonymisierung an der Schnittstelle Processor → Sub-Processor.

---

**Unterzeichnung**: erfolgt im Rahmen des Vertrags zwischen Datenexporteur (Auftragsverarbeiter) und Datenimporteur (Sub-Auftragsverarbeiter). Der ursprüngliche Verantwortliche erhält Kopie zur Akte.
