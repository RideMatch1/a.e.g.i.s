import path from 'node:path';
import type { AuditResult, Finding, Reporter } from '@aegis-scan/core';

/**
 * Normalize a single finding's file field so reporter output is
 * consumer-stable across CI runners with different checkout locations:
 *
 *   - `undefined` or `null` → `null` (explicit project-level marker so
 *     `JSON.stringify` emits the key rather than omitting it)
 *   - Absolute path under `scanRoot` → `path.relative(scanRoot, file)`
 *   - Absolute path outside `scanRoot` → still `path.relative(...)`
 *     which yields a node-standard negative-relative path (e.g.
 *     `../outer/file.ts`)
 *   - Already-relative path → unchanged (no double-transform)
 */
function normalizeFindingFile(finding: Finding, scanRoot: string): Finding {
  if (finding.file == null) {
    return { ...finding, file: null };
  }
  if (path.isAbsolute(finding.file)) {
    return { ...finding, file: path.relative(scanRoot, finding.file) };
  }
  return finding;
}

function format(result: AuditResult): string {
  const scanRoot = result.scanRoot ?? process.cwd();
  const normalized: AuditResult = {
    ...result,
    findings: result.findings.map((f) => normalizeFindingFile(f, scanRoot)),
  };
  return JSON.stringify(normalized, null, 2);
}

export const jsonReporter: Reporter = {
  name: 'json',
  format,
};
