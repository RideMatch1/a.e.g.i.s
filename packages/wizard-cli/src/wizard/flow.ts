/**
 * Wizard orchestration — runs `@clack/prompts` through the Tier-1 catalog and
 * assembles a validated `AegisConfig`.
 *
 * Responsibilities:
 *   1. Ask Tier-1 21 questions in order (15 scaffold + 6 legal identity).
 *   2. Validate each answer against the per-question constraints.
 *   3. Map raw-answers to structured AegisConfig sub-objects.
 *   4. Run AegisConfigSchema.parse for the final end-to-end validation.
 *   5. Return the validated config; caller handles the file-IO write.
 */
import { randomUUID } from 'node:crypto';
import {
  intro,
  outro,
  note,
  text,
  select,
  multiselect,
  confirm,
  isCancel,
  cancel,
} from '@clack/prompts';
import chalk from 'chalk';
import { AegisConfigSchema, type AegisConfig } from './schema.js';
import {
  TIER_1_QUESTIONS,
  type WizardQuestion,
  type TextQuestion,
  type SelectQuestion,
  type MultiSelectQuestion,
  type ConfirmQuestion,
} from './questions.js';

// ============================================================================
// Public types
// ============================================================================

export interface WizardResult {
  config: AegisConfig;
  /** Raw answer-map keyed by question-id, retained for future Tier-2 wiring. */
  answers: Record<string, string | string[] | boolean>;
}

export interface RunWizardOptions {
  /** Pre-filled project-name from CLI positional arg; skips Q1 if set + valid. */
  projectName?: string;
  /** Override the AEGIS wizard version stamped into config. */
  aegisVersion: string;
}

// ============================================================================
// Main orchestrator
// ============================================================================

export async function runWizard(opts: RunWizardOptions): Promise<WizardResult> {
  intro(chalk.cyan('AEGIS Wizard — scaffold a new Next.js + Supabase SaaS'));

  note(
    [
      'Tier-1 asks 21 essentials (~10 min).',
      'Tier-2 / Tier-3 land in a future release.',
      'Press Ctrl+C anytime to abort.',
    ].join('\n'),
    'About',
  );

  const answers: Record<string, string | string[] | boolean> = {};

  // Fast-path Q1 when project-name came from the CLI positional.
  const cliName = opts.projectName?.trim();
  if (cliName && /^[a-z][a-z0-9-]*$/.test(cliName) && cliName.length >= 2 && cliName.length <= 64) {
    answers.project_name = cliName;
  }

  for (const q of TIER_1_QUESTIONS) {
    if (answers[q.id] !== undefined) {
      continue;
    }
    const value = await askOne(q);
    answers[q.id] = value;
  }

  // ------------------------------------------------------------------
  // Assemble config
  // ------------------------------------------------------------------
  const projectName = assertString(answers.project_name);
  const now = new Date().toISOString();
  const config = AegisConfigSchema.parse({
    aegis_version: opts.aegisVersion,
    generated_at: now,

    identity: {
      project_name: projectName,
      project_description: assertString(answers.project_description),
      app_name: pickAppName(answers.app_name, projectName),
      company_name: assertString(answers.company_name),
      target_branche: assertString(answers.target_branche),
      target_jurisdiction: assertString(answers.target_jurisdiction),
      b2b_or_b2c: assertString(answers.b2b_or_b2c),
      expected_users: assertString(answers.expected_users),
    },

    stack: {},

    localization: {
      locales: assertStringArray(answers.locales),
      default_locale: pickDefaultLocale(assertStringArray(answers.locales)),
      i18n_strategy: 'url-prefix',
    },

    multi_tenancy: {
      enabled: assertString(answers.tenant_model) !== 'none',
      tenant_model: assertString(answers.tenant_model),
      default_tenant_id: randomUUID(),
    },

    auth: {},
    rbac: {},

    billing: {
      enabled: assertBoolean(answers.billing_enabled),
    },

    email: {
      provider: assertString(answers.email_provider),
    },

    features: {},
    integrations: {},

    compliance: {
      dsgvo_kit: shouldEnableDsgvo(assertString(answers.target_jurisdiction)),
      legal_pages: legalPagesForJurisdiction(assertString(answers.target_jurisdiction)),
      company_address: buildCompanyAddress(answers),
    },

    advanced: {},

    deployment: {
      target: assertString(answers.deployment_target),
    },

    theme: buildTheme(answers),

    brief_options: {},

    selected_patterns: [
      { category: 'foundation', name: 'multi-tenant-supabase', version: 1 },
      { category: 'foundation', name: 'auth-supabase-full', version: 1 },
    ],
  });

  outro(chalk.green(`Wizard complete. ${TIER_1_QUESTIONS.length} questions answered.`));

  return { config, answers };
}

