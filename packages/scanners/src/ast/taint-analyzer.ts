import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { trackTaint, trackTaintInProgram, trackTaintInProgramWithGraph } from './taint-tracker.js';
import { applyCustomRules } from './custom-rules.js';
import { buildProgram } from './program.js';
import { ModuleGraph } from './module-graph.js';
import { SummaryCache } from './function-summary.js';

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

export const taintAnalyzerScanner: Scanner = {
  name: 'taint-analyzer',
  description: 'AST-based taint analysis — tracks user input from sources to dangerous sinks within each file',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    try {
      await import('typescript');
      return true;
    } catch {
      return false;
    }
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    // Apply custom rules (sources/sinks/sanitizers) before scanning.
    // Returns an undo function — MUST run in finally to restore built-ins.
    // NOTE: suppression filtering is done at the orchestrator level (cross-scanner),
    // not here. This keeps behavior consistent with all other scanners.
    const restoreRules = applyCustomRules(config);

    try {
      const defaultIgnore = ['node_modules', 'dist', '.next', '.git', 'coverage'];
      const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

      const allFiles = walkFiles(projectPath, ignore, ['ts', 'js', 'tsx', 'jsx']);
      const files = allFiles.filter((f) => !isTestFile(f));

      // Build a shared ts.Program for type-aware sink resolution.
      // Returns null above PROGRAM_MODE_MAX_FILES or on creation failure —
      // we then fall back to per-file trackTaint (string-match only). This
      // is the graceful-degradation contract: no regressions, only additional
      // precision when available.
      const program = buildProgram(projectPath, files);

      // v0.7 Phase 2: when we have a Program, also build the ModuleGraph
      // once per scan so cross-file taint propagation can resolve imported
      // symbols without rebuilding the graph at every call site. The
      // summary cache is likewise scan-scoped — fresh per-scan, persistent
      // across files within the scan.
      const moduleGraph = program !== null ? new ModuleGraph(program) : null;
      const summaries = new SummaryCache();

      for (const file of files) {
        const content = readFileSafe(file);
        if (!content) continue;

        const sf = program?.getSourceFile(file);
        let taintFindings;
        if (sf && program && moduleGraph !== null) {
          // v0.7 path: whole-program + cross-file.
          taintFindings = trackTaintInProgramWithGraph(sf, program, moduleGraph, summaries);
        } else if (sf && program) {
          // v0.6 path: single-file + type-aware filtering. (Shouldn't happen
          // with moduleGraph null-only on buildProgram failure, kept for
          // defensive symmetry.)
          taintFindings = trackTaintInProgram(sf, program);
        } else {
          // Pre-v0.6 path: string-match only, no Program.
          taintFindings = trackTaint(file, content);
        }

        for (const tf of taintFindings) {
          const id = `TAINT-${String(idCounter++).padStart(3, '0')}`;
          const titlePrefix = tf.crossFile ? 'Cross-file ' : '';
          const crossFileDescr = tf.crossFile && tf.crossFileOrigin
            ? ` Cross-module origin: ${tf.crossFileOrigin}.`
            : '';
          findings.push({
            id,
            scanner: 'taint-analyzer',
            category: 'security',
            severity: tf.severity,
            title: `${titlePrefix}${tf.category} — ${tf.sourceExpr} flows unsanitized to ${tf.sinkName}()`,
            description:
              `Tainted input from ${tf.sourceExpr} (line ${tf.sourceLine}) flows to ${tf.sinkName}() (line ${tf.sinkLine}) without sanitization. ` +
              `Taint path: ${tf.taintPath.join(' \u2192 ')}.` +
              crossFileDescr +
              ` An attacker can exploit this to perform ${tf.category.toLowerCase()}.`,
            file,
            line: tf.sinkLine,
            owasp: tf.owasp,
            cwe: tf.cwe,
            ...(tf.crossFile ? { crossFile: true } : {}),
            ...(tf.crossFileOrigin ? { crossFileOrigin: tf.crossFileOrigin } : {}),
            ...(tf.confidence ? { confidence: tf.confidence } : {}),
          });
        }
      }

      return {
        scanner: 'taint-analyzer',
        category: 'security',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    } finally {
      // Always restore built-in registries, even on error
      restoreRules();
    }
  },
};
