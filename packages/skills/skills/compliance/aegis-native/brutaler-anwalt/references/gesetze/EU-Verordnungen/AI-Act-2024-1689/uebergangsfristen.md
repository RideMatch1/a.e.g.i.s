---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-02
purpose: AI Act Uebergangs-Timeline mit Pflicht-Aktionen je Stichtag.
---

# AI Act — Uebergangsfristen-Timeline

> VO 2024/1689 in Kraft seit **01.08.2024**. Anwendbarkeit gestaffelt nach Art. 113.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689

## Timeline mit Pflicht-Aktionen pro Stichtag

### 01.08.2024 — In-Kraft-Treten

- AI-Act ist im Amtsblatt veroeffentlicht und in Kraft.
- **Aktion**: noch keine Pflichten direkt aus AI-Act.

### 02.02.2025 — Verbotene KI-Praktiken (Art. 5)

- Art. 1, 2, 3, 5, 7-9, 99 Abs. 1-2-3-7-9-10-11 (Sanktionen-Rahmen)
- **Aktion fuer JEDEN AI-betreibenden Operator**:
  - Self-Audit gegen Art. 5 (sind verbotene Praktiken implementiert?)
  - Wenn ja: Stilllegung VOR 02.02.2025
  - Bei NICHT-Stilllegung: Art. 99 Abs. 3 — bis 35 Mio. EUR / 7%

**Audit-Frage**: tut die Site etwas aus Art. 5? (Subliminal / Social-Scoring / Vuln-Exploit / etc.)

### 02.08.2025 — GPAI-Pflichten (Art. 51-56)

- Art. 51-56 + Art. 99 Abs. 4 (Sanktionen GPAI) anwendbar
- **Aktion**:
  - GPAI-Anbieter: Technische Doku + Downstream-Information + Copyright-Policy + Training-Summary
  - System-Risk-GPAI-Anbieter (Compute > 10^25 FLOPs): zusaetzlich Model-Eval + Risk-Assessment + Incident-Reporting + Cybersecurity
  - Code-of-Practice akzeptiert oder eigene Compliance-Strategie

**Audit-Frage**: Welche GPAI-Provider werden integriert? (OpenAI / Anthropic / Mistral / etc.) — sind deren AVV/DPAs AI-Act-konform?

### 02.08.2026 — Hochrisiko + Transparenz + komplette Anbieter-Pflichten

**Massiv-Stichtag**. Anwendbar wird:
- Art. 6-49 (Hochrisiko-KI-Pflichten + Anbieter-Pflichten + Importeur/Distributor)
- Art. 50 (Transparenz-Pflichten — Chatbot / Synthetic / Deep-Fake / KI-Texte)
- Art. 27 (FRIA — Grundrechte-Folgenabschaetzung)

**Aktion fuer JEDEN AI-betreibenden Operator**:
1. **Annex-III-Self-Audit** — laeuft mein Use-Case unter Hochrisiko? (siehe `hochrisiko-annex-iii.md`)
2. Wenn ja:
   - Risikomanagement-System aufsetzen (Art. 9)
   - Daten-Governance dokumentieren (Art. 10)
   - Technische Doku Pflicht (Art. 11)
   - Logging implementieren (Art. 12)
   - Transparenz-Wording an Endnutzer (Art. 13)
   - Menschliche Aufsicht sichergestellt (Art. 14)
   - Genauigkeit + Cybersecurity geprueft (Art. 15)
   - FRIA durchfuehren (Art. 27)
   - Konformitaetsbewertung + CE-Kennzeichen (Art. 16-29 + Anhang VII)
3. Art. 50 Transparenz fuer ALLE Sites mit KI-Komponente:
   - Chatbot-Hinweis im UI
   - AI-Image/Video/Audio-Wasserzeichen
   - Deep-Fake-Disclosure
   - KI-Text-Hinweis bei oeffentlichem Interesse

**Audit-Risk bei Stichtag-Verfehlung**: Art. 99 Abs. 4 — bis 15 Mio. EUR / 3% Jahresumsatz.

### 02.08.2027 — Vollstaendige Anwendung

- Art. 6 Abs. 1 (Hochrisiko-Definition fuer KI in regulierten Produkt-Kategorien — Annex I)
- Restliche Uebergangs-Pflichten ausgelaufen

**Aktion**: KI in regulierten Produkten (Maschinen-RL, Medizinprodukte, Spielzeug, Aufzuege, etc.) muss komplette Annex-III-Hochrisiko-Pflichten erfuellen.

## Audit-Compliance-Tracker (fuer Skill-Output)

```
| Stichtag | Pflicht | Status (Solo-Vibecoder) | Risiko bei Verfehlung |
|---|---|---|---|
| 02.02.2025 | Keine Art. 5-Praktiken | wahrscheinlich erfuellt (selten implementiert) | 35M / 7% |
| 02.08.2025 | GPAI-Vendor-DPA-Check | Vendor-Pflicht, Operator pruefen | Vendor-Risiko, fuer Operator hauptsaechlich AVV-Pflicht |
| 02.08.2026 | Annex-III + Art. 50 | hier liegt 80% des Audit-Werts | 15M / 3% |
| 02.08.2027 | Komplett-Compliance | nur bei Maschinen/Medizin/Spielzeug etc. relevant | 15M / 3% |
```

## Zukunftsplanung — was jetzt schon in DSE / AGB hineinschreiben?

Vorschlag fuer DSE-Erweiterung in 2026:

> **KI-Verordnung (EU 2024/1689)**
> Diese Webseite nutzt KI-Komponenten (siehe Abschnitt [X]). Wir folgen der EU-KI-Verordnung
> (VO 2024/1689) gemaess folgendem Plan:
> - Seit 02.02.2025: Wir betreiben keine nach Art. 5 KI-VO verbotenen Praktiken.
> - Seit 02.08.2025: Unsere KI-Provider erfuellen die GPAI-Pflichten gemaess Art. 51-56.
> - Ab 02.08.2026: Wir kennzeichnen alle KI-generierten Inhalte gemaess Art. 50 KI-VO.

## Cross-Reference

- Hochrisiko-Use-Cases: `hochrisiko-annex-iii.md`
- Art. 50 Transparenz: `transparenz-art-50.md`
- GPAI: `gpai-pflichten.md`
- Sanktionen: `sanktionen-art-99.md`

## Source

- [eur-lex.europa.eu — VO 2024/1689 Art. 113](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#art_113)
- [European Commission — AI Act Timeline](https://digital-strategy.ec.europa.eu/de/policies/regulatory-framework-ai)
