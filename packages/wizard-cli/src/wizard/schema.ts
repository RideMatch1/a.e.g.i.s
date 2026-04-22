/**
 * Zod schemas for `aegis.config.json` — the serialized output of the wizard
 * and the input for `--non-interactive` runs.
 *
 * Day-1 covers Tier-1 essentials (Identity, Stack, Localization, MultiTenancy,
 * Auth, Rbac, Deployment, Theme, BriefOptions) as fully-defined schemas with
 * user-input-required fields; Tier-2 (Billing, Email, Features, Integrations,
 * Compliance) and Tier-3 (Advanced) have deep-defaults so the top-level
 * AegisConfigSchema is complete-to-validate from a minimal Tier-1-only input.
 *
 * Schema-versioning policy:
 *   - v1.x: additive fields only. Existing configs stay valid.
 *   - v2.x: breaking rename → migration-path via `aegis-wizard config migrate`.
 */
import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const DeployTargetSchema = z.enum([
  'localhost',
  'vercel',
  'dokploy-hetzner',
  'fly-io',
  'railway',
  'custom',
  'skip',
]);

export const AuthMethodSchema = z.enum([
  'password',
  'magic-link',
  'oauth-google',
  'oauth-github',
  'oauth-microsoft',
  'oauth-apple',
  'passkey',
]);

export const MfaPolicySchema = z.enum(['off', 'optional', 'mandatory']);

export const TenantModelSchema = z.enum([
  'none',
  'subdomain',
  'path',
  'header',
]);

export const BriefToneSchema = z.enum(['terse', 'verbose']);

export const BriefLangSchema = z.enum(['en', 'de']);

export const EmailProviderSchema = z.enum([
  'smtp',
  'resend',
  'postmark',
  'sendgrid',
  'brevo',
  'skip',
]);

export const NotificationChannelSchema = z.enum(['in-app', 'email', 'web-push', 'sms']);

export const ChartLibSchema = z.enum(['recharts', 'tremor', 'nivo', 'none']);

export const SearchLibSchema = z.enum([
  'postgres-fts',
  'meilisearch',
  'typesense',
  'algolia',
  'none',
]);

export const BgJobSystemSchema = z.enum([
  'cron-job-org',
  'pg-cron',
  'inngest',
  'trigger-dev',
  'none',
]);

export const AnalyticsSchema = z.enum([
  'plausible',
  'umami',
  'posthog',
  'fathom',
  'ga4',
  'none',
]);

export const ObservabilitySchema = z.enum(['sentry', 'highlight', 'none']);

export const AiProviderSchema = z.enum([
  'mistral-eu',
  'openai',
  'anthropic',
  'groq',
  'google-vertex',
  'local-ollama',
  'none',
]);

// ============================================================================
// Tier-1 essentials (user-driven)
// ============================================================================

export const ProjectIdentitySchema = z.object({
  project_name: z.string().regex(/^[a-z][a-z0-9-]*$/).min(2).max(64),
  project_description: z.string().min(10).max(300),
  app_name: z.string().min(1).max(120),
  company_name: z.string().min(1).max(200),
  target_branche: z.string().max(120),
  target_jurisdiction: z.enum(['DE', 'EU', 'US', 'CH', 'AT', 'other']).default('DE'),
  b2b_or_b2c: z.enum(['b2b', 'b2c', 'both']),
  expected_users: z.enum(['<100', '100-1k', '1k-10k', '10k-100k', '100k+']),
});

export const StackChoicesSchema = z.object({
  framework: z.literal('next-app').default('next-app'),
  database: z.literal('supabase').default('supabase'),
  styling: z.literal('shadcn-tailwind-v4').default('shadcn-tailwind-v4'),
  state: z.literal('zustand').default('zustand'),
  server_state: z.literal('tanstack-query').default('tanstack-query'),
});

export const LocalizationSchema = z.object({
  locales: z.array(z.enum(['de', 'en', 'fr', 'es', 'it', 'nl'])).min(1).default(['de', 'en']),
  default_locale: z.string().default('de'),
  i18n_strategy: z.enum(['url-prefix', 'domain', 'none']).default('url-prefix'),
});

export const MultiTenancySchema = z.object({
  enabled: z.boolean().default(true),
  tenant_model: TenantModelSchema.default('path'),
  default_tenant_id: z.string().uuid().optional(),
});

export const AuthSchema = z.object({
  methods: z.array(AuthMethodSchema).min(1).default(['password']),
  mfa_policy: MfaPolicySchema.default('optional'),
  password_min_length: z.number().int().min(8).max(128).default(12),
  session_length_hours: z.number().int().min(1).max(168).default(24),
  email_confirmation_required: z.boolean().default(true),
});

