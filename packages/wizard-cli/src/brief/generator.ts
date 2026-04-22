/**
 * Brief-generator - composes an AegisConfig plus resolved patterns into
 * an agent-consumable Markdown brief.
 *
 * Day-2 implements terse English rendering only. --verbose-brief and
 * --lang=de are Day-3 scope and intentionally throw if requested here so
 * no caller accidentally ships pre-Day-3 output.
 *
 * After all sections are joined the whole string is run through the
 * substitute engine with reserved placeholders (PROJECT_NAME, APP_NAME,
 * AEGIS_WIZARD_VERSION, DEFAULT_TENANT_ID, etc.). If any UPPER_SNAKE
 * placeholder still appears in the output it is a renderer bug and the
 * generator throws. Silent placeholder-leaks would poison downstream
 * builds, so fail-fast here is a feature.
 */
import { randomUUID } from 'node:crypto';
import type { AegisConfig } from '../wizard/schema.js';
import type { LoadedPattern } from '../patterns/loader.js';
import {
  substitute,
  buildReservedPlaceholders,
} from '../template/substitute.js';
import {
  renderHeader,
  renderAgentInstructions,
  renderCoreRules,
  renderInstallation,
  renderDatabaseSchema,
  renderPagesInventory,
  renderComponentCatalog,
  renderApiRoutes,
  renderBuildOrder,
  renderQualityGates,
  renderDsgvoChecklist,
  renderEnvVars,
  renderPostBuildReportTemplate,
  renderFooter,
} from './sections.js';

// ============================================================================
// Public types
// ============================================================================

export interface BriefGenerateOptions {
  tone?: 'terse' | 'verbose';
  lang?: 'en' | 'de';
  /** Optional override for aegis-wizard version string in the header. */
  aegisWizardVersion?: string;
  /** Optional UUID factory for deterministic tests. */
  uuidFactory?: () => string;
}

// ============================================================================
// Main entry-point
// ============================================================================

export function generateBrief(
  config: AegisConfig,
  patterns: readonly LoadedPattern[],
  opts: BriefGenerateOptions = {},
): string {
  if (opts.tone === 'verbose') {
    throw new Error('verbose-tone brief-rendering is scheduled for v0.17 Day-3');
  }
  if (opts.lang === 'de') {
    throw new Error('German-language brief-rendering is scheduled for v0.17 Day-3');
  }

  const sections: Array<string | null> = [
    renderHeader(config, patterns),
    renderAgentInstructions(),
    renderCoreRules(config),
    renderInstallation(config, patterns),
    renderDatabaseSchema(patterns),
    renderPagesInventory(config),
    renderComponentCatalog(patterns),
    renderApiRoutes(patterns),
    renderBuildOrder(patterns),
    renderQualityGates(config),
    renderDsgvoChecklist(config),
    renderEnvVars(config, patterns),
    renderPostBuildReportTemplate(),
    renderFooter(config, patterns),
  ];

  const rendered = sections
    .filter((s): s is string => s !== null)
    .join('\n\n---\n\n');

  // Compute reserved placeholder values from the config.
  const reserved = buildReservedPlaceholders(
    {
      projectName: config.identity.project_name,
      appName: config.identity.app_name,
      aegisWizardVersion: opts.aegisWizardVersion ?? config.aegis_version,
      defaultLocale: config.localization.default_locale,
      locales: config.localization.locales,
      generatedAt: config.generated_at,
      defaultTenantId: config.multi_tenancy.default_tenant_id,
    },
    opts.uuidFactory ?? randomUUID,
  );

  // Non-reserved dynamic placeholders rendered inline by sections.
  const extra: Record<string, string> = {
    PRODUCTION_URL: config.deployment.production_url ?? `https://${config.identity.project_name}.example.com`,
    STAGING_URL: config.deployment.staging_url ?? `https://staging.${config.identity.project_name}.example.com`,
  };

  const allValues = { ...reserved, ...extra };
  const substituted = substitute(rendered, allValues);

  // Fail-fast: no unsubstituted UPPER_SNAKE placeholders left.
  const leaked = substituted.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
  if (leaked) {
    const unique = [...new Set(leaked)].join(', ');
    throw new Error(
      `Brief-renderer emitted unresolved placeholders: ${unique}. Either a ` +
      `section-renderer used a placeholder the generator has no value for, ` +
      `or the reserved-placeholder mapping is incomplete.`,
    );
  }

  return substituted;
}
