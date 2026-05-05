---
license: MIT (snippet)
provider: Strapi v4 / v5 (Open-Source)
last-checked: 2026-05-05
purpose: Strapi User-Submission Lifecycle-Hook Pattern fuer PII-Filtering + Robots-Meta + DSE-Erinnerung.
---

# Strapi — CMS-PII Pattern

## Trigger / Detection

Repo enthaelt:
- `@strapi/strapi` in `package.json`
- `src/api/*/content-types/` Schema-Files
- `src/api/*/controllers/*.js` / `services/*.js` / `routes/*.js`
- Optional: `src/api/*/lifecycles.js` Hook-Files
- Optional: `config/admin.js`, `config/server.js`

Pattern: Strapi haelt User-generated-Content (Comments, Submissions, Form-Eintraege). Lifecycle-Hooks koennen PII-Felder filtern, Crawler-Indexing verhindern, DSE-Verweise erzwingen.

## Default-Verhalten (was passiert ohne Konfiguration)

- Strapi-Admin-Panel laed Tracker-Pixel von `<placeholder-strapi-marketplace-host>` → DSGVO-Verstoss bei aktivierten Telemetry-Settings
- User-Submissions speichern alles was im Schema definiert ist — keine Auto-PII-Filterung
- Keine `robots: noindex` auf User-Content-Pages → Suchmaschinen indizieren PII
- Webhooks senden Klartext-Daten an externe Endpoints
- Default-Server-Logs enthalten Klartext-IP

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Strapi-Telemetry leakt Repo-Metadata an Drittland | Art. 44 DSGVO | KRITISCH | `telemetryDisabled: true` in `config/server.js` |
| User-Submission ohne PII-Filter | Art. 5 lit. c DSGVO | HOCH | Lifecycle-Hook `beforeCreate` |
| Robots-Meta fehlt fuer User-Content | Art. 5 lit. f DSGVO | HOCH | `noindex,nofollow` in CMS-Frontend |
| Webhook mit Klartext-PII | Art. 5 lit. f | HOCH | Webhook-Payload-Filter im Hook |
| Admin-Panel ueber HTTP zugaenglich | Art. 32 DSGVO | KRITISCH | `admin.url` mit HTTPS + IP-Allowlist |
| Default-Email-Templates mit Brand-Tracker | § 25 TDDDG | MITTEL | Custom Templates |

## Code-Pattern (sanitized)

```javascript
// File: config/server.js
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // KRITISCH: Strapi-Telemetry deaktivieren
  telemetryDisabled: true,
});
```

```javascript
// File: config/admin.js
module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: false,                  // Net-Promoter-Score-Tracker AUS
    promoteEE: false,            // Marketing-Promo AUS
  },
});
```

```javascript
// File: src/api/comment/content-types/comment/schema.json
{
  "kind": "collectionType",
  "collectionName": "comments",
  "info": {
    "singularName": "comment",
    "pluralName": "comments",
    "displayName": "Comment"
  },
  "options": {
    "draftAndPublish": true
  },
  "attributes": {
    "body": {
      "type": "text",
      "required": true,
      "maxLength": 5000
    },
    "authorName": {
      "type": "string",
      "maxLength": 100
    },
    "authorEmail": {
      "type": "email",
      "private": true
    },
    "ipHash": {
      "type": "string",
      "maxLength": 16,
      "private": true
    },
    "consentVersion": {
      "type": "string",
      "maxLength": 16
    }
  }
}
```

```javascript
// File: src/api/comment/content-types/comment/lifecycles.js
const crypto = require('crypto');

const PII_FIELDS = ['authorEmail', 'ipHash'];
const FORBIDDEN_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w-]+/g,                       // Email-Pattern im body
  /\bDE\d{2}[\d\s]{18,22}\b/g,                       // IBAN
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,     // Credit-Card
];

module.exports = {
  async beforeCreate(event) {
    const { data, params } = event;

    // 1. PII im Body herausfiltern
    if (typeof data.body === 'string') {
      for (const pattern of FORBIDDEN_PATTERNS) {
        data.body = data.body.replace(pattern, '[REDACTED]');
      }
    }

    // 2. IP-Hash setzen (statt Klartext)
    const requestState = strapi.requestContext.get();
    const ip = requestState?.request?.ip
      ?? requestState?.request?.header?.['x-forwarded-for']?.split(',')[0]
      ?? '';

    const salt = strapi.config.get('server.ipHashSalt', '');
    data.ipHash = crypto
      .createHash('sha256')
      .update(`${ip}${salt}`)
      .digest('hex')
      .slice(0, 16);

    // 3. Consent-Pflicht: erfordere consentVersion
    if (!data.consentVersion) {
      throw new Error('Consent-Version Pflicht — User muss DSE bestaetigt haben');
    }
  },

  async beforeUpdate(event) {
    // PII-Felder duerfen nicht via Public-API ge-updated werden
    const { data } = event;
    for (const field of PII_FIELDS) {
      if (field in data) {
        delete data[field];
      }
    }
  },

  async afterDelete(event) {
    // Cascade auf abhaengige Records (Mentions, Replies)
    const { result } = event;
    await strapi.db.query('api::reply.reply').deleteMany({
      where: { parentComment: result.id },
    });
  },
};
```

