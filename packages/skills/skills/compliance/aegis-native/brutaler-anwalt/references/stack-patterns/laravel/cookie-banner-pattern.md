---
license: MIT (snippet)
provider: Laravel + Spatie/cookie-consent (Open-Source)
last-checked: 2026-05-05
purpose: Laravel Blade-Component fuer Cookie-Banner mit Spatie/Cookie-Consent-Package.
---

# Laravel — Cookie-Banner (Pattern)

## Trigger / Detection

Repo enthaelt:
- `laravel/framework` in `composer.json`
- `resources/views/**/*.blade.php` Templates
- `app/Http/Controllers/*` Controller
- Optional: `spatie/laravel-cookie-consent` Package

## Default-Verhalten (was passiert ohne Konfiguration)

- Laravel-Default-Cookie-Encryption gilt fuer alle Cookies — Performance-Hit
- `cookie('name', $value)` ohne `secure(true)` → unsicher in Prod
- Tracker-Scripts in Layout-Blade direkt eingebunden → laufen vor Consent
- Session-Cookies ohne `same_site=lax` Default in alten Versionen
- `csrf_token()` Cookie nicht vom Encryption-Bypass betroffen → korrekt

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker-Script in `app.blade.php` Layout | § 25 TDDDG | KRITISCH | Conditional `@if(consent('analytics'))` |
| Cookie-Encryption auf Consent-Cookie | DSGVO Art. 25 | NIEDRIG | EncryptCookies Middleware-Bypass |
| `secure(false)` in Prod-Cookies | Art. 32 DSGVO | KRITISCH | `'secure' => env('APP_ENV') === 'production'` |
| Session ohne `same_site=lax` | Art. 32 DSGVO | HOCH | `config/session.php` setzen |
| Drittland-Tracker in `mix.js` | Art. 44 DSGVO | KRITISCH | EU-Provider + AVV |

## Code-Pattern (sanitized)

```php
// File: config/cookie-consent.php
<?php

return [
    'banner_view' => 'cookies.banner',
    'cookie_name' => 'cookie_consent',
    'cookie_lifetime' => 60 * 24 * 365,  // 12 Monate (Minuten)
    'categories' => [
        'necessary' => ['default' => true, 'locked' => true],
        'analytics' => ['default' => false, 'locked' => false],
        'marketing' => ['default' => false, 'locked' => false],
    ],
];
```

```php
// File: app/Http/Middleware/ConsentCookie.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ConsentCookie
{
    public function handle(Request $request, Closure $next)
    {
        $raw = $request->cookie('cookie_consent');
        $consent = [
            'necessary' => true,
            'analytics' => false,
            'marketing' => false,
        ];

        if ($raw) {
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) {
                $consent = array_merge($consent, $parsed);
            }
        }

        $request->attributes->set('consent', $consent);
        view()->share('consent', $consent);

        return $next($request);
    }
}
```

```php
// File: app/Http/Controllers/ConsentController.php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ConsentLog;

class ConsentController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'analytics' => 'required|boolean',
            'marketing' => 'required|boolean',
        ]);

        $consent = [
            'necessary' => true,
            'analytics' => $validated['analytics'],
            'marketing' => $validated['marketing'],
            'version' => '1.0',
            'timestamp' => now()->toIso8601String(),
        ];

        // Server-Log fuer Nachweispflicht
        ConsentLog::create([
            'ip_hash' => substr(hash('sha256', $request->ip() . config('app.ip_hash_salt')), 0, 16),
            'user_agent' => substr($request->userAgent() ?? '', 0, 200),
            'consent' => $consent,
        ]);

        return response()->noContent()
            ->cookie(
                'cookie_consent',
                json_encode($consent),
                60 * 24 * 365,        // 12 Monate (Minuten)
                '/',                  // Path
                null,                 // Domain
                config('app.env') === 'production',  // Secure
                false,                // HttpOnly = false (Banner-JS muss lesen)
                false,                // Raw
                'lax'                 // SameSite
            );
    }
}
```

