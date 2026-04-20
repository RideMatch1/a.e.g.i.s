import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../src/config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-config-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writePkg(dir: string, pkg: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

describe('loadConfig — basic behavior', () => {
  it('throws when project path does not exist', async () => {
    await expect(loadConfig('/nonexistent/path/that/cannot/exist')).rejects.toThrow(/does not exist/);
  });

  it('returns config for valid directory', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    const config = await loadConfig(tmpDir);
    expect(config).toBeDefined();
    expect(config.projectPath).toBe(tmpDir);
  });

  it('returns auto-detected stack', async () => {
    writePkg(tmpDir, {
      dependencies: {
        next: '^14.0.0',
        '@supabase/supabase-js': '^2.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    });
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');

    const config = await loadConfig(tmpDir);

    expect(config.stack.framework).toBe('nextjs');
    expect(config.stack.database).toBe('supabase');
    expect(config.stack.language).toBe('typescript');
  });

  it('sets mode correctly', async () => {
    writePkg(tmpDir, { dependencies: {} });

    expect((await loadConfig(tmpDir, 'scan')).mode).toBe('scan');
    expect((await loadConfig(tmpDir, 'audit')).mode).toBe('audit');
    expect((await loadConfig(tmpDir, 'pentest')).mode).toBe('pentest');
    expect((await loadConfig(tmpDir, 'siege')).mode).toBe('siege');
    expect((await loadConfig(tmpDir, 'fortress')).mode).toBe('fortress');
  });

  it('defaults mode to scan', async () => {
    writePkg(tmpDir, { dependencies: {} });
    const config = await loadConfig(tmpDir);
    expect(config.mode).toBe('scan');
  });
});

describe('loadConfig — default ignore paths', () => {
  it('includes node_modules in ignore list', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.ignore).toContain('node_modules');
  });

  it('includes .git in ignore list', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.ignore).toContain('.git');
  });

  it('includes .next in ignore list', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.ignore).toContain('.next');
  });

  it('includes dist in ignore list', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.ignore).toContain('dist');
  });

  it('includes coverage in ignore list', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.ignore).toContain('coverage');
  });

  it('includes test + benchmark dirs in ignore list (v0.7.1 BLOCKER fix)', async () => {
    // Pre-fix: scanning a project with __tests__ / benchmark / fixtures
    // flooded findings with intentionally-vulnerable fixture code +
    // mocked test data — AEGIS-on-AEGIS scored 0/F/CRITICAL on its OWN
    // benchmark fixtures. Any user running `aegis scan .` from a repo
    // with a test suite saw the same noise flood.
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    for (const dir of [
      '__tests__', '__test__', 'test', 'tests',
      '__mocks__', '__fixtures__', 'fixtures',
      'benchmark', 'benchmarks',
    ]) {
      expect(config.ignore, `default ignore missing '${dir}'`).toContain(dir);
    }
  });

  it('has at least 5 default ignore paths', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.ignore!.length).toBeGreaterThanOrEqual(5);
  });

  it('ignore list is an array', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(Array.isArray(config.ignore)).toBe(true);
  });
});

describe('loadConfig — projectPath', () => {
  it('stores the exact projectPath provided', async () => {
    writePkg(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config.projectPath).toBe(tmpDir);
  });
});

describe('loadConfig — stack detection for different languages', () => {
  it('detects python project', async () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'Django==4.2\n');

    const config = await loadConfig(tmpDir);
    expect(config.stack.language).toBe('python');
    expect(config.stack.framework).toBe('django');
  });

  it('detects ruby project', async () => {
    fs.writeFileSync(path.join(tmpDir, 'Gemfile'), "gem 'rails'");

    const config = await loadConfig(tmpDir);
    expect(config.stack.language).toBe('ruby');
  });
});

