---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: TDDDG Audit-Relevance — Cookie-/Endgerät-Layer.
---

# TDDDG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDER Site mit:
- Cookie-Banner
- LocalStorage / SessionStorage / IndexedDB
- Browser-Fingerprinting
- Service-Worker
- Tracking-Scripts (GA, Matomo, Plausible, Meta Pixel, TikTok Pixel)
- Session-Recording (Hotjar, FullStory, LogRocket)
- A/B-Testing (Optimizely, Google Optimize, VWO)
- Server-Side-GTM mit Browser-Trigger
- IoT-Gerät mit Telemetrie

## Trigger im Code/UI

- **Cookie-Banner mit Pre-Tick** → § 25 Abs. 1 + EuGH C-673/17
- **„Reject-All"-Button visuell schwächer** als Accept → § 25 + EDPB-Guideline 03/2022
- **Tracking-Pixel auf Page-Load** vor Consent → § 25 Abs. 1
- **LocalStorage-Set** vor Consent (z.B. _ga in localStorage) → § 25 Abs. 1
- **Marketing-Cookie als „technisch notwendig" deklariert** → § 25 Abs. 2 Nr. 2 fail
- **Server-Side-GTM ohne Frontend-Consent-Sync** → § 25 Abs. 1 (wenn Trigger im Browser)
- **Session-Recording ohne explizite Einwilligung** → § 25 Abs. 1
- **Browser-Fingerprinting für Fraud-Detection** ohne Einwilligung (Einzelfall-Abwägung) → § 25

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Cookie ohne Einwilligung | § 25 Abs. 1 + § 28 | bis 300.000 € + DSGVO-Bußgeld bis 4 % Umsatz | § 28 TDDDG + DSGVO Art. 83 |
| Pre-Tick / unklare Belehrung | § 25 + § 28 | bis 300.000 € + UWG-Abmahnung | § 28 TDDDG |
| Reject-All-Asymmetrie | § 25 + § 28 | bis 300.000 € + UWG-Abmahnung | § 28 TDDDG |

UWG-§-3a-Abmahnung-Risiko erheblich: Verbraucherzentrale Bundesverband, vzbv, regionale Stellen abmahnen aktiv.

## Pflicht-Surfaces

| Surface | TDDDG-§ |
|---|---|
| Cookie-Banner | § 25 Abs. 1 |
| LocalStorage-Tracking | § 25 Abs. 1 |
| Funktionale Cookies (Session) | § 25 Abs. 2 Nr. 2 |
| Pre-Tick-Boxen | § 25 Abs. 1 + EuGH C-673/17 |
| Reject-All-Button | § 25 Abs. 1 + EDPB Guidelines 03/2022 |
| Browser-Fingerprinting | § 25 Abs. 1 |
| Server-Side-Tracking | § 25 Abs. 1 (wenn Trigger im Browser) |

## Top-Az.

- **EuGH C-673/17 Planet49** (01.10.2019) — Pre-Tick-Box keine wirksame Einwilligung
- **BGH I ZR 7/16** (28.05.2020) — Cookie-Einwilligungs-Pflicht
- **EuGH C-129/21 Proximus** — Cookie-Daten als personenbezogene Daten
- **OLG Köln 6 U 88/22** — Reject-All-Asymmetrie
- **CNIL/Frankreich Bußgeld Google + Meta 2022** (€ 60-150 Mio) — vergleichbarer EU-Maßstab
- **BlnBDI Bußgeld Vodafone 2025** — Cookie-Banner-Defizite

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/ePrivacy-RL-2002-58/` direkte EU-Norm
- `references/dsgvo.md` Art. 6 + Art. 7 (Einwilligung)
- `references/gesetze/EU-Verordnungen/ePrivacy-VO-Entwurf/` (in Planung; ersetzt RL 2002/58)
- `references/audit-patterns.md` Phase 5 für Cookie-Audit-Surface

## Cookie-Banner-Compliance — technischer Pfad

- Default-State: Tracking-Cookies NICHT gesetzt
- Banner-Layer-1: kurze Info + 3 Buttons („Akzeptieren", „Ablehnen", „Einstellungen")
- Reject-All gleichwertig zu Accept-All (gleiche visual prominence)
- Settings-Layer: granulare Opt-Ins pro Cookie-Kategorie
- Speicherung Consent-Beweis (Datum, Version, IP-Hash)
- Widerruf jederzeit möglich (Footer-Link „Cookie-Einstellungen")
- Re-Consent nach max. 6-13 Monaten (Best-Practice)
- Server-Side-GTM: Frontend-Consent-Token in Request-Header / cookieless ID

## Praktischer Audit-Checklist

- [ ] Banner verzögert kein Tracking pre-Consent
- [ ] Reject-All visuell + funktional gleichwertig
- [ ] Pre-Tick = OFF (kein Default-Opt-In)
- [ ] Granulare Optionen (Funktional / Statistik / Marketing)
- [ ] Consent-Speicherung mit Beweisbarkeit
- [ ] Widerruf-Link sichtbar (Footer)
- [ ] Browser-Fingerprinting-Tools im Banner gelistet
- [ ] Server-Side-Trigger respektiert Frontend-Consent
- [ ] DSE deckt Cookie-Liste mit Zweck + Speicherdauer
