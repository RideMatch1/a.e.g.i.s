---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/digav/
last-checked: 2026-05-05
purpose: DiGAV (Digitale-Gesundheitsanwendungen-Verordnung) — DE-spezifische Anforderungen für DiGA-Listung im BfArM-Verzeichnis (DVG-Erstattungsweg).
---

# DiGAV — Kern-Paragraphen

> Digitale-Gesundheitsanwendungen-Verordnung (DiGAV).
> Volltext: https://www.gesetze-im-internet.de/digav/
> Rechtsbasis: § 139e SGB V (DiGA-Listung); ergänzt MDR + MPDG.

## § 1 — Anwendungsbereich

**Wortlaut (Kern)**: DiGAV gilt für digitale Gesundheitsanwendungen (DiGA) niedriger Risikoklasse (MDR Klasse I oder IIa), die zur Aufnahme in das DiGA-Verzeichnis nach § 139e SGB V beantragt sind, sowie für deren Hersteller.

**Audit-Relevanz**: trigger nur, wenn DiGA-Listung beim BfArM angestrebt wird. Apps, die nicht Erstattungsweg gehen, brauchen DiGAV nicht — aber MDR/MPDG bleiben.

---

## § 3 — Anforderungen an Sicherheit, Funktionstauglichkeit, Qualität

**Wortlaut (Kern)**: DiGA müssen den allgemein anerkannten Stand der Technik einhalten — insb. zu IT-Sicherheit, Datenschutz, Robustheit, Verbraucherschutz, Nutzerfreundlichkeit, Unterstützung Leistungserbringer, Qualität der medizinischen Inhalte, Patientensicherheit.

**Audit-Relevanz**: trigger für Penetrationstests + ISO 27001-Maßnahmen + Krypto-Auditing.

---

## § 4 — Datenschutz

**Wortlaut (Kern)**: DiGA-Hersteller müssen DSGVO-Konformität nachweisen, insb.:
- Art. 5, 6, 9 DSGVO bei Health-Daten,
- Daten dürfen NICHT zu Werbe-/Marketing-Zwecken verwendet werden,
- Verarbeitung durch Auftragsverarbeiter nur in EU/EWR oder mit Angemessenheitsbeschluss (vor allem KEIN US-Cloud ohne TIA + DPF-Konformität),
- Nutzer-Einwilligung muss ausdrücklich + informiert sein.

**Audit-Relevanz**: HARTE Beschränkung — US-AI-Provider ohne DPF + TIA = DiGAV-Hindernis. Auch keine Werbung „auf der Basis von" DiGA-Daten.

---

## § 4a — Datensicherheit (Pflicht-Update seit 01.01.2025)

**Wortlaut (Kern)**: DiGA müssen ab 01.01.2025 ein Zertifikat nach **BSI TR-03161** vorweisen (Sicherheit für eHealth-Anwendungen). Vorab-Anforderungen: Penetrationstest + Schwachstellen-Management.

**Audit-Relevanz**: härtester technischer Nachweis. BSI-TR-03161 verlangt: TLS 1.3, sichere Authentifizierung (FIDO2/Smart-Cards), Crypto-Hygiene (keine SHA-1, MD5), regelmäßige Audits.

---

## § 5 — Interoperabilität

**Wortlaut (Kern)**: DiGA müssen anerkannte Schnittstellen + Standards (FHIR, IHE-Profile) unterstützen für:
- Datenexport durch Versicherten (in standardisiertem Format),
- Anbindung an ePA (elektronische Patientenakte) wenn relevant,
- Schnittstellen zu zugelassenen Medizingeräten / Wearables.

**Audit-Relevanz**: trigger für FHIR-/HL7-Konformität + Datenexport-Funktion in App.

---

## § 6 — Verbraucherschutz

**Wortlaut (Kern)**: DiGA müssen verbraucherfreundliche Schnittstellen + verständliche Sprache + transparente Werbe-Hinweise + faire Vertragsbedingungen.

**Audit-Relevanz**: AGB-Prüfung + Werbe-Hinweise (Cross-Ref HWG § 11 für Testimonials).

---

## §§ 8–13 — Nachweise positiver Versorgungseffekte

**Wortlaut (Kern)**: Antragsteller muss positive Versorgungseffekte nachweisen über vergleichende Studie (RCT bevorzugt). Bei vorläufiger Aufnahme (12 Monate erstreckbar) reichen plausible Hinweise; in Erprobungsphase Studie bis BfArM-Entscheidung.

**Audit-Relevanz**: nicht primär Audit-Surface — relevant für DiGA-Antragstellung-Compliance.

---

## §§ 14–17 — Antrags- und Verzeichnis-Verfahren

**Wortlaut (Kern)**: BfArM prüft DiGA-Aufnahme-Antrag innerhalb 3 Monaten. Hersteller setzt Preis im 1. Jahr selbst; danach Verhandlung mit GKV-Spitzenverband. Listung im DiGA-Verzeichnis macht App erstattungsfähig (Verschreibung durch Arzt → Krankenkasse zahlt).

---

## § 18 — Pflichten zur Aktualität

**Wortlaut (Kern)**: Hersteller muss BfArM unverzüglich melden bei: Sicherheitsproblemen, Update-Versionen mit veränderter Funktion, Auftragsverarbeiter-Wechseln, Hosting-Standort-Änderung.

**Audit-Relevanz**: Change-Management-Pflicht. Bei US-Migration ohne BfArM-Notification → DiGAV-Verstoß → Risiko Streichung aus Verzeichnis.

---

## Anlage 1 — Detaillierte Anforderungs-Liste

**Wortlaut (Kern)**: Anlage 1 listet 70+ Pflicht-Anforderungen, u.a.:
- Crypto: TLS 1.2+ (TLS 1.3 empfohlen), keine MD5/SHA-1,
- Authentifizierung: 2FA für Patient möglich, mind. Passwort + Sicherung,
- Logging: nachvollziehbare Audit-Logs,
- Backup-Konzept,
- Notfall-Kommunikations-Plan bei Datenpanne,
- Penetrationstest mind. jährlich.

**Audit-Relevanz**: Goldstandard-Checkliste — übertragbar auch auf nicht-DiGA-Health-Apps als Best-Practice.
