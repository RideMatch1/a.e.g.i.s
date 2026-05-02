import { walkFiles, readFileSafe } from '@aegis-scan/core';
import { opsecPace, applyOpsecHeaders } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { join, relative } from 'path';

/**
 * Extracts API route paths from the project's route files.
 * Looks for Next.js app/api and pages/api directories.
 */
function discoverAdminRoutes(projectPath: string): string[] {
  const routeFiles = walkFiles(projectPath, [
    'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  ], ['ts', 'js', 'tsx', 'jsx']);

  const adminRoutes: string[] = [];

  for (const file of routeFiles) {
    const rel = relative(projectPath, file);

    // Match app/api/**/route.ts or pages/api/**/*.ts
    const isApiRoute =
      /(?:^|\/)app\/api\/.*\/route\.[tj]sx?$/.test(rel) ||
      /(?:^|\/)pages\/api\/.*\.[tj]sx?$/.test(rel);

    if (!isApiRoute) continue;

    const content = readFileSafe(file);
    if (!content) continue;

    // Detect admin/protected patterns: requireRole, 'admin', 'manager', auth checks
    const hasAdminPattern = /requireRole|['"]admin['"]|['"]manager['"]|isAdmin|adminOnly/.test(content);
    if (!hasAdminPattern) continue;

    // Convert file path to URL path
    let routePath = rel
      .replace(/^src\//, '')
      .replace(/^app\/api\//, '/api/')
      .replace(/^pages\/api\//, '/api/')
      .replace(/\/route\.[tj]sx?$/, '')
      .replace(/\.[tj]sx?$/, '');

    // Handle dynamic segments: [id] -> test-id
    routePath = routePath.replace(/\[([^\]]+)\]/g, 'test-$1');

    adminRoutes.push(routePath);
  }

  return adminRoutes;
}

export const authProbeScanner: Scanner = {
  name: 'auth-probe',
  description: 'Probes admin routes without authentication to verify access control',
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
        scanner: 'auth-probe',
        category: 'attack',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'No target URL provided — auth probe requires --target',
      };
    }

    const adminRoutes = discoverAdminRoutes(projectPath);

    for (const route of adminRoutes) {
      const url = `${config.target.replace(/\/$/, '')}${route}`;

      try {
        await opsecPace(config.opsec);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);

        const init = applyOpsecHeaders(
          {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'AEGIS-Security-Scanner/0.1' },
            redirect: 'follow',
          },
          config.opsec,
        );
        const response = await fetch(url, init);

        clearTimeout(timeout);

        // 200 without auth = unauthenticated access
        if (response.status === 200) {
          const id = `ATK-AUTH-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'auth-probe',
            category: 'attack',
            severity: 'high',
            title: `Unauthenticated access to admin route: ${route}`,
            description: `GET ${url} returned 200 without any authentication headers. Admin routes must return 401 or 403 for unauthenticated requests.`,
            file: join(projectPath, route),
            owasp: 'A01:2021',
            cwe: 306,
          });
        }
      } catch {
        // Request failed (timeout, network error) — not a finding
      }
    }

    return {
      scanner: 'auth-probe',
      category: 'attack',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
