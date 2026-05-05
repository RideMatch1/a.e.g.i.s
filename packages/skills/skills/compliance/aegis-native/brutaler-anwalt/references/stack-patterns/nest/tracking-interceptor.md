---
license: MIT (snippet)
provider: NestJS (Open-Source)
last-checked: 2026-05-05
purpose: NestJS Interceptor-Pattern fuer Tracker-Calls + Consent-Check + Anonymisierung.
---

# NestJS — Tracking-Interceptor (Pattern)

## Trigger / Detection

Repo enthaelt:
- `@Injectable()` Klassen die `NestInterceptor` implementieren
- `@UseInterceptors(...)` Decorator-Verwendung
- HTTP-Outbound-Calls in Service-Methoden (Tracker-Forwards)
- Optional: `rxjs` `tap()` / `mergeMap()` Operators

Pattern: zentraler Interceptor wrapped Tracker-Outbound-Calls. Vor dem Send wird Consent geprueft, IP gehasht, PII entfernt.

## Default-Verhalten (was passiert ohne Konfiguration)

- Tracker-Calls in Services direkt → schwer zu auditieren
- Kein zentraler PII-Filter → Email/Name leakt in Tracker-Payloads
- Kein Backpressure → bei Tracker-Overload blockiert Hauptrequest
- `console.log`-Debugging belaesst Klartext-Daten in stdout

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| PII (Email/Name) in Tracker-Payload | Art. 5 lit. c DSGVO | KRITISCH | Interceptor whitelistet Felder |
| Klartext-IP in Tracker-Forward | Art. 5 lit. f | HOCH | IP-Hash im Interceptor |
| Tracker-Crash blockiert Hauptrequest | Art. 32 DSGVO | MITTEL | `catchError` + Fire-and-Forget |
| Drittland-Forward ohne Allowlist | Art. 44 DSGVO | KRITISCH | Allowlist in Interceptor-Config |
| Console-Log mit PII | Art. 5 lit. f | HOCH | Pino-Redact + Logger-Service |

## Code-Pattern (sanitized)

```typescript
// File: src/tracking/tracking.interceptor.ts
import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

const ALLOWED_FIELDS = new Set([
  'event', 'path', 'referrer', 'screen', 'language', 'timestamp',
]);

const ALLOWED_HOSTS = new Set([
  '<placeholder-eu-analytics-host>',
  '<placeholder-eu-error-tracking-host>',
]);

@Injectable()
export class TrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TrackingInterceptor.name);

  constructor(private readonly config: ConfigService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const consentRaw = req.cookies?.['cookie-consent'];
    let consent = { necessary: true, analytics: false, marketing: false };
    try {
      if (consentRaw) consent = { ...consent, ...JSON.parse(consentRaw) };
    } catch {}

    return next.handle().pipe(
      tap(async (data) => {
        if (!consent.analytics) return;
        if (!data?.trackingEvent) return;

        const event = data.trackingEvent;
        const safe = this.sanitize(event);
        const ipHash = this.ipHash(req);

        // Fire-and-Forget: Tracker-Crash darf Hauptrequest nicht beeinflussen
        this.forward(safe, ipHash).catch((err) => {
          this.logger.warn(`tracking-forward-failed: ${err.message}`);
        });
      }),
      catchError((err) => {
        // Hauptrequest-Errors propagieren, Tracker-Errors swallowen
        throw err;
      }),
    );
  }

  private sanitize(event: any): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(event)) {
      if (ALLOWED_FIELDS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
        out[k] = typeof v === 'string' ? v.slice(0, 500) : v;
      }
    }
    return out;
  }

  private ipHash(req: any): string {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? '';
    return crypto
      .createHash('sha256')
      .update(ip + this.config.get('IP_HASH_SALT', ''))
      .digest('hex')
      .slice(0, 16);
  }

  private async forward(payload: Record<string, unknown>, visitorHash: string): Promise<void> {
    const endpoint = this.config.get<string>('ANALYTICS_ENDPOINT', '');
    if (!endpoint) return;

    const host = new URL(endpoint).host;
    if (!ALLOWED_HOSTS.has(host)) {
      this.logger.error(`Tracker-Host ${host} nicht in Allowlist — Forward abgebrochen`);
      return;
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.get('ANALYTICS_TOKEN', '')}`,
      },
      body: JSON.stringify({ ...payload, visitorHash }),
      signal: AbortSignal.timeout(2000),
    });
  }
}
```

```typescript
// File: src/tracking/tracking.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TrackingInterceptor } from './tracking.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TrackingInterceptor },
  ],
})
export class TrackingModule {}
```

```typescript
// File: src/example/example.controller.ts (Beispiel-Verwendung)
import { Body, Controller, Post } from '@nestjs/common';

@Controller('api/example')
export class ExampleController {
  @Post('action')
  async doAction(@Body() body: any) {
    // Geschaeftslogik
    const result = await this.businessLogic(body);

    // Tracker-Event ZUSAMMEN mit Response zurueckgeben
    // Interceptor fired das Event nach Response-Send
    return {
      ...result,
      trackingEvent: {
        event: 'action_completed',
        path: '/api/example/action',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async businessLogic(_body: any) {
    return { ok: true };
  }
}
```

## AVV / DPA

- Tracker-Forward-Provider — AVV Pflicht (Allowlist-Hosts)
- Logging-Service (NestJS-Logger / Pino-Cloud / Datadog EU) — AVV
- Hosting-Provider — Art. 28 DSGVO

## DSE-Wording-Vorlage

```markdown
### Webanalyse-Forwards

Mit Ihrer Einwilligung leiten wir anonymisierte Tracker-Events an unseren
Analytics-Provider weiter. Vor Versand erfolgt eine zwei-stufige Pruefung:

1. **PII-Filter:** Nur folgende Felder werden uebertragen:
   - Event-Name (z.B. `pageview`, `click`)
   - URL-Pfad (ohne Query-String)
   - Referrer-Domain (ohne Pfad)
   - Bildschirm-Aufloesung
   - Sprach-Code
   - Zeitstempel

2. **IP-Anonymisierung:** Statt Ihrer IP-Adresse uebertragen wir einen
   gesalzenen Hash (SHA-256, 16 Zeichen), der nicht reversibel ist.

**Anbieter:** <placeholder-analytics-provider>, EU-Hosting.
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO i.V.m. § 25 Abs. 1 TDDDG.
**Widerruf:** [Cookie-Einstellungen](#cookie-settings) im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Tracker-Endpoint Allowlist enforced (Unit-Test)
# Setze ANALYTICS_ENDPOINT auf nicht-allowlisted Host und triggere Action
# Erwartung: Log "Tracker-Host X nicht in Allowlist"

# 2. PII NICHT im Tracker-Payload
# Mock fetch und logge Payload bei Provider-Call
# Erwartung: kein "email", "name", "phone" Feld

# 3. Tracker-Crash blockt Hauptrequest nicht
# Mock fetch mit Error
curl -X POST https://<placeholder-domain>/api/example/action -d '{}' -i
# Erwartung: 200/204 trotz Tracker-Fehler

# 4. Timeout funktioniert
# Mock fetch mit 5s-delay
# Erwartung: AbortError nach 2s, Hauptrequest fertig
```

## Cross-References

- AEGIS-Scanner: `tracking-scan.ts`, `pii-flow-tracker.ts`, `cors-allowlist-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 5 (Daten-Min), Art. 44 (Drittland)
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- Audit-Pattern: `references/audit-patterns.md` Phase 3 (Drittland-Audit), Phase 6 (Server-Logs)
