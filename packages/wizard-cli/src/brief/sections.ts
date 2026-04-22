/**
 * Brief-section renderers — one function per section of the canonical
 * agent-brief structure.
 *
 * Each function takes (config, patterns, lang?) and returns a Markdown
 * chunk. Sections that should be omitted under some configs return null
 * so the orchestrator can filter them out without emitting empty blocks.
 *
 * The chunks are later joined by `---` separators in generator.ts, then
 * run through substitute() to fill reserved placeholders like
 * {{PROJECT_NAME}} and {{DEFAULT_TENANT_ID}}.
 *
 * The optional `lang` parameter selects the static-string catalog via
 * i18n.getMessage. Dynamic interpolations (file-paths, command names,
 * pattern references, URLs) stay language-agnostic. When `lang` is
 * omitted or 'en', English strings are used (backward-compatible with
 * the Day-2 terse-en path).
 */
import type { AegisConfig } from '../wizard/schema.js';
import type { LoadedPattern } from '../patterns/loader.js';
import { getMessage, type BriefLang } from './i18n/index.js';

// ============================================================================
// Small helpers
// ============================================================================

function patternRefList(patterns: readonly LoadedPattern[]): string {
  return patterns
    .map((p) => `${p.frontmatter.category}/${p.frontmatter.name}`)
    .join(' · ');
}

function hasLocale(config: AegisConfig, locale: string): boolean {
  return config.localization.locales.includes(locale as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl');
}

function companyInfoLine(config: AegisConfig): string {
  const addr = config.compliance.company_address;
  if (!addr) {
    return `${config.identity.company_name} · address-on-file-missing (populate in config)`;
  }
  const parts = [
    config.identity.company_name,
    addr.street,
    addr.zip_city,
    addr.country,
    addr.email,
  ].filter(Boolean);
  return parts.join(' · ');
}

function deployTargetPrettyName(target: string): string {
  switch (target) {
    case 'localhost':
      return 'Localhost-only (manual deploy later)';
    case 'vercel':
      return 'Vercel';
    case 'dokploy-hetzner':
      return 'Dokploy on Hetzner';
    case 'fly-io':
      return 'Fly.io';
    case 'railway':
      return 'Railway';
    case 'custom':
      return 'Custom (operator-configured)';
    case 'skip':
      return 'Not-yet-chosen';
    default:
      return target;
  }
}

// ============================================================================
// Section renderers
// ============================================================================

export function renderHeader(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const nowIso = config.generated_at;
  const locales = config.localization.locales.join(' + ').toUpperCase();
  const deploy = deployTargetPrettyName(config.deployment.target);
  const stackCore = [
    'Next.js 16',
    'TypeScript strict',
    'Tailwind CSS v4',
    'shadcn/ui',
    'Supabase',
    'Zustand',
    'TanStack Query',
    'React Hook Form',
    'Zod',
  ].join(' · ');

  const title = lang === 'de' ? 'Agenten-Brief' : 'Agent Brief';

  return [
    `# ${title}: ${config.identity.project_name}`,
    '',
    `**${getMessage(lang, 'header.generated_by')}:** AEGIS Wizard v{{AEGIS_WIZARD_VERSION}} · ${nowIso} · \`aegis-wizard new ${config.identity.project_name}\``,
    `**${getMessage(lang, 'header.project_type')}:** ${config.identity.project_description}`,
    `**${getMessage(lang, 'header.stack')}:** ${stackCore}`,
    `**${getMessage(lang, 'header.selected_patterns')}:** ${patternRefList(patterns)}`,
    `**${getMessage(lang, 'header.deployment_target')}:** ${deploy}`,
    `**${getMessage(lang, 'header.languages')}:** ${locales}`,
    `**${getMessage(lang, 'header.company_info')}:** ${companyInfoLine(config)}`,
    `**${getMessage(lang, 'header.expected_grade')}:** ${getMessage(lang, 'header.grade_target')}`,
  ].join('\n');
}

export function renderAgentInstructions(lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `agent_instructions.${key}`);
  return [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
    `## ${k('operating_rules')}`,
    '',
    `1. **${k('rule_boil_the_lake')}** - ${k('rule_boil_body')}`,
    `2. **${k('rule_search')}** - ${k('rule_search_body')}`,
    `3. **${k('rule_explicit_paths')}** - ${k('rule_explicit_body')}`,
    `4. **${k('rule_localhost')}** - ${k('rule_localhost_body')}`,
    `5. **${k('rule_halt')}** - ${k('rule_halt_body')}`,
    `6. **${k('rule_defensive')}** - ${k('rule_defensive_body')}`,
    '',
    `## ${k('ask_vs_decide')}`,
    '',
    `**${k('decide_autonomously')}:** ${k('decide_body')}`,
    '',
    `**${k('ask_user')}:** ${k('ask_body')}`,
  ].join('\n');
}

export function renderCoreRules(config: AegisConfig, lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `core_rules.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    `## ${k('multi_tenancy')}`,
    k('multi_tenancy_body'),
    '',
  ];

  if (hasLocale(config, 'de')) {
    lines.push(
      `## ${k('umlaute_heading')}`,
      k('umlaute_body'),
      '- Gate: `grep -rn "Gruss\\|Raeume\\|Ueber\\|Foer\\|Pruefen" src/app src/components` must return zero.',
      '',
    );
  }

  lines.push(
    `## ${k('zod_strict')}`,
    k('zod_body'),
    '',
    `## ${k('optimistic')}`,
    k('optimistic_body'),
    '',
    `## ${k('no_new_deps')}`,
    k('no_deps_body'),
  );

  return lines.join('\n');
}

export function renderInstallation(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const hasI18n = patterns.some((p) => p.frontmatter.name === 'i18n-next-intl');
  const projectName = config.identity.project_name;
  const k = (key: string): string => getMessage(lang, `installation.${key}`);

  const npmDeps = [
    '@supabase/supabase-js@latest',
    '@supabase/ssr@latest',
    'zustand@latest',
    '@tanstack/react-query@latest',
    'react-hook-form@latest',
    '@hookform/resolvers@latest',
    'zod@latest',
  ];
  if (hasI18n) npmDeps.push('next-intl@latest');

  const shadcnComponents = [
    'button input label card form alert',
    'dialog sheet drawer popover dropdown-menu',
    'table data-table',
    'avatar badge separator skeleton',
    'toast sonner progress spinner',
    'select combobox checkbox radio-group switch',
    'tabs accordion',
    'breadcrumb pagination',
    'command',
    'date-picker calendar',
  ];

  return [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
    '```bash',
    '# 1. Bootstrap Next.js',
    `npx create-next-app@latest ${projectName} \\`,
    '  --typescript --tailwind --eslint --app --src-dir \\',
    '  --no-turbopack --import-alias "@/*" --disable-git',
    `cd ${projectName}`,
    'git init',
    '',
    '# 2. Install core deps',
    'npm install \\',
    npmDeps.map((d) => `  ${d}`).join(' \\\n'),
    '',
    '# 3. Install dev-deps',
    'npm install -D \\',
    '  vitest@latest \\',
    '  @testing-library/react@latest \\',
    '  @testing-library/jest-dom@latest \\',
    '  @playwright/test@latest \\',
    '  tsx@latest',
    '',
    '# 4. Initialize Supabase CLI',
    'npx supabase init',
    '',
    '# 5. Install shadcn/ui + theme',
    'npx shadcn@latest init --force',
    '',
    '# 6. Add shadcn components',
    'npx shadcn@latest add \\',
    shadcnComponents.map((c) => `  ${c}`).join(' \\\n'),
    '```',
    '',
    k('after_step_6'),
    '```bash',
    'ls src/components/ui/ | wc -l     # expect 30-40 components',
    'npm run build                      # expect exit 0',
    '```',
  ].join('\n');
}

