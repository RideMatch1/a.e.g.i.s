---
license: MIT (snippet)
provider: NestJS + @nestjs/schedule (Open-Source)
last-checked: 2026-05-05
purpose: NestJS Schedule-Module + Soft-Delete + Anonymisierungs-Cron fuer DSGVO-Loeschpflichten.
---

# NestJS — GDPR-Cleanup-Cron Pattern

## Trigger / Detection

Repo enthaelt:
- `@nestjs/schedule` in Dependencies
- `@Cron(...)` Decorator-Verwendung
- `ScheduleModule.forRoot()` in `AppModule`
- Optional: Soft-Delete-Patterns (`deletedAt: Date | null`)
- Optional: Anonymisierungs-Service

## Default-Verhalten (was passiert ohne Konfiguration)

- Soft-Deletes bleiben unbegrenzt → DSGVO Art. 5 lit. e Verstoss (Speicherbegrenzung)
- Inaktive User-Accounts bleiben → uebermaessige Speicherung
- Analytics-Events ohne Loeschfrist → Profil-Bildung trotz Widerruf
- Backup-Files ohne Rotation → DSE-Drift gegenueber Realitaet
- Kein Cron-Watchdog → silent failure bei Job-Crash

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Soft-Deletes nie hard-deleted | Art. 5 lit. e DSGVO | KRITISCH | Cron `0 3 * * *` mit Hard-Delete |
| Inaktive Accounts unbegrenzt | Art. 5 lit. e | HOCH | Inaktivitaets-Cleanup nach <placeholder-days> Tagen |
| Analytics-Events nie geloescht | Art. 5 lit. e | HOCH | Tabellen-Truncate-Cron |
| Cron-Crash unbemerkt | Art. 5 Abs. 2 (Rechenschaft) | KRITISCH | Health-Endpoint + Last-Run-Tabelle |
| Concurrent-Cron-Runs | Datenintegritaet | MITTEL | Distributed-Lock (Redis SETNX) |

## Code-Pattern (sanitized)

```typescript
// File: src/gdpr/gdpr-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from '../users/user.entity';
import { ConsentLog } from '../consent/consent-log.entity';
import { AnalyticsEvent } from '../analytics/analytics-event.entity';
import { CronRun } from './cron-run.entity';

@Injectable()
export class GdprCleanupService {
  private readonly logger = new Logger(GdprCleanupService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ConsentLog) private readonly consentLogs: Repository<ConsentLog>,
    @InjectRepository(AnalyticsEvent) private readonly events: Repository<AnalyticsEvent>,
    @InjectRepository(CronRun) private readonly runs: Repository<CronRun>,
  ) {}

  @Cron('0 3 * * *', { name: 'gdpr-hard-delete' })  // Taeglich 3 Uhr UTC
  async hardDeleteSoftDeleted() {
    const start = Date.now();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // 30 Tage Widerruf-Frist

    try {
      const result = await this.users.delete({
        deletedAt: LessThan(cutoff),
      });

      await this.runs.save({
        jobName: 'gdpr-hard-delete',
        startedAt: new Date(start),
        finishedAt: new Date(),
        status: 'SUCCESS',
        deletedCount: result.affected ?? 0,
      });

      this.logger.log(`Hard-deleted ${result.affected} users (cutoff ${cutoff.toISOString()})`);
    } catch (err: any) {
      await this.runs.save({
        jobName: 'gdpr-hard-delete',
        startedAt: new Date(start),
        finishedAt: new Date(),
        status: 'FAILED',
        error: err.message,
      });
      this.logger.error(`Cron failed: ${err.message}`);
      throw err;
    }
  }

  @Cron('0 4 * * 0', { name: 'inactive-user-cleanup' })  // Sonntag 4 Uhr UTC
  async deleteInactiveUsers() {
    const cutoff = new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000);  // 2 Jahre inaktiv

    const inactive = await this.users.find({
      where: { lastLoginAt: LessThan(cutoff), deletedAt: null },
      take: 1000,  // Batch-Limit
    });

    for (const user of inactive) {
      await this.users.update(user.id, {
        deletedAt: new Date(),
        deletionReason: 'INACTIVITY_TIMEOUT_2_YEARS',
        email: `inactive-${user.id}@<placeholder-domain>`,
        name: 'GELOESCHT',
      });
    }

    this.logger.log(`Soft-deleted ${inactive.length} inactive users`);
  }

  @Cron('0 5 * * *', { name: 'analytics-events-cleanup' })  // Taeglich 5 Uhr UTC
  async deleteOldAnalyticsEvents() {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);  // 90 Tage Speicherfrist

    const result = await this.events.delete({
      timestamp: LessThan(cutoff),
    });

    this.logger.log(`Deleted ${result.affected} old analytics events`);
  }

  @Cron('0 6 * * 0', { name: 'consent-log-rotation' })  // Sonntag 6 Uhr UTC
  async rotateConsentLogs() {
    // 6 Jahre Aufbewahrung (Verjaehrungsfrist Schadensersatz DSGVO)
    const cutoff = new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000);

    const result = await this.consentLogs.delete({
      timestamp: LessThan(cutoff),
    });

    this.logger.log(`Rotated ${result.affected} old consent logs`);
  }
}
```

