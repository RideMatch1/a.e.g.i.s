import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * SSRF Checker — detects fetch/http calls with user-controlled URLs
 * that don't use a safeFetch wrapper or URL validation.
 *
 * OWASP A10:2021 — Server-Side Request Forgery
 */

/** Patterns indicating a potentially unsafe fetch with a variable URL */
const UNSAFE_FETCH_PATTERNS = [
  /fetch\s*\(\s*(?!['"`]https?:\/\/)(\w+)/,                    // fetch(variable) — not a literal URL
  /fetch\s*\(\s*`\$\{/,                                         // fetch(`${url}...`)
  /fetch\s*\(\s*new\s+URL\s*\(\s*(?!['"`])\w+/,                // fetch(new URL(variable...))
  /axios\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*(?!['"`]https?:\/\/)(\w+)/, // axios.get(variable)
  /got\s*\(\s*(?!['"`]https?:\/\/)(\w+)/,                       // got(variable)
  /http\.request\s*\(\s*(?!['"`]https?:\/\/)(\w+)/,             // http.request(variable)
];

/** Safe patterns — if present, the file handles SSRF properly */
const SAFE_PATTERNS = [
  /safeFetch/,                    // Custom SSRF-safe wrapper
  /isAllowedUrl/,                 // URL allowlist check
  /isValidUrl/,                   // URL validation
  /allowedHosts/,                 // Host allowlist
  /ALLOWED_HOSTS/,                // Host allowlist constant
  /url\.startsWith\s*\(\s*['"]https?:\/\//,  // Protocol check
  /new\s+URL\s*\([^)]+\)\s*\.hostname/,       // Hostname extraction for validation
];

function shouldSkipFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) ||
    filePath.includes('__tests__/') || filePath.includes('__mocks__/') ||
    filePath.includes('/scripts/') ||
    // Service Workers use fetch(event.request) for caching — not SSRF
    /sw\.(ts|js)$/.test(filePath) ||
    /service[-_]?worker\.(ts|js)$/.test(filePath);
}

function findLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export const ssrfCheckerScanner: Scanner = {
  name: 'ssrf-checker',
  description: 'Detects fetch/HTTP calls with user-controlled URLs without SSRF protection (OWASP A10)',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const ignore = [...new Set([...['node_modules', 'dist', '.next', '.git'], ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'js']);

    for (const file of files) {
      if (shouldSkipFile(file)) continue;
      if (file.includes('/scripts/')) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // Skip files that have SSRF protection
      if (SAFE_PATTERNS.some((p) => p.test(content))) continue;

      for (const pattern of UNSAFE_FETCH_PATTERNS) {
        const re = new RegExp(pattern.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          // Skip if the variable is a well-known safe source
          const matchedVar = match[1] ?? '';
          if (['undefined', 'null', 'true', 'false'].includes(matchedVar)) continue;

          // Skip if the variable is assigned a string literal (const url = 'https://...')
          if (matchedVar) {
            const constAssignPattern = new RegExp(
              `(?:const|let)\\s+${matchedVar}\\s*=\\s*['"\`]https?://`,
            );
            if (constAssignPattern.test(content)) continue;
          }

          const id = `SSRF-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'ssrf-checker',
            severity: 'high',
            title: 'Potential SSRF — HTTP call with variable URL',
            description:
              'An HTTP client (fetch/axios/got) is called with a variable URL rather than a hardcoded string. If this URL originates from user input, an attacker can force the server to make requests to internal services (cloud metadata, databases, admin panels). Use a safeFetch wrapper with URL allowlisting.',
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A10:2021',
            cwe: 918,
          });
          break; // One finding per file per pattern is enough
        }
      }
    }

    return {
      scanner: 'ssrf-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
