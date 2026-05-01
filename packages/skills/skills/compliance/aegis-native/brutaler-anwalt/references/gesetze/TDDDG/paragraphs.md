---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/tdddg/
last-checked: 2026-05-01
purpose: TDDDG (vormals TTDSG) — relevante Paragraphen mit Audit-Mapping. Gilt seit 14.05.2024 (vorher TTDSG seit 01.12.2021).
---

# TDDDG — Audit-relevante Paragraphen

> Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG).
> Vormals TTDSG, umbenannt zum 14.05.2024 (DSA-Anpassungsgesetz).
> Volltext: https://www.gesetze-im-internet.de/tdddg/

## § 25 — Schutz der Privatsphäre bei Endeinrichtungen (Cookies)

### Abs. 1 — Einwilligungspflicht
Speichern oder Auslesen von Informationen in der Endeinrichtung des Endnutzers darf NUR mit:
- Einwilligung des Endnutzers (Art. 4 Nr. 11 + Art. 7 DSGVO)
- nach klarer und umfassender Information

### Abs. 2 — Einwilligungs-Ausnahmen
Keine Einwilligung erforderlich wenn:
- Nr. 1: alleiniger Zweck = Übertragung einer Nachricht
- Nr. 2: unbedingt erforderlich, um Telemediendienst auf ausdrücklichen Wunsch des Nutzers zu erbringen

### Abs. 3 — Definitionen
„Endeinrichtung" = Endgerät (Browser, App).

**Audit-Relevanz:**
- Cookie-Banner Pflicht-Trigger
- Pre-checked-Boxen unzulässig (EuGH C-673/17 Planet49 + BGH I ZR 7/16)
- Reject-All gleichwertig zu Accept-All (EDPB Guidelines 03/2022)
- LocalStorage / SessionStorage / IndexedDB / Service-Worker-Cache fallen ebenfalls unter Abs. 1 (sind „Speichern in Endeinrichtung")
- Pixel-Tracker / Browser-Fingerprinting → ebenfalls Abs. 1 (Auslesen)
- Funktionale Cookies (Login-Session, Warenkorb, Sprachwahl): Abs. 2 Nr. 2 — keine Einwilligung
- Session-Recording / A/B-Testing: KEIN Abs.-2-Nr.-2-Fall → Einwilligung nötig

## § 26 — Anerkannte Einwilligungs-Verwaltungsdienste (PIMS)

Möglichkeit für „universelle" Cookie-Einwilligungs-Verwaltung. In Praxis 2026 noch nicht aktiv genutzt — Stand der Verordnungsentwicklung beobachten.

## §§ 1–3 — Anwendungsbereich

§ 1 + § 2: gilt für Telemedien (= Webseiten, Apps, SaaS) — alle digitalen Dienste außer reine Telekommunikation.
§ 3: Begriffsbestimmungen.

---

## Audit-Mapping (Skill-Auto-Loading)

| Audit-Surface | TDDDG-§ |
|---------------|--------|
| Cookie-Banner | § 25 Abs. 1 |
| LocalStorage-Tracking | § 25 Abs. 1 |
| Funktionale Cookies (Session) | § 25 Abs. 2 Nr. 2 |
| Pre-Tick-Boxen | § 25 Abs. 1 + EuGH C-673/17 |
| Reject-All-Button | § 25 Abs. 1 + EDPB Guidelines 03/2022 |
| Browser-Fingerprinting | § 25 Abs. 1 |
| Server-Side-Tracking | § 25 Abs. 1 (wenn Trigger im Browser) |

## Migration-Tabelle (TTDSG → TDDDG)

Inhalt identisch, nur umbenannt zum 14.05.2024.
- TTDSG § 25 → TDDDG § 25 (Cookies)
- TTDSG § 24 → TDDDG § 24 (Inhaltsdaten)

Skill-Output: stets „TDDDG" zitieren (TTDSG nur als historischer Hinweis bei alten Az.).
