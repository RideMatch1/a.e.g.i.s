---
license: MIT
purpose: Generische VVT-Vorlage (Art. 30 DSGVO). KMU-best-practice.
references: dsgvo.md (VVT-Block)
sources: Art. 30 Abs. 1 DSGVO + BayLDA-VVT-Hinweise
---

# Verzeichnis von Verarbeitungstaetigkeiten (VVT) — Vorlage

> Diese Vorlage entspricht Art. 30 Abs. 1 DSGVO. KMU mit < 250 MA und
> gelegentlicher Verarbeitung ohne Sonderkategorien sind nicht VVT-pflichtig
> (Art. 30 Abs. 5), aber BayLDA empfiehlt VVT auch fuer KMU zur Erfuellung
> Rechenschaftspflicht Art. 5 Abs. 2.

## Stammblatt

| Feld | Wert |
|------|------|
| Verantwortlicher | `<Operator-Firma>` |
| Anschrift | `<vollstaendige-Anschrift>` |
| Vertreter (Art. 27) | `<falls EU-Drittland-Sitz>` |
| DSB | `<falls bestellt>` |
| Stand | `<YYYY-MM-DD>` |
| Version | `<vN.N>` |

## Verarbeitungstaetigkeiten

Pro Verarbeitung ein Block.

### VT-001: `<Bezeichnung>`

| Pflicht-Feld (Art. 30 Abs. 1) | Wert |
|------------------------------|------|
| **a) Name + Kontaktdaten Verantwortlicher** | siehe Stammblatt |
| **b) Zwecke der Verarbeitung** | `<Zweck>` (Rechtsgrundlage Art. 6 Abs. 1 lit. `<a/b/c/d/e/f>`) |
| **c) Kategorien betroffener Personen** | `<Kunden / Mitarbeiter / Lieferanten / ...>` |
| **c) Kategorien personenbezogener Daten** | `<Stammdaten / Kontaktdaten / Nutzungsdaten / besondere Kategorien>` |
| **d) Kategorien von Empfaengern** | `<intern / Auftragsverarbeiter / Drittland>` |
| **e) Drittlandtransfer** | `<keine / USA / UK / ...>` (mit Mechanismus: SCC + TIA / Adequacy / DPF) |
| **f) Speicherdauer / Loeschfristen** | `<Frist>` (gesetzlicher Anker, z.B. § 257 HGB / § 147 AO) |
| **g) Allgemeine Beschreibung TOMs** | siehe `<TOMs-Doku-Verweis>` |

### VT-002: `<naechste Verarbeitung>`

(analog)

## Auftragsverarbeiter (Art. 28)

| Auftragsverarbeiter | Zweck | AVV-Status | Drittland | Standort |
|---------------------|-------|-----------|-----------|----------|
| `<Anbieter>` | `<Zweck>` | `<abgeschlossen YYYY-MM-DD>` | `<DE/EU/USA>` | `<Region>` |

## Review

VVT bei wesentlichen Aenderungen sofort updaten, ansonsten jaehrlich.
Naechstes Review: `<YYYY-MM-DD>`.

---

*Disclaimer: technisch-indikative Vorlage, keine Rechtsberatung i.S.d. § 2 RDG.*
