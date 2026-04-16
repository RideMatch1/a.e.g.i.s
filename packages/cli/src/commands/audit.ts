import { loadConfig, Orchestrator, getChangedFiles } from '@aegis-scan/core';
import { getAllScanners } from '@aegis-scan/scanners';
import ora from 'ora';
import { selectReporter, writeStdout } from '../utils.js';

export interface AuditOptions {
  format?: string;
  target?: string;
  color?: boolean;
  diff?: string;
  verbose?: boolean;
}

const MACHINE_FORMATS = new Set(['json', 'sarif']);

function shouldHideInfoFindings(format: string | undefined, verbose: boolean | undefined): boolean {
  if (verbose) return false;
  if (format && MACHINE_FORMATS.has(format)) return false;
  return true;
}

export async function runAudit(path: string, options: AuditOptions): Promise<number> {
  const resolvedPath = path || process.cwd();

  const spinner = ora('Loading config...').start();

  try {
    const config = await loadConfig(resolvedPath, 'audit');

    if (options.target) {
      config.target = options.target;
    }

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
    for (const scanner of allScanners) {
      orchestrator.register(scanner);
    }

    const diffLabel = config.diffFiles ? ` (diff: ${config.diffFiles.length} files)` : '';
    spinner.text = `Running full audit of ${resolvedPath} (${allScanners.length} scanners)${diffLabel}...`;

    const result = await orchestrator.run(config);

    spinner.stop();

    const displayResult = shouldHideInfoFindings(options.format, options.verbose)
      ? { ...result, findings: result.findings.filter((f) => f.severity !== 'info') }
      : result;

    const reporter = selectReporter(options.format);
    const output = reporter.format(displayResult);

    await writeStdout(output + '\n');

    return result.blocked ? 1 : 0;
  } catch (err) {
    spinner.fail('Audit failed');
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
