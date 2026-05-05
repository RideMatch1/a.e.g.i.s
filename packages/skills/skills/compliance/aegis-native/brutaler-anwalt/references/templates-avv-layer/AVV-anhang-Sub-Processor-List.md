# Anhang C — Sub-Auftragsverarbeiter-Liste (Versioniertes Template)

**Version**: v1.0 (2026-05-05)
**Rechtsgrundlage**: Art. 28 Abs. 2, 4 DSGVO; § 6 AVV (siehe `AVV-standard-DE.md`).
**Anwendungsfall**: Anhang C des AVV; zugleich Annex III der EU SCC 2021/914 Module 2 / 3.
**Disclaimer**: Keine Rechtsberatung im Sinne § 2 RDG. Diese Liste ist Vertragsbestandteil und muss bei jeder Änderung dem Verantwortlichen mit Vorlauffrist angekündigt werden (§ 6.2 AVV).

---

## Versionierung

| Version | Datum | Autor | Änderung | Genehmigt durch Verantwortlichen am |
|---------|-------|-------|----------|-------------------------------------|
| v1.0 | <YYYY-MM-DD> | <Name> | Initialfassung | <Datum / N/A bei Erst-Genehmigung> |
| v1.1 | <YYYY-MM-DD> | <Name> | Hinzufügen Sub-Processor X (CDN-Wechsel) | <Datum> |
| v1.2 | <YYYY-MM-DD> | <Name> | Entfernung Sub-Processor Y (Vertrag beendet) | <Datum> |

**Aktuelle Version**: v<X.Y> vom <Datum>
**Nächste planmäßige Aktualisierung**: <Datum / "auf Änderungs-Anlass">
**Veröffentlichungsort**: <interner Pfad / Vendor-Portal / Email an `dsb@<verantwortlicher>.de`>

---

## Aktive Sub-Auftragsverarbeiter

| Nr. | Name | Adresse / Land | Kontakt (DPO/email) | Verarbeitungs-Tätigkeit | Datenkategorien | Standort der Verarbeitung | Drittland-Garantie | Beauftragt seit | Genehmigt durch Verantwortlichen am |
|-----|------|----------------|---------------------|-------------------------|-----------------|---------------------------|---------------------|-----------------|-------------------------------------|
| 1 | <z. B. Amazon Web Services EMEA SARL> | <38 Avenue John F. Kennedy, L-1855 Luxembourg> | <aws-EU-privacy@amazon.com> | Cloud-Hosting (EC2, RDS, S3, IAM) | Stammdaten, Vertragsdaten, Nutzungsdaten, Backup-Daten | EU (Frankfurt eu-central-1) | EU (kein Drittland) | <YYYY-MM-DD> | <YYYY-MM-DD> |
| 2 | <z. B. Cloudflare, Inc.> | <101 Townsend Street, San Francisco, CA 94107, USA> | <dpo@cloudflare.com> | CDN, DNS, DDoS-Schutz, WAF | IP-Adressen, Request-Metadaten, optional TLS-terminierte Inhalte | USA + globale Edge | EU SCC 2021/914 Modul 3 + DPF Zertifizierung | <YYYY-MM-DD> | <YYYY-MM-DD> |
| 3 | <z. B. Stripe Payments Europe Ltd> | <The One Building, 1 Grand Canal Street Lower, Dublin 2, Ireland> | <privacy@stripe.com> | Payment-Verarbeitung | Zahlungsdaten (über Stripe Elements; PSP eigenverantwortlich) | EU + USA | EU SCC + DPF + PCI-DSS | <YYYY-MM-DD> | <YYYY-MM-DD> |
| 4 | <z. B. Sendgrid (Twilio Inc.)> | <889 Winslow Street, Redwood City, CA 94063, USA> | <privacy@twilio.com> | E-Mail-Versand (Transactional Mail) | Email-Adressen, Mail-Inhalte | USA | EU SCC + DPF | <YYYY-MM-DD> | <YYYY-MM-DD> |
| 5 | <…> | <…> | <…> | <…> | <…> | <…> | <…> | <…> | <…> |

---

## Beendete Sub-Auftragsverarbeiter (Archiv — letzte 24 Monate)

> Pflicht zur Dokumentation aufgrund Audit-Trail; nach 24 Monaten archivierbar.

