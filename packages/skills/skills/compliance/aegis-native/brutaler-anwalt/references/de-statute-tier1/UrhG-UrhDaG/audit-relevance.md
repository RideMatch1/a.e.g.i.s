---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: UrhG + UrhDaG Audit-Relevance — Asset-Lizenzierung, Plattform-Pflichten, Stock-Image-Risiko.
---

# UrhG + UrhDaG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites/Apps mit:
- Stock-Bildern / Pexels-/Unsplash-Nutzung
- AI-generierten Bildern (Provenienz unsicher)
- Custom-Code (Copyleft-Lizenz-Compliance)
- UGC-Plattformen (Foren, Marketplaces, Profile-Sites)
- Social-Media-Sharing-Funktionen
- News-Aggregator-Funktionen
- Parodie-/Meme-Plattformen
- KI-Trainings-Daten-Verarbeitung

## Trigger im Code/UI

- **Stock-Bild ohne Lizenz-Beleg** im CDN → § 19a + § 97
- **Open-Source-Library mit Copyleft** (GPL/AGPL) ohne Lizenz-Hinweis → § 69c (Software) + GPL-Verstoß
- **„Sourced from Web"** Bilder ohne Provenance → § 97 Schadensersatz-Risiko
- **YouTube-/Spotify-Embed ohne Verträge** → § 19a (außer iframe = direkt vom Provider)
- **News-Snippet-Aggregator** ohne Press-Lizenz → § 87f
- **AI-Image-Generator-Output** ohne Trainingsdaten-Klärung → unklar; § 97-Risiko bei „im Stil von X"
- **Plattform für Nutzer-Uploads** ohne Filter / Lizenz-Vertrag → UrhDaG §§ 4-8
- **„Eigene Werk"-Pre-Flag-Funktion** fehlt für UGC → UrhDaG § 11

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Stock-Image ohne Lizenz | § 19a + § 97 Abs. 2 | typisch € 1.000-3.000 pro Bild (Lizenzanalogie) | § 97 + BGH-Praxis |
| Software-Code-Klau (GPL-Verstoß) | § 69c + § 97 | Lizenzanalogie + Auskunft + Beseitigung | § 97 UrhG |
| Strafrecht Vorsatz | § 106 | Freiheitsstrafe bis 3 Jahre | § 106 UrhG |
| UrhDaG-Plattform Verstoß | UrhDaG § 4 + § 21 | bis 5 % weltweiter Jahresumsatz | UrhDaG § 21 |
| Abmahn-Kosten | § 97a | bei Privat einfache Verletzung max. 1.000 € Gegenstandswert | § 97a Abs. 3 UrhG |

## Top-Az.

- **EuGH C-310/17 Levola Hengelo** — Werksbegriff
- **EuGH C-516/17 Spiegel Online** — Pressezitat
- **EuGH C-401/19** — UrhDaG-RL-Vorlage zu Art. 17
- **BGH I ZR 113/06** — Stock-Image Lizenzanalogie
- **BGH I ZR 73/19 „YouTube"** — Plattform-Haftung pre-UrhDaG
- **OLG Köln 6 U 105/22** — UrhDaG-Pre-Flag-Anwendung
- **EuGH C-264/19** — DRM-Umgehung-Verbote

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/DSM-RL-2019-790/` direkte EU-Norm
- `references/gesetze/EU-Verordnungen/DSA-2022-2065/` für Plattform-Notice-and-Action
- `references/gesetze/DDG/` § 10 für Hosting-Privileg-Abgrenzung
- `references/gesetze/AI-Act-2024-1689/` Art. 53 für KI-Trainings-Daten-Transparenz
- `references/audit-patterns.md` Phase 6 (Asset-/Lizenz-Audit-Surface)

## Asset-Lizenz-Compliance — technischer Pfad

1. **Bild-Lizenz-DB**: pro Asset Lizenz-URL + Bezugsquelle + Datum
2. **Stock-Provider-Vertrag**: AGB lesen — was ist „Editorial only" / „Commercial Use"?
3. **AI-Image**: Trainingsdaten-Provenienz-Frage — bei Stable Diffusion / Midjourney unklar; § 97-Risiko bei Stil-Imitation echter Künstler
4. **Code-Lizenz**: SBOM (Software Bill of Materials) generieren mit Lizenz-Spalte
5. **GPL/AGPL-Compliance**: Source-Code-Pflicht bei Distribution / Public-Use
6. **Music / Video Embed**: nur über offizielle Embed-Player des Rechteinhabers (YouTube-iframe, Spotify-Player) → eigentliche Wiedergabe erfolgt Provider-seitig

## UrhDaG-Compliance für UGC-Plattformen

- [ ] Lizenz-Verträge mit Verwertungsgesellschaften (GEMA, VG Wort, GVL)
- [ ] Hash-/Fingerprint-Filter für Upload-Erkennung (z.B. ContentID-Modell)
- [ ] Pre-Flag-Funktion für Nutzer („eigenes Werk", „Zitat", „Parodie")
- [ ] Bagatell-Erkennung (≤ 50 % Bild, ≤ 15s Audio/Video, ≤ 160 Zeichen Text)
- [ ] Rechtsbeschwerde-Endpoint mit 1-Woche-Reaktionszeit
- [ ] Aufsichts-Kontakt zu BNetzA
- [ ] BfArM-Hinweis zur Direkt-Vergütung Urheber (§ 18)
- [ ] AGB enthalten Hinweis auf UrhDaG + Pre-Flag-Modus
- [ ] Beschwerde-Stelle (siehe DDG § 18 SPoC)

## KI-Spezifika

- **Trainings-Daten**: TDM-Schranken §§ 44b, 60d UrhG für Wissenschaft + KI-Training; Opt-Out durch Rechteinhaber (machine-readable, robots.txt-Modus)
- **AI-Output**: KEIN urheberrechtlicher Schutz für reine KI-Erzeugnisse (mangels persönlicher Schöpfung) — aber ggf. § 97-Verstoß bei Stil-Imitation
- **AI Act Art. 53**: Foundation-Model-Anbieter müssen Trainings-Daten-Transparenz-Liste veröffentlichen ab 02.08.2025