```blade
{{-- File: resources/views/cookies/banner.blade.php --}}
@if(! request()->cookie('cookie_consent'))
<aside id="cookie-banner" role="dialog" aria-label="Cookie-Einwilligung" class="cookie-banner">
    <p>
        Wir nutzen Cookies fuer notwendige Funktionen und mit Ihrer Einwilligung
        zusaetzlich fuer Webanalyse. Details:
        <a href="{{ route('legal.privacy') }}">Datenschutzerklaerung</a>.
    </p>
    <div class="cookie-actions">
        <button type="button" data-action="reject-all" class="btn-secondary">
            Nur Notwendige
        </button>
        <button type="button" data-action="accept-all" class="btn-primary">
            Alle akzeptieren
        </button>
    </div>
</aside>

<script>
(function() {
    const csrf = '{{ csrf_token() }}';
    const submit = (analytics, marketing) => {
        fetch('{{ route('consent.store') }}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf,
            },
            body: JSON.stringify({ analytics, marketing }),
        }).then(() => {
            document.getElementById('cookie-banner').remove();
            if (analytics) loadAnalytics();
        });
    };

    document.querySelector('[data-action="reject-all"]').onclick = () => submit(false, false);
    document.querySelector('[data-action="accept-all"]').onclick = () => submit(true, true);

    function loadAnalytics() {
        const s = document.createElement('script');
        s.src = 'https://<placeholder-eu-analytics-host>/script.js';
        s.async = true;
        document.head.appendChild(s);
    }
})();
</script>
@endif
```

```blade
{{-- File: resources/views/layouts/app.blade.php --}}
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', '<placeholder-site-name>')</title>
    {{-- KEIN Tracker-Script hier — nur conditional nach Consent --}}
    @if($consent['analytics'] ?? false)
        <script src="https://<placeholder-eu-analytics-host>/script.js" async></script>
    @endif
</head>
<body>
    @yield('content')
    @include('cookies.banner')
</body>
</html>
```

```php
// File: app/Http/Kernel.php (Auszug)
protected $middlewareGroups = [
    'web' => [
        \App\Http\Middleware\EncryptCookies::class,
        // ...
        \App\Http\Middleware\ConsentCookie::class,
    ],
];

// File: app/Http/Middleware/EncryptCookies.php
protected $except = [
    'cookie_consent',  // Banner-JS muss lesen koennen → kein Encryption
];
```

## AVV / DPA

- Hosting-Provider — Art. 28 DSGVO
- Datenbank-Provider (MySQL/Postgres) — AVV
- Analytics-Provider (Plausible EU / Matomo) — AVV
- Mailer (SES EU / Mailgun EU) — AVV

## DSE-Wording-Vorlage

```markdown
### Cookies (Laravel)

Diese Webseite verwendet folgende Cookies:

**Notwendige Cookies (kein Opt-Out moeglich):**
- `XSRF-TOKEN` — CSRF-Schutz, Session-Dauer
- `<placeholder-app-name>_session` — Session-Management, Session-Dauer
- `cookie_consent` — Speicherung Ihrer Einwilligung, 12 Monate

**Analyse-Cookies (Opt-In):**
- `<placeholder-analytics-cookie>` — Webanalyse, <placeholder-days> Tage
- Anbieter: <placeholder-analytics-provider>, EU-Hosting

**Marketing-Cookies (Opt-In):**
- aktuell keine, ggf. zukuenftig

**Rechtsgrundlage:** § 25 TDDDG i.V.m. Art. 6 Abs. 1 lit. a/f DSGVO.
**Widerruf:** [Cookie-Einstellungen](#cookie-settings) im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Banner sichtbar fuer neue Visitors
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner"

# 2. cookie_consent in EncryptCookies-Bypass
curl -X POST https://<placeholder-domain>/consent \
  -H "Content-Type: application/json" \
  -H "X-CSRF-TOKEN: <placeholder-csrf>" \
  -d '{"analytics":false,"marketing":false}' -i \
  | grep -i "set-cookie:.*cookie_consent"
# Erwartung: Klartext-JSON, NICHT Laravel-encrypted

# 3. Tracker-Script erst nach Consent
curl -sS -H 'Cookie: cookie_consent=%7B%22analytics%22%3Afalse%7D' https://<placeholder-domain>/ \
  | grep -ic "<placeholder-eu-analytics-host>"
# Erwartung: 0

curl -sS -H 'Cookie: cookie_consent=%7B%22analytics%22%3Atrue%7D' https://<placeholder-domain>/ \
  | grep -ic "<placeholder-eu-analytics-host>"
# Erwartung: >=1

# 4. Session-Cookie mit Lax + Secure
curl -sI https://<placeholder-domain>/ | grep -iE "set-cookie:.*session.*lax.*secure"
```

## Cross-References

- AEGIS-Scanner: `cookie-flags-checker.ts`, `consent-flow-checker.ts`, `tracking-scan.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- OLG Koeln 6 U 80/23 (Button-Gleichwertigkeit)
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
