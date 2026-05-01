---
license: MIT
purpose: Audit-Trail-Doku-Vorlage. Wird von brutaler-anwalt-Audit als geshippter Bericht erstellt.
references: SKILL.md Output-Format
---

# Compliance-Audit-Trail — `<projekt-name>`

**Stand:** `<YYYY-MM-DD>`
**Auditor:** brutaler-anwalt v`<version>` + `<operator>`
**Scope:** `<Live-URL / Repo / Doku>`
**Status:** `<DRAFT / FREIGEGEBEN / IN REMEDIATION>`

---

## 0. Disclaimer

Diese Analyse ist keine Rechtsberatung i.S.d. § 2 RDG (BGH I ZR 113/20 Smartlaw)
und ersetzt keinen zugelassenen Rechtsanwalt. Output ist technisch-indikativ
fuer interne Vorpruefung — nicht Beratung Dritter.

---

## 1. Konsolidierte Risiko-Bewertung

`<2-4 Saetze: Wahrscheinlichkeit Abmahnung/Bussgeld binnen 90 Tagen, €-Range,
kritischste 1-3 Findings, primaerer Hebel.>`

---

## 2. Findings (verified)

| # | Wahrsch. | Kritikalitaet | Bereich | Rechtsgrundlage | €-Range | Status | Fix |
|---|----------|---------------|---------|-----------------|---------|--------|-----|
| 1 | `<%>` | `<🔴/🟡/🟢>` | `<Bereich>` | `<§/Art.>` | `<X-Y €>` | verified | `<konkret>` |

---

## 3. Anwalts-Anhang (pro Finding)

### Finding #`<n>`: `<Bereich + Kurzbeschreibung>`

**HUNTER-Befund:**
`<Was wurde gefunden, wo, wie. Code/Text-Zitat wenn moeglich.>`

**Rechtsgrundlage:**
- §/Art.: `<konkret>`
- Az. relevantes Urteil: `<LG/OLG/BGH/EuGH + Datum>` (Source: `<URL>`)
- Tenor: `<1 Satz>`

**CHALLENGER-Test:**
- Bedingung A: `<erfuellt/nicht erfuellt>`
- Bedingung B: `<...>`
- Verdict: `<verified/disputed/false-positive>`

**Risiko-Vektor:**
- Abmahnung Wettbewerber: `<%>`
- Behoerden-Bussgeld: `<€-Range, Stufe Art. 83 DSGVO>`
- Schadensersatz Betroffene: `<Art. 82 DSGVO>`
- Worst-Case-Frist: `<Tage>`

**Fix:**
`<Konkrete technische ODER textuelle Massnahme.>`

---

## 4. Verifikations-Status (Skill-Self-Test)

| Verification-Check | Status |
|--------------------|--------|
| References geladen (audit-patterns.md + topic-spezifische) | `<✓/✗>` |
| Jedes Finding hat §/Art. + Az. + Reference-File-Pfad | `<✓/✗>` |
| Az.-Provenance verifiziert (Source-URL pro Az.) | `<✓/✗>` |
| HUNTER-Phase fuer alle Inputs durchlaufen | `<✓/✗>` |
| CHALLENGER-Phase pro Finding | `<✓/✗>` |
| SYNTHESIZER-Konsolidierung gemacht | `<✓/✗>` |
| Risk-Klassifikation pro Fix | `<✓/✗>` |
| Disclaimer am Output-Ende | `<✓/✗>` |
| Sanitization-Check (keine internen Brand-Refs im Output) | `<✓/✗>` |
| DEVIL'S ADVOCATE durchgelaufen | `<✓/✗>` |
| LIVE-PROBE durchgelaufen (falls verfuegbar) | `<✓/✗>` |

---

## 5. Naechste Schritte

| Prio | Aktion | Owner | Frist |
|------|--------|-------|-------|
| 🔴 | `<...>` | `<...>` | `<...>` |

---

*Diese Analyse ersetzt keine anwaltliche Beratung. Fuer verbindliche
Rechtsauskunft empfehle ich die Konsultation eines Fachanwalts fuer
IT-Recht / Datenschutzrecht.*
