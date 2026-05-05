---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: RDG Audit-Relevance — Legal-Tech, KI-Rechts-Tools, Inkasso-Plattformen.
---

# RDG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites/Apps für:
- KI-/AI-basierte Vertrags-Generatoren
- AGB-Generator-Tools (Smartlaw-Modell)
- Mietsenkungs-/Verbraucher-Klage-Plattformen
- Inkasso-Tools / Forderungs-Aggregatoren
- Compliance-/Datenschutz-Tools mit „Beratungs"-Element
- Legal-AI-Chatbots (ChatGPT-/Claude-basierte Beratungs-Apps)
- Steuer-/Buchhaltungs-Tools mit rechtlichen Empfehlungen

## Trigger im Code/UI

- **„Wir empfehlen Ihnen rechtlich…"** in App-Output → § 2 + § 3 (Einzelfall-Beratung)
- **AI-generated legal advice** für individuelle Sachverhalte → § 3
- **Inkasso-Geschäft** ohne § 10-Registrierung → § 10 + § 20
- **„Wir prüfen Ihren Fall"** + AI-Output → § 2 (Einzelfall-Prüfung) → § 3
- **„Wir reichen für Sie Klage ein"** ohne Anwaltskooperation → § 3
- **Sammelklage-Plattform** ohne Inkasso-Lizenz → § 3 + § 10

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| RDL ohne Erlaubnis | § 3 + § 20 | bis 50.000 € + Vertrag nichtig (§ 134 BGB) | § 20 Abs. 2 RDG |
| Inkasso ohne Reg | § 10 + § 20 | bis 50.000 € | § 20 Abs. 2 RDG |
| Inkasso-Verbraucherschutz | § 16 + § 20 | bis 50.000 € | § 20 Abs. 2 RDG |
| Folgen Honorar-Forderung | § 134 BGB | Honorar nicht einklagbar | § 134 BGB i.V.m. § 3 RDG |

UWG-§-3a-Abmahnung-Risiko: Anwaltskammern + RAK-Regional-Stellen abmahnen sehr aktiv gegen § 3-Verstöße.

## Top-Az.

- **BGH I ZR 14/19 „Smartlaw"** (09.09.2021) — Vertrags-Generator KEIN RDG-Verstoß bei Baustein-Modell ohne Einzelfall-Prüfung
- **BGH VIII ZR 285/18 „LexFox / WenigerMiete"** (27.11.2019) — Inkasso-Modell-Aggregator zulässig
- **BGH II ZR 84/17 „myRight / Sammelklage"** — Aggregator zulässig unter § 10 Inkasso
- **BGH I ZR 158/21** — Legal-Tech-Beratungs-Tools im Grenzbereich
- **OLG Köln 6 U 96/20** — Vertragsgenerator nahe Einzelfall-Beratung

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/AI-Act-2024-1689/` Annex III für KI-Recht-Tools (Hochrisiko bei Justiz-Anwendung)
- `references/gesetze/UWG/audit-relevance.md` § 3a (RDG-Verstöße abmahnbar)
- `references/gesetze/StGB/` § 263 (Betrug) bei Massen-RDL-Modell-Missbrauch
- `references/audit-patterns.md` Phase 5h für AI-Tool-Audit-Surface

## Smartlaw-Maßstab — Compliance-Pfad für Legal-Tech

**Erlaubt** (RDG-frei) wenn:
1. Nur Auswahl aus vorgefertigten Bausteinen / Templates
2. Keine individuelle Sachverhalts-Bewertung durch Tool
3. User trifft selbst Auswahl-Entscheidungen
4. Disclaimer „kein Rechtsrat" + Anwalt-Empfehlung

**§ 3-Verstoß** wenn:
1. Tool sagt „dieser Sachverhalt führt zu folgender rechtlicher Bewertung"
2. AI-Chatbot beantwortet individuelle Rechtsfragen mit Empfehlung
3. Tool ergreift Maßnahmen für individuellen Nutzer (Klage einreichen, Mahnung versenden)
4. Forderungs-Eintreibung ohne Inkasso-Lizenz § 10

## KI-Recht-Tool — Doppelter Compliance-Layer

1. **RDG**: Einzelfall-Beratungs-Disclaimer + Baustein-Modell strikt
2. **AI Act**: ggf. Hochrisiko-System (Annex III Nr. 8 Justiz-Anwendung)
3. **DSGVO Art. 22**: automatisierte Einzel-Entscheidung-Verbot bei Recht
4. **Verträge nach § 134 BGB-Risiko**: Honorar-Forderung nichtig

## Praktischer Audit-Checklist

- [ ] Tool-Output bleibt auf Bausteinen-Auswahl (kein „rechtlicher Rat")
- [ ] User-Disclaimer „nicht-individueller Rechtsrat / Anwalt empfohlen"
- [ ] Bei Inkasso: § 10-Registrierung beim LG-Präsidenten
- [ ] AI-Chatbot mit Hard-Stop-Liste für Einzelfall-Recht-Anfragen
- [ ] Anwalts-Kooperations-Vertrag bei rechts-nahen Tools
- [ ] AGB enthalten klare Tool-Beschränkung (kein Rechtsrat)
- [ ] Aufsichtsbehörde-Hinweis bei Inkasso (§ 16)
