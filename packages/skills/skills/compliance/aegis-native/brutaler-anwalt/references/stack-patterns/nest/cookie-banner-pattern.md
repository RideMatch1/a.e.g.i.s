---
license: MIT (snippet)
provider: NestJS (Open-Source)
last-checked: 2026-05-05
purpose: NestJS Guards-Pattern fuer Consent-Validation auf Controller-Ebene.
---

# NestJS — Consent-Guard Pattern

## Trigger / Detection

Repo enthaelt:
- `@nestjs/core`, `@nestjs/common` in `package.json`
- `*.module.ts`, `*.controller.ts`, `*.service.ts` Dateien
- `@UseGuards(...)` Decorator-Verwendung
- Optional: `@nestjs/passport`, `@nestjs/jwt`, `cookie-parser` Middleware

## Default-Verhalten (was passiert ohne Konfiguration)

- NestJS hat keinen Default-Consent-Guard
- Tracker-Module global im `AppModule` registriert → laufen vor Consent
- `@Body()` ohne `ValidationPipe` akzeptiert beliebige Payloads
- Cookies-Read via `@Req()` ohne Type-Safety → silent failures

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker-Service auto-instantiiert | § 25 TDDDG | KRITISCH | Lazy-Module nach Consent-Event |
| Endpoints ohne Consent-Guard | § 25 TDDDG | HOCH | `@UseGuards(ConsentGuard)` |
| Body unvalidated | Art. 25 DSGVO | MITTEL | Global `ValidationPipe` |
| Cookie-Parse-Errors verschluckt | DSGVO Art. 7 (Nachweis) | MITTEL | Custom Decorator mit Validation |
| Drittland-Tracker direkt eingebunden | Art. 44 DSGVO | KRITISCH | EU-Provider + AVV |

## Code-Pattern (sanitized)

```typescript
// File: src/consent/consent.types.ts
export type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
  version: string;
};

export const DEFAULT_CONSENT: Consent = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: '1.0',
};
```

```typescript
// File: src/consent/consent.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_CONSENT, Consent } from './consent.types';

export const UserConsent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Consent => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = req.cookies?.['cookie-consent'];
    if (!raw) return { ...DEFAULT_CONSENT };
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONSENT, ...parsed };
    } catch {
      return { ...DEFAULT_CONSENT };
    }
  },
);
```

```typescript
// File: src/consent/consent.guard.ts
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEFAULT_CONSENT, Consent } from './consent.types';

export const REQUIRES_CONSENT = 'requiresConsent';
export const RequiresConsent = (category: keyof Omit<Consent, 'necessary' | 'timestamp' | 'version'>) =>
  SetMetadata(REQUIRES_CONSENT, category);

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<keyof Consent>(REQUIRES_CONSENT, ctx.getHandler());
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest();
    const raw = req.cookies?.['cookie-consent'];
    if (!raw) return false;
    try {
      const consent = { ...DEFAULT_CONSENT, ...JSON.parse(raw) };
      return consent[required] === true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// File: src/consent/consent.controller.ts
import { Body, Controller, Post, Res, HttpCode, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { IsBoolean, IsOptional } from 'class-validator';
import { ConsentService } from './consent.service';

class ConsentDto {
  @IsBoolean() analytics!: boolean;
  @IsBoolean() marketing!: boolean;
  @IsOptional() @IsBoolean() necessary?: boolean;
}

@Controller('api/consent-log')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post()
  @HttpCode(204)
  async logConsent(@Body() dto: ConsentDto, @Res({ passthrough: true }) res: Response) {
    const final = {
      necessary: true as const,
      analytics: dto.analytics,
      marketing: dto.marketing,
      timestamp: new Date().toISOString(),
      version: '1.0' as const,
    };

    await this.consentService.logConsent(final, res.req);

    res.cookie('cookie-consent', JSON.stringify(final), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
```

```typescript
// File: src/consent/consent.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConsentLog } from './consent-log.entity';
import { Consent } from './consent.types';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentLog) private readonly repo: Repository<ConsentLog>,
  ) {}

  async logConsent(consent: Consent, req: any): Promise<void> {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? '';
    const ipHash = crypto
      .createHash('sha256')
      .update(ip + (process.env.IP_HASH_SALT ?? ''))
      .digest('hex')
      .slice(0, 16);

    await this.repo.save({
      ipHash,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 200),
      consent: JSON.stringify(consent),
      timestamp: new Date(),
    });
  }
}
```

```typescript
// File: src/tracking/tracking.controller.ts (Beispiel-Verwendung)
import { Body, Controller, Post, UseGuards, HttpCode } from '@nestjs/common';
import { ConsentGuard, RequiresConsent } from '../consent/consent.guard';

@Controller('api/track')
export class TrackingController {
  @Post()
  @HttpCode(204)
  @UseGuards(ConsentGuard)
  @RequiresConsent('analytics')
  async track(@Body() event: any) {
    // Wird nur ausgefuehrt wenn analytics: true im Cookie
  }
}
```

## AVV / DPA

- Datenbank (TypeORM/Prisma → Postgres-EU) — AVV
- Hosting-Provider — Art. 28 DSGVO
- Logging-Service (sofern extern) — AVV
- Tracker-Forward-Provider — AVV mit EU-Hosting

## DSE-Wording-Vorlage

```markdown
### Consent-Logging

Wir protokollieren Ihre Cookie-Einwilligung serverseitig zur Erfuellung der
Nachweispflicht (Art. 7 Abs. 1 DSGVO). Protokolliert werden:

- Hash Ihrer IP-Adresse (SHA-256 mit Salt, gekuerzt)
- User-Agent (Browser-String, max. 200 Zeichen)
- Zeitstempel
- Gewaehlte Cookie-Kategorien

**Speicherdauer:** 6 Jahre (Verjaehrungsfrist Schadensersatz-Anspruch
DSGVO).
**Zweck:** Beweisfunktion bei Streitigkeiten ueber Einwilligung.
**Keine Personalisierung:** Das Log ist nicht mit Ihrem Account verknuepft.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Tracking-Endpoint blockt ohne Consent-Cookie
curl -X POST https://<placeholder-domain>/api/track \
  -H "Content-Type: application/json" -d '{"event":"pageview"}' -i
# Erwartung: 403 (ConsentGuard refuses)

# 2. Mit Consent-Cookie: 204
curl -X POST https://<placeholder-domain>/api/track \
  -H "Content-Type: application/json" \
  -H 'Cookie: cookie-consent=%7B%22analytics%22%3Atrue%7D' \
  -d '{"event":"pageview"}' -i
# Erwartung: 204

# 3. Consent-Log persistiert
# DB-Query: SELECT COUNT(*) FROM consent_log WHERE timestamp > now() - interval '1 hour';

# 4. Validation-Pipe blockt invalid Payload
curl -X POST https://<placeholder-domain>/api/consent-log \
  -H "Content-Type: application/json" -d '{"analytics":"yes"}' -i
# Erwartung: 400 mit ValidationError
```

## Cross-References

- AEGIS-Scanner: `consent-flow-checker.ts`, `nestjs-guard-checker.ts`, `cookie-flags-checker.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