describe('loadConfig — JSON config file loading', () => {
  it('loads aegis.config.json and merges with auto-detected values', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        locale: 'de',
        compliance: ['gdpr'],
        ignore: ['custom-dir'],
      }),
    );

    const config = await loadConfig(tmpDir);

    // Auto-detected values preserved
    expect(config.stack.framework).toBe('nextjs');
    // Config file values applied
    expect(config.locale).toBe('de');
    expect(config.compliance).toEqual(['gdpr']);
    // ignore merges with defaults — user paths are added, defaults are never lost
    expect(config.ignore).toContain('custom-dir');
    expect(config.ignore).toContain('node_modules');
    expect(config.ignore).toContain('.git');
  });

  it('config file values override auto-detected stack fields', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        stack: { database: 'prisma' },
      }),
    );

    const config = await loadConfig(tmpDir);

    // Overridden field
    expect(config.stack.database).toBe('prisma');
    // Auto-detected fields preserved
    expect(config.stack.framework).toBe('nextjs');
  });

  it('projectPath and mode come from CLI args, not config file', async () => {
    writePkg(tmpDir, {});
    // Even if someone puts projectPath/mode in the JSON, they are ignored
    // because the type excludes them and the merge logic skips them
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        locale: 'fr',
      }),
    );

    const config = await loadConfig(tmpDir, 'audit');

    expect(config.projectPath).toBe(tmpDir);
    expect(config.mode).toBe('audit');
    expect(config.locale).toBe('fr');
  });

  it('falls back to auto-detection when no config file exists', async () => {
    writePkg(tmpDir, { dependencies: { express: '^4.0.0' } });

    const config = await loadConfig(tmpDir);

    expect(config.stack.framework).toBe('express');
    expect(config.locale).toBeUndefined();
    expect(config.compliance).toBeUndefined();
  });

  it('falls back to auto-detection when JSON is malformed', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(path.join(tmpDir, 'aegis.config.json'), '{ invalid json !!!');

    const config = await loadConfig(tmpDir);

    // Should not throw, just fall back
    expect(config.stack.framework).toBe('nextjs');
    expect(config.locale).toBeUndefined();
  });

  it('merges scanners and rules from config file', async () => {
    writePkg(tmpDir, {});
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { 'crypto-auditor': { enabled: false } },
        rules: { 'CRYPTO-001': 'low' },
        target: 'https://example.com',
      }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.scanners).toEqual({ 'crypto-auditor': { enabled: false } });
    expect(config.rules).toEqual({ 'CRYPTO-001': 'low' });
    expect(config.target).toBe('https://example.com');
  });
});

describe('loadConfig — custom rules DSL (Phase 1b)', () => {
  function writeJson(dir: string, data: Record<string, unknown>): void {
    writePkg(dir, {});
    fs.writeFileSync(path.join(dir, 'aegis.config.json'), JSON.stringify(data, null, 2));
  }

  it('loads well-formed customSources / customSinks / customSanitizers', async () => {
    writeJson(tmpDir, {
      customSources: [{ pattern: 'ctx.untrusted' }],
      customSinks: [
        { pattern: 'internalExec', type: 'call', cwe: 'CWE-78', severity: 'critical' },
        { pattern: 'UnsafeBuilder', type: 'constructor', cwe: 'CWE-94' },
      ],
      customSanitizers: [
        { pattern: 'mySanitize', cwes: ['CWE-78', 'CWE-89'] },
      ],
    });

    const config = await loadConfig(tmpDir);
    expect(config.customSources).toHaveLength(1);
    expect(config.customSinks).toHaveLength(2);
    expect(config.customSinks?.[0].type).toBe('call');
    expect(config.customSinks?.[1].type).toBe('constructor');
    expect(config.customSanitizers?.[0].cwes).toEqual(['CWE-78', 'CWE-89']);
  });

  it('loads suppressions array with file globs + reasons', async () => {
    writeJson(tmpDir, {
      suppressions: [
        {
          file: 'src/legacy/**',
          rule: 'CWE-918',
          reason: 'internal proxy to whitelisted hosts only — removal Q2 2027',
        },
      ],
    });
    const config = await loadConfig(tmpDir);
    expect(config.suppressions).toHaveLength(1);
    expect(config.suppressions?.[0].file).toBe('src/legacy/**');
  });

  it('rejects suppressions with too-short reason (<10 chars)', async () => {
    writeJson(tmpDir, {
      suppressions: [{ file: 'src/**', rule: 'CWE-89', reason: 'TODO' }],
    });
    const config = await loadConfig(tmpDir);
    // Bad config falls back silently (existing behavior) — suppressions not loaded
    expect(config.suppressions).toBeUndefined();
  });

  it('rejects malformed CWE strings', async () => {
    writeJson(tmpDir, {
      customSinks: [{ pattern: 'x', cwe: 'CWE-bad' }],
    });
    const config = await loadConfig(tmpDir);
    expect(config.customSinks).toBeUndefined(); // Zod rejected, fell through
  });

  it('loads suppressionOptions with warnUnused=false', async () => {
    writeJson(tmpDir, {
      suppressionOptions: { warnUnused: false, warnNaked: true },
    });
    const config = await loadConfig(tmpDir);
    expect(config.suppressionOptions?.warnUnused).toBe(false);
    expect(config.suppressionOptions?.warnNaked).toBe(true);
  });

  it('loads allowOverrides flag', async () => {
    writeJson(tmpDir, { allowOverrides: true });
    const config = await loadConfig(tmpDir);
    expect(config.allowOverrides).toBe(true);
  });

  it('rejects unknown top-level keys (strict schema)', async () => {
    writeJson(tmpDir, { unknownField: 123 });
    const config = await loadConfig(tmpDir);
    // Unknown key → whole config falls through (existing fallback behavior)
    expect(config.customSources).toBeUndefined();
  });
});

