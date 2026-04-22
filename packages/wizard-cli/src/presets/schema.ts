/**
 * Zod schema for preset-manifest files — `presets/*.yaml`.
 *
 * A preset is a named composition of patterns the wizard can recommend
 * as a single click-through choice (e.g. `saas-starter`). The manifest
 * declares pattern-refs that the preset-loader resolves against the
 * `docs/patterns/` tree via the existing pattern-loader.
 *
 * Schema-versioning policy mirrors the aegis.config.json contract:
 *   - v1.x: additive fields only.
 *   - v2.x: breaking rename → migration-path documented in release-notes.
 */
import { z } from 'zod';

// ============================================================================
// Sub-schemas
// ============================================================================

export const PresetPatternRefSchema = z.object({
  category: z.enum(['foundation', 'compliance', 'integration', 'feature']),
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
});

// ============================================================================
// Top-level preset manifest schema
// ============================================================================

export const PresetManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/).min(2).max(64),
  version: z.number().int().positive().default(1),
  description: z.string().min(20).max(500),
  patterns: z.array(PresetPatternRefSchema).min(1),
});

export type PresetManifest = z.infer<typeof PresetManifestSchema>;
export type PresetPatternRef = z.infer<typeof PresetPatternRefSchema>;
