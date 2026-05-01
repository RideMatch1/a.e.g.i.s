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
        `  Includes: DAST scanners (ZAP, Nuclei) + external LLM-agent\n` +
          `  pentest frameworks (Strix, PTAI, Pentest-Swarm-AI), PLUS active\n` +
          `  probes (fake-JWT auth, concurrent POST race, header-tampering,\n` +
          `  rate-limit, privilege-escalation).`,
      ),
    );
  } else {
    console.error(
      chalk.yellow(
        `  Includes: DAST scanners (ZAP, Nuclei) + external LLM-agent\n` +
          `  pentest frameworks (Strix, PTAI, Pentest-Swarm-AI) actively\n` +
          `  probing the target URL. Does NOT run aegis siege's active-probe\n` +
          `  set (auth / race / header / rate-limit / privesc) — that scope\n` +
          `  remains opt-in via aegis siege.`,
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
  // F-DISCLAIMER-2 — authorization-form enumeration. Operators frequently
  // ask "what counts as authorization?". Naming the canonical forms reduces
  // ambiguity and shifts the legal-clarity burden off the tool.
  console.error(chalk.yellow(`  Acceptable authorization-forms include:`));
  console.error(chalk.dim(`    • Rules of Engagement (ROE) document for the engagement`));
  console.error(chalk.dim(`    • Statement of Work (SOW) or signed pentest agreement`));
  console.error(chalk.dim(`    • Bug-bounty programme scope explicitly covering the target`));
  console.error(chalk.dim(`    • Internal change-management approval (for own systems)`));
  console.error(chalk.dim(`    • Equivalent written authorization from the system owner\n`));
  // F-DISCLAIMER-2 — negative-list. Explicit refusal-of-action set so
  // operators (and downstream LLM-agent integrators) know the safety
  // floor, even when prompted to do otherwise.
  console.error(chalk.yellow(`  AEGIS active modes will NOT:`));
  console.error(chalk.dim(`    • destroy, modify, or exfiltrate target data`));
  console.error(chalk.dim(`    • take systems offline or disrupt production service`));
  console.error(chalk.dim(`    • move laterally outside the declared engagement scope`));
  console.error(chalk.dim(`    • bypass authentication when authorization is missing`));
  console.error(chalk.dim(`    • silently elevate privileges or persist on the target\n`));
  // F-DISCLAIMER-2 — third-party LLM data-flow advisory. DAST scanners
  // Strix / PTAI / Pentest-Swarm-AI are LLM-agent frameworks invoked in
  // both pentest and siege modes (post v0.17.8 mode-gate); operators
  // should know data leaves the local machine when they enable them.
  console.error(chalk.yellow(`  Third-party LLM data-flow advisory:`));
  console.error(chalk.dim(`    DAST agents Strix / PTAI / Pentest-Swarm-AI are LLM-agent`));
  console.error(chalk.dim(`    frameworks. Target URLs, response bodies, and findings may`));
  console.error(chalk.dim(`    be transmitted to third-party LLM providers during the run.`));
  console.error(chalk.dim(`    For sensitive engagements, configure local-model endpoints`));
  console.error(chalk.dim(`    or redact target-identifying data before invocation.\n`));
  console.error(
    chalk.yellow(
      `  By passing --confirm you affirm authorization for the specified target.`,
    ),
  );
  // Only siege has --state-file (per packages/cli/src/index.ts); pentest does
  // not, so the audit-trail clause is mode-specific (v0.17.8 MED-003 closure).
  if (mode === 'siege') {
    console.error(chalk.dim(`  AEGIS records the authorization timestamp to stderr (and to`));
    console.error(chalk.dim(`  --state-file when configured) for audit-trail purposes.\n`));
  } else {
    console.error(chalk.dim(`  AEGIS records the authorization timestamp to stderr for`));
    console.error(chalk.dim(`  audit-trail purposes.\n`));
  }
  console.error(chalk.dim(`  Add --confirm to acknowledge and proceed.`));
  console.error(
    chalk.dim(
      `  Example: ${cmdName} . --target ${target.includes('://') ? target : 'https://localhost:3000'} --confirm\n`,
    ),
  );
  return { confirmed: false };
}