```typescript
// File: src/gdpr/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CronRun } from './cron-run.entity';

@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(CronRun) private readonly runs: Repository<CronRun>,
  ) {}

  @Get('cron')
  async cronHealth() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentRuns = await this.runs.find({
      where: { startedAt: MoreThan(last24h) },
      order: { startedAt: 'DESC' },
    });

    const failed = recentRuns.filter(r => r.status === 'FAILED');
    const expectedJobs = ['gdpr-hard-delete', 'analytics-events-cleanup'];
    const missingJobs = expectedJobs.filter(
      j => !recentRuns.some(r => r.jobName === j && r.status === 'SUCCESS')
    );

    return {
      healthy: failed.length === 0 && missingJobs.length === 0,
      recentRuns: recentRuns.length,
      failedRuns: failed.length,
      missingJobs,
    };
  }
}
```

```typescript
// File: src/app.module.ts (Auszug)
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GdprCleanupService } from './gdpr/gdpr-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [GdprCleanupService],
})
export class AppModule {}
```

## AVV / DPA

- Datenbank — AVV (Hard-Delete-Wirksamkeit muss garantiert sein)
- Backup-Provider — AVV mit Rotation-Garantie (sonst Hard-Delete in Backup nicht wirksam)
- Cron-Watchdog (UptimeRobot / better-stack EU) — optional, AVV bei Health-Pings

## DSE-Wording-Vorlage

```markdown
### Loeschfristen und automatisierte Datenbereinigung

Wir loeschen Ihre Daten automatisch nach folgenden Fristen:

| Datenkategorie | Frist | Ausloeser |
|---|---|---|
| User-Account (aktiv) | bis Loeschungs-Anfrage | Manuell |
| User-Account (inaktiv) | 2 Jahre nach letztem Login | Automatisch (taeglich) |
| Analytics-Events | 90 Tage nach Erfassung | Automatisch (taeglich) |
| Consent-Logs | 6 Jahre | Automatisch (woechentlich) |
| Server-Logs | 14 Tage | Automatisch |
| Backups | 90 Tage Rotation | Provider-seitig |

**Soft-Delete + Hard-Delete:**
Bei manueller Loeschung wird Ihr Account zunaechst soft-geloescht (PII
ueberschrieben, Account deaktiviert). Nach 30 Tagen Widerruf-Frist erfolgt
das endgueltige Hard-Delete in allen Systemen.

**Rechtsgrundlage:** Art. 5 lit. e DSGVO (Speicherbegrenzung).
```

## Verify-Commands (Live-Probe)

```bash
# 1. Cron-Health-Endpoint
curl https://<placeholder-domain>/health/cron
# Erwartung: { "healthy": true, "missingJobs": [] }

# 2. Bei fehlendem Job: missingJobs gefuellt
# (Test: stoppe Cron-Service, warte 25h, prufe Endpoint)

# 3. Soft-Delete-Wirkung
# DB-Query: SELECT email, deleted_at FROM users WHERE deleted_at IS NOT NULL LIMIT 5;
# Erwartung: email-Feld ueberschrieben, deleted_at gesetzt

# 4. Hard-Delete nach 30 Tagen
# DB-Query: SELECT COUNT(*) FROM users WHERE deleted_at < now() - interval '30 days';
# Erwartung: 0
```

## Cross-References

- AEGIS-Scanner: `data-retention-checker.ts`, `cron-coverage-checker.ts`, `soft-delete-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 5 lit. e (Speicherbegrenzung), Art. 17 (Loeschung)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 4 (DSE-Drift Style 2 / Cron-Coverage)
