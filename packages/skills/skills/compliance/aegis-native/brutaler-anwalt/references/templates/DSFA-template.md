---
license: MIT
purpose: Generische DSFA-Vorlage (Art. 35 DSGVO). Anonym, brand-agnostic.
references: dsgvo.md (DSFA-Trigger-Liste)
sources: BayLDA-Hinweise zur DSFA + DSK-Whitelist 2018
---

# Datenschutz-Folgenabschaetzung (DSFA) — Vorlage

> Diese Vorlage erfuellt Art. 35 DSGVO + DSK-Whitelist 2018 + BayLDA-Hinweise.
> Kein Ersatz fuer anwaltliche Bewertung. Vor Inbetriebnahme der Verarbeitung
> intern abnehmen lassen (Datenschutzbeauftragter / interner Compliance-Officer).

## 1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)

| Feld | Wert |
|------|------|
| Verantwortlicher | `<Operator-Firma>` |
| Anschrift | `<vollstaendige-Anschrift>` |
| Kontakt DSB | `<email-DSB>` (sofern bestellt) |
| DSFA-Datum | `<YYYY-MM-DD>` |
| DSFA-Version | `<vN.N>` |

## 2. Beschreibung der Verarbeitung (Art. 35 Abs. 7 lit. a DSGVO)

- **Verarbeitungszweck**: `<Zweck>`
- **Datenkategorien**: `<Kategorien>` (z.B. Stammdaten, Kontaktdaten, Nutzungsdaten, ggf. besondere Kategorien Art. 9)
- **Betroffene Personen**: `<Personenkreis>`
- **Empfaenger**: `<intern>` / `<Auftragsverarbeiter>` / `<Drittland>`
- **Speicherdauer**: `<Frist>` (mit gesetzlichem Anker)
- **Rechtsgrundlage**: Art. 6 Abs. 1 lit. `<a/b/c/d/e/f>` DSGVO `<+ Art. 9 lit. X falls relevant>`

## 3. Notwendigkeit + Verhaeltnismaessigkeit (Art. 35 Abs. 7 lit. b)

- **Notwendigkeit**: warum diese Daten?
- **Datenminimierung**: was wurde weggelassen?
- **Pseudonymisierung / Anonymisierung**: wo moeglich?

## 4. Risiken fuer Betroffene (Art. 35 Abs. 7 lit. c)

| Risiko-Kategorie | Bewertung | Begruendung |
|------------------|-----------|-------------|
| Identitaetsdiebstahl | `<niedrig/mittel/hoch>` | `<...>` |
| Diskriminierung | `<...>` | `<...>` |
| Reputations-/Vermoegensschaden | `<...>` | `<...>` |
| Profiling | `<...>` | `<...>` |
| Verlust Kontrolle ueber Daten | `<...>` | `<...>` |

## 5. Abhilfemassnahmen (Art. 35 Abs. 7 lit. d)

| Massnahme | Implementierungsstatus | Verify-Command |
|-----------|------------------------|----------------|
| Verschluesselung at-rest (TLS, DB) | `<umgesetzt>` | `<curl -sI ...>` |
| Verschluesselung in-transit | `<umgesetzt>` | `<...>` |
| Zugriffsbeschraenkung (RBAC) | `<...>` | `<...>` |
| Audit-Logging | `<...>` | `<...>` |
| Datenminimierung in Logs | `<...>` | `<...>` |
| Auto-Cleanup nach Frist | `<...>` | `<...>` |
| TOMs (Art. 32 DSGVO) | `<verweis>` | `<...>` |

## 6. Konsultations-Pflicht (Art. 36 DSGVO)

- Wenn nach Massnahmen Risiko **weiterhin hoch** → Pflicht, Aufsichtsbehoerde
  zu konsultieren VOR Beginn der Verarbeitung.
- Frist Aufsichtsbehoerde: 8 Wochen (verlaengerbar 6 Wochen).

## 7. Review-Frist

