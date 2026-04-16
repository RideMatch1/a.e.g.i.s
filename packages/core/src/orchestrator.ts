import { calculateScore } from './scoring.js';
import type { Scanner, AegisConfig, AuditResult, Finding, ScanResult, Confidence } from './types.js';
import { applyPipelineSuppressions } from './suppression-filter.js';
import { walkFiles } from './utils.js';

const SCANNER_TIMEOUT_MS = 120_000; // 2 minutes per scanner

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Scanner '${label}' timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export class Orchestrator {
  private scanners: Scanner[] = [];

  register(scanner: Scanner): void {
    this.scanners.push(scanner);
  }

  async run(config: AegisConfig): Promise<AuditResult> {
    const startTime = Date.now();

    // Check availability and run all scanners in parallel
    const scanPromises = this.scanners.map(async (scanner): Promise<ScanResult> => {
      let available: boolean;
      try {
        available = await scanner.isAvailable(config.projectPath);
      } catch {
        available = false;
      }

      if (!available) {
        return {
          scanner: scanner.name,
          category: scanner.category,
          findings: [],
          duration: 0,
          available: false,
        };
      }

      const scanStart = Date.now();
      try {
        const result = await withTimeout(
          scanner.scan(config.projectPath, config),
          SCANNER_TIMEOUT_MS,
          scanner.name,
        );
        return {
          ...result,
          available: true,
          duration: result.duration ?? Date.now() - scanStart,
        };
      } catch (err) {
        return {
          scanner: scanner.name,
          category: scanner.category,
          findings: [],
          duration: Date.now() - scanStart,
          available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    const scanResults = await Promise.all(scanPromises);

    // Aggregate and deduplicate findings (same file + line + title = duplicate)
    const rawFindings: Finding[] = scanResults.flatMap((r) => r.findings);
    const seen = new Set<string>();
    let allFindings: Finding[] = [];
    for (const f of rawFindings) {
      const key = `${f.file ?? ''}:${f.line ?? 0}:${f.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        allFindings.push(f);
      }
    }

    // Diff-mode: only keep findings for changed files
    if (config.diffFiles && config.diffFiles.length > 0) {
      const diffSet = new Set(config.diffFiles);
      allFindings = allFindings.filter((f) => {
        if (!f.file) return false; // no file = project-level finding, skip in diff mode
        return diffSet.has(f.file);
      });
    }

    // Pipeline-level suppressions — applies to ALL scanners, not just taint-analyzer.
    // Inline (// aegis-ignore) + Config-level (aegis.config.json suppressions[]).
    // When warnUnused is enabled, also walk the project for stale suppressions
    // in files that produced no findings (cheap — pre-filtered by substring).
    const warnUnused = config.suppressionOptions?.warnUnused !== false;
    const scannedFiles = warnUnused
      ? walkFiles(config.projectPath, config.ignore ?? [], ['ts', 'js', 'tsx', 'jsx'])
      : undefined;
    const suppressionResult = applyPipelineSuppressions(allFindings, config, scannedFiles);
    allFindings = suppressionResult.kept;
    for (const msg of suppressionResult.stats.nakedWarnings) {
      process.stderr.write(`${msg}\n`);
    }
    for (const msg of suppressionResult.stats.unusedWarnings) {
      process.stderr.write(`${msg}\n`);
    }

    // Calculate confidence based on SECURITY-focused external tools.
    // npm-audit, react-doctor, license-checker are always available (built-in node tools)
    // and don't indicate real external security tool installation.
    const SECURITY_EXTERNAL_NAMES = ['semgrep', 'gitleaks', 'nuclei', 'trivy', 'testssl', 'zap', 'trufflehog'];
    const securityExternals = scanResults.filter(
      (r) => SECURITY_EXTERNAL_NAMES.includes(r.scanner),
    );
    const securityAvailable = securityExternals.filter((r) => r.available).length;
    let confidence: Confidence;
    if (securityAvailable >= 2) {
      confidence = 'high';
    } else if (securityAvailable >= 1) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Calculate score (confidence is passed so scoring can cap grade when low)
    const scoreResult = calculateScore(allFindings, confidence);

    const duration = Date.now() - startTime;

    return {
      score: scoreResult.score,
      grade: scoreResult.grade,
      badge: scoreResult.badge,
      blocked: scoreResult.blocked,
      blockerReason: scoreResult.blockerReason,
      breakdown: scoreResult.breakdown,
      findings: allFindings,
      scanResults,
      stack: config.stack,
      duration,
      timestamp: new Date().toISOString(),
      confidence,
    };
  }
}