export function renderDatabaseSchema(
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const k = (key: string): string => getMessage(lang, `database_schema.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
  ];

  let step = 1;
  const tenancyPat = patterns.find((p) => p.frontmatter.name === 'multi-tenant-supabase');
  if (tenancyPat) {
    lines.push(
      `## ${step}. \`00001_base_tenants_profiles.sql\``,
      '',
      `See \`docs/patterns/${tenancyPat.relativePath}\` - full SQL migration with tenants, profiles, RLS, handle_new_user trigger, touch_updated_at trigger.`,
      '',
      `${k('key_tables')}: \`tenants\`, \`profiles\``,
      `${k('key_triggers')}: \`on_auth_user_created\`, \`profiles_touch_updated_at\``,
      `${k('rls_heading')}: ${k('rls_body')}`,
      '',
    );
    step++;
  }

  const dsgvoPat = patterns.find((p) => p.frontmatter.name === 'dsgvo-kit');
  if (dsgvoPat) {
    lines.push(
      `## ${step}. \`00010_dsgvo.sql\``,
      '',
      `See \`docs/patterns/${dsgvoPat.relativePath}\` - user_consents, deletion_queue, audit_log tables with append-only trigger, process_deletion_queue procedure, RLS policies.`,
      '',
      `${k('key_tables')}: \`user_consents\`, \`deletion_queue\`, \`audit_log\``,
      '',
    );
    step++;
  }

  lines.push(
    `## ${step}. ${k('apply_migrations')}`,
    '',
    '```bash',
    'npx supabase migration up',
    'npx supabase db diff   # expect empty output',
    '```',
    '',
    `## ${step + 1}. ${k('seed_default')}`,
    '',
    'Create `supabase/seed.sql`:',
    '',
    '```sql',
    '-- Default tenant (for unauth-routes fallback if enabled)',
    "insert into tenants (id, name, slug, is_active)",
    "values ('{{DEFAULT_TENANT_ID}}', 'Default', 'default', true)",
    'on conflict (id) do nothing;',
    '```',
  );

  return lines.join('\n');
}

export function renderPagesInventory(config: AegisConfig, lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `pages_inventory.${key}`);
  const hasLocalePrefix = config.localization.i18n_strategy === 'url-prefix';
  const prefix = hasLocalePrefix ? '/[locale]' : '';
  const hasDsgvo = config.compliance.dsgvo_kit === true;
  const legal = config.compliance.legal_pages;

  const adminPages = [
    '`/admin/dashboard` - welcome plus basic metrics tiles',
    '`/admin/mein-bereich` - profile plus preferences tabs (`/datenschutz` sub-route if DSGVO enabled)',
    '`/admin/einstellungen` - app settings (admin-only)',
    '`/admin/rechtliches` - legal-pages admin-editor (admin-only)',
  ];
  if (hasDsgvo) {
    adminPages.push('`/admin/audit-log` - view audit-log (admin-only)');
  }

  const publicPages: string[] = [
    '`/` - landing page (replace with your marketing-copy)',
  ];
  for (const p of legal) {
    publicPages.push(`\`${prefix}/${p}\` - from compliance/legal-pages-de pattern`);
  }

  const authPages = [
    '`/login`, `/signup`, `/auth/forgot-password`, `/auth/update-password`, `/auth/callback` - from foundation/auth-supabase-full pattern',
  ];

  const lines: string[] = [`# ${k('heading')}`, ''];
  lines.push(`${k('total_prefix')}: ${adminPages.length + publicPages.length + authPages.length} ${k('total_suffix')}`);
  lines.push('', `## ${k('admin_pages')}`);
  adminPages.forEach((p) => lines.push(`- ${p}`));
  lines.push('', `## ${k('public_pages')}`);
  publicPages.forEach((p) => lines.push(`- ${p}`));
  lines.push('', `## ${k('auth_pages')}`);
  authPages.forEach((p) => lines.push(`- ${p}`));

  return lines.join('\n');
}

export function renderComponentCatalog(
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const k = (key: string): string => getMessage(lang, `component_catalog.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    `## ${k('from_shadcn')}`,
    k('from_shadcn_body'),
    '',
    `## ${k('from_patterns')}`,
  ];
  const dsgvoPat = patterns.find((p) => p.frontmatter.name === 'dsgvo-kit');
  if (dsgvoPat) {
    lines.push(`- \`<CookieBanner />\` - from compliance/dsgvo-kit`);
  }
  const i18nPat = patterns.find((p) => p.frontmatter.name === 'i18n-next-intl');
  if (i18nPat) {
    lines.push(`- \`<LanguageSwitcher />\` - from foundation/i18n-next-intl`);
  }
  lines.push('');
  lines.push(
    `## ${k('project_specific')}`,
    '- `<Sidebar />` - admin-sidebar with sections (Dashboard, Mein-Bereich, Einstellungen, Rechtliches). Use shadcn Sidebar component as base.',
    '- `<AppShell />` - layout-wrapper for admin-pages (sidebar plus header plus main).',
  );
  return lines.join('\n');
}

