/**
 * Placeholder-substitution engine for pattern content — replaces
 * `{{UPPER_SNAKE_CASE}}` markers with values from a supplied map.
 *
 * Design mirrors `@aegis-scan/cli`'s template/substitute.ts (reference-only —
 * this is a separate copy, not a cross-package import, because the two
 * products are deliberately decoupled).
 *
 * Behavior:
 *   - Unknown keys are left as literal `{{KEY}}` text (no crash, no silent
 *     deletion). Surfaced in the output so missing substitutions are visible.
 *   - Replacement is literal; no recursive re-expansion.
 *     `{ A: '{{B}}', B: 'x' }` on input `{{A}}` → `{{B}}`.
 */

export function substitute(
  input: string,
  values: Readonly<Record<string, string>>,
): string {
  return input.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}

// ============================================================================
// Reserved-placeholder computation
// ============================================================================

export interface ReservedPlaceholderInput {
  projectName: string;
  appName?: string;
  aegisWizardVersion: string;
  defaultLocale: string;
  locales: string[];
  generatedAt?: string;
  defaultTenantId?: string;
}

/**
 * Compute the always-available reserved placeholders per
 * aegis-precision/pattern-schema-reference.md §5.
 */
export function buildReservedPlaceholders(
  input: ReservedPlaceholderInput,
  uuidFactory: () => string,
): Record<string, string> {
  const appName = input.appName ?? kebabToTitle(input.projectName);
  return {
    PROJECT_NAME: input.projectName,
    APP_NAME: appName,
    AEGIS_WIZARD_VERSION: input.aegisWizardVersion,
    GENERATED_AT: input.generatedAt ?? new Date().toISOString(),
    DEFAULT_LOCALE: input.defaultLocale,
    LOCALES: JSON.stringify(input.locales),
    DEFAULT_TENANT_ID: input.defaultTenantId ?? uuidFactory(),
  };
}

function kebabToTitle(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
