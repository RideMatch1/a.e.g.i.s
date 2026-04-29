import chalk from 'chalk';

export type ActiveMode = 'siege' | 'pentest';

interface DisclaimerOptions {
  mode: ActiveMode;
  target: string;
}

/**
 * Active-mode authorization gate. Both `aegis siege` and `aegis pentest`
 * send live HTTP traffic to operator-supplied targets:
 *
 *   - siege: fake-JWT auth probes, concurrent POST race probes, header-
 *     tampering probes, external LLM-agent pentest frameworks.
 *   - pentest: DAST scanners (ZAP / Nuclei / Strix / PTAI / Pentest-Swarm)
 *     against the target URL.
 *
 * Sending unauthorized probes against third-party systems may violate
 * CFAA (US 18 USC §1030), §202a-c StGB (DE), Computer Misuse Act 1990
 * (UK), and equivalent statutes worldwide. The --confirm flag is the
 * operator's acknowledgement of authorization.
 *
 * Returns:
 *   - { confirmed: true }  when --confirm was passed (after printing a
 *     short authorization-acknowledgement banner to stderr)
 *   - { confirmed: false } otherwise (after printing the full
 *     disclaimer + usage hint to stderr)
 */
export function evaluateActiveModeAuthorization(
  options: DisclaimerOptions & { confirm: boolean },
): { confirmed: boolean } {
  const { mode, target, confirm } = options;
  const cmdName = mode === 'siege' ? 'aegis siege' : 'aegis pentest';

  if (confirm) {
    // Brief acknowledgement banner — recorded in --state-file when present.
    console.error(
      chalk.dim(
        `  [authorization] ${cmdName} --confirm acknowledged for ${target} ` +
          `at ${new Date().toISOString()}`,
      ),
    );
    return { confirmed: true };
  }

  console.error(chalk.red.bold(`\n  ⚠  AEGIS ${mode.toUpperCase()} — ACTIVE-MODE TRAFFIC\n`));
  console.error(chalk.yellow(`  Target: ${target}`));
  console.error(chalk.yellow(`  This mode sends LIVE HTTP REQUESTS to the target URL.`));
  if (mode === 'siege') {
    console.error(
      chalk.yellow(
        `  Includes: fake-JWT auth probes, concurrent POST race probes,\n` +
          `  header-tampering probes, and external LLM-agent pentest frameworks.`,
      ),
    );
  } else {
    console.error(
      chalk.yellow(
        `  Includes: DAST scanners (ZAP, Nuclei, Strix, PTAI, Pentest-Swarm-AI)\n` +
          `  that actively probe the target URL.`,
      ),
    );
  }
  console.error('');
  console.error(
    chalk.yellow(
      `  Only run against systems you own or have written authorization to test.\n` +
        `  Unauthorized active probing of third-party systems may violate:`,
    ),
  );
  console.error(chalk.dim(`    • CFAA (US 18 USC §1030) — Computer Fraud and Abuse Act`));
  console.error(chalk.dim(`    • §202a-c StGB (DE) — Ausspähen / Abfangen von Daten`));
  console.error(chalk.dim(`    • Computer Misuse Act 1990 (UK)`));
  console.error(chalk.dim(`    • equivalent statutes in other jurisdictions\n`));
  console.error(
    chalk.yellow(
      `  By passing --confirm you affirm authorization for the specified target.`,
    ),
  );
  console.error(chalk.dim(`  AEGIS records the authorization timestamp to stderr (and to`));
  console.error(chalk.dim(`  --state-file when configured) for audit-trail purposes.\n`));
  console.error(chalk.dim(`  Add --confirm to acknowledge and proceed.`));
  console.error(
    chalk.dim(
      `  Example: ${cmdName} . --target ${target.includes('://') ? target : 'https://localhost:3000'} --confirm\n`,
    ),
  );
  return { confirmed: false };
}
