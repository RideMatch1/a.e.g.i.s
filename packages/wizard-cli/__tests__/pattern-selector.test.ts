/**
 * Pattern-selector tests.
 *
 * Covers:
 *   - Default saas-starter config → 8 patterns (6 foundation + 2 compliance)
 *   - Compliance dsgvo_kit=false → 7 patterns (dsgvo-kit omitted)
 *   - Empty legal_pages → 7 patterns (legal-pages-de omitted)
 *   - Both compliance off → 6 patterns (core foundation only)
 *   - resolvePatterns happy-path + missing-pattern error
 *   - Category-name tuples preserve correct ordering
 */
import { describe, it, expect } from 'vitest';
import { derivePatterns, resolvePatterns } from '../src/brief/pattern-selector.js';
import { AegisConfigSchema, type AegisConfig } from '../src/wizard/schema.js';
import type { LoadedPattern } from '../src/patterns/loader.js';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

const MINIMAL_CONFIG_INPUT = {
  aegis_version: '0.17.0',
  generated_at: '2026-04-23T00:00:00.000Z',
  identity: {
    project_name: 'test-saas',
    project_description: 'Test SaaS for pattern-selector unit tests.',
    app_name: 'Test SaaS',
    company_name: 'Test GmbH',
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
};

function buildConfig(overrides: Partial<AegisConfig> = {}): AegisConfig {
  const base = AegisConfigSchema.parse(MINIMAL_CONFIG_INPUT);
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
    body: '# test pattern body',
    sourcePath: `/tmp/${category}/${name}.md`,
    relativePath: `${category}/${name}.md`,
  };
}

const ALL_8_PATTERNS: LoadedPattern[] = [
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

describe('derivePatterns', () => {
  it('returns all 8 patterns for a default saas-starter config', () => {
    const refs = derivePatterns(buildConfig());
    expect(refs).toHaveLength(8);
    const names = refs.map((r) => `${r.category}/${r.name}`);
    expect(names).toEqual([
      'foundation/multi-tenant-supabase',
      'foundation/auth-supabase-full',
      'foundation/rbac-requirerole',
      'foundation/middleware-hardened',
      'foundation/logger-pii-safe',
      'foundation/i18n-next-intl',
      'compliance/dsgvo-kit',
      'compliance/legal-pages-de',
    ]);
  });

  it('omits dsgvo-kit when compliance.dsgvo_kit = false', () => {
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, dsgvo_kit: false };
    const refs = derivePatterns(cfg);
    expect(refs).toHaveLength(7);
    expect(refs.find((r) => r.name === 'dsgvo-kit')).toBeUndefined();
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeDefined();
  });

  it('omits legal-pages-de when compliance.legal_pages is empty', () => {
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, legal_pages: [] };
    const refs = derivePatterns(cfg);
    expect(refs).toHaveLength(7);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
    expect(refs.find((r) => r.name === 'dsgvo-kit')).toBeDefined();
  });

  it('omits both compliance patterns when both switches are off', () => {
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, dsgvo_kit: false, legal_pages: [] };
    const refs = derivePatterns(cfg);
    expect(refs).toHaveLength(6);
    expect(refs.every((r) => r.category === 'foundation')).toBe(true);
  });

  it('preserves deterministic ordering of foundation refs', () => {
    const refs = derivePatterns(buildConfig());
    const foundation = refs.filter((r) => r.category === 'foundation');
    expect(foundation.map((r) => r.name)).toEqual([
      'multi-tenant-supabase',
      'auth-supabase-full',
      'rbac-requirerole',
      'middleware-hardened',
      'logger-pii-safe',
      'i18n-next-intl',
    ]);
  });

  it('never yields duplicates even if called repeatedly', () => {
    const a = derivePatterns(buildConfig());
    const b = derivePatterns(buildConfig());
    expect(a).toEqual(b);
    const names = a.map((r) => `${r.category}/${r.name}`);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  // --------------------------------------------------------------------------
  // Jurisdiction-gated legal-pages-de (bug 010)
  // --------------------------------------------------------------------------

  it('omits legal-pages-de for US jurisdiction even with non-empty legal_pages', () => {
    const cfg = buildConfig();
    cfg.identity = { ...cfg.identity, target_jurisdiction: 'US' };
    // Default legal_pages is still ['impressum','datenschutz'] — this tests
    // that the selector gate treats jurisdiction as the primary filter.
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
  });

  it('omits legal-pages-de for CH jurisdiction', () => {
    const cfg = buildConfig();
    cfg.identity = { ...cfg.identity, target_jurisdiction: 'CH' };
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
  });

  it('omits legal-pages-de for AT jurisdiction (adjacent law-family but distinct Impressum rules)', () => {
    const cfg = buildConfig();
    cfg.identity = { ...cfg.identity, target_jurisdiction: 'AT' };
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
  });

  it('omits legal-pages-de for EU jurisdiction (too generic for §5 TMG/DDG specifics)', () => {
    const cfg = buildConfig();
    cfg.identity = { ...cfg.identity, target_jurisdiction: 'EU' };
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
  });

  it('omits legal-pages-de for other jurisdiction', () => {
    const cfg = buildConfig();
    cfg.identity = { ...cfg.identity, target_jurisdiction: 'other' };
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
  });

  it('includes legal-pages-de for DE jurisdiction when legal_pages is non-empty', () => {
    // Baseline — same as the default-config case but made explicit
    const cfg = buildConfig();
    expect(cfg.identity.target_jurisdiction).toBe('DE');
    expect((cfg.compliance?.legal_pages?.length ?? 0) > 0).toBe(true);
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeDefined();
  });

  it('omits legal-pages-de for DE jurisdiction if legal_pages is explicitly empty', () => {
    // DE user who opts out of legal pages altogether — respect their choice
    const cfg = buildConfig();
    cfg.compliance = { ...cfg.compliance, legal_pages: [] };
    const refs = derivePatterns(cfg);
    expect(refs.find((r) => r.name === 'legal-pages-de')).toBeUndefined();
  });

  it('returns 6 foundation + 1 compliance (dsgvo-kit) for EU jurisdiction default', () => {
    const cfg = buildConfig();
    cfg.identity = { ...cfg.identity, target_jurisdiction: 'EU' };
    // EU keeps dsgvo_kit=true (per shouldEnableDsgvo in flow.ts) but drops
    // legal-pages-de. In unit-test we parse the Zod default which already
    // has dsgvo_kit=true, so the resulting ref-set is 6 + 1 = 7.
    const refs = derivePatterns(cfg);
    expect(refs).toHaveLength(7);
    const names = refs.map((r) => r.name);
    expect(names).toContain('dsgvo-kit');
    expect(names).not.toContain('legal-pages-de');
  });
});

