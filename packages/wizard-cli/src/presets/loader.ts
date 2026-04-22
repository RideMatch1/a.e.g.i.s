/**
 * Preset-loader — reads + validates YAML preset-manifests.
 *
 * Mirrors the shape of `patterns/loader.ts`: fail-fast on schema errors,
 * surface precise messages the wizard can render. Uses the `yaml` package
 * for parsing (small, zero-dep, TypeScript-friendly).
 */
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { PresetManifestSchema, type PresetManifest } from './schema.js';

/**
 * Load and validate a single preset-manifest YAML file. Throws a descriptive
 * Error if the file is missing, syntactically broken, or fails schema
 * validation — callers can catch and surface to users.
 */
export async function loadPreset(filePath: string): Promise<PresetManifest> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Preset file not readable at ${filePath}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new Error(
      `Preset file ${filePath} is not valid YAML: ${(err as Error).message}`,
    );
  }

  try {
    return PresetManifestSchema.parse(parsed);
  } catch (err) {
    throw new Error(
      `Preset ${filePath} failed schema validation: ${(err as Error).message}`,
    );
  }
}
