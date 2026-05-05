---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32002L0058
last-checked: 2026-05-02
purpose: ePrivacy-RL — Audit-Trigger fuer Cookies / Direktwerbung / E-Mail.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen eur-lex.europa.eu Volltext verifizieren"
last-verified: 2026-05-05
---

# ePrivacy-RL — Audit-Relevance

## Auto-Loading-Trigger

```
1. Cookie-Banner-Detection:
   - <script data-cookie-banner>
   - Library: cookieconsent / cookiebot / usercentrics / borlabs / tarteaucitron
   - HTML-Probe: "Cookie-Einwilligung" / "Akzeptieren" / "Ablehnen"

2. Tracking-Detection:
   - GA / Matomo / Plausible / Umami in CSP oder Code
   - LocalStorage / SessionStorage Aktivitaet

3. E-Mail-Marketing-Detection:
   - Newsletter-Form
   - Mailchimp / SendGrid / Postmark / Brevo Tags
   - DOI-Token-Pattern in URL-Struktur
```

## Pflicht-Surfaces (mit Cross-Reference zu DE-Umsetzung)

| Surface | ePrivacy-RL | DE-Norm | Skill-Layer |
|---|---|---|---|
| Cookie-Banner | Art. 5 Abs. 3 | § 25 TDDDG | `audit-patterns.md` Phase 5 |
| Pre-Consent-Tracker | Art. 5 Abs. 3 | § 25 TDDDG | `audit-patterns.md` Phase 5 + 1 (CSP) |
| Newsletter-DOI | Art. 13 Abs. 1 | § 7 UWG | `audit-patterns.md` Phase 5g |
| Cold-Outreach B2B | Art. 13 Abs. 1+3 | § 7 Abs. 2 UWG | `audit-patterns.md` Phase 5g |
| Bestandskunden-Werbung | Art. 13 Abs. 2 | § 7 Abs. 3 UWG | `audit-patterns.md` Phase 5g |
| Push-Notifications | Art. 13 (analog) | § 7 UWG (umstritten) | `audit-patterns.md` Phase 5f |

## Audit-Pattern (Skill-Output)

```
**Finding**: GA-Tracker laedt vor Cookie-Consent
**Wahrsch.**: 92% (Massen-Abmahn-Welle 2022-2025, Behoerdenpfad zusaetzlich)
**Kritikalitaet**: 🔴 KRITISCH
**§**: Art. 5 Abs. 3 ePrivacy-RL + § 25 Abs. 1 TDDDG + Art. 6 DSGVO
**Az.**: EuGH C-673/17 Planet49 + BGH I ZR 7/16 + OLG Koeln 6 U 80/23
**€-Range**: 5.000-15.000 EUR (UWG) + Stufe 2 DSGVO bis 4% Umsatz
**Fix**:
- Consent-Gate vor Tracker-Load
- "Reject All"-Button gleichwertig zu "Accept All"
- Granulare Einwilligung pro Tracker-Kategorie
- Code-Pattern: siehe `references/stack-patterns/tracking/`
```

## Source

- [RL 2002/58/EG](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32002L0058)
- [TDDDG](https://www.gesetze-im-internet.de/tdddg/)
- [EDPB Guidelines](https://www.edpb.europa.eu/)
