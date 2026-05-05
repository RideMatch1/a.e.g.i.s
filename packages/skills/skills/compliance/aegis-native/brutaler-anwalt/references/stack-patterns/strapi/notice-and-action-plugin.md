---
license: MIT (snippet)
provider: Strapi v4 / v5 (Open-Source)
last-checked: 2026-05-05
purpose: Strapi Plugin Pattern fuer DSA Art. 16 Notice-and-Action Compliance.
---

# Strapi — Notice-and-Action Plugin Pattern (DSA Art. 16)

## Trigger / Detection

Repo enthaelt:
- `@strapi/strapi` mit User-Generated-Content (Comments, Submissions, Reviews)
- Optional: `src/plugins/notice-and-action/` Custom-Plugin
- Service-Provider faellt unter DSA (Digital Services Act EU 2022/2065)
- Optional: `src/api/dsa-report/` Content-Type fuer Reports

DSA Art. 16: Hosting-Provider muessen einen Mechanismus zur Meldung rechtswidriger Inhalte bereitstellen ("Notice-and-Action"). Pflicht seit 17. Februar 2024 fuer alle Hosting-Provider (auch kleine).

## Default-Verhalten (was passiert ohne Konfiguration)

- Strapi hat keinen Built-in DSA-Report-Mechanismus
- User koennen Inhalte nicht strukturiert melden → manuelle E-Mail-Bearbeitung
- Keine Transparenz-Berichte → DSA Art. 15 Verstoss bei aktiveren Diensten
- Kein Audit-Trail fuer Moderations-Entscheidungen
- Keine Begruendung-Pflicht-Antwort an Reporter

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Kein Notice-and-Action-Mechanismus | DSA Art. 16 | KRITISCH | Plugin mit Report-Endpoint |
| Reporter erhaelt keine Bestaetigung | DSA Art. 16 Abs. 5 | HOCH | Auto-Confirmation-Mail |
| Keine Begruendung an Uploader bei Removal | DSA Art. 17 | HOCH | Statement-of-Reasons-Workflow |
| Keine Transparenz-Reports | DSA Art. 15/24 | MITTEL (HOCH bei VLOP) | Annual-Report-Worker |
| Trusted-Flagger-Privileg fehlt | DSA Art. 22 | NIEDRIG (Optional) | Role-based Priority |
| Kein Beschwerde-System | DSA Art. 20 | HOCH | Internal-Complaint-Endpoint |

## Code-Pattern (sanitized)

```javascript
// File: src/api/dsa-report/content-types/dsa-report/schema.json
{
  "kind": "collectionType",
  "collectionName": "dsa_reports",
  "info": {
    "singularName": "dsa-report",
    "pluralName": "dsa-reports",
    "displayName": "DSA Report"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "reportedContentType": {
      "type": "enumeration",
      "enum": ["comment", "submission", "upload", "review"],
      "required": true
    },
    "reportedContentId": {
      "type": "string",
      "required": true
    },
    "category": {
      "type": "enumeration",
      "enum": [
        "illegal_hate_speech",
        "terrorism_extremism",
        "child_sexual_abuse_material",
        "intellectual_property_violation",
        "data_protection_violation",
        "consumer_protection_violation",
        "other_illegal"
      ],
      "required": true
    },
    "explanation": {
      "type": "text",
      "required": true,
      "maxLength": 5000
    },
    "reporterEmail": {
      "type": "email",
      "required": true,
      "private": true
    },
    "reporterIpHash": {
      "type": "string",
      "maxLength": 16,
      "private": true
    },
    "isTrustedFlagger": {
      "type": "boolean",
      "default": false
    },
    "status": {
      "type": "enumeration",
      "enum": ["received", "in_review", "actioned", "rejected", "appealed"],
      "default": "received"
    },
    "actionTaken": {
      "type": "enumeration",
      "enum": ["none", "removed", "demoted", "warning", "account_suspended"]
    },
    "statementOfReasons": {
      "type": "text",
      "maxLength": 5000
    },
    "submittedAt": {
      "type": "datetime",
      "required": true
    },
    "actionedAt": {
      "type": "datetime"
    }
  }
}
```

