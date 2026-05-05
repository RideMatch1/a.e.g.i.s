---
license: MIT (snippet)
provider: Ruby on Rails + Sidekiq (Open-Source)
last-checked: 2026-05-05
purpose: Sidekiq-Worker-Pattern fuer asynchrone Anonymisierung + Hard-Delete-Cron.
---

# Rails — GDPR-Anonymisierungs-Worker (Sidekiq-Pattern)

## Trigger / Detection

Repo enthaelt:
- `gem 'sidekiq'` in `Gemfile`
- `app/workers/` oder `app/jobs/` Verzeichnis
- `Sidekiq::Worker` / `ActiveJob::Base` Subclasses
- Optional: `gem 'sidekiq-cron'` / `gem 'whenever'` fuer Cron-Scheduling

## Default-Verhalten (was passiert ohne Konfiguration)

- Account-Loeschung erfolgt synchron im Request → Timeout-Risiko
- Anonymisierung uebersieht abhaengige Records (Activity, Comments, Uploads)
- Search-Index (Elasticsearch / Algolia) wird nicht synchron mit DB-Loeschung geupdatet
- Soft-Deletes haeufen sich → Storage-Kosten + DSGVO-Drift
- Sidekiq-Logs enthalten Klartext-PII bei Job-Args

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Search-Index nicht ge-updated | Art. 17 DSGVO | KRITISCH | Worker triggert `unsearchable!` |
| Sidekiq-Args mit User-PII (Email/Name) | Art. 5 lit. c | HOCH | Nur User-ID als Arg, Lookup im Worker |
| Hard-Delete-Cron fehlt | Art. 5 lit. e | KRITISCH | `sidekiq-cron` mit taeglicher Schedule |
| Job-Failure unbemerkt | Art. 5 Abs. 2 | HOCH | Sidekiq-Web + Alert-Hook |
| Backup-Files nicht rotated | Art. 5 lit. e | HOCH | Backup-Provider-Policy + Doku |

## Code-Pattern (sanitized)

```ruby
# File: app/workers/gdpr/anonymize_user_worker.rb
module Gdpr
  class AnonymizeUserWorker
    include Sidekiq::Worker

    sidekiq_options queue: 'gdpr', retry: 3, backtrace: true

    def perform(user_id, reason = nil)
      user = User.with_deleted.find_by(id: user_id)
      return unless user

      ActiveRecord::Base.transaction do
        # 1. PII anonymisieren
        user.anonymize!

        # 2. Audit-Log
        UserAuditLog.create!(
          user: user,
          action: 'account_deletion',
          ip_hash: nil,
          user_agent: 'GDPR-Worker',
          occurred_at: Time.current,
          metadata: { reason: reason }.to_json
        )

        # 3. Search-Index entfernen
        user.unsearchable! if user.respond_to?(:unsearchable!)

        # 4. Cascade-Anonymisierung auf abhaengige Records
        user.comments.update_all(author_name: 'GELOESCHT')
        user.uploads.find_each(&:purge)

        # 5. Soft-Delete setzen (falls noch nicht)
        user.update!(deleted_at: Time.current) unless user.deleted_at

        # 6. Hard-Delete via separatem Cron in 30 Tagen
      end

      Rails.logger.info "[GDPR] User #{user_id} anonymized"
    rescue => e
      Rails.logger.error "[GDPR] Anonymization failed for #{user_id}: #{e.message}"
      raise  # Sidekiq retry
    end
  end
end
```

```ruby
# File: app/workers/gdpr/hard_delete_worker.rb
module Gdpr
  class HardDeleteWorker
    include Sidekiq::Worker

    sidekiq_options queue: 'gdpr', retry: 3

    HARD_DELETE_GRACE_PERIOD = 30.days

    def perform
      cutoff = HARD_DELETE_GRACE_PERIOD.ago

      User.with_deleted.where('deleted_at < ?', cutoff).find_each do |user|
        ActiveRecord::Base.transaction do
          # Cascade-Loeschung
          user.user_audit_logs.delete_all  # Audit-Log raus
          user.comments.delete_all
          user.uploads.find_each(&:destroy!)
          user.user_legal_acceptances.delete_all

          # Hard-Delete
          user.really_destroy!  # paranoia-gem
        end

        Rails.logger.info "[GDPR] User #{user.id} hard-deleted"
      end

      # Cron-Run-Tracking
      CronRun.create!(
        job_name: 'gdpr-hard-delete',
        finished_at: Time.current,
        status: 'success'
      )
    rescue => e
      CronRun.create!(
        job_name: 'gdpr-hard-delete',
        finished_at: Time.current,
        status: 'failed',
        error: e.message
      )
      raise
    end
  end
end
```

