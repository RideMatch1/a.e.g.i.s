---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065
last-checked: 2026-05-01
purpose: Digital Services Act (VO 2022/2065) — Pflichten für Online-Plattformen + UGC-Hosting.
---

# DSA (VO 2022/2065) — Audit-relevante Artikel

> In Kraft seit 17.02.2024 für alle Plattformen.
> VLOPs (Very Large Online Platforms) > 45 Mio. EU-User: schon seit 25.08.2023.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065
> DE-Umsetzung: DDG (Digitale-Dienste-Gesetz, seit 14.05.2024)

## Anwendungsbereich

DSA gilt gestaffelt:
- Vermittlungsdienste (Mere Conduit, Caching, Hosting): alle, Art. 6–18
- **Hosting-Provider** (zusätzlich): Art. 16 (Notice-and-Action)
- **Online-Plattformen**: zusätzlich Art. 19–28 (Marketplace, Social Media, ...)
- **VLOPs (>45 Mio. User)**: zusätzlich Art. 33–43 (Risk Assessment)
- **VLOSEs (Very Large Online Search Engines)**: analog VLOPs

**Audit-Relevanz:** kleine UGC-Sites (Forum, Marketplace) sind „Online-Plattform" wenn nicht „klein" nach Art. 19 (KMU-Privileg < 50 MA + < 10 Mio. € Umsatz).

## Art. 14 — Allgemeine AGB-Pflichten für Vermittlungsdienste

Vermittlungsdienste müssen in AGB:
- Inhaltsmoderations-Kriterien transparent machen
- Algorithmen-Beschreibung (für Online-Plattformen + VLOPs)
- klare + verständliche Sprache

## Art. 16 — Notice-and-Action-Mechanismen

**Pflicht für JEDEN Hosting-Provider (auch klein):**
- Leicht zugänglicher elektronischer Mechanismus zur Meldung rechtswidriger Inhalte
- Pflicht-Felder: Begründung, hinreichend präzise URL, Erklärung des Meldenden, Name + E-Mail

**Audit-Relevanz:**
- UGC-Plattform → `/api/<board>/<id>/report`-Endpoint Pflicht
- Bestätigung an Meldenden
- Begründete Entscheidung an Inhaltsanbieter (Art. 17)
- Statement of Reasons öffentlich machen (Art. 17 Abs. 5 → DSA-Datenbank)

## Art. 17 — Begründung (Statement of Reasons)

Bei Inhaltsentfernung / Sichtbarkeits-Reduktion / Account-Sperre:
- Pflicht: präzise Begründung an Betroffenen
- VLOPs: Statement of Reasons öffentlich in EU-DSA-Database

## Art. 18 — Meldung Strafverdacht
Bei Verdacht auf schwere Straftat: unverzüglich Behörden melden.

## Art. 20 — Internes Beschwerdemanagement-System (für Online-Plattformen)

Plattformen brauchen internes Verfahren für Beschwerden gegen Moderation-Entscheidungen.

## Art. 21 — Außergerichtliche Streitbeilegung

User können nach Art. 21 außergerichtliche Streitbeilegungsstelle anrufen.

## Art. 22 — Trusted Flaggers
Bestimmte Organisationen erhalten priorisierte Notice-Bearbeitung.

## Art. 24 — Transparenzberichte (für Online-Plattformen)

Jährlicher Bericht über:
- Notice-and-Action Volumen
- Eigene Inhaltsmoderation
- Beschwerden + Entscheidungen
- Mediante Algorithmen

## Art. 25 — Dark Patterns verboten

Plattformen dürfen UI nicht so gestalten dass Nutzer manipuliert werden in:
- Auswahl-Entscheidungen
- Konsens-Entscheidungen
- Default-Settings die zum Nachteil sind

**Audit-Relevanz:** Cookie-Banner-UX (gleichwertige Buttons), Subscription-Cancel (Verfügbarkeit „Cancel"-Pfad), Confirmshaming.

## Art. 26 — Werbung-Transparenz

Werbung in Online-Plattformen:
- klar als Werbung erkennbar
- Werbender identifiziert
- Information wer „bezahlt hat"
- Hauptparameter der Personalisierung

## Art. 27 — Empfehlungssysteme

Online-Plattformen müssen Empfehlungs-Algorithmen erklären (mind. eine Option ohne Profiling).

## Art. 28 — Kinderschutz

Werbung an Minderjährige basierend auf Profiling **verboten**.

## Art. 30 — Marktplatz-Pflichten

Marketplace-Plattformen müssen Trader-Verifikation:
- Name, Anschrift, Telefon, E-Mail
- USt-ID
- Selbstzertifizierung (nur eigene Produkte)
- Gewerbliche / private Trader unterscheiden

**Audit-Relevanz:** Marketplace-Sites (Kleinanzeigen, Pet-Marketplace) müssen Trader-Onboarding mit KYC implementieren.

## Art. 33 — Sehr große Online-Plattformen (VLOPs)
> 45 Mio. EU-monatliche-Nutzer. Zusätzliche Pflichten Art. 34–43 (Risk Assessment, Audit, Krise-Response).

## Art. 52 — Sanktionen

DE-Umsetzung in DDG §§ 18–22:
- bis 6% globaler Jahresumsatz für VLOPs (Art. 52 DSA)
- KMU-Plattformen: bis 50.000 € pro Verstoß

---

## Audit-Mapping (Skill-Auto-Loading)

| Audit-Surface | DSA-Art. |
|---------------|----------|
| UGC-Plattform | Art. 16 (Notice-and-Action) |
| Marketplace | Art. 30 (Trader-Verifikation) |
| Cookie-Banner-UX (Dark-Pattern) | Art. 25 |
| Subscription-Cancel-UX | Art. 25 |
| Werbe-Kennzeichnung | Art. 26 |
| Kinder-Targeting | Art. 28 |
| AGB Inhaltsmoderation | Art. 14 |
| Empfehlungs-Algorithmus | Art. 27 |
| Beschwerdemanagement | Art. 20 |
