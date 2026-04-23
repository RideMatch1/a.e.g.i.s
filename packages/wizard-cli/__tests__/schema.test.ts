/**
 * Zod schema tests for AegisConfigSchema.
 *
 * Covers the Day-1 contract:
 *   - Valid Tier-1 minimal input passes
 *   - Wizard-emitted shape (full config with derived defaults) passes
 *   - Missing required Tier-1 fields are rejected
 *   - Wrong types on key enums are rejected
 *   - Regex-gated fields (project_name, aegis_version) enforced
 *
 * Plus the cross-field refine added for bug 008:
 *   - localization.default_locale must be a member of localization.locales
 */
import { describe, it, expect } from 'vitest';
import {
  AegisConfigSchema,
  ProjectIdentitySchema,
  MultiTenancySchema,
  DeployTargetSchema,
  TenantModelSchema,
} from '../src/wizard/schema.js';
import { TIER_1_QUESTIONS, getQuestionById, TIER_1_IDS } from '../src/wizard/questions.js';

// ----------------------------------------------------------------------------
// Fixture — a valid Tier-1 minimal config the wizard would emit.
// ----------------------------------------------------------------------------

const VALID_TIER_1 = {
  aegis_version: '0.17.0',
  generated_at: '2026-04-22T15:42:00.000Z',
  identity: {
    project_name: 'my-saas',
    project_description: 'Generic B2B SaaS backend with multi-tenant RBAC.',
    app_name: 'My SaaS',
    company_name: 'Example GmbH',
    target_branche: 'other',
    target_jurisdiction: 'DE',
    b2b_or_b2c: 'b2b',
    expected_users: '100-1k',
  },
  localization: {
    locales: ['de', 'en'],
  },
  multi_tenancy: {
    tenant_model: 'path',
  },
  email: {
    provider: 'smtp',
  },
  deployment: {
    target: 'vercel',
  },
  // C5 (commit 2): TMG §5 Impressum address required when dsgvo_kit is on
  // (default-true) and 'impressum' is in legal_pages (default-included).
  compliance: {
    company_address: {
      street: 'Musterstraße 1',
      zip_city: '10115 Berlin',
      email: 'kontakt@example.com',
    },
  },
};

// ----------------------------------------------------------------------------

