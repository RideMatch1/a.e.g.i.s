---
license: MIT (snippet)
provider: NestJS + Passport (Open-Source)
last-checked: 2026-05-05
purpose: NestJS Auth-Pattern mit Passport-Strategy + DSGVO-konformer Session-Verwaltung.
---

# NestJS — Auth-Pattern (Passport + DSGVO-Sessions)

## Trigger / Detection

Repo enthaelt:
- `@nestjs/passport`, `@nestjs/jwt` in Dependencies
- `*Strategy.ts` (LocalStrategy, JwtStrategy, OAuth2Strategy)
- `AuthModule`, `AuthService`, `AuthGuard`
- Optional: `bcrypt` / `argon2` fuer Password-Hashing
- Optional: `@nestjs/throttler` fuer Rate-Limiting

## Default-Verhalten (was passiert ohne Konfiguration)

- Passport-Default speichert Session-IDs ohne `Secure;HttpOnly`
- JWT ohne Expiry-Default → permanente Tokens
- Login-Fehler-Messages leaken User-Existence ("user not found" vs "wrong password")
- Login-Endpoint ohne Rate-Limit → Brute-Force-Vektor
- Failed-Login-Logs enthalten Klartext-Passwort wenn falsches Logging-Level

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Session-Cookie ohne Secure-Flag | Art. 32 DSGVO | KRITISCH | `cookie: { secure: true, httpOnly: true, sameSite: 'lax' }` |
| JWT ohne Expiry | Art. 32 DSGVO | KRITISCH | `signOptions: { expiresIn: '15m' }` + Refresh |
| User-Enumeration via Error-Messages | DSGVO Art. 32 | HOCH | Generisches "Login-Daten ungueltig" |
| Klartext-Passwort in Logs | Art. 5 lit. f DSGVO | KRITISCH | Logging-Filter / Pino-Redact |
| Brute-Force-Schutz fehlt | Art. 32 DSGVO | HOCH | `@nestjs/throttler` + IP-Hash-Block |
| Login-Logs ohne Anonymisierung | Art. 5 lit. f | MITTEL | IP-Hash + Truncate UserAgent |

## Code-Pattern (sanitized)

```typescript
// File: src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,  // KRITISCH: niemals true
      secretOrKey: process.env.JWT_SECRET!,  // mind. 32 Bytes random
      issuer: '<placeholder-domain>',
      audience: '<placeholder-domain>',
    });
  }

  async validate(payload: { sub: string; email: string; iat: number }) {
    if (!payload.sub) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email };
  }
}
```

```typescript
// File: src/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from '../users/user.entity';
import { LoginAttempt } from './login-attempt.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoginAttempt) private readonly attempts: Repository<LoginAttempt>,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ipHash: string) {
    // Generic-Error: user-enumeration verhindern
    const user = await this.users.findOne({ where: { email } });
    const valid = user ? await argon2.verify(user.passwordHash, password) : false;

    // Audit-Log (egal ob Erfolg)
    await this.attempts.save({
      ipHash,
      success: valid,
      timestamp: new Date(),
      // NIE: email, password
    });

    if (!user || !valid) {
      // Konstante Antwortzeit (timing-attack-Schutz)
      await this.delay(200);
      throw new UnauthorizedException('Login-Daten ungueltig');
    }

    const token = this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '15m' },
    );

    const refresh = this.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return { token, refresh, expiresIn: 900 };
  }

  async logout(userId: string) {
    // Refresh-Token-Invalidation (in DB-Tabelle)
    await this.users.update(userId, { tokenVersion: () => 'token_version + 1' });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
```

```typescript
// File: src/auth/auth.controller.ts
import {
  Body, Controller, Post, UseGuards, Req, Res, HttpCode,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })  // 5/min pro IP
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      ?? req.socket.remoteAddress ?? '';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    const { token, refresh, expiresIn } = await this.auth.login(dto.email, dto.password, ipHash);

    res.cookie('refresh', refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    return { token, expiresIn };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.user.id);
    res.clearCookie('refresh', { path: '/auth/refresh' });
  }
}
```

```typescript
// File: src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m', issuer: '<placeholder-domain>' },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

## AVV / DPA

- Datenbank (User-Tabelle, Login-Attempts) — AVV mit EU-Region
- Mailer (E-Mail-Verifizierung, Password-Reset) — AVV
- Optional: SSO-Provider (Auth0 EU, Keycloak self-host) — AVV mit Drittland-TIA

## DSE-Wording-Vorlage

```markdown
### Login und Authentifizierung

Bei der Anmeldung verarbeiten wir folgende Daten:

- E-Mail-Adresse (zur Identifizierung)
- Passwort (gespeichert als Argon2-Hash, niemals im Klartext)
- Hash der IP-Adresse (zur Brute-Force-Erkennung)
- User-Agent (zur Erkennung verdaechtiger Aktivitaeten)
- Login-Zeitpunkt

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfuellung) +
Art. 6 Abs. 1 lit. f DSGVO (Sicherheit, berechtigtes Interesse).
**Speicherdauer:**
- User-Account: bis Loeschung durch Sie
- Login-Attempts (anonymisiert): 90 Tage
- Session-Cookies: 7 Tage (Refresh-Token), 15 Minuten (Access-Token)
```

## Verify-Commands (Live-Probe)

```bash
# 1. Login mit falschen Credentials = Generic Error
curl -X POST https://<placeholder-domain>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"WRONG"}' -i
# Erwartung: 401 mit "Login-Daten ungueltig" (NICHT "User not found")

# 2. Rate-Limit nach 5 Versuchen
for i in {1..6}; do
  curl -X POST https://<placeholder-domain>/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' -s -o /dev/null -w "%{http_code}\n"
done
# Erwartung: 401, 401, 401, 401, 401, 429

# 3. Refresh-Cookie HttpOnly + Secure
curl -X POST https://<placeholder-domain>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<placeholder-user>","password":"<placeholder-password>"}' -i \
  | grep -i "set-cookie:.*refresh"
# Erwartung: HttpOnly; Secure; SameSite=Lax

# 4. JWT-Expiry funktioniert
# Token decoden, exp-Feld pruefen → max +900 Sekunden
```

## Cross-References

- AEGIS-Scanner: `auth-flow-checker.ts`, `jwt-config-checker.ts`, `bcrypt-argon-checker.ts`, `rate-limit-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 32 (Sicherheit)
- BSI-Grundschutz: ORP.4 Identitaets- und Berechtigungsmanagement
- Audit-Pattern: `references/audit-patterns.md` Phase 9 (Auth-Audit)
