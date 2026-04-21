import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { join } from 'node:path';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/** v0.14: middleware-file candidates probed for SameSite=Lax|Strict
 *  cookie declarations. Configurable via
 *  `scanners.csrf.middlewareFiles`. Default covers the Next.js
 *  convention at root and src/. Other non-default names
 *  (e.g. `gateway.ts`) can be declared explicitly. */
const DEFAULT_MIDDLEWARE_FILES: readonly string[] = [
  'middleware.ts',
  'middleware.js',
  'src/middleware.ts',
  'src/middleware.js',
];

/** SameSite=Lax|Strict cookie declaration. SameSite=None is NOT matched
 *  — `None` provides no cross-site CSRF mitigation. */
const SAMESITE_PROTECTION_PATTERN = /sameSite\s*:\s*['"](?:lax|strict)['"]/i;

interface CsrfScannerConfig {
  middlewareFiles?: readonly string[];
}

function readCsrfConfig(config: AegisConfig): CsrfScannerConfig {
  const raw = config.scanners?.csrf;
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: CsrfScannerConfig = {};
  if (Array.isArray(rec.middlewareFiles)) {
    out.middlewareFiles = rec.middlewareFiles.filter(
      (s): s is string => typeof s === 'string',
    );
  }
  return out;
}

/** v0.14 DO-4: returns true when at least one configured middleware-file
 *  declares a SameSite=Lax|Strict cookie. A hit downgrades per-route
 *  csrf-checker findings from high to info — the SameSite cookie
 *  already blocks cross-site mutations at the browser layer, so the
 *  absence of explicit per-route CSRF tokens is pedagogy, not an
 *  actionable high-severity gap.
 *
 *  Called once per scan (single regex-test per configured file). */
function detectMiddlewareSameSite(
  projectPath: string,
  config: AegisConfig,
): boolean {
  const cfg = readCsrfConfig(config);
  const candidates = cfg.middlewareFiles ?? DEFAULT_MIDDLEWARE_FILES;
  for (const rel of candidates) {
    const content = readFileSafe(join(projectPath, rel));
    if (content === null) continue;
    if (SAMESITE_PROTECTION_PATTERN.test(content)) return true;
  }
  return false;
}

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

    // v0.14 DO-4: detect whether the project's middleware-file declares
    // a SameSite=Lax|Strict cookie. When it does, route-level CSRF
    // findings below are downgraded from `high` to `info` because
    // SameSite=Lax already blocks cross-site mutations at the browser
    // layer — the absence of an explicit per-route CSRF token is
    // pedagogy, not an actionable high-severity gap.
    const middlewareHasSameSite = detectMiddlewareSameSite(projectPath, config);

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
          const severity: Finding['severity'] = middlewareHasSameSite ? 'info' : 'high';
          const sameSiteNote = middlewareHasSameSite
            ? ' Middleware declares SameSite=Lax|Strict on session cookies — severity downgraded to info (SameSite already blocks cross-site mutations at the browser layer). Adding an explicit CSRF token remains best-practice for defense-in-depth.'
            : '';
          // v0.15.4 D-N-002 — include route-path in title so multi-finding
          // reports differentiate per-route instead of repeating the same
          // generic string for every mutating handler in the project.
          const routePath = file.match(/\/api\/(.+?)\/route\.(?:ts|js)$/)?.[1] ?? '';
          const titleSuffix = routePath ? ` (/api/${routePath})` : '';
          findings.push({
            id,
            scanner: 'csrf-checker',
            severity,
            title: `Mutating route handler missing CSRF protection${titleSuffix}`,
            description:
              'This API route handles POST/PUT/PATCH/DELETE requests but does not implement CSRF protection. Add Origin header validation, a CSRF token, SameSite cookie flags, or use secureApiRouteWithTenant (which includes Origin checking). JSON-only APIs checking Content-Type are also acceptable.' +
              sameSiteNote,
            file,
            line: mutatingLine,
            category: 'security',
            owasp: 'A01:2021',
            cwe: 352,
            fix: {
              description:
                'Gate every mutating handler behind the tenant-guard helper which validates Origin against the configured allowlist, or pair a double-submit token with SameSite=Lax|Strict on the session cookie. Content-Type enforcement against application/json is an acceptable substitute for pure JSON APIs.',
              code: "const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });",
              links: [
                'https://cwe.mitre.org/data/definitions/352.html',
                'https://owasp.org/Top10/A01_2021-Broken_Access_Control/',
              ],
            },
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
