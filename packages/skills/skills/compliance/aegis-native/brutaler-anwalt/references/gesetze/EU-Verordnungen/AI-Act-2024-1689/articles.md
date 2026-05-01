---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-01
purpose: EU AI Act (VO 2024/1689) — Audit-relevante Artikel für Web/SaaS mit KI-Komponente.
---

# EU AI Act (VO 2024/1689) — Audit-relevante Artikel

> In Kraft seit 01.08.2024. Anwendbarkeit gestaffelt:
> - Verbotene Praktiken (Art. 5): seit **02.02.2025** anwendbar
> - General-Purpose-AI (GPAI): seit **02.08.2025**
> - Hochrisiko-Systeme: ab **02.08.2026**
> - Volle Anwendung: ab **02.08.2027**

> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689

## Art. 3 — Begriffsbestimmungen

KI-System (Nr. 1): „maschinenbasiertes System, autonom betreibbar, anpassungsfähig, generiert Outputs (Vorhersagen, Inhalte, Empfehlungen, Entscheidungen) aus Eingaben, beeinflusst physische oder virtuelle Umgebungen"

**Audit-Relevanz:** alles was LLM-API ruft (OpenAI, Anthropic, Mistral) ist KI-System.

## Art. 5 — Verbotene KI-Praktiken (in Kraft 02.02.2025)

Verboten:
- Subliminal-Manipulation
- Vulnerability-Exploitation (Kinder, Behinderung, soziale Lage)
- Social Scoring
- Predictive Policing (rein KI-basiert)
- Untargeted Face-Image-Scraping (Clearview-Pattern)
- Emotion-Recognition am Arbeitsplatz und in Bildung
- Biometrische Kategorisierung nach sensiblen Merkmalen
- Real-time Remote Biometric Identification in öffentlich zugänglichen Räumen (Ausnahmen für Strafverfolgung)

**Audit-Relevanz:** Web/SaaS-Audit prüft, dass keine dieser Praktiken implementiert ist.

## Art. 6 — Hochrisiko-KI-Systeme

Annex I (KI in regulierter Produkt-Kategorie) + Annex III (Hochrisiko-Use-Cases):
- Annex III Nr. 1: Biometrische Identifizierung
- Annex III Nr. 2: Kritische Infrastruktur
- Annex III Nr. 3: Bildung + Berufsausbildung (z.B. Bewerber-Bewertung)
- **Annex III Nr. 4: Beschäftigung + Personalverwaltung** (Recruiting-AI, Performance-AI)
- Annex III Nr. 5: Zugang zu wesentlichen privaten/öffentlichen Diensten (Credit-Scoring, Sozialleistungen)
- Annex III Nr. 6: Strafverfolgung
- Annex III Nr. 7: Migration + Grenzkontrolle
- Annex III Nr. 8: Justiz + demokratische Prozesse

**Audit-Relevanz:** wenn ein SaaS einen dieser Use-Cases macht → Pflichten nach Art. 8–15:
- Risikomanagement-System (Art. 9)
- Daten-Governance (Art. 10)
- Technische Doku (Art. 11)
- Logging (Art. 12)
- Transparenz + Information (Art. 13)
- Menschliche Aufsicht (Art. 14)
- Genauigkeit + Cybersecurity (Art. 15)

## Art. 27 — Grundrechte-Folgenabschätzung (FRIA)

Pflicht bei Hochrisiko-KI: vor Inbetriebnahme Folgenabschätzung der Grundrechte.

**Audit-Relevanz:** ähnlich DSFA, aber für Grundrechte (nicht nur Datenschutz). Für AI-Driven HR-Tools / Credit-Scoring Pflicht.

## Art. 50 — Transparenz-Pflichten für bestimmte KI-Systeme (in Kraft 02.08.2026)

- Abs. 1: KI-Systeme die mit natürlichen Personen interagieren MÜSSEN diese darüber informieren, dass sie mit KI interagieren
- Abs. 2: Synthetic Audio/Image/Video/Text MÜSSEN als „künstlich erzeugt" gekennzeichnet werden (Wasserzeichen / Metadata)
- Abs. 3: Emotion-Recognition + biometrische Kategorisierung — Information der betroffenen Person
- Abs. 4: Deep Fakes — kennzeichnungspflichtig
- Abs. 5: KI-generierte Texte zu Themen öffentlichen Interesses — Pflicht-Hinweis (außer für redaktionelle Kontrolle, Satire, etc.)

**Audit-Relevanz für JEDES SaaS mit Chatbot oder LLM-Komponente:**
- Sichtbarer KI-Hinweis im Chat-UI (nicht nur in DSE)
- Disclaimer bei medizin-/jurist-/finanz-relevanten Antworten („ersetzt keine fachliche Beratung")
- Bei AI-generated Bildern/Videos: Wasserzeichen oder explizite Kennzeichnung
- Pet-Care AI / Health-Adjacent: Disclaimer „ersetzt keine tier-/ärztliche Beratung"

## Art. 53–55 — General-Purpose-AI (GPAI) Modelle

GPAI-Anbieter (z.B. OpenAI, Anthropic, Mistral) haben spezielle Pflichten:
- Technische Doku
- Transparenz für Downstream-Anwender
- Copyright-Compliance (Art. 53 Abs. 1 lit. c)
- Bei System-Risk-Modellen (>10^25 FLOPs): zusätzliche Anforderungen (Art. 55)

**Audit-Relevanz für Web/SaaS:** Auswahl LLM-Provider — DPA des Anbieters muss EU-AI-Act-konform sein. Anthropic + Mistral haben eigene Compliance-Doku.

## Art. 99 — Sanktionen

- bis 35 Mio. € oder 7% globaler Jahresumsatz: bei Verstößen gegen Art. 5 (verbotene Praktiken)
- bis 15 Mio. € oder 3%: andere Verstöße
- bis 7,5 Mio. € oder 1,5%: falsche Auskünfte

---

## Audit-Mapping (Web/SaaS-Skill-Auto-Loading)

| Audit-Surface | AI-Act-Art. |
|---------------|-------------|
| Chatbot mit User-Interaktion | Art. 50 Abs. 1 |
| AI-generated Content | Art. 50 Abs. 2/4/5 |
| HR-AI / Bewerber-Screening | Annex III Nr. 4 + Art. 6 |
| Kreditwürdigkeits-AI | Annex III Nr. 5 + Art. 6 |
| Bildungs-AI / Coaching-Bewertung | Annex III Nr. 3 + Art. 6 |
| Health-Adjacent AI | je nach Use-Case + Art. 50 |
| LLM-Provider-Auswahl | Art. 53–55 (Provider-Pflichten) |
| Verbotene KI | Art. 5 (sofort prüfen) |
