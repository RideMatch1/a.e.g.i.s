---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/kredwg/
last-checked: 2026-05-05
purpose: KWG (Kreditwesengesetz) — Erlaubnispflicht für Bank-/Finanzdienstleistungs-Geschäft, Kryptoverwahrgeschäft.
---

# KWG — Kern-Paragraphen

> Kreditwesengesetz (KWG).
> Volltext: https://www.gesetze-im-internet.de/kredwg/

## § 1 — Begriffsbestimmungen

**Wortlaut (Kern, Abs. 1)**: Kreditinstitute sind Unternehmen, die Bankgeschäfte gewerbsmäßig betreiben — insb.:
- **Nr. 1**: Einlagengeschäft (fremde Gelder als Einlagen anzunehmen),
- **Nr. 2**: Pfandbriefgeschäft,
- **Nr. 4**: Finanzkommissionsgeschäft (Anschaffung/Veräußerung von Finanzinstrumenten in eigenem Namen für fremde Rechnung),
- **Nr. 7**: Diskontgeschäft,
- **Nr. 8**: Investmentgeschäft.

**§ 1 Abs. 1a — Finanzdienstleistungen**:
- Anlagevermittlung, Anlageberatung, Betrieb eines multilateralen Handelssystems,
- **Nr. 6 — Kryptoverwahrgeschäft**: Verwahrung, Verwaltung und Sicherung von Kryptowerten oder privater kryptografischer Schlüssel für andere.

**Audit-Relevanz**: zentrale Trigger-Norm. Wer Krypto-Custody betreibt = Finanzdienstleistungs-Institut → BaFin-Erlaubnis (§ 32) Pflicht.

---

## § 1 Abs. 11 — Kryptowerte

**Wortlaut (Kern)**: Kryptowerte sind digitale Darstellungen eines Wertes, die nicht gesetzliches Zahlungsmittel sind aber als Tausch- oder Zahlungsmittel akzeptiert werden, Anlagezwecke verfolgen oder elektronisch übertragen, gespeichert und gehandelt werden können. **Stablecoins, Utility-Token, Security-Token, NFTs** können (je nach Ausgestaltung) Kryptowerte sein.

---

## § 32 — Erlaubnispflicht

**Wortlaut (Kern, Abs. 1)**: Wer im Inland gewerbsmäßig oder in einem Umfang, der einen in kaufmännischer Weise eingerichteten Geschäftsbetrieb erfordert, Bankgeschäfte betreiben oder Finanzdienstleistungen erbringen will, bedarf der **schriftlichen Erlaubnis der Aufsichtsbehörde (BaFin)**.

**§ 32 Abs. 2**: Erlaubnis-Voraussetzungen u.a.:
- ausreichendes Eigenkapital,
- mindestens zwei zuverlässige + fachlich geeignete Geschäftsleiter („Vier-Augen-Prinzip"),
- vollständiger Geschäftsplan,
- Angaben zu wirtschaftlich Berechtigten,
- Angaben zu wesentlichen Beteiligten + deren Zuverlässigkeit.

**Audit-Relevanz**: harter Gate-Faktor. Krypto-Plattform / Wallet / DeFi-Frontend ohne BaFin-Erlaubnis = § 54-Strafraum. „Lite"-Modelle (Pre-Filter über DLT-Pilot) NICHT für Standardbetrieb.

---

## § 33 — Versagung der Erlaubnis

**Wortlaut (Kern)**: BaFin versagt Erlaubnis, wenn:
- Kapital nicht ausreichend (regulatorisches Mindestkapital, je nach Geschäft 125k € – 5 Mio €),
- Geschäftsleiter nicht zuverlässig oder fachlich nicht geeignet,
- bedeutende Beteiligte nicht zuverlässig,
- Geschäftsleiter ihre Tätigkeit nicht in DE haupt-ausüben.

---

## § 35 — Aufhebung der Erlaubnis

**Wortlaut (Kern)**: BaFin kann Erlaubnis widerrufen bei:
- nachträglichem Wegfall der Erteilungs-Voraussetzungen,
- groben Pflicht-Verstößen,
- Gefährdung der Aufsicht,
- nicht ausgenutzter Erlaubnis (12 Monate).

**Audit-Relevanz**: bei Compliance-Defiziten kann BaFin Lizenz entziehen → Marktverbot.

---

## § 54 — Strafvorschriften

**Wortlaut (Kern, Abs. 1)**: Mit Freiheitsstrafe bis zu **fünf Jahren** oder mit Geldstrafe wird bestraft, wer ohne Erlaubnis nach § 32 Abs. 1 Bankgeschäfte betreibt oder Finanzdienstleistungen erbringt.

**§ 54 Abs. 2**: Versuch ist strafbar.

**§ 54 Abs. 3**: Bei Fahrlässigkeit Freiheitsstrafe bis zu drei Jahren oder Geldstrafe.

**Audit-Relevanz**: zentrales Risiko bei Krypto-Startups. „Wir hosten nur Wallets" / „wir sind nur Software-Layer" — entscheidet im Einzelfall die Tatsachenbeurteilung der BaFin / Staatsanwaltschaft. Strafverfolgung gegen Geschäftsleiter persönlich.

---

## § 56 — Bußgeldvorschriften

**Wortlaut (Kern)**: Ordnungswidrig handelt, wer gegen organisatorische, Berichts- und Eigenkapital-Pflichten verstößt.

**§ 56 Abs. 6 — Bußgeld-Rahmen**:
- bis **5.000.000 €** oder **10 % des Jahresumsatzes** (höherer Betrag) bei schweren Verstößen,
- für natürliche Personen bis **5.000.000 €**.

**Audit-Relevanz**: parallel zur GwG-§-56-Sanktion (s. dort).

---

## § 25c — Aufsichtsrechtliche Anforderungen an Auslagerung

**Wortlaut (Kern)**: Wesentliche Auslagerungen (z.B. Cloud-Hosting, Trading-Backend) müssen vorher BaFin angezeigt werden + Auslagerungs-Vertrag muss BaFin-Zugangs-/Prüfungsrechte enthalten.

**Audit-Relevanz**: AWS/GCP/Azure-Verträge müssen MaRisk-/BAIT-konforme Klauseln enthalten. Cross-Ref DORA (EU 2022/2554) ab 17.01.2025.

---

## § 25h — IT-Sicherheits-Anforderungen

**Wortlaut (Kern)**: Verweis auf MaRisk + BAIT (BaFin-Verwaltungs-Vorgaben). IT-System-Sicherheit, Notfallplan, Penetrationstests, regelmäßiges Vulnerability-Management.

**Audit-Relevanz**: technischer Audit-Surface — überlappt mit DORA + DiGAV-Anforderungen + BSI-IT-Grundschutz.
