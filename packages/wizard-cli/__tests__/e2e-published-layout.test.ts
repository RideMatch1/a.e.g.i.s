/**
 * Published-layout end-to-end test.
 *
 * Every other e2e test threads an explicit patternsDir through runNew().
 * The blocker the audit surfaced (B-01) was that pnpm test passed 179/179
 * while the actual published tarball failed on first invocation because
 * the default resolver returned a path that did not exist once the CLI
 * lived under node_modules/. This test closes M-07 by exercising the
 * default patternsDir code-path end-to-end: if the resolver ever
 * regresses, this fails before a tarball ships.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNew, EXIT_OK } from '../src/commands/new.js';

const BASE_CONFIG = {
  $schema: 'https://aegis.dev/schemas/config-v1.json',
  aegis_version: '0.17.0',
  generated_at: '2026-04-23T00:00:00.000Z',
  identity: {
    project_name: 'published-layout-smoke',
    project_description:
      'Smoke-tests the default pattern-directory resolver path end-to-end.',
    app_name: 'Published Layout Smoke',
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

describe('runNew without explicit patternsDir — default resolver path', () => {
  let tmpRoot: string;
  let configPath: string;
  let outputDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-pub-layout-'));
    configPath = join(tmpRoot, 'input.json');
    outputDir = join(tmpRoot, 'out');
    writeFileSync(configPath, JSON.stringify(BASE_CONFIG), 'utf-8');
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('emits config + brief using the default patternsDir resolver', async () => {
    const exit = await runNew('published-layout-smoke', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      // Deliberately no patternsDir — exercises resolvePatternsDir().
    });
    expect(exit).toBe(EXIT_OK);
    const cfgPath = join(outputDir, 'aegis.config.json');
    const briefPath = join(outputDir, 'published-layout-smoke-brief.md');
    expect(existsSync(cfgPath)).toBe(true);
    expect(existsSync(briefPath)).toBe(true);

    const brief = readFileSync(briefPath, 'utf-8');
    expect(brief.length).toBeGreaterThan(10_000);
    const cfgRaw = readFileSync(cfgPath, 'utf-8');
    const cfg = JSON.parse(cfgRaw) as { selected_patterns?: unknown[] };
    expect(Array.isArray(cfg.selected_patterns)).toBe(true);
    expect((cfg.selected_patterns ?? []).length).toBeGreaterThan(0);
  });
});
