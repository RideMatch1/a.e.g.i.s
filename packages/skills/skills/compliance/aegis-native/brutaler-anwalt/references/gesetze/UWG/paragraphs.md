---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/uwg_2004/
last-checked: 2026-05-01
purpose: UWG — Hauptabmahn-Vehikel im Web (§ 3a Rechtsbruch, § 5/5a Irreführung, § 7 Cold-Outreach, § 8 Anspruchsberechtigte, § 13 Abmahnung).
---

# UWG — Audit-relevante Paragraphen

> Gesetz gegen den unlauteren Wettbewerb (UWG).
> Volltext: https://www.gesetze-im-internet.de/uwg_2004/

## § 3 — Verbot unlauterer geschäftlicher Handlungen

Generalnorm. Konkret in §§ 3a–7.

## § 3a — Rechtsbruch (Marktverhaltensregelungen)

> Unlauter handelt, wer einer gesetzlichen Vorschrift zuwiderhandelt, die auch dazu bestimmt ist, im Interesse der Marktteilnehmer das Marktverhalten zu regeln.

**Audit-Relevanz:** das ist der MEISTGENUTZTE Hebel für DSGVO-/TDDDG-/DDG-Verstöße. Konkurrenten können DSGVO-Verstöße über UWG § 3a abmahnen (BGH I ZR 7/16 bestätigt; auch nach EuGH C-372/19 sind Marktverhaltensregelungen abmahnbar).

Abmahnfähige Marktverhaltensregelungen:
- DSGVO Art. 13 (DSE-Pflicht)
- TDDDG § 25 (Cookie-Banner)
- DDG § 5 (Impressum)
- BGB § 312j (Button-Lösung)
- BGB § 312k (Kündigungsbutton)
- VSBG § 36 (Streitbeilegung-Hinweis)
- UWG § 5a Abs. 4 (Werbe-Kennzeichnung)
- BFSG (B2C-Barrierefreiheit, ab 28.06.2025)

## § 5 — Irreführende geschäftliche Handlungen

- Abs. 1: Unwahre oder zur Täuschung geeignete Angabe über wesentliche Merkmale
- Abs. 2: Verwirrungsgefahr (Verwechselung)

**Audit-Relevanz:**
- Werbeaussagen (Health-Claims bei Lebensmitteln, „beste App", „Marktführer")
- Bewertungs-Cherry-Picking
- Influencer ohne Werbe-Kennzeichnung

## § 5a — Irreführung durch Unterlassen

- Abs. 1: wesentliche Information vorenthalten
- **Abs. 4: bei kommerzieller Kommunikation den kommerziellen Zweck NICHT kenntlich machen**

**Audit-Relevanz:**
- Affiliate-Links ohne Werbehinweis
- Influencer-Posts ohne „Werbung" / „Anzeige"
- Sponsored Content ohne Kennzeichnung
- Paid Reviews
**Az.-Anker:** LG München I 4 HK O 14302/15 (Brand Ambassador), BGH I ZR 90/20.

## § 6 — Vergleichende Werbung
Zulässig nur unter strengen Voraussetzungen (objektiv, nachprüfbar, keine Herabsetzung).

## § 7 — Unzumutbare Belästigung (Cold-Outreach)

- Abs. 1: unzumutbare Belästigung verboten
- **Abs. 2 Nr. 2: Werbung mit Telefonanruf nur mit ausdrücklicher Einwilligung (B2C) bzw. mutmaßlicher Einwilligung (B2B)**
- **Abs. 2 Nr. 3: Werbung per E-Mail nur mit ausdrücklicher Einwilligung (Double-Opt-In)**
- Abs. 3: Bestandskunden-Privileg für E-Mail-Werbung enge Voraussetzungen

**Audit-Relevanz:**
- Newsletter-Anmeldung mit Double-Opt-In Pflicht
- Cold-E-Mail-B2B verlangt mutmaßliches Interesse — eng auszulegen
- Bestandskunden-Werbung per E-Mail nur mit Widerruf-Hinweis bei jeder E-Mail
**Az.-Anker:** BGH I ZR 218/19 (Werbeeinwilligung Bestandskunden), BGH I ZR 218/07.

## § 8 — Beseitigung + Unterlassung

- Abs. 1: Anspruchsinhalt
- Abs. 3: Anspruchsberechtigte:
  - Nr. 1: Mitbewerber (sofern wirtschaftlich tatsächlich tätig)
  - Nr. 2: qualifizierte Wirtschaftsverbände (Wettbewerbszentrale, IHK)
  - Nr. 3: qualifizierte Verbraucherverbände (vzbv)
  - Nr. 4: IHK / Handwerkskammer

**Audit-Relevanz:** das definiert WHO darf abmahnen.

## § 8b — Missbrauchsverbot
Abmahnung darf nicht missbräuchlich sein. Indizien Abs. 2:
- Mitbewerber außerhalb gewöhnlicher Geschäftstätigkeit
- Vielzahl Abmahnungen
- Forderung unangemessen hoher Aufwendungsersatz

## § 9 — Schadensersatz
- Abs. 2: Bagatell-Vorbehalt — keine Schadensersatzpflicht bei geringfügigem Verstoß
- Spüfflicht für Schäden durch unlautere Handlung

## § 13 — Abmahnung

- Abs. 1: Pflicht zur Abmahnung VOR Klage (Inanspruchnahme)
- Abs. 2: Inhaltsanforderungen (Identität, Sachverhalt, geforderte Unterlassung)
- Abs. 4: Aufwendungsersatz NUR wenn Abmahnung berechtigt + erforderlich

**Audit-Relevanz:** Abmahn-Brief-Templates (`references/abmahn-templates.md`) folgen § 13 Abs. 2 Pflichtinhalt.

---

## Audit-Mapping

| Audit-Surface | UWG-§ |
|---------------|-------|
| DSGVO-Verstoß abmahnbar | § 3a (BGH I ZR 7/16) |
| TDDDG-Verstoß abmahnbar | § 3a |
| DDG-Verstoß abmahnbar | § 3a |
| BFSG-Verstoß abmahnbar | § 3a (ab 28.06.2025) |
| Affiliate ohne Hinweis | § 5a Abs. 4 |
| Influencer-Werbung | § 5a Abs. 4 + LG München I 4 HK O 14302/15 |
| Newsletter ohne DOI | § 7 Abs. 2 Nr. 3 |
| Cold-E-Mail-B2B | § 7 Abs. 2 Nr. 3 |
| Cold-Anruf | § 7 Abs. 2 Nr. 2 |
| Bestandskunden-Werbung | § 7 Abs. 3 |
| Abmahn-Brief-Pflichten | § 13 Abs. 2 |
| Aufwendungsersatz-Limit | § 13 Abs. 4 |
