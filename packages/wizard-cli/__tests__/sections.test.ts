/**
 * Section-renderer tests.
 *
 * One describe-block per renderer in src/brief/sections.ts. Each verifies
 * that the renderer produces a deterministic string for a given config and
 * pattern-set, and that config-gated content appears / disappears as
 * expected.
 */
import { describe, it, expect } from 'vitest';
import {
  renderHeader,
  renderAgentInstructions,
  renderCoreRules,
  renderInstallation,
  renderDatabaseSchema,
  renderPagesInventory,
  renderComponentCatalog,
  renderApiRoutes,
  renderBuildOrder,
  renderQualityGates,
  renderDsgvoChecklist,
  renderEnvVars,
  renderPostBuildReportTemplate,
  renderFooter,
} from '../src/brief/sections.js';
import { AegisConfigSchema, type AegisConfig } from '../src/wizard/schema.js';
import type { LoadedPattern } from '../src/patterns/loader.js';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

function buildConfig(overrides: Partial<AegisConfig> = {}): AegisConfig {
  const base = AegisConfigSchema.parse({
    aegis_version: '0.17.0',
    generated_at: '2026-04-23T00:00:00.000Z',
    identity: {
      project_name: 'test-saas',
      project_description: 'Section-renderer test fixture.',
      app_name: 'Test SaaS',
      company_name: 'Example GmbH',
      target_branche: 'generic',
      target_jurisdiction: 'DE',
      b2b_or_b2c: 'b2b',
      expected_users: '100-1k',
    },
  });
  return { ...base, ...overrides } as AegisConfig;
}

function buildLoadedPattern(
  category: 'foundation' | 'compliance' | 'integration' | 'feature',
  name: string,
): LoadedPattern {
  return {
    frontmatter: {
      name,
      category,
      title: `Test ${category}/${name}`,
      description: 'A description at least 20 chars long for test purposes.',
      version: 1,
      dependencies: { npm: [], shadcn: [], supabase: [] },
      placeholders: [],
      brief_section:
        category === 'foundation'
          ? 'Foundation'
          : category === 'compliance'
            ? 'Compliance'
            : category === 'integration'
              ? 'Integration'
              : 'Feature',
      tags: [],
      related: [],
      conflicts_with: [],
      aegis_scan_baseline: 960,
      deprecated: false,
    },
    body: '# body',
    sourcePath: `/tmp/${category}/${name}.md`,
    relativePath: `${category}/${name}.md`,
  };
}

const ALL_8: LoadedPattern[] = [
  buildLoadedPattern('foundation', 'multi-tenant-supabase'),
  buildLoadedPattern('foundation', 'auth-supabase-full'),
  buildLoadedPattern('foundation', 'rbac-requirerole'),
  buildLoadedPattern('foundation', 'middleware-hardened'),
  buildLoadedPattern('foundation', 'logger-pii-safe'),
  buildLoadedPattern('foundation', 'i18n-next-intl'),
  buildLoadedPattern('compliance', 'dsgvo-kit'),
  buildLoadedPattern('compliance', 'legal-pages-de'),
];

// ----------------------------------------------------------------------------

describe('renderHeader', () => {
  it('includes project-name and pattern-ref list', () => {
    const out = renderHeader(buildConfig(), ALL_8);
    expect(out).toContain('# Agent Brief: test-saas');
    expect(out).toContain('foundation/multi-tenant-supabase');
    expect(out).toContain('compliance/dsgvo-kit');
  });

  it('renders wizard-version as an UPPER_SNAKE placeholder for later substitution', () => {
    const out = renderHeader(buildConfig(), ALL_8);
    expect(out).toContain('{{AEGIS_WIZARD_VERSION}}');
  });

  it('renders languages from config.localization.locales', () => {
    const out = renderHeader(buildConfig(), ALL_8);
    expect(out).toContain('DE + EN');
  });
});

describe('renderAgentInstructions', () => {
  it('emits the fixed 6 operating rules', () => {
    const out = renderAgentInstructions();
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(out).toContain(`${n}. `);
    }
  });

  it('is deterministic across calls', () => {
    expect(renderAgentInstructions()).toBe(renderAgentInstructions());
  });
});

