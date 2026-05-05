---
license: MIT (snippet)
provider: Ruby on Rails (Open-Source)
last-checked: 2026-05-05
purpose: Rails Cookies-Helper + Concern-Pattern fuer Tracker-Authorization.
---

# Rails — Cookie-Banner (Pattern)

## Trigger / Detection

Repo enthaelt:
- `rails` in `Gemfile` (Version >= 7.x empfohlen)
- `app/controllers/application_controller.rb`
- `app/views/layouts/application.html.erb`
- Optional: `app/javascript/` (Hotwire/Stimulus) oder Webpacker
- Optional: `config/initializers/cookies_serializer.rb`

## Default-Verhalten (was passiert ohne Konfiguration)

- Default `cookies` Helper signiert/verschluesselt Cookies → Banner-JS kann nicht lesen
- Tracker-Tags in `application.html.erb` `<head>` direkt eingebunden
- Session-Cookie ohne explizite `same_site` Setzung
- Cookies ohne `secure: true` Default in Development → Drift zu Prod
- Default-Logger schreibt Klartext-IP

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker-Tag in Layout-`<head>` | § 25 TDDDG | KRITISCH | Conditional `if cookies[:consent]&.dig('analytics')` |
| Encrypted Consent-Cookie unleserlich fuer JS | UX/DSGVO | MITTEL | Plain `cookies[:cookie_consent]` (nicht signed) |
| Session-Cookie ohne SameSite | Art. 32 DSGVO | HOCH | `config.action_dispatch.cookies_same_site_protection = :lax` |
| Klartext-IP in Production-Log | Art. 5 lit. f | HOCH | Custom `Rails.logger` Filter |
| `protect_from_forgery` nicht erzwungen | Art. 32 DSGVO | KRITISCH | nicht `with: :null_session` global |

## Code-Pattern (sanitized)

```ruby
# File: config/initializers/cookies.rb
Rails.application.config.action_dispatch.cookies_same_site_protection = :lax
Rails.application.config.action_dispatch.use_cookies_with_metadata = true
```

```ruby
# File: app/controllers/concerns/consent_concern.rb
module ConsentConcern
  extend ActiveSupport::Concern

  CONSENT_DEFAULT = {
    'necessary' => true,
    'analytics' => false,
    'marketing' => false
  }.freeze

  included do
    helper_method :user_consent, :analytics_consented?, :marketing_consented?
    before_action :load_consent
  end

  def user_consent
    @user_consent ||= CONSENT_DEFAULT
  end

  def analytics_consented?
    user_consent['analytics'] == true
  end

  def marketing_consented?
    user_consent['marketing'] == true
  end

  private

  def load_consent
    raw = cookies[:cookie_consent]
    return unless raw

    parsed = JSON.parse(raw) rescue nil
    return unless parsed.is_a?(Hash)

    @user_consent = CONSENT_DEFAULT.merge(parsed)
  end
end
```

```ruby
# File: app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  include ConsentConcern

  protect_from_forgery with: :exception

  before_action :set_security_headers

  private

  def set_security_headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()'
  end
end
```

```ruby
# File: app/controllers/consent_controller.rb
class ConsentController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:create], if: -> { csrf_token_via_header? }

  def create
    consent = consent_params.merge(
      'necessary' => true,
      'version' => '1.0',
      'timestamp' => Time.current.iso8601
    )

    # Server-Log fuer Nachweispflicht
    ConsentLog.create!(
      ip_hash: ip_hash(request.remote_ip),
      user_agent: (request.user_agent || '').first(200),
      consent: consent.to_json
    )

    cookies[:cookie_consent] = {
      value: consent.to_json,
      expires: 12.months.from_now,
      secure: Rails.env.production?,
      httponly: false,  # Banner-JS muss lesen
      same_site: :lax,
      path: '/'
    }

    head :no_content
  end

  private

  def consent_params
    params.require(:consent).permit(:analytics, :marketing).to_h.transform_values { |v| v == true || v == 'true' }
  end

  def ip_hash(ip)
    salt = Rails.application.credentials.dig(:ip_hash_salt) || ''
    Digest::SHA256.hexdigest(ip + salt)[0...16]
  end

  def csrf_token_via_header?
    request.headers['X-CSRF-Token'].present?
  end
end
```

