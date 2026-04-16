/**
 * Precision-Tier Classification for Scanners.
 *
 * Different scanner types have different realistic precision ceilings:
 *   - Pattern-matching on explicit syntax (CSP headers, cookie flags) can hit 85-95%
 *   - Taint propagation through AST is 70-85% due to inference limits
 *   - Heuristic "missing X guard" checks are 50-70% because context is fuzzy
 *
 * Flat 70% gates would unfairly punish heuristic scanners and be too lax for
 * pattern ones. This module defines tiered gates, each scanner classified once
 * and explicitly — no inline code-review arguments about where a scanner belongs.
 *
 * Scanners below their tier's gate on the measurement corpus ship as
 * `--experimental` only (quarantine tier) and don't count toward the overall
 * precision score.
 */

export type PrecisionTier = 'definitive' | 'pattern' | 'taint' | 'heuristic' | 'quarantine';

/**
 * Merge-gate per tier. A scanner whose measured precision on the dogfood
 * corpus is below its gate cannot ship in the default scan output.
 */
export const PRECISION_GATES: Record<PrecisionTier, number> = {
  /** Definitive signal — entropy, known-bad strings. High confidence expected. */
  definitive: 0.80,
  /** Syntax-level pattern matching. Clear, objective signal. */
  pattern:    0.75,
  /** Taint propagation — inference limits keep this from pattern-level precision. */
  taint:      0.70,
  /** Context-heavy heuristics — accept lower precision for harder signal. */
  heuristic:  0.60,
  /** Below any tier's gate — ships `--experimental` only, not default scan. */
  quarantine: 0.0,
};

/**
 * Explicit scanner → tier mapping.
 *
 * NOT classified here (by design):
 *   - External tool wrappers (semgrep, gitleaks, trivy, …) inherit the tool's
 *     own precision; AEGIS doesn't re-assess.
 *   - Runtime probes (auth-probe, race-probe, …) measure live behavior, not
 *     static precision.
 *   - Compliance meta-scanners (gdpr-engine, iso27001-checker, …) aggregate
 *     findings from underlying scanners; precision inherited.
 *
 * New scanners MUST be added here before merge. The `tierOf` function returns
 * undefined for unclassified scanners, which the precision CLI reports as an
 * error so merge isn't silently possible.
 */
export const SCANNER_TIERS: Partial<Record<string, PrecisionTier>> = {
  // Definitive (80% gate) — signal is objective, high-confidence
  'entropy-scanner':          'definitive',
  'gitleaks':                 'definitive',
  'trufflehog':               'definitive',

  // Pattern (75% gate) — syntax-level pattern matching
  'cookie-checker':           'pattern',
  'cors-checker':             'pattern',
  'header-checker':           'pattern',
  'crypto-auditor':           'pattern',
  'config-auditor':           'pattern',
  'console-checker':          'pattern',
  'http-timeout-checker':     'pattern',
  'jwt-checker':              'pattern',
  'open-redirect-checker':    'pattern',
  'redos-checker':            'pattern',
  'timing-safe-checker':      'pattern',
  'xss-checker':              'pattern',
  'error-leakage-checker':    'pattern',
  'rls-bypass-checker':       'pattern',
  'rsc-data-checker':         'pattern',
  'license-checker':          'pattern',
  // v0.6 additions:
  'next-public-leak':         'pattern',

  // Taint (70% gate) — AST-based dataflow
  'taint-analyzer':           'taint',
  'sql-concat-checker':       'taint',
  'ssrf-checker':             'taint',
  'path-traversal-checker':   'taint',

  // Heuristic (60% gate) — context-heavy "missing X guard"-style signals
  'auth-enforcer':            'heuristic',
  'rate-limit-checker':       'heuristic',
  'tenant-isolation-checker': 'heuristic',
  'mass-assignment-checker':  'heuristic',
  'pagination-checker':       'heuristic',
  'zod-enforcer':             'heuristic',
  'csrf-checker':             'heuristic',
  'env-validation-checker':   'heuristic',
  'logging-checker':          'heuristic',
  'upload-validator':         'heuristic',
  'prompt-injection-checker': 'heuristic',
  'supply-chain':             'heuristic',
  'react-doctor':             'heuristic',
  'dep-confusion-checker':    'heuristic',
  'i18n-quality':             'heuristic',
};

/** Look up a scanner's tier. Returns undefined for unclassified/external/probe. */
export function tierOf(scannerName: string): PrecisionTier | undefined {
  return SCANNER_TIERS[scannerName];
}

/** Return the precision gate for a scanner, or undefined if unclassified. */
export function gateFor(scannerName: string): number | undefined {
  const tier = tierOf(scannerName);
  return tier !== undefined ? PRECISION_GATES[tier] : undefined;
}

/**
 * Check whether a measured precision passes the scanner's tier gate.
 * Returns false if scanner is unclassified (must be explicit before merge).
 */
export function passesPrecisionGate(scannerName: string, precision: number): boolean {
  const gate = gateFor(scannerName);
  return gate !== undefined && precision >= gate;
}
