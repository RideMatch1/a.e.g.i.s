/**
 * Clobber-protection tests for runNew.
 *
 * Covers the output-file overwrite policy: a non-interactive run
 * must refuse to overwrite an existing aegis.config.json or brief
 * file unless the caller explicitly passes --force. This closes
 * M-04 — the pre-fix wizard silently clobbered existing files,
 * which is a data-loss footgun in interactive and CI-driven
 * workflows alike.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  runNew,
  EXIT_OK,
  EXIT_USER_ERROR,
} from '../src/commands/new.js';

const PATTERNS_DIR = resolve(__dirname, '..', '..', '..', 'docs', 'patterns');

const BASE_CONFIG = {
  $schema: 'https://aegis.dev/schemas/config-v1.json',
  aegis_version: '0.17.0',
  generated_at: '2026-04-23T00:00:00.000Z',
  identity: {
    project_name: 'clobber-smoke',
    project_description:
      'Fixture for exercising the pre-write clobber-protection policy.',
    app_name: 'Clobber Smoke',
    company_name: 'Example GmbH',
    target_branche: 'generic',
    target_jurisdiction: 'DE',
    b2b_or_b2c: 'b2b',
    expected_users: '100-1k',
  },
  compliance: {
    company_address: {
      street: 'Musterstraße 1',
      zip_city: '10115 Berlin',
      email: 'kontakt@example.com',
    },
  },
};

describe('runNew — clobber protection', () => {
  let tmpRoot: string;
  let configPath: string;
  let outputDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-clobber-'));
    configPath = join(tmpRoot, 'input.json');
    outputDir = join(tmpRoot, 'out');
    writeFileSync(configPath, JSON.stringify(BASE_CONFIG), 'utf-8');
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('refuses with EXIT_USER_ERROR when aegis.config.json exists (no --force)', async () => {
    mkdirSync(outputDir, { recursive: true });
    const existingConfigPath = join(outputDir, 'aegis.config.json');
    writeFileSync(existingConfigPath, '{"important":"do not destroy"}', 'utf-8');

    const exit = await runNew('clobber-smoke', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });

    expect(exit).toBe(EXIT_USER_ERROR);
    const preserved = readFileSync(existingConfigPath, 'utf-8');
    expect(preserved).toContain('do not destroy');
  });

  it('refuses with EXIT_USER_ERROR when <project>-brief.md exists (no --force)', async () => {
    mkdirSync(outputDir, { recursive: true });
    const existingBriefPath = join(outputDir, 'clobber-smoke-brief.md');
    writeFileSync(existingBriefPath, '# Hand-edited brief, do not destroy\n', 'utf-8');

    const exit = await runNew('clobber-smoke', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });

    expect(exit).toBe(EXIT_USER_ERROR);
    const preserved = readFileSync(existingBriefPath, 'utf-8');
    expect(preserved).toContain('do not destroy');
  });

  it('overwrites existing files when --force is passed', async () => {
    mkdirSync(outputDir, { recursive: true });
    const existingConfigPath = join(outputDir, 'aegis.config.json');
    writeFileSync(existingConfigPath, '{"sacrifice":"expected"}', 'utf-8');

    const exit = await runNew('clobber-smoke', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
      force: true,
    });

    expect(exit).toBe(EXIT_OK);
    const emitted = readFileSync(existingConfigPath, 'utf-8');
    expect(emitted).not.toContain('sacrifice');
    expect(emitted).toContain('"project_name": "clobber-smoke"');
  });

  it('writes normally when no pre-existing files are present', async () => {
    const exit = await runNew('clobber-smoke', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
    });

    expect(exit).toBe(EXIT_OK);
    expect(existsSync(join(outputDir, 'aegis.config.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'clobber-smoke-brief.md'))).toBe(true);
  });
});