describe('loadConfig — no JS config loading (security)', () => {
  it('ignores aegis.config.js even when present', async () => {
    writePkg(tmpDir, {});
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.js'),
      `export default { locale: 'es', compliance: ['gdpr'] };`,
    );

    const config = await loadConfig(tmpDir);

    // JS config should be ignored — only JSON is supported
    expect(config.locale).toBeUndefined();
    expect(config.compliance).toBeUndefined();
  });
});

describe('loadConfig — scanners.supplyChain.criticalDeps (v0.15)', () => {
  // Config-file rejection logs to console.error by design; silence
  // that noise during this block so test output stays clean. The
  // behaviour under test is the fallback, not the log line.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('accepts criticalDeps as non-empty string array', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { supplyChain: { criticalDeps: ['next', '@supabase/ssr'] } },
      }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.scanners).toBeDefined();
    expect(config.scanners!.supplyChain).toEqual({
      criticalDeps: ['next', '@supabase/ssr'],
    });
  });

  it('rejects criticalDeps as non-array — config discarded, falls back to auto-detection', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { supplyChain: { criticalDeps: 'next' } },
      }),
    );

    const config = await loadConfig(tmpDir);

    // Config discarded on schema violation; scanners not populated.
    expect(config.scanners).toBeUndefined();
    // Auto-detection still runs.
    expect(config.stack.framework).toBe('nextjs');
  });

  it('rejects criticalDeps with non-string elements', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { supplyChain: { criticalDeps: [1, 2] } },
      }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.scanners).toBeUndefined();
  });

  it('rejects criticalDeps with empty-string elements', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { supplyChain: { criticalDeps: ['', 'next'] } },
      }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.scanners).toBeUndefined();
  });

  it('accepts empty array criticalDeps: [] (explicit no-enforcement)', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { supplyChain: { criticalDeps: [] } },
      }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.scanners).toBeDefined();
    expect(config.scanners!.supplyChain).toEqual({ criticalDeps: [] });
  });

  it('missing criticalDeps field under supplyChain is accepted (backward-compat)', async () => {
    writePkg(tmpDir, { dependencies: { next: '^14.0.0' } });
    fs.writeFileSync(
      path.join(tmpDir, 'aegis.config.json'),
      JSON.stringify({
        scanners: { supplyChain: {} },
      }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.scanners).toBeDefined();
    expect(config.scanners!.supplyChain).toEqual({});
  });
});
