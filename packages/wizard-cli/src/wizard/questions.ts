/**
 * Tier-1 wizard question catalog — 15 essentials, ~8 min user-time.
 *
 * Structure: a declarative array of `WizardQuestion` objects consumed by
 * `flow.ts` which dispatches them to `@clack/prompts` by type. Keeping the
 * catalog declarative makes the flow testable and the brief-generator (Day-2)
 * able to cross-reference what was asked.
 *
 * Day-2 will add Tier-2 (25 common) and Tier-3 (30-40 advanced). They will
 * live in `questions-tier2.ts` / `questions-tier3.ts` and get composed in
 * `flow.ts` behind grouped skip-flags.
 */

// ============================================================================
// Question-type definitions
// ============================================================================

export type WizardQuestion =
  | TextQuestion
  | SelectQuestion
  | MultiSelectQuestion
  | ConfirmQuestion;

interface QuestionBase {
  id: string;
  prompt: string;
  hint?: string;
  /** Tier-1 is always required; Tier-2/3 may skip via group-flags. */
  tier: 1 | 2 | 3;
  /** UX grouping for skip-by-group in Tier-2+. */
  group?: string;
}

export interface TextQuestion extends QuestionBase {
  type: 'text';
  placeholder?: string;
  initialValue?: string;
  /** Regex-string (serializable) validated at `flow.ts` level. */
  validateRegex?: string;
  validateMessage?: string;
  minLength?: number;
  maxLength?: number;
  /** Allow empty string ⇒ falls back to `initialValue`. */
  optional?: boolean;
}

export interface SelectQuestion extends QuestionBase {
  type: 'select';
  options: Array<{ value: string; label: string; hint?: string }>;
  initialValue?: string;
}

export interface MultiSelectQuestion extends QuestionBase {
  type: 'multiselect';
  options: Array<{ value: string; label: string; hint?: string }>;
  initialValues?: string[];
  required?: boolean;
}

export interface ConfirmQuestion extends QuestionBase {
  type: 'confirm';
  initialValue?: boolean;
}

// ============================================================================
// Tier-1 catalog (15 questions)
// ============================================================================

