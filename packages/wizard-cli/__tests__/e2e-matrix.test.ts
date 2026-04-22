/**
 * Day-3 4-matrix E2E smoke for --verbose-brief × --lang combinations.
 *
 * Drives runNew() in non-interactive mode against a Tier-1 saas-starter
 * fixture across all four {tone, lang} combinations:
 *   - terse + en (Day-2 baseline, regression-coverage)
 *   - terse + de (new in Day-3 i18n-layer)
 *   - verbose + en (new in Day-3 verbose-mode)
 *   - verbose + de (new in Day-3 verbose + i18n together)
 *
 * Each matrix-point asserts the shape-contracts specified in the
 * dispatch-brief §5.7:
 *   - Terse brief-length is within 4,500-7,000 lines (pattern-appendix dominant)
 *   - Verbose brief-length is within 4,700-7,500 lines (slightly larger than terse)
 *   - No unsubstituted UPPER_SNAKE placeholders
 *   - Expected H2 section count >= 15
 *   - lang=de: at least 5 German-specific strings (umlauts, müssen, etc.)
 *   - tone=verbose: at least 5 rationale-markers
 *     ("Rationale", "Why ", "Alternatives considered")
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
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
    project_name: 'matrix-e2e',
    project_description: 'Day-3 matrix E2E smoke project.',
    app_name: 'Matrix E2E',
    company_name: 'Example GmbH',
    target_branche: 'generic',
    target_jurisdiction: 'DE',
    b2b_or_b2c: 'b2b',
    expected_users: '100-1k',
  },
};

interface MatrixPoint {
  tone: 'terse' | 'verbose';
  lang: 'en' | 'de';
  minLines: number;
  maxLines: number;
  expectGermanStrings: boolean;
  expectRationaleMarkers: boolean;
}

const MATRIX: MatrixPoint[] = [
  { tone: 'terse', lang: 'en', minLines: 4_500, maxLines: 7_000, expectGermanStrings: false, expectRationaleMarkers: false },
  { tone: 'terse', lang: 'de', minLines: 4_500, maxLines: 7_000, expectGermanStrings: true, expectRationaleMarkers: false },
  { tone: 'verbose', lang: 'en', minLines: 4_700, maxLines: 7_500, expectGermanStrings: false, expectRationaleMarkers: true },
  { tone: 'verbose', lang: 'de', minLines: 4_700, maxLines: 7_500, expectGermanStrings: true, expectRationaleMarkers: true },
];

describe('Day-3 E2E: 4-matrix (tone × lang)', () => {
  let tmpRoot: string;
  let configPath: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'aegis-wizard-matrix-'));
    configPath = join(tmpRoot, 'input.json');
    writeFileSync(configPath, JSON.stringify(BASE_CONFIG), 'utf-8');
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  for (const point of MATRIX) {
    const label = `${point.tone}+${point.lang}`;
    it(`${label}: generates brief within the expected line-range`, async () => {
      const outputDir = join(tmpRoot, `out-${label}`);
      const exit = await runNew('matrix-e2e', {
        nonInteractive: true,
        config: configPath,
        outputDir,
        patternsDir: PATTERNS_DIR,
        verboseBrief: point.tone === 'verbose',
        lang: point.lang,
      });
      expect(exit).toBe(EXIT_OK);
      const briefPath = join(outputDir, 'matrix-e2e-brief.md');
      const brief = readFileSync(briefPath, 'utf-8');
      const lines = brief.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(point.minLines);
      expect(lines).toBeLessThanOrEqual(point.maxLines);
    });

    it(`${label}: has zero unsubstituted UPPER_SNAKE placeholders`, async () => {
      const outputDir = join(tmpRoot, `out-${label}`);
      await runNew('matrix-e2e', {
        nonInteractive: true,
        config: configPath,
        outputDir,
        patternsDir: PATTERNS_DIR,
        verboseBrief: point.tone === 'verbose',
        lang: point.lang,
      });
      const brief = readFileSync(join(outputDir, 'matrix-e2e-brief.md'), 'utf-8');
      const leaks = brief.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
      expect(leaks).toBeNull();
    });

    it(`${label}: has at least 15 H2 section-headings`, async () => {
      const outputDir = join(tmpRoot, `out-${label}`);
      await runNew('matrix-e2e', {
        nonInteractive: true,
        config: configPath,
        outputDir,
        patternsDir: PATTERNS_DIR,
        verboseBrief: point.tone === 'verbose',
        lang: point.lang,
      });
      const brief = readFileSync(join(outputDir, 'matrix-e2e-brief.md'), 'utf-8');
      const h2Count = (brief.match(/^## /gm) || []).length;
      expect(h2Count).toBeGreaterThanOrEqual(15);
    });

    if (point.expectGermanStrings) {
      it(`${label}: contains at least 5 German-specific strings`, async () => {
        const outputDir = join(tmpRoot, `out-${label}`);
        await runNew('matrix-e2e', {
          nonInteractive: true,
          config: configPath,
          outputDir,
          patternsDir: PATTERNS_DIR,
          verboseBrief: point.tone === 'verbose',
          lang: point.lang,
        });
        const brief = readFileSync(join(outputDir, 'matrix-e2e-brief.md'), 'utf-8');
        const germanMarkers = brief.match(/[äöüß]|müssen/g) || [];
        expect(germanMarkers.length).toBeGreaterThanOrEqual(5);
      });
    }

    if (point.expectRationaleMarkers) {
      it(`${label}: contains at least 5 rationale-markers`, async () => {
        const outputDir = join(tmpRoot, `out-${label}`);
        await runNew('matrix-e2e', {
          nonInteractive: true,
          config: configPath,
          outputDir,
          patternsDir: PATTERNS_DIR,
          verboseBrief: point.tone === 'verbose',
          lang: point.lang,
        });
        const brief = readFileSync(join(outputDir, 'matrix-e2e-brief.md'), 'utf-8');
        const markers = brief.match(/Rationale|Why |Alternatives considered/g) || [];
        expect(markers.length).toBeGreaterThanOrEqual(5);
      });
    }
  }

  it('verbose-brief is strictly larger than terse-brief (same lang)', async () => {
    const terseDir = join(tmpRoot, 'terse-compare');
    const verboseDir = join(tmpRoot, 'verbose-compare');
    await runNew('matrix-e2e', {
      nonInteractive: true,
      config: configPath,
      outputDir: terseDir,
      patternsDir: PATTERNS_DIR,
      verboseBrief: false,
      lang: 'en',
    });
    await runNew('matrix-e2e', {
      nonInteractive: true,
      config: configPath,
      outputDir: verboseDir,
      patternsDir: PATTERNS_DIR,
      verboseBrief: true,
      lang: 'en',
    });
    const terse = readFileSync(join(terseDir, 'matrix-e2e-brief.md'), 'utf-8');
    const verbose = readFileSync(join(verboseDir, 'matrix-e2e-brief.md'), 'utf-8');
    expect(verbose.length).toBeGreaterThan(terse.length);
  });

  it('lang=de differs from lang=en in terse-mode (content-not-identical)', async () => {
    const enDir = join(tmpRoot, 'en-lang');
    const deDir = join(tmpRoot, 'de-lang');
    await runNew('matrix-e2e', {
      nonInteractive: true,
      config: configPath,
      outputDir: enDir,
      patternsDir: PATTERNS_DIR,
      verboseBrief: false,
      lang: 'en',
    });
    await runNew('matrix-e2e', {
      nonInteractive: true,
      config: configPath,
      outputDir: deDir,
      patternsDir: PATTERNS_DIR,
      verboseBrief: false,
      lang: 'de',
    });
    const en = readFileSync(join(enDir, 'matrix-e2e-brief.md'), 'utf-8');
    const de = readFileSync(join(deDir, 'matrix-e2e-brief.md'), 'utf-8');
    expect(de).not.toBe(en);
  });

  it('rejects unknown --lang values with user-error exit', async () => {
    const outputDir = join(tmpRoot, 'bad-lang');
    const exit = await runNew('matrix-e2e', {
      nonInteractive: true,
      config: configPath,
      outputDir,
      patternsDir: PATTERNS_DIR,
      lang: 'gibberish',
    });
    expect(exit).toBe(1);
  });
});