```javascript
// File: src/api/comment/controllers/comment.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::comment.comment', ({ strapi }) => ({
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::comment.comment', id, {
      // Niemals authorEmail / ipHash in API-Response
      fields: ['body', 'authorName', 'createdAt', 'consentVersion'],
    });

    if (!entity) {
      return ctx.notFound();
    }

    // Robots-Meta-Header fuer User-Content-Page
    ctx.set('X-Robots-Tag', 'noindex, nofollow');

    return { data: entity };
  },
}));
```

```javascript
// File: src/middlewares/robots-noindex.js
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();

    // User-generated-Content-Routes: kein Indexing
    if (ctx.request.url.startsWith('/api/comments/')
        || ctx.request.url.startsWith('/api/submissions/')) {
      ctx.set('X-Robots-Tag', 'noindex, nofollow');
    }
  };
};
```

```javascript
// File: config/middlewares.js
module.exports = [
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',  // Sicherstellen: poweredBy=false (siehe unten)
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  { resolve: './src/middlewares/robots-noindex' },
];
```

## AVV / DPA

- Strapi-Hosting (self-host EU / Strapi Cloud EU) — Art. 28 DSGVO
- Datenbank (Postgres EU / SQLite local) — AVV
- Media-Storage (S3 EU / Cloudinary EU) — AVV
- Webhook-Empfaenger — pro externes System AVV
- Telemetry MUSS aus sein (siehe `config/server.js`)

## DSE-Wording-Vorlage

```markdown
### User-generierter Content (Kommentare, Formulare)

Wenn Sie auf unserer Webseite Inhalte einreichen (z.B. Kommentare, Formulare),
verarbeiten wir folgende Daten:

| Feld | Verarbeitung | Speicherung |
|---|---|---|
| Inhalt (Body) | PII automatisch entfernt (E-Mail/IBAN/CC-Patterns redacted) | Bis Loeschung |
| Name (optional) | wird mit Inhalt veroeffentlicht | Bis Loeschung |
| E-Mail | nur intern (private), nicht oeffentlich | Bis Loeschung |
| IP-Hash | SHA-256 mit Salt, gekuerzt (Spam-Schutz) | 90 Tage |

**Veroeffentlichung:** Inhalte werden mit `noindex,nofollow` markiert,
sodass Suchmaschinen sie nicht indizieren.

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag) +
Art. 6 Abs. 1 lit. f DSGVO (Spam-Schutz).
**Loeschung:** auf Anfrage via [Account-Dashboard](#account) oder
E-Mail an <placeholder-email>.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Telemetry deaktiviert
grep -r "telemetryDisabled" config/
# Erwartung: telemetryDisabled: true

# 2. PII-Filter wirkt (Test-Submission)
curl -X POST https://<placeholder-domain>/api/comments \
  -H "Content-Type: application/json" \
  -d '{"data":{"body":"Mein Kontakt: test@example.com","consentVersion":"1.0"}}' \
  -H "Authorization: Bearer <placeholder-token>" -i
# Erwartung: 200, Body in DB enthaelt "[REDACTED]" statt Email

# 3. authorEmail nicht in API-Response
curl https://<placeholder-domain>/api/comments/<id> | jq .
# Erwartung: kein "authorEmail"-Feld

# 4. Robots-Meta-Header gesetzt
curl -sI https://<placeholder-domain>/api/comments/<id> | grep -i "x-robots-tag"
# Erwartung: X-Robots-Tag: noindex, nofollow

# 5. Strapi-Admin telemetry blockiert
# DevTools-Network-Tab beim Admin-Login: kein Call zu Strapi-Marketplace
```

## Cross-References

- AEGIS-Scanner: `cms-pii-checker.ts`, `tracking-scan.ts`, `data-transfer-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 5 (Min), Art. 32 (Sicherheit)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 5 (CMS-Audit), Phase 3 (Drittland)
