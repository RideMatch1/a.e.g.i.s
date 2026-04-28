# Art. 13/15 Templates Reference

Templates for DSGVO Art. 13 (Informationspflicht bei Erhebung beim Betroffenen), Art. 14 (Erhebung bei Dritten), Art. 15 (Auskunftsanfrage-Antwort). Calibrated to current BGH/EuGH-Linie (as of 2025).

---

## Disclaimer

These templates are informational; not legal advice. Calibrated to general DSGVO compliance for typical AEGIS-foundation projects (DACH B2C/B2B web-businesses). Industry-specific variations (medical / legal / financial) require Fachanwalt-review before use. Templates expire when BGH/EuGH-Linie shifts; check this reference's last-updated-date before use.

---

## Art. 13 — Full DSE Template (Datenschutzerklärung)

The full DSE concatenates these sections (one per processing-purpose):

### Section A — Verantwortlicher (always first)

```markdown
## 1. Name und Anschrift des Verantwortlichen

Der Verantwortliche im Sinne der Datenschutz-Grundverordnung sowie anderer 
nationaler Datenschutzgesetze der Mitgliedsstaaten sowie sonstiger 
datenschutzrechtlicher Bestimmungen ist:

<Firma>
<Straße + Hausnummer>
<PLZ + Ort>
Deutschland

Tel.: <+49 ...>
E-Mail: <kontakt@example.com>
Website: <https://www.example.com>
```

### Section B — Datenschutzbeauftragter (when applicable per Art. 37)

```markdown
## 2. Datenschutzbeauftragter

Den Datenschutzbeauftragten erreichen Sie unter:

<Name (or "Datenschutzteam")>
<Adresse — kann identisch zu Verantwortlichem sein, oder separate>
E-Mail: dsb@example.com

(Hinweis: Datenschutzbeauftragter ist <intern bestellt> | <extern bestellt> 
gemäß Art. 37 DSGVO + § 38 BDSG.)
```

### Section C — Verarbeitungstätigkeiten (one per purpose)

```markdown
## 3. Verarbeitung beim Besuch unserer Website

### 3.1 Server-Logfiles

Bei jedem Aufruf erfasst der Server folgende Daten:

- IP-Adresse (anonymisiert nach <N> Tagen)
- Datum und Uhrzeit der Anfrage
- Browser-Typ + Version
- Betriebssystem
- Referrer-URL
- HTTP-Statuscode

**Zweck:** Sicherstellung des stabilen Betriebs, Erkennung von 
Sicherheitsvorfällen, Optimierung der Website.

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen). 
Unsere berechtigten Interessen liegen in der Bereitstellung einer 
funktionsfähigen, sicheren Website.

**Speicherdauer:** Server-Logfiles werden nach <N> Tagen anonymisiert 
und nach <M> Tagen gelöscht.

**Empfänger:** Hosting-Provider (<Anbieter-Name>, <Sitzland>), Auftragsverarbeitung 
nach Art. 28 DSGVO.

**Drittlandtransfer:** <Nein | Ja, an <Land>, gestützt auf <SCC + TIA per Art. 46>.>
```

(Repeat 3.X for: Kontaktformular, Newsletter, Analytics, Chatbot, Scanner, 
Cookies, etc. — every processing-purpose gets its own section.)

### Section D — Empfänger / Empfängerkategorien

```markdown
## 4. Empfänger der Daten

Wir geben Ihre Daten nur an folgende Empfänger weiter:

- **Hosting-Provider** (<Anbieter, Sitzland>) — Auftragsverarbeitung Art. 28
- **E-Mail-Provider** (<Anbieter, Sitzland>) — Auftragsverarbeitung
- **Newsletter-Service** (<Anbieter, Sitzland>) — wenn abonniert
- **Steuerberater + Rechnungssoftware** — bei Vertragsbeziehung, gesetzliche Pflicht (HGB / AO)

Eine vollständige Liste aller Auftragsverarbeiter erhalten Sie auf Anfrage 
unter dsb@example.com.
```

### Section E — Drittlandtransfer (always present, even if "none")

