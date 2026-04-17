import chalk from 'chalk';
import type { AuditResult, Finding, Reporter } from '@aegis-scan/core';

const BAR_WIDTH = 20;
const FILLED = '█';
const EMPTY = '░';

function scoreColor(score: number, max: number): (text: string) => string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return (t: string) => chalk.green(t);
  if (pct >= 0.5) return (t: string) => chalk.yellow(t);
  return (t: string) => chalk.red(t);
}

function renderBar(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  const filled = Math.round(pct * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const color = scoreColor(score, max);
  return color(FILLED.repeat(filled)) + chalk.dim(EMPTY.repeat(empty));
}

function severityColor(severity: string): (text: string) => string {
  switch (severity.toLowerCase()) {
    case 'blocker':
    case 'critical':
      return (t: string) => chalk.bgRed.white.bold(t);
    case 'high':
      return (t: string) => chalk.red.bold(t);
    case 'medium':
      return (t: string) => chalk.yellow(t);
    case 'low':
      return (t: string) => chalk.blue(t);
    default:
      return (t: string) => chalk.dim(t);
  }
}

function severityLabel(severity: string): string {
  return severityColor(severity)(` ${severity.toUpperCase()} `);
}

function formatFinding(finding: Finding): string {
  const lines: string[] = [];

  const header = `  ${severityLabel(finding.severity)} ${chalk.white.bold(finding.title)}`;
  lines.push(header);

  if (finding.file) {
    const loc = finding.line != null ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(`    ${chalk.dim('at')} ${chalk.cyan(loc)}`);
  }

  if (finding.description) {
    lines.push(`    ${chalk.dim(finding.description)}`);
  }

  if (finding.fix) {
    lines.push(`    ${chalk.green('fix:')} ${finding.fix}`);
  }

  lines.push(`    ${chalk.dim('id:')} ${chalk.dim(finding.id)}  ${chalk.dim('scanner:')} ${chalk.dim(finding.scanner)}`);

  return lines.join('\n');
}

function gradeColor(grade: string): (text: string) => string {
  switch (grade) {
    case 'S':
    case 'A':
      return (t: string) => chalk.green.bold(t);
    case 'B':
      return (t: string) => chalk.yellow.bold(t);
    case 'C':
      return (t: string) => chalk.yellow(t);
    case 'D':
      return (t: string) => chalk.red(t);
    default:
      return (t: string) => chalk.red.bold(t);
  }
}

function format(result: AuditResult): string {
  const lines: string[] = [];
  const width = 60;
  const border = chalk.dim('─'.repeat(width));

  // Header box
  lines.push(chalk.dim('╔' + '═'.repeat(width) + '╗'));
  lines.push(
    chalk.dim('║') +
      chalk.cyan.bold(' AEGIS SECURITY AUDIT'.padEnd(width)) +
      chalk.dim('║'),
  );

  // Stack line
  const stackParts = [
    result.stack.framework,
    result.stack.database,
    result.stack.language,
  ]
    .filter(Boolean)
    .join(chalk.dim(' · '));
  const stackLine = ` Stack: ${stackParts}`;
  lines.push(
    chalk.dim('║') + chalk.dim(stackLine.padEnd(width)) + chalk.dim('║'),
  );
  lines.push(chalk.dim('╚' + '═'.repeat(width) + '╝'));
  lines.push('');

  // Breakdown per category
  const categoryOrder = Object.keys(result.breakdown);
  if (categoryOrder.length > 0) {
    lines.push(chalk.bold('  Category Scores'));
    lines.push('  ' + border);
    for (const cat of categoryOrder) {
      const { score, maxScore, findings } = result.breakdown[cat as keyof typeof result.breakdown];
      const bar = renderBar(score, maxScore);
      const scoreStr = scoreColor(score, maxScore)(`${score}/${maxScore}`);
      const findStr = findings > 0 ? chalk.dim(` (${findings} finding${findings !== 1 ? 's' : ''})`) : '';
      const catLabel = cat.padEnd(22);
      lines.push(`  ${chalk.white(catLabel)} ${bar}  ${scoreStr}${findStr}`);
    }
    lines.push('  ' + border);
    lines.push('');
  }

  // Total score
  const totalColor = result.score >= 800 ? chalk.green : result.score >= 600 ? chalk.yellow : chalk.red;
  // Confidence indicator
  const confidenceColor = result.confidence === 'high'
    ? chalk.green
    : result.confidence === 'medium'
      ? chalk.yellow
      : chalk.red;
  const confidenceStr = confidenceColor(result.confidence.toUpperCase());

  // v0.9.2 (validator MINOR-01): when confidence is LOW (no security-
  // focused external tools available), prefix the badge with
  // [LOW-CONFIDENCE] so readers don't miscalibrate — a HARDENED grade
  // on an otherwise-empty project only reflects built-in scanners.
  // Machine-readable JSON keeps the canonical badge enum; only the
  // human-facing terminal surface gets the hedge.
  const badgeDisplay = result.confidence === 'low'
    ? chalk.yellow('[LOW-CONFIDENCE] ') + result.badge
    : result.badge;

  lines.push(
    `  ${chalk.bold('Total Score:')} ${totalColor.bold(String(result.score))}  ` +
      `${chalk.bold('Grade:')} ${gradeColor(result.grade)(result.grade)}  ` +
      `${chalk.bold('Badge:')} ${badgeDisplay}  ` +
      `${chalk.bold('Confidence:')} ${confidenceStr}`,
  );
  if (result.confidence === 'low') {
    lines.push(
      chalk.dim(
        '  Confidence is LOW because no security-focused external tools (semgrep, gitleaks, …) were available during the scan.',
      ),
    );
    lines.push(
      chalk.dim(
        '  Install them (see `Note` above) for MEDIUM or HIGH confidence before trusting the HARDENED / FORTRESS badges.',
      ),
    );
  }
  lines.push('');

  // BLOCKER warning
  if (result.blocked) {
    const reason = result.blockerReason ?? 'Critical security issues detected';
    lines.push(chalk.bgRed.white.bold(' ⛔  BLOCKED ') + ' ' + chalk.red.bold(reason));
    lines.push('');
  }

  // Findings
  if (result.findings.length > 0) {
    lines.push(chalk.bold(`  Findings (${result.findings.length})`));
    lines.push('  ' + border);
    for (const finding of result.findings) {
      lines.push(formatFinding(finding));
      lines.push('');
    }
  } else {
    lines.push(chalk.green('  No findings — clean audit.'));
    lines.push('');
  }

  // Scanner availability warning
  const totalScanners = result.scanResults.length;
  const unavailable = result.scanResults.filter((r) => !r.available);
  if (unavailable.length > 0) {
    const availCount = totalScanners - unavailable.length;
    const pct = Math.round((unavailable.length / totalScanners) * 100);
    if (pct >= 50) {
      lines.push(chalk.yellow.bold(`  WARNING: ${unavailable.length}/${totalScanners} scanners unavailable (${pct}%). Score may be incomplete.`));
    } else {
      lines.push(chalk.yellow(`  Note: ${unavailable.length}/${totalScanners} scanners unavailable.`));
    }
    lines.push(chalk.dim(`  Missing: ${unavailable.map((r) => r.scanner).join(', ')}`));
    lines.push(chalk.dim('  Install missing tools for a comprehensive audit.'));
    lines.push('');
  }

  // Footer
  lines.push('  ' + border);
  const durationStr = result.duration >= 1000
    ? `${(result.duration / 1000).toFixed(1)}s`
    : `${result.duration}ms`;
  const scannerCount = totalScanners;
  const availStr = unavailable.length > 0 ? ` (${totalScanners - unavailable.length} active)` : '';
  lines.push(
    chalk.dim(
      `  Completed in ${durationStr}  ·  ${scannerCount} scanner${scannerCount !== 1 ? 's' : ''}${availStr}  ·  ${result.timestamp}`,
    ),
  );

  return lines.join('\n');
}

export const terminalReporter: Reporter = {
  name: 'terminal',
  format,
};
