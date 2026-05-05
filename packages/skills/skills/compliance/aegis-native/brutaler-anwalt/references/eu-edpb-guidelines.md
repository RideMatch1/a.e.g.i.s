# EDPB-Guidelines + Recommendations + Opinions — Skill-Reference

> Stand: 2026-05-05 · Verifiziert gegen edpb.europa.eu (kein Modell-Gedaechtnis).
> Scope: ~33 nummerierte EDPB-Guidelines (final + final-after-consultation), 6 Recommendations, 4 high-citation Opinions, plus EDPB-endorsed-WP29-Set (Endorsement 1/2018).
>
> Verwendung: `brutaler-anwalt`-Skill zitiert hieraus bei DSGVO-Auditfunden — Guideline-ID + Adoption-Datum + EDPB-URL.

---

## Inhalt

- [Catalog-Corrections (IDs die NICHT existieren)](#catalog-corrections-ids-die-nicht-existieren)
- Cluster 1: Bussgeld + Aufsicht + Kohaerenz (Art. 56/60/65/83)
- Cluster 2: Cookies + Tracking + Dark Patterns (Art. 5(3) ePrivacy + Deceptive Design)
- Cluster 3: Verarbeitungs-Rechtsgrundlagen (Art. 6 + 9, Consent, LegInt)
- Cluster 4: Internationale Uebermittlungen (Kap. V + Art. 48/49 + Schrems-II)
- Cluster 5: Betroffenenrechte (Art. 12-22)
- Cluster 6: Privacy-by-Design + Zertifizierung + Codes
- Cluster 7: Data Breach + DPIA + DPO
- Cluster 8: Sektorspezifisch (Video, Vehicles, Health, Voice, Finance)
- Cluster 9: AI + Pseudonymisierung + Blockchain (2025-er Welle)
- Cluster 10: Joint + Public-Consultation (DSA / DMA / scientific research)
- [Recommendations (6)](#recommendations-6)
- [Opinions (Top 4 Most-Cited)](#opinions-top-4-most-cited)
- [WP29-Endorsed Set (Endorsement 1/2018)](#wp29-endorsed-set-endorsement-12018)
- [Anwendung im Skill-Output](#anwendung-im-skill-output)

---

## Catalog-Corrections (IDs die NICHT existieren)

Folgende Guideline-IDs aus dem Spec-Briefing wurden gegen edpb.europa.eu verifiziert und existieren NICHT als nummerierte EDPB-Guidelines (Stand 2026-05-05):

| Spec-Behauptung | Realitaet |
|---|---|
| Guidelines 03/2024 | Existiert nicht — 2024 nur 1/2024 + 02/2024 |
| Guidelines 04/2024 | Existiert nicht |
| Guidelines 04/2025 | Existiert nicht — 2025 nur 01/2025 + 02/2025 + 3/2025 + Joint-DMA |
| Guidelines 05/2025 | Existiert nicht |
| Guidelines 06/2025 | Existiert nicht |
| Guidelines 04/2023 | Existiert nicht |
| Guidelines 05/2023 | Existiert nicht |
| Guidelines 03/2023 (als "Art. 65 dispute") | Falsch zugeordnet — Art. 65(1)(a) ist `03/2021`, nicht `03/2023` |

Weitere Spec-Conflations:

- **"Guidelines 01/2023 = Art. 37 GDPR DPO"** ist FALSCH. Guidelines 01/2023 betrifft **Art. 37 Law-Enforcement-Directive** (Datenuebermittlung im LED-Kontext), nicht GDPR-DPO. GDPR-DPO-Guidance ist WP243 (WP29-endorsed via Endorsement 1/2018) — nicht als eigene EDPB-Guideline neu aufgelegt.
- **"Guidelines 04/2019 + 09/2020 = consent"** ist FALSCH. Consent ist `05/2020` (loest WP259 ab). `4/2019` ist Art. 25 Privacy-by-Design, `09/2020` ist Relevant-and-Reasoned-Objection (Art. 4(24)).
- **"Guidelines 02/2019 + 03/2020 = Codes of Conduct"** ist FALSCH. Codes-of-Conduct sind `1/2019` (CoC + Monitoring) und `04/2021` (CoC als Transfer-Tool). `2/2019` ist Art. 6(1)(b) online services. `03/2020` ist COVID-Gesundheitsdaten-Forschung.

> Skill-Regel: Wenn brutaler-anwalt eine EDPB-Guideline zitieren will, IMMER gegen diese Datei pruefen — kein Auto-Generation aus Modell-Memory.

---

## Cluster 1: Bussgeld + Aufsicht + Kohaerenz (Art. 56/60/65/83)

### Guidelines 04/2022 — Calculation of Administrative Fines under the GDPR
- **Status**: adopted 24.05.2023 · final
- **Topic**: 5-stufige Methodik der Aufsichtsbehoerden zur Berechnung von Bussgeldern (Art. 83 DSGVO). Fuehrt Starting-Amount-Tabellen je Schwerebgrad + Umsatz-Korrekturfaktor + erschwerende/mildernde Umstaende.
- **Audit-Anwendung**: Bussgeld-Layer im brutaler-anwalt-Output zitiert die 5 Schritte: (1) Identifikation Verarbeitungstaetigkeit + Verstoss-Kategorisierung Art. 83(4)/(5); (2) Starting-Point je nach Schwere (low / medium / high) und Unternehmensumsatz; (3) Erschwerende Faktoren Art. 83(2)(a)-(k); (4) Cap-Pruefung gegen statutory maximum (Art. 83(4)/(5)/(6)); (5) Effective/Proportionate/Dissuasive-Check. Default-Tabelle: Tier-1 0.2-2% Umsatz / Tier-2 1.5-4% Umsatz.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-042022-calculation-administrative-fines-under-gdpr_en

### Guidelines 03/2021 — Application of Article 65(1)(a) GDPR (Dispute Resolution)
- **Status**: adopted 24.05.2023 · final
- **Topic**: Verfahren zur EDPB-Streitbeilegung wenn die federfuehrende Aufsichtsbehoerde + concerned authorities sich nicht einigen. Bindender EDPB-Beschluss-Mechanismus.
- **Audit-Anwendung**: Wenn Cross-Border-Auditfund vorliegt (Mandant-EU-Praesenz mit OSS-Lead): brutaler-anwalt verweist auf Art. 65(1)(a)-Eskalationspfad; flagt dass nach 2 Monaten ohne Konsens EDPB binden kann. Relevant fuer "soll Aufsicht angeschrieben werden?" Empfehlung.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032021-application-article-651a-gdpr_en

### Guidelines 02/2022 — Application of Article 60 GDPR (Cooperation between LSA + CSAs)
- **Status**: adopted 14.03.2022 · final
- **Topic**: Mechanik des One-Stop-Shop-Verfahrens — Lead Supervisory Authority koordiniert mit Concerned Supervisory Authorities, draft-decision/relevant-and-reasoned-objection-Schleife.
- **Audit-Anwendung**: Bei Multi-EU-Mandanten (Hauptniederlassung != Datenverarbeitungsort) im brutaler-Audit zitieren: bestimmt welche Aufsicht primaer zustaendig ist + ob die LSA die Auditfunde zwingend an alle CSAs cascade-melden muss.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-022022-application-article-60-gdpr_en

### Guidelines 06/2022 — Practical Implementation of Amicable Settlements
- **Status**: adopted 12.05.2022 · final
- **Topic**: Wie Aufsichtsbehoerden gegenseitig "amicable settlements" zur Streitvermeidung im OSS-Mechanismus nutzen.
- **Audit-Anwendung**: Procedural-Tail im Bussgeld-Layer — flagt Settlement-Optionen vor formellem Art. 65-Verfahren.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-062022-practical-implementation-amicable_en

### Guidelines 8/2022 — Identifying a Controller or Processor's Lead Supervisory Authority
- **Status**: adopted 17.04.2023 · final (loest WP244 rev.01 ab)
- **Topic**: Kriterien zur Bestimmung der "main establishment" + LSA — central administration vs. effective decision-making location vs. EU-establishment-of-controller.
- **Audit-Anwendung**: brutaler-Skill nutzt diese Guideline um bei Mandanten ohne klare Hauptniederlassung die zustaendige DSGVO-Aufsicht zu identifizieren. Wichtig wenn Mandant-Holding (zB. NL) != operatives Geschaeft (zB. DE-Tochter).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-82022-identifying-controller-or-processors_en

### Guidelines 09/2020 — Relevant and Reasoned Objection under Regulation 2016/679
- **Status**: adopted 09.03.2021 · final
- **Topic**: Definition wann eine CSA-Einwendung gegen LSA-Draft "relevant" + "reasoned" gem. Art. 4(24) ist und damit die Art. 65-Streitbeilegung ausloest.
- **Audit-Anwendung**: Selten direkt zitierbar — relevant wenn Bewertung "wuerde diese CSA wahrscheinlich objection einlegen?" Teil der Strategieempfehlung wird.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-092020-relevant-and-reasoned-objection-under_en

---

## Cluster 2: Cookies + Tracking + Dark Patterns (Art. 5(3) ePrivacy + Deceptive Design)

### Guidelines 2/2023 — Technical Scope of Art. 5(3) of ePrivacy Directive
- **Status**: adopted 16.10.2024 · final
- **Topic**: Erweitert "Cookie-Richtlinie" Art. 5(3) ePrivacy ueber klassische Cookies hinaus — vier Storage/Access-Szenarien: (a) URL/pixel tracking, (b) Local processing+transmission, (c) Tracking based on IP only, (d) IoT/connected-device data exfil. Jede dieser Mechaniken loest Consent-Pflicht aus.
- **Audit-Anwendung**: KRITISCH fuer Cookie/Tracking-Audits. brutaler-Skill flagt jeden Tracking-Pixel + Local-Storage-Read + Fingerprinting + IoT-Telemetry als Art. 5(3) ePrivacy-Eingriff (nicht nur klassische Cookies). Bei FP-Untersuchung: ist der Mechanismus "storage of OR access to information stored in terminal equipment" — wenn ja, Consent-Pflicht.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en

### Guidelines 03/2022 — Deceptive Design Patterns in Social Media Platform Interfaces
- **Status**: adopted 24.02.2023 · final
- **Topic**: Sechs Kategorien von "Dark Patterns" in Social-Media-UIs, jede mit konkreten Beispielen + DSGVO-Bewertung: (1) Overloading (mehr-als-noetig Auswahl), (2) Skipping (defaults setzen), (3) Stirring (emotionale Manipulation), (4) Hindering (friction gegen privacy choice), (5) Fickle (verwirrende UI-Hierarchie), (6) Left in the Dark (versteckte Info).
- **Audit-Anwendung**: brutaler-Skill nutzt 6er-Taxonomie als Pruefraster bei Cookie-Banner + Consent-UI + Account-Settings-Audits. Konkretes Beispiel: Reject-All-Button kleiner/grau vs. Accept-All-Button gross/grun = "Hindering" + "Stirring". Cite mit Guideline-ID + spezifischer Pattern-Kategorie.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_en

### Guidelines 8/2020 — Targeting of Social Media Users
- **Status**: adopted 13.04.2021 · final
- **Topic**: Joint-Controllership Plattform <-> Targeter, Rechtsgrundlagen fuer Custom Audiences / Lookalikes / Behavior-Profile.
- **Audit-Anwendung**: Bei Mandanten die Meta/Google/TikTok-Audiences nutzen: brutaler-Skill flagt Joint-Controller-Anforderungen Art. 26 + zwingend explicit consent fuer behavioral targeting.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-082020-targeting-social-media-users_en

---

## Cluster 3: Verarbeitungs-Rechtsgrundlagen (Art. 6 + 9, Consent, LegInt)

### Guidelines 1/2024 — Processing of Personal Data Based on Article 6(1)(f) GDPR (Legitimate Interests)
- **Status**: adopted 08.10.2024 · public consultation closed (final-after-consultation pending)
- **Topic**: Drei-Stufen-Test fuer berechtigtes Interesse: (1) Existence of legitimate interest, (2) Necessity test, (3) Balancing-Test gegen Betroffenen-Erwartungen + Grundrechte. Detaillierte Beispiel-Cases inkl. Direct-Marketing, Network-Security, Fraud-Prevention.
- **Audit-Anwendung**: KRITISCH bei jeder Article-6(1)(f)-Berufung im Mandanten-AVV oder Datenschutzerklaerung. brutaler-Skill verlangt dokumentierten LIA (Legitimate Interest Assessment) mit allen 3 Stufen, sonst Auditfund "Art. 6(1)(f) ohne dokumentierten Test = unzulaessig".
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-12024-processing-personal-data-based_en

### Guidelines 05/2020 — Consent under Regulation 2016/679
- **Status**: adopted 04.05.2020 · final (loest WP259 rev.01 ab)
- **Topic**: Kanonische DSGVO-Consent-Definition: freely given + specific + informed + unambiguous + revocable. Detaillierte Pruefung von Conditional-Consent + Bundling + Cookie-Walls.
- **Audit-Anwendung**: Standard-Reference im Cookie-Audit + Datenschutzerklaerungs-Pruefung. Skill zitiert Para 38-41 fuer Cookie-Wall-Bewertung, Para 51+ fuer "free consent" gegen Macht-Asymmetrie (Arbeitgeber-AN, Plattform-Nutzer).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en

### Guidelines 2/2019 — Processing of Personal Data under Article 6(1)(b) GDPR (Online Services)
- **Status**: adopted 16.10.2019 · final
- **Topic**: Strenge Auslegung von "necessary for performance of contract" — verhindert Vertragspraegung als Sammelrechtfertigung fuer alle Datenverarbeitungen.
- **Audit-Anwendung**: brutaler-Skill flagt Auditfunde bei Mandanten die Art. 6(1)(b) als Rechtsgrundlage fuer Personalisierung / Tracking / Advertising berufen — diese sind NICHT contract-necessary, sondern brauchen Consent (Art. 6(1)(a)) oder LegInt-Balancing.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22019-processing-personal-data-under-article_en

### Guidelines 05/2022 — Use of Facial Recognition Technology in the Area of Law Enforcement
- **Status**: adopted 17.05.2023 · final
- **Topic**: FRT-Nutzung durch LEA — Art. 9 GDPR + LED-Article-10 (besondere Kategorien) + Verhaeltnismaessigkeit + DPIA-Pflicht.
- **Audit-Anwendung**: Schmal-anwendbar (nur LEA-Mandanten / Behoerden) — bei Privatsektor-FRT auf Art. 9(2)(a) (explicit consent) + DPIA-Pflicht-Liste verweisen.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052022-use-facial-recognition-technology_en

### Guidelines 10/2020 — Restrictions under Article 23 GDPR
- **Status**: adopted 13.10.2021 · final
- **Topic**: Wann darf nationales Recht Betroffenenrechte einschraenken (Art. 23) — Necessity + Proportionality + spezifische Schutzziele.
- **Audit-Anwendung**: Bei Mandanten in regulierten Sektoren (FinDLG, GwG, AO) die Auskunfts-/Loesch-Rechte einschraenken: brutaler-Skill prueft ob Einschraenkung Art. 23-konform ist (vs. ueberbreite Pauschale).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-102020-restrictions-under-article-23-gdpr_en

---

## Cluster 4: Internationale Uebermittlungen (Kap. V + Art. 48/49 + Schrems-II)

### Guidelines 02/2024 — Article 48 GDPR (Disclosures to Third-Country Authorities)
- **Status**: adopted 05.06.2025 · final
- **Topic**: Wann darf Controller/Processor personenbezogene Daten an Drittland-Behoerden auf Anfrage uebermitteln (zB. US-Subpoena, China-Government-Request). Art. 48 verlangt international agreement (MLAT) ODER andere Art-46-Garantie + Art-49-Ausnahme.
- **Audit-Anwendung**: Bei Mandanten mit US-Konzern-Mutter / China-Sub: brutaler-Skill flagt jede pauschale "wir kooperieren mit Behoerdenanfragen"-Klausel als Art-48-Verstoss wenn kein MLAT-Vehicle dokumentiert.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-022024-article-48-gdpr_en

### Guidelines 05/2021 — Interplay between Article 3 and International Transfers (Chapter V GDPR)
- **Status**: adopted 24.02.2023 · final
- **Topic**: Drei-Kriterien-Test fuer "transfer": (1) Controller/Processor in EU subject to GDPR, (2) discloses/makes-available data, (3) recipient in third country. Klaerung: GDPR gilt extraterritorial, aber Transfer-Begriff ist enger.
- **Audit-Anwendung**: Bei Mandanten mit Drittland-Subunternehmern: brutaler-Skill prueft ob "transfer" iSd Kap. V vorliegt (= alle 3 Kriterien) und damit SCC/BCR/Adequacy-Pflicht.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052021-interplay-between-application-article-3_en

### Guidelines 04/2021 — Codes of Conduct as Tools for Transfers
- **Status**: adopted 22.02.2022 · final
- **Topic**: Voraussetzungen fuer Code-of-Conduct als Art. 46(2)(e)-Transfer-Mechanismus.
- **Audit-Anwendung**: Bei Mandanten die CoC statt SCC nutzen wollen: brutaler-Skill prueft Approval-Status + Monitoring-Body.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-042021-codes-conduct-tools-transfers_en

### Guidelines 07/2022 — Certification as a Tool for Transfers
- **Status**: adopted 24.02.2023 · final
- **Topic**: Voraussetzungen fuer Zertifizierungen als Art. 46(2)(f)-Transfer-Mechanismus.
- **Audit-Anwendung**: Schmal — relevant wenn Mandant zertifizierungsbasierten Transfer-Mechanismus dokumentiert (selten in Praxis).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072022-certification-tool-transfers_en

### Guidelines 2/2020 — Articles 46(2)(a) and 46(3)(b) (Transfers between EEA and non-EEA Public Authorities)
- **Status**: adopted 15.12.2020 · final
- **Topic**: Sektorvereinbarungen zwischen Behoerden als Art. 46-Garantie.
- **Audit-Anwendung**: Behoerden-Mandanten only.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22020-articles-46-2-and-46-3-b-regulation_en

### Guidelines 2/2018 — Derogations of Article 49 under Regulation 2016/679
- **Status**: adopted 25.05.2018 · final
- **Topic**: Strenge Auslegung der Ausnahmen Art. 49 (kein Adequacy, keine SCC) — explicit consent, contract-necessity, important-public-interest. NICHT als routine-Vehicle nutzbar.
- **Audit-Anwendung**: brutaler-Skill flagt Mandanten die Art. 49 als Standard-Transfer-Mechanismus berufen ("notwendig fuer Vertragserfuellung mit US-Anbieter") — Art. 49 ist Ausnahme, nicht Regel.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22018-derogations-article-49-under-regulation_en

### Guidelines 3/2018 — Territorial Scope of the GDPR (Article 3)
- **Status**: adopted 12.11.2019 · final (after public consultation)
- **Topic**: Article 3 — establishment-criterion + targeting-criterion. Definiert wann nicht-EU-Anbieter doch GDPR-pflichtig sind (zB. US-SaaS mit EU-Kundenbasis).
- **Audit-Anwendung**: Bei nicht-EU-Mandanten oder Mandanten mit nicht-EU-Subprocessors: brutaler-Skill prueft Targeting-Test (gezielt EU-Markt? EU-Sprache? EUR-Preise? EU-Versand?).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-32018-territorial-scope-gdpr-article-3-version_en

---

## Cluster 5: Betroffenenrechte (Art. 12-22)

### Guidelines 01/2022 — Data Subject Rights — Right of Access
- **Status**: adopted 17.04.2023 · final
- **Topic**: Art. 15 — Umfang, Form, Fristen, Ausnahmen + Verhaeltnis zu Beschraenkungen Art. 12(5).
- **Audit-Anwendung**: KRITISCH fuer DSAR-Audit. brutaler-Skill prueft: (a) wird der volle Datensatz herausgegeben (nicht nur "die wichtigen"), (b) Identitaetspruefung-Verhaeltnismaessigkeit (Para 73+), (c) max-3-Monats-Frist (Art. 12(3)) eingehalten, (d) keine Pauschal-Gebuehren.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012022-data-subject-rights-right-access_en

### Guidelines 5/2019 — Criteria of the Right to be Forgotten in Search Engines (Part 1)
- **Status**: adopted 07.07.2020 · final
- **Topic**: Art. 17 — Loeschung/De-Listing-Kriterien fuer Suchmaschinen post-Google-Spain.
- **Audit-Anwendung**: Schmal — relevant fuer SEO/Reputations-Mandanten + RTBF-Antraege.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-52019-criteria-right-be-forgotten-search_en

### WP242 rev.01 — Right to Data Portability (WP29-endorsed)
- **Status**: adopted 25.05.2018 (Endorsement 1/2018) · final
- **Topic**: Art. 20 — Format-Pflichten (machine-readable + interoperable), Scope (nur consent + contract-Daten, nicht LegInt).
- **Audit-Anwendung**: Skill zitiert bei Portability-Audit. Cite "EDPB-endorsed WP242".
- **Source**: https://www.edpb.europa.eu/our-work-tools/general-guidance/endorsed-wp29-guidelines_en

---

## Cluster 6: Privacy-by-Design + Zertifizierung + Codes

### Guidelines 4/2019 — Article 25 Data Protection by Design and by Default
- **Status**: adopted 20.10.2020 · final
- **Topic**: Art. 25 — 7 Principle-Categories (Effectiveness, Necessity, Proportionality, etc.) + Concrete-Mappings.
- **Audit-Anwendung**: Bei Software-/Produkt-Audits: brutaler-Skill prueft ob Default-Settings privacy-friendly sind (Para 80+) und ob "Effectiveness" der gewaehlten Massnahmen dokumentiert ist.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42019-article-25-data-protection-design-and_en

### Guidelines 1/2018 — Certification and Identifying Certification Criteria (Art. 42 + 43)
- **Status**: adopted 04.06.2019 · final
- **Topic**: Anforderungen an Datenschutz-Zertifizierungen + Akkreditierung der Zertifizierungsstellen.
- **Audit-Anwendung**: Schmal — relevant nur bei Mandanten die Zertifizierung (zB. EuroPriSe, ePrivacyseal) als Compliance-Beweis fuehren.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-12018-certification-and-identifying_en

### Guidelines 4/2018 — Accreditation of Certification Bodies (Art. 43)
- **Status**: adopted 14.12.2018 · final
- **Topic**: Voraussetzungen fuer Akkreditierungsstellen.
- **Audit-Anwendung**: Schmal.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42018-accreditation-certification-bodies_en

### Guidelines 1/2019 — Codes of Conduct and Monitoring Bodies
- **Status**: adopted 04.06.2019 · final
- **Topic**: Anforderungen an CoCs gem. Art. 40 + Monitoring-Bodies Art. 41.
- **Audit-Anwendung**: brutaler-Skill prueft bei Mandanten die CoC-Mitgliedschaft als Compliance-Argument fuehren ob CoC genehmigt + Monitoring funktional ist.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-12019-codes-conduct-and-monitoring-bodies_en

---

## Cluster 7: Data Breach + DPIA + DPO

### Guidelines 9/2022 — Personal Data Breach Notification under GDPR
- **Status**: adopted 04.04.2023 · final (loest WP250 rev.01 ab)
- **Topic**: Art. 33/34 — 72h-Frist + Risk-Threshold fuer Notification + Inhalt des Notification-Reports + Documentation-Pflicht.
- **Audit-Anwendung**: KRITISCH bei jedem Incident-Audit. brutaler-Skill prueft: (a) Detection-to-Notification-Latenz (Para 28+), (b) Risk-Assessment dokumentiert, (c) Affected-Individuals-Notification bei "high risk" (Art. 34), (d) Internal-Documentation auch bei nicht-meldepflichtigen Breaches.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-92022-personal-data-breach-notification-under_en

### Guidelines 01/2021 — Examples regarding Personal Data Breach Notification
- **Status**: adopted 03.01.2022 · final
- **Topic**: 18 konkrete Beispiele (Ransomware, Lost Device, Misdirected Email, etc.) mit Notification-Bewertung.
- **Audit-Anwendung**: Quick-Reference im Breach-Audit — Skill matcht Mandanten-Incident gegen die 18 Beispielkategorien fuer Risk-Bewertung.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012021-examples-regarding-personal-data-breach_en

### WP248 rev.01 — Data Protection Impact Assessment (DPIA) (WP29-endorsed)
- **Status**: adopted via Endorsement 1/2018 · final
- **Topic**: Art. 35 — 9-Kriterien-Liste fuer "high risk" + DPIA-Methodik. Ab 2 von 9 Kriterien = DPIA-Pflicht.
- **Audit-Anwendung**: Standard-Reference fuer DPIA-Audit. Skill zaehlt fuer jede Verarbeitungstaetigkeit die zutreffenden Kriterien (evaluation/scoring, automated decisions, systematic monitoring, sensitive data, large scale, matching, vulnerable subjects, innovative tech, prevents-rights). >=2 Kriterien -> DPIA-Pflicht.
- **Source**: https://www.edpb.europa.eu/our-work-tools/general-guidance/endorsed-wp29-guidelines_en

### WP243 rev.01 — Data Protection Officers (DPO) (WP29-endorsed)
- **Status**: adopted via Endorsement 1/2018 · final
- **Topic**: Art. 37-39 — Mandatory-Designation-Kriterien + DPO-Position + Tasks.
- **Audit-Anwendung**: brutaler-Skill prueft Designation-Pflicht (Para 2.1+), Independence (Para 3.4), kein Conflict-of-Interest (DPO != IT-Lead / Compliance-Officer mit Weisungsbefugnis).
- **Source**: https://www.edpb.europa.eu/our-work-tools/general-guidance/endorsed-wp29-guidelines_en

### Guidelines 01/2023 — Article 37 Law Enforcement Directive
- **Status**: adopted 19.06.2024 · final
- **Topic**: ACHTUNG: NICHT GDPR-DPO. Diese Guideline betrifft Art. 37 LED — also Datenuebermittlungen im Kontext der Law-Enforcement-Directive (Polizei-/Justiz-Daten zwischen Mitgliedstaaten).
- **Audit-Anwendung**: Nur fuer LEA-/Behoerden-Mandanten relevant. NICHT als GDPR-DPO-Quelle zitieren.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012023-article-37-law-enforcement-directive_en

---

## Cluster 8: Sektorspezifisch (Video, Vehicles, Health, Voice, Finance)

### Guidelines 3/2019 — Processing of Personal Data through Video Devices
- **Status**: adopted 30.01.2020 · final
- **Topic**: CCTV-/Video-Surveillance — Rechtsgrundlagen, Information-Pflichten, Speicherdauer.
- **Audit-Anwendung**: Bei Mandanten mit Video-Ueberwachung (Hotel, Retail, Buero): brutaler-Skill prueft Schilder-Pflicht (Para 4.1) + Speicher-Default 72h + LegInt-Balancing.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-32019-processing-personal-data-through-video_en

### Guidelines 01/2020 — Connected Vehicles and Mobility Related Applications
- **Status**: adopted 09.03.2021 · final
- **Topic**: Daten aus connected cars — Geolokation, Driving-Behavior, Telemetrie.
- **Audit-Anwendung**: Schmal — Automotive-Mandanten only.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012020-processing-personal-data-context_en

### Guidelines 03/2020 — Processing of Health Data for Scientific Research (COVID-19 Context)
- **Status**: adopted 21.04.2020 · final
- **Topic**: Art. 9(2)(j) Health-Data-Scientific-Research im COVID-Kontext.
- **Audit-Anwendung**: Schmal — Health-Research-Mandanten.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032020-processing-data-concerning-health_en

### Guidelines 04/2020 — Use of Location Data and Contact Tracing Tools (COVID-19)
- **Status**: adopted 21.04.2020 · final
- **Topic**: COVID-Tracing-Apps, Pseudonymisation-Anforderungen.
- **Audit-Anwendung**: Historisch (post-COVID) — selten direkt anwendbar, aber Pseudonymisation-Beispiele bleiben relevant.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-042020-use-location-data-and-contact-tracing_en

### Guidelines 02/2021 — Virtual Voice Assistants
- **Status**: adopted 07.07.2021 · final
- **Topic**: Alexa/Google-Home/Siri — Always-On-Microphone, Voice-Sample-Storage, Joint-Controller-Frage.
- **Audit-Anwendung**: Bei Mandanten mit Voice-Integration: brutaler-Skill flagt Hot-Word-Detection-Speicherung + 3rd-Party-Voice-Processing-Transparenz.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-022021-virtual-voice-assistants_en

### Guidelines 06/2020 — Interplay of the Second Payment Services Directive (PSD2) and the GDPR
- **Status**: adopted 15.12.2020 · final
- **Topic**: PSD2 Art. 94 + GDPR-Verhaeltnis — Account Information Service Provider, Payment Initiation, Silent-Party-Data.
- **Audit-Anwendung**: Bei FinTech-/Banking-Mandanten: brutaler-Skill prueft AISP/PISP-Datenfluesse + Silent-Party-Schutz (Daten von Empfaenger-Drittparteien beim Zahlungsverkehr).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-062020-interplay-second-payment-services_en

### Guidelines 07/2020 — Concepts of Controller and Processor in the GDPR
- **Status**: adopted 07.07.2021 · final
- **Topic**: Definition Controller / Joint-Controller / Processor — purpose-determination + means-determination.
- **Audit-Anwendung**: KRITISCH bei AVV-Audit. brutaler-Skill prueft: (a) ist der angeblich-Processor wirklich nur weisungsgebunden, (b) Joint-Controller-Vereinbarung Art. 26 vorhanden wo noetig, (c) Sub-Processor-Cascade dokumentiert.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en

---

## Cluster 9: AI + Pseudonymisierung + Blockchain (2025-er Welle)

### Guidelines 01/2025 — Pseudonymisation
- **Status**: adopted 17.01.2025 · public consultation closed (final-after-consultation pending)
- **Topic**: Erste umfassende EDPB-Guidance zu Pseudonymisation als technical+organizational measure. Definiert Pseudonymisation vs. Anonymization, dokumentiert Re-Identification-Risk-Models, Use-Cases (research, breach mitigation, transfers).
- **Audit-Anwendung**: brutaler-Skill nutzt diese Guideline um Mandanten-Pseudonymization-Claims zu validieren — ist die "Pseudonymization" wirklich pseudonym (Linkability bleibt mit Schluessel) oder nur weak hashing? Cite Para 30+ fuer Re-Identification-Risk-Test.
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-012025-pseudonymisation_en

### Guidelines 02/2025 — Processing of Personal Data through Blockchain Technologies
- **Status**: adopted 14.04.2025 · public consultation closed
- **Topic**: Blockchain-Architekturen + DSGVO — On-Chain-PII-Verbot (Immutability vs. Art. 17 right-to-erasure), Pseudonymity vs. Anonymity, Smart-Contract-Datenfluesse.
- **Audit-Anwendung**: Bei Web3-/Crypto-Mandanten: brutaler-Skill flagt jeden On-Chain-PII-Storage als Art-17-Verstoss — auch wenn als hash gespeichert (re-identifiability via known plaintext attack).
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-022025-processing-personal-data-through_en

### Guidelines 3/2025 — Interplay between the DSA and the GDPR
- **Status**: adopted 12.09.2025 · public consultation closed
- **Topic**: Verhaeltnis Digital Services Act <-> DSGVO — Reporting-Verpflichtungen, Transparency-Database, Mod-Decisions.
- **Audit-Anwendung**: Bei Plattform-Mandanten (>VLOP-Schwelle oder Hosting/Online-Marketplace): brutaler-Skill prueft DSA-Reporting-Trigger + DSGVO-Konflikt-Bereiche.
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-32025-interplay-between-dsa-and-gdpr_en

### Joint Guidelines (EDPB + EDPS) — Interplay between the DMA and the GDPR
- **Status**: adopted 09.10.2025 · public consultation closed
- **Topic**: Digital Markets Act + DSGVO — Gatekeeper-Pflichten, Data-Portability-Klauseln Art. 6(9) DMA, Cross-Service-Data-Combination-Verbot.
- **Audit-Anwendung**: Sehr schmal — nur bei DMA-Gatekeeper-Mandanten oder Konkurrenten die gegen Gatekeeper vorgehen.
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/joint-guidelines-edpb-edps-interplay-between_en

### Guidelines 1/2026 — Processing of Personal Data for Scientific Research Purposes
- **Status**: adopted 16.04.2026 · public consultation ONGOING (Stand 2026-05-05)
- **Topic**: Long-awaited Research-Guidelines — Art. 5(1)(b) compatible-purpose, Art. 9(2)(j) special-category-research, Broad-Consent-Modelle.
- **Audit-Anwendung**: Achtung: noch in consultation — bei Research-Mandanten als "draft, can change" zitieren, nicht als final.
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2026/guidelines-12026-processing-personal-data_en

---

## Recommendations (6)

### Recommendations 01/2020 — Measures that Supplement Transfer Tools (Schrems-II Supplementary Measures)
- **Status**: final adopted 18.06.2021 (Draft 10.11.2020) · final
- **Topic**: 6-Step-Methodology fuer post-Schrems-II-Transfers: (1) Know your transfers, (2) Identify transfer tool, (3) Assess effectiveness in third country, (4) Adopt supplementary measures, (5) Procedural steps, (6) Re-evaluate periodically.
- **Audit-Anwendung**: KRITISCH bei JEDEM US-/Drittland-Transfer-Audit. brutaler-Skill verlangt dokumentierten 6-Step-Pruefbericht (TIA = Transfer Impact Assessment) — sonst Auditfund "SCC ohne TIA = ungenuegend post-Schrems-II".
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-012020-measures-supplement-transfer_en

### Recommendations 02/2020 — European Essential Guarantees for Surveillance Measures
- **Status**: adopted 10.11.2020 · final
- **Topic**: 4 Garantien fuer Drittland-Ueberwachungsregime: (1) Clear/precise/accessible rules, (2) Necessity + proportionality, (3) Independent oversight, (4) Effective remedies.
- **Audit-Anwendung**: Companion zu Rec-01/2020. brutaler-Skill prueft die 4 EEG fuer das jeweilige Drittland (US: FISA-702 schlaegt Garantien (3)+(4); China: alle 4 fragwuerdig; UK: post-Brexit-Adequacy-Decision aber Watch-List).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-022020-european-essential-guarantees_en

### Recommendations 1/2022 — Application for Approval and Elements/Principles in Controller BCR (Art. 47 GDPR)
- **Status**: adopted 20.06.2023 · final
- **Topic**: Aktualisierte Controller-BCR-Anforderungen post-Schrems-II.
- **Audit-Anwendung**: Bei Konzern-Mandanten mit BCR: brutaler-Skill prueft ob BCR die post-Schrems-II-Updates inkorporiert (TIA-Klausel, government-access-transparency, redress-mechanism).
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-12022-application-approval-and_en

### Recommendations 1/2025 — 2027 WADA World Anti-Doping Code
- **Status**: adopted 13.02.2025 · final
- **Topic**: Sektor-spezifisch — Anti-Doping-Datenverarbeitung im Sport.
- **Audit-Anwendung**: Schmal — Sport-/Anti-Doping-Mandanten only.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-12025-2027-wada-world-anti-doping-code_en

### Recommendations 2/2025 — Legal Basis for Requiring User Account Creation on E-Commerce Websites
- **Status**: adopted 04.12.2025 · public consultation closed
- **Topic**: E-Commerce-Mandatory-Account-Creation — wann ist Account-Pflicht Art. 6(1)(b) (necessary for contract) vs. unzulaessiger Bundling-Verstoss?
- **Audit-Anwendung**: Bei E-Commerce-Mandanten: brutaler-Skill prueft ob Guest-Checkout angeboten wird; mandatory-account-fuer-1-time-purchase = Auditfund.
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/recommendations-22025-legal-basis-requiring-user_en

### Recommendations 1/2026 — Application for Approval and Elements/Principles in Processor BCR (Art. 47 GDPR)
- **Status**: adopted 19.01.2026 · public consultation closed
- **Topic**: Processor-BCR-Pendant zu Rec-1/2022.
- **Audit-Anwendung**: Bei Cloud-/SaaS-Provider-Mandanten mit BCR-Strategy: brutaler-Skill prueft Processor-BCR-Eligibility.
- **Source**: https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2026/recommendations-12026-application-approval-and_en

---

## Opinions (Top 4 Most-Cited)

### Opinion 28/2024 — Data Protection Aspects related to AI Models
- **Status**: adopted 17.12.2024 · final
- **Topic**: Drei-Saulen-Antwort auf Irish-DPC-Anfrage: (1) Wann gilt ein AI-Modell als "anonym"? Case-by-case-Test mit (a) Identification-very-unlikely + (b) Extraction-via-queries-very-unlikely. (2) Kann LegInt-Art. 6(1)(f) Rechtsgrundlage fuer Training/Deployment sein? Ja, mit 3-Step-Test (siehe Guidelines 1/2024). (3) Was wenn das Modell aus rechtswidrig verarbeiteten Daten gebaut wurde? "Fruit of the poisonous tree"-Doktrin: Folge-Verarbeitungen koennen ebenfalls rechtswidrig sein.
- **Audit-Anwendung**: KRITISCH bei AI/LLM-Mandanten. brutaler-Skill flagt: (a) "Modell ist anonym"-Behauptung ohne dokumentierten 2-Test, (b) LegInt fuer Training ohne dokumentierten 3-Step-LIA, (c) Verwendung von Modell-Output ohne Pruefung der Trainings-Daten-Rechtmaessigkeit.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-282024-certain-data-protection-aspects_en

### Opinion 22/2024 — Obligations following from Reliance on Processor(s) and Sub-processor(s)
- **Status**: adopted 09.10.2024 · final
- **Topic**: 8 Fragen zu Controller-Pflichten in Sub-Processor-Ketten — kein duty-to-audit-jeden-Sub-Processor, aber risk-based Verantwortung. Klaert "ultimately responsible"-Doktrin.
- **Audit-Anwendung**: Bei AVV-Audit: brutaler-Skill prueft ob Controller die initial-Processor-Selection sorgfaeltig dokumentiert hat + ob Sub-Processor-Cascade-Risk-Bewertung existiert.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-222024-certain-obligations-following_en

### Opinion 08/2024 — Valid Consent in the Context of "Consent or Pay" Models (Large Online Platforms)
- **Status**: adopted 17.04.2024 · final
- **Topic**: Drei-Faktor-Test fuer "Consent or Pay" auf Large-Platforms: (1) ist die kostenpflichtige Alternative real (nicht prohibitiv-teuer), (2) gibt es eine "less intrusive" no-pay-Alternative ohne behavioral-tracking, (3) ist die consent-Auswahl nicht durch Power-Asymmetrie verzerrt. Default-Antwort: most cases = INVALID consent.
- **Audit-Anwendung**: Bei Mandanten mit Cookie-Pay-Wall (Spiegel-/Bild-Modell): brutaler-Skill flagt fast-immer als hochriskant; verlangt 3-Faktor-Pruefbericht + Alternative-Path-Dokumentation.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-082024-valid-consent-context-consent-or_en

### Opinion 23/2024 — Aptiv Group Controller-BCR (Irish DPA Draft Decision)
- **Status**: adopted 04.11.2024 · final
- **Topic**: BCR-Approval-Process-Beispielfall — illustriert wie EDPB die LSA-Draft prueft.
- **Audit-Anwendung**: Methodology-Reference fuer BCR-Submitter. Selten direkt zitierbar.
- **Source**: https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-232024-controller-binding-corporate-rules_en

---

## WP29-Endorsed Set (Endorsement 1/2018)

EDPB-Endorsement vom 25.05.2018 hat folgende Article-29-Working-Party-Guidelines uebernommen. Mehrere wurden inzwischen durch eigene EDPB-Guidelines abgeloest (s.u. "superseded").

| WP-Nr. | Titel | Status |
|---|---|---|
| WP259 rev.01 | Guidelines on Consent (2017) | SUPERSEDED durch Guidelines 05/2020 |
| WP260 rev.01 | Guidelines on Transparency (2017) | aktiv |
| WP251 rev.01 | Automated Decision-Making and Profiling (2017) | aktiv (Art. 22) |
| WP250 rev.01 | Personal Data Breach Notification (2017) | SUPERSEDED durch Guidelines 9/2022 |
| WP242 rev.01 | Right to Data Portability (2017) | aktiv (Art. 20) |
| WP248 rev.01 | DPIA + High-Risk-Determination (2017) | aktiv (Art. 35) |
| WP243 rev.01 | Data Protection Officers (DPO) (2017) | aktiv (Art. 37-39) |
| WP244 rev.01 | Lead Supervisory Authority Identification (2017) | SUPERSEDED durch Guidelines 8/2022 |
| WP253 | Application + Setting of Administrative Fines (2017) | SUPERSEDED durch Guidelines 04/2022 |
| WP254 rev.01 | Adequacy Referential (2017) | aktiv |

- **Source**: https://www.edpb.europa.eu/our-work-tools/general-guidance/endorsed-wp29-guidelines_en

> Audit-Regel: Wenn brutaler-Skill auf einen WP29-Guideline-Topic referenziert (zB. DPIA, Transparency, Profiling), IMMER zitieren als "WPxxx rev.01, EDPB-endorsed via Endorsement 1/2018" — nicht als eigenstaendige WP29-Quelle. Wenn ein Topic durch eine neue EDPB-Guideline abgeloest wurde, NUR die neue zitieren (s. Tabelle "SUPERSEDED").

---

## Anwendung im Skill-Output

### 7-Layer-Citation-Mapping fuer brutaler-anwalt

| Audit-Bereich | Primary EDPB-Quelle | Adoption | Sekundaer |
|---|---|---|---|
| Cookie-Banner / ePrivacy-Tracking | Guidelines 2/2023 (Art. 5(3)) | 16.10.2024 | Guidelines 03/2022 (dark patterns), Guidelines 05/2020 (consent) |
| Bussgeld-Layer / Schwere-Bewertung | Guidelines 04/2022 (calculation) | 24.05.2023 | Guidelines 02/2022 (Art. 60), Guidelines 03/2021 (Art. 65) |
| LegInt / Art. 6(1)(f) | Guidelines 1/2024 (LegInt) | 08.10.2024 | Guidelines 8/2020 (targeting) |
| Consent-Pruefung | Guidelines 05/2020 (consent) | 04.05.2020 | Opinion 08/2024 (consent-or-pay) |
| DSAR / Art. 15 | Guidelines 01/2022 (right of access) | 17.04.2023 | WP260 (transparency, endorsed) |
| Data-Breach / Art. 33-34 | Guidelines 9/2022 (breach notification) | 04.04.2023 | Guidelines 01/2021 (18 examples) |
| DPIA-Pflicht | WP248 rev.01 (endorsed) | 25.05.2018 | nationaler DPIA-Whitelist je AB |
| DPO-Designation | WP243 rev.01 (endorsed) | 25.05.2018 | (nicht Guidelines 01/2023 — die ist LED) |
| AVV / Controller-Processor | Guidelines 07/2020 (concepts) | 07.07.2021 | Opinion 22/2024 (sub-processor obligations) |
| Schrems-II / SCC + TIA | Recommendations 01/2020 (suppl. measures) | 18.06.2021 | Recommendations 02/2020 (EEG), Guidelines 02/2024 (Art. 48) |
| Transfer-Scope-Pruefung | Guidelines 05/2021 (Art. 3 vs. Kap. V) | 24.02.2023 | Guidelines 3/2018 (territorial scope) |
| BCR-Pruefung | Recommendations 1/2022 (Controller-BCR) | 20.06.2023 | Recommendations 1/2026 (Processor-BCR), Opinion 23/2024 |
| Privacy-by-Design | Guidelines 4/2019 (Art. 25) | 20.10.2020 | — |
| Joint-Controller / Art. 26 | Guidelines 07/2020 (concepts) | 07.07.2021 | Guidelines 8/2020 (targeting) |
| AI-Modell-Audit | Opinion 28/2024 (AI models) | 17.12.2024 | Guidelines 1/2024 (LegInt fuer training) |
| Pseudonymization-Claim-Pruefung | Guidelines 01/2025 (pseudonymisation) | 17.01.2025 | — |
| Blockchain / On-Chain-PII | Guidelines 02/2025 (blockchain) | 14.04.2025 | Opinion 28/2024 (AI-Anonymity-Test analog) |
| Plattform / DSA-Compliance | Guidelines 3/2025 (DSA-GDPR) | 12.09.2025 | Joint DMA-GDPR (2025-10-09) |
| FRT / Biometrics LEA | Guidelines 05/2022 (FRT-LEA) | 17.05.2023 | nationale LED-Umsetzung |
| Video-Surveillance | Guidelines 3/2019 (video) | 30.01.2020 | nationale BfDI-FAQ |
| Voice-Assistants | Guidelines 02/2021 (voice) | 07.07.2021 | — |
| FinTech / PSD2 | Guidelines 06/2020 (PSD2) | 15.12.2020 | nationale BaFin-FAQ |
| E-Commerce-Account-Pflicht | Recommendations 2/2025 | 04.12.2025 | Guidelines 2/2019 (Art. 6(1)(b)) |
| Codes-of-Conduct-Mandant | Guidelines 1/2019 (CoC + monitoring) | 04.06.2019 | Guidelines 04/2021 (CoC als transfer tool) |
| Behoerden-Datenuebermittlung | Guidelines 02/2024 (Art. 48) | 05.06.2025 | Guidelines 2/2018 (Art. 49) |

### Quick-Cite-Format im Skill-Output

```
EDPB-Quelle: Guidelines NN/YYYY ("Title"), adopted DD.MM.YYYY
URL: https://www.edpb.europa.eu/...
Para X-Y: <konkrete Fundstelle>
```

> Beispiel-Skill-Output:
> "Auditfund: Mandant nutzt Art. 6(1)(f) (Direct Marketing) ohne dokumentiertes LIA.
> EDPB-Quelle: Guidelines 1/2024 ("Processing based on Article 6(1)(f) GDPR"),
> adopted 08.10.2024. URL: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-12024-processing-personal-data-based_en
> Para 11-29: 3-Step-Test (existence / necessity / balancing) ist Pflicht;
> ohne dokumentiertes LIA = unzulaessige Verarbeitung => Bussgeldrisiko Tier-2."

### Update-Pflicht

EDPB-Guidelines werden regelmaessig revidiert (ePrivacy 5(3) hatte v1+v2, Article-48 hatte v1+v2.1). brutaler-Skill prueft halbjaerlich (Mai + November) gegen edpb.europa.eu Listing-Page ob Versionen sich geaendert haben — wenn ja, diese Datei aktualisieren + Skill-Reference-Pointer pruefen.

---

> Ende eu-edpb-guidelines.md · 2026-05-05 · ~33 Guidelines + 6 Recommendations + 4 Top-Opinions + 10 WP29-Endorsed verifiziert.
