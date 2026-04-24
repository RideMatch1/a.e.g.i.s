/**
 * Tests for the pattern-placeholder resolver-map builder.
 *
 * Asserts that every {{UPPER_SNAKE}} marker observed across the
 * v0.17 knowledge-base patterns has a resolver, that config-derived
 * values flow through unchanged, that optional sub-objects degrade
 * to empty strings rather than undefined, and that runtime-env
 * snippets are wrapped in TypeScript-valid expressions.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { AegisConfigSchema, type AegisConfig } from '../src/wizard/schema.js';
import { buildPatternPlaceholders } from '../src/brief/pattern-placeholders.js';
import { buildReservedPlaceholders, substitute } from '../src/template/substitute.js';
import { renderBuildOrder } from '../src/brief/sections.js';
import type { LoadedPattern } from '../src/patterns/loader.js';

const LEGAL_PAGES_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'patterns',
  'compliance',
  'legal-pages-de.md',
);

function buildConfig(overrides: Partial<AegisConfig> = {}): AegisConfig {
  const base = AegisConfigSchema.parse({
    aegis_version: '0.17.0',
    generated_at: '2026-04-23T00:00:00.000Z',
    identity: {
      project_name: 'placeholder-test',
      project_description: 'A test project for placeholder resolution.',
      app_name: 'Placeholder Test',
      company_name: 'Example GmbH',
      target_branche: 'generic',
      target_jurisdiction: 'DE',
      b2b_or_b2c: 'b2b',
      expected_users: '100-1k',
    },
    compliance: {
      company_address: {
        street: 'Musterstraße 1',
        zip_city: '10115 Berlin',
        email: 'kontakt@example.com',
      },
    },
  });
  return { ...base, ...overrides } as AegisConfig;
}

function buildReserved(config: AegisConfig) {
  return buildReservedPlaceholders(
    {
      projectName: config.identity.project_name,
      appName: config.identity.app_name,
      aegisWizardVersion: config.aegis_version,
      defaultLocale: config.localization.default_locale,
      locales: config.localization.locales,
      generatedAt: config.generated_at,
      defaultTenantId: 'c0ffee00-0000-0000-0000-000000000000',
    },
    () => 'c0ffee00-0000-0000-0000-000000000000',
  );
}

describe('buildPatternPlaceholders — required placeholder coverage', () => {
  const requiredKeys = [
    'APP_NAME',
    'APP_URL',
    'AUTH_METHODS',
    'CANCELLATION_DAYS',
    'COMPANY_CEO',
    'COMPANY_COUNTRY',
    'COMPANY_EMAIL',
    'COMPANY_HRB',
    'COMPANY_NAME',
    'COMPANY_PHONE',
    'COMPANY_STREET',
    'COMPANY_VAT_ID',
    'COMPANY_ZIP_CITY',
    'CONSENT_VERSION',
    'CSP_ADDITIONAL_CONNECT_SRC',
    'CSP_REPORT_ONLY',
    'DATA_RETENTION_DAYS',
    'DEFAULT_LOCALE',
    'DEFAULT_TENANT_ID',
    'DPO_EMAIL',
    'DPO_NAME',
    'EXTRA_SENSITIVE_KEYS_JSON',
    'LOCALES_JSON',
    'LOCALE_PREFIX',
    'LOG_RETENTION_DAYS',
    'AUDIT_RETENTION_MONTHS',
    'PROJECT_NAME',
    'PUBLIC_PROFILE_FIELDS_JSON',
    'ROLES_UNION',
    'SENSITIVE_PERSONAL_FIELDS_JSON',
    'TRUSTED_PROXY_COUNT',
  ];

  it('returns a value for every required key', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    for (const key of requiredKeys) {
      expect(map).toHaveProperty(key);
      expect(typeof map[key]).toBe('string');
    }
  });
});

describe('buildPatternPlaceholders — config-derived values', () => {
  it('maps the Tier-1 company identity verbatim', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.COMPANY_NAME).toBe('Example GmbH');
    expect(map.PROJECT_NAME).toBe('placeholder-test');
  });

  it('serializes auth methods and locales as JSON strings', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(JSON.parse(map.AUTH_METHODS)).toEqual(['password']);
    expect(JSON.parse(map.LOCALES_JSON)).toEqual(['de', 'en']);
  });

  it('emits a TypeScript union-literal string for ROLES_UNION', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.ROLES_UNION).toBe("'admin' | 'manager' | 'user'");
  });

  it('maps compliance retention to a stringified integer', () => {
    const config = buildConfig({
      compliance: {
        ...buildConfig().compliance,
        data_retention_days: 90,
      },
    });
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.DATA_RETENTION_DAYS).toBe('90');
  });
});

describe('buildPatternPlaceholders — optional fields degrade to empty string', () => {
  it('emits empty strings for absent company-address optional fields', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.COMPANY_CEO).toBe('');
    expect(map.COMPANY_HRB).toBe('');
    expect(map.COMPANY_PHONE).toBe('');
    expect(map.COMPANY_VAT_ID).toBe('');
  });

  it('propagates populated address fields through', () => {
    const config = buildConfig({
      compliance: {
        ...buildConfig().compliance,
        company_address: {
          street: 'Musterstraße 12',
          zip_city: '10115 Berlin',
          country: 'Deutschland',
          email: 'legal@example.de',
          phone: '+49 30 12345678',
          vat_id: 'DE123456789',
          hrb: 'HRB 12345 Berlin',
          ceo: 'Erika Mustermann',
        },
      },
    });
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.COMPANY_STREET).toBe('Musterstraße 12');
    expect(map.COMPANY_ZIP_CITY).toBe('10115 Berlin');
    expect(map.COMPANY_CEO).toBe('Erika Mustermann');
    expect(map.COMPANY_HRB).toBe('HRB 12345 Berlin');
  });
});

describe('buildPatternPlaceholders — runtime-env snippets', () => {
  it('emits a valid TypeScript boolean expression for CSP_REPORT_ONLY', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.CSP_REPORT_ONLY).toContain('process.env.CSP_REPORT_ONLY');
    expect(map.CSP_REPORT_ONLY).toContain("=== 'true'");
  });

  it('emits a parseInt-wrapped env lookup for TRUSTED_PROXY_COUNT', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.TRUSTED_PROXY_COUNT).toContain('parseInt(');
    expect(map.TRUSTED_PROXY_COUNT).toContain('process.env.TRUSTED_PROXY_COUNT');
  });
});

describe('buildPatternPlaceholders — reserved passthrough', () => {
  it('layers reserved placeholders into the result unmodified', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.PROJECT_NAME).toBe(reserved.PROJECT_NAME);
    expect(map.APP_NAME).toBe(reserved.APP_NAME);
    expect(map.DEFAULT_LOCALE).toBe(reserved.DEFAULT_LOCALE);
    expect(map.DEFAULT_TENANT_ID).toBe(reserved.DEFAULT_TENANT_ID);
  });
});

describe('LOCALE_PREFIX placeholder resolution (H3, audit)', () => {
  it('substitutes [locale]/ when i18n_strategy=url-prefix (default)', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.LOCALE_PREFIX).toBe('[locale]/');
  });

  it('substitutes empty string when i18n_strategy=none', () => {
    const config = buildConfig({
      localization: { ...buildConfig().localization, i18n_strategy: 'none' },
    });
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    expect(map.LOCALE_PREFIX).toBe('');
  });
});

describe('LOCALE_PREFIX end-to-end substitution (H3 integration, per advisor ISSUE-3)', () => {
  const legalPagesBody = readFileSync(LEGAL_PAGES_PATH, 'utf-8');

  it('substitutes pattern heading to [locale]/ path when i18n_strategy=url-prefix', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    const rendered = substitute(legalPagesBody, map);
    expect(rendered).toMatch(/^### `src\/app\/\[locale\]\/impressum\/page\.tsx`/m);
    expect(rendered).not.toMatch(/^### `src\/app\/impressum\/page\.tsx`/m);
  });

  it('substitutes pattern heading to flat path when i18n_strategy=none', () => {
    const config = buildConfig({
      localization: { ...buildConfig().localization, i18n_strategy: 'none' },
    });
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    const rendered = substitute(legalPagesBody, map);
    expect(rendered).toMatch(/^### `src\/app\/impressum\/page\.tsx`/m);
    expect(rendered).not.toMatch(/^### `src\/app\/\[locale\]\/impressum/m);
  });

  it('never emits literal {{LOCALE_PREFIX}} after substitution', () => {
    const config = buildConfig();
    const reserved = buildReserved(config);
    const map = buildPatternPlaceholders({ config, reserved });
    const rendered = substitute(legalPagesBody, map);
    expect(rendered).not.toMatch(/\{\{LOCALE_PREFIX\}\}/);
  });
});

/**
 * v0.17.3 B1 — consistency-fix integration-tests spanning all 3 claim surfaces
 * (per advisor memory `feedback_consistency_fix_test_scope.md`):
 *
 *   1. pattern-body file-section heading (v0.17.2 B3 already covered)
 *   2. Phase 5 prose renderer in sections.ts (new in v0.17.3 B1)
 *   3. embedded gate-script default path + explicit-arg escape hatch
 *
 * The v0.17.2 H3 fix covered only surface 1; this cycle's B1 extends the
 * test-matrix to 2 + 3. Both i18n strategies (url-prefix + none) exercised
 * in each surface — preventing the partial-regression recurrence that
 * motivated this commit.
 */
