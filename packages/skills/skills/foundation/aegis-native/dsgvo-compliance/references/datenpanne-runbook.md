# Datenpanne-Runbook (Art. 33 + 34 DSGVO)

Runbook für Datenpannen / data-breaches. Art. 33 Abs. 1 DSGVO: Meldung an 
Aufsichtsbehörde innerhalb 72 Stunden ab Bekanntwerden, sofern nicht 
"voraussichtlich kein Risiko für die Rechte und Freiheiten natürlicher Personen". 
Art. 34: Benachrichtigung der betroffenen Personen bei "voraussichtlich hohem Risiko".

**Disclaimer:** Dieses Runbook ist informational; nicht rechtlich bindend. 
Bei aktivem Vorfall sofort Datenschutzbeauftragten + Fachanwalt für IT-Recht / 
Datenschutz hinzuziehen.

---

## Sofortmaßnahmen (Stunde 0-1)

### Schritt 1: Vorfall isolieren

```
1. Quellsystem identifizieren (Server, Endpoint, Service)
2. Zugriffe / Verarbeitungsvorgänge stoppen
3. Snapshot des Zustands sichern (Logs, DB-Dumps, Memory-Dumps)
4. Kein Reset / Reinstall — würde Forensik zerstören
```

### Schritt 2: Eskalations-Trigger

```
1. Verantwortlicher / Geschäftsleitung informieren (mündlich + per E-Mail)
2. Datenschutzbeauftragten (DSB) informieren (intern oder extern)
3. IT-Leitung / Hosting-Provider informieren
4. Bei Strafrechtsrelevanz (Hack / Bot-Angriff): Polizei + Cybercrime-Stelle
5. Bei Pressefall (Whistleblower / Medien): externe Kommunikation vorbereiten
```

### Schritt 3: Initial-Assessment

```
- Welche Daten betroffen? (Stammdaten / Bestand / Kontakt / Finanz / 
  Gesundheits / besondere Kategorien per Art. 9)
- Wie viele Datensätze?
- Wie viele Betroffene (≈)?
- Zeitfenster der Exposition (von-bis)?
- Ist die Lücke noch offen?
- Wurden Daten exfiltriert oder nur exponiert?
```

---

## 72h-Timeline

| Zeitpunkt | Aktion | Verantwortlich |
|---|---|---|
| t=0h | Bekanntwerden — Vorfall isolieren | IT |
| t=1h | Eskalation + DSB informieren | Verantwortlicher |
| t=4h | Initial-Assessment komplett | DSB + IT |
| t=12h | Forensik gestartet (intern oder extern) | DSB + IT |
| t=24h | Risiko-Bewertung abgeschlossen | DSB |
| t=48h | Art. 33 Meldung-Entwurf fertig | DSB + Verantwortlicher |
| t=72h | Art. 33 Meldung an Aufsichtsbehörde | Verantwortlicher (Pflicht) |
| t=72h+ | Art. 34 Betroffene-Benachrichtigung (wenn hohes Risiko) | Verantwortlicher |
| t=7d | Internes Lessons-Learned-Meeting | DSB + IT + Geschäftsleitung |
| t=30d | Audit-Trail komplettiert (Art. 33 Abs. 5) | DSB |

**WICHTIG:** Die 72h-Frist beginnt mit "Bekanntwerden" beim Verantwortlichen, 
nicht mit Vorfall-Eintritt. Wenn Vorfall am 1.10. passierte aber erst am 5.10. 
bekannt wurde — Frist läuft ab 5.10. Aber: vorhergehende Verzögerung kann 
Bußgeld erhöhen (Art. 83 Abs. 2 lit. c — "Maßnahmen zur Risikominderung").

---

## Risiko-Bewertung (Art. 33 Abs. 1 + Art. 34 Abs. 1)

### Schwellwerte

| Risiko-Level | Konsequenz |
|---|---|
| **Kein Risiko** ("voraussichtlich kein Risiko") | Keine Meldung an Aufsichtsbehörde nötig (selten — sehr enge Auslegung). Aber: Art. 33 Abs. 5 internes Doku-Pflicht bleibt. |
| **Risiko** ("voraussichtlich Risiko") | Art. 33 Meldung an Aufsichtsbehörde — Pflicht innerhalb 72h. |
| **Hohes Risiko** ("voraussichtlich hohes Risiko") | Art. 33 + Art. 34 — Betroffene benachrichtigen, klar + verständlich. |

### Risiko-Faktoren (Hoch-Risiko-Indikatoren per EDSA Guidelines 9/2022)