| Nr. | Name | Beauftragt von – bis | Grund der Beendigung | Datenrückgabe / Löschung erfolgt am | Lösch-Zertifikat |
|-----|------|----------------------|---------------------|-------------------------------------|------------------|
| 1 | <Sub-Processor Z> | <YYYY-MM-DD> – <YYYY-MM-DD> | <Vertragsablauf / Vendor-Wechsel / Compliance-Mangel> | <YYYY-MM-DD> | <Anhang Z im Audit-Ordner> |

---

## Pending — Avisierte Sub-Auftragsverarbeiter (in Genehmigungs-Verfahren)

> Bei laufendem 30-Tages-Vorlauf (§ 6.2 AVV) hier abbilden.

| Nr. | Name | Adresse | Verarbeitungs-Tätigkeit | Geplanter Start | Mitteilung an Verantwortlichen am | Widerspruchsfrist endet | Status |
|-----|------|---------|-------------------------|-----------------|----------------------------------|------------------------|--------|
| 1 | <…> | <…> | <…> | <YYYY-MM-DD> | <YYYY-MM-DD> | <YYYY-MM-DD> | <pending / objected / approved> |

---

## Konzern-interne Dienstleister (informativ)

> Konzern-Privileg nach § 6.7 AVV: konzern-interne Dienstleister sind keine Sub-Auftragsverarbeiter im engeren Sinne; gleichwohl Transparenz-Pflicht.

| Nr. | Name | Konzern-Verhältnis | Tätigkeit | Standort |
|-----|------|--------------------|-----------|----------|
| 1 | <z. B. <Auftragsverarbeiter> Inc. (US-Mutter)> | 100 % Mutter | Tier-3-Support, On-Call | USA |
| 2 | <…> | <…> | <…> | <…> |

---

## Pflichtangaben pro Sub-Auftragsverarbeiter (Checkliste)

Bei jedem Listing sind folgende Angaben zwingend:

- ☐ Voller Firmenname inkl. Rechtsform
- ☐ Vollständige Anschrift (Sitz)
- ☐ Datenschutz-Kontakt (DPO oder Privacy-Email)
- ☐ Beschreibung der Verarbeitung (Tätigkeit + Datenkategorien)
- ☐ Standort der Verarbeitung (mind. Land + Region)
- ☐ Drittland-Garantie (Adäquanz / SCC / DPF / BCR / Ausnahme nach Art. 49)
- ☐ Vertragsbeginn-Datum
- ☐ TOM-Niveau bestätigt (mindestens äquivalent zu eigenem TOM-Katalog)
- ☐ Sicherheits-Zertifikate (ISO 27001 / SOC 2 / etc.) — Verweis oder PDF im Vendor-Ordner

---

## Genehmigungs-Workflow (Workflow-Hinweis)

1. **Avisierung** durch Auftragsverarbeiter an `dsb@<verantwortlicher>.de` — 30 Tage Vorlauf (§ 6.2 AVV).
2. **Prüfung** durch Verantwortlichen — Datenschutz-Due-Diligence:
   - TOM-Niveau-Vergleich
   - Drittland-Risiko-Bewertung (TIA bei Drittland)
   - Sub-Processor-Vertragsentwurf (Auftragsverarbeitung Art. 28 Abs. 4)
3. **Entscheidung** binnen 14 Tagen — Zustimmung / begründeter Widerspruch.
4. **Update** der Liste auf neue Version; alle Vertragsparteien erhalten Notification.
5. **Effektiv-Datum** frühestens 30 Tage nach Avisierung, sofern kein Widerspruch.

---

## Notification-Mechanismus (zu wählen)

> Wie kündigt der Auftragsverarbeiter Änderungen an? Mehrfach-Auswahl möglich.

- ☐ Email an `dsb@<verantwortlicher>.de`
- ☐ RSS-Feed / Atom-Feed mit Subscribe-URL: <…>
- ☐ Vendor-Portal mit Audit-Trail: <URL>
- ☐ Webhook-Notification an URL des Verantwortlichen: <…>
- ☐ Veröffentlichung auf öffentlicher Sub-Processor-Page: <URL> (zusätzlich Email-Notification)

---

**Verantwortlich für die Pflege dieser Liste**:

> <Datenschutzbeauftragter Auftragsverarbeiter — Name + Email>

**Audit-Recht**:

Der Verantwortliche kann jederzeit die aktuelle Liste anfordern + die Pflege-Prozesse auditieren (siehe § 8 AVV / Anhang D Audit-Klausel-Varianten).
