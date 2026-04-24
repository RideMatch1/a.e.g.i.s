/**
 * v0.17.3 B5 — DE phase-body-prose i18n closure (audit v0.17.2 M2).
 *
 * External audit v0.17.2 §3 M2: phase-step body-prose ("Run all
 * `npm install` plus `shadcn add`", "Copy foundation/...", etc.) was
 * hardcoded English even with --lang=de. Phase titles + core-rules +
 * skills-section were translated (v0.17.1 F1 + F2 covered those) but
 * the phase-body-prose layer was not.
 *
 * v0.17.3 B5 moves phase-body-prose into the i18n catalogs under
 * build_order.phase_N_body (string-arrays) for both en.json + de.json,
 * and threads renderBuildOrder through the new getMessageArray helper.
 *
 * This suite asserts:
 *   - DE brief has no English sentinel phrases in phase-body-prose
 *   - DE brief contains positive DE translations
 *   - EN brief still renders English (no regression)
 *   - Code-snippets + file-paths stay language-agnostic per README scope
 *   - `{GATE}` literal marker in the catalog gets replaced per-line
 */
import { describe, it, expect } from 'vitest';
import { renderBuildOrder } from '../src/brief/sections.js';
import type { LoadedPattern } from '../src/patterns/loader.js';

function stubPattern(category: 'foundation' | 'compliance', name: string): LoadedPattern {
  return {
    frontmatter: {
      name,
      category,
      title: `Test ${category}/${name}`,
      description: 'A test stub pattern for M2 i18n integration.',
      version: 1,
      dependencies: { npm: [], shadcn: [], supabase: [] },
      placeholders: [],
      brief_section: category === 'foundation' ? 'Foundation' : 'Compliance',
      tags: [],
      related: [],
      conflicts_with: [],
      aegis_scan_baseline: 960,
      deprecated: false,
    },
    body: '',
    sourcePath: `/tmp/${name}.md`,
    relativePath: `${category}/${name}.md`,
  };
}

const ALL_PATTERNS: LoadedPattern[] = [
  stubPattern('foundation', 'multi-tenant-supabase'),
  stubPattern('foundation', 'auth-supabase-full'),
  stubPattern('foundation', 'rbac-requirerole'),
  stubPattern('foundation', 'middleware-hardened'),
  stubPattern('foundation', 'logger-pii-safe'),
  stubPattern('foundation', 'i18n-next-intl'),
  stubPattern('compliance', 'dsgvo-kit'),
  stubPattern('compliance', 'legal-pages-de'),
];

describe('DE phase-body-prose i18n (B5, closes v0.17.2 M2)', () => {
  it('DE brief contains NO hardcoded English phase-body-prose sentinels', () => {
    const brief = renderBuildOrder(ALL_PATTERNS, 'de');

    const englishSentinels = [
      'Run all `npm install` plus `shadcn add`',
      'Copy foundation/multi-tenant-supabase pattern files to',
      'Copy foundation/logger-pii-safe to',
      'Copy foundation/rbac-requirerole to',
      'Apply migration `00001_base_tenants_profiles.sql`',
      'Configure Vitest plus Testing-Library',
      'Configure Playwright',
      'Author smoke-tests per pattern',
      'Run the FULL quality-gate-suite below',
      'Fix any finding',
    ];

    for (const phrase of englishSentinels) {
      expect(brief, `DE brief must NOT contain English phrase: "${phrase}"`).not.toContain(phrase);
    }
  });

  it('DE brief contains positive DE translations of phase-body-prose', () => {
    const brief = renderBuildOrder(ALL_PATTERNS, 'de');

    const dePhrases = [
      'Alle `npm install`- und `shadcn add`-Befehle aus der Installation-Sektion ausführen',
      'Pattern-Dateien von foundation/multi-tenant-supabase nach `src/lib/` kopieren',
      'foundation/logger-pii-safe nach `lib/utils/logger.ts` kopieren',
      'Migration `00001_base_tenants_profiles.sql` anwenden',
      'Vitest und Testing-Library konfigurieren',
      'Playwright konfigurieren',
      'Smoke-Tests pro Pattern schreiben',
      'Jeden Befund beheben',
      'Handover vom Nutzer freigegeben',
    ];

    for (const phrase of dePhrases) {
      expect(brief, `DE brief should contain: "${phrase}"`).toContain(phrase);
    }
  });

  it('EN brief still uses English phase-body-prose (no regression)', () => {
    const brief = renderBuildOrder(ALL_PATTERNS, 'en');

    const enPhrases = [
      'Run all `npm install` plus `shadcn add`',
      'Copy foundation/multi-tenant-supabase pattern files to',
      'Apply migration `00001_base_tenants_profiles.sql`',
      'Configure Vitest plus Testing-Library',
    ];

    for (const phrase of enPhrases) {
      expect(brief, `EN brief should contain: "${phrase}"`).toContain(phrase);
    }
  });

  it('code-snippets + file-paths stay language-agnostic in both EN and DE (README scope)', () => {
    const enBrief = renderBuildOrder(ALL_PATTERNS, 'en');
    const deBrief = renderBuildOrder(ALL_PATTERNS, 'de');

    const agnostic = [
      '`lib/supabase/{admin,client,server}.ts`',
      '`src/app/admin/dashboard/page.tsx`',
      '`00001_base_tenants_profiles.sql`',
      'CREATE EXTENSION IF NOT EXISTS pg_cron',
      'SELECT * FROM cron.job',
      '`.github/workflows/ci.yml`',
      'docker run -p 3000:3000',
      '`npm run test`',
      '`POST-BUILD-REPORT.md`',
    ];

    for (const elem of agnostic) {
      expect(enBrief, `EN brief should contain language-agnostic: "${elem}"`).toContain(elem);
      expect(deBrief, `DE brief should contain language-agnostic: "${elem}"`).toContain(elem);
    }
  });

  it('{GATE} literal marker is replaced in phase-body-prose (EN + DE)', () => {
    const enBrief = renderBuildOrder(ALL_PATTERNS, 'en');
    const deBrief = renderBuildOrder(ALL_PATTERNS, 'de');

    expect(enBrief, 'EN brief must not leak literal {GATE} marker').not.toContain('{GATE}');
    expect(deBrief, 'DE brief must not leak literal {GATE} marker').not.toContain('{GATE}');

    expect(enBrief).toMatch(/\*\*Gate:\*\*/);
    expect(deBrief).toMatch(/\*\*Gate:\*\*/);
  });

  it('DE phase titles stay translated (no regression on F1/F2 coverage)', () => {
    const brief = renderBuildOrder(ALL_PATTERNS, 'de');

    expect(brief).toContain('Phase 5 - Rechtliche Seiten');
    expect(brief).toContain('Phase 10 - Finale Verifikation');
    expect(brief).toContain('Build-Reihenfolge');
  });
});
