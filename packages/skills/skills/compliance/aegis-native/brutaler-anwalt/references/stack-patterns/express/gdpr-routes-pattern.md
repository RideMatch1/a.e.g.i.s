---
license: MIT (snippet)
provider: Express.js (Open-Source)
last-checked: 2026-05-05
purpose: Standard-DSGVO-Routes (Auskunft, Loeschung, Datenuebertragbarkeit) im Express-Stack.
---

# Express — DSGVO-Routes Pattern

## Trigger / Detection

Repo enthaelt:
- `express` mit User-Authentifizierung (Sessions / JWT)
- Datenbank-Layer mit User-Tabellen
- Optional: Job-Queue (BullMQ / Agenda) fuer asynchrone Auskunfts-Generierung
- Optional: Mailer-Service fuer Antwort-Versand

DSGVO-Pflicht-Endpoints (typisch):
- `POST /api/gdpr/auskunft` (Art. 15)
- `POST /api/gdpr/loeschen` (Art. 17)
- `POST /api/gdpr/portabilitaet` (Art. 20)
- `POST /api/gdpr/berichtigung` (Art. 16)
- `POST /api/gdpr/widerspruch` (Art. 21)

## Default-Verhalten (was passiert ohne Konfiguration)

- DSGVO-Anfragen kommen per E-Mail an Support → manuelle Bearbeitung
- Keine Log-Spur fuer Compliance-Nachweis (Art. 5 Abs. 2 Rechenschaftspflicht)
- Loeschungen oft unvollstaendig (Backups, Logs, Search-Indexes uebersehen)
- Auskunft als Word-Dokument zusammenkopiert → Drift, Fehler-Quote hoch
- Keine Identitaets-Verifizierung → Account-Takeover-Vektor

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Antwortfrist 1 Monat verpasst | Art. 12 Abs. 3 DSGVO | KRITISCH | Job-Queue + Cron-Watchdog |
| Auskunft unvollstaendig (Backup-Daten fehlen) | Art. 15 DSGVO | HOCH | Multi-Source-Aggregator |
| Loeschung verfehlt Search-Index | Art. 17 DSGVO | HOCH | Index-Sync-Worker im gleichen Job |
| Identitaet nicht verifiziert | Art. 12 Abs. 6 DSGVO | KRITISCH | E-Mail-Bestaetigung + Session-Auth |
| Antwort an falsche Person (PII-Leak) | Art. 5 lit. f DSGVO | KRITISCH | E-Mail-Match + 2FA-Check |
| Kein Audit-Log | Art. 5 Abs. 2 DSGVO | HOCH | DB-Tabelle `gdpr_requests` |

## Code-Pattern (sanitized)

```typescript
// File: src/routes/gdpr.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { gdprQueue } from '../jobs/gdpr-queue';

const router = Router();

const auskunftSchema = z.object({
  email: z.string().email(),
  format: z.enum(['json', 'pdf']).default('json'),
});

router.post('/api/gdpr/auskunft', requireAuth, async (req, res) => {
  const parsed = auskunftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Identitaets-Check: angefragte E-Mail muss Session-User entsprechen
  if (parsed.data.email.toLowerCase() !== req.user.email.toLowerCase()) {
    return res.status(403).json({ error: 'Identitaet nicht bestaetigt' });
  }

  // Audit-Log: Request registrieren
  const request = await req.app.locals.db.gdprRequest.create({
    data: {
      userId: req.user.id,
      type: 'AUSKUNFT',
      status: 'PENDING',
      requestedAt: new Date(),
      requestedFormat: parsed.data.format,
    },
  });

  // Async-Job fuer Aggregation queuen
  await gdprQueue.add('auskunft', {
    requestId: request.id,
    userId: req.user.id,
    format: parsed.data.format,
  });

  res.status(202).json({
    requestId: request.id,
    status: 'PENDING',
    expectedResponseTime: '14 Tage (max. 1 Monat per Art. 12 DSGVO)',
  });
});

router.post('/api/gdpr/loeschen', requireAuth, async (req, res) => {
  const reason = z.string().max(500).optional().parse(req.body.reason);

  // Soft-Delete sofort, Hard-Delete via Job
  await req.app.locals.db.user.update({
    where: { id: req.user.id },
    data: {
      deletedAt: new Date(),
      deletionReason: reason ?? null,
      // PII-Felder sofort ueberschreiben
      email: `deleted-${req.user.id}@<placeholder-domain>`,
      name: 'GELOESCHT',
    },
  });

  await gdprQueue.add('hard-delete', { userId: req.user.id }, { delay: 30 * 24 * 60 * 60 * 1000 });

  // Logout
  req.session?.destroy(() => {});

  res.status(202).json({
    status: 'PENDING_HARD_DELETE',
    softDeletedAt: new Date().toISOString(),
    hardDeleteScheduled: 'in 30 Tagen (Widerruf-Frist)',
  });
});

router.post('/api/gdpr/portabilitaet', requireAuth, async (req, res) => {
  // Aehnlich Auskunft, aber zusaetzlich strukturiertes/maschinenlesbares Format
  const request = await req.app.locals.db.gdprRequest.create({
    data: {
      userId: req.user.id,
      type: 'PORTABILITAET',
      status: 'PENDING',
      requestedAt: new Date(),
      requestedFormat: 'json',
    },
  });

  await gdprQueue.add('portability-export', { requestId: request.id, userId: req.user.id });

  res.status(202).json({ requestId: request.id });
});

router.post('/api/gdpr/widerspruch', requireAuth, async (req, res) => {
  const scope = z.enum(['marketing', 'analytics', 'profiling', 'all']).parse(req.body.scope);

  await req.app.locals.db.user.update({
    where: { id: req.user.id },
    data: {
      consentMarketing: scope === 'marketing' || scope === 'all' ? false : undefined,
      consentAnalytics: scope === 'analytics' || scope === 'all' ? false : undefined,
      consentProfiling: scope === 'profiling' || scope === 'all' ? false : undefined,
      objectionLoggedAt: new Date(),
    },
  });

  res.status(204).end();
});

export default router;
```

