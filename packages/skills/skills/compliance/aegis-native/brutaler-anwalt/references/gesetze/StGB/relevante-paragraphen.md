---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/stgb/
last-checked: 2026-05-02
purpose: StGB §§ 202a-d + verwandte IT-Strafrechts-Tatbestaende.
---

# StGB — IT-relevante Paragraphen

> Volltext: https://www.gesetze-im-internet.de/stgb/

## § 202a — Ausspaehen von Daten

> „Wer unbefugt sich oder einem anderen Zugang zu Daten, die nicht fuer ihn bestimmt und die gegen unberechtigten Zugang besonders gesichert sind, unter Ueberwindung der Zugangssicherung verschafft, wird mit Freiheitsstrafe bis zu drei Jahren oder mit Geldstrafe bestraft."

### Tatbestand

- **Unbefugter Zugang** zu Daten
- Daten nicht fuer Taeter bestimmt
- Daten gegen unberechtigten Zugang **besonders gesichert** (= Verschluesselung, Passwort, Zugriffskontrolle)
- **Ueberwindung der Zugangssicherung**

### Praxis-Hinweis

Wenn Daten KEINE Sicherung haben (z.B. Public-Endpoint ohne Auth) → KEIN § 202a-Vorfall (Schutzgebot der „Sicherung").
Aber Datenpanne nach Art. 33 DSGVO + ggf. § 263 StGB (Computerbetrug) trotzdem moeglich.

### Strafe

- Bis **3 Jahre Freiheitsstrafe oder Geldstrafe**
- Antragsdelikt (§ 205) — Strafverfolgung nur auf Antrag (ausser bei besonderem oeffentlichen Interesse)

## § 202b — Abfangen von Daten

> „Wer unbefugt sich oder einem anderen unter Anwendung von technischen Mitteln nichtoeffentliche Datenuebermittlung oder die elektromagnetische Abstrahlung einer Datenverarbeitungsanlage verschafft, wird mit Freiheitsstrafe bis zu zwei Jahren oder mit Geldstrafe bestraft."

### Tatbestand

- WLAN-Sniffing, Man-in-the-Middle (MITM)
- TLS-Bypass
- Bluetooth/NFC-Abhoeren

### Strafe

- Bis 2 Jahre Freiheitsstrafe oder Geldstrafe.

## § 202c — Vorbereiten des Ausspaehens und Abfangens („Hackertools-Paragraph")

> „Wer eine Straftat nach § 202a oder § 202b vorbereitet, indem er Passwoerter (...) oder Computerprogramme, deren Zweck die Begehung einer solchen Tat ist, herstellt, sich oder einem anderen verschafft, verkauft, einem anderen ueberlasst, verbreitet oder sonst zugaenglich macht, wird mit Freiheitsstrafe bis zu zwei Jahren oder mit Geldstrafe bestraft."

### Tatbestand

- Tools deren Zweck die Begehung einer 202a/b-Tat ist
- Strittig wegen Dual-Use-Tools (Pen-Test, Sicherheitsforschung)

### Praxis-Hinweis (BVerfG 2009)

BVerfG hat § 202c verfassungskonform reduziert: nur Tools mit **PRIMAERER** Tatzweck-Bestimmung sind strafbar. Dual-Use-Tools (Wireshark, nmap, metasploit) sind im legitimen Sicherheitskontext nicht erfasst.

**Aber**: aktive Pen-Tests gegen Drittseite ohne Authorisierung = § 202a-Versuch (auch ohne erfolgreichen Zugriff).

## § 202d — Datenhehlerei

Hehlerei mit personenbezogenen Daten — Empfangen/Sich-Verschaffen ausgespaehter Daten ist strafbar.

## § 263a — Computerbetrug

> „Wer in der Absicht, sich oder einem Dritten einen rechtswidrigen Vermoegensvorteil zu verschaffen, das Vermoegen eines anderen dadurch beschaedigt, dass er das Ergebnis eines Datenverarbeitungsvorgangs durch unrichtige Gestaltung des Programms, durch Verwendung unrichtiger oder unvollstaendiger Daten, durch unbefugte Verwendung von Daten oder sonst durch unbefugte Einwirkung auf den Ablauf beeinflusst (...)."

### Tatbestand

- Manipulation Datenverarbeitungs-Vorgang
- Vermoegen-Schaden

### Beispiele

- Manipulierte Online-Shop-Bestellung (Pricing-Bypass)
- Identity-Theft + Auto-Bezahlung
- ATM-/Kartenleser-Manipulation

### Strafe

- Bis 5 Jahre, in besonders schweren Faellen bis 10 Jahre.

## § 269 — Faelschung beweiserheblicher Daten

> „Wer zur Taeuschung im Rechtsverkehr beweiserhebliche Daten so speichert oder veraendert, dass bei ihrer Wahrnehmung eine unechte oder verfaelschte Urkunde vorliegen wuerde (...)."

### Tatbestand

- Manipulation von Logs / E-Mail-Headers / Meta-Daten

### Beispiele

- Gefaelschte E-Mail-Header
- Manipulierte Server-Logs
- DKIM-Signature-Faelschung

## § 303a — Datenveraenderung

> „Wer rechtswidrig Daten loescht, unterdrueckt, unbrauchbar macht oder veraendert, wird mit Freiheitsstrafe bis zu zwei Jahren oder mit Geldstrafe bestraft."

### Tatbestand

- Unbefugte Loeschung / Veraenderung fremder Daten

### Beispiele

- Server-Logs nach Datenpanne loeschen (zur Verschleierung)
- Datenbank-Manipulation durch ehemaligen Mitarbeiter

## § 303b — Computersabotage

> „Wer eine Datenverarbeitung, die fuer einen anderen von wesentlicher Bedeutung ist, dadurch erheblich stoert, dass er
> 1. eine Tat nach § 303a Abs. 1 begeht oder
> 2. Daten in der Absicht, einem anderen Nachteil zuzufuegen, eingibt oder uebermittelt oder
> 3. eine Datenverarbeitungsanlage oder einen Datentraeger zerstoert, beschaedigt, unbrauchbar macht, beseitigt oder veraendert,
> wird mit Freiheitsstrafe bis zu drei Jahren (...)."

### Tatbestand

- DDoS-Attacken
- Ransomware
- Stoerung kritischer IT-Infrastruktur

### Strafe

- Standard: bis 3 Jahre
- Bei kritischer Infrastruktur (Versorgung, Hilfsdienste): bis 10 Jahre

## Pen-Test-Grenzen (Cross-Reference zu AEGIS)

AEGIS active probes (`aegis siege` / `aegis pentest`) sind Dual-Use Tools.
Compliant nur bei:
- Operator-Authorisierung (eigenes System)
- Schriftliche Pen-Test-Vereinbarung
- Bug-Bounty-Programm-Scope

OHNE Authorisierung: § 202a/b/c-Versuch + § 202d (bei erfolgreicher Daten-Erfassung) + § 303a/b (bei Stoerung).

## Audit-Relevanz fuer Skill

| Audit-Surface | StGB-Pflicht |
|---|---|
| HTTPS auf gesamter Site | sonst § 202a / § 202b leichter zu erfuellen |
| Brute-Force-Lockout auf Login | sonst Tatbestand-naehe Versuch |
| Audit-Logs unveraenderbar | § 269 / § 303a-Schutz |
| Pen-Test-Disclaimer auf Site | § 202c-Distance |
| security.txt mit Coordinated Vulnerability Disclosure | de-eskalierende Info |

## Source

- [gesetze-im-internet.de — StGB](https://www.gesetze-im-internet.de/stgb/)
- [BVerfG zu § 202c](https://www.bundesverfassungsgericht.de/SharedDocs/Pressemitteilungen/DE/2009/bvg09-058.html)
