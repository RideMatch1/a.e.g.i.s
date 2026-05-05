---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/gwg_2017/
last-checked: 2026-05-05
purpose: GwG (Geldwäschegesetz) — KYC, Sorgfaltspflichten, Verdachtsmeldungen. AMLD-Umsetzung; ab 2026 schrittweise Ablösung durch EU-AMLR (VO 2024/1624).
---

# GwG — Kern-Paragraphen

> Geldwäschegesetz (GwG), 4./5. AMLD-Umsetzung.
> Volltext: https://www.gesetze-im-internet.de/gwg_2017/

## § 1 — Begriffsbestimmungen

**Wortlaut (Kern)**: Definitionen u.a. für „Verpflichtete", „Geschäftsbeziehung", „wirtschaftlich Berechtigter" (≥ 25 % Anteile / Stimmrechte direkt oder indirekt), „PEP" (politisch exponierte Person), „Risikoanalyse".

**Audit-Relevanz**: trigger für KYC-Onboarding-Flow Design.

---

## § 2 — Verpflichtete

**Wortlaut (Kern, Abs. 1)**: Verpflichtete sind u.a.:
- **Nr. 1**: Kreditinstitute (KWG-§-1 Abs. 1),
- **Nr. 2**: Finanzdienstleistungsinstitute (KWG-§-1 Abs. 1a),
- **Nr. 3**: Zahlungsdienstleister (ZAG),
- **Nr. 7**: Versicherungsunternehmen,
- **Nr. 8**: Wirtschaftsprüfer, Steuerberater,
- **Nr. 10**: Rechtsanwälte, Notare (bei bestimmten Tätigkeiten),
- **Nr. 13**: Güterhändler ab Bargeld-Schwellen,
- **Nr. 14**: Immobilienmakler,
- **Nr. 15**: Veranstalter / Vermittler von Glücksspielen,
- **Nr. 16**: Krypto-Verwahrer (§ 1 Abs. 11 KWG = Krypto-Verwahrgeschäft).

**Audit-Relevanz**: Krypto-Plattformen + Custodial-Wallets sind GwG-Verpflichtete (§ 2 Abs. 1 Nr. 16). Auch DeFi-Frontends mit FIAT-Onramp-Funktion fallen in Praxis darunter.

---

## §§ 4–9 — Risikomanagement

**Wortlaut (Kern)**: Verpflichtete müssen
- Risikoanalyse erstellen + dokumentieren (§ 5),
- interne Sicherungsmaßnahmen (§ 6) einrichten,
- Geldwäsche-Beauftragten benennen (§ 7) ab gewisser Größe,
- Mitarbeiter schulen (§ 6 Abs. 2 Nr. 6),
- Verdachts-Meldewege (§ 6 Abs. 2 Nr. 7) etablieren.

**Audit-Relevanz**: Compliance-Doku — Audit-Surface für AVV / Mitarbeiter-Schulung / interne Policy.

---

## §§ 10–17 — Sorgfaltspflichten

### § 10 — Allgemeine Sorgfaltspflichten

**Wortlaut (Kern)**: Verpflichtete müssen bei Begründung jeder Geschäftsbeziehung + bei Transaktionen ≥ Schwellwerte:
- Vertragspartner identifizieren (§ 11) — Name, Geburtsdatum, Adresse, Ausweisnummer,
- wirtschaftlich Berechtigten ermitteln (§ 11 Abs. 5),
- Zweck + Art der Geschäftsbeziehung klären (§ 10 Abs. 1 Nr. 2),
- kontinuierliche Überwachung sicherstellen,
- Aufzeichnungen 5 Jahre aufbewahren (§ 8).

### § 11 — Identifizierung

**Wortlaut (Kern)**: Identifizierung erfolgt durch:
- gültigen Personalausweis / Reisepass (Foto-Ident, Video-Ident, Online-Ident-Verfahren),
- bei juristischen Personen: HR-Auszug + UB-Eintrag.

### § 13 — Vereinfachte Sorgfaltspflichten

Bei niedrigem Risiko (z.B. EU-zugelassene Banken als Vertragspartner) reduzierte Pflichten zulässig.

### § 14 — Verstärkte Sorgfaltspflichten

Bei erhöhtem Risiko (PEP, Hochrisikoländer, ungewöhnliche Transaktionen):
- zusätzliche Identifizierungs-Schritte,
- Geschäftsführungs-Genehmigung,
- erweiterte Überwachung.

**Audit-Relevanz**: KYC-Onboarding-Flow muss alle drei Risiko-Stufen abbilden. Krypto-Plattform mit „nur E-Mail + Telefonnummer" = klarer GwG-§-10/11-Verstoß.

---

## § 23 — Transparenzregister

**Wortlaut (Kern)**: Juristische Personen + Personengesellschaften müssen wirtschaftlich Berechtigten zum Transparenzregister melden. Vollregister seit 01.08.2021.

**Audit-Relevanz**: Compliance-Pflicht für Operatoren — Audit-Surface bei Firmen-Onboarding.

---

## §§ 43–48 — Verdachts-Meldungen

**Wortlaut (Kern)**: Verpflichtete müssen FIU (Financial Intelligence Unit) Verdachtsfälle unverzüglich melden — auch bei nur Verdacht auf Geldwäsche / Terrorismusfinanzierung. Geheimhaltungs-Pflicht („tipping-off"): Kunde darf nicht informiert werden.

**Audit-Relevanz**: trigger für Backend-Logik bei „suspicious activity" — Meldekanal an goAML (Online-Portal).

---

## § 56 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer fahrlässig oder vorsätzlich gegen Sorgfaltspflichten, Risikomanagement, Verdachts-Meldepflichten verstößt.

**§ 56 Abs. 2 — Bußgeld-Rahmen** (gestaffelt nach Schwere):
- **Standardverstoß**: bis **einhunderttausend Euro (100.000 €)**
- **Schwere/wiederholte/systematische Verstöße**: bis **eine Million Euro (1.000.000 €)**
- **Bei Verpflichteten = Kreditinstitut / Finanzinstitut + besonders schwerer Verstoß**: bis **fünf Millionen Euro (5.000.000 €) oder 10 % Jahresumsatz** (höherer Betrag gilt) — entsprechend Art. 59 4. AMLD
- **Vermögensvorteil-Abschöpfung** kann zusätzlich verhängt werden (§ 56 Abs. 3).

**Audit-Relevanz**: schwerste OwiG-Schwelle in DE-Compliance-Recht. Bei Krypto-Plattform mit ungenügendem KYC = sofortiger Existenz-Risiko (BaFin-Marktverbot + Bußgeld bis 10 % Jahresumsatz).

---

## § 57 — Veröffentlichung der Bußgeldentscheidungen

**Wortlaut (Kern)**: BaFin / FIU veröffentlichen rechtskräftige Maßnahmen mit Name des Verpflichteten + Verstoß-Beschreibung („Naming & Shaming").

**Audit-Relevanz**: Reputations-Risiko zusätzlich zum monetären Bußgeld.
