import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/** Mutating HTTP methods that need CSRF protection */
const MUTATING_HANDLER_PATTERN = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/;

/** Public routes that do not need CSRF protection */
const PUBLIC_ROUTE_PATTERNS = [
  /\/public\//,
  /\/webhook/,
  /\/auth\//,
  /\/health/,
  /\/cron\//,
];

/** Patterns that indicate CSRF protection is in place */
const CSRF_PROTECTION_PATTERNS = [
  /request\.headers\.get\(['"`]origin['"`]\)/i,
  /x-csrf-token/i,
  /SameSite/i,
  /secureApiRouteWithTenant/,
];

/**
 * JSON-only APIs check Content-Type on the REQUEST (not response).
 * We look for patterns that explicitly check the incoming content type.
 */
const JSON_REQUEST_CHECK_PATTERNS = [
  /request\.headers\.get\(['"`]content-type['"`]\)/i, // Explicit request header read
];

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

function isPublicRoute(filePath: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((p) => p.test(filePath));
}

function hasMutatingHandler(content: string): boolean {
  return MUTATING_HANDLER_PATTERN.test(content);
}

/** Strip single-line comments to prevent // TODO: csrf from counting as protection */
function stripComments(content: string): string {
  return content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function hasCsrfProtection(content: string): boolean {
  const stripped = stripComments(content);
  return (
    CSRF_PROTECTION_PATTERNS.some((p) => p.test(stripped)) ||
    JSON_REQUEST_CHECK_PATTERNS.some((p) => p.test(stripped))
  );
}

export const csrfCheckerScanner: Scanner = {
  name: 'csrf-checker',
  description: 'Detects API route handlers with mutating methods that lack CSRF protection',
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
        // Skip public routes — they intentionally don't need CSRF protection
        if (isPublicRoute(file)) continue;

        const content = readFileSafe(file);
        if (content === null) continue;

        // Only check files that actually handle mutating HTTP methods
        if (!hasMutatingHandler(content)) continue;

        if (!hasCsrfProtection(content)) {
          // Find the actual line number of the first mutating handler
          let mutatingLine = 1;
          const mutMatch = MUTATING_HANDLER_PATTERN.exec(content);
          if (mutMatch) {
            mutatingLine = findLineNumber(content, mutMatch.index);
          }

          const id = `CSRF-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'csrf-checker',
            severity: 'high',
            title: 'Mutating route handler missing CSRF protection',
            description:
              'This API route handles POST/PUT/PATCH/DELETE requests but does not implement CSRF protection. Add Origin header validation, a CSRF token, SameSite cookie flags, or use secureApiRouteWithTenant (which includes Origin checking). JSON-only APIs checking Content-Type are also acceptable.',
            file,
            line: mutatingLine,
            category: 'security',
            owasp: 'A01:2021',
            cwe: 352,
          });
        }
      }
    }

    return {
      scanner: 'csrf-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
