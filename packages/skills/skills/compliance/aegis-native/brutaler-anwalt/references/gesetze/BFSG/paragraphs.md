---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/bfsg/
last-checked: 2026-05-01
purpose: BFSG — Barrierefreiheits-Stärkungsgesetz, Pflicht seit 28.06.2025 für B2C-Online-Angebote.
---

# BFSG — Audit-relevante Paragraphen

> Barrierefreiheits-Stärkungsgesetz, BGBl. I 2021 S. 2970, in Kraft seit **28.06.2025**.
> Volltext: https://www.gesetze-im-internet.de/bfsg/
> Setzt EU-Richtlinie 2019/882 (European Accessibility Act) in deutsches Recht um.

## § 1 — Anwendungsbereich

Gilt für Produkte + Dienstleistungen, die Verbrauchern angeboten werden.

## § 2 — Begriffsbestimmungen

Erfasste Dienstleistungen:
- Bankdienstleistungen
- Personenbeförderungs-Apps
- E-Books
- E-Commerce (Webshops, Online-Buchungssysteme, Apps mit Vertragsabschluss)
- Telekommunikationsdienste
- Audiovisuelle Mediendienste

## § 3 — Mikrounternehmen-Ausnahme

Kein BFSG für Unternehmen die ALLE Bedingungen erfüllen:
- < 10 Beschäftigte UND
- Jahresumsatz < 2 Mio. EUR ODER Bilanzsumme < 2 Mio. EUR

**Wichtig:** B2B-only-Angebote sind ebenfalls **außerhalb** des BFSG (gilt nur für B2C).

## § 4 — Pflichten für Wirtschaftsakteure

Produkte + Dienstleistungen müssen barrierefrei sein.

## § 5 — Konformitätsbewertung

Nachweis durch:
- EU-Konformitätserklärung (für Produkte)
- Selbsterklärung der Barrierefreiheit (für Dienstleistungen)

## § 14 — Durchsetzung (BfArM-Pflichten als Marktüberwachungsbehörde)

Bei Verstoß: Aufforderung zur Mängelbeseitigung, ggf. Bußgeld (BFSG §§ 18–22).

## § 18 — Bußgelder

Bis **100.000 €** je Verstoß.

**Audit-Relevanz für Webshops + SaaS:**

| Pflicht-Anforderung | WCAG-Anker | Verify |
|---------------------|------------|--------|
| Wahrnehmbarkeit (Alt-Text, Farb-Kontrast ≥ 4.5:1) | WCAG 2.1 Level AA | Lighthouse-Score ≥ 80 |
| Bedienbarkeit (Tastatur-Navigation, Skip-Links) | WCAG 2.1 Level AA | axe-core / pa11y |
| Verständlichkeit (Sprache deklariert, klare Labels) | WCAG 2.1 Level AA | manuelles Audit |
| Robustheit (semantische HTML, ARIA korrekt) | WCAG 2.1 Level AA | axe-core |
| Erklärung zur Barrierefreiheit | § 12 BITV 2.0 | Footer-Link „Barrierefreiheit" |
| Feedback-Mechanismus | § 12 BITV 2.0 | Kontakt für Barriere-Meldung |

**Source-URL Wettbewerbszentrale (Branchen-Leitfaden):** https://www.wettbewerbszentrale.de/barrierefreiheitsstaerkungsgesetz-gilt-ab-28-juni-2025-was-unternehmen-jetzt-wissen-muessen/

## Erklärung zur Barrierefreiheit (Pflicht-Inhalt)

Pflicht bei Inkrafttreten:
- Stand der Erfüllung der Anforderungen (vollständig / teilweise / nicht)
- Begründung bei Nicht-Konformität (oft: „unverhältnismäßige Belastung")
- Kontakt zur Meldung von Barrieren
- Schlichtungsverfahren bei BfArM (https://www.bfarm.de)

---

## Audit-Mapping

| Audit-Surface | BFSG-§ |
|---------------|--------|
| B2C-Online-Shop | § 1, § 2 |
| Mikrounternehmen-Ausnahme | § 3 |
| Erklärung zur Barrierefreiheit | § 12 BITV 2.0 |
| Bußgeld-Range | § 18 (bis 100.000 €) |
| WCAG-Konformität | implizit über § 4 + Verordnung BITV 2.0 |