```markdown
## 5. Übermittlung in Drittländer

<Variante A — kein Drittlandtransfer:>
Wir übermitteln keine personenbezogenen Daten in Drittländer (außerhalb der EU/EWR).

<Variante B — Drittlandtransfer:>
Folgende Empfänger sitzen in einem Drittland (außerhalb der EU/EWR):

- **<Anbieter A>** (USA): Übermittlung gestützt auf Standardvertragsklauseln 
  (SCC) der EU-Kommission (Beschluss 2021/914) sowie ergänzende technische 
  und organisatorische Maßnahmen (TIA gemäß EDSA Recommendations 01/2020).
- **<Anbieter B>** (...)

Informationen zu den Schutzgarantien erhalten Sie auf Anfrage unter dsb@example.com.
```

### Section F — Speicherdauer

```markdown
## 6. Speicherdauer

Wir speichern Ihre Daten nur so lange, wie es für die jeweilige Zweckerfüllung 
erforderlich ist:

| Datenkategorie | Speicherdauer | Löschtrigger |
|---|---|---|
| Server-Logfiles | <N> Tage anonymisiert, dann gelöscht | Cron-Job |
| Kontaktanfragen | 6 Monate nach letzter Kommunikation | Manuell + Audit |
| Newsletter | bis Abmeldung + 30 Tage Grace | API-Webhook |
| Vertragsdaten | 10 Jahre (HGB § 257 / AO § 147) | Cron + manuelle Freigabe |
| Bewerberdaten | 6 Monate nach Absage | Cron |
```

### Section G — Betroffenenrechte

```markdown
## 7. Ihre Rechte

Sie haben folgende Rechte:

- **Art. 15 DSGVO — Auskunft:** Sie können erfahren, welche Daten wir zu 
  Ihrer Person verarbeiten.
- **Art. 16 DSGVO — Berichtigung:** Sie können unrichtige Daten korrigieren lassen.
- **Art. 17 DSGVO — Löschung ("Recht auf Vergessenwerden"):** Sie können 
  die Löschung Ihrer Daten verlangen, soweit keine gesetzlichen 
  Aufbewahrungspflichten entgegenstehen.
- **Art. 18 DSGVO — Einschränkung der Verarbeitung:** ...
- **Art. 20 DSGVO — Datenübertragbarkeit:** ...
- **Art. 21 DSGVO — Widerspruch:** Insbesondere gegen Direktwerbung.

Zur Wahrnehmung wenden Sie sich an dsb@example.com oder per Post an die oben 
genannte Anschrift.
```

### Section H — Beschwerderecht

```markdown
## 8. Beschwerderecht bei einer Aufsichtsbehörde

Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. 
Die für uns zuständige Behörde ist:

**<Landesdatenschutzbehörde — z.B. Bayerisches Landesamt für Datenschutzaufsicht>**
<Anschrift>
<Telefon> | <E-Mail>

Sie können sich auch an jede andere Aufsichtsbehörde Ihrer Wahl wenden.
```

### Section I — Pflicht zur Bereitstellung

```markdown
## 9. Pflicht zur Bereitstellung der Daten

Die Bereitstellung Ihrer Daten ist <für den Vertragsabschluss erforderlich | 
freiwillig>. Wenn Sie Ihre Daten nicht bereitstellen, <kann der Vertrag 
nicht geschlossen werden | wird der Service in eingeschränkter Form geliefert>.
```

### Section J — Automatisierte Entscheidung (when applicable)

```markdown
## 10. Automatisierte Entscheidungsfindung

<Variante A:>
Eine automatisierte Entscheidungsfindung einschließlich Profiling findet 
nicht statt.

<Variante B:>
Wir nutzen automatisierte Entscheidungsfindung im Rahmen <Beschreibung>. 
Logik: <Erläuterung>. Tragweite: <Auswirkungen>. Sie haben das Recht auf 
menschliches Eingreifen, eigene Position darzulegen, Entscheidung anzufechten 
(Art. 22 Abs. 3 DSGVO).
```

---

## Art. 13 — Short-Form (Form-Inline)

For embedded forms (Kontaktformular, Newsletter), a 3-paragraph short-form near the form:

