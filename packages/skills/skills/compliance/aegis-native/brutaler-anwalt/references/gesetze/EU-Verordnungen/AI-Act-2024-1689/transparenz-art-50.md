---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-02
purpose: AI Act Art. 50 — Transparenz-Pflichten fuer Chatbots / Synthetic Content / Deepfakes / KI-Texte.
---

# AI Act — Art. 50 Transparenz-Pflichten (anwendbar 02.08.2026)

> Art. 50 ist DER zentrale Audit-Anker fuer Web/SaaS-Sites mit KI-Komponente.
> Anwendbar ab **02.08.2026** (24 Monate nach Inkrafttreten des AI Act 01.08.2024).
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#art_50

## Anwendungsbereich

Art. 50 gilt fuer:
- **Anbieter** von KI-Systemen, die mit natuerlichen Personen interagieren (Abs. 1)
- **Anbieter** von Synthetic-Audio/Image/Video/Text-Systemen (Abs. 2)
- **Betreiber** (Deployer) eines Emotionserkennungs- oder biometrischen Kategorisierungs-KI-Systems (Abs. 3)
- **Betreiber** eines Deep-Fake-erzeugenden KI-Systems (Abs. 4)
- **Betreiber** eines KI-Systems, das Texte zu Themen oeffentlichen Interesses generiert (Abs. 5)

## Abs. 1 — Chatbot-Hinweis-Pflicht

> „Anbieter stellen sicher, dass KI-Systeme, die zur unmittelbaren Interaktion mit natuerlichen Personen bestimmt sind, so konzipiert und entwickelt werden, dass natuerliche Personen darueber informiert werden, dass sie mit einem KI-System interagieren."

**Audit-Trigger**: jede Site mit Chatbot-Widget, AI-Voice-Assistant, AI-Customer-Service-Tool.

**Pflicht-Wording (Vorschlag)**:
- Sichtbarer Hinweis im Chat-UI: „Sie chatten mit einem KI-System." / „This is an AI assistant."
- NICHT nur in Datenschutzerklaerung versteckt — direkt am UI-Touchpoint
- Beim ersten Chat-Open: dezidiertes Modal oder Banner

**Ausnahme**: wenn aufgrund der Umstaende offensichtlich ist (z.B. ChatGPT-Style Plattform-Branding bei dem User schon weiss).

## Abs. 2 — Synthetic-Content-Kennzeichnung

> „Anbieter (...) sorgen dafuer, dass die Outputs des KI-Systems in einem maschinenlesbaren Format gekennzeichnet sind und als kuenstlich erzeugt oder manipuliert erkennbar sind."

**Pflicht-Mechanismus**:
- **Wasserzeichen / Provenance-Metadata**: C2PA Content-Credentials (Adobe-Initiative), SynthID (Google-DeepMind), CryptoSeal (OpenAI)
- **Maschinenlesbar**: nicht nur visuell, auch im Datei-Header (z.B. EXIF mit C2PA-Manifest)

**Audit-Trigger**: Site generiert AI-Bilder, AI-Videos, AI-Audio, AI-Text — z.B. Marketing-Generator, Social-Media-Tools, Image-Editor mit AI-Funktion.

**Code-Pattern**:
```ts
// Wasserzeichen in AI-generated images
import { createC2PAManifest } from '@adobe/c2pa-node';

const manifest = createC2PAManifest({
  claim_generator: 'YourBrandName/v1',
  format: 'image/jpeg',
  assertions: [
    { label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.generated' }] } },
    { label: 'c2pa.creative_work', data: { '@type': 'CreativeWork', author: [{ '@type': 'Organization', name: 'Brand' }] } }
  ]
});
```

## Abs. 3 — Emotionserkennung / Biometrische Kategorisierung

> „Betreiber eines Emotionserkennungssystems oder eines biometrischen Kategorisierungssystems setzen die natuerlichen Personen, die der Funktionsweise unterliegen, davon in Kenntnis (...)."

