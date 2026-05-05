---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: HWG Audit-Relevance — Health/Pharma/Wellness/DiGA-Werbung.
---

# HWG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDER Site mit:
- Arzneimittel-Werbung (auch OTC / Online-Apotheke)
- Medizinprodukt-Werbung (incl. DiGA + Wellness-Geräte)
- Health-Claims für Verfahren/Behandlungen (auch Diät, Coaching mit Heilversprechen)
- Wellness-/Beauty-Sites mit gesundheits-/krankheitsbezogenen Aussagen
- Schönheits-OP-Praxis-Sites
- Influencer-Werbung für Supplements / Health-Apps

## Trigger im Code/UI

- **„heilt", „lindert", „beseitigt"** + Krankheits-Begriff → § 3 Nr. 1 (Wirksamkeit, die nicht da ist) ODER § 12 (verbotene Krankheits-Werbung)
- **„klinisch getestet", „wissenschaftlich bewiesen", „ärztlich empfohlen"** in Publikumswerbung → § 11 Nr. 1 / Nr. 6
- **Vorher-Nachher-Bilder** bei Schönheits-OPs / Diäten / Hautpflege → § 11 Nr. 4 + § 11 Abs. 1 Satz 3
- **Testimonials mit Foto** („Hat mir geholfen!") → § 11 Nr. 11
- **Person im weißen Kittel** (Stock-Foto auf Health-Site) → § 11 Nr. 3
- **Werbung für Rx-Arzneimittel** außerhalb Fachkreise → § 10 (hartes Verbot)
- **Pflichttext fehlt** bei OTC-Apotheken-Anzeigen → § 4 Abs. 3
- **„Geld-zurück-Garantie", „Gratis-Probe"** für Arzneimittel/Medizinprodukte → § 7

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Irreführende Heilversprechen | § 3 | bis 50.000 € + UWG-Abmahnung | § 15 Abs. 3 HWG |
| Pflichttext fehlt (OTC) | § 4 | bis 50.000 € + UWG-Abmahnung | § 15 Abs. 3 HWG |
| Wertreklame / Werbegaben | § 7 | bis 50.000 € | § 15 Abs. 3 HWG |
| Rx-Werbung Publikum | § 10 | bis 50.000 € | § 15 Abs. 3 HWG |
| Testimonials / Vorher-Nachher | § 11 | bis 50.000 € + UWG-Abmahnung (3a) | § 15 Abs. 3 HWG |
| Werbung für Cancer-Cure etc. | § 12 | bis 50.000 € (+ § 14 ggf. Straftat) | § 15 Abs. 3 HWG |

UWG-§-3a-Abmahnung-Streitwert: typisch 5.000–25.000 € pro abmahnender Wettbewerber. Aufwendungsersatz nach UWG § 13 Abs. 4 begrenzt — ABER der Unterlassungsanspruch + Vertragsstrafe-Risiko bleibt.

## Top-Az.

- **BGH I ZR 213/13** (07.05.2015) — „Online-Apotheke" — Pflichttext muss auch in Online-Werbung erscheinen
- **BGH I ZR 60/16** — Testimonials in Apotheken-Anzeige als § 11 Nr. 11-Verstoß
- **OLG Hamburg 5 U 189/12** — Vorher-Nachher-Bilder bei Schönheits-OP
- **BGH I ZR 200/05** „Pillen-Test" — Werbung mit Stiftung-Warentest-Ergebnissen ist § 11 Nr. 1-Verstoß bei Arzneimitteln
- **BGH I ZR 91/19** „Solar-Heilung" — wissenschaftlich nicht belegte Wirkversprechen sind § 3 Nr. 1-Verstoß

## Cross-Reference (zu anderen Skill-Files)

- `references/dsgvo.md` für Health-Daten = Art. 9 (besondere Kategorie)
- `references/audit-patterns.md` Phase 5g für Werbe-/Marketing-Audit-Surface
- `references/gesetze/UWG/audit-relevance.md` § 3a (Rechtsbruch) — HWG-Verstöße sind UWG-abmahnbar
- `references/gesetze/AMG/` für Zulassungspflicht (§ 21 AMG) — Vorfrage für HWG-Werbung
- `references/gesetze/MPDG/` für Medizinprodukte-Definition (HWG § 1 Abs. 1 Nr. 1a)
- `references/gesetze/LFGB/` Abgrenzung Lebensmittel-mit-Health-Claims (Health-Claim-VO statt HWG)

## Sektor-Abgrenzungen

| Produkt | Maßgebliches Recht |
|---|---|
| Arzneimittel (zugelassen) | HWG + AMG |
| Medizinprodukt (CE-Mark) | HWG + MPDG/MDR |
| DiGA (BfArM-gelistet) | HWG + DiGAV + MDR |
| Nahrungsergänzungsmittel | NemV + Health-Claim-VO 1924/2006 (NICHT HWG, außer kombinierte Heilversprechen) |
| Kosmetik | Kosmetik-VO 1223/2009 + UWG (NICHT HWG) |
| Wellness ohne Heilversprechen | UWG § 5 |
| Wellness MIT Heilversprechen | HWG § 3 (vorgeschoben als Mittel) |