export function renderApiRoutes(patterns: readonly LoadedPattern[], lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `api_routes.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    `## ${k('convention')}`,
    '',
    '```typescript',
    "import { NextRequest, NextResponse } from 'next/server';",
    "import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';",
    "import { requireRole } from '@/lib/api/require-role';",
    "import { createServerSupabaseClient } from '@/lib/supabase/server';",
    "import { logger } from '@/lib/utils/logger';",
    "import { z } from 'zod';",
    '',
    'const BodySchema = z.object({ /* fields */ }).strict();',
    '',
    'export async function POST(request: NextRequest) {',
    '  try {',
    '    const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });',
    '    if (!context.userId) {',
    "      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    '    }',
    "    requireRole(context, ['admin', 'manager']);",
    '',
    '    const body = BodySchema.parse(await request.json());',
    '    const supabase = await createServerSupabaseClient();',
    '',
    '    const { data, error } = await supabase',
    "      .from('<table>')",
    '      .insert({ ...body, tenant_id: context.tenantId })',
    '      .select()',
    '      .single();',
    '',
    '    if (error) {',
    "      logger.error('DB insert failed', error, { userId: context.userId });",
    "      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });",
    '    }',
    '',
    '    return NextResponse.json(data);',
    '  } catch (err) {',
    '    const status = (err as { statusCode?: number }).statusCode ?? 500;',
    "    const message = err instanceof Error ? err.message : 'Internal error';",
    "    logger.error('Route failed', err as Error);",
    '    return NextResponse.json({ error: message }, { status });',
    '  }',
    '}',
    '```',
    '',
    `## ${k('routes_to_create')}`,
    '',
  ];

  const dsgvoPat = patterns.find((p) => p.frontmatter.name === 'dsgvo-kit');
  if (dsgvoPat) {
    lines.push(
      '- `/api/dsgvo/consent` (POST) - from compliance/dsgvo-kit',
      '- `/api/dsgvo/export` (GET) - from compliance/dsgvo-kit',
      '- `/api/dsgvo/delete` (POST) - from compliance/dsgvo-kit',
      '- `/api/admin/audit-log` (GET, admin-only) - paginated audit-log view',
    );
  }
  lines.push(
    '- `/api/admin/settings/{get,patch}` (admin-only)',
    '- `/api/admin/profile` (GET, PATCH own; PATCH others with admin-role)',
    '',
    k('domain_specific'),
  );

  return lines.join('\n');
}

export function renderBuildOrder(patterns: readonly LoadedPattern[], lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `build_order.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
    `## ${k('phase_1_foundation')}`,
    '1. Run all `npm install` plus `shadcn add` commands from the Installation section',
    '2. Copy foundation/multi-tenant-supabase pattern files to `src/lib/`:',
    '   - `lib/supabase/{admin,client,server}.ts`',
    '   - `lib/api/{client-ip,tenant-guard}.ts`',
    '   - `lib/utils/tenant-resolver.ts`',
    '3. Copy foundation/logger-pii-safe to `lib/utils/logger.ts`',
    '4. Copy foundation/rbac-requirerole to `lib/api/require-role.ts`',
    '5. Apply migration `00001_base_tenants_profiles.sql`',
    '6. **Gate:** `npm run build` exit 0; tests pass',
    '',
    `## ${k('phase_2_middleware')}`,
    '1. Copy foundation/middleware-hardened to `middleware.ts`',
    '2. Copy foundation/auth-supabase-full to auth pages plus components (login, signup, forgot-password, update-password, callback)',
    '3. Create `src/app/admin/layout.tsx` with auth-check plus Sidebar wrapper',
    `4. **${k('gate')}:** Sign up new user in browser, confirm email, log in, redirect to \`/admin/dashboard\` works`,
    '',
  ];

  if (patterns.some((p) => p.frontmatter.name === 'i18n-next-intl')) {
    lines.push(
      `## ${k('phase_3_i18n')}`,
      '1. Copy foundation/i18n-next-intl files (routing, navigation, request configs plus middleware extension plus messages JSON)',
      '2. Move all pages under `src/app/[locale]/`',
      '3. Update all hardcoded strings to use `t(\'key\')` via `useTranslations` or `getTranslations`',
      '4. **Gate:** `/de/admin/dashboard` plus `/en/admin/dashboard` both work; `LanguageSwitcher` toggles',
      '',
    );
  }

  if (patterns.some((p) => p.frontmatter.name === 'dsgvo-kit')) {
    lines.push(
      `## ${k('phase_4_dsgvo')}`,
      '1. Copy compliance/dsgvo-kit files: SQL migration, CookieBanner, API routes, `/admin/mein-bereich/datenschutz` page',
      '2. Mount `<CookieBanner />` in root layout',
      '3. Apply migration `00010_dsgvo.sql`',
      '4. Configure pg_cron for `process_deletion_queue()` (see dsgvo-kit pattern Supabase-dashboard-config section)',
      `5. **${k('gate')}:** Cookie-banner shows on first-visit; \`/api/dsgvo/export\` downloads JSON; \`/api/dsgvo/delete\` schedules entry in deletion_queue`,
      '',
    );
  }

  if (patterns.some((p) => p.frontmatter.name === 'legal-pages-de')) {
    lines.push(
      `## ${k('phase_5_legal')}`,
      '1. Copy compliance/legal-pages-de to `/[locale]/impressum`, `/[locale]/datenschutz`, `/[locale]/agb`',
      '2. Verify all `{{placeholders}}` are substituted (grep `{{`)',
      `3. **${k('gate')}:** Pages render without placeholder-leakage; footer-links work from all admin pages`,
      '',
    );
  }

  lines.push(
    `## ${k('phase_6_admin')}`,
    '1. Build `<Sidebar />` with 5 sections (Dashboard, Mein-Bereich, Einstellungen, Rechtliches, Audit-Log if DSGVO enabled)',
    '2. Build `/admin/dashboard` stub with welcome-message plus optional 3 KPI-tiles',
    '3. Build `/admin/einstellungen` with tabs (Allgemein, Benachrichtigungen, Sicherheit)',
    '4. Build `/admin/mein-bereich` profile-page with edit-form',
    '5. Build `/admin/audit-log` admin-only list-view (if DSGVO enabled)',
    `6. **${k('gate')}:** All admin-pages accessible plus responsive; role-based visibility works`,
    '',
    `## ${k('phase_7_testing')}`,
    '1. Configure Vitest plus Testing-Library: `vitest.config.ts` plus `test-utils.ts`',
    '2. Configure Playwright: `playwright.config.ts` plus basic golden-path test',
    '3. Author smoke-tests per pattern (from each pattern\'s Test example section)',
    `4. **${k('gate')}:** \`npm run test\` plus \`npm run test:e2e\` both pass`,
    '',
    `## ${k('phase_8_cicd')}`,
    '1. Create `.github/workflows/ci.yml` with checkout, setup-node, npm ci, npm run build, npm run test, npx aegis scan',
    `2. **${k('gate')}:** Commit triggers CI; build plus tests plus aegis-scan all green`,
    '',
    `## ${k('phase_9_deploy')}`,
    '1. Create `Dockerfile` with node:22-alpine multi-stage build and `output: \'standalone\'` target',
    '2. Update `next.config.ts` with `output: \'standalone\'`',
    '3. Create `.dockerignore` plus `docker-compose.yml`',
    '4. Document `.env.production` checklist',
    `**${k('gate')}:** \`docker build\` succeeds; \`docker run -p 3000:3000 <project>\` renders at localhost:3000`,
    '',
    `## ${k('phase_10_final')}`,
    '1. Run the FULL quality-gate-suite below',
    '2. Fix any finding',
    '3. Write `.env.example` plus `README.md` with project-specific info',
    '4. Write `POST-BUILD-REPORT.md` (per the Post-Build Report template section)',
    `5. **${k('gate')}:** All quality-gates green; user-approved handover`,
  );

  return lines.join('\n');
}

