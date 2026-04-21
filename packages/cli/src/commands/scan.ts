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
 * v0.15.4 D-N-003 — corrected inventory. AEGIS ships external-tool
 * wrappers for 16 third-party scanners (semgrep, bearer, gitleaks,
 * trufflehog, osv-scanner, npm-audit, license-checker, nuclei, zap,
 * trivy, hadolint, checkov, testssl, react-doctor, axe-lighthouse,
 * lighthouse-performance). The supply-chain scanner was previously
 * mis-listed here — it's internal (reads lockfiles and package.json
 * directly, no third-party binary) and must NOT count toward the
 * denominator or the unavailable-list. Bump this constant when
 * adding a new external-tool wrapper so the banner fraction stays
 * honest; classification is enforced at the source by each scanner's
 * Scanner.isExternal field (v0.15.4+).
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

    // v0.15.2 Item-7 — cold-install-UX banner. v0.15.4 D-N-003 —
    // classify via Scanner.isExternal so the banner only attributes
    // unavailable-status to wrapper-scanners (binary not on PATH),
    // never to internal stack-gated scanners whose isAvailable=false
    // is a legitimate skip (e.g., header-checker on a non-Next.js
    // project). Stdout stays untouched so --format json consumers
    // piping to jq get a clean payload.
    const externalScannerNames = new Set(
      fastScanners.filter((s) => s.isExternal === true).map((s) => s.name),
    );
    const unavailable = result.scanResults.filter(
      (s) => !s.available && externalScannerNames.has(s.scanner),
    );
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
