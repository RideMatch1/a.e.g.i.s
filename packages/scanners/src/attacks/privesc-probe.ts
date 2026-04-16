import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { relative } from 'path';

/**
 * A fake non-admin JWT carrying role=staff.
 * Payload: { "role": "staff" } — used to check whether admin routes accept non-admin tokens.
 * This token is intentionally invalid (unsigned) and will never pass real JWT verification.
 */
const FAKE_STAFF_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic3RhZmYifQ.fake';

/**
 * Walk route files and split them into admin routes (path contains /admin/)
 * and generic routes (no /admin/). Only routes that export at least one HTTP
 * handler are included.
 */
function discoverRoutes(projectPath: string): {
  adminRoutes: string[];
} {
  const routeFiles = walkFiles(projectPath, [
    'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  ], ['ts', 'js', 'tsx', 'jsx']);

  const adminRoutes: string[] = [];

  for (const file of routeFiles) {
    const rel = relative(projectPath, file);

    const isApiRoute =
      /(?:^|\/)app\/api\/.*\/route\.[tj]sx?$/.test(rel) ||
      /(?:^|\/)pages\/api\/.*\.[tj]sx?$/.test(rel);

    if (!isApiRoute) continue;

    // Only probe routes that are explicitly under /admin/ — clear privilege boundary
    if (!/\/admin\//.test(rel)) continue;

    const content = readFileSafe(file);
    if (!content) continue;

    // Must export at least one HTTP method handler
    if (!/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/.test(content)) continue;

    // Convert file path to URL path
    let routePath = rel
      .replace(/^src\//, '')
      .replace(/^app\/api\//, '/api/')
      .replace(/^pages\/api\//, '/api/')
      .replace(/\/route\.[tj]sx?$/, '')
      .replace(/\.[tj]sx?$/, '');

    routePath = routePath.replace(/\[([^\]]+)\]/g, 'test-$1');
    adminRoutes.push(routePath);
  }

  return { adminRoutes };
}

export const privescProbeScanner: Scanner = {
  name: 'privesc-probe',
  description: 'Probes admin routes with a fake non-admin JWT to detect vertical privilege escalation',
  category: 'attack',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    if (!config.target) {
      return {
        scanner: 'privesc-probe',
        category: 'attack',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'No target URL provided — privesc probe requires --target',
      };
    }

    const baseUrl = config.target.replace(/\/$/, '');
    const { adminRoutes } = discoverRoutes(projectPath);

    for (const route of adminRoutes) {
      const url = `${baseUrl}${route}`;

      // --- Request 1: fake staff JWT (vertical privilege escalation) ---
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'AEGIS-Security-Scanner/0.1',
            'Authorization': `Bearer ${FAKE_STAFF_JWT}`,
          },
          redirect: 'follow',
        }).finally(() => clearTimeout(timeout));

        if (response.status === 200) {
          const id = `PRIVESC-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'privesc-probe',
            category: 'attack',
            severity: 'high',
            title: `Potential privilege escalation — admin route accessible with staff token: ${route}`,
            description: `GET ${url} returned HTTP 200 when called with a JWT carrying role=staff. Admin routes must reject non-admin tokens with 401 or 403. Attacker could escalate from staff to admin access.`,
            owasp: 'A01:2021',
            cwe: 269,
          });
          // Already flagged HIGH — no need for the no-auth CRITICAL check separately
          continue;
        }
      } catch {
        // Request failed — not a finding
      }

      // --- Request 2: no auth at all (CRITICAL: unauthenticated admin access) ---
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'AEGIS-Security-Scanner/0.1',
          },
          redirect: 'follow',
        }).finally(() => clearTimeout(timeout));

        if (response.status === 200) {
          const id = `PRIVESC-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'privesc-probe',
            category: 'attack',
            severity: 'critical',
            title: `Unauthenticated admin route — no auth required: ${route}`,
            description: `GET ${url} returned HTTP 200 with no authentication headers whatsoever. This is a critical privilege escalation: the admin route is completely unprotected.`,
            owasp: 'A01:2021',
            cwe: 269,
          });
        }
      } catch {
        // Request failed — not a finding
      }
    }

    return {
      scanner: 'privesc-probe',
      category: 'attack',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