describe('renderCoreRules', () => {
  it('includes Umlauten section when locales include de', () => {
    const cfg = buildConfig();
    const out = renderCoreRules(cfg);
    expect(out).toContain('Umlaute in UI');
  });

  it('omits Umlauten section when locales does not include de', () => {
    const cfg = buildConfig();
    cfg.localization = { ...cfg.localization, locales: ['en'] as ['en'], default_locale: 'en' };
    const out = renderCoreRules(cfg);
    expect(out).not.toContain('Umlaute in UI');
    expect(out).toContain('Multi-Tenancy (HARD)');
    expect(out).toContain('Zod .strict()');
  });

  it('always includes Zod and optimistic-update rules', () => {
    const out = renderCoreRules(buildConfig());
    expect(out).toContain('Zod .strict()');
    expect(out).toContain('Optimistic updates');
  });
});

describe('renderInstallation', () => {
  it('emits the project-name in the create-next-app line', () => {
    const out = renderInstallation(buildConfig(), ALL_8);
    expect(out).toContain('npx create-next-app@latest test-saas');
  });

  it('adds next-intl dep when i18n pattern present', () => {
    const out = renderInstallation(buildConfig(), ALL_8);
    expect(out).toContain('next-intl@latest');
  });

  it('omits next-intl dep when i18n pattern absent', () => {
    const subset = ALL_8.filter((p) => p.frontmatter.name !== 'i18n-next-intl');
    const out = renderInstallation(buildConfig(), subset);
    expect(out).not.toContain('next-intl@latest');
  });
});

describe('renderDatabaseSchema', () => {
  it('references tenant migration when multi-tenant pattern present', () => {
    const out = renderDatabaseSchema(ALL_8);
    expect(out).toContain('00001_base_tenants_profiles.sql');
  });

  it('references dsgvo migration when dsgvo-kit pattern present', () => {
    const out = renderDatabaseSchema(ALL_8);
    expect(out).toContain('00010_dsgvo.sql');
  });

  it('omits dsgvo migration when dsgvo-kit absent', () => {
    const subset = ALL_8.filter((p) => p.frontmatter.name !== 'dsgvo-kit');
    const out = renderDatabaseSchema(subset);
    expect(out).not.toContain('00010_dsgvo.sql');
  });

  it('emits the seed-tenant SQL with DEFAULT_TENANT_ID placeholder', () => {
    const out = renderDatabaseSchema(ALL_8);
    expect(out).toContain('{{DEFAULT_TENANT_ID}}');
  });
});

describe('renderPagesInventory', () => {
  it('includes legal-page paths from config.compliance.legal_pages', () => {
    const out = renderPagesInventory(buildConfig());
    expect(out).toContain('impressum');
    expect(out).toContain('datenschutz');
  });

  it('omits audit-log admin page when dsgvo_kit is false', () => {
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, dsgvo_kit: false };
    const out = renderPagesInventory(cfg);
    expect(out).not.toContain('`/admin/audit-log`');
  });
});

describe('renderComponentCatalog', () => {
  it('includes CookieBanner when dsgvo-kit pattern present', () => {
    const out = renderComponentCatalog(ALL_8);
    expect(out).toContain('CookieBanner');
  });

  it('omits CookieBanner when dsgvo-kit absent', () => {
    const subset = ALL_8.filter((p) => p.frontmatter.name !== 'dsgvo-kit');
    const out = renderComponentCatalog(subset);
    expect(out).not.toContain('CookieBanner');
  });

  it('includes LanguageSwitcher when i18n pattern present', () => {
    const out = renderComponentCatalog(ALL_8);
    expect(out).toContain('LanguageSwitcher');
  });
});

describe('renderApiRoutes', () => {
  it('emits the secureApiRouteWithTenant convention block', () => {
    const out = renderApiRoutes(ALL_8);
    expect(out).toContain('secureApiRouteWithTenant');
    expect(out).toContain('requireRole');
  });

  it('includes dsgvo routes when dsgvo-kit present', () => {
    const out = renderApiRoutes(ALL_8);
    expect(out).toContain('/api/dsgvo/export');
  });

  it('omits dsgvo routes when dsgvo-kit absent', () => {
    const subset = ALL_8.filter((p) => p.frontmatter.name !== 'dsgvo-kit');
    const out = renderApiRoutes(subset);
    expect(out).not.toContain('/api/dsgvo/export');
  });
});

