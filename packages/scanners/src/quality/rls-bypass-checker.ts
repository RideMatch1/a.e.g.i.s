import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * RLS Bypass Checker — detects Supabase .rpc() calls that may bypass
 * Row Level Security via SECURITY DEFINER functions.
 *
 * v0.14 dedup: service_role-key usage is now emitted exclusively by
 * tenant-isolation-checker (which runs scope-aware AST analysis and
 * emits at `critical` severity). This scanner previously emitted a
 * parallel `high`-severity finding on the same source lines; the
 * duplication inflated finding-counts without adding signal. The
 * .rpc() SECURITY-DEFINER detection below remains — it is a distinct
 * risk class (caller-passed argument may bypass RLS inside the
 * function body) that tenant-isolation-checker does not cover.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-863 — Incorrect Authorization
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

/**
 * v0.8 Phase 8: the scanner previously fired on ANY file mentioning
 * `service_role` or `.rpc()` as a text match, including scanner/sink
 * definition files that reference those patterns as DETECTION targets
 * (e.g. aegis's own sinks.ts, taint-tracker.ts, rls-bypass-checker
 * source). Require an ACTUAL DB-client usage signal — a call-shape or
 * import — before scanning. A bare word-match on "supabase" or
 * "createClient" is insufficient because scanner definitions include
 * those names as string literals.
 */
const DB_CLIENT_SIGNAL = new RegExp(
  [
    'createClient\\s*\\(',                         // createClient(...)
    '\\bsupabase\\s*[.]\\s*\\w+',                  // supabase.from(...) / supabase.rpc(...)
    '\\bfrom\\s*[\'"](?:@supabase/|postgres|pg|drizzle-orm|@prisma/)', // import …
    'new\\s+(?:Pool|Client|PrismaClient|Kysely)\\b',  // new Pool(), new PrismaClient()
    'getServerClient\\s*\\(',                      // Supabase SSR helper
  ].join('|'),
);

export const rlsBypassCheckerScanner: Scanner = {
  name: 'rls-bypass-checker',
  description: 'Detects Supabase .rpc() calls that may bypass Row Level Security via SECURITY DEFINER functions (CWE-863). v0.14: service_role detection moved to tenant-isolation-checker as authoritative emitter.',
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

      // v0.8 Phase 8: require a DB-client signal before matching.
      // Eliminates structural self-match on scanner source files that
      // reference `service_role` or `.rpc(` as DETECTION patterns.
      if (!DB_CLIENT_SIGNAL.test(content)) continue;

      const lines = content.split('\n');

      // v0.14 dedup: service_role-key emission removed — see file header.
      // tenant-isolation-checker is now the authoritative emitter (it
      // does scope-aware AST analysis and emits at `critical`). The
      // .rpc() SECURITY-DEFINER detection below remains.

      // Check for .rpc() calls
      if (!RPC_PATTERN.test(content)) continue;

      const rpcRe = new RegExp(RPC_PATTERN.source, 'g');
      let rpcMatch: RegExpExecArray | null;
      while ((rpcMatch = rpcRe.exec(content)) !== null) {
        const matchLine = findLineNumber(content, rpcMatch.index);

        // Check if RLS comment/documentation exists nearby
        const nearbyLines = lines.slice(Math.max(0, matchLine - 4), matchLine + 3).join('\n');
        if (RLS_COMMENT_PATTERNS.some((p) => p.test(nearbyLines))) continue;

        // Severity split:
        //   - sensitive-named .rpc() (admin_*, delete_*, grant_*, etc.) stay HIGH —
        //     the name itself signals an elevated operation whose SECURITY DEFINER
        //     usage carries real risk regardless of function-body verification.
        //   - generic .rpc() downgraded v0.14: MEDIUM → INFO. Without SQL
        //     function-body parsing (not yet implemented — queued for a later
        //     release's deeper-introspection scope), the scanner cannot verify
        //     whether caller-passed arguments are validated inside the function.
        //     MEDIUM over-weighted conservative-truth pedagogy; INFO keeps the
        //     finding visible without score-deduction. Matches the v0.13
        //     ecosystem-inherent-INFO pattern for unavoidable-but-visible signal.
        const isSensitive = SENSITIVE_RPC_NAMES.test(content.slice(rpcMatch.index, rpcMatch.index + 100));
        const severity: Finding['severity'] = isSensitive ? 'high' : 'info';
        const title = isSensitive
          ? 'Security-sensitive .rpc() call may bypass RLS via SECURITY DEFINER'
          : 'Supabase .rpc() call may bypass RLS if function uses SECURITY DEFINER';
        const description = isSensitive
          ? 'Supabase .rpc() calls invoke PostgreSQL functions directly. If the called function uses SECURITY DEFINER, it executes with the function owner\'s privileges, bypassing all RLS policies. This can lead to unauthorized data access. Audit the PostgreSQL function to ensure it uses SECURITY INVOKER (default) or add an RLS comment documenting why SECURITY DEFINER is needed.'
          : 'Supabase .rpc() calls invoke PostgreSQL functions directly. If the called function uses SECURITY DEFINER, it executes with the function owner\'s privileges, bypassing all RLS policies. Verify the function body validates caller-passed arguments, or add an RLS comment documenting why SECURITY DEFINER is needed. Informational: AEGIS does not yet parse SQL function bodies to reclassify this finding — queued for a later release.';

        const id = `RLS-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'rls-bypass-checker',
          severity,
          title,
          description,
          file,
          line: matchLine,
          category: 'security',
          owasp: 'A01:2021',
          cwe: 863,
          fix: {
            description:
              'Audit the called Postgres function. If it is declared SECURITY DEFINER, replace it with SECURITY INVOKER so the caller RLS context applies, or document the deliberate exception with an RLS comment and verify the function body validates every argument before touching user-scoped data.',
            code: "-- pg policy: set function SECURITY INVOKER so caller-side RLS applies\nALTER FUNCTION get_dashboard_stats() SECURITY INVOKER;",
            links: [
              'https://cwe.mitre.org/data/definitions/863.html',
              'https://owasp.org/Top10/A01_2021-Broken_Access_Control/',
            ],
          },
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
