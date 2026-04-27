# Internationales Datenschutz- und Compliance-Recht

> Lade diese Datei wenn die Site internationale Nutzer adressiert oder
> Drittlandtransfer beinhaltet (US-CDN, US-Analytics, UK-Hoster, Schweiz-Server).

---

## Drittlandtransfer (DSGVO Art. 44–49)

### Kerngrundsatz
Personenbezogene Daten duerfen nur in Drittlaender uebermittelt werden, wenn:
1. **Angemessenheitsbeschluss** der EU-Kommission existiert (Art. 45), ODER
2. **Geeignete Garantien** vorliegen (Art. 46): SCC, BCR, Verhaltensregeln, Zertifizierungen, ODER
3. **Ausnahmefall** nach Art. 49 (selten, eng auszulegen).

### Drittlaender mit Angemessenheitsbeschluss (Stand 2026)
- Andorra, Argentinien, Faroeer, Guernsey, Isle of Man, Israel, Japan, Jersey, Neuseeland, Suedkorea, Schweiz, Uruguay, UK (mit Vorbehalt), USA (DPF — nur fuer zertifizierte Unternehmen)

### Standardvertragsklauseln (SCC)
- EU-Kommissions-SCC 2021: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32021D0914
- 4 Module: C2C, C2P, P2C, P2P
- Plus: **Transfer Impact Assessment (TIA)** vom EuGH gefordert (Schrems II), keine formelle Pflicht aber Best Practice

### EU-US Data Privacy Framework (DPF)
- Aktiv seit 10.07.2023 (EU-Kommissions-Beschluss 2023/1795)
- Loest Privacy Shield ab (durch Schrems II ungueltig)
- **Pruefung**: Ist der US-Empfaenger DPF-zertifiziert? Pruefe unter https://www.dataprivacyframework.gov
- **Risiko**: noyb (Schrems) hat Klage angekuendigt — kann erneut kippen
- **Best Practice**: Trotz DPF auch SCC abschliessen, TIA dokumentieren

### Drittland-Pruefpunkte fuer Skill
- [ ] Welche Drittlaender im Tech-Stack? (CDN, Cloud-Hosting, Analytics, Email-Provider, CRM)
- [ ] Pro Drittland: Angemessenheitsbeschluss ODER SCC ODER BCR?
- [ ] Bei US-Empfaengern: DPF-Zertifizierung gepruef? Plus SCC als Backup?
- [ ] In Datenschutzerklaerung: Drittlandtransfer transparent erwaehnt + Garantien benannt?
- [ ] AVV mit Subprozessoren-Liste (oft ueberseeisch)?
- [ ] TIA dokumentiert (besonders bei US-Hochrisiko-Diensten)?

### Typische Falle: US-CDN / US-Analytics
- Cloudflare, Vercel-Edge: in der Regel EU-Edge bevorzugt, US-Edge nur Fallback. Konfiguration pruefen!
- Google Analytics 4 (GA4): Server in EU per default (seit 2024), aber Datenkopie an US moeglich. Server-Side-Tagging empfohlen.
- AWS S3: Standardmaessig EU-Region waehlbar (eu-central-1). Nicht US-East default belassen.

---

## UK GDPR (Vereinigtes Koenigreich)