- Sensitive / besondere Datenkategorien (Art. 9: Gesundheit, Religion, ethnische Herkunft, sexuelle Orientierung, Gewerkschaft, etc.)
- Finanzielle Daten (Bankverbindung, Kreditkarte, Login-Credentials)
- Identifikationsdaten (Pass, Personalausweis, Sozialversicherung)
- Standortdaten (GPS, IP-Adresse + Bewegungsprofil)
- Daten von Kindern
- Großer Volumen (≥ 1000 Betroffene)
- Daten exfiltriert vs nur exponiert (exfiltriert = höhere Risk)
- Verschlüsselungsbruch (Daten waren verschlüsselt aber Schlüssel kompromittiert)
- Identitätsdiebstahl-Szenarien wahrscheinlich

Wenn ≥ 1 Faktor zutrifft → vermutlich "hohes Risiko" → Art. 34 Pflicht.

---

## Art. 33 Meldung — Inhalt (Pflicht-Felder)

```markdown
**Meldung einer Verletzung des Schutzes personenbezogener Daten — Art. 33 DSGVO**

**An:** <zuständige Aufsichtsbehörde — siehe Liste unten>
**Von:** <Verantwortlicher> (<Anschrift>, <Telefon>, <E-Mail>)
**Aktenzeichen:** <intern>

## 1. Beschreibung der Verletzung

- **Was geschah:** <kurz, klar>
- **Wann (Bekanntwerden):** <Datum + Uhrzeit>
- **Wann (Eintritt):** <Datum + Uhrzeit, wenn bekannt>
- **Wo (System / Service):** <z.B. Production-DB, Customer-Portal>
- **Wie entdeckt:** <z.B. Pen-Test, Log-Anomalie, externer Hinweis>

## 2. Kategorien + ungefähre Zahl der Betroffenen

| Kategorie | Anzahl Datensätze | Anzahl Betroffener (≈) |
|---|---|---|
| <Datentyp 1> | <N> | <N> |

## 3. Art der Verletzung (Art. 4 Nr. 12)

- [ ] Vertraulichkeitsverlust (Daten an Unbefugten gelangt)
- [ ] Integritätsverlust (Daten verändert)
- [ ] Verfügbarkeitsverlust (Daten gelöscht / nicht zugänglich)
- [ ] Mehrere

## 4. Wahrscheinliche Folgen

<Beschreibung der konkreten Risiken für Betroffene — Identitätsdiebstahl, 
Finanzschaden, Reputations-Verlust, Diskriminierung, etc.>

## 5. Ergriffene + geplante Maßnahmen

- [ ] Vorfall isoliert
- [ ] Lücke geschlossen
- [ ] Forensik durchgeführt
- [ ] Betroffene benachrichtigt (Art. 34) — Datum: <Datum>
- [ ] Sicherheitsmaßnahmen verbessert: <welche>
- [ ] Rechtliche Schritte: <z.B. Strafanzeige>

## 6. Datenschutzbeauftragter

<Name + Kontakt>

## 7. Verzögerung > 72h?

<Wenn ja: Begründung gemäß Art. 33 Abs. 1 — z.B. "Vorfall erst am <Datum> 
bekannt geworden weil <Grund>; Meldung erfolgte 71h nach Bekanntwerden.">
```

---

## Art. 34 Betroffene-Benachrichtigung — Inhalt

```markdown
**Benachrichtigung über eine Datenschutzverletzung — Art. 34 DSGVO**

Sehr geehrte/r <Name>,

wir müssen Sie über einen Vorfall informieren, der Ihre persönlichen Daten 
betrifft.

## Was geschah

<Klar + verständlich, OHNE Fachjargon. Beispiel:>
"Am <Datum> haben wir festgestellt, dass eine Sicherheitslücke in unserem 
<System> dazu geführt hat, dass Ihre folgenden Daten möglicherweise von 
Unbefugten eingesehen wurden:

- Vor- und Nachname
- E-Mail-Adresse
- Adresse
- Telefonnummer

Wir haben die Lücke sofort geschlossen und einen externen Forensiker 
beauftragt, den genauen Umfang zu untersuchen."

## Was Sie jetzt tun sollten

<Konkrete Empfehlungen — z.B.:>
- "Falls Sie Ihre E-Mail-Adresse auch für andere Online-Dienste verwenden, 
  ändern Sie dort vorsichtshalber das Passwort."
- "Achten Sie in den nächsten Wochen besonders auf verdächtige Anrufe / 
  E-Mails, die sich auf Ihre Person beziehen."
- "Bei Anzeichen für Identitätsdiebstahl: Polizei + Schufa-Sperre."

## Kontakt für Rückfragen

DSB: dsb@example.com | Telefon: <Nummer>

## Rechte

Sie haben das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO). 
Die für Sie zuständige Behörde finden Sie unter:
https://www.bfdi.bund.de/anschriften-aufsicht.

Mit freundlichen Grüßen
<Verantwortlicher>
```

---

## Aufsichtsbehörden — Kontakte (DE)