export function renderQualityGates(config: AegisConfig, lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `quality_gates.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
    '```bash',
    'npm run build                   # expect exit 0',
    'npx tsc --noEmit                # expect 0 errors',
    'npx next lint                   # expect 0 errors',
    'npm run test                    # expect all pass',
    'npm run test:e2e                # expect golden-path green',
    'npx aegis scan .                # expect score >= 960, grade A, 0 critical',
    'npx -y react-doctor@latest .    # expect score >= 93',
  ];

  if (hasLocale(config, 'de')) {
    lines.push(
      'grep -rn "Gruss\\|Raeume\\|Ueber\\|Foer\\|Pruefen" src/app src/components  # Umlaut-gate expect zero',
    );
  }
  if (config.compliance.dsgvo_kit) {
    lines.push(
      '# DSGVO PII-check (no PII in profiles table)',
      'grep -rn "email\\|phone\\|birth_date" supabase/migrations/*profiles* 2>/dev/null | grep -v "auth\\.users" | grep -v "comment"',
      '# expect: zero matches',
    );
  }
  if (config.localization.locales.length > 1) {
    lines.push(
      'npm run i18n:check              # expect keys match across all locales',
    );
  }
  lines.push(
    '# No unsubstituted placeholders anywhere',
    'grep -rn "{{" src/ supabase/migrations/ messages/ 2>/dev/null | grep -v "node_modules"  # expect zero',
    'npm run build   # inspect .next/analyze/ target: first-load < 300KB',
    '```',
  );

  return lines.join('\n');
}

export function renderDsgvoChecklist(config: AegisConfig, lang: BriefLang = 'en'): string | null {
  if (config.compliance.dsgvo_kit !== true) return null;
  const k = (key: string): string => getMessage(lang, `dsgvo_checklist.${key}`);
  return [
    `# ${k('heading')}`,
    '',
    '- [ ] Cookie-banner shows on first-visit in incognito',
    '- [ ] `/datenschutz` and `/impressum` render with real company-info (no `{{placeholders}}`)',
    '- [ ] `/api/dsgvo/export` returns user\'s data as JSON download',
    '- [ ] `/api/dsgvo/delete` creates `deletion_queue` row with `scheduled_for = now + 30d`',
    '- [ ] `profiles` table has NO email / phone columns (email lives in `auth.users`)',
    '- [ ] Every sensitive action creates an `audit_log` row',
    '- [ ] Every log call uses `logger.*`, not `console.*` (spot-grep: `grep -rn "console\\." src/`)',
    '- [ ] `pg_cron` scheduled for `process_deletion_queue()` (verify: `SELECT * FROM cron.job`)',
    '- [ ] Audit-log is append-only (try UPDATE / DELETE, should fail)',
  ].join('\n');
}

export function renderEnvVars(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const k = (key: string): string => getMessage(lang, `env_vars.${key}`);
  const lines: string[] = [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
    '```env',
    '# ----------------------------------------------------------------------------',
    '# Supabase (required)',
    '# ----------------------------------------------------------------------------',
    'NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...',
    'SUPABASE_SERVICE_ROLE_KEY=eyJ...     # SERVER-SIDE ONLY, never expose to client',
    '',
    '# ----------------------------------------------------------------------------',
    '# App config',
    '# ----------------------------------------------------------------------------',
    'NEXT_PUBLIC_APP_URL={{PRODUCTION_URL}}',
    'DEFAULT_TENANT_ID={{DEFAULT_TENANT_ID}}',
    'TRUSTED_PROXY_COUNT=1                 # 1 for Dokploy / Vercel, 2 for Cloudflare-in-front',
  ];

  if (patterns.some((p) => p.frontmatter.name === 'dsgvo-kit')) {
    lines.push(
      'CONSENT_VERSION=2026-04-23-v1          # bump when T&C changes',
    );
  }
  if (patterns.some((p) => p.frontmatter.name === 'logger-pii-safe')) {
    lines.push(
      'ENCRYPTION_KEY=0af1b2c3d4...64-hex-chars   # openssl rand -hex 32 (if encrypted-at-rest fields)',
    );
  }

  if (config.email.provider !== 'skip') {
    lines.push(
      '',
      '# ----------------------------------------------------------------------------',
      '# SMTP (required for transactional email)',
      '# ----------------------------------------------------------------------------',
      'SMTP_HOST=smtp.example.com',
      'SMTP_PORT=587',
      'SMTP_USER=noreply@example.com',
      'SMTP_PASS=your-smtp-password',
      'SMTP_FROM_NAME={{APP_NAME}}',
      'SMTP_FROM_ADDRESS=noreply@example.com',
    );
  }
  lines.push('```', '', k('outro'));

  return lines.join('\n');
}

export function renderPostBuildReportTemplate(lang: BriefLang = 'en'): string {
  const k = (key: string): string => getMessage(lang, `post_build_report.${key}`);
  return [
    `# ${k('heading')}`,
    '',
    k('intro'),
    '',
    '- Agent name plus version',
    '- Completion timestamp plus total build time',
    '- Commits list (one per phase)',
    '- Quality-gate results table',
    '- Features-delivered checklist',
    '- Known limitations plus follow-ups',
    '- How-to-deploy summary matching the chosen deployment target',
    '- User-actions-needed list (Supabase dashboard, pg_cron, SMTP, legal review)',
    '- Cost summary (optional)',
  ].join('\n');
}

export function renderFooter(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const k = (key: string): string => getMessage(lang, `footer.${key}`);
  return [
    '---',
    '',
    `**${k('end_marker')}**`,
    '',
    k('agent_start'),
    '',
    '---',
    '',
    `# ${k('meta_heading')}`,
    '',
    `**${k('pattern_versions')}:**`,
    ...patterns.map(
      (p) => `- ${p.frontmatter.category}/${p.frontmatter.name} v${p.frontmatter.version}`,
    ),
    '',
    `**${k('brief_config')}:**`,
    `- ${k('tone_label')}: ${config.brief_options.tone}`,
    `- ${k('lang_label')}: ${config.brief_options.lang}`,
    `- ${k('target_agent_label')}: ${config.brief_options.target_agent}`,
    '',
    `**${k('quality_target')}:** score >= 960 / grade A / 0 critical. If a brief-guided-build falls below this, file a pattern-defect issue with the generated brief plus the \`aegis scan\` output.`,
  ].join('\n');
}