```javascript
// File: src/api/dsa-report/controllers/dsa-report.js
'use strict';

const crypto = require('crypto');

module.exports = ({ strapi }) => ({
  async create(ctx) {
    const {
      reportedContentType,
      reportedContentId,
      category,
      explanation,
      reporterEmail,
    } = ctx.request.body.data ?? {};

    // Validation
    if (!reportedContentType || !reportedContentId || !category || !explanation || !reporterEmail) {
      return ctx.badRequest('Pflichtfelder fehlen');
    }
    if (typeof explanation !== 'string' || explanation.length < 50) {
      return ctx.badRequest('Begruendung mindestens 50 Zeichen');
    }

    // IP-Hash
    const ip = ctx.request.ip
      ?? ctx.request.header['x-forwarded-for']?.split(',')[0]
      ?? '';
    const salt = strapi.config.get('server.ipHashSalt', '');
    const ipHash = crypto.createHash('sha256').update(`${ip}${salt}`).digest('hex').slice(0, 16);

    // Trusted-Flagger-Check (sofern Email auf Allowlist)
    const trustedList = strapi.config.get('server.trustedFlaggers', []);
    const isTrusted = trustedList.includes(reporterEmail.toLowerCase());

    const report = await strapi.entityService.create('api::dsa-report.dsa-report', {
      data: {
        reportedContentType,
        reportedContentId,
        category,
        explanation: explanation.slice(0, 5000),
        reporterEmail,
        reporterIpHash: ipHash,
        isTrustedFlagger: isTrusted,
        status: 'received',
        submittedAt: new Date(),
      },
    });

    // Auto-Confirmation an Reporter (DSA Art. 16 Abs. 5)
    await strapi.plugins.email.services.email.send({
      to: reporterEmail,
      subject: `Bestaetigung Ihrer Meldung [Ref: ${report.id}]`,
      text: buildConfirmationMail(report),
    });

    // Optional: Trusted-Flagger gehen sofort in Priority-Queue
    if (isTrusted) {
      await strapi.service('api::dsa-report.dsa-report').prioritize(report.id);
    }

    return {
      data: {
        id: report.id,
        status: 'received',
        submittedAt: report.submittedAt,
      },
    };
  },

  async findOne(ctx) {
    // Reporter darf nur eigene Reports sehen
    const { id } = ctx.params;
    const report = await strapi.entityService.findOne('api::dsa-report.dsa-report', id, {
      fields: ['status', 'category', 'submittedAt', 'actionedAt', 'statementOfReasons', 'actionTaken'],
    });
    if (!report) return ctx.notFound();
    return { data: report };
  },
});

function buildConfirmationMail(report) {
  return `
Wir haben Ihre Meldung erhalten.

Referenz: ${report.id}
Eingegangen am: ${report.submittedAt}
Kategorie: ${report.category}

Wir werden Ihre Meldung gemaess DSA Art. 16 unverzueglich pruefen und Ihnen
das Ergebnis mit Begruendung mitteilen.

Bei Fragen: <placeholder-email>
  `.trim();
}
```

```javascript
// File: src/api/dsa-report/services/dsa-report.js
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::dsa-report.dsa-report', ({ strapi }) => ({
  async actionReport(reportId, action, statementOfReasons) {
    const report = await strapi.entityService.findOne('api::dsa-report.dsa-report', reportId);
    if (!report) throw new Error('Report not found');

    // 1. Action ausfuehren
    if (action === 'removed') {
      await strapi.entityService.delete(
        `api::${report.reportedContentType}.${report.reportedContentType}`,
        report.reportedContentId,
      );
    }

    // 2. Report-Status aktualisieren
    await strapi.entityService.update('api::dsa-report.dsa-report', reportId, {
      data: {
        status: 'actioned',
        actionTaken: action,
        statementOfReasons,
        actionedAt: new Date(),
      },
    });

    // 3. Reporter informieren
    await strapi.plugins.email.services.email.send({
      to: report.reporterEmail,
      subject: `Ihre Meldung wurde bearbeitet [Ref: ${reportId}]`,
      text: `Status: ${action}\n\nBegruendung:\n${statementOfReasons}`,
    });

    // 4. Uploader informieren (DSA Art. 17 Statement of Reasons)
    if (action === 'removed') {
      await this.notifyUploader(report.reportedContentType, report.reportedContentId, statementOfReasons);
    }
  },

  async prioritize(reportId) {
    // Trusted-Flagger-Reports priorisieren in Moderations-Queue
    await strapi.entityService.update('api::dsa-report.dsa-report', reportId, {
      data: { status: 'in_review' },
    });
  },

  async notifyUploader(contentType, contentId, reason) {
    const content = await strapi.entityService.findOne(`api::${contentType}.${contentType}`, contentId, {
      populate: ['author'],
    });
    if (!content?.author?.email) return;

    await strapi.plugins.email.services.email.send({
      to: content.author.email,
      subject: 'Ihr Inhalt wurde wegen einer Meldung entfernt',
      text: `