export const RbacSchema = z.object({
  roles: z.array(z.string().regex(/^[a-z_]+$/)).min(1).default(['admin', 'manager', 'user']),
  default_role_on_signup: z.string().default('user'),
  sensitive_personal_fields: z.array(z.string()).default([]),
  public_profile_fields: z
    .array(z.string())
    .default(['id', 'full_name', 'avatar_url', 'role', 'created_at']),
});

// ============================================================================
// Tier-2 common features (deep-defaults)
// ============================================================================

export const BillingSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['stripe', 'lemon-squeezy', 'paddle', 'polar']).optional(),
  plans: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z-]+$/),
        name: z.string(),
        price_monthly_cents: z.number().int().min(0),
        features: z.array(z.string()),
      }),
    )
    .optional(),
  trial_days: z.number().int().min(0).default(14),
  tax_handling: z.enum(['stripe-tax', 'manual', 'none']).default('stripe-tax'),
});

export const EmailSchema = z.object({
  provider: EmailProviderSchema.default('smtp'),
  from_address: z.string().email().optional(),
  from_name: z.string().optional(),
  marketing_enabled: z.boolean().default(false),
  newsletter_enabled: z.boolean().default(false),
  templates_system: z.enum(['react-email', 'mjml', 'inline', 'none']).default('react-email'),
});

export const FeaturesSchema = z.object({
  calendar: z.boolean().default(false),
  kanban: z.boolean().default(false),
  chat: z
    .object({
      enabled: z.boolean(),
      ai_powered: z.boolean(),
    })
    .default({ enabled: false, ai_powered: false }),
  knowledge_base: z.boolean().default(false),
  dashboard_widgets: z
    .object({
      enabled: z.boolean(),
      chart_lib: ChartLibSchema,
    })
    .default({ enabled: true, chart_lib: 'recharts' }),
  reporting_exports: z.boolean().default(false),
  search: z
    .object({
      enabled: z.boolean(),
      lib: SearchLibSchema,
    })
    .default({ enabled: false, lib: 'postgres-fts' }),
  command_palette: z.boolean().default(true),
  file_upload: z
    .object({
      enabled: z.boolean(),
      storage: z.enum(['supabase-storage', 's3', 'r2']),
      max_size_mb: z.number().int().min(1).max(1000),
    })
    .default({ enabled: false, storage: 'supabase-storage', max_size_mb: 10 }),
  notifications: z.array(NotificationChannelSchema).default(['in-app', 'email']),
  webhooks: z
    .object({
      incoming: z.boolean(),
      outgoing: z.boolean(),
    })
    .default({ incoming: false, outgoing: false }),
  team_management: z.boolean().default(false),
  feature_flags: z.enum(['growthbook', 'flagsmith', 'custom', 'none']).default('none'),
});

export const IntegrationsSchema = z.object({
  ai: z
    .object({
      provider: AiProviderSchema,
      features: z.array(z.enum(['chat', 'rag-search', 'content-gen', 'predictions'])),
      pii_guard: z.boolean(),
    })
    .default({ provider: 'none', features: [], pii_guard: true }),
  analytics: AnalyticsSchema.default('none'),
  observability: ObservabilitySchema.default('none'),
  background_jobs: BgJobSystemSchema.default('none'),
  external_services: z
    .array(
      z.enum([
        'zapier',
        'slack',
        'discord',
        'microsoft-teams',
        'telegram',
        'twilio-sms',
        'whatsapp-business',
        'calendly',
        'cal-com',
      ]),
    )
    .default([]),
});

export const ComplianceSchema = z.object({
  dsgvo_kit: z.boolean().default(true),
  legal_pages: z
    .array(z.enum(['impressum', 'datenschutz', 'agb']))
    .default(['impressum', 'datenschutz']),
  cookie_banner: z.boolean().default(true),
  data_retention_days: z.number().int().min(1).max(3650).default(30),
  audit_log: z.boolean().default(true),
  consent_version: z.string().default('v1'),
  company_address: z
    .object({
      street: z.string(),
      zip_city: z.string(),
      country: z.string().default('Deutschland'),
      email: z.string().email(),
      phone: z.string().optional(),
      vat_id: z.string().optional(),
      hrb: z.string().optional(),
      ceo: z.string().optional(),
    })
    .optional(),
  dpo: z
    .object({
      name: z.string(),
      email: z.string().email(),
    })
    .optional(),
});

// ============================================================================
// Tier-3 advanced (opt-in)
// ============================================================================