// ============================================================================
// Verbose section renderers (Day-3 --verbose-brief)
//
// Each renderXVerbose() function returns the terse body PLUS prose+rationale
// passages that help an agent (or a human reviewer) understand WHY each
// pattern / rule / command exists. Verbose mode is additive: the terse
// content is preserved verbatim so readers who switch modes don't see a
// different brief-skeleton — only more prose.
//
// Size target: verbose brief = 1.5-2x terse brief (~700-900 lines vs ~400).
// ============================================================================

export function renderHeaderVerbose(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const terse = renderHeader(config, patterns, lang);
  const patternCount = patterns.length;
  const isDe = lang === 'de';
  return [
    terse,
    '',
    isDe ? '**Rationale für diesen Brief:**' : '**Rationale for this brief:**',
    '',
    isDe
      ? `Dieser Brief wurde aus deinen Antworten im AEGIS-Wizard plus ${patternCount} produktionshartened Patterns erzeugt. Jede Sektion unten ist eine direkte Konsequenz einer deiner Antworten — nichts hier ist generische Vorlage. Falls eine Sektion überrascht, schau zurück zur Wizard-Frage, aus der sie stammt (\`aegis.config.json\` speichert jede Antwort).`
      : `This brief was generated from the answers you gave the AEGIS wizard plus ${patternCount} production-hardened patterns. Every section below is a direct consequence of one of those answers — nothing here is generic boilerplate. If a section surprises you, revisit the wizard-question it came from (\`aegis.config.json\` records every answer).`,
    '',
    isDe
      ? 'Der Brief ist so geordnet, dass ein Agent ihn von oben nach unten ausführen kann: zuerst Installation, dann Migrationen, dann Routen, dann UI, dann Gates. Phasen-Grenzen sind harte Halt-Punkte — nicht vorausspringen; jede Phase hängt davon ab, dass die vorige ihr Gate bestanden hat.'
      : 'The brief is ordered so an agent can execute it top-to-bottom: Installation first, then migrations, then routes, then UI, then gates. Phase-boundaries are hard halt-points — do not skip ahead; each phase depends on the previous phase passing its gate.',
  ].join('\n');
}

export function renderAgentInstructionsVerbose(lang: BriefLang = 'en'): string {
  const terse = renderAgentInstructions(lang);
  return [
    terse,
    '',
    '## Why this operating-ruleset',
    '',
    'Each rule above exists because a past agent-run failed without it:',
    '',
    '- **Boil the Lake** — Agents hedging on complete-vs-partial deliveries produce unsafe half-features (auth stub without middleware, RLS without policies, DSGVO page without export route). "Build it fully or halt and ask" avoids that failure mode.',
    '- **Search Before Building** — Re-invented helpers drift over time; re-invented tenant-guard skips one check, re-invented logger misses one redaction-pattern. The primitives in this brief are intentionally reusable; search them first.',
    '- **Explicit-Paths** — `git add -A` silently stages `.env.local` and any other files your shell happens to drop into the working tree. Ambiguous stages leak secrets. Always stage by name.',
    '- **Localhost-First** — A push that breaks main blocks every other agent-run. Local gates are cheap; remote gates are expensive and shared.',
    '- **2-Checkpoint-Halt** — Early bugs compound: a broken migration in Phase 1 means every downstream Phase-2 route writes to a bad schema. Stopping between phases limits blast radius.',
    '- **Defensive-execution** — Silent halfway-completions (e.g. "Phase 4 done, DSGVO partially scaffolded") produce broken builds that look done. A handover-document with "still-to-do" is strictly better than a half-commit.',
    '',
    'Alternatives considered: a single "just ship it" directive (rejected — too easy to misread); no halt-checkpoints (rejected — observed cascading-failure in prior runs); requiring human-approval on every file (rejected — too slow for day-1 scaffolding). The current ruleset is the minimum-viable discipline for agent-driven scaffolding.',
  ].join('\n');
}

export function renderCoreRulesVerbose(config: AegisConfig, lang: BriefLang = 'en'): string {
  const terse = renderCoreRules(config, lang);
  const extras: string[] = [
    '',
    '## Why Multi-Tenancy is the HARDEST rule',
    '',
    'Every real-world multi-tenant breach in the last five years — PagerDuty 2020, Heroku 2022, Okta 2023, Azure Health Bot 2024 — came down to one missing `tenant_id` check somewhere in the request path. Defense-in-depth is non-negotiable: app-layer check (`secureApiRouteWithTenant`), DB-layer check (RLS policy), review-layer check (`aegis scan` blocker-rule). Skip any one and the other two are probabilistic.',
    '',
    'Alternatives considered: "schema-per-tenant" (rejected — 10k+ tenants = 10k+ migrations to run); "separate-database-per-tenant" (rejected — not viable under Supabase row-billing); "implicit-tenant-via-subdomain" (rejected — breaks header-based API clients and Postman testing). Shared-DB + `tenant_id` column + RLS + app-guard is the pragmatic winner.',
    '',
    '## Why Zod `.strict()` matters',
    '',
    'Without `.strict()`, an attacker can send `{ "email": "...", "role": "admin" }` to a route that only expects `{ "email": "..." }`, and if that body is spread into a Supabase `.insert()` or `.update()` call, they have just granted themselves admin. This is the "mass assignment" vulnerability class. `.strict()` makes the Zod parse fail on any unknown key; the request is rejected at the guard before it reaches the DB.',
    '',
    'Alternatives considered: hand-written allowlists (rejected — error-prone and drifts from the schema); `.passthrough()` with manual `pick()` (rejected — same drift risk); runtime type-check libraries other than Zod (rejected — Zod is the ecosystem default and integrates with React Hook Form forms).',
    '',
    '## Why optimistic updates',
    '',
    'Loading-spinners during mutations are the single biggest UX-degradation in dashboard apps. Users click, wait 400ms, and perceive the app as slow — even though server-round-trip is intrinsically ~200-400ms and there is no fix for that. Optimistic updates flip the perception: the UI reacts instantly to the click, the server response arrives in the background, and only on failure does the UI roll back. This is TanStack Query\'s design center, not an add-on.',
    '',
    'Trade-off: optimistic-state is briefly wrong until the server confirms. For read-then-write-then-redisplay flows, the user sees the expected final state 99% of the time and a rollback-toast 1% of the time. Net UX: much better. Cost: `onMutate` + `onError` rollback logic per mutation, and `onSettled` to invalidate queries. We accept that cost for every mutation in this brief.',
    '',
    '## Why no new dependencies without flagging',
    '',
    'Every added npm package expands the supply-chain attack surface. The Vercel-ShinyHunters incident in early 2026 (threat-actor compromised developer accounts and published malicious updates to popular Next.js dependencies) made this rule much stickier. A new dependency is not forbidden — it just has to be justified in the agent\'s phase-report so a reviewer can evaluate whether it\'s worth the surface-expansion.',
  ];

  if (hasLocale(config, 'de')) {
    extras.push(
      '',
      '## Why Umlaute-in-UI is a hard rule (German)',
      '',
      'German users perceive "Gruesse" (ASCII-fallback) as visibly incorrect — it triggers an immediate "this app was not made for Germans" reaction. DB-keys and URL-slugs use ASCII because legacy systems choke on UTF-8; UI strings never do in 2026. The grep-gate in the Quality-Gates section enforces this at build-time so the issue cannot ship to production.',
    );
  }

  return [terse, ...extras].join('\n');
}

