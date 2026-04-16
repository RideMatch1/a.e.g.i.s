import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/**
 * Patterns that indicate a string comparison is being used for a secret/token/credential.
 * These are timing-attack-vulnerable when not using a constant-time comparison function.
 * Both left-hand and right-hand positions are checked.
 */
const TIMING_VULNERABLE_PATTERNS = [
  // token === / !== (token on left or right)
  /(?<!\w)token\s*!==|!==\s*token(?!\w)/,
  /(?<!\w)token\s*===|===\s*token(?!\w)/,
  // secret === / !==
  /(?<!\w)secret\s*!==|!==\s*secret(?!\w)/,
  /(?<!\w)secret\s*===|===\s*secret(?!\w)/,
  // apiKey === / !==
  /(?<!\w)apiKey\s*!==|!==\s*apiKey(?!\w)/,
  /(?<!\w)apiKey\s*===|===\s*apiKey(?!\w)/,
  // CRON_SECRET comparisons
  /===\s*process\.env\.CRON_SECRET|process\.env\.CRON_SECRET\s*===/,
  /!==\s*process\.env\.CRON_SECRET|process\.env\.CRON_SECRET\s*!==/,
  // Authorization header comparison
  /headers\.get\s*\(\s*['"]authorization['"]\s*\)\s*===/,
  // signature comparison
  /===\s*signature\b|\bsignature\s*===/,
  // webhookSecret comparison
  /===\s*webhookSecret\b|\bwebhookSecret\s*===/,
  // generic process.env.*SECRET* comparison
  /===\s*process\.env\.\w*SECRET\w*|process\.env\.\w*SECRET\w*\s*===/,
];

/** Patterns that indicate a constant-time comparison is in use */
const SAFE_COMPARISON_PATTERNS = [
  /timingSafeEqual/,
  /timingSafeStringEqual/,
  /crypto\.timingSafeEqual/,
];

function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) ||
    filePath.includes('__tests__/') ||
    filePath.includes('__mocks__/')
  );
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

export const timingSafeCheckerScanner: Scanner = {
  name: 'timing-safe-checker',
  description: 'Detects secret/token comparisons using === instead of a constant-time equality function, which are vulnerable to timing attacks',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const ignore = [...new Set([...['node_modules', 'dist', '.next', '.git'], ...(config.ignore ?? [])])];

    const apiDirs = detectApiDirs(projectPath);

    for (const apiDir of apiDirs) {
      let files: string[];
      try {
        files = walkFiles(apiDir, ignore, ['ts', 'js']);
      } catch {
        continue;
      }

      const routeFiles = files.filter((f) => {
        const basename = f.split('/').pop() ?? '';
        return ROUTE_FILENAMES.includes(basename);
      });

      for (const file of routeFiles) {
        if (isTestFile(file)) continue;

        const content = readFileSafe(file);
        if (content === null) continue;

        const hasVulnerableComparison = TIMING_VULNERABLE_PATTERNS.some((p) => p.test(content));
        if (!hasVulnerableComparison) continue;

        const hasSafeComparison = SAFE_COMPARISON_PATTERNS.some((p) => p.test(content));
        if (hasSafeComparison) continue;

        // Find the actual line number of the first vulnerable pattern
        let firstVulnLine = 1;
        for (const vp of TIMING_VULNERABLE_PATTERNS) {
          const vMatch = vp.exec(content);
          if (vMatch) {
            firstVulnLine = findLineNumber(content, vMatch.index);
            break;
          }
        }

        const id = `TIMING-${String(idCounter.value++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'timing-safe-checker',
          severity: 'medium',
          title: 'Secret comparison using === is vulnerable to timing attacks',
          description:
            'This route compares a secret, token, or API key using the === operator. Standard string equality is not constant-time and leaks information about the secret through response timing. Use timingSafeStringEqual() or crypto.timingSafeEqual() instead.',
          file,
          line: firstVulnLine,
          category: 'security',
          owasp: 'A02:2021',
          cwe: 208,
        });
      }
    }

    return {
      scanner: 'timing-safe-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
