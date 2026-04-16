import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyPipelineSuppressions,
  configSuppressionMatches,
  globToRegex,
} from '../src/suppression-filter.js';
import type { AegisConfig, Finding, SuppressionEntry } from '../src/types.js';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-sup-'));
}

function writeFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  const full = join(projectPath, relPath);
  writeFileSync(full, content);
  return full;
}

function config(projectPath: string, overrides: Partial<AegisConfig> = {}): AegisConfig {
  return {
    projectPath,
    stack: {} as AegisConfig['stack'],
    mode: 'scan',
    ...overrides,
  };
}

function finding(
  scanner: string,
  file: string,
  line: number,
  cwe?: number,
): Finding {
  return {
    id: 'F',
    scanner,
    category: 'security',
    severity: 'high',
    title: 'test finding',
    description: 'test',
    file,
    line,
    cwe,
  };
}

describe('globToRegex', () => {
  it('matches literal paths', () => {
    const re = globToRegex('src/api/route.ts');
    expect(re.test('src/api/route.ts')).toBe(true);
    expect(re.test('src/api/other.ts')).toBe(false);
  });

  it('* matches any non-separator sequence within one segment', () => {
    const re = globToRegex('src/*/route.ts');
    expect(re.test('src/api/route.ts')).toBe(true);
    expect(re.test('src/admin/route.ts')).toBe(true);
    expect(re.test('src/api/nested/route.ts')).toBe(false); // * does not cross /
  });

  it('** matches across path segments', () => {
    const re = globToRegex('src/**/route.ts');
    expect(re.test('src/route.ts')).toBe(true);
    expect(re.test('src/api/route.ts')).toBe(true);
    expect(re.test('src/api/v1/route.ts')).toBe(true);
    expect(re.test('other/route.ts')).toBe(false);
  });

  it('multiple ** work (src/**/api/**/route.ts)', () => {
    const re = globToRegex('src/**/api/**/route.ts');
    expect(re.test('src/api/route.ts')).toBe(true);
    expect(re.test('src/foo/api/v1/route.ts')).toBe(true);
    expect(re.test('src/foo/api/v1/deep/route.ts')).toBe(true);
    expect(re.test('src/foo/route.ts')).toBe(false); // missing /api/
  });

  it('? matches exactly one char (not a separator)', () => {
    const re = globToRegex('file?.ts');
    expect(re.test('file1.ts')).toBe(true);
    expect(re.test('fileA.ts')).toBe(true);
    expect(re.test('file12.ts')).toBe(false);
    expect(re.test('file/.ts')).toBe(false);
  });

  it('escapes regex metacharacters in literal parts', () => {
    const re = globToRegex('src/api.v1/route.ts');
    expect(re.test('src/api.v1/route.ts')).toBe(true);
    expect(re.test('src/apiXv1/route.ts')).toBe(false); // . is literal
  });
});

describe('configSuppressionMatches', () => {
  const entry = (partial: Partial<SuppressionEntry>): SuppressionEntry => ({
    file: '**',
    reason: '__test__ — sufficient characters',
    ...partial,
  });

  it('catch-all entry (no rule) matches any scanner + any CWE', () => {
    const e = entry({ file: 'src/legacy/**' });
    expect(configSuppressionMatches(e, 'src/legacy/old.ts', 'auth-enforcer', 522)).toBe(true);
    expect(configSuppressionMatches(e, 'src/legacy/a/b.ts', 'csrf-checker', 352)).toBe(true);
  });

  it('rule = scanner name matches findings from that scanner', () => {
    const e = entry({ file: '**', rule: 'auth-enforcer' });
    expect(configSuppressionMatches(e, 'src/x.ts', 'auth-enforcer', 522)).toBe(true);
    expect(configSuppressionMatches(e, 'src/x.ts', 'csrf-checker', 352)).toBe(false);
  });

  it('rule = CWE-number matches findings with that CWE', () => {
    const e = entry({ file: '**', rule: 'CWE-918' });
    expect(configSuppressionMatches(e, 'src/x.ts', 'taint-analyzer', 918)).toBe(true);
    expect(configSuppressionMatches(e, 'src/x.ts', 'taint-analyzer', 78)).toBe(false);
  });

  it('does not match when file glob excludes the path', () => {
    const e = entry({ file: 'src/legacy/**' });
    expect(configSuppressionMatches(e, 'src/new/file.ts', 'any', 78)).toBe(false);
  });
});

