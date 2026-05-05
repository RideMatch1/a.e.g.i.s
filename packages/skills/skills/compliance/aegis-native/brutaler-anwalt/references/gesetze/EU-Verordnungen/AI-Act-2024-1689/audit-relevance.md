---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-02
purpose: AI Act Audit-Relevance — Auto-Loading-Trigger und Pflicht-Surfaces fuer Skill.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen eur-lex.europa.eu Volltext verifizieren"
last-verified: 2026-05-05
---

# AI Act — Audit-Relevance fuer brutaler-anwalt

## Wann triggert dieser Skill den AI-Act-Layer?

Auto-Loading-Trigger:

```
1. Tech-Stack-Detection package.json grep:
   - @anthropic-ai/sdk
   - openai (npm)
   - @mistralai/mistralai
   - @google/generative-ai
   - @azure/openai
   - replicate
   - cohere-ai
   - @huggingface/inference

2. Page-Content-Detection:
   - "/chat" / "/assistant" / "/ai" Routes
   - <iframe src="*chatbot*"> oder ähnliches
   - Floating Chat-Widget im DOM (typische Selectors: [data-chatbot], #chat-widget)
   - "AI generated" / "KI generiert" Text-Match
   - Synthetic-Image-Generation (text-to-image API-Endpoints)

3. Branchen-Trigger:
   - HR-Tech / Recruiting (Annex III Nr. 4)
   - Fintech mit Bonity-Score (Annex III Nr. 5.b)
   - Telemedizin / Health-AI (Annex III Nr. 5.d)
   - EdTech mit Auto-Grading / Proctoring (Annex III Nr. 3)
   - KRITIS-Sektor (Annex III Nr. 2)
```

## Pflicht-Surfaces fuer Audit

Pro KI-Komponente:

### Surface 1 — UI-Transparenz (Art. 50)

| Check | Verify |
|---|---|
| Chatbot-Hinweis sichtbar im Chat-UI | DOM-Probe: `<div data-chatbot> ... mit "AI" / "KI"-Label` |
| AI-Image-Output mit Wasserzeichen | C2PA-Manifest-Check, PNG-Metadata |
| Deep-Fake-Disclosure | UI-Audit |

### Surface 2 — Daten-Governance (Art. 10, fuer Hochrisiko)

| Check | Verify |
|---|---|
| Trainings-Daten-Quelle dokumentiert | DSE / VVT-Eintrag |
| Trainings-Daten-Bias-Bewertung | interne Doku |
| Repraesentative Trainings-Set | externe Pruefung empfohlen |

### Surface 3 — Technische Doku (Art. 11)

| Check | Verify |
|---|---|
| Anhang IV Tech-Doku vorhanden | interner Vault |
| System-Architektur dokumentiert | tech-design.md |
| Inputs / Outputs / Limitationen | API-Doku |

### Surface 4 — Logging (Art. 12)

| Check | Verify |
|---|---|
| Auto-Logging der KI-Outputs | Audit-Trail-Implementierung |
| Aufbewahrung > 6 Monate (oder gemaess Risikoanalyse) | Cron-Job + DB-Schema |

### Surface 5 — Menschliche Aufsicht (Art. 14)

| Check | Verify |
|---|---|
| Override-Mechanismus fuer KI-Entscheidung | UI-Audit |
| Stop-Button oder Eskalationspfad | UI-Audit |
| Klarmacherung dass User Endentscheidung trifft | UI-Wording |

### Surface 6 — Vendor-Compliance

| Check | Verify |
|---|---|
| GPAI-Provider hat Art. 53 Tech-Doku | Vendor Trust-Center |
| AVV / DPA datiert auf 2025+ | DPA-Stand |
| Copyright-Policy explizit | Vendor-FAQ |

### Surface 7 — DSE / AGB

| Check | Verify |
|---|---|
| Art. 50-Hinweis in DSE | grep DSE |
| Hochrisiko-Klassifikation in DSE genannt (wenn relevant) | grep DSE |
| AVV mit AI-Vendor in AVV-Liste | grep DSE |
| KI-VO-Disclaimer in AGB (RDG-Abgrenzung bei Tech-Generators) | grep AGB |

## Schadens-Diagnose-Pattern (Skill-Output)

Pro AI-Act-Verstoss:

```
**Finding**: Chatbot ohne KI-Hinweis in UI (Art. 50 Abs. 1)
**Wahrsch.**: 65% (B2C-Site, Behoerde-Folgekontrolle ab Q3 2026 wahrscheinlich)
**Kritikalitaet**: 🟡 HOCH (ab 02.08.2026 vollstaendig anwendbar)
**§**: Art. 50 Abs. 1 i.V.m. Art. 99 Abs. 4 KI-VO
**€-Range KMU**: 50.000–500.000 (fahrlässig, erste Auffaelligkeit, nach KMU-Privileg Art. 99 Abs. 6)
**Belege**:
- VO 2024/1689 Art. 50 Abs. 1
- Erwgr. 132-134 (Transparenz-Begruendung)
**Fix**:
- Sichtbarer Disclaimer im Chat-UI „Sie chatten mit einem KI-System"
- Bei Erstkontakt: Modal mit Bestaetigung
- Code-Pattern: siehe `references/stack-patterns/ai/`-Files
**Worst-Case-Frist**: ab 02.08.2026 sofortige Behoerden-Pruefung moeglich (Marktueberwachungsbehoerde
nach Art. 70).
```

## Cross-References (Skill-Reference-Loading)

| Wenn HUNTER findet... | Lade zusaetzlich... |
|---|---|
| Recruiting-Tool mit AI-CV-Screening | `branchenrecht.md` HR-Tech + § 26 BDSG + BetrVG § 87 |
| Bonity-Scoring-Tool | `bgh-urteile.md` C-634/21 SCHUFA + Art. 22 DSGVO |
| Telemedizin-Diagnose-AI | `branchenrecht.md` Telemedizin + MDR-Layer |
| AI-Bilder-Generator | `transparenz-art-50.md` Abs. 2 (C2PA) |
| Deep-Fake-Tool | `transparenz-art-50.md` Abs. 4 |
| AI-News-Aggregator | `transparenz-art-50.md` Abs. 5 |
| GPAI-Provider integriert | `gpai-pflichten.md` Art. 53 + AVV-Check |

## Source

- [eur-lex.europa.eu — VO 2024/1689](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689)
- AI Office: https://digital-strategy.ec.europa.eu/de/policies/ai-office
