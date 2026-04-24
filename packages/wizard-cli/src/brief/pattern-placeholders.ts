/**
 * Pattern-placeholder resolver-map builder.
 *
 * Compiles the full substitution-map consumed by the brief-generator
 * when pattern bodies are embedded into the rendered output. Covers
 * every {{UPPER_SNAKE}} marker observed across the v0.17 knowledge-base
 * patterns, plus the compliance-frontmatter placeholder introduced
 * when AGB cancellation-days is substituted out of the [Y] literal.
 *
 * Two resolution classes:
 *
 *   1. Config-derived — the value comes directly from AegisConfig
 *      fields, either required Tier-1 input (company name, locales,
 *      rbac roles) or optional compliance/address sub-objects that
 *      may be unpopulated. Missing optional fields emit an empty
 *      string so a substituted JSX element simply renders nothing.
 *
 *   2. Runtime-env snippet — for placeholders whose production value
 *      must be read from process.env at request-time (CSP toggle,
 *      trusted-proxy-count), the resolver emits a TypeScript
 *      expression string that, once substituted into the pattern
 *      body, yields valid compiling code. This is the bridge between
 *      build-time substitution and runtime configurability.
 *
 * The reserved placeholders (PROJECT_NAME, APP_NAME, DEFAULT_LOCALE,
 * DEFAULT_TENANT_ID, AEGIS_WIZARD_VERSION, GENERATED_AT, LOCALES)
 * stay under the control of buildReservedPlaceholders in
 * template/substitute.ts; this builder layers on top of that set
 * rather than re-deriving it, so single-source-of-truth for the
 * core identity fields is preserved.
 */
import type { AegisConfig } from '../wizard/schema.js';
import { sanitizeForBrief } from './sanitize.js';

export interface PatternPlaceholderContext {
  config: AegisConfig;
  reserved: Readonly<Record<string, string>>;
}

export function buildPatternPlaceholders(
  ctx: PatternPlaceholderContext,
): Record<string, string> {
  const { config, reserved } = ctx;
  const addr = config.compliance.company_address;
  const dpo = config.compliance.dpo;
  const projectHost = `${config.identity.project_name}.example.com`;

  return {
    ...reserved,

    // Identity + address — Tier-1 with optional DSGVO-address sub-object.
    // Every operator-supplied string is run through sanitizeForBrief so
    // a paste-attack cannot synthesize a new Markdown section or open
    // a code-fence inside the embedded pattern body.
    COMPANY_NAME: sanitizeForBrief(config.identity.company_name),
    COMPANY_STREET: sanitizeForBrief(addr?.street ?? ''),
    COMPANY_ZIP_CITY: sanitizeForBrief(addr?.zip_city ?? ''),
    COMPANY_COUNTRY: sanitizeForBrief(addr?.country ?? 'Deutschland'),
    COMPANY_EMAIL: sanitizeForBrief(addr?.email ?? `kontakt@${projectHost}`),
    COMPANY_PHONE: sanitizeForBrief(addr?.phone ?? ''),
    COMPANY_VAT_ID: sanitizeForBrief(addr?.vat_id ?? ''),
    COMPANY_HRB: sanitizeForBrief(addr?.hrb ?? ''),
    COMPANY_CEO: sanitizeForBrief(addr?.ceo ?? ''),
    DPO_NAME: sanitizeForBrief(dpo?.name ?? ''),
    DPO_EMAIL: sanitizeForBrief(dpo?.email ?? ''),

    // Compliance — retention + consent.
    DATA_RETENTION_DAYS: String(config.compliance.data_retention_days),
    CANCELLATION_DAYS: '30',
    CONSENT_VERSION: config.compliance.consent_version,
    LOG_RETENTION_DAYS: '14',
    AUDIT_RETENTION_MONTHS: '12',

    // Deployment + URLs (APP_URL is the canonical brand-URL marker used
    // inside legal-page JSX; STAGING/PRODUCTION are rendered elsewhere
    // by generator.ts but are included for pattern-body completeness).
    APP_URL: config.deployment.production_url ?? `https://${projectHost}`,

    // Auth + RBAC — array fields become JSON for JS/TS code-blocks or
    // a TypeScript union string for literal-type contexts.
    AUTH_METHODS: JSON.stringify(config.auth.methods),
    ROLES_UNION: config.rbac.roles.map((r) => `'${r}'`).join(' | '),
    SENSITIVE_PERSONAL_FIELDS_JSON: JSON.stringify(
      config.rbac.sensitive_personal_fields,
    ),
    PUBLIC_PROFILE_FIELDS_JSON: JSON.stringify(config.rbac.public_profile_fields),

    // Localization — LOCALES_JSON mirrors the reserved LOCALES value
    // under the pattern-conventional *_JSON suffix. LOCALE_PREFIX is a
    // path-segment placeholder: resolves to '[locale]/' when i18n is
    // active so legal-page file-section headings become
    // `src/app/[locale]/impressum/page.tsx`, and empty when i18n is off
    // so they stay `src/app/impressum/page.tsx`. Closes audit H3
    // (pattern body, Phase-5 prose, and gate-script default all used
    // to disagree on the path shape).
    LOCALES_JSON: JSON.stringify(config.localization.locales),
    LOCALE_PREFIX: config.localization.i18n_strategy !== 'none' ? '[locale]/' : '',

    // Advanced security — emit runtime-env snippets so a substituted
    // pattern body still compiles cleanly and reads the real
    // configuration at request time.
    CSP_ADDITIONAL_CONNECT_SRC: JSON.stringify(
      config.advanced.security_headers.additional_connect_src,
    ),
    CSP_REPORT_ONLY: "process.env.CSP_REPORT_ONLY === 'true'",
    TRUSTED_PROXY_COUNT: "parseInt(process.env.TRUSTED_PROXY_COUNT ?? '1', 10)",
    EXTRA_SENSITIVE_KEYS_JSON: '[]',
  };
}
