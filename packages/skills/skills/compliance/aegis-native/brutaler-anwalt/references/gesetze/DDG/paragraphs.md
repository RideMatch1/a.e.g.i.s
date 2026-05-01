---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/ddg/
last-checked: 2026-05-01
purpose: DDG (Digitale-Dienste-Gesetz) — vormals TMG seit 14.05.2024. Pflicht-Paragraphen.
---

# DDG — Audit-relevante Paragraphen

> Digitale-Dienste-Gesetz (DDG). Setzt EU-DSA in deutsches Recht um.
> Trat am 14.05.2024 in Kraft, ersetzte das TMG.
> Volltext: https://www.gesetze-im-internet.de/ddg/

## § 5 — Allgemeine Informationspflichten (Impressum)

### Pflicht-Inhalt für jedes Impressum eines geschäftsmäßigen Telemediendienstes:
- Nr. 1: Name + Anschrift (bei jur. Personen: Vertretungsberechtigter)
- Nr. 2: Kontaktangaben (E-Mail + ein weiterer Kontaktweg, z.B. Telefon, Kontaktformular, schnelles Antwortmedium)
- Nr. 3: zuständige Aufsichtsbehörde (sofern erforderlich)
- Nr. 4: Handelsregister + Registernummer (bei jur. Personen)
- Nr. 5: Berufsbezeichnung + Staat + Berufsregelungen + Link (bei reglementierten Berufen)
- Nr. 6: Umsatzsteuer-ID (USt-ID nach § 27a UStG) ODER Wirtschafts-ID (§ 139c AO)

**Audit-Relevanz:**
- Footer-Link „Impressum" auf jeder Page
- Anbieter-Block-Identifizierbarkeit (h2 + address)
- USt-ID-Format (DE + 9 Ziffern)
- Bei reglementierten Berufen (Anwalt/Arzt/Architekt): Berufsordnung + Kammer-Link Pflicht
- Nicht genutzte Felder (Handelsregister bei Einzelunternehmer): NICHT auflisten als „n/a", weglassen

## § 6 — Besondere Informationspflichten (kommerzielle Kommunikation)
- Klare Erkennbarkeit als kommerzielle Kommunikation
- Klare Erkennbarkeit der Person, in deren Auftrag die Kommunikation erfolgt

**Audit-Relevanz:** Affiliate-Disclaimer (siehe `references/checklisten.md` 3c). Influencer-Posts.

## §§ 7–10 — Haftung der Diensteanbieter

### § 7 — Allgemeine Grundsätze (Verantwortlichkeit für eigene Inhalte)
Diensteanbieter sind für eigene Informationen nach allgemeinen Gesetzen verantwortlich.

### § 8 — Durchleitung von Informationen (Mere Conduit)
Keine Verantwortung wenn: nicht initiiert, keine Auswahl Empfänger, keine Auswahl/Veränderung Inhalt.

### § 9 — Zwischenspeicherung (Caching)
Caching-Privileg.

### § 10 — Speicherung von Informationen (Hosting)
Host-Provider haftet nicht, wenn:
- Nr. 1: keine Kenntnis rechtswidriger Information ODER
- Nr. 2: nach Kenntnis-Erlangung unverzüglich entfernt
**Audit-Relevanz:** UGC-Plattformen (Forum, Marketplace, Profile) — Notice-and-Action-Endpoint Pflicht (DSA Art. 16 ergänzt).

---

## Audit-Mapping

| Audit-Surface | DDG-§ |
|---------------|-------|
| Impressum-Pflicht | § 5 |
| Werbung / Kommerzielle Komm. | § 6 |
| UGC-Hosting | § 10 + DSA Art. 16 |
| Footer-Link „Impressum" | § 5 (de-facto Pflicht) |

## Migration-Tabelle (TMG → DDG)

- TMG § 5 → DDG § 5 (inhaltsgleich Impressum)
- TMG § 7 → DDG § 7 (Haftung Grundsatz)
- TMG § 10 → DDG § 10 (Hosting-Privileg)

Skill-Output: stets „DDG" zitieren (TMG nur als historischer Hinweis bei alten Az.).