describe('applyPipelineSuppressions — cross-scanner', () => {
  let projectPath: string;

  beforeEach(() => { projectPath = makeTempProject(); });
  afterEach(() => { rmSync(projectPath, { recursive: true, force: true }); });

  it('inline // aegis-ignore suppresses findings from ANY scanner', () => {
    const file = writeFile(projectPath, 'src/x.ts', [
      'export function handler() {}',
      '// aegis-ignore — public by design',
      'missingAuth();',
    ].join('\n'));

    const findings = [
      finding('auth-enforcer', file, 3, 522),
      finding('csrf-checker', file, 3, 352),
    ];
    const { kept, stats } = applyPipelineSuppressions(findings, config(projectPath));
    expect(kept).toHaveLength(0);
    expect(stats.suppressedByInline).toBe(2);
  });

  it('CWE-specific inline suppression only filters matching CWE from any scanner', () => {
    const file = writeFile(projectPath, 'src/x.ts', [
      'line1;',
      '// aegis-ignore CWE-522 — we intend this route to be public',
      'line3;',
    ].join('\n'));

    const findings = [
      finding('auth-enforcer', file, 3, 522), // suppressed
      finding('csrf-checker', file, 3, 352),  // not — wrong CWE
    ];
    const { kept } = applyPipelineSuppressions(findings, config(projectPath));
    expect(kept).toHaveLength(1);
    expect(kept[0].scanner).toBe('csrf-checker');
  });

  it('config-level suppression filters by scanner name (auth-enforcer across a legacy dir)', () => {
    const legacyFile = writeFile(projectPath, 'src/legacy/old.ts', 'x;');
    const newFile = writeFile(projectPath, 'src/new/fresh.ts', 'x;');

    const findings = [
      finding('auth-enforcer', legacyFile, 1, 522),
      finding('auth-enforcer', newFile, 1, 522),
      finding('csrf-checker', legacyFile, 1, 352), // different scanner, not suppressed
    ];
    const cfg = config(projectPath, {
      suppressions: [{
        file: 'src/legacy/**',
        rule: 'auth-enforcer',
        reason: 'intentional public endpoints scheduled for removal',
      }],
    });
    const { kept, stats } = applyPipelineSuppressions(findings, cfg);
    expect(kept).toHaveLength(2); // new/fresh + csrf in legacy
    expect(stats.suppressedByConfig).toBe(1);
  });

  it('config-level catch-all (no rule) filters ALL scanners in file glob', () => {
    const legacyFile = writeFile(projectPath, 'src/legacy/a.ts', 'x;');
    const newFile = writeFile(projectPath, 'src/new/b.ts', 'x;');

    const findings = [
      finding('auth-enforcer', legacyFile, 1, 522),
      finding('csrf-checker', legacyFile, 1, 352),
      finding('header-checker', legacyFile, 1, 693),
      finding('auth-enforcer', newFile, 1, 522),
    ];
    const cfg = config(projectPath, {
      suppressions: [{
        file: 'src/legacy/**',
        reason: 'all checks disabled for sunset directory',
      }],
    });
    const { kept, stats } = applyPipelineSuppressions(findings, cfg);
    expect(kept).toHaveLength(1);
    expect(kept[0].file).toContain('b.ts');
    expect(stats.suppressedByConfig).toBe(3);
  });

  it('warnUnused=false silences unused-suppression warnings', () => {
    const file = writeFile(projectPath, 'src/x.ts', [
      '// aegis-ignore — never matched',
      'line2;',
    ].join('\n'));
    const findings = [finding('auth-enforcer', file, 999, 522)]; // wrong line
    const cfg = config(projectPath, { suppressionOptions: { warnUnused: false } });
    const { stats } = applyPipelineSuppressions(findings, cfg);
    expect(stats.unusedWarnings).toHaveLength(0);
  });

  it('warnNaked=false silences naked-suppression warnings', () => {
    const file = writeFile(projectPath, 'src/x.ts', [
      '// aegis-ignore',
      'line2;',
    ].join('\n'));
    const findings = [finding('auth-enforcer', file, 2, 522)];
    const cfg = config(projectPath, { suppressionOptions: { warnNaked: false } });
    const { stats } = applyPipelineSuppressions(findings, cfg);
    expect(stats.nakedWarnings).toHaveLength(0);
  });

  it('file read failure degrades gracefully (no inline suppressions, no crash)', () => {
    const findings = [finding('auth-enforcer', '/nonexistent/path.ts', 1, 522)];
    const { kept, stats } = applyPipelineSuppressions(findings, config(projectPath));
    expect(kept).toHaveLength(1); // finding survives (no suppressions to apply)
    expect(stats.suppressedByInline).toBe(0);
  });

  it('detects unused suppressions in files that produced NO findings (scannedFiles mode)', () => {
    // A clean file with a stale `// aegis-ignore` left behind after a refactor.
    const cleanFile = writeFile(projectPath, 'src/clean.ts', [
      '// aegis-ignore — used to catch exec() calls, but refactor removed them',
      'const x = 1;',
    ].join('\n'));
    // A file that does have findings (for contrast)
    const dirtyFile = writeFile(projectPath, 'src/dirty.ts', [
      '// aegis-ignore — this will be used',
      'exec(taintedInput);',
    ].join('\n'));

    const findings = [finding('taint-analyzer', dirtyFile, 2, 78)];
    const { stats } = applyPipelineSuppressions(
      findings,
      config(projectPath),
      [cleanFile, dirtyFile],
    );

    // The clean-file suppression is unused; the dirty-file suppression was hit
    const unusedFiles = stats.unusedWarnings.map((w) => w.match(/in (\S+):/)?.[1]);
    expect(unusedFiles.some((f) => f && f.includes('clean.ts'))).toBe(true);
    expect(unusedFiles.some((f) => f && f.includes('dirty.ts'))).toBe(false);
  });

  it('without scannedFiles arg: only files with findings get unused-scan', () => {
    // Legacy behavior — pre-1c refactor. Still supported.
    const cleanFile = writeFile(projectPath, 'src/clean.ts', [
      '// aegis-ignore — stale, but scanned only if findings exist',
      'const x = 1;',
    ].join('\n'));
    const { stats } = applyPipelineSuppressions([], config(projectPath));
    expect(stats.unusedWarnings).toHaveLength(0);
  });
});