```markdown
**Datenschutz-Hinweis:**

Mit Absenden des Formulars willigen Sie in die Verarbeitung Ihrer Daten 
zur Beantwortung Ihrer Anfrage ein (Art. 6 Abs. 1 lit. a DSGVO). Speicherdauer: 
6 Monate nach letzter Kommunikation. Empfänger: nur unser Team + E-Mail-Provider 
(<Provider>, Auftragsverarbeitung).

Sie können Ihre Einwilligung jederzeit widerrufen — schreiben Sie an dsb@example.com.

Vollständige Datenschutzerklärung: [/datenschutz](/datenschutz).
```

---

## Art. 15 — Auskunftsanfrage-Antwort-Template

When a Betroffener stellt eine Auskunftsanfrage:

```markdown
Sehr geehrte/r <Name>,

vielen Dank für Ihre Anfrage vom <Datum>. Wir bestätigen die Erhalt am <Datum>.

Gemäß Art. 15 DSGVO erhalten Sie folgende Auskunft:

## Verarbeitete Daten

Wir verarbeiten zu Ihrer Person folgende Daten:

| Kategorie | Wert | Speicherort | Speicherdauer |
|---|---|---|---|
| Stammdaten | <Name>, <E-Mail> | Customer-DB | bis <Datum> |
| Anfragen-Historie | <N> Anfragen (Datum-Bereich <von-bis>) | Email-System | 6 Monate nach letzter |
| ... | ... | ... | ... |

## Verarbeitungszwecke + Rechtsgrundlagen

- <Zweck 1>: Art. 6 Abs. 1 lit. <X> DSGVO
- <Zweck 2>: ...

## Empfänger

Ihre Daten wurden an folgende Empfänger weitergegeben:

- <Empfänger A> (Hosting): Auftragsverarbeitung Art. 28
- <Empfänger B> (E-Mail): Auftragsverarbeitung Art. 28

## Geplante Speicherdauer

Siehe Tabelle oben. Generell-Policy: <Policy-Link>.

## Ihre Rechte

Sie haben folgende Rechte (Art. 16-22 DSGVO):
- Berichtigung (Art. 16)
- Löschung (Art. 17)
- Einschränkung (Art. 18)
- Datenübertragbarkeit (Art. 20)
- Widerspruch (Art. 21)
- Beschwerderecht bei Aufsichtsbehörde (Art. 77) — siehe DSE für Kontaktdaten.

## Kopie

Eine Kopie Ihrer Daten finden Sie im Anhang (machine-readable JSON + 
human-readable PDF).

Mit freundlichen Grüßen
<Datenschutzbeauftragter>
<Email + Telefon>
```

**Frist:** 1 Monat ab Eingang. Bei Komplexität: + 2 Monate, mit Begründungs-Brief 
innerhalb 1 Monat.

**Identitätsprüfung:** vor Auskunftserteilung — Rückfrage mit identifizierender 
Information (z.B. zuletzt registrierte E-Mail-Adresse).

---

## Anti-Patterns

- ❌ Generic "Datenschutz ist uns wichtig"-prose ohne Pflicht-Felder — abmahn-risk.
- ❌ Art. 13 ohne Speicherdauer-Tabelle — fehlt Pflicht-Feld Art. 13 Abs. 2 lit. a.
- ❌ Drittland-Section weglassen weil "kein Drittlandtransfer" — explizit "Variante A: kein Transfer" angeben.
- ❌ Art. 15 Antwort > 1 Monat ohne Begründung — Frist-Verletzung Art. 12 Abs. 3.
- ❌ Identitätsprüfung skippen vor Auskunft — Risiko Identitätsdiebstahl.
- ❌ Spezifische Datenkategorien als "diverse Daten" zusammenfassen — Pflicht zu konkret-listen.
- ❌ AVV-Liste nicht parat — Art. 13 Abs. 1 lit. e Empfänger-Pflicht.

---

## Update-Trigger

Diese Templates aktualisieren bei:

- BGH-Entscheidung mit DSGVO-Relevanz (z.B. Cookie-Banner-Linie)
- EuGH-Entscheidung (z.B. Schrems-III)
- DSGVO-Änderungs-Verordnung
- BDSG-Novelle
- TTDSG/TDDDG-Änderungen
- DSK-Resolutionen oder Empfehlungs-Updates

Last-updated: 2025 (post-TDDDG-Enactment).
