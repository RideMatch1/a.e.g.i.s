/**
 * Brief-generator - composes an AegisConfig plus resolved patterns into
 * an agent-consumable Markdown brief.
 *
 * Tone dimension (Day-2 + Day-3):
 *   - tone=terse (default) — minimum-token brief optimized for fast
 *     agent-execution
 *   - tone=verbose (Day-3) — same structure plus prose + rationale +
 *     alternatives-considered for human-review and edge-case agent-runs
 *
 * Lang dimension (Day-2 + Day-3):
 *   - lang=en (default) — English output
 *   - lang=de (Day-3) — German output via i18n translation-layer
 *
 * The two dimensions are orthogonal: all 4 matrix combinations (terse+en,
 * terse+de, verbose+en, verbose+de) produce equivalent-semantic scaffolds
 * at different verbosity + language.
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
import { buildPatternPlaceholders } from './pattern-placeholders.js';
import { readSelfVersion } from './self-version.js';
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
  renderInstallTimeHardening,
  renderPatternAppendix,
  renderSkillsSection,
  renderEnabledFeaturesSection,
  renderFooter,
  renderHeaderVerbose,
  renderAgentInstructionsVerbose,
  renderCoreRulesVerbose,
  renderInstallationVerbose,
  renderDatabaseSchemaVerbose,
  renderPagesInventoryVerbose,
  renderComponentCatalogVerbose,
  renderApiRoutesVerbose,
  renderBuildOrderVerbose,
  renderQualityGatesVerbose,
  renderDsgvoChecklistVerbose,
  renderEnvVarsVerbose,
  renderPostBuildReportTemplateVerbose,
  renderInstallTimeHardeningVerbose,
  renderPatternAppendixVerbose,
  renderFooterVerbose,
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
  const verbose = opts.tone === 'verbose';
  const lang = opts.lang ?? 'en';

  const sections: Array<string | null> = verbose
    ? [
        renderHeaderVerbose(config, patterns, lang),
        renderAgentInstructionsVerbose(lang),
        renderCoreRulesVerbose(config, lang),
        renderEnabledFeaturesSection(config, lang),
        renderInstallationVerbose(config, patterns, lang),
        renderDatabaseSchemaVerbose(patterns, lang),
        renderPagesInventoryVerbose(config, lang),
        renderComponentCatalogVerbose(patterns, lang),
        renderApiRoutesVerbose(patterns, lang),
        renderBuildOrderVerbose(patterns, lang),
        renderQualityGatesVerbose(config, lang),
        renderDsgvoChecklistVerbose(config, lang),
        renderEnvVarsVerbose(config, patterns, lang),
        renderPostBuildReportTemplateVerbose(lang),
        renderInstallTimeHardeningVerbose(lang),
        renderPatternAppendixVerbose(patterns, lang),
        renderSkillsSection(lang),
        renderFooterVerbose(config, patterns, lang),
      ]
    : [
        renderHeader(config, patterns, lang),
        renderAgentInstructions(lang),
        renderCoreRules(config, lang),
        renderEnabledFeaturesSection(config, lang),
        renderInstallation(config, patterns, lang),
        renderDatabaseSchema(patterns, lang),
        renderPagesInventory(config, lang),
        renderComponentCatalog(patterns, lang),
        renderApiRoutes(patterns, lang),
        renderBuildOrder(patterns, lang),
        renderQualityGates(config, lang),
        renderDsgvoChecklist(config, lang),
        renderEnvVars(config, patterns, lang),
        renderPostBuildReportTemplate(lang),
        renderInstallTimeHardening(lang),
        renderPatternAppendix(patterns, lang),
        renderSkillsSection(lang),
        renderFooter(config, patterns, lang),
      ];

  const rendered = sections
    .filter((s): s is string => s !== null)
    .join('\n\n---\n\n');

  // Compute reserved placeholder values from the config.
  // v0.17.2 M3 + L8 — the brief's provenance header was user-controllable
  // via config.aegis_version (schema regex had no upper anchor, generator
  // piped the value straight through). That produced headers like "AEGIS
  // Wizard v0.14.2" coming out of a v0.17.1 CLI. Fix: always read the
  // running CLI's own package.json via readSelfVersion(), and warn to
  // stderr when the config's aegis_version disagrees so the operator
  // knows the override happened. Callers who want to pin the header for
  // a test or regression-probe can still pass opts.aegisWizardVersion.
  const selfVersion = readSelfVersion();
  if (
    opts.aegisWizardVersion === undefined &&
    config.aegis_version !== selfVersion
  ) {
    console.warn(
      `[aegis-wizard] config.aegis_version="${config.aegis_version}" does not match running CLI version "${selfVersion}". Brief provenance header will use the actual running version.`,
    );
  }
  const reserved = buildReservedPlaceholders(
    {
      projectName: config.identity.project_name,
      appName: config.identity.app_name,
      aegisWizardVersion: opts.aegisWizardVersion ?? selfVersion,
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

  const patternMap = buildPatternPlaceholders({ config, reserved });
  const allValues = { ...patternMap, ...extra };
  const substituted = substitute(rendered, allValues);

  // Fail-fast: no unsubstituted placeholder markers may leak. Two
  // classes are rejected. Brace-style {{UPPER_SNAKE}} is the canonical
  // substitute-engine marker; a leftover one means a section-renderer
  // or embedded pattern body used a key the resolver map has no value
  // for. Bracket-style [X] single-letter literals are the convention
  // the legal-template drafts used as a human-fill-me-in hint — one
  // of them ([Y] in the AGB cancellation clause) shipped to the
  // pre-fix tarball, so this guard surfaces the class pre-publish.
  const leakedBraces = substituted.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
  const leakedBrackets = substituted.match(/\[[A-Z]\]/g);
  if (leakedBraces || leakedBrackets) {
    const parts: string[] = [];
    if (leakedBraces) {
      parts.push(
        `brace-placeholders: ${[...new Set(leakedBraces)].join(', ')}`,
      );
    }
    if (leakedBrackets) {
      parts.push(
        `bracket-literals: ${[...new Set(leakedBrackets)].join(', ')}`,
      );
    }
    throw new Error(
      `Brief-renderer emitted unresolved placeholders — ${parts.join('; ')}. ` +
        `Either a section-renderer used a marker the generator has no value for, ` +
        `an embedded pattern body leaked a literal, or the resolver map is incomplete.`,
    );
  }

  return substituted;
}