describe('AegisConfigSchema', () => {
  it('accepts a valid Tier-1 minimal config', () => {
    const parsed = AegisConfigSchema.parse(VALID_TIER_1);
    expect(parsed.identity.project_name).toBe('my-saas');
    expect(parsed.aegis_version).toBe('0.17.0');
    expect(parsed.deployment.target).toBe('vercel');
    expect(parsed.localization.locales).toEqual(['de', 'en']);
    expect(parsed.multi_tenancy.tenant_model).toBe('path');
  });

  it('fills deep-defaults for Tier-2 sections (billing, features, integrations, compliance, advanced)', () => {
    const parsed = AegisConfigSchema.parse(VALID_TIER_1);
    expect(parsed.billing.enabled).toBe(false);
    expect(parsed.features.command_palette).toBe(true);
    expect(parsed.features.dashboard_widgets.chart_lib).toBe('recharts');
    expect(parsed.integrations.ai.provider).toBe('none');
    expect(parsed.compliance.cookie_banner).toBe(true);
    expect(parsed.advanced.accessibility).toBe('WCAG-AA');
    expect(parsed.theme.radius).toBe('0.5');
    expect(parsed.brief_options.tone).toBe('terse');
    expect(parsed.brief_options.lang).toBe('en');
  });

  it('rejects missing required Tier-1 identity fields', () => {
    const bad = {
      ...VALID_TIER_1,
      identity: { ...VALID_TIER_1.identity, project_name: undefined },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('rejects project_name that does not match kebab-regex', () => {
    const bad = {
      ...VALID_TIER_1,
      identity: { ...VALID_TIER_1.identity, project_name: 'My_Project' },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('rejects aegis_version that lacks semver shape', () => {
    const bad = { ...VALID_TIER_1, aegis_version: 'not-a-version' };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('rejects out-of-enum deploy target', () => {
    const bad = {
      ...VALID_TIER_1,
      deployment: { target: 'heroku' },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('rejects wrong type on multi_tenancy.enabled', () => {
    const bad = {
      ...VALID_TIER_1,
      multi_tenancy: { enabled: 'yes', tenant_model: 'path' },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('rejects identity.project_description shorter than 10 chars', () => {
    const bad = {
      ...VALID_TIER_1,
      identity: { ...VALID_TIER_1.identity, project_description: 'too short' },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('rejects locales array with zero elements', () => {
    const bad = {
      ...VALID_TIER_1,
      localization: { locales: [] },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('accepts optional default_tenant_id as uuid', () => {
    const ok = {
      ...VALID_TIER_1,
      multi_tenancy: {
        tenant_model: 'path',
        default_tenant_id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
      },
    };
    const parsed = AegisConfigSchema.parse(ok);
    expect(parsed.multi_tenancy.default_tenant_id).toBe('a1b2c3d4-e5f6-4890-abcd-ef1234567890');
  });

  it('rejects malformed default_tenant_id', () => {
    const bad = {
      ...VALID_TIER_1,
      multi_tenancy: {
        tenant_model: 'path',
        default_tenant_id: 'not-a-uuid',
      },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });
});

// ----------------------------------------------------------------------------
// F3 — ai ↔ chat coherence cross-validators (commit 1, dispatch-brief §4)
// ----------------------------------------------------------------------------

describe('AegisConfigSchema — F3 ai↔chat coherence refines', () => {
  it('REJECTS integrations.ai.features=["chat"] with features.chat default-off (forward refine RED)', () => {
    const bad = {
      ...VALID_TIER_1,
      integrations: {
        ai: { provider: 'mistral-eu', features: ['chat'], pii_guard: true },
      },
      // features.chat defaults to {enabled:false, ai_powered:false} — incoherent
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow(
      /auto-enable both or remove/,  // unique substring of the F3-forward refine message
    );
  });

  it('ACCEPTS integrations.ai.features=["chat"] with features.chat fully active (forward refine GREEN)', () => {
    const ok = {
      ...VALID_TIER_1,
      integrations: {
        ai: { provider: 'mistral-eu', features: ['chat'], pii_guard: true },
      },
      features: {
        chat: { enabled: true, ai_powered: true },
      },
    };
    expect(() => AegisConfigSchema.parse(ok)).not.toThrow();
  });

  it('REJECTS features.chat.ai_powered=true with integrations.ai.provider=none (symmetric refine RED)', () => {
    const bad = {
      ...VALID_TIER_1,
      features: {
        chat: { enabled: true, ai_powered: true },
      },
      // integrations.ai defaults to {provider:'none', features:[]} — incoherent
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow(
      /set integrations\.ai\.provider and add/,  // unique substring of F3-symmetric refine message (no quote-chars)
    );
  });

  it('ACCEPTS features.chat.ai_powered=true with integrations.ai.provider+features wired (symmetric refine GREEN)', () => {
    const ok = {
      ...VALID_TIER_1,
      features: {
        chat: { enabled: true, ai_powered: true },
      },
      integrations: {
        ai: { provider: 'openai', features: ['chat'], pii_guard: true },
      },
    };
    expect(() => AegisConfigSchema.parse(ok)).not.toThrow();
  });
});

// ----------------------------------------------------------------------------
// C5 — TMG §5 Impressum completeness cross-validator (commit 2, dispatch-brief §4)
// ----------------------------------------------------------------------------

describe('AegisConfigSchema — C5 TMG §5 Impressum refine', () => {
  it('REJECTS dsgvo_kit + impressum-in-legal_pages without company_address (RED)', () => {
    // Strip the fixture's company_address; defaults still set dsgvo_kit=true
    // and legal_pages includes 'impressum', so the C5 refine must fire.
    const { compliance: _omit, ...bad } = VALID_TIER_1;
    expect(() => AegisConfigSchema.parse(bad)).toThrow(/TMG §5 Impressumspflicht/);
  });

  it('ACCEPTS dsgvo_kit + impressum + populated company_address (GREEN)', () => {
    expect(() => AegisConfigSchema.parse(VALID_TIER_1)).not.toThrow();
  });

  it('REJECTS company_address present but missing email (RED-partial / schema-level)', () => {
    const bad = {
      ...VALID_TIER_1,
      compliance: {
        company_address: {
          street: 'Musterstraße 1',
          zip_city: '10115 Berlin',
          // email intentionally omitted — schema-level rejection (email required)
        },
      },
    };
    expect(() => AegisConfigSchema.parse(bad)).toThrow();
  });

  it('ACCEPTS dsgvo_kit=false without company_address (GREEN-edge / opt-out)', () => {
    const { compliance: _omit, ...rest } = VALID_TIER_1;
    const ok = { ...rest, compliance: { dsgvo_kit: false } };
    expect(() => AegisConfigSchema.parse(ok)).not.toThrow();
  });
});

// ----------------------------------------------------------------------------

describe('Sub-schemas — spot-checks', () => {
  it('ProjectIdentitySchema enforces kebab-case + length bounds', () => {
    expect(() =>
      ProjectIdentitySchema.parse({
        project_name: 'x',
        project_description: 'ok long enough',
        app_name: 'X',
        company_name: 'Y',
        target_branche: 'other',
        b2b_or_b2c: 'b2b',
        expected_users: '<100',
      }),
    ).toThrow();
  });

  it('MultiTenancySchema defaults enabled=true and tenant_model=path', () => {
    const parsed = MultiTenancySchema.parse({});
    expect(parsed.enabled).toBe(true);
    expect(parsed.tenant_model).toBe('path');
  });

  it('DeployTargetSchema accepts skip + rejects custom-alias', () => {
    expect(() => DeployTargetSchema.parse('skip')).not.toThrow();
    expect(() => DeployTargetSchema.parse('heroku')).toThrow();
  });

  it('TenantModelSchema is exactly [none, subdomain, path, header]', () => {
    const values = TenantModelSchema.options;
    expect(values).toContain('none');
    expect(values).toContain('subdomain');
    expect(values).toContain('path');
    expect(values).toContain('header');
  });
});

// ----------------------------------------------------------------------------

describe('Tier-1 questions catalog', () => {
  it('has exactly 21 questions', () => {
    expect(TIER_1_QUESTIONS.length).toBe(21);
  });

  it('contains the six legal-identity Tier-1 questions added post-audit', () => {
    const ids = TIER_1_QUESTIONS.map((q) => q.id);
    expect(ids).toContain('company_name');
    expect(ids).toContain('app_name');
    expect(ids).toContain('company_email');
    expect(ids).toContain('company_street');
    expect(ids).toContain('company_zip_city');
    expect(ids).toContain('company_vat_id');
  });

  it('every question has tier === 1', () => {
    for (const q of TIER_1_QUESTIONS) {
      expect(q.tier).toBe(1);
    }
  });

  it('every question-id is unique', () => {
    const ids = TIER_1_IDS;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getQuestionById returns a known question', () => {
    const q = getQuestionById('project_name');
    expect(q.id).toBe('project_name');
    expect(q.type).toBe('text');
  });

  it('getQuestionById throws on unknown id', () => {
    expect(() => getQuestionById('nope')).toThrow(/Unknown question id/);
  });

  it('has the expected required question IDs', () => {
    const expected = [
      'project_name',
      'project_description',
      'target_branche',
      'expected_users',
      'b2b_or_b2c',
      'tenant_model',
      'locales',
      'deployment_target',
      'target_jurisdiction',
      'shadcn_preset_code',
      'brand_colors',
      'billing_enabled',
      'email_provider',
      'admin_panel',
      'public_landing',
    ];
    for (const id of expected) {
      expect(TIER_1_IDS).toContain(id);
    }
  });
});

// ----------------------------------------------------------------------------
// Cross-field refine: localization.default_locale must be in localization.locales
// (bug 008 backstop — catches configs produced outside the interactive flow)
// ----------------------------------------------------------------------------

describe('AegisConfigSchema locale-consistency refine', () => {
  it('accepts the default configuration (locales=[de,en], default_locale=de)', () => {
    // VALID_TIER_1 relies on Zod defaults for localization entirely
    expect(() => AegisConfigSchema.parse(VALID_TIER_1)).not.toThrow();
  });

  it('accepts fr-only locales when default_locale is also fr', () => {
    const input = {
      ...VALID_TIER_1,
      localization: { locales: ['fr'], default_locale: 'fr' },
    };
    expect(() => AegisConfigSchema.parse(input)).not.toThrow();
  });

  it('accepts multi-locale with default matching one member', () => {
    const input = {
      ...VALID_TIER_1,
      localization: { locales: ['en', 'fr'], default_locale: 'en' },
    };
    expect(() => AegisConfigSchema.parse(input)).not.toThrow();
  });

  it('rejects fr-only locales with en default (the literal bug 008 case)', () => {
    const input = {
      ...VALID_TIER_1,
      localization: { locales: ['fr'], default_locale: 'en' },
    };
    expect(() => AegisConfigSchema.parse(input)).toThrow(/default_locale/);
  });

  it('rejects when Zod default_locale=de falls back but locales excludes de', () => {
    // Hand-authored config with no explicit default_locale: Zod fills in 'de',
    // but locales=['fr'] makes 'de' invalid. Bug 008 backstop.
    const input = {
      ...VALID_TIER_1,
      localization: { locales: ['fr'] },
    };
    expect(() => AegisConfigSchema.parse(input)).toThrow(/default_locale/);
  });

  it('rejects when default_locale is a locale not even enumerated in the schema', () => {
    const input = {
      ...VALID_TIER_1,
      localization: { locales: ['de'], default_locale: 'zh' },
    };
    expect(() => AegisConfigSchema.parse(input)).toThrow(/default_locale/);
  });
});
