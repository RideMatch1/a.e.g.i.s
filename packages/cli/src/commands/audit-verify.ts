import chalk from 'chalk';
import { verifyAuditChain } from '@aegis-scan/core';

export interface AuditVerifyOptions {
  format?: 'terminal' | 'json';
  color?: boolean;
}

/**
 * `aegis audit-verify <state-file>` — verifies the SHA-256 hash-chain on a
 * JSONL engagement audit log emitted by `aegis siege --state-file`.
 *
 * Closes APTS-AR-012 (Tamper-Evident Logging with Hash Chains) — the
 * verification path is what makes the chain tamper-EVIDENT (not just
 * tamper-resistant). A chain that has been tampered with anywhere will
 * fail verification at the affected line; the operator can then audit
 * the contents and decide whether the change is benign (e.g., a known
 * post-engagement annotation) or a real integrity breach.
 */
export async function runAuditVerify(
  path: string,
  options: AuditVerifyOptions = {},
): Promise<number> {
  if (!options.color) {
    chalk.level = chalk.level === 0 ? 0 : chalk.level;
  }
  if (!path) {
    console.error(chalk.red('Error: provide a path to the audit-log file.'));
    console.error(chalk.dim('Example: aegis audit-verify /tmp/siege-2026-04-27.jsonl'));
    return 1;
  }

  const result = verifyAuditChain(path);

  if (options.format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result.ok ? 0 : 1;
  }

  if (result.ok) {
    console.log(chalk.green(`audit-verify: chain intact`));
    console.log(chalk.dim(`  events: ${result.total_events}`));
    console.log(chalk.dim(`  tail-hash: ${result.tail_hash ?? '<empty>'}`));
    console.log(chalk.dim(`  APTS-AR-012 (Tamper-Evident Logging): conformant`));
    return 0;
  }
  console.error(chalk.red(`audit-verify: chain broken`));
  console.error(chalk.red(`  ${result.error}`));
  console.error(chalk.dim(`  events processed: ${result.total_events_processed}`));
  console.error(chalk.dim(`  broken at line: ${result.broken_at}`));
  return 1;
}
