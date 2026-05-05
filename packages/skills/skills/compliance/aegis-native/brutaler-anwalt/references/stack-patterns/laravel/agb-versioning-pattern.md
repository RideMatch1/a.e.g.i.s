---
license: MIT (snippet)
provider: Laravel + Spatie/Versionable (Open-Source)
last-checked: 2026-05-05
purpose: Laravel AGB-/DSE-Versioning-Pattern fuer Nachweis von Vertragsversionen je User.
---

# Laravel — AGB/DSE-Versioning Pattern

## Trigger / Detection

Repo enthaelt:
- `spatie/laravel-versionable` oder `tightenco/ziggy-versionable` Package
- Models mit `Versionable` Trait
- Tabellen `agb_versions`, `privacy_versions`, `consent_versions`
- Optional: User-Tabelle mit `current_agb_version` Column

## Default-Verhalten (was passiert ohne Konfiguration)

- AGB-aenderungen erfolgen direkt in `resources/views/legal/agb.blade.php` ohne Versionierung
- User-Akzeptanz wird beim Signup gespeichert, aber Version unbekannt
- Bei spaeteren AGB-aenderungen kein Re-Confirm-Workflow → Vertrag-Drift
- Audit-Trail "Welcher User akzeptierte welche Version wann" fehlt
- DSE-aenderung ohne Banner-Re-Show → User merkt es nicht

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Kein Versions-Nachweis | Art. 5 Abs. 2 DSGVO Rechenschaft | KRITISCH | Versions-Tabelle mit Hash + Date |
| AGB-Drift ohne Re-Confirm | § 305 BGB Wirksamkeit | KRITISCH | Banner bei jeder Major-Version |
| Privacy-Update ohne Notification | Art. 13/14 DSGVO | HOCH | E-Mail + Banner-Force-Show |
| Hash-Manipulation moeglich | Art. 32 DSGVO | MITTEL | Append-Only Tabelle + DB-Trigger |
| Keine Diff-Sichtbarkeit fuer User | Art. 12 DSGVO Klarheit | MITTEL | Diff-Page `/datenschutz/diff?from=2.0&to=2.3` |

## Code-Pattern (sanitized)

```php
// File: database/migrations/2026_05_05_create_legal_versions.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('legal_versions', function (Blueprint $table) {
            $table->id();
            $table->string('section', 32);  // 'agb', 'privacy', 'cookie'
            $table->string('version', 16);  // '2.3'
            $table->text('content');
            $table->string('content_hash', 64);  // SHA-256
            $table->string('author', 100);
            $table->timestamp('published_at');
            $table->boolean('is_major')->default(false);
            $table->timestamps();

            $table->unique(['section', 'version']);
            $table->index(['section', 'published_at']);
        });

        Schema::create('user_legal_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('legal_version_id')->constrained();
            $table->string('ip_hash', 16);
            $table->string('user_agent', 200);
            $table->timestamp('accepted_at');
            $table->timestamps();

            $table->unique(['user_id', 'legal_version_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_legal_acceptances');
        Schema::dropIfExists('legal_versions');
    }
};
```

```php
// File: app/Models/LegalVersion.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LegalVersion extends Model
{
    protected $fillable = ['section', 'version', 'content', 'content_hash', 'author', 'published_at', 'is_major'];

    protected $casts = [
        'published_at' => 'datetime',
        'is_major' => 'boolean',
    ];

    public function acceptances()
    {
        return $this->hasMany(UserLegalAcceptance::class);
    }

    protected static function booted()
    {
        // Append-Only: kein Update, kein Delete
        static::updating(function () {
            throw new \RuntimeException('LegalVersion ist append-only (Beweisfunktion)');
        });
        static::deleting(function () {
            throw new \RuntimeException('LegalVersion ist append-only');
        });

        // Hash automatisch berechnen
        static::creating(function (self $model) {
            $model->content_hash = hash('sha256', $model->content);
        });
    }

    public static function latest(string $section): ?self
    {
        return self::where('section', $section)
            ->orderByDesc('published_at')
            ->first();
    }
}
```

```php
// File: app/Models/UserLegalAcceptance.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserLegalAcceptance extends Model
{
    protected $fillable = ['user_id', 'legal_version_id', 'ip_hash', 'user_agent', 'accepted_at'];

    protected $casts = ['accepted_at' => 'datetime'];

    protected static function booted()
    {
        static::updating(function () {
            throw new \RuntimeException('Acceptance ist append-only');
        });
        static::deleting(function () {
            // Erlaubt nur Cascade von User::forceDelete (Hard-Delete-Cron)
            if (!app()->runningInConsole()) {
                throw new \RuntimeException('Acceptance darf nur via Cron geloescht werden');
            }
        });
    }
}
```

