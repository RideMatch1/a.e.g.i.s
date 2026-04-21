import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/** Test files — debug statements are expected and acceptable.
 *
 * v0.6.1 — extended to cover e2e/browser-test directories (playwright, cypress, e2e).
 * Dogfood on cal-com and dub found 44 of 46 console-checker FPs in
 * `apps/web/playwright/**`. Those files are tests, not production code,
 * but the previous pattern only recognized unit-test conventions
 * (.test.ts, __tests__/, /test/, /tests/). The extended list includes
 * the e2e directory names commonly used in Next.js / TypeScript projects.
 */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec|e2e)\.(ts|js|tsx|jsx)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/')
    || filePath.includes('/playwright/')
    || filePath.includes('/cypress/')
    || filePath.includes('/e2e/');
}

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

/** Build a global regex from a pattern, deduplicating flags */
function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = new Set(pattern.flags.split(''));
  flags.add('g');
  return new RegExp(pattern.source, [...flags].join(''));
}

interface DebugRule {
  pattern: RegExp;
  severity: Finding['severity'];
  title: string;
  description: string;
  /** If true, also check test files */
  includeTestFiles?: boolean;
  owasp?: string;
  cwe?: number;
}

const RULES: DebugRule[] = [
  {
    pattern: /\bdebugger\s*;/,
    severity: 'high',
    title: 'Debugger statement left in production code',
    description:
      'A debugger; statement was found. This pauses JavaScript execution in browser DevTools and will freeze the application for end users. Remove before deploying.',
    owasp: 'A09:2021',
    cwe: 532,
  },
  {
    pattern: /console\.error\(.*(?:password|token|key|secret|credential|api_key|apikey)/i,
    severity: 'medium',
    title: 'console.error may log sensitive data',
    description:
      'console.error() call appears to include sensitive data (password, token, key, secret). Error logs may be captured by monitoring tools and exposed to operators without security clearance. Sanitize or redact sensitive values before logging.',
    owasp: 'A09:2021',
    cwe: 532,
  },
  {
    pattern: /console\.log\(/,
    severity: 'low',
    title: 'console.log() in production code',
    description:
      'console.log() statement found outside test files. Debug logging should be removed or replaced with a structured logger before production deployment.',
    owasp: 'A09:2021',
    cwe: 532,
  },
  {
    pattern: /console\.debug\(/,
    severity: 'low',
    title: 'console.debug() in production code',
    description:
      'console.debug() statement found outside test files. Debug logging should be removed or replaced with a structured logger before production deployment.',
    owasp: 'A09:2021',
    cwe: 532,
  },
  {
    pattern: /\/\/\s*TODO\b/,
    severity: 'info',
    title: 'TODO comment found',
    description:
      'A TODO comment indicates unfinished work. Review and address before release, or convert to a tracked issue.',
  },
  {
    pattern: /\/\/\s*FIXME\b/,
    severity: 'info',
    title: 'FIXME comment found',
    description:
      'A FIXME comment indicates a known issue that needs fixing. Address before release to avoid shipping known bugs.',
  },
  {
    pattern: /\/\/\s*HACK\b/,
    severity: 'info',
    title: 'HACK comment found',
    description:
      'A HACK comment indicates a workaround or non-ideal solution. Review and refactor before release.',
  },
  {
    pattern: /\/\/\s*XXX\b/,
    severity: 'info',
    title: 'XXX comment found',
    description:
      'An XXX comment indicates an area that needs attention. Review and address before release.',
  },
];

export const consoleCheckerScanner: Scanner = {
  name: 'console-checker',
  description: 'Detects debug artifacts in production code: console.log, debugger, TODO/FIXME comments',
  category: 'quality',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    // Walk src/ directory (production code)
    const files = walkFiles(
      projectPath,
      ignore,
      ['ts', 'tsx', 'js', 'jsx'],
    );

    for (const file of files) {
      const isTest = isTestFile(file);
      // Skip scripts directory — build/dev tools, not production code
      if (file.includes('/scripts/')) continue;
      // Skip logger files — they ARE the logging facility
      if (/\blogger\b/i.test(file)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      for (const rule of RULES) {
        // Skip non-test rules for test files
        if (isTest && !rule.includeTestFiles) continue;

        // For console.error with sensitive data, we need line-by-line checking
        // because we only want to flag lines that contain BOTH console.error and sensitive keywords
        if (rule.title.includes('console.error')) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (rule.pattern.test(lines[i])) {
              const id = `DEBUG-${String(idCounter++).padStart(3, '0')}`;
              findings.push({
                id,
                scanner: 'console-checker',
                severity: rule.severity,
                title: rule.title,
                description: rule.description,
                file,
                line: i + 1,
                category: 'quality',
                ...(rule.owasp ? { owasp: rule.owasp } : {}),
                ...(rule.cwe ? { cwe: rule.cwe } : {}),
                fix: {
                  description:
                    'Replace console.log / error / warn / info / debug with a structured logger — winston, pino, or the project centralized logger. Structured logging adds severity levels, context propagation, and PII-redaction controls that plain console calls lack. For CLI tools or intentional demo output, scope an aegis.config.json suppression to the specific file-glob with the architectural reason.',
                  code: "import { logger } from '@/lib/logger';\n\nlogger.info('operation complete', { userId, action });\nlogger.error('operation failed', { userId, err });",
                },
              });
            }
          }
          continue;
        }

        let match: RegExpExecArray | null;
        const re = toGlobalRegex(rule.pattern);
        while ((match = re.exec(content)) !== null) {
          const id = `DEBUG-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'console-checker',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file,
            line: findLineNumber(content, match.index),
            category: 'quality',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
            fix: {
              description:
                'Replace console.log / error / warn / info / debug with a structured logger — winston, pino, or the project centralized logger. Structured logging adds severity levels, context propagation, and PII-redaction controls that plain console calls lack. For CLI tools or intentional demo output, scope an aegis.config.json suppression to the specific file-glob with the architectural reason.',
              code: "import { logger } from '@/lib/logger';\n\nlogger.info('operation complete', { userId, action });\nlogger.error('operation failed', { userId, err });",
            },
          });
        }
      }
    }

    return {
      scanner: 'console-checker',
      category: 'quality',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