export function renderInstallationVerbose(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const terse = renderInstallation(config, patterns, lang);
  return [
    terse,
    '',
    '**Why this install-order matters:**',
    '',
    '1. `create-next-app` first establishes the baseline `tsconfig.json`, `next.config.ts`, and `tailwind.config.ts`. Running `shadcn init` before this would fail because shadcn needs those files to exist.',
    '2. Core deps before dev-deps keeps one error-surface per step. If `@supabase/ssr` fails to resolve, you see it immediately — not buried under a vitest install failure.',
    '3. `supabase init` before migrations so the `supabase/` directory structure exists for patterns to write into.',
    '4. `shadcn init --force` is safe here because the project is empty; the force-flag only overwrites shadcn\'s own config. Use the default theme or replace it with your brand-tokens after step 6.',
    '5. Shadcn components are installed in one batch so there is exactly one "installed X components" summary, not 30 of them. The CLI handles missing components gracefully — removing a component-name from the list if you don\'t need it only removes that one file.',
    '',
    '**Alternatives considered:** global installs (rejected — pins project to one version of each tool); `pnpm create next-app` (rejected — we don\'t require pnpm for scaffolded projects, only the monorepo uses it); `yarn dlx shadcn add` (rejected — mixing package-managers is a bug-source in multi-agent workflows). `npx` + `npm install` is the minimum-common-denominator that works for every agent.',
  ].join('\n');
}

export function renderDatabaseSchemaVerbose(
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const terse = renderDatabaseSchema(patterns, lang);
  const tenancyPat = patterns.find((p) => p.frontmatter.name === 'multi-tenant-supabase');
  const dsgvoPat = patterns.find((p) => p.frontmatter.name === 'dsgvo-kit');
  const extras: string[] = [
    '',
    '**Why migrations-in-this-order:**',
    '',
    'Migrations are numbered and applied in strict order. The numbering is not cosmetic — later migrations reference earlier ones via foreign-key. The `00001_base_tenants_profiles.sql` migration MUST be applied first because every downstream migration expects the `tenants` and `profiles` tables to exist.',
    '',
  ];

  if (tenancyPat) {
    extras.push(
      '**Key tables from `00001_base_tenants_profiles.sql`:**',
      '',
      '- `tenants` — root-of-ownership table. Every other domain-table foreign-keys into this. Columns: `id uuid primary key`, `name text`, `slug text unique`, `is_active boolean`, timestamps.',
      '- `profiles` — one row per authenticated user, keyed by `id uuid` that matches `auth.users.id`. Columns: `id`, `tenant_id`, `role`, `full_name`, timestamps. NO email / phone / address columns (those live in `auth.users` — DSGVO-by-design).',
      '',
      '**Key triggers:** `on_auth_user_created` (auto-creates a profile when a new auth.users row appears), `profiles_touch_updated_at` (maintains the `updated_at` timestamp on mutation).',
      '',
      '**RLS policies:** both tables have RLS enabled. Policies filter by `auth.uid()` plus role — e.g. users can read their own profile; admins can read all profiles in their tenant; service-role (server-side only) bypasses RLS entirely.',
      '',
    );
  }

  if (dsgvoPat) {
    extras.push(
      '**Key tables from `00010_dsgvo.sql`:**',
      '',
      '- `user_consents` — versioned consent records. Columns: `user_id`, `consent_version`, `given_at`, `revoked_at`. Append-only via trigger — previous consents are never deleted, only superseded. Supports "at time T, what did user X consent to" queries for audit.',
      '- `deletion_queue` — DSGVO Art-17 erasure pipeline. When a user requests account-deletion, a row is inserted with `scheduled_for = now + 30 days`. A pg_cron job runs `process_deletion_queue()` hourly and actually deletes the account on-schedule. The 30-day window lets users cancel the deletion; after that, it is irreversible.',
      '- `audit_log` — append-only log of every sensitive action. Columns: `tenant_id`, `actor_id`, `event_type`, `resource`, `metadata`, `created_at`. Cannot be UPDATEed or DELETEed — enforced by trigger.',
      '',
      '**Why pg_cron for deletion-queue:** DSGVO requires the deletion to actually happen, not just be queued. pg_cron is the Supabase-native scheduler; external cron (e.g. Vercel cron) would work too but adds an extra failure-surface. Pg_cron runs inside the database so it cannot silently stop.',
      '',
    );
  }

  extras.push(
    '**Alternatives considered:** Drizzle ORM migrations (rejected — Supabase CLI migrations are closer to the metal and easier to review for security); Prisma (rejected — doesn\'t support RLS policy-management cleanly); raw psql scripts (rejected — no diff-checking against production schema).',
  );

  return [terse, ...extras].join('\n');
}

export function renderPagesInventoryVerbose(config: AegisConfig, lang: BriefLang = 'en'): string {
  const terse = renderPagesInventory(config, lang);
  return [
    terse,
    '',
    '**Why this page-split (public / admin / auth):**',
    '',
    '- **Public pages** live at the app root and are accessible without authentication. They are SEO-targets and must render with minimal JS. Use React Server Components for all public pages by default; opt into "use client" only when a specific interaction demands it (e.g. cookie-banner).',
    '- **Auth pages** are public by definition (the user isn\'t logged in yet) but share layout with the admin section so the visual transition from "logging in" to "logged in" is seamless. The `/auth/callback` page is the OAuth redirect target — it runs server-side to exchange the code for a session without exposing tokens to the client.',
    '- **Admin pages** live under `/admin` (or `/[locale]/admin` if i18n) and require authentication + role-check via middleware. The sidebar navigation is the single source of truth for what pages exist — adding a new page means updating the sidebar.',
    '',
    '**Alternatives considered:** mixing admin and public at the root (rejected — hurts middleware-clarity); `/dashboard` instead of `/admin` (rejected — "admin" is clearer about role-requirements); nested dynamic-locales like `/de/admin` (adopted when i18n pattern selected; skipped otherwise).',
  ].join('\n');
}

