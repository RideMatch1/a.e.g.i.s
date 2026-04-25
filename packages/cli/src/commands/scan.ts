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

/**
 * v0.15.6 D-B-001 — per-scanner install-hints for the cold-install-UX
 * banner. Replaces the prior `aegis doctor` broken-promise reference
 * (the subcommand does not exist in the CLI; a user who reads the
 * banner and types `aegis doctor` gets `too many arguments`).
 * Map maintained per Rule #12-extended — external install-commands
 * are empirically invoked pre-commit (brew info --formula, docker
 * manifest inspect, etc.). v0.16.2 D-R7-001 corrected a v0.15.6-era
 * oversight where `brew install bearer` shipped without a
 * `brew info --formula bearer` check and turned out to resolve to
 * "No available formula" — now routed through bearer's canonical
 * Docker-Hub image (pull_count 277k+ at correction-time) which
 * matches the existing docker-pattern precedent used for `zap`.
 * Scanners not in the map fall back to a generic "see README" hint.
 */
const EXTERNAL_INSTALL_HINTS: Record<string, string> = {
  semgrep: 'brew install semgrep',
  bearer: 'docker pull bearer/bearer',
  gitleaks: 'brew install gitleaks',
  trufflehog: 'brew install trufflehog',
  'osv-scanner': 'brew install osv-scanner',
  'npm-audit': 'shipped with Node.js (npm >= 6)',
  'license-checker': 'npm i -g license-checker',
  nuclei: 'brew install nuclei',
  zap: 'docker pull owasp/zap2docker-stable',
  trivy: 'brew install trivy',
  hadolint: 'brew install hadolint',
  checkov: 'pip install checkov',
  testssl: 'brew install testssl',
  'react-doctor': 'npx -y react-doctor@latest .',
  'axe-lighthouse': 'npm i -g @lhci/cli  (requires Chromium)',
  'lighthouse-performance': 'npm i -g @lhci/cli  (requires Chromium)',
};

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
        const changedFiles = await getChangedFiles(resolvedPath, options.diff);
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
      // v0.15.6 D-B-001 — concrete per-scanner install-hints instead of
      // the prior `aegis doctor` broken-promise reference. Each hint in
      // EXTERNAL_INSTALL_HINTS was empirically verified per Rule #12.
      const lines = [
        `⚠️  ${unavailable.length}/${TOTAL_EXTERNAL_TOOLS} external scanners unavailable — built-in coverage is partial.`,
        `Install missing tools for full audit coverage:`,
      ];
      for (const s of unavailable) {
        const hint = EXTERNAL_INSTALL_HINTS[s.scanner] ?? 'see README for install instructions';
        lines.push(`    ${s.scanner.padEnd(24)} — ${hint}`);
      }
      lines.push(
        `CI-ready setup: \`aegis init\` writes .github/workflows/aegis.yml into your project.`,
        `Run \`aegis --help\` for the full CLI reference.`,
      );
      process.stderr.write(lines.join('\n') + '\n');
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