DSFA mindestens jaehrlich oder bei wesentlicher Aenderung der Verarbeitung
ueberpruefen. Naechstes Review: `<YYYY-MM-DD>`.

## 8. Spezifika fuer Art-9-Verarbeitungen (V4-Pattern, post-Art-9-Workflow-Audit 2026-05-03)

Bei besonderen Kategorien Art. 9 DSGVO (Gesundheitsdaten, biometrisch, Gewerkschaft,
Religion, politische Meinung) gelten **verschaerfte Anforderungen** (Art. 35 Abs. 3
lit. b — DSFA Pflicht; KMU-Privileg gilt nicht).

### 8.1 Rechtsgrundlage-Pruefung

- Hauptpfad: Art. 9 Abs. 2 lit. a DSGVO (ausdrueckliche Einwilligung)
- Alternativen pruefen + ausschliessen:
  - lit. b (Arbeitsrecht / Sozialschutz) — nur HR-Kontexte
  - lit. c (lebenswichtige Interessen) — nur Notfall
  - lit. f (Rechtsanspruechen) — nur prozessual
  - lit. h (Gesundheitsvorsorge durch Berufsgeheimnistraeger) — nur Heilberuf
- § 22 BDSG: Detail-Erlaubnis-Norm, NUR wenn lit. h greift
- **Verbotener Verweis**: Art. 6 Abs. 1 lit. f (berechtigtes Interesse) — bei Art-9 nicht zulaessig

### 8.2 Beweis-Pflicht-Mechanismus (Art. 7 Abs. 1)

| Modus | Implementierung |
|-------|-----------------|
| Tablet-eES | SignaturePad-PNG verschluesselt im DB-Record (eIDAS Art. 3 Nr. 10) |
| Papier eigenhaendig + Scan | Original im Tresor + SHA-256-Hash in DB |
| Mitarbeiter-Abtipp + Scan + Mitarbeiter-Co-Signatur | Pflicht-Upload + Mitarbeiter-Bestaetigungs-Signatur |

### 8.3 Crypto-at-Rest-TOMs

- [ ] AES-256-GCM (oder ChaCha20-Poly1305) mit AAD-Bindung an Row-ID
- [ ] Key-Versioning im Ciphertext-Format
- [ ] Decrypt-Fail-Audit-Log (Tampering- + Key-Loss-Detection)
- [ ] Recovery-Procedure dokumentiert (`docs/security/encryption-recovery.md`)
- [ ] Mind. 3 unabhaengige Key-Backup-Standorte (Production-ENV + Vault + Offline)

### 8.4 Aufbewahrungs-Differenzierung

| Setup | Frist | Norm |
|-------|-------|------|
| Wellness/Kosmetik | 3 Jahre | BGB § 195 |
| Heilpraktiker | 10 Jahre | BGB § 630f Abs. 3 |
| Personenschaden-Sondercase | bis 30 Jahre | BGB § 199 Abs. 2 |

### 8.5 Audit-Log-Pflicht-Events

- create / view / export / revoke / delete (Metadaten-only beim DELETE!)
- decrypt_failure mit reason + version + keyId
- scan_hash_mismatch (Tampering-Indikator)

### 8.6 Public-Form-Validierung

Wenn Patienten via Public-Tablet/Self-Service Anamnese ausfuellen koennen — Pflicht-Signatur-Block muss UI-seitig vor Submit erzwingen werden. DB-CHECK-Constraint allein → schlechte UX (500-Error statt Submit-Block).

> Audit-Pattern fuer Art-9: siehe `references/audit-patterns.md` Phase 5h (Art-9-Beweis-Workflow-Audit).

---

*Disclaimer: Diese Vorlage ist eine technisch-indikative Hilfe, keine Rechtsberatung
i.S.d. § 2 RDG. Vor produktivem Einsatz von einem Fachanwalt fuer Datenschutzrecht
oder einem zertifizierten Datenschutzbeauftragten pruefen lassen.*
