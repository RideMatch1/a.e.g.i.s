# Anhang B — Technische und Organisatorische Maßnahmen (TOM-Katalog)

**Version**: v1.0 (2026-05-05)
**Rechtsgrundlage**: Art. 32 DSGVO, Art. 8 revDSG, ISO 27001:2022, BSI IT-Grundschutz, NIST SP 800-53.
**Anwendungsfall**: Anhang B des AVV (`AVV-standard-DE.md` / `AVV-EN-international.md`); zugleich Annex II der EU SCC 2021/914 Module 2 / 3.
**Disclaimer**: Keine Rechtsberatung im Sinne § 2 RDG. Die folgenden Maßnahmen sind Mindeststandards; bei besonderen Risiken (sensible Daten Art. 9/10 DSGVO, Großmengen-Verarbeitung, Drittlands-Bezug) sind sie zu erhöhen.

---

## Struktur (analog Art. 32 DSGVO + EU SCC Annex II)

7 Kategorien:

1. Pseudonymisierung & Verschlüsselung
2. Vertraulichkeit (Zutritts-, Zugangs-, Zugriffs-, Trennungskontrolle)
3. Integrität (Weitergabe-, Eingabe-Kontrolle)
4. Verfügbarkeit & Belastbarkeit
5. Wiederherstellbarkeit nach Zwischenfällen
6. Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung
7. Maßnahmen-Anpassung (Datenschutz-Management)

---

## Kategorie 1 — Pseudonymisierung & Verschlüsselung (Art. 32 Abs. 1 lit. a DSGVO)

| Maßnahme | Implementierung beim Auftragsverarbeiter (Pflicht-Item) | Ist-Stand <ja/nein/teilweise> |
|----------|--------------------------------------------------------|------------------------------|
| Verschlüsselung in transit | TLS ≥ 1.2 (vorzugsweise 1.3); HSTS preload; PFS-Cipher-Suites; HTTP/2 oder HTTP/3 | <…> |
| Verschlüsselung at rest | AES-256-GCM für Datenbank-Storage; AES-256 für Backup-Volumes; volume-level encryption (LUKS / cloud-managed KMS) | <…> |
| Schlüsselverwaltung | Hardware Security Module (HSM) oder Cloud KMS (AWS KMS / GCP KMS / Azure Key Vault); Key Rotation jährlich; BYOK-Option für Verantwortlichen | <…> |
| Pseudonymisierung | UUID-basierte Pseudonyme; Mapping-Tabellen separat gespeichert; Re-Identifikations-Schlüssel nur autorisiertem Personal zugänglich | <…> |
| Anonymisierung | Statistische Anonymisierung (k-Anonymität / Differential Privacy) für Analytics-Datasets, soweit anwendbar | <…> |
| Token-basierte Authentisierung | JWT mit kurzen TTLs (≤15 min); Refresh-Token rotiert + revoke-fähig | <…> |
| Email-Verschlüsselung | TLS für SMTP-Übermittlung; S/MIME oder PGP für sensible Inhalte | <…> |
| Mobile Geräte | Geräteverschlüsselung verpflichtend (FileVault / BitLocker / Android FBE) | <…> |

---

## Kategorie 2 — Vertraulichkeit (Art. 32 Abs. 1 lit. b DSGVO)

### 2.1 Zutrittskontrolle (physisch)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Rechenzentrum-Zugang | ISO 27001 / SOC 2 zertifiziertes RZ; Mehrfaktor-Zutritt (Karte + Biometrie); Besucherprotokoll | <…> |
| Bürozugang | Schlüssel-/Token-System; Besucher-Anmeldung; Empfang | <…> |
| Verschluss-Schränke | für Akten + Backup-Medien | <…> |
| Alarmanlage / Videoüberwachung | mit revisionssicherer Speicherung | <…> |
| Aufbewahrung Hardware bei Außendienst | Diebstahlsicherung; verschlüsselte Geräte | <…> |

### 2.2 Zugangskontrolle (logisch — Authentifizierung)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| MFA verpflichtend | für Mitarbeiter UND Admin-Accounts; TOTP / FIDO2 / WebAuthn | <…> |
| Passwort-Policy | ≥12 Zeichen, Multi-Charset, Hash mit bcrypt/argon2, NIST SP 800-63B-konform | <…> |
| Single Sign-On (SSO) | für interne Tools mit zentralem IdP (Azure AD / Okta / Keycloak) | <…> |
| Session-Management | absolute + idle Timeout; Logout-on-close; Session-Token rotiert | <…> |
| Account-Lockout | nach 5 Fehlversuchen für 15 min | <…> |
| Privileged Access Management (PAM) | Just-in-Time-Zugriff für Admin-Tasks; Audit-Logs | <…> |

