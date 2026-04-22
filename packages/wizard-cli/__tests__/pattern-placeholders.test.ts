/**
 * Tests for the pattern-placeholder resolver-map builder.
 *
 * Asserts that every {{UPPER_SNAKE}} marker observed across the
 * v0.17 knowledge-base patterns has a resolver, that config-derived
 * values flow through unchanged, that optional sub-objects degrade
 * to empty strings rather than undefined, and that runtime-env
 * snippets are wrapped in TypeScript-valid expressions.
 */
import { describe, it, expect } from 'vitest';
import { AegisConfigSchema, type AegisConfig } from '../src/wizard/schema.js';
import { buildPatternPlaceholders } from '../src/brief/pattern-placeholders.js';
import { buildReservedPlaceholders } from '../src/template/substitute.js';

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