```php
// File: app/Http/Middleware/EnforceLatestLegal.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\LegalVersion;
use App\Models\UserLegalAcceptance;

class EnforceLatestLegal
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (!$user) return $next($request);

        // Pruefe nur major-versions
        $latestAgb = LegalVersion::latest('agb');
        $latestPrivacy = LegalVersion::latest('privacy');

        $missingAcceptances = [];

        foreach (['agb' => $latestAgb, 'privacy' => $latestPrivacy] as $section => $version) {
            if (!$version || !$version->is_major) continue;

            $accepted = UserLegalAcceptance::where('user_id', $user->id)
                ->where('legal_version_id', $version->id)
                ->exists();

            if (!$accepted) {
                $missingAcceptances[] = $section;
            }
        }

        if (!empty($missingAcceptances) && !$request->is('legal/accept*')) {
            return redirect()->route('legal.accept-required', [
                'sections' => implode(',', $missingAcceptances),
            ]);
        }

        return $next($request);
    }
}
```

```php
// File: app/Http/Controllers/LegalAcceptanceController.php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\LegalVersion;
use App\Models\UserLegalAcceptance;

class LegalAcceptanceController extends Controller
{
    public function accept(Request $request)
    {
        $request->validate([
            'sections' => 'required|array',
            'sections.*' => 'in:agb,privacy,cookie',
        ]);

        $user = $request->user();
        $ipHash = substr(hash('sha256', $request->ip() . config('app.ip_hash_salt')), 0, 16);

        foreach ($request->input('sections') as $section) {
            $version = LegalVersion::latest($section);
            if (!$version) continue;

            UserLegalAcceptance::firstOrCreate([
                'user_id' => $user->id,
                'legal_version_id' => $version->id,
            ], [
                'ip_hash' => $ipHash,
                'user_agent' => substr($request->userAgent() ?? '', 0, 200),
                'accepted_at' => now(),
            ]);
        }

        return response()->noContent();
    }
}
```

## AVV / DPA

- Datenbank — append-only-Garantie via DB-Trigger optional ergaenzen
- Mailer fuer Notification-Mails — AVV
- Diff-Service (sofern external z.B. Diff2HTML) — kein AVV wenn nur public-Texte verglichen werden

## DSE-Wording-Vorlage

```markdown
### Versions-Historie und Aktualisierungen

Wir versionieren unsere Datenschutzerklaerung und AGB nachvollziehbar:

**Aktuelle Versionen:**
- Datenschutzerklaerung: Version <placeholder-version>, Stand <placeholder-date>
- AGB: Version <placeholder-version>, Stand <placeholder-date>

**Frueher veroeffentlichte Versionen:** auf Anfrage verfuegbar (E-Mail an
<placeholder-email>) — wir koennen den genauen Wortlaut zum Zeitpunkt
Ihrer Registrierung jederzeit nachweisen (SHA-256-Hash gespeichert).

**Bei wesentlichen aenderungen** (Major-Version) bitten wir Sie beim
naechsten Login um erneute Zustimmung. Bis zur Bestaetigung wird Ihr
Account auf den Bestaetigungs-Workflow umgeleitet.

**Rechtsgrundlage:** § 305 BGB (Wirksame Einbeziehung von AGB) i.V.m.
Art. 5 Abs. 2 DSGVO (Rechenschaftspflicht).
```

## Verify-Commands (Live-Probe)

```bash
# 1. Hash-Wirksamkeit pruefen
php artisan tinker
# > $v = LegalVersion::first(); hash('sha256', $v->content) === $v->content_hash;
# Erwartung: true

# 2. Append-only-Schutz
# > $v->content = 'modified'; $v->save();
# Erwartung: RuntimeException

# 3. Re-Confirm-Workflow
# Setze neue is_major-Version, login als User, navigiere zu /dashboard
# Erwartung: Redirect zu /legal/accept-required?sections=agb

# 4. Audit-Log-Vollstaendigkeit
# DB-Query: SELECT user_id, legal_version_id, accepted_at FROM user_legal_acceptances WHERE user_id = '<test>';
# Erwartung: Eintrag pro Major-Version
```

## Cross-References

- AEGIS-Scanner: `legal-versioning-checker.ts`, `audit-trail-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 5 Abs. 2 (Rechenschaft), Art. 13/14 (Information)
- BGB: § 305 (Einbeziehung AGB)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 1 (DSE-Vollstaendigkeit), Phase 8 (Re-Confirm)
