---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/ddg/
last-checked: 2026-05-05
purpose: DDG (Digitale-Dienste-Gesetz) — vormals TMG, ersetzt seit 14.05.2024. Setzt EU-DSA in deutsches Recht um, regelt Impressum + Hosting-Privileg + DSA-Begleitvorschriften.
---

# DDG — Kern-Paragraphen

> Digitale-Dienste-Gesetz (DDG).
> Volltext: https://www.gesetze-im-internet.de/ddg/
> Trat am 14.05.2024 in Kraft und ersetzte das TMG; EU-Hintergrund: DSA (VO 2022/2065).

## § 1 — Anwendungsbereich

**Wortlaut (Kern)**: DDG gilt für digitale Dienste — alle Telekommunikations-Dienstleistungen außer reinen Telekommunikations-Diensten, d.h. Webseiten, Apps, SaaS, Online-Marktplätze, soziale Netzwerke, Cloud-Services. Setzt DSA-Begleitvorschriften, Impressum + Hosting-Privileg um.

---

## § 5 — Allgemeine Informationspflichten (Impressum)

**Wortlaut (Kern, Abs. 1)**: Diensteanbieter haben für geschäftsmäßige Telemediendienste leicht erkennbare, unmittelbar erreichbare + ständig verfügbare Informationen vorzuhalten:

- **Nr. 1**: Name + Anschrift, bei juristischen Personen: Vertretungsberechtigter,
- **Nr. 2**: Kontaktangaben (E-Mail + ein weiterer Kontaktweg, z.B. Telefon, Kontaktformular, Chat),
- **Nr. 3**: zuständige Aufsichtsbehörde (sofern Tätigkeit der behördlichen Zulassung bedarf),
- **Nr. 4**: Handelsregister + Registernummer (bei juristischen Personen) bzw. Vereinsregister,
- **Nr. 5**: Berufsbezeichnung + Staat der Verleihung + Berufsregelungen + Link zu Berufsordnung (bei reglementierten Berufen — Anwalt, Arzt, Architekt, Steuerberater),
- **Nr. 6**: Umsatzsteuer-ID (USt-ID nach § 27a UStG) ODER Wirtschafts-ID (§ 139c AO).

**Audit-Relevanz**: Footer-Link „Impressum" auf jeder Page. Anbieter-Block-Identifizierbarkeit. USt-ID-Format (DE + 9 Ziffern). Bei reglementierten Berufen Berufsordnung + Kammer-Link. Pflichtfelder, die nicht zutreffen (Handelsregister bei Einzelunternehmer): NICHT auflisten als „n/a", weglassen.

---

## § 6 — Besondere Informationspflichten (kommerzielle Kommunikation)

**Wortlaut (Kern)**:
- **Nr. 1**: Klare Erkennbarkeit als kommerzielle Kommunikation,
- **Nr. 2**: Klare Erkennbarkeit der Person, in deren Auftrag die Kommunikation erfolgt,
- **Nr. 3**: Klare Erkennbarkeit von Angeboten zur Verkaufsförderung (Rabatt, Prämie, Geschenk) + Bedingungen,
- **Nr. 4**: Klare Erkennbarkeit von Preisausschreiben + Gewinnspielen + Bedingungen.

**Audit-Relevanz**: Affiliate-Disclaimer + Influencer-Posts + Werbung-Kennzeichnung. Cross-Ref zu UWG § 5a Abs. 4.

---

## §§ 7–10 — Haftung der Diensteanbieter

### § 7 — Allgemeine Grundsätze

**Wortlaut (Kern)**: Diensteanbieter sind für eigene Informationen nach allgemeinen Gesetzen verantwortlich. Keine allgemeine Überwachungs-/Aktivforschungs-Pflicht.

### § 8 — Durchleitung von Informationen (Mere Conduit)

**Wortlaut (Kern)**: Anbieter haftet nicht für durchgeleitete Information, wenn:
- Übermittlung nicht initiiert,
- Empfänger nicht ausgewählt,
- Information weder ausgewählt noch verändert.

### § 9 — Zwischenspeicherung (Caching)

**Wortlaut (Kern)**: Caching-Privileg — keine Haftung bei automatischer, zeitlich begrenzter Zwischenspeicherung zur effizienteren Übertragung.

### § 10 — Speicherung von Informationen (Hosting)

**Wortlaut (Kern)**: Host-Provider haftet nicht für Nutzer-Information, wenn:
- **Nr. 1**: keine Kenntnis rechtswidriger Information ODER
- **Nr. 2**: nach Kenntnis-Erlangung unverzüglich entfernt / Zugang gesperrt.

**Audit-Relevanz**: UGC-Plattformen (Forum, Marketplace, Profile) — Notice-and-Action-Endpoint Pflicht (DSA Art. 16 ergänzt direkt anwendbar).

---

## §§ 18–22 — DSA-Begleitvorschriften

**Wortlaut (Kern)**: DDG setzt DSA-Pflichten um:
- **§ 18**: Verbraucherbeauftragter / Single Point of Contact für DSA Art. 11/12 (Kontaktstelle für Behörden + Nutzer)
- **§ 19**: Datenzugangsschnittstelle für Behörden (DSA Art. 40)
- **§ 20-22**: Bußgeld-Mechanismus für DSA-Verstöße.

---

## § 33 — Bußgeldvorschriften (DSA-Begleit)

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer fahrlässig oder vorsätzlich gegen Impressum-Pflicht (§ 5), Werbung-Kennzeichnung (§ 6), DSA-Begleitvorschriften (§§ 18-22) verstößt.

**§ 33 Abs. 4 — Bußgeld-Rahmen**:
- für Impressum-Verstöße / Werbe-Kennzeichnung: bis **50.000 €** pro Verstoß,
- für DSA-Begleit-Verstöße: bis **6 % weltweiter Jahresumsatz** (gespiegelt zu DSA Art. 52 Abs. 3).

**Audit-Relevanz**: § 33-Bußgeld-Rahmen ist parallel zu DSA-direkt-Sanktionen. Plus UWG-§-3a-Abmahnung durch Wettbewerber für Impressum-/Kennzeichnungs-Verstöße.

---

## Migration-Tabelle (TMG → DDG)

- TMG § 5 → DDG § 5 (inhaltsgleich Impressum)
- TMG § 6 → DDG § 6 (Werbe-Kennzeichnung)
- TMG § 7 → DDG § 7 (Haftung Grundsatz)
- TMG § 10 → DDG § 10 (Hosting-Privileg)

Skill-Output: stets „DDG" zitieren (TMG nur als historischer Hinweis bei alten Az.).
