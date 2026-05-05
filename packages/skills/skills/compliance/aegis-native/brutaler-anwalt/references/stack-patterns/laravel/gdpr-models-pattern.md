---
license: MIT (snippet)
provider: Laravel + Eloquent (Open-Source)
last-checked: 2026-05-05
purpose: Laravel Soft-Deletes + Anonymization-Trait fuer DSGVO-Loeschpflicht.
---

# Laravel — GDPR-Models Pattern (Soft-Deletes + Anonymization)

## Trigger / Detection

Repo enthaelt:
- `Illuminate\Database\Eloquent\SoftDeletes` Trait in Models
- `deleted_at` Spalte in Migrations
- User-Model mit PII (email, name, phone, address)
- Optional: `App\Traits\Anonymizable` Trait

## Default-Verhalten (was passiert ohne Konfiguration)

- Eloquent `delete()` → soft-delete, ABER PII bleibt unverschleiert
- `restore()` macht Geloeschtes wieder verfuegbar → DSGVO-Konflikt
- Cascade-Delete vergisst Logs / Activity-Streams
- `forceDelete()` umgeht Anonymisierung → harter Drop ohne Audit
- Kein Hard-Delete-Cron → Soft-Deletes haeufen sich

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Soft-Deleted PII bleibt klartext-lesbar | Art. 17 DSGVO | KRITISCH | Anonymisierung im `delete()`-Hook |
| Cascade-Delete vergisst Logs | Art. 17 DSGVO | HOCH | Observer + verwandte Modelle |
| `restore()` reaktiviert geloeschten User | Art. 17 DSGVO | HOCH | `restore()` ueberschreiben, nur Admin |
| Kein Hard-Delete-Cron | Art. 5 lit. e DSGVO | KRITISCH | Cron mit 30T-Frist |
| Anonymisierung umgehbar | Art. 32 DSGVO | HOCH | Trait erzwingt PII-Override |

## Code-Pattern (sanitized)

```php
// File: app/Traits/Anonymizable.php
<?php

namespace App\Traits;

use Illuminate\Support\Str;

trait Anonymizable
{
    /**
     * Subclasses MUSS $anonymizableFields definieren.
     * @return array<string, string|callable>  // field => Wert oder Closure
     */
    abstract protected function anonymizableFields(): array;

    public function anonymize(): void
    {
        foreach ($this->anonymizableFields() as $field => $value) {
            $this->{$field} = is_callable($value) ? $value($this) : $value;
        }
        $this->save();
    }
}
```

```php
// File: app/Models/User.php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Anonymizable;

class User extends Authenticatable
{
    use SoftDeletes, Anonymizable;

    protected $fillable = ['email', 'name', 'phone', 'address'];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'deleted_at' => 'datetime',
        'last_login_at' => 'datetime',
    ];

    protected function anonymizableFields(): array
    {
        return [
            'email' => fn(self $u) => "deleted-{$u->id}@<placeholder-domain>",
            'name' => 'GELOESCHT',
            'phone' => null,
            'address' => null,
            'avatar_url' => null,
            // Pflicht: ID muss erhalten bleiben fuer Audit-Trail
        ];
    }

    public function softDeleteWithAnonymization(?string $reason = null): void
    {
        $this->anonymize();
        $this->deletion_reason = $reason;
        $this->delete();  // Soft-Delete (deleted_at gesetzt)
    }

    /**
     * Hard-Delete nur durch Cron (siehe gdpr-cleanup-cron.md)
     */
    public function forceDeleteAllowed(): bool
    {
        return $this->deleted_at !== null
            && $this->deleted_at->lt(now()->subDays(30));
    }

    public function restore(): bool
    {
        // Verhindere unbedachten Restore
        throw new \RuntimeException(
            'User-Restore ist DSGVO-relevant — nur via Admin-Workflow erlaubt'
        );
    }
}
```

```php
// File: database/migrations/2026_05_05_add_deletion_columns.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
            $table->timestamp('last_login_at')->nullable();
            $table->string('deletion_reason', 500)->nullable();
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['last_login_at', 'deletion_reason']);
        });
    }
};
```