describe('LOCALE_PREFIX consistency across all 3 surfaces × 2 strategies (v0.17.3 B1, audit v0.17.2 M)', () => {
  it.each([
    { strategy: 'url-prefix' as const, expectedPrefix: '[locale]/' },
    { strategy: 'none' as const, expectedPrefix: '' },
  ])(
    'surface 2 (Phase 5 prose): all 3 steps use the $strategy-resolved path',
    ({ strategy, expectedPrefix }) => {
      const config = buildConfig({
        localization: { ...buildConfig().localization, i18n_strategy: strategy },
      });
      const reserved = buildReserved(config);
      const map = buildPatternPlaceholders({ config, reserved });

      // Render Phase 5 prose via renderBuildOrder. Only fires when legal-pages-de
      // is in the selected-patterns set — we build a minimal stub below.
      const stubPatterns: LoadedPattern[] = [
        {
          frontmatter: {
            name: 'legal-pages-de',
            category: 'compliance',
            title: 'Legal Pages (DE)',
            description: 'Test stub for legal-pages-de pattern — B1 Phase 5 prose integration.',
            version: 1,
            dependencies: { npm: [], shadcn: [], supabase: [] },
            placeholders: [],
            brief_section: 'Compliance',
            tags: [],
            related: [],
            conflicts_with: [],
            aegis_scan_baseline: 960,
            deprecated: false,
          },
          body: '',
          sourcePath: '/tmp/legal.md',
          relativePath: 'compliance/legal-pages-de.md',
        },
      ];
      const rawProse = renderBuildOrder(stubPatterns, 'en');
      const resolvedProse = substitute(rawProse, map);

      // Step 1: Copy-step paths
      expect(resolvedProse).toContain(`src/app/${expectedPrefix}impressum`);
      expect(resolvedProse).toContain(`src/app/${expectedPrefix}datenschutz`);
      expect(resolvedProse).toContain(`src/app/${expectedPrefix}agb`);

      // Step 2: grep-step path
      expect(resolvedProse).toContain(
        `src/app/${expectedPrefix}{impressum,datenschutz,agb}/`,
      );

      // Step 3: gate-invocation path
      expect(resolvedProse).toContain(
        `bash scripts/check-impressum-completeness.sh src/app/${expectedPrefix}impressum/page.tsx`,
      );

      // No literal placeholder survives substitution
      expect(resolvedProse).not.toMatch(/\{\{LOCALE_PREFIX\}\}/);
    },
  );

  it('surface 3 (gate-script default): hardcoded to [locale]/ path with explicit-arg escape-hatch comment', () => {
    // The gate-script's default PATH stays [locale]/ (wizard default i18n=url-prefix)
    // because the script is copied verbatim into the scaffold. Non-i18n scaffolds
    // use the explicit path arg emitted by Phase 5 prose step 3 — the test above
    // asserts the prose emits the correct explicit arg under i18n=none. Together
    // this closes all 3 surfaces of the H3 "consistent across pattern + prose +
    // gate" CHANGELOG sub-claim.
    const fixturePath = resolve(
      __dirname,
      'fixtures',
      'check-impressum-completeness.sh',
    );
    const fixture = readFileSync(fixturePath, 'utf-8');
    expect(fixture).toContain(
      'IMPRESSUM_PATH="${1:-src/app/[locale]/impressum/page.tsx}"',
    );
    // Explicit-arg escape-hatch documented in comment above the default
    // (the comment spans multiple lines; use [\s\S] to cross newlines)
    expect(fixture).toMatch(/non-i18n scaffolds[\s\S]*LOCALE_PREFIX/);
    expect(fixture).toMatch(/explicit[\s\S]*path[\s\S]*arg/);
  });

  it('byte-equality preserved between fixture and embedded script after B1 comment addition', () => {
    // Re-asserts the M4 byte-equality invariant survives the B1 edit
    // (we added the same comment to both fixture AND embedded script).
    const fixturePath = resolve(
      __dirname,
      'fixtures',
      'check-impressum-completeness.sh',
    );
    const patternPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      'docs',
      'patterns',
      'compliance',
      'legal-pages-de.md',
    );
    const fixture = readFileSync(fixturePath, 'utf-8').trim();
    const patternBody = readFileSync(patternPath, 'utf-8');
    const m = patternBody.match(
      /### Impressum field-completeness gate[\s\S]*?```bash\n([\s\S]*?)```/,
    );
    expect(m).not.toBeNull();
    const embedded = m![1].trim();
    expect(embedded).toBe(fixture);
  });
});
