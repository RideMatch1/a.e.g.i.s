/**
 * Pipeline-level suppression filter.
 *
 * Applied by the Orchestrator AFTER all scanners have produced findings and
 * AFTER dedup. This makes suppressions cross-cutting: they affect every
 * scanner (auth-enforcer, csrf-checker, header-checker, taint-analyzer, …),
 * not only the taint-analyzer that originally spoke this DSL.
 *
 * Two layers:
 *   1. Inline  — `// aegis-ignore` comments in source files (finding.line scoped)
 *   2. Config  — `suppressions[]` in aegis.config.json (file glob + rule scoped)
 */
import { relative } from 'node:path';
import type { AegisConfig, Finding, SuppressionEntry } from './types.js';
import { readFileSafe } from './utils.js';
import {
  parseSuppressions,
  isSuppressed,
  getUnusedSuppressions,
  getNakedSuppressions,
  type Suppression,
} from './suppressions.js';

/**
 * Convert a user-provided glob to a RegExp.
 *
 * Supported tokens:
 *   - `**`       — zero or more path segments (crosses `/`)
 *   - `*`        — zero or more characters in a single segment (no `/`)
 *   - `?`        — exactly one character (no `/`)
 *   - everything else is literal
 *
 * Leading `/` in the glob is treated literally (don't confuse absolute paths
 * — inputs are always POSIX-normalized relative paths inside the orchestrator).
 */
export function globToRegex(glob: string): RegExp {
  // All transformations use placeholders so that intermediate regex output
  // (e.g., `.*` from `**`) is not re-matched by later rules (`*` → `[^/]*`).
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\/\*\*\//g, '__AEGIS_MIDSTAR__')
    .replace(/^\*\*\//g, '__AEGIS_PRESTAR__')
    .replace(/\/\*\*$/g, '__AEGIS_POSTSTAR__')
    .replace(/\*\*/g, '__AEGIS_DOUBLESTAR__')
    .replace(/\*/g, '__AEGIS_STAR__')
    .replace(/\?/g, '__AEGIS_QMARK__')
    .replace(/__AEGIS_MIDSTAR__/g, '/(?:.+/)?')
    .replace(/__AEGIS_PRESTAR__/g, '(?:.+/)?')
    .replace(/__AEGIS_POSTSTAR__/g, '(?:/.+)?')
    .replace(/__AEGIS_DOUBLESTAR__/g, '.*')
    .replace(/__AEGIS_STAR__/g, '[^/]*')
    .replace(/__AEGIS_QMARK__/g, '[^/]');
  return new RegExp('^' + escaped + '$');
}

/**
 * Check whether a config-level suppression entry covers the given finding.
 */
export function configSuppressionMatches(
  entry: SuppressionEntry,
  relPath: string,
  scannerName: string,
  cwe: number | undefined,
): boolean {
  if (!globToRegex(entry.file).test(relPath)) return false;
  if (entry.rule === undefined) return true; // catch-all for this file
  if (entry.rule === scannerName) return true;
  if (cwe !== undefined) {
    const m = entry.rule.match(/^CWE-(\d+)$/);
    if (m && Number.parseInt(m[1], 10) === cwe) return true;
  }
  return false;
}

export interface SuppressionStats {
  suppressedByInline: number;
  suppressedByConfig: number;
  nakedWarnings: string[];
  unusedWarnings: string[];
}

/**
 * Filter findings by suppressions. Returns kept findings + diagnostic stats.
 * Caller is responsible for emitting nakedWarnings/unusedWarnings if desired.
 *
 * @param scannedFiles  Optional list of all files that scanners visited. When
 *   provided AND `warnUnused !== false`, suppressions in these files are
 *   checked even if the file produced zero findings (catches stale
 *   suppressions left behind after refactors).
 */
export function applyPipelineSuppressions(
  findings: Finding[],
  config: AegisConfig,
  scannedFiles?: string[],
): { kept: Finding[]; stats: SuppressionStats } {
  const diagnostics = config.suppressionOptions ?? {};
  const warnUnused = diagnostics.warnUnused !== false;
  const warnNaked = diagnostics.warnNaked !== false;

  const configSups = config.suppressions ?? [];
  const fileCache = new Map<string, Suppression[]>();
  const warnedNakedFiles = new Set<string>();

  const stats: SuppressionStats = {
    suppressedByInline: 0,
    suppressedByConfig: 0,
    nakedWarnings: [],
    unusedWarnings: [],
  };

  const kept: Finding[] = [];

  function getSups(file: string): Suppression[] {
    let sups = fileCache.get(file);
    if (sups !== undefined) return sups;
    const content = readFileSafe(file);
    sups = content ? parseSuppressions(content) : [];
    fileCache.set(file, sups);

    if (warnNaked && !warnedNakedFiles.has(file)) {
      warnedNakedFiles.add(file);
      for (const naked of getNakedSuppressions(sups)) {
        stats.nakedWarnings.push(
          `[aegis] Naked suppression in ${file}:${naked.startLine} — please add a reason after '—' so future readers understand WHY.`,
        );
      }
    }
    return sups;
  }

  for (const f of findings) {
    // Inline suppression — per-file comment, finest granularity
    if (f.file && f.line !== undefined) {
      const sups = getSups(f.file);
      if (isSuppressed(f.line, f.cwe, sups)) {
        stats.suppressedByInline++;
        continue;
      }
    }

    // Config-level suppression — glob + rule
    if (configSups.length > 0) {
      const relPath = f.file
        ? relative(config.projectPath, f.file).split('\\').join('/')
        : '';
      const match = configSups.some((s) =>
        configSuppressionMatches(s, relPath, f.scanner, f.cwe),
      );
      if (match) {
        stats.suppressedByConfig++;
        continue;
      }
    }

    kept.push(f);
  }

  if (warnUnused) {
    // Scan files that produced zero findings but may still contain
    // stale `// aegis-ignore` directives. Cheap pre-filter: quick substring
    // check skips files that certainly have no suppressions.
    if (scannedFiles) {
      for (const file of scannedFiles) {
        if (fileCache.has(file)) continue;
        const content = readFileSafe(file);
        if (!content || !content.includes('aegis-ignore')) continue;
        fileCache.set(file, parseSuppressions(content));
      }
    }

    for (const [file, sups] of fileCache) {
      for (const u of getUnusedSuppressions(sups)) {
        stats.unusedWarnings.push(
          `[aegis] Unused suppression in ${file}:${u.startLine} — ` +
            `${u.cwe ? `CWE-${u.cwe}` : 'catch-all'} never matched a finding. Consider removing it.`,
        );
      }
    }
  }

  return { kept, stats };
}
