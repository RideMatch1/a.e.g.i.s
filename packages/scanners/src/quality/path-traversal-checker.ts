import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — path.join with user-input in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — path.join with user-input in *.test.ts inside /api/ target-set (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

/**
 * Path Traversal Checker — detects file system operations where user input
 * flows into file paths without sanitization.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-22 — Improper Limitation of a Pathname to a Restricted Directory
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

/** Patterns where user input flows into fs operations */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; title: string; description: string }> = [
  {
    pattern: /path\.join\s*\([^)]*(?:searchParams|params|body|query|req\.(?:params|query|body))\b/,
    title: 'Path traversal risk — user input in path.join()',
    description:
      'User-controlled input (from request params, query, or body) is used in path.join() without sanitization. An attacker can supply "../" sequences to escape the intended directory and read or write arbitrary files. Sanitize with path.normalize() and verify the resolved path stays within the allowed base directory.',
  },
  {
    pattern: /path\.resolve\s*\([^)]*(?:searchParams|params|body|query|req\.(?:params|query|body))\b/,
    title: 'Path traversal risk — user input in path.resolve()',
    description:
      'User-controlled input is used in path.resolve(). An attacker can supply absolute paths or "../" sequences to access files outside the intended directory. Validate the resolved path is within the expected base directory after resolution.',
  },
  {
    pattern: /readFileSync\s*\(\s*(?!['"`])(\w+)/,
    title: 'Path traversal risk — variable path in readFileSync()',
    description:
      'readFileSync() is called with a variable path. If this variable originates from user input, an attacker can read arbitrary files from the server filesystem. Validate and sanitize the path, ensuring it resolves within an allowed directory.',
  },
  {
    pattern: /readFile\s*\(\s*(?!['"`])(\w+)/,
    title: 'Path traversal risk — variable path in readFile()',
    description:
      'readFile() is called with a variable path. If this variable originates from user input, an attacker can read arbitrary files. Validate and sanitize the path before use.',
  },
  {
    pattern: /createReadStream\s*\(\s*(?!['"`])(\w+)/,
    title: 'Path traversal risk — variable path in createReadStream()',
    description:
      'fs.createReadStream() is called with a variable path. If the path originates from user input, an attacker can stream arbitrary files from the server. Validate the path resolves within the expected directory.',
  },
];

/** Patterns indicating path sanitization is present */
const SANITIZATION_PATTERNS: RegExp[] = [
  /path\.normalize\s*\(/,
  /\.replace\s*\(\s*\/\\\.\\\.\/g/,
  /\.replace\s*\(\s*\/\.\.\//,
  /sanitize/i,
  /safePath/i,
  /allowedPath/i,
  /basePath.*startsWith/,
  /\.startsWith\s*\(\s*(?:basePath|baseDir|allowedDir)/,
];

/** Checks if the file targets API/lib/services directories */
function isTargetFile(filePath: string): boolean {
  return (
    filePath.includes('/api/') ||
    filePath.includes('/lib/') ||
    filePath.includes('/services/') ||
    filePath.includes('/utils/')
  );
}

export const pathTraversalCheckerScanner: Scanner = {
  name: 'path-traversal-checker',
  description: 'Detects file system operations with unsanitized user input — path traversal risk (CWE-22)',
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
      if (!isTargetFile(file)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // If sanitization patterns exist in the file, skip it
      if (SANITIZATION_PATTERNS.some((p) => p.test(content))) continue;

      const lines = content.split('\n');

      for (const rule of DANGEROUS_PATTERNS) {
        const re = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          const matchLine = findLineNumber(content, match.index);

          // Check nearby lines (5 above) for sanitization
          const nearbyLines = lines.slice(Math.max(0, matchLine - 6), matchLine).join('\n');
          if (SANITIZATION_PATTERNS.some((p) => p.test(nearbyLines))) continue;

          const id = `PATHTRV-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'path-traversal-checker',
            severity: 'high',
            title: rule.title,
            description: rule.description,
            file,
            line: matchLine,
            category: 'security',
            owasp: 'A01:2021',
            cwe: 22,
          });
        }
      }
    }

    return {
      scanner: 'path-traversal-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