```typescript
// File: src/jobs/gdpr-queue.ts
import { Queue, Worker } from 'bullmq';

export const gdprQueue = new Queue('gdpr', {
  connection: { host: process.env.REDIS_HOST, port: 6379 },
});

new Worker('gdpr', async (job) => {
  switch (job.name) {
    case 'auskunft':
      await aggregateUserData(job.data.userId, job.data.requestId);
      break;
    case 'hard-delete':
      await hardDeleteUser(job.data.userId);
      break;
    case 'portability-export':
      await exportPortabilityData(job.data.userId, job.data.requestId);
      break;
  }
}, { connection: { host: process.env.REDIS_HOST, port: 6379 } });

async function aggregateUserData(_userId: string, _requestId: string) {
  // Pflicht-Quellen: User-DB, Orders, Logs, Backups, Search-Index, S3-Uploads
  // Generiere JSON/PDF, hashe als Beweis, sende per E-Mail mit signed Link
}

async function hardDeleteUser(_userId: string) {
  // Pflicht-Targets: alle Tabellen, Search-Indexes, S3-Files, Backups (gem. Backup-Policy)
}

async function exportPortabilityData(_userId: string, _requestId: string) {
  // Strukturiert + maschinenlesbar (JSON, optional CSV)
}
```

## AVV / DPA

- Datenbank-Provider — AVV
- Job-Queue (Redis Cloud / Upstash EU) — AVV
- Mailer (SES EU / Postmark / Resend EU) — AVV
- File-Storage (S3 EU / Bunny CDN) fuer Auskunfts-Exports — AVV mit signed-URL-Pflicht

## DSE-Wording-Vorlage

```markdown
### Ihre Rechte als betroffene Person

Sie koennen jederzeit folgende Rechte ausueben — eingeloggt unter
[Ihre Daten](#account-data) oder per E-Mail an <placeholder-email>:

| Recht | Endpoint | Antwortzeit |
|---|---|---|
| Auskunft (Art. 15) | `/api/gdpr/auskunft` | max. 1 Monat |
| Berichtigung (Art. 16) | `/api/gdpr/berichtigung` | max. 1 Monat |
| Loeschung (Art. 17) | `/api/gdpr/loeschen` | sofort (Soft) + 30T (Hard) |
| Datenuebertragbarkeit (Art. 20) | `/api/gdpr/portabilitaet` | max. 1 Monat |
| Widerspruch (Art. 21) | `/api/gdpr/widerspruch` | sofort |

**Identitaets-Verifizierung:** Anfragen werden nur aus eingeloggter Session
ausgefuehrt. Bei E-Mail-Anfragen bestaetigen wir Ihre Identitaet via
Confirm-Link an die hinterlegte E-Mail-Adresse.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Auskunft-Endpoint erfordert Auth
curl -X POST https://<placeholder-domain>/api/gdpr/auskunft \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","format":"json"}' -i
# Erwartung: 401 / 403

# 2. Mit Auth: 202 + RequestId
curl -X POST https://<placeholder-domain>/api/gdpr/auskunft \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<placeholder-session>" \
  -d '{"email":"<placeholder-user-email>","format":"json"}' -i
# Erwartung: 202 mit { requestId, status: "PENDING" }

# 3. Cross-User-Zugriff verhindert
curl -X POST https://<placeholder-domain>/api/gdpr/auskunft \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<placeholder-session>" \
  -d '{"email":"OTHER-USER@example.com","format":"json"}' -i
# Erwartung: 403 "Identitaet nicht bestaetigt"

# 4. Audit-Log-Pruefung (DB-Query)
# SELECT COUNT(*) FROM gdpr_requests WHERE userId = '<id>' AND created_at > now() - interval '24h';
```

## Cross-References

- AEGIS-Scanner: `gdpr-routes-checker.ts`, `auth-flow-checker.ts`, `tenant-isolation-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 12-22 (Betroffenenrechte)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- EuGH-Rechtsprechung: `references/eu-eugh-dsgvo-schadensersatz.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 8 (Betroffenenrechte-Test)