export function renderComponentCatalogVerbose(
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const terse = renderComponentCatalog(patterns, lang);
  return [
    terse,
    '',
    '**Why shadcn/ui and not a component-library:**',
    '',
    'shadcn/ui components are installed INTO your project (not as an npm dependency). You own every file, you can modify every file, and there is no black-box upgrade-risk. The trade-off is that breaking-changes in shadcn-upstream don\'t auto-propagate — but for security-sensitive SaaS that\'s a feature, not a bug.',
    '',
    '**Alternatives considered:** Material UI (rejected — heavy, opinionated, hard to brand); Chakra UI (rejected — CSS-in-JS perf issues); Mantine (rejected — similar trade-offs to MUI); custom from-scratch (rejected — 6 months of work before you ship anything). shadcn/ui is the pragmatic winner for 2026.',
  ].join('\n');
}

export function renderApiRoutesVerbose(patterns: readonly LoadedPattern[], lang: BriefLang = 'en'): string {
  const terse = renderApiRoutes(patterns, lang);
  return [
    terse,
    '',
    '**Why the convention matters:**',
    '',
    'The `secureApiRouteWithTenant` + `requireRole` + `BodySchema.parse` three-step is the architectural backbone of every authenticated API route in an AEGIS-scaffolded project. Each step handles one failure-class:',
    '',
    '- `secureApiRouteWithTenant` — authenticates the request and extracts `tenantId` from the session. Throws 401 if no session, 403 if session has no tenant (impossible after signup, but defense-in-depth).',
    '- `requireRole(context, [...])` — checks the authenticated user\'s role against the allow-list. Throws `ForbiddenError` (maps to 403) if the check fails. The role-list is intentionally in the route file, not a separate config — it makes the access-policy visible at-code-review-time.',
    '- `BodySchema.parse(await request.json())` — validates the request-body with Zod `.strict()`. Unknown keys throw (mass-assignment protection). Type-mismatches throw. The parsed value is fully-typed downstream.',
    '',
    'The outer `try/catch` maps `AppError` subclasses to HTTP status codes and logs via `logger.*` (never `console.*`). Unhandled errors return 500 with a generic message — the full error is logged but never exposed to the client (information-disclosure prevention).',
    '',
    '**Alternatives considered:** tRPC (rejected — adds a learning curve and our patterns map 1:1 to Next.js route handlers); GraphQL (rejected — over-kill for a typical SaaS CRUD layer); Server Actions only (partially-adopted for form-submissions, but not for third-party webhook-consumers or admin-API surfaces).',
  ].join('\n');
}

export function renderBuildOrderVerbose(patterns: readonly LoadedPattern[], lang: BriefLang = 'en'): string {
  const terse = renderBuildOrder(patterns, lang);
  return [
    terse,
    '',
    '**Why this build-order (Phase 1 → Phase 10):**',
    '',
    'Each phase builds on the previous phase\'s gate. Skipping a phase or running them out-of-order produces subtle bugs that are very expensive to debug later:',
    '',
    '- **Foundation before middleware** — middleware.ts imports `tenant-guard`, which imports `supabase/server.ts`. Without the foundation files in place, middleware fails at import-time, not at runtime.',
    '- **Middleware before auth pages** — auth pages redirect through middleware; without middleware, the redirects are silent no-ops.',
    '- **DSGVO after i18n** — DSGVO pages need translated strings for the cookie-banner and account-deletion UI. Adding DSGVO before i18n means re-writing those strings.',
    '- **Admin shell after all backend routes** — the shell is UI-only and tests nothing about the backend. Building it early creates the illusion of progress without any actual coverage.',
    '- **Testing before CI** — CI runs the tests. If the tests don\'t exist, CI has nothing to run and the pipeline appears green vacuously.',
    '- **Deployment-config last** — Dockerfile / Vercel config depends on the final shape of `next.config.ts`, which can change up through Phase 6. Writing Docker early means re-writing it.',
    '',
    '**Rationale for 90-minute phase-budget:** 90min is long enough to finish a non-trivial phase with tests + gate, short enough to catch scope-creep early. If a phase is taking 3h, something is wrong — either the pattern is missing documentation or the agent misread a step. Halt and ask.',
  ].join('\n');
}

export function renderQualityGatesVerbose(config: AegisConfig, lang: BriefLang = 'en'): string {
  const terse = renderQualityGates(config, lang);
  return [
    terse,
    '',
    '**Why each gate exists:**',
    '',
    '- `npm run build` — catches type-errors and missing imports that TS\'s language-server sometimes misses during incremental editing. Exit 0 is the baseline-truth: if the project doesn\'t build, nothing else matters.',
    '- `npx tsc --noEmit` — stricter than `next build` because it checks test files too. Catches test-file type-errors that would otherwise only surface when you run the test suite.',
    '- `npx next lint` — enforces Next.js-specific rules (no `<a>` for internal links, no raw `<img>`, etc.) on top of ESLint\'s defaults.',
    '- `npm run test` — runs the Vitest suite. Fast feedback-loop. Every new feature should add at least one test here before shipping.',
    '- `npm run test:e2e` — Playwright against a dev-server. Slow but catches integration issues (auth flow, middleware redirects, multi-tenant isolation).',
    '- `npx aegis scan .` — the security-grade gate. Score >= 960 is the AEGIS quality-bar; < 900 indicates something serious (missing auth guard, service-role leak, SQL injection, etc.).',
    '- `npx react-doctor@latest .` — component-level quality gate. Score >= 93 catches common React anti-patterns (uncontrolled inputs, key-less lists, over-sized components).',
    '',
    '**Rationale for grep-based gates:** the Umlaut-check, placeholder-leak check, and DSGVO PII-check all use `grep` because they\'re cheap, fast, and zero-dependency. A full AST-parse for any of these would be overkill. If a grep produces a false-positive, update the pattern (add a comment-marker) rather than loosening the gate.',
    '',
    '**Alternatives considered:** skip gates in CI, run only locally (rejected — local gates are easy to bypass in a rush); run gates inline-on-save (adopted partially via husky pre-commit, but not for everything because pre-commit gets too slow past ~5 gates).',
  ].join('\n');
}

