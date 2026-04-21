import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/** Path patterns that indicate sensitive endpoints requiring rate limiting */
const SENSITIVE_PATH_PATTERNS = [
  /\/auth\//,
  /\/login/,
  /\/register/,
  /\/reset-password/,
  /\/payment/,
  /\/pay(\/|$)/,
  /\/charge/,
  /\/checkout/,
  /\/export/,
  /\/download/,
  /\/bulk/,
  /\/admin\//,
];

/** Content patterns that indicate rate limiting is in place */
const RATE_LIMIT_PATTERNS = [
  /checkIPRateLimit/,
  /rateLimit/,
  /rateLimiter/,
  /throttle/,
  /\blimiter\b/,
];

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

function isSensitiveRoute(filePath: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((p) => p.test(filePath));
}

function hasRateLimit(content: string): boolean {
  return RATE_LIMIT_PATTERNS.some((p) => p.test(content));
}

export const rateLimitCheckerScanner: Scanner = {
  name: 'rate-limit-checker',
  description: 'Checks that sensitive API routes (auth, payment, admin, export) have rate limiting',
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
        if (!isSensitiveRoute(file)) continue;

        const content = readFileSafe(file);
        if (content === null) continue;

        if (!hasRateLimit(content)) {
          const id = `RATE-${String(idCounter.value++).padStart(3, '0')}`;
          // v0.15.4 D-N-002 — classify the route by the sensitive-path
          // pattern it matched, so the title identifies which kind of
          // sensitive route (auth, payment, admin, export) is unprotected
          // instead of repeating the same generic string for every hit.
          const routeCategory =
            /\/auth\/|\/login|\/register|\/reset-password/.test(file) ? 'auth'
            : /\/payment|\/pay(\/|$)|\/charge|\/checkout/.test(file) ? 'payment'
            : /\/admin\//.test(file) ? 'admin'
            : /\/export|\/download|\/bulk/.test(file) ? 'export'
            : 'sensitive';
          const routePath = file.match(/\/api\/(.+?)\/route\.(?:ts|js)$/)?.[1] ?? '';
          const titleSuffix = routePath ? ` (/api/${routePath})` : '';
          findings.push({
            id,
            scanner: 'rate-limit-checker',
            severity: 'high',
            title: `${routeCategory[0].toUpperCase()}${routeCategory.slice(1)} route missing rate limiting${titleSuffix}`,
            description:
              'This API route handles sensitive operations (auth, payment, admin, or export) but does not appear to use rate limiting. Without rate limiting, the endpoint is vulnerable to brute-force and abuse attacks.',
            file,
            line: 1,
            fileLevel: true,
            category: 'security',
            owasp: 'A04:2021',
            cwe: 770,
          });
        }
      }
    }

    return {
      scanner: 'rate-limit-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
