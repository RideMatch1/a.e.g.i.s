---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065
last-checked: 2026-05-02
purpose: DSA Art. 19 KMU-Privileg + Pflichten kleiner Online-Plattformen.
---

# DSA — KMU-Plattform-Pflichten + Art. 19 Privileg

> Kernframework fuer kleine UGC-Plattformen ohne VLOP-Status.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065

## Schwellenwerte

| Plattform-Typ | Schwelle |
|---|---|
| **Vermittlungsdienst** (Mere Conduit, Caching, Hosting) | alle |
| **Hosting-Provider** | alle die Inhalte fuer User speichern |
| **Online-Plattform** | Hosting + Verbreitung an Oeffentlichkeit (Marketplace, Social Media) |
| **KMU-Plattform** | unter Art. 19 Schwelle: < 50 MA + < 10 Mio. EUR Umsatz / Bilanzsumme |
| **VLOP** | >= 45 Mio. EU-User monatlich |

## Art. 19 KMU-Privileg

Online-Plattformen **unter** der KMU-Schwelle sind **befreit** von:
- Art. 20 (Internes Beschwerdemanagement)
- Art. 21 (Aussergerichtliche Streitbeilegung)
- Art. 22 (Trusted Flaggers)
- Art. 23 (Massnahmen gegen Missbrauch)
- Art. 24 (Transparenzberichte)
- Art. 25 (Dark-Pattern-Verbot — Pflicht aber NICHT)
- Art. 26 (Werbe-Transparenz Pflicht aber NICHT)

**Trotzdem Pflicht** fuer KMU-Plattformen:
- Art. 14 (AGB-Pflichten)
- Art. 16-17 (Notice-and-Action + Statement of Reasons)
- Art. 18 (Strafverdacht melden)

## Pflichten fuer JEDEN Hosting-Provider (auch kleinste)

Selbst der kleinste UGC-Hoster (Forum mit 100 Usern, Klein-Marketplace mit 5 Anbietern):

| Pflicht | Surface |
|---|---|
| Art. 14 — AGB transparent | AGB |
| Art. 16 — Notice-Endpoint | API-Route |
| Art. 17 — Statement of Reasons | Email/UI |
| Art. 18 — Strafverdacht-Meldung | interne Procedure |

## Pflichten erst ab Online-Plattform-Status

| Pflicht | Trigger |
|---|---|
| Art. 14 + zusaetzliche AGB-Klauseln | Online-Plattform |
| Art. 30 — Marktplatz-Trader-KYC | Marketplace |
| Art. 28 — Kinderschutz | Site die Minderjaehrige adressiert |

## Audit-Frage-Kette (Skill-Decision-Tree)

```
1. Ist die Site Hosting-Provider? (User-Inhalte werden gespeichert?)
   ├─ NEIN → DSA nicht anwendbar (Vermittlungs-RL aber moeglich)
   └─ JA → weiter

2. Ist die Site Online-Plattform? (Inhalte werden auch oeffentlich verbreitet?)
   ├─ NEIN → nur Hosting-Pflichten (Art. 14 + 16-18) anwenden
   └─ JA → weiter

3. Ist die Plattform KMU-privilegiert? (< 50 MA + < 10 Mio. EUR)
   ├─ JA → Art. 14 + 16-18 + (ggf. Art. 28 wenn Kinder-Adressat) + (ggf. Art. 30 wenn Marketplace)
   └─ NEIN → Vollstaendige Online-Plattform-Pflichten Art. 19-29
                ├─ Plus VLOP-Schwelle (45 Mio. EU-User)?
                ├─ JA → Art. 33-43 zusaetzlich
                └─ NEIN → KEIN VLOP-Stack
```

## Audit-Pattern fuer KMU-UGC-Plattform

```bash
# 1. Notice-and-Action-Endpoint — Pflicht egal wie klein
curl -X POST https://example.com/api/report -d '{...}' -i
# Erwartung: 200/202 oder 401 (Auth ok)

# 2. AGB-Pflichten Art. 14
curl -s https://example.com/agb | grep -ic "moderation\|inhaltsmoderation\|notice"

# 3. KMU-Privileg ueberprüfen (Operator-Indication)
# Skill stellt Klaerungsfrage: „Hat Plattform-Betreiber > 50 MA oder > 10 Mio. EUR Umsatz?"

# 4. Wenn KMU: Pflichten reduzieren
# Wenn nicht-KMU: vollstaendige Online-Plattform-Pflichten anwenden
```

## Sanktionen

DDG §§ 18-22 + Art. 52 DSA:
- KMU: bis 50.000 EUR pro Verstoss
- Non-KMU + Non-VLOP: bis 6% Jahresumsatz nicht direkt anwendbar (KOM-Aufsicht erst ab VLOP); DSC kann Bussgeld nach DDG verhaengen
- Mehrfache Verstoesse koennen kumulieren

## Cross-Reference

- Audit-Patterns Phase 5c (UGC-PII) : `references/audit-patterns.md`
- Branchenrecht.md Marketplace-Section: `references/branchenrecht.md`

## Source

- [eur-lex.europa.eu — VO 2022/2065 Art. 19 + Art. 14-18](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065)
- [DDG §§ 18-22 (DE-Umsetzung)](https://www.gesetze-im-internet.de/ddg/)
