import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/**
 * Patterns that indicate an error's internal detail is being sent to the client.
 * Each pattern MUST be specific enough to avoid matching safe error handling.
 */
const ERROR_LEAKAGE_PATTERNS = [
  // err.message / error.message / e.message directly in json response
  /json\s*\(\s*\{[^}]*error\s*:\s*(?:err|error|e)\.message/,
  /json\s*\(\s*\{[^}]*message\s*:\s*(?:err|error|e)\.message/,
  // Spreading the full error object into a response
  /json\s*\(\s*\{\s*\.\.\.(?:err|error|e)\s*[,}]/,
  // JSON.stringify on the raw error object
  /JSON\.stringify\s*\(\s*(?:err|error|e)\s*\)/,
];

/**
 * Safe phrases in the ±5 line window indicate intentional generic error handling.
 */
const SAFE_PHRASES = [
  'Internal Server Error',
  'Nicht autorisiert',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Bad Request',
  'Interner Serverfehler',
];

/**
 * File-level patterns that indicate the route has proper error handling infrastructure.
 * If these exist in the file, err.message usage is likely in a controlled handler,
 * not raw leakage.
 */
const SAFE_ERROR_HANDLING_PATTERNS = [
  /handleError\s*\(/,              // Centralized error handler
  /AppError/,                       // Typed error class (throws don't leak)
  /ForbiddenError/,                 // Custom error class
  /UnauthorizedError/,              // Custom error class
  /ValidationError/,                // Custom error class
  /NotFoundError/,                  // Custom error class
  /isOperational/,                  // Operational error check (common pattern)
  /error\.toJSON\s*\(\)/,           // Controlled serialization
  /error\.code\b/,                  // Structured error with code field (not raw message)
];

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = new Set(pattern.flags.split(''));
  flags.add('g');
  flags.add('s');
  return new RegExp(pattern.source, [...flags].join(''));
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

export const errorLeakageCheckerScanner: Scanner = {
  name: 'error-leakage-checker',
  description: 'Detects API routes that leak internal error details into client responses',
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
        const content = readFileSafe(file);
        if (content === null) continue;

        // If the file has proper error handling infrastructure, skip it entirely.
        // Routes using handleError(), AppError, etc. process errors before responding.
        if (SAFE_ERROR_HANDLING_PATTERNS.some((p) => p.test(content))) continue;

        const lines = content.split('\n');

        for (const pattern of ERROR_LEAKAGE_PATTERNS) {
          const re = toGlobalRegex(pattern);
          let match: RegExpExecArray | null;

          while ((match = re.exec(content)) !== null) {
            const lineNumber = findLineNumber(content, match.index);
            // Check ±5 line window for safe generic error messages
            const windowStart = Math.max(0, lineNumber - 6);
            const windowEnd = Math.min(lines.length, lineNumber + 4);
            const window = lines.slice(windowStart, windowEnd).join(' ');
            if (SAFE_PHRASES.some((phrase) => window.includes(phrase))) continue;

            const id = `LEAK-${String(idCounter.value++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'error-leakage-checker',
              severity: 'high',
              title: 'Internal error detail leaked to client response',
              description:
                'This route serializes an error\'s internal detail (err.message or full error object) directly into the JSON response without a centralized error handler. This can expose stack traces, database schema, or implementation details. Use a handleError() wrapper or return generic messages.',
              file,
              line: lineNumber,
              category: 'security',
              owasp: 'A04:2021',
              cwe: 209,
            });
          }
        }
      }
    }

    return {
      scanner: 'error-leakage-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