```ruby
# File: app/workers/gdpr/inactive_user_cleanup_worker.rb
module Gdpr
  class InactiveUserCleanupWorker
    include Sidekiq::Worker

    sidekiq_options queue: 'gdpr', retry: 3

    INACTIVITY_PERIOD = 2.years

    def perform
      cutoff = INACTIVITY_PERIOD.ago

      User.where('current_sign_in_at < ? AND deleted_at IS NULL', cutoff)
          .where(consent_inactivity_warning_sent_at: nil)
          .find_each(batch_size: 100) do |user|
        # Erste Stufe: Warning-Mail
        UserMailer.inactivity_warning(user).deliver_later
        user.update!(consent_inactivity_warning_sent_at: Time.current)
      end

      # Zweite Stufe: User die bereits gewarnt + 30 Tage spaeter immer noch inaktiv
      User.where('consent_inactivity_warning_sent_at < ?', 30.days.ago)
          .where('current_sign_in_at < ?', cutoff)
          .where(deleted_at: nil)
          .find_each do |user|
        Gdpr::AnonymizeUserWorker.perform_async(user.id, 'inactivity_2_years')
        user.update!(deleted_at: Time.current)
      end
    end
  end
end
```

```ruby
# File: config/sidekiq_cron.yml
gdpr_hard_delete:
  cron: '0 3 * * *'  # Taeglich 3 Uhr UTC
  class: 'Gdpr::HardDeleteWorker'

gdpr_inactive_cleanup:
  cron: '0 4 * * 0'  # Sonntag 4 Uhr UTC
  class: 'Gdpr::InactiveUserCleanupWorker'

analytics_events_cleanup:
  cron: '0 5 * * *'
  class: 'AnalyticsEventCleanupWorker'
```

```ruby
# File: config/initializers/sidekiq.rb
Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch('REDIS_URL') }

  # Sidekiq-Cron-Schedule laden
  if File.exist?(Rails.root.join('config/sidekiq_cron.yml'))
    schedule = YAML.load_file(Rails.root.join('config/sidekiq_cron.yml'))
    Sidekiq::Cron::Job.load_from_hash(schedule)
  end

  # Args-Filtering: PII niemals in Logs
  config.logger.formatter = lambda do |severity, time, prog, msg|
    # Strip Email-Patterns
    safe_msg = msg.to_s.gsub(/[\w.+-]+@[\w-]+\.[\w-]+/, '[EMAIL_REDACTED]')
    "#{time.iso8601} [#{severity}] #{safe_msg}\n"
  end
end
```

```ruby
# File: app/controllers/gdpr_controller.rb
class GdprController < ApplicationController
  before_action :authenticate_user!

  def destroy_account
    reason = params[:reason]&.first(500)

    # Synchron: nur Soft-Delete + Logout
    current_user.update!(deleted_at: Time.current, deletion_reason: reason)

    # Async: Anonymisierung
    Gdpr::AnonymizeUserWorker.perform_async(current_user.id, reason)

    sign_out current_user
    render json: {
      status: 'PENDING_HARD_DELETE',
      soft_deleted_at: Time.current.iso8601,
      hard_delete_scheduled: '30 Tage'
    }, status: :accepted
  end
end
```

## AVV / DPA

- Datenbank — AVV mit Hard-Delete-Wirksamkeit
- Sidekiq-Redis (Upstash EU / Redis Cloud EU) — AVV
- Search-Index (Algolia / Meilisearch) — AVV + Index-Sync-Garantie
- Mailer fuer Warning-Mails — AVV

## DSE-Wording-Vorlage

```markdown
### Loesch-Workflow und Inaktivitaets-Cleanup

**Bei Loesch-Antrag (manuell):**

1. Sofort: Account deaktiviert, ausgeloggt
2. Sofort (asynchron): PII anonymisiert, Search-Index entfernt, Comments
   anonymisiert, Uploads geloescht
3. Nach 30 Tagen: Endgueltige Loeschung aus Datenbank

**Bei Inaktivitaet (automatisch):**

1. Nach 2 Jahren ohne Login: Erinnerungs-Mail
2. 30 Tage nach Erinnerungs-Mail (immer noch keine Aktivitaet):
   automatischer Loesch-Workflow
3. Hard-Delete folgt nach weiteren 30 Tagen

**Rechtsgrundlage:** Art. 5 lit. e DSGVO (Speicherbegrenzung), Art. 17 DSGVO
(Recht auf Loeschung).
```

## Verify-Commands (Live-Probe)

```bash
# 1. Sidekiq-Web-Health
curl https://<placeholder-domain>/sidekiq/cron
# Erwartung: aktivitaet aller Cron-Jobs sichtbar

# 2. Anonymize-Worker manuell anstossen
bundle exec rails console
# > Gdpr::AnonymizeUserWorker.perform_async(<test-user-id>, 'test')
# > Sidekiq::Queue.new('gdpr').size  # Erwartung: 1, dann 0 nach Verarbeitung

# 3. Job-Logs ohne PII
tail -100 log/sidekiq.log | grep -E '[\w.+-]+@[\w-]+\.[\w-]+' | head -5
# Erwartung: 0 Treffer oder ausschliesslich [EMAIL_REDACTED]

# 4. Hard-Delete nach 30 Tagen wirksam
# DB-Query: SELECT COUNT(*) FROM users WHERE deleted_at < now() - interval '30 days';
# Erwartung: 0
```

## Cross-References

- AEGIS-Scanner: `data-retention-checker.ts`, `cron-coverage-checker.ts`, `pii-anonymization-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 17, Art. 5 lit. e
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- EuGH: `references/eu-eugh-dsgvo-schadensersatz.md` (Loesch-Anspruch)
- Audit-Pattern: `references/audit-patterns.md` Phase 4 (DSE-Drift / Cron-Coverage)
