---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: LFGB Audit-Relevance — Lebensmittel-/Supplement-/Bedarfsgegenstände-Werbung.
---

# LFGB — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites mit:
- E-Commerce für Lebensmittel
- Online-Shop für Nahrungsergänzungsmittel
- Health-Food / Supplement / „Superfood"-Vermarktung
- Kosmetika
- Verpackungen / Spielzeug / Hautkontakt-Produkte

## Trigger im Code/UI

- **„Detox", „Booster", „Anti-Aging"** ohne Health-Claim-VO-1924-Zulassung → § 11
- **„Hilft bei Erkältung"** auf Vitamin-/Tee-Shop → § 11 + Funktions-Arzneimittel-Risiko (AMG)
- **Produkt-Foto unterscheidet sich von Inhalt** → § 13 (Mogelpackung)
- **„Natürlich" für hochverarbeitete Lebensmittel** → § 12
- **„Bio" ohne EU-Bio-Zertifizierung** → § 11 + Öko-Kennzeichen-Gesetz
- **Allergen-Info fehlt** auf Produkt-Detail-Seite → LMIV Art. 9 + § 60 LFGB

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Gesundheitsgefährdender Verkehr | § 5 + § 58 | Freiheitsstrafe bis 3 Jahre / Geldstrafe; bes. schw. Fall 6Mo-5J | § 58 LFGB |
| Täuschung (Werbung) | § 11 + § 60 | bis 50.000 € (Standard) / bis 100.000 € (benannt) | § 60 Abs. 5 LFGB |
| Hygiene/Zusatzstoffe | § 59 | bis 1 Jahr / Geldstrafe | § 59 LFGB |
| Kennzeichnungs-OwiG | § 60 | bis 50.000 € | § 60 Abs. 5 LFGB |

UWG-§-3a-Abmahnung-Risiko: Lebensmittel-Werbung-Verstöße sind Marktverhaltensregelungen → von Wettbewerbern abmahnbar (Wettbewerbszentrale aktiv).

## Top-Az.

- **EuGH C-19/15 Innova Vital** — Anforderungen an gesundheitsbezogene Werbung an Fachleute
- **EuGH C-544/10 Deutsches Weintor** — „bekömmlich" als gesundheitsbezogene Angabe
- **BGH I ZR 71/13 „Original Bachblüten"** — Auslobungen ohne wissenschaftliche Belege
- **BGH I ZR 162/16** — „pflanzlich" / „natürlich" als § 11-Anker

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/UWG/audit-relevance.md` § 3a (Rechtsbruch) — LFGB-Verstöße sind UWG-abmahnbar
- `references/gesetze/HWG/` Abgrenzung Lebensmittel-vs-Heilmittel-Werbung
- `references/gesetze/AMG/` Abgrenzung Lebensmittel-vs-Funktions-Arzneimittel
- `references/gesetze/EU-Verordnungen/LMIV-1169-2011/` für Allergen-/Nährwert-Kennzeichnung
- `references/gesetze/EU-Verordnungen/Health-Claim-VO-1924-2006/` für zugelassene Aussagen
- `references/audit-patterns.md` Phase 5g für E-Commerce-Werbung-Surface

## Sektor-Abgrenzung

| Produkt | Maßgebliches Recht |
|---|---|
| Lebensmittel ohne Heilversprechen | LFGB + LMIV |
| Lebensmittel mit zugelassener Health-Claim | LFGB + LMIV + VO 1924/2006 |
| Lebensmittel mit nicht zugel. Heilversprechen | LFGB-Verstoß + AMG-Risiko (Funktionsarzneimittel) |
| Nahrungsergänzungsmittel | NemV + LFGB |
| Kosmetik | Kosmetik-VO 1223/2009 + LFGB §§ 17 ff |
| Bedarfsgegenstände (Verpackung, Spielzeug) | LFGB §§ 17–32 |
