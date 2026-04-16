import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

const CONFIG_FILENAMES = [
  'middleware.ts',
  'middleware.js',
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
];

/** Routes under /public/ are intentionally open — skip them */
function isPublicRoute(filePath: string): boolean {
  return /\/public\//.test(filePath);
}

/**
 * Sensitive routes (admin, auth, payment, billing, webhook) where wildcard or
 * reflected CORS is escalated from `high` to `critical` severity.
 *
 * Wildcard CORS on `/api/static/foo` is bad. Wildcard CORS on `/api/admin/users`
 * is catastrophic — cross-origin reads of authenticated admin data.
 */
function isSensitiveRoute(filePath: string): boolean {
  return (
    /\/(admin|auth|login|signup|register|password|payment|billing|stripe|webhook|invoice|checkout|subscription)\//.test(
      filePath,
    ) ||
    /\/(admin|auth|payment|billing)\.(ts|js)$/.test(filePath)
  );
}

/**
 * Promote severity to critical when CORS misconfig sits on a sensitive route.
 * Pure helper — keeps the inline finding emission readable.
 */
function severityFor(file: string, baseSeverity: 'high'): 'high' | 'critical' {
  return isSensitiveRoute(file) ? 'critical' : baseSeverity;
}

/** Test files are excluded */
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

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

export const corsCheckerScanner: Scanner = {
  name: 'cors-checker',
  description: 'Detects misconfigured CORS headers that allow wildcard or reflected origins',
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

    function checkContent(content: string, file: string): void {
      if (isTestFile(file)) return;

      // Pattern 1: Wildcard Access-Control-Allow-Origin
      // Matches object-style ('key': '*'), function-call style ('key', '*'),
      // Next.js headers.set('key', '*'), and new Headers({ 'key': '*' })
      const wildcardRe = /(?:['"]Access-Control-Allow-Origin['"]\s*[:,]\s*['"`]?\s*\*|\.headers\.set\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"`]?\s*\*|new\s+Headers\s*\(\s*\{[^}]*['"]Access-Control-Allow-Origin['"]\s*:\s*['"`]?\s*\*)/g;
      let match: RegExpExecArray | null;
      while ((match = wildcardRe.exec(content)) !== null) {
        // Pattern 1b: credentials + wildcard in the same file (worse)
        const hasCredentials = /['"]Access-Control-Allow-Credentials['"]\s*[:,]\s*['"`]?\s*true/i.test(content);
        const id = `CORS-${String(idCounter.value++).padStart(3, '0')}`;
        if (hasCredentials) {
          findings.push({
            id,
            scanner: 'cors-checker',
            severity: severityFor(file, 'high'),
            title: isSensitiveRoute(file)
              ? 'CRITICAL: Wildcard CORS + Allow-Credentials on sensitive route'
              : 'Wildcard CORS combined with Allow-Credentials: true',
            description:
              'Access-Control-Allow-Origin: * is set alongside Access-Control-Allow-Credentials: true. Browsers block credentialed requests to wildcard origins, but some libraries work around this. This combination is a security misconfiguration that can expose authenticated data.',
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A01:2021',
            cwe: 942,
          });
        } else {
          findings.push({
            id,
            scanner: 'cors-checker',
            severity: severityFor(file, 'high'),
            title: isSensitiveRoute(file)
              ? 'CRITICAL: Wildcard CORS on sensitive route (admin/auth/payment)'
              : 'Wildcard CORS header (Access-Control-Allow-Origin: *)',
            description:
              'Access-Control-Allow-Origin is set to * which allows any origin to read responses. For APIs serving authenticated or sensitive data this may allow cross-origin data theft. Restrict to an explicit allowlist of trusted origins.',
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A01:2021',
            cwe: 942,
          });
        }
      }

      // Pattern 2: cors({ origin: true }) — Express blanket allow
      const corsBlanketRe = /cors\s*\(\s*\{[^}]*origin\s*:\s*true/g;
      while ((match = corsBlanketRe.exec(content)) !== null) {
        const id = `CORS-${String(idCounter.value++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'cors-checker',
          severity: severityFor(file, 'high'),
          title: isSensitiveRoute(file)
            ? 'CRITICAL: cors({ origin: true }) on sensitive route'
            : 'CORS configured with origin: true (reflect all origins)',
          description:
            'cors({ origin: true }) reflects the request Origin header back as the allowed origin, effectively allowing any site to make cross-origin requests. Use an explicit allowlist instead.',
          file,
          line: findLineNumber(content, match.index),
          category: 'security',
          owasp: 'A01:2021',
          cwe: 942,
        });
      }

      // Pattern 3: Origin reflection via setHeader/headers.set without allowlist
      const reflectionRe = /(?:setHeader|\.headers\.set)\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*req(?:uest)?\.headers?\.(?:origin|get\s*\(\s*['"]origin['"]\s*\))/g;
      while ((match = reflectionRe.exec(content)) !== null) {
        const id = `CORS-${String(idCounter.value++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'cors-checker',
          severity: severityFor(file, 'high'),
          title: isSensitiveRoute(file)
            ? 'CRITICAL: CORS origin reflected on sensitive route'
            : 'CORS origin reflected from request without allowlist check',
          description:
            'The Access-Control-Allow-Origin header is set directly from req.headers.origin without checking against an allowlist. This allows any origin to bypass the same-origin policy. Validate the origin against a hardcoded list of trusted domains before reflecting it.',
          file,
          line: findLineNumber(content, match.index),
          category: 'security',
          owasp: 'A01:2021',
          cwe: 942,
        });
      }
    }

    // --- 1. Route files ---
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
        if (isPublicRoute(file)) continue;
        const content = readFileSafe(file);
        if (content === null) continue;
        checkContent(content, file);
      }
    }

    // --- 2. Middleware and config files ---
    for (const filename of CONFIG_FILENAMES) {
      const filePath = join(projectPath, filename);
      if (!existsSync(filePath)) continue;
      const content = readFileSafe(filePath);
      if (content === null) continue;
      checkContent(content, filePath);
    }

    return {
      scanner: 'cors-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
