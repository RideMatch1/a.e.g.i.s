import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * RLS Bypass Checker — detects Supabase .rpc() calls that may bypass
 * Row Level Security via SECURITY DEFINER functions, and service_role usage.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-863 — Incorrect Authorization
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
    filePath.includes('/scripts/')
  );
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Function names in .rpc() calls that suggest security-sensitive operations */
const SENSITIVE_RPC_NAMES = /\.rpc\s*\(\s*['"](?:\w*(?:admin|delete|update|create|modify|remove|purge|drop|grant|revoke|reset|migrate|bulk|batch|all|manage|elevate|impersonate)\w*)['"]/i;

/** Generic .rpc() call */
const RPC_PATTERN = /\.rpc\s*\(/;

/** RLS bypass documentation patterns — comments indicating awareness */
const RLS_COMMENT_PATTERNS: RegExp[] = [
  /\/\/\s*(?:RLS|rls)/,
  /\/\*[\s\S]*?(?:RLS|rls|SECURITY DEFINER|security definer)[\s\S]*?\*\//,
  /\/\/\s*SECURITY DEFINER/i,
  /\/\/\s*bypass.*rls/i,
  /\/\/\s*NOTE.*rls/i,
  /\/\/\s*(?:safe|ok|intentional|by.design|service.role)/i,
  /\/\/\s*admin.only/i,
  /\/\/\s*cron/i,  // Cron jobs legitimately use service_role
  /\/\/\s*internal/i,
  /\/\/\s*server.only/i,
];

/** service_role key usage */
const SERVICE_ROLE_PATTERN = /service_role/;

export const rlsBypassCheckerScanner: Scanner = {
  name: 'rls-bypass-checker',
  description: 'Detects Supabase .rpc() calls and service_role usage that may bypass Row Level Security (CWE-863)',
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

      const content = readFileSafe(file);
      if (content === null) continue;

      const lines = content.split('\n');

      // Check for service_role key usage in server code
      const serviceRoleRe = new RegExp(SERVICE_ROLE_PATTERN.source, 'g');
      let serviceRoleMatch: RegExpExecArray | null;
      while ((serviceRoleMatch = serviceRoleRe.exec(content)) !== null) {
        const matchLine = findLineNumber(content, serviceRoleMatch.index);

        // Check if RLS comment exists nearby
        const nearbyLines = lines.slice(Math.max(0, matchLine - 4), matchLine + 3).join('\n');
        if (RLS_COMMENT_PATTERNS.some((p) => p.test(nearbyLines))) continue;

        const id = `RLS-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'rls-bypass-checker',
          severity: 'high',
          title: 'service_role key usage — bypasses ALL Row Level Security policies',
          description:
            'The Supabase service_role key bypasses all RLS policies entirely. This means any query using this key ignores tenant isolation, access controls, and data visibility rules. Only use service_role for server-side admin operations that genuinely need to bypass RLS, and document the reason. Prefer the anon/authenticated key with properly configured RLS policies.',
          file,
          line: matchLine,
          category: 'security',
          owasp: 'A01:2021',
          cwe: 863,
        });
      }

      // Check for .rpc() calls
      if (!RPC_PATTERN.test(content)) continue;

      const rpcRe = new RegExp(RPC_PATTERN.source, 'g');
      let rpcMatch: RegExpExecArray | null;
      while ((rpcMatch = rpcRe.exec(content)) !== null) {
        const matchLine = findLineNumber(content, rpcMatch.index);

        // Check if RLS comment/documentation exists nearby
        const nearbyLines = lines.slice(Math.max(0, matchLine - 4), matchLine + 3).join('\n');
        if (RLS_COMMENT_PATTERNS.some((p) => p.test(nearbyLines))) continue;

        // Determine severity: sensitive function names get MEDIUM, others INFO-level but still flagged
        const isSensitive = SENSITIVE_RPC_NAMES.test(content.slice(rpcMatch.index, rpcMatch.index + 100));
        const severity = isSensitive ? 'high' : 'medium';
        const title = isSensitive
          ? 'Security-sensitive .rpc() call may bypass RLS via SECURITY DEFINER'
          : 'Supabase .rpc() call may bypass RLS if function uses SECURITY DEFINER';

        const id = `RLS-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'rls-bypass-checker',
          severity,
          title,
          description:
            'Supabase .rpc() calls invoke PostgreSQL functions directly. If the called function uses SECURITY DEFINER, it executes with the function owner\'s privileges, bypassing all RLS policies. This can lead to unauthorized data access. Audit the PostgreSQL function to ensure it uses SECURITY INVOKER (default) or add an RLS comment documenting why SECURITY DEFINER is needed.',
          file,
          line: matchLine,
          category: 'security',
          owasp: 'A01:2021',
          cwe: 863,
        });
      }
    }

    return {
      scanner: 'rls-bypass-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
