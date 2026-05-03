---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065
last-checked: 2026-05-02
purpose: DSA Audit-Relevance — Auto-Loading-Trigger und Pflicht-Surfaces.
---

# DSA — Audit-Relevance fuer brutaler-anwalt

## Wann triggert dieser Skill den DSA-Layer?

Auto-Loading-Trigger:

```
1. URL-Pattern-Detection:
   - /forum, /community, /board (UGC-Forum)
   - /marketplace, /kleinanzeigen, /shop-by-trader (Marketplace)
   - /profile/[user], /u/[user] (User-Profil)
   - /post/[id], /article/[id], /thread/[id] (User-Generated-Content)
   - /comments, /reviews (User-Comments)

2. Page-Content-Detection:
   - "User-Reviews" / "Inserate" / "Anbieter" / "kostenlos einstellen"
   - DOM-Probe: `<form action*="report">`

3. Tech-Stack-Detection:
   - Strapi / Sanity / Contentful (CMS mit User-Submission)
   - WordPress + Forum-Plugin
   - Reddit-Style-Plattform-Frameworks
```

## Pflicht-Surfaces nach Plattform-Typ

### Surface 1 — Vermittlungsdienst (Mere Conduit / Caching)

| Pflicht | Quelle |
|---|---|
| AGB (Art. 14) | DDG § 14 |
| Pruefung auf Hosting-Privileg (DDG §§ 7-10) | bgh-urteile.md C-682/18 YouTube |

### Surface 2 — Hosting-Provider (alle)

| Pflicht | Quelle | Verify |
|---|---|---|
| AGB-Inhaltsmoderations-Kriterien | DSA Art. 14 | grep agb |
| Notice-and-Action-Endpoint | DSA Art. 16 | curl POST |
| Statement of Reasons | DSA Art. 17 | UI-Audit |
| Strafverdacht-Meldung | DSA Art. 18 | interne Procedure |

### Surface 3 — Online-Plattform (Hosting + Public-Distribution, > KMU)

zusaetzlich:
| Pflicht | Quelle |
|---|---|
| Internes Beschwerdemanagement | Art. 20 |
| Aussergerichtliche Streitbeilegung | Art. 21 |
| Trusted Flaggers | Art. 22 + `trusted-flaggers.md` |
| Suspension-bei-Missbrauch | Art. 23 |
| Transparenzbericht | Art. 24 |
| Dark-Pattern-Verbot | Art. 25 |
| Werbe-Transparenz | Art. 26 |
| Empfehlungs-System Erklaerung | Art. 27 |
| Kinderschutz | Art. 28 |

### Surface 4 — Marketplace

zusaetzlich:
| Pflicht | Quelle |
|---|---|
| Trader-KYC | Art. 30 |
| Trader-Compliance-by-Design | Art. 31 |
| Information an Verbraucher | Art. 32 |

### Surface 5 — VLOP (>= 45 Mio. EU-User)

zusaetzlich Art. 33-43 — siehe `vlop-vlose.md`

## Audit-Pattern (Skill-Output-Vorschlag)

```
**Finding**: UGC-Plattform ohne Notice-and-Action-Endpoint
**Wahrsch.**: 90% (DSC-Behoerdenpruefung seit 2024 angelaufen, jeder Hosting-Provider Pflicht)
**Kritikalitaet**: 🔴 KRITISCH
**§**: Art. 16 DSA + § 18 DDG
**€-Range KMU**: 5.000–50.000 EUR (nach DDG-Bussgeldrahmen)
**Belege**:
- VO 2022/2065 Art. 16
- DDG § 18 (DE-Umsetzung)
**Fix**: API-Route `/api/<board>/<id>/report` implementieren mit Pflicht-Feldern
(reason, url, goodFaithDeclaration). Code-Pattern siehe `references/gesetze/EU-Verordnungen/DSA-2022-2065/notice-and-action.md`
```

## Cross-References

| Wenn HUNTER findet... | Lade zusaetzlich... |
|---|---|
| UGC-Plattform mit Public-PII | `audit-patterns.md` Phase 5c |
| Marketplace mit Multi-Trader | `branchenrecht.md` Marketplace-Section + Art. 30 |
| Influencer / Affiliate-Werbung | `audit-patterns.md` Phase 6 + `branchenrecht.md` Influencer-Section |
| KI-gestuetzte Empfehlungen | Cross zu AI-Act + DSA Art. 27 |
| Kinder-adressierte Plattform | DSA Art. 28 + JuSchG/JMStV (siehe `gesetze/JuSchG-JMStV/`) |

## Source

- [eur-lex.europa.eu — VO 2022/2065](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065)
- [DDG (DE-Umsetzung)](https://www.gesetze-im-internet.de/ddg/)
- [DSA Transparency Database](https://transparency.dsa.ec.europa.eu/)