| Bundesland | Behörde |
|---|---|
| Bund + Bahn + Telekommunikation | Bundesbeauftragter für den Datenschutz und die Informationsfreiheit (BfDI), Bonn |
| Baden-Württemberg | Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Stuttgart |
| Bayern (öffentlich) | Bayerischer Landesbeauftragter für den Datenschutz, München |
| Bayern (nicht-öffentlich) | Bayerisches Landesamt für Datenschutzaufsicht, Ansbach |
| Berlin | Berliner Beauftragte für Datenschutz und Informationsfreiheit |
| Brandenburg | Die Landesbeauftragte für den Datenschutz und für das Recht auf Akteneinsicht Brandenburg |
| Bremen | Die Landesbeauftragte für Datenschutz und Informationsfreiheit Freie Hansestadt Bremen |
| Hamburg | Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit |
| Hessen | Der Hessische Beauftragte für Datenschutz und Informationsfreiheit |
| Mecklenburg-Vorpommern | Der Landesbeauftragte für Datenschutz und Informationsfreiheit Mecklenburg-Vorpommern |
| Niedersachsen | Die Landesbeauftragte für den Datenschutz Niedersachsen |
| Nordrhein-Westfalen | Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen |
| Rheinland-Pfalz | Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz |
| Saarland | Unabhängiges Datenschutzzentrum Saarland |
| Sachsen | Sächsische Datenschutzbeauftragte |
| Sachsen-Anhalt | Landesbeauftragter für den Datenschutz Sachsen-Anhalt |
| Schleswig-Holstein | Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein, Kiel |
| Thüringen | Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit |

Aktuelle Anschriften + Online-Meldeformulare: https://www.bfdi.bund.de/anschriften-aufsicht

---

## Verzögerte Meldung (> 72h)

Wenn Bekanntwerden bereits > 72h zurück:

1. Trotzdem unverzüglich melden — die Frist ist verletzt aber Meldung-Pflicht bleibt.
2. Begründung der Verzögerung in der Meldung dokumentieren (Art. 33 Abs. 1 letzter Satz).
3. Akzeptierte Gründe: technische Komplexität, Unklarheit über Risiko-Level, abhängige Behörde-Ermittlungen.
4. Nicht-akzeptierte Gründe: "Wir wussten nicht, dass das melden-pflichtig ist."
5. Bußgeld-Risiko: Art. 83 Abs. 4 lit. a — bis zu €10 Mio. oder 2% des Konzern-Vorjahresumsatzes (höher).

---

## Nachgang

### Art. 33 Abs. 5 — interne Dokumentationspflicht

Auch wenn keine Meldung an Aufsichtsbehörde nötig (kein Risiko): jeder 
Vorfall MUSS dokumentiert werden:

```
docs/dsgvo/incidents/<incident-id>/
  initial-report.md      — Was, Wann, Wer
  risk-assessment.md     — Bewertung pro Art. 33 Abs. 1
  forensic-report.md     — Was haben Forensiker gefunden (intern oder extern)
  remediation-actions.md — Was wurde getan
  lessons-learned.md     — Was haben wir gelernt
  art-33-disclosure.pdf  — wenn an Behörde gemeldet
  art-34-notification.pdf — wenn Betroffene informiert
```

### Bußgeld-Vermeidung

- Vollständige + zeitgerechte Meldung — reduziert Bußgeld-Risiko deutlich.
- Proaktiver Forensik-Auftrag — zeigt Bemühung.
- Lessons-Learned umsetzen — verhindert Wiederholung.
- DSB einbinden — zeigt Compliance-Bewusstsein.

---

## Anti-Patterns

- ❌ "Wir warten ab" — 72h-Frist ist hard, jede Stunde Verzögerung erhöht Bußgeld-Risiko.
- ❌ Internal-only-handling ohne Eskalation — DSB MUSS einbezogen werden.
- ❌ Reset / Reinstall vor Forensik — zerstört Beweismittel.
- ❌ Pressemeldung vor Behörden-Meldung — Behörde liest dann aus Presse.
- ❌ Betroffene nicht benachrichtigen "weil sie sich aufregen" — Art. 34 ist Pflicht bei hohem Risiko.
- ❌ Generic "Wir nehmen Datenschutz ernst"-Statement statt konkret-Information — Art. 34 fordert klar + verständlich + konkret.
- ❌ Begründung "wir wussten nicht von der Pflicht" für Verzögerung > 72h — wird nicht akzeptiert.
- ❌ Internal-Doku nur für Behörden-meldepflichtige Vorfälle — Art. 33 Abs. 5 verlangt Doku ALLER Vorfälle.

---

## Update-Trigger

Aktualisiere bei:

- Neue EDSA Guidelines zu Art. 33/34
- BfDI-Tätigkeitsbericht-Updates
- Bußgeld-Entscheidungen mit Datenpanne-Bezug (z.B. EDPS / DPC)
- Aufsichtsbehörden-Online-Meldeformular-Updates

Last-updated: 2025.
