---
license: MIT (snippet)
provider: Ruby on Rails + Devise (Open-Source)
last-checked: 2026-05-05
purpose: Devise + § 26 BDSG-konforme User-Verwaltung mit Audit-Trail.
---

# Rails + Devise — DSGVO-Pattern

## Trigger / Detection

Repo enthaelt:
- `gem 'devise'` in `Gemfile`
- `app/models/user.rb` mit `devise :database_authenticatable, ...`
- `config/initializers/devise.rb`
- Migration mit `:lockable, :trackable, :timeoutable` Feldern
- Optional: `gem 'pundit'` / `gem 'cancancan'` fuer Authorization

## Default-Verhalten (was passiert ohne Konfiguration)

- Devise loggt `last_sign_in_ip`, `current_sign_in_ip` als Klartext → Art. 5 lit. f Verstoss
- Default-Confirmable-Token-Lifetime ungesetzt → unbegrenzte Confirmation-Tokens
- Failed-Login-Errors leaken User-Existence ("Email not found")
- Default-Password-Length 6 Zeichen → zu schwach
- `:rememberable` ohne Expiration → Permanent-Sessions

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| `last_sign_in_ip` Klartext | Art. 5 lit. f DSGVO | KRITISCH | Custom-Setter mit Hash |
| User-Enumeration via Devise-Errors | Art. 32 DSGVO | HOCH | `paranoid: true` setzen |
| Password-Length 6 | Art. 32 DSGVO | HOCH | `password_length: 12..128` |
| Remember-Me unbegrenzt | Art. 32 DSGVO | MITTEL | `remember_for: 14.days` |
| Audit-Log fuer Account-aenderungen fehlt | Art. 5 Abs. 2 | HOCH | `audited` Gem oder Custom |
| `current_password`-Check fuer kritische Aktionen | Art. 32 DSGVO | HOCH | `before_action :require_recent_auth` |

## Code-Pattern (sanitized)

```ruby
# File: config/initializers/devise.rb
Devise.setup do |config|
  config.mailer_sender = '<placeholder-noreply-email>'

  config.password_length = 12..128

  # Bestaetigungs-Token: 7 Tage, danach abgelaufen
  config.confirm_within = 7.days

  # Lockable: 5 Versuche, 30 Minuten Lock
  config.maximum_attempts = 5
  config.unlock_in = 30.minutes
  config.unlock_strategy = :time

  # Timeoutable: Auto-Logout nach 60 min Inaktivitaet
  config.timeout_in = 60.minutes

  # Rememberable: max. 14 Tage
  config.remember_for = 14.days
  config.expire_all_remember_me_on_sign_out = true

  # paranoid: kein User-Enumeration via Reset-Password-Form
  config.paranoid = true

  # Argon2 / bcrypt-Cost auf >= 12
  config.stretches = Rails.env.test? ? 1 : 12

  # Reset-Password-Token: 6 Stunden
  config.reset_password_within = 6.hours
end
```

```ruby
# File: app/models/user.rb
class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :confirmable, :lockable, :timeoutable, :trackable

  has_many :user_audit_logs, dependent: :destroy
  has_many :user_legal_acceptances, dependent: :destroy

  validates :name, length: { maximum: 100 }, allow_blank: true

  # Anonymisierungs-Felder ueberschreiben statt loeschen
  def anonymize!
    update!(
      email: "deleted-#{id}@<placeholder-domain>",
      name: 'GELOESCHT',
      phone: nil,
      last_sign_in_ip_hash: nil,
      current_sign_in_ip_hash: nil,
      sign_in_count: 0
    )
  end

  # Hash IP statt Klartext (override Devise-Default)
  def update_tracked_fields!(request)
    super
    self.current_sign_in_ip = nil  # explicit nil
    self.last_sign_in_ip = nil
    self.current_sign_in_ip_hash = ip_hash(request.remote_ip)
    save(validate: false)
  end

  private

  def ip_hash(ip)
    return nil if ip.blank?
    salt = Rails.application.credentials.dig(:ip_hash_salt) || ''
    Digest::SHA256.hexdigest(ip + salt)[0...16]
  end
end
```

```ruby
# File: db/migrate/2026_05_05_add_dsgvo_fields_to_users.rb
class AddDsgvoFieldsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :current_sign_in_ip_hash, :string, limit: 16
    add_column :users, :last_sign_in_ip_hash, :string, limit: 16
    add_column :users, :anonymized_at, :datetime
    add_index :users, :anonymized_at

    # Loesche Klartext-IP-Felder (oder lasse sie als deprecated)
    # remove_column :users, :current_sign_in_ip, :inet  # vorsichtig!
  end
end
```