// ============================================================================
// Question dispatch
// ============================================================================

async function askOne(q: WizardQuestion): Promise<string | string[] | boolean> {
  switch (q.type) {
    case 'text':
      return askText(q);
    case 'select':
      return askSelect(q);
    case 'multiselect':
      return askMultiSelect(q);
    case 'confirm':
      return askConfirm(q);
  }
}

async function askText(q: TextQuestion): Promise<string> {
  const response = await text({
    message: composeMessage(q),
    placeholder: q.placeholder,
    initialValue: q.initialValue,
    validate: (raw) => {
      if (!raw || raw.length === 0) {
        if (q.optional) return undefined;
        return 'Required.';
      }
      if (q.minLength && raw.length < q.minLength) {
        return `At least ${q.minLength} characters.`;
      }
      if (q.maxLength && raw.length > q.maxLength) {
        return `At most ${q.maxLength} characters.`;
      }
      if (q.validateRegex) {
        const re = new RegExp(q.validateRegex);
        if (!re.test(raw)) {
          return q.validateMessage ?? `Must match ${q.validateRegex}`;
        }
      }
      return undefined;
    },
  });
  if (isCancel(response)) {
    cancel('Aborted.');
    process.exit(1);
  }
  return typeof response === 'string' ? response : '';
}

async function askSelect(q: SelectQuestion): Promise<string> {
  const response = await select({
    message: composeMessage(q),
    options: q.options,
    initialValue: q.initialValue,
  });
  if (isCancel(response)) {
    cancel('Aborted.');
    process.exit(1);
  }
  return String(response);
}

async function askMultiSelect(q: MultiSelectQuestion): Promise<string[]> {
  const response = await multiselect({
    message: composeMessage(q),
    options: q.options,
    initialValues: q.initialValues,
    required: q.required ?? true,
  });
  if (isCancel(response)) {
    cancel('Aborted.');
    process.exit(1);
  }
  return Array.isArray(response) ? response.map(String) : [];
}

async function askConfirm(q: ConfirmQuestion): Promise<boolean> {
  const response = await confirm({
    message: composeMessage(q),
    initialValue: q.initialValue,
  });
  if (isCancel(response)) {
    cancel('Aborted.');
    process.exit(1);
  }
  return typeof response === 'boolean' ? response : false;
}

function composeMessage(q: WizardQuestion): string {
  if (!q.hint) return q.prompt;
  return `${q.prompt}\n${chalk.dim(q.hint)}`;
}

// ============================================================================
// Type-narrowing helpers (answer-map is stringly-typed at the map level)
// ============================================================================

function assertString(v: unknown): string {
  if (typeof v !== 'string') {
    throw new Error(`Expected string, got ${typeof v}`);
  }
  return v;
}

function assertStringArray(v: unknown): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new Error('Expected string[]');
  }
  return v as string[];
}

function assertBoolean(v: unknown): boolean {
  if (typeof v !== 'boolean') {
    throw new Error(`Expected boolean, got ${typeof v}`);
  }
  return v;
}

// ============================================================================
// Config-field derivation helpers
// ============================================================================

/** kebab-case `my-saas` → TitleCase `My SaaS` (loose fallback for app_name). */
function deriveAppName(projectName: string): string {
  return projectName
    .split('-')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(' ');
}

/**
 * Respect an operator-supplied app_name when present, fall back to the
 * kebab-case-to-TitleCase derivation when the user left the question
 * blank. Empty-string handling matches the question's optional flag in
 * questions.ts. Never throws: the schema's min(1) is enforced by the
 * derivation returning at least one character for any valid
 * project_name.
 */