export const TIER_1_QUESTIONS: WizardQuestion[] = [
  // Q1 — project-name (kebab-regex)
  {
    id: 'project_name',
    tier: 1,
    type: 'text',
    prompt: 'Project name (kebab-case, used for directory + package identifier)',
    hint: 'Lowercase letters, digits, hyphens. Must start with a letter.',
    placeholder: 'my-saas',
    validateRegex: '^[a-z][a-z0-9-]*$',
    validateMessage: 'Must match ^[a-z][a-z0-9-]*$ (lowercase, digits, hyphens; starts with letter)',
    minLength: 2,
    maxLength: 64,
  },
  // Q2 — project-description
  {
    id: 'project_description',
    tier: 1,
    type: 'text',
    prompt: 'One-line project description (1-2 sentences, used in README + brief §1)',
    hint: 'What does the product do?',
    placeholder: 'Generic B2B SaaS backend with multi-tenant RBAC + audit-log.',
    minLength: 10,
    maxLength: 300,
  },
  // Q3 — target branche
  {
    id: 'target_branche',
    tier: 1,
    type: 'select',
    prompt: 'Target industry / branche',
    hint: 'Picks pattern-defaults; "other" = free-form.',
    options: [
      { value: 'wellness', label: 'Wellness / Spa' },
      { value: 'hospitality', label: 'Hospitality / Hotel' },
      { value: 'pet', label: 'Pet services' },
      { value: 'crm', label: 'CRM / sales ops' },
      { value: 'cms', label: 'CMS / publishing' },
      { value: 'marketplace', label: 'Marketplace / two-sided platform' },
      { value: 'other', label: 'Other (generic)' },
    ],
    initialValue: 'other',
  },
  // Q4 — expected-users
  {
    id: 'expected_users',
    tier: 1,
    type: 'select',
    prompt: 'Expected user-count at launch',
    hint: 'Affects schema-indexing + caching defaults.',
    options: [
      { value: '<100', label: 'Under 100' },
      { value: '100-1k', label: '100 – 1,000' },
      { value: '1k-10k', label: '1,000 – 10,000' },
      { value: '10k-100k', label: '10,000 – 100,000' },
      { value: '100k+', label: 'Over 100,000' },
    ],
    initialValue: '100-1k',
  },
  // Q5 — b2b / b2c / both
  {
    id: 'b2b_or_b2c',
    tier: 1,
    type: 'select',
    prompt: 'B2B, B2C, or both?',
    hint: 'Affects tenant-model + onboarding flows.',
    options: [
      { value: 'b2b', label: 'B2B (companies as tenants)' },
      { value: 'b2c', label: 'B2C (individual users)' },
      { value: 'both', label: 'Both (hybrid)' },
    ],
    initialValue: 'b2b',
  },
  // Q6 — multi-tenant model
  {
    id: 'tenant_model',
    tier: 1,
    type: 'select',
    prompt: 'Multi-tenant routing model',
    hint: 'How are tenants distinguished at the URL-layer?',
    options: [
      { value: 'none', label: 'None (single-tenant internal tool)' },
      { value: 'subdomain', label: 'Subdomain (tenant.example.com)' },
      { value: 'path', label: 'Path prefix (example.com/t/tenant)' },
      { value: 'header', label: 'Header (X-Tenant, API-first)' },
    ],
    initialValue: 'path',
  },
  // Q7 — languages
  {
    id: 'locales',
    tier: 1,
    type: 'multiselect',
    prompt: 'Which locales should the app support?',
    hint: 'Pick at least one. DE + EN is the institutional default.',
    options: [
      { value: 'de', label: 'German (de)' },
      { value: 'en', label: 'English (en)' },
      { value: 'fr', label: 'French (fr)' },
      { value: 'es', label: 'Spanish (es)' },
      { value: 'it', label: 'Italian (it)' },
      { value: 'nl', label: 'Dutch (nl)' },
    ],
    initialValues: ['de', 'en'],
    required: true,
  },
  // Q8 — deploy-target
  {
    id: 'deployment_target',
    tier: 1,
    type: 'select',
    prompt: 'Primary deploy target',
    hint: 'Emits the matching deploy-config files. "localhost" = dev-only.',
    options: [
      { value: 'localhost', label: 'Localhost (dev-only)' },
      { value: 'vercel', label: 'Vercel' },
      { value: 'dokploy-hetzner', label: 'Dokploy on Hetzner' },
      { value: 'fly-io', label: 'Fly.io' },
      { value: 'railway', label: 'Railway' },
      { value: 'custom', label: 'Custom (I will configure manually)' },
    ],
    initialValue: 'vercel',
  },
  // Q9 — jurisdiction
  {
    id: 'target_jurisdiction',
    tier: 1,
    type: 'select',
    prompt: 'Primary jurisdiction for compliance',
    hint: 'Drives DSGVO / legal-pages / cookie-banner defaults.',
    options: [
      { value: 'DE', label: 'Germany (DE)' },
      { value: 'EU', label: 'European Union (other EU)' },
      { value: 'CH', label: 'Switzerland (CH)' },
      { value: 'AT', label: 'Austria (AT)' },
      { value: 'US', label: 'United States (US)' },
      { value: 'other', label: 'Other / global' },
    ],
    initialValue: 'DE',
  },
  // Q10 — shadcn theme-paste (free-text optional)
  {
    id: 'shadcn_preset_code',
    tier: 1,
    type: 'text',
    prompt: 'shadcn theme preset code (optional — paste from ui.shadcn.com/create, or leave blank for default)',
    hint: 'Press Enter to skip and use the default Inter / radius 0.5 theme.',
    placeholder: '@layer base { :root { --radius: 0.5rem; --background: oklch(...); ... } }',
    optional: true,
    maxLength: 20000,
  },
  // Q11 — brand-colors (free-text optional)
  {
    id: 'brand_colors',
    tier: 1,
    type: 'text',
    prompt: 'Brand colors override (optional — comma-separated hex codes)',
    hint: 'e.g. "primary=#1e40af,accent=#f59e0b". Leave blank to use shadcn preset.',
    placeholder: 'primary=#1e40af,accent=#f59e0b',
    optional: true,
    maxLength: 500,
  },
  // Q12 — payment-required
  {
    id: 'billing_enabled',
    tier: 1,
    type: 'confirm',
    prompt: 'Does the app need payments / subscriptions?',
    hint: 'If yes, the billing pack (Stripe by default) is queued for Tier-2.',
    initialValue: false,
  },
  // Q13 — email-provider
  {
    id: 'email_provider',
    tier: 1,
    type: 'select',
    prompt: 'Transactional email provider',
    hint: 'For password-resets, notifications, receipts.',
    options: [
      { value: 'smtp', label: 'SMTP (self-host)' },
      { value: 'resend', label: 'Resend' },
      { value: 'postmark', label: 'Postmark' },
      { value: 'sendgrid', label: 'SendGrid' },
      { value: 'brevo', label: 'Brevo (ex-SendinBlue)' },
      { value: 'skip', label: 'Skip for now' },
    ],
    initialValue: 'smtp',
  },
  // Q14 — admin-panel-needed
  {
    id: 'admin_panel',
    tier: 1,
    type: 'confirm',
    prompt: 'Include an admin panel (users, tenants, audit-log viewer)?',
    hint: 'Recommended yes for all SaaS — almost always needed.',
    initialValue: true,
  },
  // Q15 — public-landing-page
  {
    id: 'public_landing',
    tier: 1,
    type: 'confirm',
    prompt: 'Include a public landing page (marketing home, pricing)?',
    hint: 'Recommended yes for B2C and B2B with self-serve signup.',
    initialValue: true,
  },
];

/** Convenience — get a question by ID, throws on unknown. Tests rely on this. */
export function getQuestionById(id: string): WizardQuestion {
  const q = TIER_1_QUESTIONS.find((x) => x.id === id);
  if (!q) {
    throw new Error(`Unknown question id: ${id}`);
  }
  return q;
}

/** All Tier-1 IDs in display-order. */
export const TIER_1_IDS = TIER_1_QUESTIONS.map((q) => q.id);
