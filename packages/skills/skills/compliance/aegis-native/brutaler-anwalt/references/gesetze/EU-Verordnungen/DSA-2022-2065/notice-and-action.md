---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065
last-checked: 2026-05-02
purpose: DSA Art. 16-17 — Notice-and-Action Mechanismus + Statement of Reasons.
---

# DSA — Art. 16-17 Notice-and-Action

> Pflicht fuer JEDEN Hosting-Provider (auch klein). Kern-Audit-Surface fuer UGC-Plattformen.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065

## Art. 16 — Notice-Mechanismus

### Pflicht-Eigenschaften

- **Leicht zugaenglich** + **Benutzerfreundlich**
- **Elektronisch + Maschinen-lesbar einreichbar**
- **Kostenlos**

### Pflicht-Felder im Notice-Form

```typescript
type DSANotice = {
  // Art. 16 Abs. 2 lit. a
  reason: string;             // Begruendung warum Inhalt rechtswidrig
  // Art. 16 Abs. 2 lit. b
  url: string;                // hinreichend praezise URL des Inhalts
  // Art. 16 Abs. 2 lit. c
  notifierName?: string;      // Name (Pflicht ausser bei sexuell-bezogenen Straftaten)
  notifierEmail?: string;     // Email
  // Art. 16 Abs. 2 lit. d
  goodFaithDeclaration: boolean;  // Erklaerung der Wahrheit
};
```

### Pflicht-API-Pattern

```ts
// File: src/app/api/<board>/<id>/report/route.ts
export async function POST(req: Request) {
  const notice = await req.json();

  // Art. 16 Abs. 2 — Pflicht-Validierung
  const required = ['reason', 'url', 'goodFaithDeclaration'];
  for (const field of required) {
    if (!notice[field]) return NextResponse.json({ error: `Missing: ${field}` }, { status: 400 });
  }

  // Art. 16 Abs. 5 — Bestaetigung an Notifier
  await sendConfirmation(notice.notifierEmail, noticeId);

  // Asynchron: Bearbeitung + Statement of Reasons (Art. 17)
  await queue.add('moderate', { noticeId });

  return NextResponse.json({ noticeId, status: 'received' }, { status: 200 });
}
```

### Bestaetigung an Notifier (Art. 16 Abs. 5)

- Unverzuegliche Eingangsbestaetigung
- Aktualisierung bei Entscheidung

## Art. 17 — Statement of Reasons (Begruendung)

Bei jedem Eingriff (Inhaltsentfernung / Sichtbarkeits-Reduktion / Account-Sperre / Zugriffs-Beschraenkung):

### Pflicht-Inhalt

| Art. 17 Abs. | Pflicht | Beispiel |
|---|---|---|
| Abs. 3 lit. a | Tatsachen + Begruendung | „Inhalt verstoesst gegen § 4 Abs. 1 JuSchG" |
| Abs. 3 lit. b | Faktischer / rechtlicher Massstab | „User-Beitrag X enthielt unzulaessige Werbung an Minderjaehrige" |
| Abs. 3 lit. c | Automatisierte Entscheidung? | „Bewertung erfolgte teilweise automatisiert (Image-Classifier)" |
| Abs. 3 lit. d | Klarstellung Beschwerdemoeglichkeit | „Sie koennen Beschwerde einlegen ueber unser internes Beschwerdemanagement (Art. 20 DSA) — Link" |

### Quellen-Zugang (Art. 17 Abs. 5)

- Statement of Reasons MUSS in **maschinenlesbarem Format** verfuegbar sein
- Fuer VLOPs/VLOSEs: Veroeffentlichung in **DSA Transparency Database**
- KMU-Plattformen: nur an betroffenen User uebermitteln

### Pflicht-DSA-Database-Format (fuer VLOPs)

JSON-Schema des EU DSA Transparency Database:
```json
{
  "decision_visibility": "removed|invisible|limited",
  "decision_monetary": "yes|no",
  "decision_provision": "content_removal|account_termination|...",
  "decision_account": "account_terminated|account_suspended|...",
  "decision_ground": "illegal_content|tos_violation",
  "category_specification": ["NAR", "POR_05", ...],
  "automated_detection": true|false,
  "automated_decision": "FULLY_AUTOMATED|PARTIALLY_AUTOMATED|NOT_AUTOMATED",
  "platform_uid": "<plattform-uid>",
  "incompatible_content": "<text>",
  "decision_facts": "<text>",
  "decision_visibility_other": "<text>"
}
```

## Audit-Checkliste (fuer Skill)

```bash
# 1. Notice-Endpoint vorhanden + erreichbar?
curl -X POST -H "Content-Type: application/json" \
  -d '{"reason":"test","url":"https://example.com/post/1","goodFaithDeclaration":true}' \
  https://example.com/api/report -i
# Erwartung: 200 mit noticeId, oder 401 wenn Auth notwendig (auch akzeptabel)

# 2. Form vorhanden auf UGC-Detail-Page?
curl -s https://example.com/post/1 | grep -oE "report\|melden\|flag"

# 3. Statement of Reasons User-erhaelt-Pattern existiert?
grep -rE "Statement of Reasons\|Begruendung\|Beschwerdemanagement" \
  src/components/email/

# 4. DSA-Transparency-DB Submission (nur fuer VLOPs)
# manuell pruefen ob Plattform-UID vorhanden + jaehrlicher Submission-Cron
```

## Az.-Anker

- DSA wirkt erst seit 17.02.2024 — Praxisrechtsprechung im Aufbau
- Bezugsfaelle: Hosting-Privileg-Linie EuGH C-682/18 / C-683/18 (YouTube + Cyando)

## Sanktionen

DDG §§ 18-22 (DE-Umsetzung) + Art. 52 DSA:
- VLOPs: bis 6% globaler Jahresumsatz
- KMU-Plattformen: bis 50.000 EUR pro Verstoss

## Source

- [eur-lex.europa.eu — VO 2022/2065 Art. 16-17](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065#art_16)
- [DSA Transparency Database](https://transparency.dsa.ec.europa.eu/)