### Status
- Nach Brexit: UK GDPR (im Wesentlichen Kopie der EU-DSGVO, mit nationalen Anpassungen)
- Daten-Adequacy-Decision der EU fuer UK: bis 2025+ verlaengert
- ICO (Information Commissioner's Office) ist Aufsicht: https://ico.org.uk

### Unterschiede zur EU-DSGVO
- Kein Datenschutzbeauftragter-Pflicht-Schwellwert (UK-spezifisch)
- ICO-Bussgeldrahmen aehnlich (bis £17,5 Mio. oder 4% globaler Umsatz)
- UK-spezifische SCCs (International Data Transfer Agreement IDTA oder UK Addendum zu EU-SCC)

### Pruefpunkte
- [ ] UK-Nutzer adressiert? → UK GDPR-Compliance erforderlich
- [ ] UK als Drittland-Empfaenger? → Adequacy-Decision pruefen (2025+ verlaengert)
- [ ] ICO-Hinweis in Datenschutzerklaerung erwaehnen (fuer UK-Nutzer)?

---

## Schweizer Datenschutzgesetz (revDSG)

### Status
- Revidiertes DSG seit 01.09.2023 in Kraft
- An DSGVO angelehnt, aber teilweise unterschiedlich

### Unterschiede
- Kein Datenschutzbeauftragter-Pflicht (anders als DSGVO § 37)
- Bussgelder: bis 250.000 CHF (anders Art. 83 DSGVO bis 4% Umsatz)
- Personalisationspflicht: Verantwortlicher kann persoenlich strafrechtlich belangt werden

### Pruefpunkte
- [ ] Schweizer Nutzer adressiert? → revDSG-Compliance
- [ ] DSGVO ueblicherweise auch revDSG-konform, aber: Datenschutzerklaerung CH-spezifisch erwaehnt?
- [ ] EDOEB (Eidgenoessischer Datenschutz- und Oeffentlichkeitsbeauftragter) als Aufsicht erwaehnt?

---

## CCPA / CPRA (Kalifornien)

### Status
- California Consumer Privacy Act (CCPA) seit 2020
- California Privacy Rights Act (CPRA) seit 2023
- Kalifornische Aufsicht: California Privacy Protection Agency (CPPA)

### Anwendung auf Nicht-US-Unternehmen
Wenn Site:
- California-Resident (Bewohner) adressiert UND
- Schwellwerte erfuellt:
  - Jahresumsatz > 25 Mio. USD ODER
  - Verarbeitung von 100.000+ California-Resident-Daten/Geraeten ODER
  - 50%+ Einkommen aus Daten-Verkauf

### Pflichten (vereinfacht)
- "Do Not Sell or Share My Personal Information"-Link auf Homepage
- Privacy Notice mit CCPA-spezifischen Rechten (Auskunft, Loeschung, Opt-Out)
- Sale/Share-Definition ist breit: auch Datenuebertragung an Dritte fuer Targeting-Werbung kann „Verkauf" sein
- Annual Audit (CPRA) bei grossen Verarbeitern

### Pruefpunkte
- [ ] California-Resident adressiert + Schwellwert erfuellt?
- [ ] „Do Not Sell or Share"-Link?
- [ ] CCPA-spezifischer Privacy Notice (oder Erweiterung der DSE)?
- [ ] Opt-Out-Mechanismus implementiert?

---

## Weitere internationale Regelungen (Kurz-Uebersicht)

| Region | Gesetz | Aufsicht | Bussgeldrahmen | Wichtigster Pruefpunkt |
|--------|--------|----------|----------------|-----------------------|
| Brasilien | LGPD (Lei Geral de Protecao de Dados) | ANPD | bis 2% Umsatz brasilianischer Operationen, max 50 Mio. BRL | Privacy Notice in Portugiesisch, DPO falls Schwellwerte |
| Kanada | PIPEDA | OPC | bis 100.000 CAD | Privacy Notice, Consent-Standard |
| Japan | APPI | PPC | bis 100 Mio. JPY | Cross-Border-Transfer mit Consent oder Adequacy |
| Australien | Privacy Act | OAIC | bis 50 Mio. AUD | APP-Compliance, Privacy Policy |
| Indien | DPDP Act 2023 | Data Protection Board | bis 250 Crore INR (~25 Mio. EUR) | Consent in Lokalsprachen, Data Localization fuer „Sensitive" |
| Suedafrika | POPIA | Information Regulator | bis 10 Mio. ZAR | Consent + Notification |
| China | PIPL | CAC | bis 50 Mio. CNY oder 5% Umsatz | Cross-Border-Transfer-Pflichten, Local-Storage fuer „Important Data" |

---

## Cross-Region Best Practices

### Universal Privacy Notice
- Sprachen: DE + EN + bei US-Targeting auch Spanisch/Mexikanisch
- Klare Sektionen pro Rechtsraum (DSGVO / UK / CH / CCPA)
- Aufsichtsbehoerden-Liste pro Region

### Data Mapping
- Inventarisiere fuer jede Datenkategorie: Quelle, Verarbeitungszweck, Empfaenger, Speicherdauer, Rechtsgrundlage je Region.

### Multi-Region SCCs
- EU-EU-SCCs decken EU + EWR
- UK-Addendum oder IDTA fuer UK
- Schweiz: oft EU-SCCs anerkannt mit Schweizer Addendum

---

## Skill-Pattern bei Drittland-Befund

Wenn HUNTER findet, dass Drittland-Empfaenger ohne Garantie genutzt wird:

```
Finding: Drittlandtransfer ohne dokumentierte Garantien
- HUNTER: [Empfaenger X in Y-Land], kein SCC erkennbar, DSE erwaehnt Drittland nicht
- Rechtsgrundlage: Art. 44–46 DSGVO
- Az.: EuGH C-311/18 Schrems II
- Bussgeldstufe: 2 (bis 4% Jahresumsatz, Art. 83 Abs. 5)
- CHALLENGER-Test:
  - Bedingung A: Empfaenger im Drittland? [erfuellt/nicht]
  - Bedingung B: Angemessenheitsbeschluss? [erfuellt/nicht]
  - Bedingung C: SCC abgeschlossen? [erfuellt/nicht]
  - Bedingung D: BCR oder Zertifizierung? [erfuellt/nicht]
  - Verdict: [verified/disputed]
- Fix:
  1. SCC abschliessen (EU-SCC 2021, passendes Modul)
  2. TIA durchfuehren + dokumentieren
  3. Datenschutzerklaerung erweitern: Drittland-Empfaenger + Garantien benennen
```