```ruby
# File: app/models/user_audit_log.rb
class UserAuditLog < ApplicationRecord
  belongs_to :user

  validates :action, presence: true, inclusion: {
    in: %w[
      sign_in sign_out registration confirmation password_change
      email_change profile_update consent_change account_deletion
    ]
  }

  before_destroy { raise 'Audit-Log ist append-only' }

  def self.log!(user, action, ip:, user_agent:)
    salt = Rails.application.credentials.dig(:ip_hash_salt) || ''
    create!(
      user: user,
      action: action,
      ip_hash: Digest::SHA256.hexdigest((ip || '') + salt)[0...16],
      user_agent: (user_agent || '').first(200),
      occurred_at: Time.current
    )
  end
end
```

```ruby
# File: app/controllers/users/sessions_controller.rb
class Users::SessionsController < Devise::SessionsController
  def create
    super do |user|
      UserAuditLog.log!(user, 'sign_in', ip: request.remote_ip, user_agent: request.user_agent)
    end
  end

  def destroy
    user = current_user
    super do
      UserAuditLog.log!(user, 'sign_out', ip: request.remote_ip, user_agent: request.user_agent) if user
    end
  end
end
```

```ruby
# File: app/controllers/concerns/recent_auth_concern.rb
module RecentAuthConcern
  extend ActiveSupport::Concern

  RECENT_AUTH_WINDOW = 5.minutes

  def require_recent_auth
    return if recent_auth?
    session[:return_to] = request.fullpath
    redirect_to new_user_confirm_password_path,
                alert: 'Bitte bestaetigen Sie Ihr Passwort erneut'
  end

  def recent_auth?
    session[:recent_auth_at].present? &&
      Time.zone.at(session[:recent_auth_at]) > RECENT_AUTH_WINDOW.ago
  end
end
```

## AVV / DPA

- Datenbank (Postgres EU) — AVV mit IP-Hash-Garantie
- Mailer (SES EU / Postmark / Mailgun EU) — AVV
- Optional: SSO-Provider (Auth0 EU / Keycloak self-host) — AVV mit Drittland-TIA

## DSE-Wording-Vorlage

```markdown
### Account-Anlage und Anmeldung

Bei Registrierung und Anmeldung verarbeiten wir folgende Daten:

- E-Mail-Adresse (Pflichtfeld, zur Identifizierung)
- Name (optional)
- Passwort (gespeichert als bcrypt-Hash mit Cost-Faktor 12)
- Hash der IP-Adresse (zur Brute-Force-Erkennung; SHA-256 mit Salt, 16 Zeichen)
- Anzahl Anmeldungen
- Letzter Anmelde-Zeitpunkt
- User-Agent (max. 200 Zeichen)

**Audit-Log:** Wir protokollieren Anmeldungen, Passwort-aenderungen,
Profil-aenderungen und Account-Loeschungen mit anonymisierter IP zur
Sicherheits-Auswertung.

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag) +
Art. 6 Abs. 1 lit. f DSGVO (Sicherheit).
**Speicherdauer:**
- Account: bis Loeschung (manuell oder via Inaktivitaets-Cleanup nach 2 Jahren)
- Audit-Log: 90 Tage
- Failed-Login-Counter: 30 Minuten (Lockout-Window)
```

## Verify-Commands (Live-Probe)

```bash
# 1. paranoid-Mode aktiv (kein User-Enumeration)
curl -X POST https://<placeholder-domain>/users/password \
  -H "Content-Type: application/json" \
  -d '{"user":{"email":"nonexistent@example.com"}}' -i
# Erwartung: 200 mit "If your email exists..." (statt "Email not found")

# 2. Account-Lockout nach 5 Versuchen
for i in {1..6}; do
  curl -X POST https://<placeholder-domain>/users/sign_in \
    -d 'user[email]=<placeholder-user-email>&user[password]=wrong' -s -o /dev/null -w "%{http_code}\n"
done
# Erwartung: letzter Code zeigt Account-Lockout

# 3. IP-Hash statt Klartext
# DB-Query: SELECT current_sign_in_ip_hash, current_sign_in_ip FROM users WHERE id = '<test>';
# Erwartung: ip_hash gefuellt, ip-Feld NULL/leer

# 4. Password-Length-Enforcement
curl -X POST https://<placeholder-domain>/users \
  -d 'user[email]=test@test.com&user[password]=short' -i
# Erwartung: 422 mit "Password is too short (minimum is 12 characters)"
```

## Cross-References

- AEGIS-Scanner: `auth-flow-checker.ts`, `password-policy-checker.ts`, `audit-trail-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 32 (Sicherheit), Art. 5 lit. f (Vertraulichkeit)
- BDSG: § 26 Abs. 8 (Beschaeftigtendaten — bei Mitarbeiter-Accounts)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 9 (Auth-Audit)