**Audit-Trigger**: Customer-Service-AI mit Sentiment-Analyse, AI-Hiring-Tool mit Stimmen-Analyse.

**Hinweis**: am Arbeitsplatz und in Bildung Art. 5 Abs. 1 lit. f Verbot — siehe `articles.md` Art. 5.

## Abs. 4 — Deep-Fake-Pflicht

> „Betreiber eines KI-Systems, das Bilder oder Audio- oder Videoinhalte erzeugt oder manipuliert, die als Deepfake gelten, geben offen bekannt, dass diese Inhalte kuenstlich erzeugt oder manipuliert wurden."

**Audit-Trigger**: Site mit Face-Swap, Voice-Cloning, AI-Avatar-Generator.

**Ausnahme** (Abs. 4 Satz 2): bei „offensichtlich kuenstlerischen, kreativen, satirischen, fiktionalen oder analogen Werken" reicht „angemessene Kennzeichnung", die kuenstlerische Wirkung nicht beeintraechtigt.

## Abs. 5 — KI-Text zu Themen oeffentlichen Interesses

> „Betreiber eines KI-Systems, das Texte erzeugt oder manipuliert, die veroeffentlicht werden, um die Oeffentlichkeit ueber Angelegenheiten von oeffentlichem Interesse zu unterrichten, geben offen bekannt, dass der Text kuenstlich erzeugt oder manipuliert wurde."

**Ausnahme**: bei „menschlicher Pruefung oder redaktioneller Kontrolle" und „natuerlicher Person oder juristischer Person, die die redaktionelle Verantwortung traegt".

**Audit-Trigger**: Online-Medien / Blogs mit AI-Text-Generator, News-Aggregator mit AI-Summaries.

**Pflicht-Wording**: „Dieser Artikel wurde mit KI-Unterstuetzung generiert." (im Footer / am Anfang).

## Audit-Checkliste (fuer Skill)

Pro Audit-Surface:

| Surface | Art. 50-Pflicht | Verify-Command |
|---|---|---|
| Chatbot-Widget | Abs. 1 — KI-Hinweis im UI | `curl -s https://example.com \| grep -iE "ai-system\|kuenstliche intelligenz\|chatbot ist"` |
| AI-Image-Generator | Abs. 2 — Wasserzeichen + maschinenlesbar | C2PA-Manifest-Check |
| AI-Voice-Service | Abs. 2 + Abs. 4 (wenn Voice-Cloning) | Audio-Header-Check |
| Customer-Sentiment-AI | Abs. 3 — Pre-Use-Information | UI-Audit |
| Deep-Fake-Generator | Abs. 4 — Kennzeichnung | UI + Output-Watermark |
| AI-News-Aggregator | Abs. 5 — Hinweis im Artikel | Article-Footer-Audit |

## Sanktionen Art. 99 Abs. 4

Verstoss gegen Art. 50:
- bis 15 Mio. EUR oder 3% globaler Jahresumsatz

Bei „falschen, unvollstaendigen oder irrefuehrenden Informationen" gegenueber Behoerden zusaetzlich Art. 99 Abs. 5: bis 7,5 Mio. EUR oder 1%.

## Cross-Reference

- AGB-Audit-Pattern: `audit-patterns.md` Phase 5e (AI-Chatbot-DSGVO-Audit)
- Hochrisiko-Use-Cases: `hochrisiko-annex-iii.md`
- Sanktionen: `sanktionen-art-99.md`

## Source

- [eur-lex.europa.eu — VO 2024/1689 Art. 50](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#art_50)
- [TUEV Rheinland — Transparenzpflichten EU AI Act Art. 50](https://consulting.tuv.com/aktuelles/ki-im-fokus/transparenzpflichten-eu-ai-act-art-50)
- [C2PA — Content Provenance Standard](https://c2pa.org/specifications/)
