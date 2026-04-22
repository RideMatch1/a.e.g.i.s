/**
 * Preset-loader tests.
 *
 * Covers the loader contract:
 *   - Valid YAML parses + validates
 *   - Missing / extra / wrong-type fields are rejected with descriptive messages
 *   - Malformed YAML surfaces cleanly (no silent pass-through)
 *   - File-not-found surfaces cleanly (typos in CLI flag paths)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PresetManifestSchema, PresetPatternRefSchema } from '../src/presets/schema.js';
import { loadPreset } from '../src/presets/loader.js';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

const VALID_YAML = `name: saas-starter
version: 1
description: Generic multi-tenant SaaS preset bundling 8 foundation + compliance patterns.
patterns:
  - { category: foundation, name: multi-tenant-supabase }
  - { category: compliance, name: dsgvo-kit }
`;

describe('PresetManifestSchema', () => {
  it('accepts a valid minimal preset', () => {
    const parsed = PresetManifestSchema.parse({
      name: 'saas-starter',
      description: 'Generic multi-tenant SaaS preset bundling core patterns.',
      patterns: [{ category: 'foundation', name: 'multi-tenant-supabase' }],
    });
    expect(parsed.version).toBe(1);
    expect(parsed.patterns).toHaveLength(1);
  });

  it('rejects missing name', () => {
    expect(() =>
      PresetManifestSchema.parse({
        description: 'Generic multi-tenant SaaS preset bundling core patterns.',
        patterns: [{ category: 'foundation', name: 'multi-tenant-supabase' }],
      }),
    ).toThrow();
  });

  it('rejects uppercase in name', () => {
    expect(() =>
      PresetManifestSchema.parse({
        name: 'SaasStarter',
        description: 'Generic multi-tenant SaaS preset bundling core patterns.',
        patterns: [{ category: 'foundation', name: 'multi-tenant-supabase' }],
      }),
    ).toThrow();
  });

  it('rejects empty patterns array', () => {
    expect(() =>
      PresetManifestSchema.parse({
        name: 'saas-starter',
        description: 'Generic multi-tenant SaaS preset bundling core patterns.',
        patterns: [],
      }),
    ).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() =>
      PresetManifestSchema.parse({
        name: 'saas-starter',
        description: 'Generic multi-tenant SaaS preset bundling core patterns.',
        patterns: [{ category: 'unknown', name: 'multi-tenant-supabase' }],
      }),
    ).toThrow();
  });

  it('rejects short description (< 20 chars)', () => {
    expect(() =>
      PresetManifestSchema.parse({
        name: 'saas-starter',
        description: 'too short',
        patterns: [{ category: 'foundation', name: 'multi-tenant-supabase' }],
      }),
    ).toThrow();
  });
});

describe('PresetPatternRefSchema', () => {
  it('accepts the four valid categories', () => {
    for (const cat of ['foundation', 'compliance', 'integration', 'feature'] as const) {
      expect(() =>
        PresetPatternRefSchema.parse({ category: cat, name: 'some-pattern' }),
      ).not.toThrow();
    }
  });

  it('rejects uppercase pattern names', () => {
    expect(() =>
      PresetPatternRefSchema.parse({ category: 'foundation', name: 'MixedCase' }),
    ).toThrow();
  });
});

describe('loadPreset', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-preset-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('loads and validates valid YAML', async () => {
    const p = join(tmpRoot, 'saas-starter.yaml');
    writeFileSync(p, VALID_YAML, 'utf-8');
    const preset = await loadPreset(p);
    expect(preset.name).toBe('saas-starter');
    expect(preset.patterns).toHaveLength(2);
    expect(preset.patterns[0].category).toBe('foundation');
  });

  it('surfaces schema-validation errors with file path in message', async () => {
    const p = join(tmpRoot, 'bad.yaml');
    writeFileSync(
      p,
      `name: bad
description: too short
patterns:
  - { category: foundation, name: x }
`,
      'utf-8',
    );
    await expect(loadPreset(p)).rejects.toThrow(/bad\.yaml/);
    await expect(loadPreset(p)).rejects.toThrow(/failed schema validation/);
  });

  it('surfaces malformed-YAML errors', async () => {
    const p = join(tmpRoot, 'broken.yaml');
    writeFileSync(p, `name: broken\n  patterns: [\n`, 'utf-8');
    await expect(loadPreset(p)).rejects.toThrow(/not valid YAML/);
  });

  it('surfaces missing-file errors', async () => {
    const missing = join(tmpRoot, 'does-not-exist.yaml');
    await expect(loadPreset(missing)).rejects.toThrow(/not readable/);
  });

  it('accepts flat-map YAML syntax as well as flow syntax', async () => {
    const p = join(tmpRoot, 'flat.yaml');
    writeFileSync(
      p,
      `name: saas-starter
description: Generic multi-tenant SaaS preset bundling core patterns.
patterns:
  - category: foundation
    name: multi-tenant-supabase
  - category: compliance
    name: dsgvo-kit
`,
      'utf-8',
    );
    const preset = await loadPreset(p);
    expect(preset.patterns).toHaveLength(2);
  });
});