function pickAppName(
  raw: string | string[] | boolean | undefined,
  projectName: string,
): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return deriveAppName(projectName);
}

/**
 * Assemble ComplianceSchema.company_address from the six legal-identity
 * Tier-1 answers. Returns undefined when every field is blank so the
 * sub-object stays optional at the Zod level — operators outside German
 * jurisdictions can leave the block empty without tripping validation.
 * Required fields for DE are enforced downstream in the brief-renderer
 * output (legal-pages template renders empty tags when a field is
 * unfilled, flagged via JSX-comment hints in the pattern body).
 */
function buildCompanyAddress(
  answers: Record<string, string | string[] | boolean>,
):
  | {
      street: string;
      zip_city: string;
      country: string;
      email: string;
      phone?: string;
      vat_id?: string;
    }
  | undefined {
  const email = typeof answers.company_email === 'string' ? answers.company_email.trim() : '';
  const street = typeof answers.company_street === 'string' ? answers.company_street.trim() : '';
  const zipCity = typeof answers.company_zip_city === 'string' ? answers.company_zip_city.trim() : '';
  const vatId = typeof answers.company_vat_id === 'string' ? answers.company_vat_id.trim() : '';

  if (!email && !street && !zipCity && !vatId) return undefined;

  const addr: {
    street: string;
    zip_city: string;
    country: string;
    email: string;
    phone?: string;
    vat_id?: string;
  } = {
    street,
    zip_city: zipCity,
    country: 'Deutschland',
    email,
  };
  if (vatId) addr.vat_id = vatId;
  return addr;
}

/** DSGVO-kit defaults ON for EU/DE/AT; OFF default for US/other. User can override. */
function shouldEnableDsgvo(jurisdiction: string): boolean {
  return ['DE', 'EU', 'AT', 'CH'].includes(jurisdiction);
}

/**
 * Pick default_locale deterministically from the user's selected locales.
 * Preference order: 'de' > 'en' > first-selected. Guaranteed to return a
 * locale that exists in the input array. The Zod refine on
 * AegisConfigSchema is the backstop if an operator bypasses this helper
 * via a hand-authored --config file.
 */
export function pickDefaultLocale(locales: string[]): string {
  if (locales.length === 0) {
    throw new Error('pickDefaultLocale requires at least one locale');
  }
  if (locales.includes('de')) return 'de';
  if (locales.includes('en')) return 'en';
  return locales[0];
}

/**
 * Derive the default legal_pages selection for a given jurisdiction. Only
 * DE gets the two baseline pages because legal-pages-de is written against
 * German law specifically (§5 TMG/DDG, DSGVO Art. 13 templates). AT shares
 * an adjacent legal framework but has distinct Impressum rules under ECG
 * and is intentionally not auto-selected pending a dedicated AT pattern.
 * CH, EU, US, and other jurisdictions get an empty list so the brief does
 * not reference German-specific legal content they do not need and must
 * not claim to satisfy.
 */
export function legalPagesForJurisdiction(
  jurisdiction: string,
): Array<'impressum' | 'datenschutz' | 'agb'> {
  if (jurisdiction === 'DE') {
    return ['impressum', 'datenschutz'];
  }
  return [];
}

function buildTheme(
  answers: Record<string, string | string[] | boolean>,
): { shadcn_preset_code?: string; custom_colors?: Record<string, string> } {
  const theme: { shadcn_preset_code?: string; custom_colors?: Record<string, string> } = {};
  const presetRaw = answers.shadcn_preset_code;
  if (typeof presetRaw === 'string' && presetRaw.trim().length > 0) {
    theme.shadcn_preset_code = presetRaw.trim();
  }
  const colorsRaw = answers.brand_colors;
  if (typeof colorsRaw === 'string' && colorsRaw.trim().length > 0) {
    const pairs = colorsRaw.split(',').map((p) => p.trim()).filter(Boolean);
    const custom: Record<string, string> = {};
    for (const pair of pairs) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const key = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (key && value) {
          custom[key] = value;
        }
      }
    }
    if (Object.keys(custom).length > 0) {
      theme.custom_colors = custom;
    }
  }
  return theme;
}