export function renderDsgvoChecklistVerbose(config: AegisConfig, lang: BriefLang = 'en'): string | null {
  if (config.compliance.dsgvo_kit !== true) return null;
  const terse = renderDsgvoChecklist(config, lang);
  return [
    terse,
    '',
    '**Why this checklist is NON-NEGOTIABLE for DE/EU operators:**',
    '',
    'German and EU operators are legally required under DSGVO (GDPR) to:',
    '',
    '- Obtain informed consent before dropping non-essential cookies (cookie-banner)',
    '- Provide data-export on request (Art-15 "right to access")',
    '- Provide account-deletion with a 30-day grace period (Art-17 "right to erasure")',
    '- Store PII minimally (data-minimization principle) — email lives in `auth.users`, not in `profiles`',
    '- Maintain an audit-log of sensitive operations (Art-32 "security of processing")',
    '- Log without leaking PII (Art-5 "accuracy + confidentiality")',
    '',
    'Penalty for non-compliance: up to 4% of annual global revenue or 20M EUR, whichever is greater. Enforcement is active (CNIL fined Google 150M EUR in 2022 for cookie-consent violations; AEPD fines are common for Spanish SaaS).',
    '',
    '**Alternatives considered:** GDPR-compliance-as-a-service (Iubenda, Cookiebot — rejected because they are paid monthly subscriptions and don\'t cover account-deletion flows); manual legal-team review (adopted as a final step — this pattern gives 95% compliance, the last 5% is country-specific legal-team sign-off).',
  ].join('\n');
}

export function renderEnvVarsVerbose(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const terse = renderEnvVars(config, patterns, lang);
  return [
    terse,
    '',
    '**Why each env-var category:**',
    '',
    '- **Supabase block** — `NEXT_PUBLIC_*` vars ship to the client; `SUPABASE_SERVICE_ROLE_KEY` stays server-only (never prefixed with `NEXT_PUBLIC_`). Leaking the service-role-key bypasses every RLS policy in your database — treat it like an AWS root-key.',
    '- **App config** — `TRUSTED_PROXY_COUNT` tells the rate-limiter which `X-Forwarded-For` hop to trust. Wrong values here let an attacker spoof their IP and bypass rate-limiting.',
    '- **SMTP block (if email-provider is set)** — transactional email credentials. Store in a secret-manager in production (Vercel env / Dokploy secrets / AWS SSM), never commit to git.',
    '- **Encryption-key (if logger-pii-safe adopted)** — 32 hex-bytes for AES-256-GCM encryption-at-rest. Generate once with `openssl rand -hex 32` and rotate on compromise.',
    '',
    '**Rationale for `.env.production.example`:** shipping an example-file with the keys (but not values) in the repo saves every deployer 30-60min of figuring out what secrets are needed. The `.example` suffix prevents accidental load at dev-time.',
  ].join('\n');
}

export function renderPostBuildReportTemplateVerbose(lang: BriefLang = 'en'): string {
  const terse = renderPostBuildReportTemplate(lang);
  return [
    terse,
    '',
    '**Why POST-BUILD-REPORT.md matters:**',
    '',
    'The report is the artifact that survives after the agent-run finishes. It captures three things the git-history alone doesn\'t:',
    '',
    '1. **Timing** — which phase took how long. Useful when tuning the wizard\'s phase-estimates.',
    '2. **Follow-ups** — the "known limitations" section is the first place a human-reviewer looks when taking over the project. Omitting it means the next person discovers issues in production.',
    '3. **User-actions-needed** — some steps (Supabase dashboard configuration, pg_cron enablement, SMTP credential provisioning) cannot be done by the agent and MUST be done by a human before the app is production-ready. Surfacing them in one place prevents "works-on-localhost, broken-in-prod" incidents.',
    '',
    '**Alternatives considered:** skip the report (rejected — hard-to-audit handover); put it in a Notion doc (rejected — splits the project artifacts); auto-generate from git-log (rejected — git-log doesn\'t capture follow-ups or user-actions). A committed .md file in the repo is the pragmatic compromise.',
  ].join('\n');
}

export function renderFooterVerbose(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string {
  const terse = renderFooter(config, patterns, lang);
  return [
    terse,
    '',
    '**Why this verbose-mode exists:**',
    '',
    'The terse brief is optimized for fast agent-execution — minimum tokens, maximum signal. The verbose brief is optimized for human-review and agent-understanding in edge cases. Same patterns, same commands, just with the rationale made explicit.',
    '',
    'Switch with `--verbose-brief` or `--no-verbose-brief` (terse is default). Both modes produce functionally-equivalent scaffolds; the difference is in the explanation density.',
  ].join('\n');
}

// ============================================================================
// Pattern-appendix — embeds every selected pattern's full body into the brief.
// Without this the brief refers to files the user does not have on disk; with
// it the brief is a self-contained hand-off the agent can execute end-to-end.
// Placeholder substitution runs at the generator level after all sections are
// joined, so markers inside these embedded bodies resolve against the
// resolver-map alongside header-level identifiers.
// ============================================================================

export function renderPatternAppendix(
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string | null {
  if (patterns.length === 0) return null;
  const heading =
    lang === 'de'
      ? '## Anhang — Vollständige Pattern-Texte'
      : '## Appendix — Full pattern bodies';
  const intro =
    lang === 'de'
      ? 'Der folgende Text ist die vollständige Referenz jeder ausgewählten Vorlage. Platzhalter sind bereits gegen die aktuelle Konfiguration substituiert. Kopiere jeden Codeblock in die im Kopfkommentar benannte Datei.'
      : 'The text below is the complete source-of-truth for each selected pattern. Every placeholder is already substituted against the current configuration. Copy each code-block into the file named in its header comment.';
  const blocks: string[] = [`${heading}\n\n${intro}`];
  for (const p of patterns) {
    blocks.push(
      `### ${p.frontmatter.category}/${p.frontmatter.name} — ${p.frontmatter.title}\n\n${p.body.trim()}`,
    );
  }
  return blocks.join('\n\n');
}

export function renderPatternAppendixVerbose(
  patterns: readonly LoadedPattern[],
  lang: BriefLang = 'en',
): string | null {
  if (patterns.length === 0) return null;
  const heading =
    lang === 'de'
      ? '## Anhang — Vollständige Pattern-Texte (verbose)'
      : '## Appendix — Full pattern bodies (verbose)';
  const intro =
    lang === 'de'
      ? 'Jedes Muster bringt seine Beschreibung zuerst und den vollständigen, substituierten Text danach. Die Reihenfolge spiegelt die Auswahl des Pattern-Selectors.'
      : 'Each pattern block leads with its frontmatter description and then the full substituted body. Ordering mirrors the pattern-selector output.';
  const blocks: string[] = [`${heading}\n\n${intro}`];
  for (const p of patterns) {
    blocks.push(
      `### ${p.frontmatter.category}/${p.frontmatter.name} — ${p.frontmatter.title}\n\n${p.frontmatter.description}\n\n${p.body.trim()}`,
    );
  }
  return blocks.join('\n\n');
}
