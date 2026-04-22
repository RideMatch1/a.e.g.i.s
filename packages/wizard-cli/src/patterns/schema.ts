/**
 * Zod schema for pattern-file frontmatter — `docs/patterns/<category>/<name>.md`.
 *
 * Source-of-truth: aegis-precision/pattern-schema-reference.md §3.
 *
 * The loader validates the parsed gray-matter object against this schema
 * before returning, so every downstream consumer (brief-generator, CLI
 * pattern-list, linter) sees a fully-typed PatternFrontmatter or fails fast
 * with a precise Zod error.
 */
import { z } from 'zod';

// ============================================================================
// Sub-schemas
// ============================================================================

export const PatternCategorySchema = z.enum([
  'foundation',
  'compliance',
  'integration',
  'feature',
]);

export const PatternDependenciesSchema = z
  .object({
    npm: z.array(z.string()).default([]),
    shadcn: z.array(z.string()).default([]),
    supabase: z.array(z.string()).default([]),
  })
  .default({});

export const PatternPlaceholderSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  description: z.string().min(10).max(500),
  default: z.unknown().optional(),
  required: z.boolean().default(false),
  type: z
    .enum(['string', 'number', 'boolean', 'array', 'uuid-v4', 'json'])
    .default('string'),
});

export const BriefSectionSchema = z.enum([
  'Foundation',
  'Compliance',
  'Integration',
  'Feature',
]);

// ============================================================================
// Top-level frontmatter schema
// ============================================================================

export const PatternFrontmatterSchema = z.object({
  // Identity ----------------------------------------------------------------
  name: z.string().regex(/^[a-z][a-z0-9-]*$/).min(2).max(64),
  category: PatternCategorySchema,
  title: z.string().min(5).max(120),

  // Description -------------------------------------------------------------
  description: z.string().min(20).max(500),

  // Version (bump on breaking change) --------------------------------------
  version: z.number().int().positive().default(1),

  // Dependencies ------------------------------------------------------------
  dependencies: PatternDependenciesSchema,

  // Placeholders (substituted at brief-generation) --------------------------
  placeholders: z.array(PatternPlaceholderSchema).default([]),

  // Brief-generation hints --------------------------------------------------
  brief_section: BriefSectionSchema,
  estimated_files: z.number().int().positive().optional(),
  estimated_migration_size: z.number().int().positive().optional(),

  // Relations + tags --------------------------------------------------------
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  conflicts_with: z.array(z.string()).default([]),

  // Quality-gate target -----------------------------------------------------
  aegis_scan_baseline: z.number().int().min(900).max(1000).default(960),

  // Deprecation flag --------------------------------------------------------
  deprecated: z.boolean().default(false),
  deprecated_reason: z.string().optional(),
  superseded_by: z.string().optional(),
});

export type PatternFrontmatter = z.infer<typeof PatternFrontmatterSchema>;
export type PatternCategory = z.infer<typeof PatternCategorySchema>;
export type PatternPlaceholder = z.infer<typeof PatternPlaceholderSchema>;
