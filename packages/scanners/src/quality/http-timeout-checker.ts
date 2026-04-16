import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const HTTP_DIRS = ['api', 'lib', 'services'];

/** Test files — timeout patterns here are intentional */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

function detectHttpDirs(projectPath: string): string[] {
  const results: string[] = [];
  for (const dir of HTTP_DIRS) {
    results.push(
      `${projectPath}/src/${dir}`,
      `${projectPath}/${dir}`,
    );
  }
  return results;
}

export const httpTimeoutCheckerScanner: Scanner = {
  name: 'http-timeout-checker',
  description: 'Detects HTTP client calls (fetch, axios, got) that lack a timeout, risking resource exhaustion',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const httpDirs = detectHttpDirs(projectPath);

    for (const httpDir of httpDirs) {
      let files: string[];
      try {
        files = walkFiles(httpDir, ignore, ['ts', 'js']);
      } catch {
        continue;
      }

      for (const file of files) {
        if (isTestFile(file)) continue;

        const content = readFileSafe(file);
        if (content === null) continue;

        // Skip files with no external HTTP at all
        const hasFetch = /\bfetch\s*\(/.test(content);
        const hasAxios = /\baxios\s*[\.(]/.test(content);
        const hasGot = /\bgot\s*\(/.test(content);
        if (!hasFetch && !hasAxios && !hasGot) continue;

        const lines = content.split('\n');

        // --- fetch calls without abort signal (per-call check) ---
        if (hasFetch) {
          const fetchRe = /\bfetch\s*\(/g;
          let match: RegExpExecArray | null;
          while ((match = fetchRe.exec(content)) !== null) {
            // Skip Supabase internal fetch patterns (storage URLs, etc.)
            const snippet = content.slice(match.index, match.index + 200);
            if (/supabase|\.from\s*\(|\.auth\./.test(snippet)) continue;

            // Check if THIS specific call has signal/AbortController within ~10 lines
            const matchLine = findLineNumber(content, match.index);
            const nearbyStart = Math.max(0, matchLine - 6);
            const nearbyEnd = Math.min(lines.length, matchLine + 10);
            const nearbyCode = lines.slice(nearbyStart, nearbyEnd).join('\n');
            if (/AbortController|signal\s*:/.test(nearbyCode)) continue;

            const id = `TIMEOUT-${String(idCounter.value++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'http-timeout-checker',
              severity: 'medium',
              title: 'fetch() call without AbortController/signal timeout',
              description:
                'A fetch() call was found without an AbortController or signal: option. Without a timeout the request can hang indefinitely, exhausting server resources under load or when the remote service is unresponsive. Wrap with AbortSignal.timeout() or an AbortController.',
              file,
              line: findLineNumber(content, match.index),
              category: 'security',
              owasp: 'A05:2021',
              cwe: 400,
            });
          }
        }

        // --- axios calls without timeout (per-call check) ---
        if (hasAxios) {
          const axiosRe = /\baxios\s*[\.(]/g;
          let match: RegExpExecArray | null;
          while ((match = axiosRe.exec(content)) !== null) {
            // Check if THIS specific call has timeout within ~10 lines
            const matchLine = findLineNumber(content, match.index);
            const nearbyStart = Math.max(0, matchLine - 6);
            const nearbyEnd = Math.min(lines.length, matchLine + 10);
            const nearbyCode = lines.slice(nearbyStart, nearbyEnd).join('\n');
            if (/timeout\s*:/.test(nearbyCode)) continue;

            const id = `TIMEOUT-${String(idCounter.value++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'http-timeout-checker',
              severity: 'medium',
              title: 'axios call without timeout option',
              description:
                'An axios HTTP call was found without a timeout: option. Without a timeout the request can hang indefinitely. Set a timeout on the axios instance or per-request via { timeout: ms }.',
              file,
              line: findLineNumber(content, match.index),
              category: 'security',
              owasp: 'A05:2021',
              cwe: 400,
            });
          }
        }

        // --- got calls without timeout (per-call check) ---
        if (hasGot) {
          const gotRe = /\bgot\s*\(/g;
          let match: RegExpExecArray | null;
          while ((match = gotRe.exec(content)) !== null) {
            // Check if THIS specific call has timeout within ~10 lines
            const matchLine = findLineNumber(content, match.index);
            const nearbyStart = Math.max(0, matchLine - 6);
            const nearbyEnd = Math.min(lines.length, matchLine + 10);
            const nearbyCode = lines.slice(nearbyStart, nearbyEnd).join('\n');
            if (/timeout\s*:/.test(nearbyCode)) continue;

            const id = `TIMEOUT-${String(idCounter.value++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'http-timeout-checker',
              severity: 'medium',
              title: 'got() call without timeout option',
              description:
                'A got() HTTP call was found without a timeout: option. Without a timeout the request can hang indefinitely under adverse network conditions. Use got\'s built-in timeout option: { timeout: { request: ms } }.',
              file,
              line: findLineNumber(content, match.index),
              category: 'security',
              owasp: 'A05:2021',
              cwe: 400,
            });
          }
        }
      }
    }

    return {
      scanner: 'http-timeout-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