### 2.3 Zugriffskontrolle (Autorisierung)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Role-Based Access Control (RBAC) | Rollen-/Rechtematrix dokumentiert; Need-to-know-Prinzip | <…> |
| Least Privilege | minimal notwendige Rechte; periodisches Review (quartalsweise) | <…> |
| Daten-Klassifikation | öffentlich / intern / vertraulich / streng vertraulich; Markierung in Storage-Systemen | <…> |
| Audit-Logs | sämtliche Zugriffe auf personenbezogene Daten loggen; Retention ≥ 90 Tage; manipulationssicher | <…> |
| Berechtigungs-Review | mind. quartalsweise; bei Personalwechsel sofort | <…> |

### 2.4 Trennungskontrolle (Mandantentrennung)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Mandantentrennung | logisch (tenant_id pro Datensatz + Row-Level-Security) ODER physisch (separate DB-Instanzen) | <…> |
| Test- vs. Produktivsystem | getrennt; keine Echt-Daten in Test-Umgebungen | <…> |
| Multi-Tenancy-Isolation | API-seitig durch tenant_id-Validierung jeder Anfrage; AEGIS tenant-isolation-checker konform | <…> |

---

## Kategorie 3 — Integrität (Art. 32 Abs. 1 lit. b DSGVO)

### 3.1 Weitergabekontrolle

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Sichere Übertragungskanäle | TLS-Pflicht für API; SFTP/SSH für Datei-Transfer; VPN für Mitarbeiter-Remote-Access | <…> |
| Übergabeprotokolle | dokumentiert für jede manuelle Datenübergabe | <…> |
| Sichere Datenträger-Vernichtung | nach DIN 66399 Stufe ≥ H4 / E3 / O3; Vernichtungs-Zertifikat | <…> |

### 3.2 Eingabekontrolle

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Audit-Logging | Anlage / Änderung / Löschung personenbezogener Daten loggen | <…> |
| Versionierung | bei kritischen Datensätzen; Wiederherstellbarkeit von Vorgängerversionen | <…> |
| Eingangsvalidierung | Server-side Input-Validation; SQL-Injection-Schutz; XSS-Schutz | <…> |
| Signatur-Validierung | bei API-Calls mit kritischer Wirkung (HMAC / JWS / Webhook-Signatures) | <…> |

---

## Kategorie 4 — Verfügbarkeit & Belastbarkeit (Art. 32 Abs. 1 lit. b DSGVO)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Hochverfügbarkeit | Multi-AZ-Deployment; SLA ≥ 99,9 % | <…> |
| Lastverteilung | Load Balancer; Auto-Scaling | <…> |
| DDoS-Schutz | Cloudflare / AWS Shield / Azure DDoS Protection | <…> |
| Brand-/Wassermelder | im RZ (i. d. R. durch RZ-Anbieter sichergestellt) | <…> |
| USV / Notstrom | im RZ ≥ 24 h Überbrückung | <…> |
| Regelmäßige Backups | täglich inkrementell + wöchentlich vollständig; geographisch redundant gespeichert | <…> |
| Backup-Verschlüsselung | AES-256 at rest + in transit | <…> |
| Backup-Restore-Test | quartalsweise; dokumentiert | <…> |

---

## Kategorie 5 — Wiederherstellbarkeit (Art. 32 Abs. 1 lit. c DSGVO)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Disaster Recovery Plan | dokumentiert; jährlich getestet; Rollen + Verantwortlichkeiten benannt | <…> |
| Recovery Point Objective (RPO) | ≤ <24h / 4h / 1h> | <…> |
| Recovery Time Objective (RTO) | ≤ <4h / 1h / 15 min> | <…> |
| Business Continuity Plan | für kritische Prozesse; jährliches Tabletop-Exercise | <…> |
| Incident Response Plan | dokumentiert; Eskalations-Matrix; 24/7-Bereitschaft (für kritische Services) | <…> |

---

