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

---

*Disclaimer: Diese Vorlage ist eine technisch-indikative Hilfe, keine Rechtsberatung
i.S.d. § 2 RDG. Vor produktivem Einsatz von einem Fachanwalt fuer Datenschutzrecht
oder einem zertifizierten Datenschutzbeauftragten pruefen lassen.*
