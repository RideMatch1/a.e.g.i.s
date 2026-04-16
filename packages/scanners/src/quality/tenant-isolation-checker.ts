import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Tenant Isolation Checker — detects Supabase queries in API routes
 * that are missing tenant_id filters, risking cross-tenant data leaks.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-639 — Authorization Bypass Through User-Controlled Key
 */

function shouldSkipFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) ||
    filePath.includes('__tests__/') ||
    filePath.includes('__mocks__/') ||
    filePath.includes('/test/') ||
    filePath.includes('/tests/') ||
    filePath.includes('/vendor/') ||
    filePath.includes('.min.js') ||
    filePath.includes('/generated/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('/cron/') ||
    filePath.includes('/webhooks/')
  );
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Checks if a tenant_id filter exists within a window of lines after the match */
function hasTenantFilter(lines: string[], startLine: number, windowSize: number): boolean {
  const endLine = Math.min(startLine + windowSize, lines.length);
  const window = lines.slice(startLine, endLine).join('\n');
  return /\.eq\s*\(\s*['"]tenant_id['"]/.test(window) ||
    /\.filter\s*\(\s*['"]tenant_id['"]/.test(window) ||
    /tenant_id\s*=/.test(window);
}

export const tenantIsolationCheckerScanner: Scanner = {
  name: 'tenant-isolation-checker',
  description: 'Detects Supabase queries in API routes missing tenant_id filters — cross-tenant data leak risk',
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

    // Auto-detect: only run if the project actually uses tenant_id (multi-tenant)
    const allFiles = walkFiles(projectPath, ignore, ['ts', 'js']);
    const hasTenantId = allFiles.some((f) => {
      const c = readFileSafe(f);
      return c !== null && /tenant_id/.test(c);
    });
    if (!hasTenantId) {
      return { scanner: 'tenant-isolation-checker', category: 'security', findings, duration: Date.now() - start, available: true };
    }

    const files = allFiles;

    for (const file of files) {
      if (shouldSkipFile(file)) continue;

      // Only check route files (API endpoints)
      const isRouteFile = /route\.(ts|js)$/.test(file);
      if (!isRouteFile) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // Skip files that use secureApiRouteWithTenant (it handles tenant filtering)
      if (/secureApiRouteWithTenant/.test(content)) continue;

      const lines = content.split('\n');

      // Check for service_role usage — bypasses ALL RLS
      const serviceRoleRe = /service_role/gi;
      let serviceRoleMatch: RegExpExecArray | null;
      while ((serviceRoleMatch = serviceRoleRe.exec(content)) !== null) {
        const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'tenant-isolation-checker',
          severity: 'critical',
          title: 'Service role key used in route — bypasses all RLS policies',
          description:
            'The service_role key bypasses Row Level Security entirely. If used in an API route without extremely careful manual filtering, any user can access data from any tenant. Use the anon/user key with RLS policies, or add explicit tenant_id filtering with secureApiRouteWithTenant.',
          file,
          line: findLineNumber(content, serviceRoleMatch.index),
          category: 'security',
          owasp: 'A01:2021',
          cwe: 639,
        });
      }

      // Check for .from( queries without tenant_id filter
      const fromRe = /\.from\s*\(/g;
      let fromMatch: RegExpExecArray | null;
      while ((fromMatch = fromRe.exec(content)) !== null) {
        const matchLine = findLineNumber(content, fromMatch.index);

        // Check if tenant_id filter exists within 30 lines after the query
        if (!hasTenantFilter(lines, matchLine - 1, 30)) {
          const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'tenant-isolation-checker',
            severity: 'high',
            title: 'Database query missing tenant_id filter — cross-tenant data leak possible',
            description:
              'A Supabase .from() query in an API route does not include a .eq(\'tenant_id\', ...) filter within 30 lines. In a multi-tenant application, every database query must filter by tenant_id to prevent users from accessing other tenants\' data. Add .eq(\'tenant_id\', context.tenantId) to the query chain, or use secureApiRouteWithTenant which handles this automatically.',
            file,
            line: matchLine,
            category: 'security',
            owasp: 'A01:2021',
            cwe: 639,
          });
        }
      }
    }

    return {
      scanner: 'tenant-isolation-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