export const AdvancedSchema = z.object({
  security_headers: z
    .object({
      csp_report_only: z.boolean(),
      additional_connect_src: z.array(z.string()),
      hsts_preload: z.boolean(),
    })
    .default({ csp_report_only: false, additional_connect_src: [], hsts_preload: true }),
  rate_limiting: z
    .object({
      auth_rate_per_minute: z.number().int().min(1).max(1000).default(5),
      api_rate_per_minute: z.number().int().min(1).max(10000).default(60),
      backend: z.enum(['in-memory', 'upstash-redis']).default('in-memory'),
    })
    .default({}),
  testing: z
    .object({
      coverage_target: z.number().min(0).max(100).default(80),
      playwright_e2e: z.boolean().default(true),
      ci_provider: z.enum(['github-actions', 'gitlab-ci', 'circle-ci', 'none']).default('github-actions'),
    })
    .default({}),
  accessibility: z.enum(['WCAG-A', 'WCAG-AA', 'WCAG-AAA']).default('WCAG-AA'),
  pwa_enabled: z.boolean().default(false),
  docs_generation: z
    .object({
      storybook: z.boolean(),
      user_docs: z.boolean(),
    })
    .default({ storybook: false, user_docs: false }),
});

// ============================================================================
// Deployment
// ============================================================================

export const DeploymentSchema = z.object({
  target: DeployTargetSchema.default('localhost'),
  production_url: z.string().url().optional(),
  staging_url: z.string().url().optional(),
  env_vars_needed: z.array(z.string()).default([]),
});

// ============================================================================
// Theme (from ui.shadcn.com/create)
// ============================================================================

export const ThemeSchema = z.object({
  shadcn_preset_code: z.string().optional(),
  custom_colors: z.record(z.string(), z.string()).optional(),
  radius: z.enum(['0', '0.3', '0.5', '0.75', '1.0']).default('0.5'),
  font: z.enum(['inter', 'geist', 'system', 'custom']).default('inter'),
  dark_mode_enabled: z.boolean().default(true),
});

// ============================================================================
// Brief-generation options
// ============================================================================

export const BriefOptionsSchema = z.object({
  tone: BriefToneSchema.default('terse'),
  lang: BriefLangSchema.default('en'),
  include_examples: z.boolean().default(true),
  include_troubleshooting: z.boolean().default(true),
  target_agent: z
    .enum(['generic', 'claude-code', 'codex', 'cursor', 'aider'])
    .default('generic'),
});

// ============================================================================
// Selected patterns (computed from other selections)
// ============================================================================

export const SelectedPatternsSchema = z.array(
  z.object({
    category: z.enum(['foundation', 'compliance', 'integration', 'feature']),
    name: z.string(),
    version: z.number().int().positive(),
    optional_flags: z.record(z.string(), z.boolean()).optional(),
  }),
);

// ============================================================================
// Top-level aegis.config.json schema
// ============================================================================

export const AegisConfigSchema = z.object({
  $schema: z
    .literal('https://aegis.dev/schemas/config-v1.json')
    .default('https://aegis.dev/schemas/config-v1.json'),
  aegis_version: z.string().regex(/^\d+\.\d+\.\d+/),
  generated_at: z.string().datetime(),

  identity: ProjectIdentitySchema,
  stack: StackChoicesSchema.default({}),
  localization: LocalizationSchema.default({}),
  multi_tenancy: MultiTenancySchema.default({}),
  auth: AuthSchema.default({}),
  rbac: RbacSchema.default({}),

  billing: BillingSchema.default({}),
  email: EmailSchema.default({}),
  features: FeaturesSchema.default({}),
  integrations: IntegrationsSchema.default({}),
  compliance: ComplianceSchema.default({}),

  advanced: AdvancedSchema.default({}),
  deployment: DeploymentSchema.default({}),
  theme: ThemeSchema.default({}),
  brief_options: BriefOptionsSchema.default({}),

  selected_patterns: SelectedPatternsSchema.default([]),
}).refine(
  (cfg) => cfg.localization.locales.some((l) => l === cfg.localization.default_locale),
  {
    message: 'localization.default_locale must be one of localization.locales',
    path: ['localization', 'default_locale'],
  },
);

export type AegisConfig = z.infer<typeof AegisConfigSchema>;
export type ProjectIdentity = z.infer<typeof ProjectIdentitySchema>;
export type DeployTarget = z.infer<typeof DeployTargetSchema>;
export type TenantModel = z.infer<typeof TenantModelSchema>;
export type EmailProvider = z.infer<typeof EmailProviderSchema>;
