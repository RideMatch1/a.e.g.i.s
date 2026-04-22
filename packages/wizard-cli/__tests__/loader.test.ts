/**
 * Pattern-loader tests.
 *
 * Uses a tmpdir fixture so we don't depend on docs/patterns/ contents
 * (those are validated by the end-to-end Day-1 gate separately).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPattern,
  loadAllPatterns,
  filterByCategory,
} from '../src/patterns/loader.js';
import {
  PatternFrontmatterSchema,
} from '../src/patterns/schema.js';
import {
  substitute,
  buildReservedPlaceholders,
} from '../src/template/substitute.js';

// ----------------------------------------------------------------------------
// Fixture helpers
// ----------------------------------------------------------------------------

const VALID_FRONTMATTER_YAML = `---
name: multi-tenant-supabase
category: foundation
title: Multi-Tenancy with Supabase
description: >
  Establishes tenants and profiles tables with RLS. Every domain-table FK-refs
  tenants and filters via tenant_id.
version: 1
dependencies:
  npm:
    - "@supabase/supabase-js"
    - "@supabase/ssr"
placeholders:
  - name: DEFAULT_TENANT_ID
    description: UUID-v4 fallback for unauth-routes
    type: uuid-v4
brief_section: Foundation
estimated_files: 4
aegis_scan_baseline: 960
---

# Multi-Tenancy with Supabase

Body goes here.

## Commands to run

\`\`\`bash
npm i @supabase/supabase-js
\`\`\`
`;

function writeValidPattern(dir: string): string {
  const foundationDir = join(dir, 'foundation');
  mkdirSync(foundationDir, { recursive: true });
  const path = join(foundationDir, 'multi-tenant-supabase.md');
  writeFileSync(path, VALID_FRONTMATTER_YAML, 'utf-8');
  return path;
}

// ----------------------------------------------------------------------------

describe('PatternFrontmatterSchema', () => {
  it('accepts valid minimal frontmatter', () => {
    const parsed = PatternFrontmatterSchema.parse({
      name: 'minimal-pattern',
      category: 'foundation',
      title: 'Hello World',
      description: 'A description at least 20 chars long.',
      brief_section: 'Foundation',
    });
    expect(parsed.version).toBe(1);
    expect(parsed.dependencies.npm).toEqual([]);
    expect(parsed.aegis_scan_baseline).toBe(960);
  });

  it('rejects frontmatter with short description', () => {
    expect(() =>
      PatternFrontmatterSchema.parse({
        name: 'minimal-pattern',
        category: 'foundation',
        title: 'Hello World',
        description: 'too short',
        brief_section: 'Foundation',
      }),
    ).toThrow();
  });

  it('rejects bad category', () => {
    expect(() =>
      PatternFrontmatterSchema.parse({
        name: 'minimal-pattern',
        category: 'unknown',
        title: 'Hello World',
        description: 'A description at least 20 chars long.',
        brief_section: 'Foundation',
      }),
    ).toThrow();
  });

  it('rejects placeholder name not UPPER_SNAKE', () => {
    expect(() =>
      PatternFrontmatterSchema.parse({
        name: 'minimal-pattern',
        category: 'foundation',
        title: 'Hello World',
        description: 'A description at least 20 chars long.',
        brief_section: 'Foundation',
        placeholders: [{ name: 'lowerCase', description: 'at least ten chars' }],
      }),
    ).toThrow();
  });

  it('rejects name that is too short', () => {
    expect(() =>
      PatternFrontmatterSchema.parse({
        name: 'x',
        category: 'foundation',
        title: 'Hello World',
        description: 'A description at least 20 chars long.',
        brief_section: 'Foundation',
      }),
    ).toThrow();
  });
});

// ----------------------------------------------------------------------------

describe('loadPattern', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-loader-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('loads a valid pattern file', async () => {
    const path = writeValidPattern(tmpRoot);
    const loaded = await loadPattern(path, tmpRoot);
    expect(loaded.frontmatter.name).toBe('multi-tenant-supabase');
    expect(loaded.frontmatter.category).toBe('foundation');
    expect(loaded.frontmatter.version).toBe(1);
    expect(loaded.body).toContain('# Multi-Tenancy with Supabase');
    expect(loaded.relativePath).toBe('foundation/multi-tenant-supabase.md');
  });

  it('rejects when category does not match parent dir', async () => {
    const complianceDir = join(tmpRoot, 'compliance');
    mkdirSync(complianceDir, { recursive: true });
    const mismatch = VALID_FRONTMATTER_YAML; // category: foundation, but in compliance/
    const path = join(complianceDir, 'multi-tenant-supabase.md');
    writeFileSync(path, mismatch, 'utf-8');

    await expect(loadPattern(path, tmpRoot)).rejects.toThrow(/does not match parent directory/);
  });

  it('rejects when name does not match basename', async () => {
    const foundationDir = join(tmpRoot, 'foundation');
    mkdirSync(foundationDir, { recursive: true });
    const path = join(foundationDir, 'wrong-name.md');
    writeFileSync(path, VALID_FRONTMATTER_YAML, 'utf-8');

    await expect(loadPattern(path, tmpRoot)).rejects.toThrow(/does not match basename/);
  });

  it('rejects malformed frontmatter', async () => {
    const foundationDir = join(tmpRoot, 'foundation');
    mkdirSync(foundationDir, { recursive: true });
    const path = join(foundationDir, 'broken.md');
    writeFileSync(
      path,
      `---
name: broken
category: foundation
title: Too
description: short
brief_section: Foundation
---

Body
`,
      'utf-8',
    );

    await expect(loadPattern(path, tmpRoot)).rejects.toThrow(/failed frontmatter validation/);
  });
});

// ----------------------------------------------------------------------------

describe('loadAllPatterns', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-walker-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns empty array for empty base dir', async () => {
    expect(await loadAllPatterns(tmpRoot)).toEqual([]);
  });

  it('walks recursive dirs and returns valid patterns', async () => {
    writeValidPattern(tmpRoot);
    // add another valid pattern in compliance/
    const complianceDir = join(tmpRoot, 'compliance');
    mkdirSync(complianceDir, { recursive: true });
    writeFileSync(
      join(complianceDir, 'legal-pages-de.md'),
      `---
name: legal-pages-de
category: compliance
title: German Legal Pages (Impressum, Datenschutz, AGB)
description: Ships Impressum + Datenschutz + AGB static pages with §5 TMG compliance.
version: 1
brief_section: Compliance
aegis_scan_baseline: 970
---

Body.
`,
      'utf-8',
    );

    const all = await loadAllPatterns(tmpRoot);
    expect(all.length).toBe(2);
    const names = all.map((p) => p.frontmatter.name).sort();
    expect(names).toEqual(['legal-pages-de', 'multi-tenant-supabase']);
  });

  it('skips SCHEMA.md and index.md', async () => {
    writeFileSync(join(tmpRoot, 'SCHEMA.md'), '# Schema', 'utf-8');
    writeFileSync(join(tmpRoot, 'index.md'), '# Index', 'utf-8');
    writeValidPattern(tmpRoot);
    const all = await loadAllPatterns(tmpRoot);
    expect(all.length).toBe(1);
    expect(all[0].frontmatter.name).toBe('multi-tenant-supabase');
  });

  it('filterByCategory filters correctly', async () => {
    writeValidPattern(tmpRoot);
    const complianceDir = join(tmpRoot, 'compliance');
    mkdirSync(complianceDir, { recursive: true });
    writeFileSync(
      join(complianceDir, 'legal-pages-de.md'),
      `---
name: legal-pages-de
category: compliance
title: German Legal Pages
description: Ships Impressum + Datenschutz + AGB static pages.
version: 1
brief_section: Compliance
---

Body.
`,
      'utf-8',
    );
    const all = await loadAllPatterns(tmpRoot);
    const found = filterByCategory(all, 'foundation');
    expect(found.length).toBe(1);
    expect(found[0].frontmatter.name).toBe('multi-tenant-supabase');
  });
});

// ----------------------------------------------------------------------------

describe('substitute', () => {
  it('replaces known placeholders', () => {
    const out = substitute('hello {{NAME}} and {{OTHER}}', {
      NAME: 'world',
      OTHER: 'stuff',
    });
    expect(out).toBe('hello world and stuff');
  });

  it('leaves unknown placeholders as literal', () => {
    const out = substitute('hello {{UNKNOWN}}', { NAME: 'world' });
    expect(out).toBe('hello {{UNKNOWN}}');
  });

  it('does not re-expand recursively', () => {
    const out = substitute('{{A}}', { A: '{{B}}', B: 'x' });
    expect(out).toBe('{{B}}');
  });

  it('returns input unchanged when no placeholders', () => {
    expect(substitute('no placeholders here', {})).toBe('no placeholders here');
  });
});

// ----------------------------------------------------------------------------

describe('buildReservedPlaceholders', () => {
  it('builds the full reserved map from input', () => {
    const uuid = () => 'fixed-uuid-v4';
    const map = buildReservedPlaceholders(
      {
        projectName: 'my-saas',
        aegisWizardVersion: '0.17.0',
        defaultLocale: 'de',
        locales: ['de', 'en'],
        generatedAt: '2026-04-22T12:00:00.000Z',
      },
      uuid,
    );
    expect(map.PROJECT_NAME).toBe('my-saas');
    expect(map.APP_NAME).toBe('My Saas');
    expect(map.AEGIS_WIZARD_VERSION).toBe('0.17.0');
    expect(map.DEFAULT_LOCALE).toBe('de');
    expect(map.LOCALES).toBe('["de","en"]');
    expect(map.DEFAULT_TENANT_ID).toBe('fixed-uuid-v4');
    expect(map.GENERATED_AT).toBe('2026-04-22T12:00:00.000Z');
  });

  it('auto-generates GENERATED_AT when not provided', () => {
    const uuid = () => 'u';
    const map = buildReservedPlaceholders(
      {
        projectName: 'my-saas',
        aegisWizardVersion: '0.17.0',
        defaultLocale: 'de',
        locales: ['de'],
      },
      uuid,
    );
    expect(map.GENERATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('respects caller-supplied appName override', () => {
    const map = buildReservedPlaceholders(
      {
        projectName: 'my-saas',
        appName: 'Custom Studio',
        aegisWizardVersion: '0.17.0',
        defaultLocale: 'de',
        locales: ['de'],
      },
      () => 'u',
    );
    expect(map.APP_NAME).toBe('Custom Studio');
  });
});