## Kategorie 6 — Regelmäßige Überprüfung (Art. 32 Abs. 1 lit. d DSGVO)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Penetrations-Tests | extern beauftragt; mind. jährlich; bei Major-Releases zusätzlich | <…> |
| Vulnerability-Scans | wöchentlich automatisiert (z. B. AEGIS, Nessus, Qualys, Trivy für Container) | <…> |
| Code-Reviews | 4-Augen-Prinzip vor Merge | <…> |
| Static Application Security Testing (SAST) | in CI-Pipeline (z. B. AEGIS, Semgrep, SonarQube) | <…> |
| Dependency-Scanning | tagesaktuell (z. B. Dependabot, Snyk, AEGIS); CVE-Patches binnen <30 / 7 / 1> Tagen je nach Severity | <…> |
| ISO 27001 / SOC 2 Type II | zertifiziert / re-zertifiziert jährlich | <…> |
| Datenschutz-Schulungen | alle Mitarbeiter, jährliche Auffrischung | <…> |
| Phishing-Simulation | mindestens halbjährlich | <…> |

---

## Kategorie 7 — Maßnahmen-Anpassung (Datenschutz-Management)

| Maßnahme | Implementierung | Ist-Stand |
|----------|----------------|-----------|
| Datenschutzbeauftragter (DSB) | bestellt nach Art. 37 DSGVO / § 38 BDSG; Kontakt veröffentlicht | <…> |
| Verfahrensverzeichnis (Art. 30 DSGVO) | aktuell geführt; jährlich reviewed | <…> |
| DSFA-Prozess (Art. 35 DSGVO) | dokumentiert; bei hohem Risiko durchgeführt | <…> |
| Auftragsverarbeitungs-Register | für eigene Auftragsverarbeiter geführt; regelmäßiger Sub-Processor-Review | <…> |
| Datenpannen-Meldeprozess | dokumentiert; 24-h-Erstmeldung an Verantwortlichen; 72-h-Aufsichtsbehörden-Meldung | <…> |
| Privacy by Design / Default | in Software-Entwicklungs-Lifecycle integriert | <…> |
| Vendor-Onboarding-Check | Datenschutz-Due-Diligence für jeden neuen Sub-Auftragsverarbeiter | <…> |
| Change-Management | bei TOM-Änderungen Information des Verantwortlichen vor Wirksamwerden | <…> |
| Awareness-Programm | regelmäßige Mitarbeiter-Sensibilisierung (Phishing, Datenschutz, Insider-Threat) | <…> |
| Whistleblower-Channel | für Datenschutz-Verstöße; HinSchG-konform (DE) | <…> |

---

## Erweiterungen für besondere Risiko-Kategorien

### Bei sensiblen Daten (Art. 9 / 10 DSGVO; Art. 5 lit. c revDSG)

Zusätzlich zu den Standard-Maßnahmen:

- **Tokenisierung** sensibler Felder (Gesundheits-IDs, Genetik-Marker, biometrische Templates)
- **Confidential Computing** / Secure Enclaves (Intel SGX, AMD SEV) für Verarbeitung im Speicher
- **Strikte Audit-Logs** mit verlängerter Retention (≥ 1 Jahr)
- **4-Augen-Prinzip** für jeden Datenzugriff
- **DSFA** verpflichtend
- **Pseudonymisierung** als Default — Re-Identifikation nur über separat gespeicherten Schlüssel

### Bei Finanzdaten (PCI-DSS-relevante Daten)

- **PCI-DSS Level 1** Compliance bei großen Volumina (≥ 6 Mio. Transaktionen/Jahr)
- **Tokenisierung** der Kartendaten (PSP-Token statt PAN)
- **Network-Segmentation** (CDE-Trennung)
- **HSM** für Schlüsselmaterial

### Bei KRITIS / DORA (Finanzsektor)

- **24/7-Security Operations Center (SOC)**
- **§ 8a BSIG**-konforme Berichterstattung (DE)
- **DORA Art. 19** ICT-Vorfall-Meldung — initialer Bericht innerhalb 4h, finaler Bericht innerhalb von 1 Monat
- **TIBER-EU**-konforme Threat-Led Penetration Tests

---

## Versionierungs-Hinweis

> Dieser TOM-Katalog wird **mindestens jährlich** durch den Auftragsverarbeiter überprüft und bei Änderungen mit neuer Versions-Nummer + Datum re-veröffentlicht. Wesentliche Änderungen werden dem Verantwortlichen vorab in Textform angekündigt; das Schutzniveau darf nicht unterschritten werden (siehe § 5.2 AVV).

**Letztes Review**: <Datum>
**Nächstes Review**: <Datum + 12 Monate>
**Verantwortlich**: <Datenschutzbeauftragter / CISO>
