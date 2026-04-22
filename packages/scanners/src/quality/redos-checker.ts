import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — catastrophic-backtrack regex in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — catastrophic-backtrack regex in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

/**
 * ReDoS Checker — detects regular expressions with catastrophic backtracking
 * patterns that can be exploited for Denial of Service.
 *
 * OWASP A05:2021 — Security Misconfiguration
 * CWE-1333 — Inefficient Regular Expression Complexity
 */

function shouldSkipFile(filePath: string): boolean {
  if (isTestFile(filePath)) return true;
  return (
    filePath.includes('/vendor/') ||
    filePath.includes('.min.js') ||
    filePath.includes('/generated/') ||
    filePath.includes('/scripts/')
  );
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Catastrophic backtracking patterns in regex */
const DANGEROUS_REGEX_PATTERNS: Array<{ pattern: RegExp; title: string; description: string }> = [
  {
    // Nested quantifiers: (a+)+, (a*)*
    pattern: /\([^)]*[+*]\s*\)\s*[+*]/,
    title: 'ReDoS risk — nested quantifiers in regex',
    description:
      'A regex contains nested quantifiers like (a+)+ or (a*)*. These patterns cause catastrophic backtracking — the regex engine explores exponentially many paths on non-matching input. A single malicious string can freeze the event loop for minutes. Rewrite the regex to avoid nested repetition, or use a linear-time regex engine (RE2).',
  },
  {
    // Alternation with overlap inside quantified group: (a|a)+, (.*a){n}
    pattern: /\(\.\*[^)]*\)\s*\{\s*\d+/,
    title: 'ReDoS risk — quantified group with greedy wildcard',
    description:
      'A regex contains a quantified group with a greedy wildcard (.*), creating exponential backtracking possibilities. An attacker can craft input that causes the regex to hang. Replace .* with more specific character classes or use atomic groups.',
  },
  {
    // High repetition count in groups: {n,} where n > 10
    pattern: /\([^)]+\)\s*\{\s*(\d{2,})\s*,?\s*\}/,
    title: 'ReDoS risk — high repetition count in grouped pattern',
    description:
      'A regex group has a high repetition count ({n,} where n > 10), which combined with backtracking can cause severe performance degradation. Reduce the repetition count or restructure the pattern to avoid backtracking.',
  },
];

/** Patterns indicating the regex is used with user input */
const USER_INPUT_CONTEXT: RegExp[] = [
  /searchParams/,
  /request\./,
  /req\./,
  /body/,
  /query/,
  /params/,
  /input/,
];

export const redosCheckerScanner: Scanner = {
  name: 'redos-checker',
  description: 'Detects regex patterns vulnerable to catastrophic backtracking (ReDoS) — CWE-1333',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'js']);

    for (const file of files) {
      if (shouldSkipFile(file)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // Only flag files that handle user input
      if (!USER_INPUT_CONTEXT.some((p) => p.test(content))) continue;

      const lines = content.split('\n');

      for (const rule of DANGEROUS_REGEX_PATTERNS) {
        const re = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          const matchLine = findLineNumber(content, match.index);

          // For the high-repetition rule, check if count is actually > 10
          if (rule.pattern.source.includes('\\d{2,}')) {
            const countMatch = match[0].match(/\{\s*(\d+)/);
            if (countMatch && parseInt(countMatch[1], 10) <= 10) continue;
          }

          // Check if user input is referenced nearby (within 10 lines)
          const nearbyLines = lines.slice(Math.max(0, matchLine - 6), matchLine + 5).join('\n');
          if (!USER_INPUT_CONTEXT.some((p) => p.test(nearbyLines))) continue;

          const id = `REDOS-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'redos-checker',
            severity: 'high',
            title: rule.title,
            description: rule.description,
            file,
            line: matchLine,
            category: 'security',
            owasp: 'A05:2021',
            cwe: 1333,
          });
        }
      }
    }

    return {
      scanner: 'redos-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
