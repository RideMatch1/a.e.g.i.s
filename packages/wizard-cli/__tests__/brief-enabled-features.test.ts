/**
 * F2 (commit 4) — renderEnabledFeaturesSection tests.
 *
 * Verifies the conditional-emit gate (D7) and the per-feature label / guidance
 * surfacing logic. Three configs exercise the matrix:
 *   1. Maximal — many features enabled, none covered by saas-starter patterns
 *   2. Minimal — no enabled-uncovered features, section omitted (returns null)
 *   3. Pattern-coverage — enabled feature whose pattern-name overlaps via the
 *      hasPatternFor() substring-match → section omitted because the heuristic
 *      considers it covered.
 */
import { describe, it, expect } from 'vitest';
import { renderEnabledFeaturesSection } from '../src/brief/sections.js';
import { AegisConfigSchema, type AegisConfig } from '../src/wizard/schema.js';

const SAAS_STARTER_PATTERNS: AegisConfig['selected_patterns'] = [
  { category: 'foundation', name: 'multi-tenant-supabase', version: 1 },
  { category: 'foundation', name: 'auth-supabase-full', version: 1 },
  { category: 'foundation', name: 'rbac-requirerole', version: 1 },
  { category: 'foundation', name: 'middleware-hardened', version: 1 },
  { category: 'foundation', name: 'logger-pii-safe', version: 1 },
  { category: 'foundation', name: 'i18n-next-intl', version: 1 },
  { category: 'compliance', name: 'dsgvo-kit', version: 1 },
  { category: 'compliance', name: 'legal-pages-de', version: 1 },
];

function buildBaseConfig(): AegisConfig {
  return AegisConfigSchema.parse({
    aegis_version: '0.17.1',
    generated_at: '2026-04-23T00:00:00.000Z',
    identity: {
      project_name: 'enabled-features-test',
      project_description: 'F2 enabled-features section snapshot fixture.',
      app_name: 'EF Test',
      company_name: 'Test GmbH',
      target_branche: 'generic',
      target_jurisdiction: 'DE',
      b2b_or_b2c: 'b2b',
      expected_users: '100-1k',
    },
    // C5-required (commit 2): default-true dsgvo_kit + default legal_pages
    // include 'impressum', so company_address must be populated.
    compliance: {
      company_address: {
        street: 'Teststraße 1',
        zip_city: '12345 Berlin',
        email: 'test@example.com',
      },
    },
    selected_patterns: SAAS_STARTER_PATTERNS,
  });
}

describe('renderEnabledFeaturesSection (F2, commit 4)', () => {
  it('TEST 1 — maximal config surfaces every enabled-uncovered item', () => {
    const cfg = buildBaseConfig();
    cfg.features = {
      ...cfg.features,
      calendar: true,
      chat: { enabled: true, ai_powered: true },
      file_upload: { enabled: true, storage: 'supabase-storage', max_size_mb: 10 },
      team_management: true,
    };
    cfg.billing = {
      enabled: true,
      provider: 'stripe',
      trial_days: 14,
      tax_handling: 'stripe-tax',
    };
    cfg.integrations = {
      ai: { provider: 'mistral-eu', features: ['chat'], pii_guard: true },
      analytics: 'plausible',
      observability: 'none',
      background_jobs: 'cron-job-org',
      external_services: [],
    };

    const rendered = renderEnabledFeaturesSection(cfg, 'en');
    expect(rendered).not.toBeNull();
    const out = rendered as string;
    expect(out).toMatch(/^## Enabled features \(no dedicated pattern yet\)/m);
    expect(out).toMatch(/\*\*Calendar\*\*/);
    expect(out).toMatch(/\*\*Chat \(AI-powered\)\*\*/);
    expect(out).toMatch(/\*\*File upload \(supabase-storage, 10MB max\)\*\*/);
    expect(out).toMatch(/\*\*Team management\*\*/);
    expect(out).toMatch(/\*\*AI integration \(mistral-eu, features: chat\)\*\*/);
    expect(out).toMatch(/\*\*Analytics \(plausible\)\*\*/);
    expect(out).toMatch(/\*\*Background jobs \(cron-job-org\)\*\*/);
    expect(out).toMatch(/\*\*Billing \(stripe, 14-day trial\)\*\*/);
    expect(out).not.toMatch(/Kanban/);
    expect(out).not.toMatch(/Knowledge base/);
  });

  it('TEST 2 — minimal config (zero enabled-uncovered features) returns null', () => {
    const cfg = buildBaseConfig();
    expect(renderEnabledFeaturesSection(cfg, 'en')).toBeNull();
  });

  it('TEST 3 — feature whose pattern is present is suppressed by hasPatternFor()', () => {
    const cfg = buildBaseConfig();
    cfg.features = { ...cfg.features, calendar: true };
    cfg.selected_patterns = [
      ...SAAS_STARTER_PATTERNS,
      { category: 'feature', name: 'calendar-fullcalendar', version: 1 },
    ];
    expect(renderEnabledFeaturesSection(cfg, 'en')).toBeNull();
  });

  it('emits German heading when lang=de', () => {
    const cfg = buildBaseConfig();
    cfg.features = { ...cfg.features, calendar: true };
    const rendered = renderEnabledFeaturesSection(cfg, 'de');
    expect(rendered).not.toBeNull();
    expect(rendered as string).toMatch(/^## Aktivierte Features \(noch ohne dediziertes Pattern\)/m);
    expect(rendered as string).toMatch(/\*\*Calendar\*\*/);
  });
});
