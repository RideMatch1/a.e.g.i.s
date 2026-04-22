/**
 * Day-2 end-to-end smoke test.
 *
 * Drives runNew() in non-interactive mode against a Tier-1 minimal config
 * fixture, then asserts:
 *   - exit code is OK (0)
 *   - both aegis.config.json AND <project>-brief.md emit to the output dir
 *   - brief has no unsubstituted UPPER_SNAKE placeholders
 *   - brief has at least 15 H2 sections
 *   - emitted config has selected_patterns populated (length 8 for full
 *     saas-starter fixture)
 *   - brief size is within a sane range (10k-60k bytes)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runNew, EXIT_OK } from '../src/commands/new.js';

const PATTERNS_DIR = resolve(__dirname, '..', '..', '..', 'docs', 'patterns');

const BASE_CONFIG = {
  $schema: 'https://aegis.dev/schemas/config-v1.json',
  aegis_version: '0.17.0',
  generated_at: '2026-04-23T00:00:00.000Z',
  identity: {
    project_name: 'e2e-test',
    project_description: 'End-to-end test project for Day-2 brief-generator.',
    app_name: 'E2E Test',
    company_name: 'Example GmbH',
    target_branche: 'generic',
    target_jurisdiction: 'DE',
    b2b_or_b2c: 'b2b',
    expected_users: '100-1k',
  },
};

describe('Day-2 E2E: new command emits config + brief', () => {
  let tmpRoot: string;
  let configPath: string;
  let outputDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-e2e-'));
    configPath = join(tmpRoot, 'input.json');
    outputDir = join(tmpRoot, 'out');
    writeFileSync(configPath, JSON.stringify(BASE_CONFIG), 'utf-8');
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('emits both aegis.config.json and <project>-brief.md by default', async () => {
    const exit = await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });
    expect(exit).toBe(EXIT_OK);
    const cfgPath = join(outputDir, 'aegis.config.json');
    const briefPath = join(outputDir, 'e2e-test-brief.md');
    expect(existsSync(cfgPath)).toBe(true);
    expect(existsSync(briefPath)).toBe(true);
  });

  it('emitted config has selected_patterns length 8 for saas-starter default', async () => {
    const exit = await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });
    expect(exit).toBe(EXIT_OK);
    const cfg = JSON.parse(
      readFileSync(join(outputDir, 'aegis.config.json'), 'utf-8'),
    );
    expect(cfg.selected_patterns).toHaveLength(8);
    expect(cfg.selected_patterns[0]).toMatchObject({
      category: 'foundation',
      name: 'multi-tenant-supabase',
    });
  });

  it('brief has zero unsubstituted UPPER_SNAKE placeholders', async () => {
    await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });
    const brief = readFileSync(
      join(outputDir, 'e2e-test-brief.md'),
      'utf-8',
    );
    const leaks = brief.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
    expect(leaks).toBeNull();
  });

  it('brief has at least 15 H2 sections', async () => {
    await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });
    const brief = readFileSync(
      join(outputDir, 'e2e-test-brief.md'),
      'utf-8',
    );
    const h2Count = (brief.match(/^## /gm) || []).length;
    expect(h2Count).toBeGreaterThanOrEqual(15);
  });

  it('brief size is within expected range (10k-60k bytes)', async () => {
    await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });
    const brief = readFileSync(
      join(outputDir, 'e2e-test-brief.md'),
      'utf-8',
    );
    expect(brief.length).toBeGreaterThan(10_000);
    expect(brief.length).toBeLessThan(60_000);
  });

  it('--output-mode=brief writes only the brief file', async () => {
    const exit = await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      outputMode: 'brief',
      patternsDir: PATTERNS_DIR,
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(outputDir, 'e2e-test-brief.md'))).toBe(true);
    expect(existsSync(join(outputDir, 'aegis.config.json'))).toBe(false);
  });

  it('--output-mode=scaffold writes only the config file', async () => {
    const exit = await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      outputMode: 'scaffold',
      patternsDir: PATTERNS_DIR,
    });
    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(outputDir, 'aegis.config.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'e2e-test-brief.md'))).toBe(false);
  });

  it('unknown --output-mode is a user error (exit 1)', async () => {
    const exit = await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      outputMode: 'gibberish',
      patternsDir: PATTERNS_DIR,
    });
    expect(exit).toBe(1);
  });

  it('brief begins with the project-name-in-header', async () => {
    await runNew('e2e-test', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });
    const brief = readFileSync(
      join(outputDir, 'e2e-test-brief.md'),
      'utf-8',
    );
    expect(brief.startsWith('# Agent Brief: e2e-test')).toBe(true);
  });
});
