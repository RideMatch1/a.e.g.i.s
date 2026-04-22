/**
 * Pattern-selector — derives the list of patterns to include in a brief
 * from an AegisConfig, then resolves those refs against a loaded pattern
 * array.
 *
 * Day-2 implements the saas-starter derivation rules (spec §3.3):
 *   - Always-include: 6 foundation patterns (multi-tenant-supabase,
 *     auth-supabase-full, rbac-requirerole, middleware-hardened,
 *     logger-pii-safe, i18n-next-intl).
 *   - Conditional: compliance/dsgvo-kit (gated on
 *     config.compliance.dsgvo_kit) and compliance/legal-pages-de
 *     (gated on non-empty config.compliance.legal_pages array).
 *
 * The resolver is fail-fast: a selected ref that cannot be matched against
 * a loaded pattern throws a descriptive error instead of silently skipping.
 * Silent-skip in this layer would leak broken briefs.
 */
import type { AegisConfig } from '../wizard/schema.js';
import type { LoadedPattern } from '../patterns/loader.js';

// ============================================================================
// Types
// ============================================================================

export interface SelectedPatternRef {
  category: 'foundation' | 'compliance' | 'integration' | 'feature';
  name: string;
}

// ============================================================================
// Derivation
// ============================================================================

/**
 * Derive the list of patterns to include in a brief from an AegisConfig.
 * Day-2 hard-codes the saas-starter rules; v0.18 may generalize via preset.
 */
export function derivePatterns(config: AegisConfig): SelectedPatternRef[] {
  const selected: SelectedPatternRef[] = [
    { category: 'foundation', name: 'multi-tenant-supabase' },
    { category: 'foundation', name: 'auth-supabase-full' },
    { category: 'foundation', name: 'rbac-requirerole' },
    { category: 'foundation', name: 'middleware-hardened' },
    { category: 'foundation', name: 'logger-pii-safe' },
    { category: 'foundation', name: 'i18n-next-intl' },
  ];

  const compliance = config.compliance;
  if (compliance?.dsgvo_kit === true) {
    selected.push({ category: 'compliance', name: 'dsgvo-kit' });
  }
  if ((compliance?.legal_pages?.length ?? 0) > 0) {
    selected.push({ category: 'compliance', name: 'legal-pages-de' });
  }

  return selected;
}

// ============================================================================
// Resolution
// ============================================================================

/**
 * Resolve SelectedPatternRefs against a loaded LoadedPattern[] (from
 * loader). Throws fast on the first unresolved ref — either the pattern
 * file is missing from docs/patterns/ or the selector has a typo; both are
 * operator-surfacing conditions, not silent-skip conditions.
 */
export function resolvePatterns(
  refs: readonly SelectedPatternRef[],
  available: readonly LoadedPattern[],
): LoadedPattern[] {
  const resolved: LoadedPattern[] = [];
  for (const ref of refs) {
    const match = available.find(
      (p) =>
        p.frontmatter.category === ref.category &&
        p.frontmatter.name === ref.name,
    );
    if (!match) {
      throw new Error(
        `Pattern ${ref.category}/${ref.name} was selected but not found in the ` +
        `patterns directory. Either the pattern is missing from docs/patterns/ ` +
        `or the selector has a ref-typo.`,
      );
    }
    resolved.push(match);
  }
  return resolved;
}
