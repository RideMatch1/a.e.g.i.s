---
license: MIT (snippet)
provider: Laravel + Spatie/Analytics (Open-Source)
last-checked: 2026-05-05
purpose: Laravel-Tracking-Config mit Spatie/Analytics + Consent-aware Tracker-Initialisierung.
---

# Laravel — Tracking-Config Pattern

## Trigger / Detection

Repo enthaelt:
- `spatie/laravel-analytics` oder vergleichbares Package
- `config/services.php` mit Tracker-Endpoints
- `App\Services\AnalyticsService` o.ae.
- Optional: `App\Listeners\TrackEvent` Event-Listener

## Default-Verhalten (was passiert ohne Konfiguration)

- Spatie/Analytics laedt Daten direkt in Controller-Code → Server-Server-Calls ohne Consent
- Default-Endpoint nicht auf EU gepinnt (z.B. Google-Analytics Service-Account)
- `dd($result)` in Debug-Code leakt Tracker-Daten in Browser
- Logs enthalten Tracker-Roh-Responses inkl. PII
- Fehlende Auftragsverarbeiter-Doku → § 28 DSGVO-Verstoss

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Server-Side Tracker-Init ohne Consent | § 25 TDDDG | KRITISCH | Consent-Check vor `AnalyticsService::record(...)` |
| Drittland-Provider (Google Analytics) | Art. 44 DSGVO | KRITISCH | Migrate zu Plausible EU / Matomo / Umami |
| PII (User-Email) als `cid` an Tracker | Art. 5 lit. c | HOCH | Pseudonymous-ID via Hash |
| Service-Account-Credentials in `config/services.php` | Art. 32 DSGVO | KRITISCH | Move zu `.env` + Vault |
| `Log::info($tracker_response)` mit PII | Art. 5 lit. f | HOCH | Pino-Redact / Monolog Processor |

## Code-Pattern (sanitized)

```php
// File: config/analytics.php
<?php

return [
    'enabled' => env('ANALYTICS_ENABLED', false),
    'endpoint' => env('ANALYTICS_ENDPOINT', 'https://<placeholder-eu-analytics-host>/api/event'),
    'token' => env('ANALYTICS_TOKEN'),
    'allowed_hosts' => [
        '<placeholder-eu-analytics-host>',
        '<placeholder-eu-error-tracking-host>',
    ],
    'ip_hash_salt' => env('IP_HASH_SALT'),
];
```

```php
// File: app/Services/AnalyticsService.php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AnalyticsService
{
    public function record(string $event, array $payload, ?string $consentRaw = null): void
    {
        // 1. Feature-Flag-Check
        if (! config('analytics.enabled')) {
            return;
        }

        // 2. Consent-Check
        $consent = $this->parseConsent($consentRaw);
        if (! $consent['analytics']) {
            return;
        }

        // 3. Allowed-Host-Pruefung
        $endpoint = config('analytics.endpoint');
        $host = parse_url($endpoint, PHP_URL_HOST);
        if (! in_array($host, config('analytics.allowed_hosts'), true)) {
            Log::warning('Analytics-Host nicht in Allowlist', ['host' => $host]);
            return;
        }

        // 4. PII-Filter
        $safe = $this->sanitize($payload);

        // 5. Forward (Fire-and-Forget mit Timeout)
        try {
            Http::withToken(config('analytics.token'))
                ->timeout(2)
                ->post($endpoint, [
                    'event' => $event,
                    'data' => $safe,
                    'timestamp' => now()->toIso8601String(),
                ]);
        } catch (\Throwable $e) {
            // Silent — Tracker-Fehler darf Hauptrequest nicht crashen
            Log::warning('Analytics-Forward fehlgeschlagen', [
                'event' => $event,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function parseConsent(?string $raw): array
    {
        $default = ['necessary' => true, 'analytics' => false, 'marketing' => false];
        if (! $raw) return $default;
        $parsed = json_decode($raw, true);
        return is_array($parsed) ? array_merge($default, $parsed) : $default;
    }

    private function sanitize(array $payload): array
    {
        $allowed = ['path', 'referrer', 'screen', 'language', 'event_type'];
        $out = [];
        foreach ($payload as $k => $v) {
            if (in_array($k, $allowed, true) && (is_string($v) || is_numeric($v))) {
                $out[$k] = is_string($v) ? substr($v, 0, 500) : $v;
            }
        }
        return $out;
    }

    public function visitorHash(string $ip): string
    {
        return substr(
            hash('sha256', $ip . config('analytics.ip_hash_salt')),
            0,
            16
        );
    }
}
```

