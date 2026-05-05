---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32002L0058
last-checked: 2026-05-02
purpose: ePrivacy-Richtlinie — Cookie-Einwilligungs-Pflicht-Grundlage (DE-Umsetzung in TDDDG).
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen eur-lex.europa.eu Volltext verifizieren"
last-verified: 2026-05-05
---

# ePrivacy-RL 2002/58/EG (konsolidiert mit RL 2009/136/EG)

> Volltext (konsolidiert): https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32002L0058
> DE-Umsetzung: TDDDG (vormals TTDSG), siehe `references/gesetze/TDDDG/paragraphs.md`

## Anwendungsbereich

ePrivacy-RL gilt fuer:
- Verarbeitung personenbezogener Daten in elektronischer Kommunikation
- Cookies + Aehnliche Technologien (Art. 5 Abs. 3)
- Direktwerbung per E-Mail / SMS (Art. 13)

## Art. 5 — Vertraulichkeit der Kommunikation

### Abs. 1 — Vertraulichkeit
Mitgliedstaaten gewaehrleisten die Vertraulichkeit der Kommunikation.

### Abs. 3 — Cookies / Endgeraet-Zugriff (KERN-Norm)

> „Speichern von Informationen oder der Zugriff auf bereits in der Endeinrichtung des Teilnehmers oder Nutzers gespeicherte Informationen sind nur gestattet, wenn der Teilnehmer oder Nutzer auf der Grundlage von klaren und umfassenden Informationen [...] seine Einwilligung gegeben hat."

**Ausnahmen** (Abs. 3 Satz 2):
- Uebertragungs-Zweck (alleinig)
- Vom Nutzer ausdruecklich gewuenschter Dienst (z.B. Login-Session, Warenkorb)

### EuGH-Auslegung

- **EuGH C-673/17 (Planet49, 01.10.2019)**: vorausgewaehlte Cookie-Boxen = unwirksame Einwilligung
- **EuGH C-40/17 (Fashion-ID, 29.07.2019)**: Like-Button-Daten = Mit-Verantwortlichkeit
- **EuGH C-621/22 (IAB Europe, 07.03.2024)**: TC-String selbst = personenbezogene Daten

DE-Linien:
- BGH I ZR 7/16 (Cookie-Einwilligung 2020) — siehe `bgh-urteile.md`
- OLG Koeln 6 U 80/23 (Cookie-Banner-Gleichwertigkeit 2024) — siehe `bgh-urteile.md`

## Art. 13 — Unerwuenschte Direktwerbung

### Abs. 1 — Opt-In Pflicht

E-Mail / SMS / Auto-Calls fuer Direktwerbung **nur mit vorheriger Einwilligung** der Empfaenger.

### Abs. 2 — Bestandskunden-Privileg

Bestandskunden duerfen mit eigenen aehnlichen Produkten beworben werden:
- Bei Erwerb klar + deutlich ueber Werbung informiert
- Jederzeit unentgeltlicher Widerruf moeglich
- Bei jeder Werbe-Mail ein Hinweis auf Widerrufsrecht

### Abs. 3 — Klarmacherung Absender

Identitaet des Absenders + Widerruf-Adresse Pflicht.

DE-Umsetzung: § 7 UWG (siehe `references/gesetze/UWG/paragraphs.md`).

## Verhaeltnis zur DSGVO

DSGVO und ePrivacy-RL sind **lex specialis ↔ lex generalis**:
- ePrivacy regelt **das Speichern / Auslesen auf Endgeraeten** + **elektronische Kommunikation**
- DSGVO regelt **die Verarbeitung der dabei erhobenen personenbezogenen Daten**
- Bei Konflikt: ePrivacy als Spezialregel vorrangig (DSGVO-Erwgr. 173)

## ePrivacy-Verordnung (geplant, nicht in Kraft)

EU-Kommissions-Vorschlag 2017. Politische Diskussionen 2017-2025 ohne Einigung.
Stand 2026: weiter in Verhandlung. Bis Inkrafttreten gilt ePrivacy-RL + nationale Umsetzungen.

## Audit-Relevanz fuer Skill

| Audit-Surface | ePrivacy-RL-Norm | DE-Umsetzung |
|---|---|---|
| Cookie-Banner | Art. 5 Abs. 3 | § 25 TDDDG |
| LocalStorage-Tracking | Art. 5 Abs. 3 | § 25 TDDDG |
| Browser-Fingerprinting | Art. 5 Abs. 3 | § 25 TDDDG |
| E-Mail-Direktwerbung | Art. 13 | § 7 UWG |
| SMS-Werbung | Art. 13 | § 7 UWG |
| Push-Notifications | Art. 13 (analog) | § 7 UWG (umstritten) |

## Source

- [eur-lex.europa.eu — RL 2002/58/EG (konsolidiert)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32002L0058)
- [TDDDG (DE-Umsetzung)](https://www.gesetze-im-internet.de/tdddg/)
- [EDPB Guidelines 03/2022 (Cookie-Banner)](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_de)