describe('renderBuildOrder', () => {
  it('includes Phase 3 i18n when i18n pattern present', () => {
    const out = renderBuildOrder(ALL_8);
    expect(out).toContain('Phase 3 - i18n');
  });

  it('omits Phase 3 i18n when i18n pattern absent', () => {
    const subset = ALL_8.filter((p) => p.frontmatter.name !== 'i18n-next-intl');
    const out = renderBuildOrder(subset);
    expect(out).not.toContain('Phase 3 - i18n');
  });

  it('always includes Phase 1 Foundation and Phase 10 Final Verification', () => {
    const out = renderBuildOrder([]);
    expect(out).toContain('Phase 1 - Foundation');
    expect(out).toContain('Phase 10 - Final Verification');
  });
});

describe('renderQualityGates', () => {
  it('includes Umlaut-gate when de locale present', () => {
    const out = renderQualityGates(buildConfig());
    expect(out).toContain('Umlaut-gate');
  });

  it('omits Umlaut-gate when de locale absent', () => {
    const cfg = buildConfig();
    cfg.localization = { ...cfg.localization, locales: ['en'] as ['en'], default_locale: 'en' };
    const out = renderQualityGates(cfg);
    expect(out).not.toContain('Umlaut-gate');
  });

  it('always includes aegis scan and react-doctor gates', () => {
    const out = renderQualityGates(buildConfig());
    expect(out).toContain('npx -y @aegis-scan/cli scan');
    expect(out).toContain('react-doctor');
  });

  it('includes DSGVO-PII-grep when dsgvo_kit enabled', () => {
    const out = renderQualityGates(buildConfig());
    expect(out).toContain('DSGVO PII-check');
  });

  it('omits DSGVO-PII-grep when dsgvo_kit disabled', () => {
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, dsgvo_kit: false };
    const out = renderQualityGates(cfg);
    expect(out).not.toContain('DSGVO PII-check');
  });
});

describe('renderDsgvoChecklist', () => {
  it('emits a non-null string when dsgvo_kit enabled', () => {
    const out = renderDsgvoChecklist(buildConfig());
    expect(out).not.toBeNull();
    expect(out).toContain('Cookie-banner shows');
  });

  it('returns null when dsgvo_kit disabled', () => {
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, dsgvo_kit: false };
    expect(renderDsgvoChecklist(cfg)).toBeNull();
  });
});

describe('renderEnvVars', () => {
  it('emits Supabase env-block always', () => {
    const out = renderEnvVars(buildConfig(), ALL_8);
    expect(out).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(out).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('emits SMTP block when email provider is not skip', () => {
    const out = renderEnvVars(buildConfig(), ALL_8);
    expect(out).toContain('SMTP_HOST');
  });

  it('omits SMTP block when email provider is skip', () => {
    const cfg = buildConfig();
    cfg.email = { ...cfg.email, provider: 'skip' };
    const out = renderEnvVars(cfg, ALL_8);
    expect(out).not.toContain('SMTP_HOST');
  });

  it('references DEFAULT_TENANT_ID placeholder for later substitution', () => {
    const out = renderEnvVars(buildConfig(), ALL_8);
    expect(out).toContain('{{DEFAULT_TENANT_ID}}');
  });
});

describe('renderPostBuildReportTemplate', () => {
  it('is deterministic and non-empty', () => {
    const out = renderPostBuildReportTemplate();
    expect(out.length).toBeGreaterThan(50);
    expect(out).toBe(renderPostBuildReportTemplate());
  });
});

describe('renderFooter', () => {
  it('lists all patterns with versions', () => {
    const out = renderFooter(buildConfig(), ALL_8);
    expect(out).toContain('foundation/multi-tenant-supabase v1');
    expect(out).toContain('compliance/dsgvo-kit v1');
  });

  it('includes brief-generation config block', () => {
    const out = renderFooter(buildConfig(), ALL_8);
    expect(out).toContain('Brief-generation config');
    expect(out).toContain('terse');
  });
});