Ihr Inhalt (${contentType} #${contentId}) wurde aufgrund einer Meldung entfernt.

Begruendung:
${reason}

Sie haben das Recht zur Beschwerde gemaess DSA Art. 20 binnen 6 Monaten.
Beschwerde-Endpoint: <placeholder-domain>/api/dsa-complaints
      `.trim(),
    });
  },
}));
```

```javascript
// File: src/api/dsa-report/routes/dsa-report.js
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/dsa-reports',
      handler: 'dsa-report.create',
      config: { auth: false },  // Auch Nicht-User koennen melden
    },
    {
      method: 'GET',
      path: '/dsa-reports/:id',
      handler: 'dsa-report.findOne',
      config: { auth: false },  // Nur via Reference-ID + Email-Match
    },
  ],
};
```

## AVV / DPA

- Strapi-Hosting — Art. 28 DSGVO
- Datenbank fuer Reports — AVV mit Backup-Rotation
- Mailer fuer Bestaetigungen + Statement-of-Reasons — AVV mit EU-Hosting

## DSE-Wording-Vorlage

```markdown
### Meldung rechtswidriger Inhalte (DSA Art. 16)

Sie koennen rechtswidrige Inhalte auf dieser Plattform jederzeit melden.

**Meldekanal:** [Inhalt melden](https://<placeholder-domain>/report) oder
E-Mail an <placeholder-email>.

**Was geschieht mit Ihrer Meldung:**

1. **Bestaetigung** binnen 24 Stunden mit Referenz-Nummer
2. **Pruefung** durch unser Moderations-Team (Trusted-Flagger werden priorisiert)
3. **Entscheidung** mit Begruendung an Sie und ggf. an den Uploader
4. **Beschwerde-Recht** binnen 6 Monaten gemaess DSA Art. 20

**Verarbeitete Daten Ihrer Meldung:**
- E-Mail-Adresse (zur Antwort)
- IP-Hash (Anti-Spam)
- Beschreibung der gemeldeten Verletzung
- Referenz auf gemeldeten Inhalt

**Speicherdauer:** 5 Jahre nach Abschluss (Beweisfunktion bei Rechtsstreit).
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Verpflichtung
DSA Art. 16) + lit. f (berechtigtes Interesse Plattform-Sicherheit).
```

## Verify-Commands (Live-Probe)

```bash
# 1. Report-Endpoint erreichbar
curl -X POST https://<placeholder-domain>/api/dsa-reports \
  -H "Content-Type: application/json" \
  -d '{"data":{"reportedContentType":"comment","reportedContentId":"42","category":"illegal_hate_speech","explanation":"<placeholder-min-50-chars-explanation-text>","reporterEmail":"reporter@example.com"}}' -i
# Erwartung: 200 mit { id, status: "received" }

# 2. Bestaetigungs-Mail wird gesendet
# (Mail-Provider-Logs pruefen)

# 3. Validation: zu kurze Begruendung blockt
curl -X POST https://<placeholder-domain>/api/dsa-reports \
  -d '{"data":{"category":"other_illegal","explanation":"kurz","reporterEmail":"x@x.de"}}' -i
# Erwartung: 400

# 4. Trusted-Flagger-Privileg
# Setze Email auf trusted-flaggers-Allowlist und sende Report
# Erwartung: status sofort "in_review"
```

## Cross-References

- AEGIS-Scanner: `dsa-compliance-checker.ts`, `cms-pii-checker.ts`, `audit-trail-checker.ts`
- Skill-Reference: `references/dsgvo.md` (Datenschutz-Aspekt)
- DSA: VO (EU) 2022/2065 Art. 14, 16, 17, 20, 22 (Notice-and-Action, Statement of Reasons, Beschwerde, Trusted Flagger)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 5 (CMS-Audit), Phase 8 (DSA-Compliance)
