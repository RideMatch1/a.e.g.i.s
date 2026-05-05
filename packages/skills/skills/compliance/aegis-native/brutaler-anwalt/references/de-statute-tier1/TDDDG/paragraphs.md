---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/tdddg/
last-checked: 2026-05-05
purpose: TDDDG (vormals TTDSG) — Cookie-/Endgerät-Layer-Datenschutz; relevante Paragraphen mit Audit-Mapping. Gilt seit 14.05.2024 (vorher TTDSG seit 01.12.2021).
---

# TDDDG — Kern-Paragraphen

> Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG).
> Vormals TTDSG, umbenannt zum 14.05.2024 (DSA-Anpassungsgesetz).
> Volltext: https://www.gesetze-im-internet.de/tdddg/
> EU-Hintergrund: ePrivacy-RL 2002/58/EG; DSGVO ergänzend.

## §§ 1–3 — Anwendungsbereich

**Wortlaut (Kern)**: TDDDG gilt für Telemedien (Webseiten, Apps, SaaS) + Telekommunikation. Regelt Endgerät-Datenschutz + Telekommunikations-Geheimnis + Bestandsdaten-Schutz.

---

## § 25 — Schutz der Privatsphäre bei Endeinrichtungen (Cookies + Mehr)

### § 25 Abs. 1 — Einwilligungspflicht

**Wortlaut**: Speichern von Informationen in der Endeinrichtung des Endnutzers oder Zugriff auf Informationen, die bereits in der Endeinrichtung gespeichert sind, sind nur zulässig, wenn der Endnutzer auf der Grundlage von klaren + umfassenden Informationen eingewilligt hat. **Die Information des Endnutzers + die Einwilligung haben gemäß der DSGVO zu erfolgen** (Art. 4 Nr. 11 + Art. 7 DSGVO).

### § 25 Abs. 2 — Einwilligungs-Ausnahmen

**Wortlaut (Kern)**: Keine Einwilligung erforderlich, wenn:
- **Nr. 1**: alleiniger Zweck = Übertragung einer Nachricht über öffentliches Telekommunikations-Netz,
- **Nr. 2**: Speicherung / Zugriff **unbedingt erforderlich**, um vom Nutzer ausdrücklich gewünschten Telemediendienst zur Verfügung zu stellen.

### § 25 Abs. 3 — Definitionen

**Wortlaut (Kern)**: „Endeinrichtung" = Endgerät (PC, Smartphone, Browser, App, IoT-Gerät). Erfasst werden alle Speicher-/Auslese-Vorgänge:
- Cookies,
- LocalStorage / SessionStorage,
- IndexedDB,
- Service-Worker-Cache,
- Pixel-Tracker (Auslesen Browser-Eigenschaften),
- Browser-Fingerprinting,
- IP-Hashing in Endgerät,
- Token-Speicher.

**Audit-Relevanz**:
- Cookie-Banner Pflicht-Trigger
- Pre-checked-Boxen unzulässig (EuGH C-673/17 „Planet49" + BGH I ZR 7/16)
- Reject-All gleichwertig zu Accept-All (EDPB Guidelines 03/2022)
- Funktionale Cookies (Login-Session, Warenkorb, Sprachwahl, CSRF-Token): Abs. 2 Nr. 2 — keine Einwilligung
- Session-Recording / A/B-Testing / Heat-Map: KEIN Abs.-2-Nr.-2-Fall → Einwilligung nötig
- Marketing-Pixel (Meta, Google Ads, TikTok): immer Einwilligung

---

## § 26 — Anerkannte Einwilligungs-Verwaltungsdienste (PIMS)

**Wortlaut (Kern)**: Möglichkeit für „universelle" Cookie-Einwilligungs-Verwaltung. Verordnung der Bundesregierung soll Anforderungen + Anerkennungs-Verfahren festlegen — Stand 2026: Verordnungs-Entwurf BMI 2024 noch nicht in Kraft.

**Audit-Relevanz**: in Praxis 2026 noch nicht aktiv genutzt — Stand der Verordnungsentwicklung beobachten.

---

## § 24 — Telekommunikations-Inhaltsdaten

**Wortlaut (Kern)**: Schutz Telekommunikations-Geheimnis + Inhaltsdaten gegenüber Telekommunikations-Diensteanbietern. Eingriff nur unter strengen Voraussetzungen (Strafverfolgung, Sicherheits-Behörden).

---

## § 28 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer gegen § 25 (Cookies / Endgerät-Schutz) oder weitere TDDDG-Vorschriften verstößt.

**§ 28 Abs. 5 — Bußgeld-Rahmen**:
- Standardfall: bis **300.000 €** pro Verstoß
- in besonders schweren Fällen + bei VLOP-Größe: höhere Beträge möglich (Verweis auf DSGVO-Sanktionen)

Plus DSGVO-Direkt-Sanktion möglich (Art. 83) bei Cookie-Daten als personenbezogene Daten.

**Audit-Relevanz**: BfDI / Landesdatenschutzbehörden + Verbraucherzentralen aktiv (Hamburgischer DSB, BayLDA, BlnDB).

---

## Migration-Tabelle (TTDSG → TDDDG)

Inhalt identisch, nur umbenannt zum 14.05.2024.
- TTDSG § 25 → TDDDG § 25 (Cookies)
- TTDSG § 24 → TDDDG § 24 (Inhaltsdaten)

Skill-Output: stets „TDDDG" zitieren (TTDSG nur als historischer Hinweis bei alten Az.).
