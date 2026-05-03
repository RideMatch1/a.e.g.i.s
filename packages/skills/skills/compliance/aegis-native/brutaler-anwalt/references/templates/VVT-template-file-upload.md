# VVT-Template — Direct-File-Upload-Verarbeitung
> Vorlage fuer Verarbeitungstaetigkeit „Datei-Upload via Web-Form".
> Lege im internen Compliance-Vault als `vvt-direct-file-upload.md` ab.
> Aktualisiere bei jeder Erweiterung (neue Datei-Typen, neue Storage-Pfade, neue Auftragsverarbeiter).
>
> Disclaimer: Technisch-indikative Vorlage, keine Rechtsberatung i.S.d. § 2 RDG.
> Vor produktivem Einsatz von einem Fachanwalt fuer Datenschutzrecht oder
> einem zertifizierten Datenschutzbeauftragten pruefen lassen.

## Bezeichnung
Direct-File-Upload via [Form-Name, z.B. „Konfigurator", „Onboarding-Wizard"]

## Verantwortlicher
[Vor- und Nachname, Adresse, Email]
[ggf. interner Datenschutzbeauftragter — falls Pflicht]

## Zweck der Verarbeitung
[Konkret z.B.: Erfassung von Brand-Assets (Logos, Bilder) fuer Webdesign-
Briefing-Erstellung im Rahmen der Vertragsanbahnung]

## Datenkategorien
- Datei-Bytes (Bilder, Logos, PDFs)
- Metadata: Dateiname, Groesse, MIME-Type
- Indirekte PII: ggf. in Bild-Inhalten (Personenfotos, Unterschriften, Logos mit
  Personenbezug) — siehe Art. 9-Bewertung unten

## Art. 9 DSGVO Spezial-Kategorien Bewertung
- [ ] Personenfotos potentiell biometrische Daten?
  - Wenn nicht zur **eindeutigen Identifikation** verarbeitet → KEINE Art. 9
  - Wenn ja (z.B. Gesichtserkennung, Vergleichs-Hash) → Art. 9-Pflichten
- [ ] Unterschriften = biometrische Daten? → ja, falls zur Identifikation; ansonsten
  regulaere PII

## Empfaenger / Kategorien von Empfaengern
- Operator selbst (intern)
- SMTP-Auftragsverarbeiter (z.B. All-Inkl, Mailgun, Postmark) — siehe AVV-Liste
- ggf. Object-Storage-Anbieter (z.B. Hetzner Object Storage) — siehe AVV-Liste
- ggf. Mail-Forwarding-Empfaenger (z.B. externe Berater) — siehe interne Empfaenger-Liste

## Drittland-Status
- [ ] Auftragsverarbeiter alle in EU/EWR? → JA / NEIN
- Wenn NEIN: SCCs + TIA pro Drittland-Empfaenger

## Speicherdauer
- [Konkret z.B.: 180 Tage ab Submit, danach automatische rekursive Loeschung
  via Cron-Job <Pfad-zur-API-oder-Skript>]
- Bei Vertragsschluss: Aufbewahrungsfristen § 257 HGB (6 J Geschaeftsbriefe) +
  § 147 AO (10 J Buchungsbelege) gelten

## Rechtsgrundlage
- [Konkret z.B.: Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) + lit. f
  (berechtigtes Interesse — Briefing-Vollstaendigkeit)]
- Wenn KI-Auswertung der Bilder: zusaetzlich Art. 22 DSGVO pruefen

## TOMs (Technische und organisatorische Massnahmen) — Art. 32 DSGVO

### Eingangs-Filter (Server-side)
- [ ] MIME-Whitelist [konkret listen z.B.: image/png, image/jpeg, image/webp,
      image/svg+xml, application/pdf]
- [ ] Magic-Bytes-Check zusaetzlich
- [ ] Size-Cap pro Datei [konkret z.B.: 10 MB]
- [ ] Total-Cap pro Submission [konkret z.B.: 15 MB]
- [ ] Path-Traversal-Schutz (basename + char-whitelist + UUID-Praefix)

### Speicherung
- [ ] Storage-Pfad: [konkret z.B.: /var/data/inquiries/<id>/uploads/]
- [ ] Container/VPS-Setup: [konkret z.B.: Hetzner-VPS Falkenstein, Disk-
      Verschluesselung gem. Server-Setup]
- [ ] Bucket-side AES-256 (fuer Object Storage)
- [ ] LUKS at-rest (fuer VPS-Disk) — falls aktiv

### Uebertragung
- [ ] TLS 1.3 in transit (HTTPS)
- [ ] STARTTLS fuer SMTP-Versand (Port 587 + secure=false)
- [ ] MTA-STS-Empfaenger-Check (falls aktiviert)

### Loeschung
- [ ] Automatisierter Cleanup-Cron [konkret: Pfad-zur-API + Cron-Schedule]
- [ ] Recursive-Delete inkl. uploads/-Subfolder
- [ ] Manueller Loeschpfad: [konkret z.B.: Email an datenschutz@... → manuell
      aus Inquiries-Folder entfernen]

### Logging
- [ ] Filename in Logs als SHA-256-Hash (nicht raw)
- [ ] Log-Retention max [konkret: 30 Tage]
- [ ] Datei-Bytes NIE in Logs

### Disk-Resilienz
- [ ] `fs.statfs`-Check vor write
- [ ] Per-IP-Tagesbudget (falls aktiviert)
- [ ] Disk-Monitoring + Operator-Alert bei < 1 GB free

## Bezug zu anderen VVT-Eintraegen
- [Verweis auf VVT fuer Briefing-Daten allgemein]
- [Verweis auf VVT fuer Email-Versand]

## Letzte Aktualisierung
[Datum, Editor, Anlass]
