---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-02
purpose: GPAI-Pflichten (General Purpose AI) Art. 51-56 + System-Risk-Modelle.
---

# AI Act — GPAI / Foundation Models Pflichten (Art. 51-56)

> GPAI = General-Purpose AI Models. Anwendbar seit **02.08.2025**.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689

## Definition (Art. 3 Nr. 63 / Art. 51)

GPAI = KI-Modell mit signifikanter Allgemeinheit, das ein breites Spektrum unterschiedlicher Aufgaben kompetent durchfuehren kann, unabhaengig davon wie es in den Markt gebracht wird.

**Beispiele**: GPT-Familie, Claude-Familie, Mistral Large/Codestral, Gemini, LLaMA-Familie, Falcon, Mixtral, etc.

## Standard-GPAI-Pflichten (Art. 53)

Jeder GPAI-Anbieter:

1. **Technische Dokumentation** (Art. 53 Abs. 1 lit. a + Anhang XI):
   - Architektur, Training-Methodik, Compute-Aufwand
   - Bereitstellung an Aufsicht (AI Office) + downstream-Anbieter

2. **Downstream-Information** (Art. 53 Abs. 1 lit. b + Anhang XII):
   - Informationen + Doku fuer Anbieter die GPAI in eigene KI-Systeme integrieren
   - Capability-Beschreibung, Limitationen, Acceptable-Use-Policy

3. **Copyright-Compliance** (Art. 53 Abs. 1 lit. c):
   - Policy zur Einhaltung von Art. 4 Abs. 3 RL 2019/790 (Text-and-Data-Mining-Schranke)
   - Ablehnungs-Erklaerung der Rechteinhaber respektieren (`robots.txt` / `Open-Future` / etc.)

4. **Training-Data-Summary** (Art. 53 Abs. 1 lit. d):
   - Detaillierter, oeffentlich zugaenglicher Summary der Training-Daten
   - Format-Vorlage von AI Office vorgegeben

## System-Risk-GPAI-Pflichten (Art. 51 Abs. 1 lit. a + Art. 55)

Wenn GPAI als „System-Risk" eingestuft (Schwelle: kumulative Compute > 10^25 FLOPs zum Training), zusaetzlich:

1. **Model-Evaluation** (Art. 55 Abs. 1 lit. a):
   - State-of-the-art Eval-Protokolle (Adversarial / Red-Teaming)
   - Veroeffentlichung wesentlicher Erkenntnisse

2. **Risk-Assessment** (Art. 55 Abs. 1 lit. b):
   - System-Risk-Identifikation, -Mitigation, -Reporting an AI Office

3. **Incident-Reporting** (Art. 55 Abs. 1 lit. c):
   - Schwerwiegende Vorfaelle + Korrekturmassnahmen unverzueglich melden

4. **Cybersecurity** (Art. 55 Abs. 1 lit. d):
   - Modell- und Infrastruktur-Schutz auf state-of-the-art

## Code-of-Practice (Art. 56)

- AI Office veroeffentlicht Branchen-Code-of-Practice (verbindlich-machbar via Art. 56 Abs. 9)
- Aktueller Stand 2026: erste GPAI-Code-of-Practice-Iteration verabschiedet (Mai 2025)
- Quelle: https://digital-strategy.ec.europa.eu/de/policies/ai-code-practice

## Audit-Relevanz fuer Web-/SaaS-Audits

Wenn die Site einen GPAI-Provider integriert (OpenAI / Anthropic / Mistral / etc.), pruefe:

| Check | Pflicht-Quelle |
|---|---|
| Vendor-Compliance mit Art. 53 (Technical Doc + Copyright + Training-Summary) | Vendor-Trust-Center |
| Vendor ist System-Risk-eingestuft? | Vendor-Disclosure |
| Vendor-AVV/DPA erfuellt EU-AI-Act-Pflichten? | DPA |
| Eigene App nutzt GPAI fuer Hochrisiko-Use-Case (Annex III)? | Audit Annex III |
| Output-Generierung nach Art. 50 zu kennzeichnen? | siehe `transparenz-art-50.md` |
| Feinabstimmungs-Anbieter-Pflichten (wenn Site eigenes Modell trainiert basierend auf GPAI)? | Art. 53 Abs. 4 |

## Cross-Stack-Pattern

```bash
# Pflicht-Checks fuer Skill-Audit eines KI-integrierenden Site
# 1. AVV / DPA des GPAI-Providers vorhanden?
grep -irE "openai.com/policies|anthropic.com/legal|mistral.ai/terms" \
  src/components/legal/ src/app/datenschutz/

# 2. AI-Act-Hinweis in DSE
curl -s https://example.com/datenschutz | grep -ic "AI Act\|KI-Verordnung\|VO.*2024.*1689"
```

## Sanktionen

Verstoss gegen Art. 53 (GPAI Standard-Pflichten):
- bis 15 Mio. EUR oder 3% globaler Jahresumsatz (Art. 99 Abs. 4)

Verstoss gegen Art. 55 (System-Risk-Pflichten):
- bis 15 Mio. EUR oder 3% (Art. 99 Abs. 4) — schaerfer in der Praxis durch System-Risk-Charakter

## Source

- [eur-lex.europa.eu — VO 2024/1689 Art. 51-56](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689)
- [European Commission — GPAI Code of Practice](https://digital-strategy.ec.europa.eu/de/policies/ai-code-practice)
- [AI Office — Erlaeuterungen GPAI](https://digital-strategy.ec.europa.eu/de/policies/ai-office)