```ruby
# File: config/routes.rb (Auszug)
Rails.application.routes.draw do
  resource :consent, only: [:create]
  # ...
end
```

```erb
<%# File: app/views/layouts/_cookie_banner.html.erb %>
<% unless cookies[:cookie_consent] %>
  <aside id="cookie-banner" role="dialog" aria-label="Cookie-Einwilligung" class="cookie-banner">
    <p>
      Wir nutzen Cookies fuer notwendige Funktionen. Mit Ihrer Einwilligung
      zusaetzlich fuer Webanalyse. Details:
      <%= link_to 'Datenschutzerklaerung', privacy_path %>.
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
    (() => {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
      const submit = (analytics, marketing) => {
        fetch('<%= consent_path %>', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
            Accept: 'application/json'
          },
          body: JSON.stringify({ consent: { analytics, marketing } })
        }).then(() => {
          document.getElementById('cookie-banner').remove();
          if (analytics) {
            const s = document.createElement('script');
            s.src = 'https://<placeholder-eu-analytics-host>/script.js';
            s.async = true;
            document.head.appendChild(s);
          }
        });
      };

      document.querySelector('[data-action="reject-all"]').onclick = () => submit(false, false);
      document.querySelector('[data-action="accept-all"]').onclick = () => submit(true, true);
    })();
  </script>
<% end %>
```

```erb
<%# File: app/views/layouts/application.html.erb %>
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <%= csrf_meta_tags %>
    <%= csp_meta_tag %>
    <title><%= content_for?(:title) ? yield(:title) : '<placeholder-site-name>' %></title>

    <%# Tracker NUR conditional %>
    <% if analytics_consented? %>
      <script src="https://<placeholder-eu-analytics-host>/script.js" async></script>
    <% end %>
  </head>
  <body>
    <%= yield %>
    <%= render 'layouts/cookie_banner' %>
  </body>
</html>
```

## AVV / DPA

- Hosting-Provider (Heroku EU / Fly.io / Render) — Art. 28 DSGVO
- Datenbank (Postgres EU / RDS Frankfurt) — AVV
- Analytics-Provider (Plausible EU / Matomo) — AVV
- Mailer (SES EU / Postmark) — AVV

## DSE-Wording-Vorlage

```markdown
### Cookies (Rails-Anwendung)

Diese Webseite verwendet folgende Cookies:

**Notwendige Cookies:**
- `_<placeholder-app>_session` — Session-Verwaltung, Session-Dauer (signed/encrypted)
- `_csrf_token` — CSRF-Schutz, Session-Dauer
- `cookie_consent` — Speicherung Ihrer Einwilligung, 12 Monate (Klartext-JSON, damit JS lesen kann)

**Analyse-Cookies (Opt-In, mit Einwilligung):**
- gesetzt durch <placeholder-analytics-provider>
- Speicherdauer: <placeholder-days> Tage
- EU-Hosting: <placeholder-eu-country>

**Rechtsgrundlage:** § 25 TDDDG i.V.m. Art. 6 Abs. 1 lit. a DSGVO
(fuer Opt-In-Cookies) bzw. lit. f DSGVO (fuer notwendige Cookies).
**Widerruf:** [Cookie-Einstellungen](#cookie-settings) im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Banner sichtbar bei Erstbesuch
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner"

# 2. cookie_consent NICHT signed (JS-readable)
curl -X POST https://<placeholder-domain>/consent \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <placeholder-csrf>" \
  -d '{"consent":{"analytics":false,"marketing":false}}' -i \
  | grep -i "set-cookie:.*cookie_consent"
# Erwartung: JSON-String, NICHT base64-encrypted

# 3. Tracker erst nach Consent
curl -sS https://<placeholder-domain>/ | grep -ic "<placeholder-eu-analytics-host>"
# Erwartung: 0

curl -sS -H 'Cookie: cookie_consent=%7B%22analytics%22%3Atrue%7D' https://<placeholder-domain>/ \
  | grep -ic "<placeholder-eu-analytics-host>"
# Erwartung: >=1

# 4. Security-Headers
curl -sI https://<placeholder-domain>/ | grep -iE "x-content-type-options|referrer-policy"
```

## Cross-References

- AEGIS-Scanner: `cookie-flags-checker.ts`, `consent-flow-checker.ts`, `csrf-config-checker.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- OLG Koeln 6 U 80/23 (Button-Gleichwertigkeit)
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