describe('resolvePatterns', () => {
  it('resolves all derived refs against the full 8-pattern set', () => {
    const refs = derivePatterns(buildConfig());
    const resolved = resolvePatterns(refs, ALL_8_PATTERNS);
    expect(resolved).toHaveLength(8);
    // Ordering preserved
    expect(resolved[0].frontmatter.name).toBe('multi-tenant-supabase');
    expect(resolved[7].frontmatter.name).toBe('legal-pages-de');
  });

  it('throws descriptive error when a ref is missing from the available set', () => {
    const refs = derivePatterns(buildConfig());
    // Drop the last pattern from the available set
    const incomplete = ALL_8_PATTERNS.slice(0, 7);
    expect(() => resolvePatterns(refs, incomplete)).toThrow(
      /compliance\/legal-pages-de.*not found/,
    );
  });

  it('throws when the only available set is empty and refs are non-empty', () => {
    const refs = [{ category: 'foundation' as const, name: 'multi-tenant-supabase' }];
    expect(() => resolvePatterns(refs, [])).toThrow(
      /foundation\/multi-tenant-supabase.*not found/,
    );
  });

  it('returns empty array when given empty refs', () => {
    expect(resolvePatterns([], ALL_8_PATTERNS)).toEqual([]);
  });

  it('ignores unrelated patterns in the available set', () => {
    const refs = [
      { category: 'foundation' as const, name: 'multi-tenant-supabase' },
    ];
    const available = [
      ...ALL_8_PATTERNS,
      buildLoadedPattern('feature', 'unrelated-feature'),
    ];
    const resolved = resolvePatterns(refs, available);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].frontmatter.name).toBe('multi-tenant-supabase');
  });

  it('distinguishes same-name patterns across categories', () => {
    const foundationTwin = buildLoadedPattern('foundation', 'twin');
    const featureTwin = buildLoadedPattern('feature', 'twin');
    const available = [foundationTwin, featureTwin];
    const refs = [
      { category: 'foundation' as const, name: 'twin' },
      { category: 'feature' as const, name: 'twin' },
    ];
    const resolved = resolvePatterns(refs, available);
    expect(resolved[0].frontmatter.category).toBe('foundation');
    expect(resolved[1].frontmatter.category).toBe('feature');
  });
});
