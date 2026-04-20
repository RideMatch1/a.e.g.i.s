import { loadConfig, Orchestrator, getChangedFiles } from '@aegis-scan/core';
import { getAllScanners } from '@aegis-scan/scanners';
import ora from 'ora';
import type { ScanCategory } from '@aegis-scan/core';
import { selectReporter, writeStdout } from '../utils.js';

const FAST_CATEGORIES: ScanCategory[] = [
  'security',
  'dependencies',
  'quality',
  'compliance',
  'i18n',
];

/**
 * v0.15.2 Item-7 — denominator for the cold-install-UX banner text.
 * AEGIS ships external-tool wrappers for roughly 16 third-party
 * scanners (semgrep, gitleaks, trufflehog, osv-scanner, trivy,
 * hadolint, checkov, testssl, bearer, npm-audit, axe-lighthouse,
 * lighthouse-perf, nuclei, zap, react-doctor, supply-chain). Bump
 * this constant when adding a new external-tool wrapper so the
 * banner fraction stays honest.
 */
const TOTAL_EXTERNAL_TOOLS = 16;

export interface ScanOptions {
  format?: string;
  color?: boolean;
  diff?: string;
  /** Include info-severity findings in formatted output. Default: hidden. */
  verbose?: boolean;
}

/**
 * Human-readable output formats hide info-severity findings by default to
 * reduce noise (i18n hints, style suggestions, etc. typically at info-level).
 * Machine-readable formats (json, sarif) always include everything for CI/CD.
 */
const MACHINE_FORMATS = new Set(['json', 'sarif']);

function shouldHideInfoFindings(format: string | undefined, verbose: boolean | undefined): boolean {
  if (verbose) return false;
  if (format && MACHINE_FORMATS.has(format)) return false;
  return true;
}

export async function runScan(path: string, options: ScanOptions): Promise<number> {
  const resolvedPath = path || process.cwd();

  const spinner = ora('Loading config...').start();

  try {
    const config = await loadConfig(resolvedPath, 'scan');

    // Diff mode: resolve changed files
    if (options.diff) {
      try {
        const changedFiles = getChangedFiles(resolvedPath, options.diff);
        config.diffFiles = changedFiles;
        spinner.text = `Diff mode: ${changedFiles.length} files changed vs ${options.diff}`;
      } catch (err) {
        spinner.fail(`Failed to get diff against '${options.diff}'`);
        console.error(err instanceof Error ? err.message : String(err));
        return 1;
      }
    }

    spinner.text = `Detected stack: ${config.stack.framework} / ${config.stack.database}`;

    const orchestrator = new Orchestrator();

    const allScanners = getAllScanners();
    const fastScanners = allScanners.filter((s) => FAST_CATEGORIES.includes(s.category));

    for (const scanner of fastScanners) {
      orchestrator.register(scanner);
    }

    const diffLabel = config.diffFiles ? ` (diff: ${config.diffFiles.length} files)` : '';
    spinner.text = `Scanning ${resolvedPath} (${fastScanners.length} scanners)${diffLabel}...`;

    const result = await orchestrator.run(config);

    spinner.stop();

    // v0.15.2 Item-7 — cold-install-UX banner. When external-tool
    // wrappers return available:false (commandExists failed for their
    // binary on PATH), surface a stderr-only diagnostic so human
    // operators know the scan ran with partial coverage. Stdout stays
    // untouched so --format json consumers piping to jq get a clean
    // payload (JSON-purity is the non-negotiable contract).
    const unavailable = result.scanResults.filter((s) => !s.available);
    if (unavailable.length > 0) {
      const names = unavailable.map((s) => s.scanner).join(', ');
      const banner =
        `⚠️  ${unavailable.length}/${TOTAL_EXTERNAL_TOOLS} external scanners unavailable `
        + `(${names}). Built-in coverage is partial. Install for full audit: `
        + `aegis doctor (v0.15.3). See .github/workflows/aegis.yml for CI-ready setup.\n`;
      process.stderr.write(banner);
    }

    // Hide info-severity findings (e.g., i18n hardcoded-text hints) from
    // human-readable output by default — they dominate the output without
    // being actionable. Machine formats (json/sarif) keep everything for CI.
    const displayResult = shouldHideInfoFindings(options.format, options.verbose)
      ? { ...result, findings: result.findings.filter((f) => f.severity !== 'info') }
      : result;

    const reporter = selectReporter(options.format);
    const output = reporter.format(displayResult);

    await writeStdout(output + '\n');

    return result.blocked ? 1 : 0;
  } catch (err) {
    spinner.fail('Scan failed');
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
