---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/zag_2018/
last-checked: 2026-05-05
purpose: ZAG (Zahlungsdiensteaufsichtsgesetz) — DE-Umsetzung PSD2 (RL 2015/2366); Erlaubnis für Zahlungsinstitute, SCA, Open-Banking-APIs.
---

# ZAG — Kern-Paragraphen

> Zahlungsdiensteaufsichtsgesetz (ZAG), Stammgesetz 2018 (PSD2-Umsetzung).
> Volltext: https://www.gesetze-im-internet.de/zag_2018/

## § 1 — Begriffsbestimmungen

**Wortlaut (Kern)**: Zahlungsdienste sind:
- **Nr. 1a**: Dienste, die Bareinzahlungen auf Zahlungskonto ermöglichen,
- **Nr. 1b**: Dienste, die Barabhebungen ermöglichen,
- **Nr. 2**: Ausführung von Zahlungsvorgängen (Lastschrift, Überweisung, Karte) ohne Kreditgewährung,
- **Nr. 3**: Ausführung mit Kreditgewährung,
- **Nr. 4**: Ausgabe von Zahlungsinstrumenten + Acquiring (Karten-Akzeptanz),
- **Nr. 5**: Finanztransfergeschäft (Geldüberweisung ohne Konto),
- **Nr. 6**: Zahlungsauslösungsdienst (PISP, „Sofortüberweisung"-Modell),
- **Nr. 7**: Kontoinformationsdienst (AISP, „Multi-Banking-App"-Modell).

**Audit-Relevanz**: triggers ZAG-Pflicht bei jedem Payment-Flow, der nicht reine Bezahlung-zwischen-Käufer-und-Verkäufer ist. Acquiring (Stripe-Modell), PISP (Klarna-Sofort-Modell), AISP (Multi-Banking) brauchen ZAG-Erlaubnis.

---

## § 10 — Erlaubnispflicht

**Wortlaut (Kern, Abs. 1)**: Wer als Zahlungsinstitut Zahlungsdienste erbringen will, bedarf der schriftlichen Erlaubnis der BaFin.

**§ 10 Abs. 2 — Voraussetzungen**: Vergleichbar KWG § 32 — ausreichendes Anfangskapital (20k € bei reinem PISP/AISP, 125k € bei Geldtransfer, 350k € bei sonstigen Zahlungsdiensten), zwei zuverlässige Geschäftsleiter, geeignete Geschäftsorganisation.

**Audit-Relevanz**: Stripe / Klarna / Mollie / Adyen sind ZAG-Institute (oft EU-passportiert aus IE/NL). Eigene Payment-Plattformen brauchen eigene Erlaubnis.

---

## § 11 — E-Geld-Institut

**Wortlaut (Kern)**: Wer E-Geld ausgibt (z.B. PayPal-Modell, Prepaid-Karten, Stablecoins-mit-FIAT-Bindung), benötigt E-Geld-Institut-Erlaubnis (Anfangskapital 350k €).

---

## § 45 — Sicherheits-Anforderungen für Zahlungsdienstleister

**Wortlaut (Kern)**: PSD2-Sicherheitsanforderungen — operative + IT-Sicherheit, Risikobewertung, Schwachstellen-Management, Vorfälle melden binnen Stunden.

**Audit-Relevanz**: Cross-Ref DORA + § 25h KWG.

---

## § 53 — Verfahren für Sichere Authentifizierung der Zahlungsdienstnutzer

**Wortlaut (Kern)**: Zahlungsdienstleister müssen bei
- Online-Kontozugriff,
- Auslösung elektronischer Zahlungs-Vorgänge,
- Vornahme einer Handlung, die Missbrauchsrisiko birgt,
**Strong Customer Authentication (SCA)** anwenden — d.h. mindestens zwei der drei Faktoren:
- Wissen (Passwort, PIN),
- Besitz (Gerät, Token),
- Inhärenz (Biometrie).

**Ausnahmen**: kontaktlose Zahlungen unter 50 €, Niedrigrisiko-Transaktionen, Whitelist-Begünstigte.

**Audit-Relevanz**: zentral für E-Commerce-Checkouts. Stripe / Adyen / Mollie übernehmen SCA-Pflicht — Eigen-PSP muss 3DS2 / FIDO2 implementieren.

---

## § 54 — Open-Banking (PISP/AISP-Zugang)

**Wortlaut (Kern)**: Banken müssen Drittanbietern (PISP/AISP mit ZAG-Lizenz oder EU-Passport) Zugang zu Konten gewähren über
- dedizierte Schnittstellen (XS2A-Berlin-Group / NextGenPSD2-API),
- mit sicherem Authentifizierungsprozess,
- ohne Diskriminierung gegenüber eigener App.

**Audit-Relevanz**: Banken-API-Compliance; Multi-Banking-Apps brauchen AISP-Lizenz.

---

## § 56 — Pflicht zur Anzeige operativer Sicherheits-Vorfälle

**Wortlaut (Kern)**: Zahlungsdienstleister müssen schwerwiegende operationelle / sicherheitsbezogene Vorfälle unverzüglich BaFin melden — innerhalb 4 Stunden ab Bekanntwerden.

**Audit-Relevanz**: parallel zu DORA Art. 19 (Major Incident Reporting binnen 4h) + GwG-Verdachtsmeldung.

---

## §§ 63–67 — Strafvorschriften

### § 63 — Strafvorschriften

**Wortlaut (Kern)**: Mit Freiheitsstrafe bis zu **fünf Jahren** oder mit Geldstrafe wird bestraft, wer ohne Erlaubnis nach § 10 Zahlungsdienste erbringt.

**§ 63 Abs. 3**: Bei Fahrlässigkeit Freiheitsstrafe bis zu drei Jahren oder Geldstrafe.

### § 64 — weitere Strafvorschriften

Freiheitsstrafe bis zu einem Jahr für Verstöße gegen Berichts- und Anzeigepflichten.

### § 65 — Bußgeldvorschriften

Ordnungswidrig handelt, wer fahrlässig oder vorsätzlich gegen organisatorische, Sicherheits- oder Berichts-Pflichten verstößt.

**§ 65 Abs. 4 — Bußgeld-Rahmen**:
- Standardfall: bis **fünf Millionen Euro (5.000.000 €) oder 10 % Jahresumsatz**.
- Bei natürlichen Personen: bis 5.000.000 €.

**Audit-Relevanz**: parallel zu KWG-§-56 + GwG-§-56.
