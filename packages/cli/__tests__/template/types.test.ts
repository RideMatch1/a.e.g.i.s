import { describe, it, expect } from 'vitest';
import { TemplateManifestSchema } from '../../src/template/types.js';

describe('TemplateManifestSchema', () => {
  it('accepts a valid manifest', () => {
    const valid = {
      name: 'nextjs-supabase',
      stack: 'nextjs-supabase',
      aegisVersion: '0.12.0',
      description: 'Test template',
      placeholders: ['PROJECT_NAME', 'AEGIS_VERSION'],
      postInstall: { scan: true, scanExpectedScore: 1000, scanExpectedGrade: 'A' },
    };
    expect(() => TemplateManifestSchema.parse(valid)).not.toThrow();
  });

  it('rejects extra unknown keys (strict mode)', () => {
    const invalid = {
      name: 'x', stack: 'y', aegisVersion: '0.12.0', description: 'd',
      placeholders: [], postInstall: { scan: false, scanExpectedScore: 0, scanExpectedGrade: 'F' },
      wildcard: 'extra',
    };
    expect(() => TemplateManifestSchema.parse(invalid)).toThrow();
  });

  it('requires semver-shaped aegisVersion', () => {
    const invalid = {
      name: 'x', stack: 'y', aegisVersion: 'not-a-version', description: 'd',
      placeholders: [], postInstall: { scan: false, scanExpectedScore: 0, scanExpectedGrade: 'F' },
    };
    expect(() => TemplateManifestSchema.parse(invalid)).toThrow();
  });

  it('scanExpectedGrade is one of A/B/C/D/F', () => {
    const base = {
      name: 'x', stack: 'y', aegisVersion: '0.12.0', description: 'd',
      placeholders: [], postInstall: { scan: false, scanExpectedScore: 0, scanExpectedGrade: 'Z' },
    };
    expect(() => TemplateManifestSchema.parse(base)).toThrow();
  });
});