```php
// File: app/Http/Controllers/TrackController.php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\AnalyticsService;

class TrackController extends Controller
{
    public function __construct(private AnalyticsService $analytics) {}

    public function pageview(Request $request)
    {
        $request->validate([
            'path' => 'required|string|max:200',
            'referrer' => 'nullable|string|max:500',
        ]);

        $consentRaw = $request->cookie('cookie_consent');

        $this->analytics->record('pageview', [
            'path' => $request->input('path'),
            'referrer' => $request->input('referrer', ''),
            'visitor_hash' => $this->analytics->visitorHash($request->ip()),
        ], $consentRaw);

        return response()->noContent();
    }
}
```

```php
// File: app/Providers/AnalyticsServiceProvider.php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;

class AnalyticsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Monolog-Processor: redact PII aus Logs
        Log::pushProcessor(function ($record) {
            $patterns = [
                '/[\w.+-]+@[\w-]+\.[\w-]+/' => '[EMAIL_REDACTED]',
                '/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/' => '[CC_REDACTED]',
                '/\bDE\d{2}[\d\s]{18,22}\b/' => '[IBAN_REDACTED]',
            ];

            $msg = $record->message;
            foreach ($patterns as $pattern => $replacement) {
                $msg = preg_replace($pattern, $replacement, $msg);
            }

            return $record->with(message: $msg);
        });
    }
}
```

```bash
# File: .env (Beispiel)
ANALYTICS_ENABLED=true
ANALYTICS_ENDPOINT=https://<placeholder-eu-analytics-host>/api/event
ANALYTICS_TOKEN=<placeholder-secret-min-32-bytes>
IP_HASH_SALT=<placeholder-salt-min-32-bytes>
```

## AVV / DPA

- Analytics-Provider — AVV mit EU-Hosting Pflicht
- Hosting-Provider — Art. 28 DSGVO
- Logging-Service (sofern extern: Sentry EU / Bugsnag) — AVV mit IP-Anonymisierung-Garantie

## DSE-Wording-Vorlage

```markdown
### Server-Side Tracking

Wir verwenden serverseitige Tracker-Forwards anstelle direkter
Client-Scripts. Vor jedem Forward erfolgt:

1. **Consent-Check:** Forward nur wenn Sie Analytics-Cookies aktiviert haben
2. **PII-Filter:** Nur erlaubte Felder (Pfad, Referrer-Domain, Bildschirm-Aufloesung)
3. **Allowlist-Pruefung:** Nur EU-Provider in unserer Allowlist erhalten Daten
4. **IP-Anonymisierung:** SHA-256-Hash mit Salt, gekuerzt auf 16 Zeichen

**Anbieter:** <placeholder-analytics-provider>, EU-Hosting.
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO i.V.m. § 25 TDDDG.
**Speicherdauer:** <placeholder-days> Tage.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Tracker blockt ohne Consent
curl -X POST https://<placeholder-domain>/track/pageview \
  -H "Content-Type: application/json" \
  -d '{"path":"/test"}' -i
# Erwartung: 204, aber serverseitig kein Forward (Logs pruefen)

# 2. Mit Consent: Forward erfolgreich
curl -X POST https://<placeholder-domain>/track/pageview \
  -H "Content-Type: application/json" \
  -H 'Cookie: cookie_consent=%7B%22analytics%22%3Atrue%7D' \
  -d '{"path":"/test"}' -i
# Erwartung: 204

# 3. Allowed-Host-Enforcement (Unit-Test mit gefakter Endpoint-Config)

# 4. Logs enthalten keine E-Mails
tail -100 storage/logs/laravel.log | grep -E '[\w.+-]+@[\w-]+\.[\w-]+' | head -5
# Erwartung: 0 oder ausschliesslich [EMAIL_REDACTED]
```

## Cross-References

- AEGIS-Scanner: `tracking-scan.ts`, `pii-flow-tracker.ts`, `data-transfer-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 5 (Min), Art. 44 (Drittland)
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- Audit-Pattern: `references/audit-patterns.md` Phase 3 (Drittland), Phase 6 (Server-Logs)