```php
// File: app/Observers/UserObserver.php
<?php

namespace App\Observers;

use App\Models\User;
use App\Models\ActivityLog;
use App\Models\PaymentMethod;

class UserObserver
{
    public function deleting(User $user): void
    {
        if ($user->isForceDeleting()) {
            // Hard-Delete: Cascade auf abhaengige Tabellen
            ActivityLog::where('user_id', $user->id)->delete();
            PaymentMethod::where('user_id', $user->id)->delete();
            // Search-Index entfernen
            $user->unsearchable();
            // S3-Avatare loeschen
            \Storage::disk('s3')->delete("avatars/{$user->id}.jpg");
        }
    }
}
```

```php
// File: app/Providers/AppServiceProvider.php
<?php

namespace App\Providers;

use App\Models\User;
use App\Observers\UserObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        User::observe(UserObserver::class);
    }
}
```

```php
// File: app/Http/Controllers/Gdpr/DeleteAccountController.php
<?php

namespace App\Http\Controllers\Gdpr;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class DeleteAccountController extends Controller
{
    public function destroy(Request $request)
    {
        $user = $request->user();
        $reason = $request->input('reason');

        $user->softDeleteWithAnonymization($reason);

        // Logout
        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'status' => 'PENDING_HARD_DELETE',
            'soft_deleted_at' => now()->toIso8601String(),
            'hard_delete_scheduled' => 'in 30 Tagen',
        ], 202);
    }
}
```

## AVV / DPA

- Datenbank — Hard-Delete-Wirksamkeit garantiert
- Search-Provider (Algolia / Meilisearch) — Index-Sync-Garantie via Observer
- File-Storage (S3 / Bunny) — Cascade-Delete via Observer

## DSE-Wording-Vorlage

```markdown
### Loeschverfahren bei Account-Loeschung

Bei Beantragung Ihrer Loeschung erfolgt ein zwei-stufiger Prozess:

**Stufe 1 — Sofortige Anonymisierung (Soft-Delete):**
- E-Mail wird zu `deleted-{ID}@<placeholder-domain>` ueberschrieben
- Name wird zu "GELOESCHT" gesetzt
- Telefon, Adresse, Avatar werden geloescht
- Account wird deaktiviert
- Sie werden ausgeloggt

**Stufe 2 — Endgueltige Loeschung (Hard-Delete) nach 30 Tagen:**
- Account-Datensatz wird komplett aus der Datenbank entfernt
- Verbundene Aktivitaets-Logs, Bezahl-Methoden, Avatare werden geloescht
- Eintraege in Such-Indexen werden entfernt
- Backup-Dateien werden via Standard-Rotation automatisch ueberschrieben

**30-Tage-Frist:** Dient dem Schutz vor versehentlicher Loeschung
(Widerruf moeglich bis zum Hard-Delete).

**Rechtsgrundlage:** Art. 17 DSGVO (Recht auf Loeschung).
```

## Verify-Commands (Live-Probe)

```bash
# 1. Soft-Delete anonymisiert PII sofort
# DB-Query nach Test-Loeschung:
# SELECT email, name, deleted_at FROM users WHERE id = '<test-id>';
# Erwartung: email = "deleted-{id}@..." , name = "GELOESCHT", deleted_at != NULL

# 2. restore() blockt
# php artisan tinker → User::onlyTrashed()->first()->restore();
# Erwartung: RuntimeException

# 3. Hard-Delete via Cron-Test
# php artisan gdpr:hard-delete --dry-run
# Erwartung: Liste der Soft-Deleted-User > 30 Tage

# 4. Cascade-Delete via Observer
# Hard-Delete Test-User; pruefe activity_logs.user_id = test-id COUNT(*) = 0
```

## Cross-References

- AEGIS-Scanner: `soft-delete-checker.ts`, `cascade-delete-checker.ts`, `pii-anonymization-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 17 (Loeschung), Art. 5 lit. e (Speicherbegrenzung)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- EuGH: `references/eu-eugh-dsgvo-schadensersatz.md` (Loeschanspruch)
- Audit-Pattern: `references/audit-patterns.md` Phase 8 (Betroffenenrechte), Phase 4 (DSE-Drift)
