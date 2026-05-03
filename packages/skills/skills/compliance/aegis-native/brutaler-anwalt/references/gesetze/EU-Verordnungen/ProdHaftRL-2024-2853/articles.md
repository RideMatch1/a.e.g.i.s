---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024L2853
last-checked: 2026-05-02
purpose: Produkthaftungs-RL 2024 — Erweiterung auf Software / KI / Digital-Services.
---

# Produkthaftungs-RL — RL 2024/2853

> **Umsetzungsfrist 09.12.2026.** Ersetzt RL 85/374/EWG (Produkthaftungsrichtlinie 1985).
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024L2853

## Wesentliche Aenderungen vs. 1985-Fassung

### Erweiterter Produkt-Begriff (Art. 4)

NEU als „Produkt" einbezogen:
- **Software** (auch Standalone, ohne Hardware)
- **AI-Systeme** (auch GPAI-Modelle)
- **Digital-Services** die ueber das Produkt kommuniziert werden
- **Komponenten** (auch nicht-physische)

NICHT als Produkt: Free + Open-Source Software AUSSER kommerziell vermarktet.

### Erweiterte Beweislastumkehr (Art. 11)

Bei besonders komplexen technischen Sachverhalten:
- Beweispflicht fuer Hersteller dass Produkt sicher war
- Bei AI-System: Vermutung des Defekts wenn Funktionsweise nicht ausreichend transparent

### Ersatz-Pflicht (Art. 6)

Hersteller haftet bei:
- Body-Verletzung / Tod
- Sachschaeden ueber 500 EUR (jeder Verbrauch hier wegfaellt vs. 1985-Fassung)
- **NEU**: psychischer Schaden mit medizinischer Diagnose
- **NEU**: Daten-Verlust / Daten-Korruption (oekonomisch quantifizierbar)

### Updates + Patches (Art. 8)

Hersteller haftet wenn:
- Versaeumnis erforderlicher Sicherheits-Updates
- Produkt nach Update fehlerhaft funktioniert

## DE-Umsetzung

ProdHaftG wird bis 09.12.2026 aktualisiert. BMJ-Entwurf Stand 2026-05 in Vorbereitung.

## Audit-Relevanz

Software / AI / SaaS Anbieter:
- Pflicht zur Sicherheits-Updates
- Daten-Verlust Risiko-Klasse jetzt explizit
- AVV / DPA-Klauseln pruefen ob Haftungsbegrenzung durchgreift (i.d.R. NICHT bei ProdHaftG, das ist zwingend)

## Audit-Pattern

```
**Finding**: SaaS-AGB versucht Haftungsausschluss fuer Daten-Verluste
**§**: Art. 6 ProdHaftRL 2024 + § 14 ProdHaftG (geplant)
**Status**: AGB-Klausel unwirksam ab 09.12.2026
**Fix**: Haftungsausschluss-Klausel anpassen — keine Ausschluesse fuer Daten-Verlust ueber 500 EUR
```

## Source

- [eur-lex.europa.eu — RL 2024/2853](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024L2853)
- [ProdHaftG (DE-Aktualisierung in Vorbereitung)](https://www.gesetze-im-internet.de/prodhaftg/)
