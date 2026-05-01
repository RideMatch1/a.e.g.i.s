---
license: gemeinfrei nach § 5 UrhG (DE)
sources:
  - https://www.gesetze-im-internet.de/hgb/__257.html
  - https://www.gesetze-im-internet.de/ao_1977/__147.html
last-checked: 2026-05-01
purpose: GoBD-/AO-Aufbewahrungsfristen — Konflikt mit DSGVO Art. 17 Lösch-Anspruch.
---

# HGB § 257 + AO § 147 — Aufbewahrungsfristen

## HGB § 257 — Aufbewahrung Handelsgeschäftsbriefe + Buchführung

| Unterlage | Frist |
|-----------|-------|
| Handelsbriefe (E-Mails, Bestellbestätigungen, Verträge) | **6 Jahre** (HGB § 257 Abs. 4) |
| Buchungsbelege, Bilanzen, Inventare | **10 Jahre** (HGB § 257 Abs. 4) |
| Empfangene Handelsbriefe | 6 Jahre |
| Wiedergaben abgesandter Handelsbriefe | 6 Jahre |

Beginn: Schluss des Kalenderjahrs der letzten Eintragung / Erstellung.

## AO § 147 — Steuerrechtliche Aufbewahrung

| Unterlage | Frist |
|-----------|-------|
| Bücher, Aufzeichnungen, Buchungsbelege, Bilanzen, Jahresabschluss | **10 Jahre** |
| Empfangene Geschäftsbriefe / Wiedergaben abgesandter Geschäftsbriefe | **6 Jahre** |
| Sonstige Unterlagen relevant für Besteuerung | 6 Jahre |

Beginn: Schluss des Kalenderjahrs der letzten Eintragung / Erstellung (analog HGB).

## Konflikt-Auflösung mit DSGVO Art. 17

DSGVO Art. 17 Abs. 3 lit. b: Lösch-Anspruch gilt NICHT bei rechtlicher Verpflichtung zur Aufbewahrung.

**Lösung:** Statt Löschung → **Einschränkung der Verarbeitung** (Art. 18 DSGVO + § 35 BDSG):
1. Daten markieren als „nur für Aufbewahrung" / „Buchhaltungs-Archiv"
2. Zugriff einschränken auf Buchhaltung / Compliance
3. Kein operativer Zugriff (CRM, Marketing)

**Audit-Relevanz:**
- Lösch-Cron darf Rechnungen + Zahlungs-Belege NICHT vor Frist-Ablauf löschen
- DSE-Aussage zur Speicherdauer muss korrekt zwischen „operative" und „archivarische" Aufbewahrung trennen
- GoBD-Konformität (Unveränderlichkeit, Nachvollziehbarkeit, Verfügbarkeit)

## GoBD — Grundsätze ordnungsmäßiger Buchführung in elektronischer Form

BMF-Schreiben vom 28.11.2019 (GoBD), Source: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/2019-11-28-GoBD.html

Kern-Anforderungen:
- Vollständigkeit + Richtigkeit
- Zeitgerechte Buchung (Trennung in „aktuelle Periode" und „Archiv")
- Ordnung + Nachvollziehbarkeit
- **Unveränderlichkeit** — keine nachträgliche Änderung der gebuchten Daten ohne Audit-Trail
- Aufbewahrung der maschinellen Auswertbarkeit

**Audit-Relevanz:**
- Database-Schema mit `created_at` / `modified_at` + Audit-Trail-Tabelle
- Soft-Delete + Versionierung statt Hard-Delete für Buchhaltungs-Daten
- Backup + Disaster-Recovery dokumentiert
