import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/**
 * Per-occurrence pagination checker.
 *
 * For each .from('table').select( or findMany( call, we check the SAME
 * method chain (next ~15 lines) for:
 * - Pagination: .limit(), .range(), take:, skip:
 * - Single-record: .single(), .maybeSingle(), .eq('id',...), findUnique, findFirst
 *
 * Only flags if NONE of these appear in the chain. This eliminates the
 * file-level suppression problem where one .limit() masked 9 unbounded queries.
 */

/** Patterns that explicitly LIMIT row count (not just filter) */
const BOUNDED_PATTERNS = [
  /\.limit\s*\(/,
  /\.range\s*\(/,
  /\btake\s*:/,
  /\bskip\s*:/,
  /searchParams\.get\s*\(\s*['"](?:limit|page|per_page|pageSize)['"]\s*\)/,
];

/** Patterns that indicate the query is filtered enough to be reasonable.
 *  Unlike BOUNDED_PATTERNS, these don't guarantee a row limit but show
 *  the developer is filtering intentionally (date range, specific tenant, etc.) */
const FILTERED_PATTERNS = [
  /\.eq\s*\(\s*['"](?:date|appointment_date|created_at|day|month|year)['"]/,  // Date filter
  /\.gte\s*\(/,        // Range filter (>=)
  /\.lte\s*\(/,        // Range filter (<=)
  /\.textSearch\s*\(/,  // Full-text search (returns limited results)
];

/** Patterns that indicate single-record access (not a list query) */
const SINGLE_PATTERNS = [
  /\.single\s*\(/,
  /\.maybeSingle\s*\(/,
  /\.eq\s*\(\s*['"]id['"]/,
  /findUnique\s*\(/,
  /findFirst\s*\(/,
];

/** Patterns that indicate write operations (not reads that need pagination) */
const WRITE_PATTERNS = [
  /\.insert\s*\(/,
  /\.update\s*\(/,
  /\.delete\s*\(/,
  /\.upsert\s*\(/,
];

function findLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

/** Get a window of code around a match: 5 lines before + 30 lines after.
 *  Supabase chains can be 20+ lines long with complex select() + multiple .eq() filters. */
function getChainWindow(content: string, matchIndex: number): string {
  const allLines = content.split('\n');
  const matchLine = content.slice(0, matchIndex).split('\n').length - 1;
  const start = Math.max(0, matchLine - 5);
  const end = Math.min(allLines.length, matchLine + 30);
  return allLines.slice(start, end).join('\n');
}

export const paginationCheckerScanner: Scanner = {
  name: 'pagination-checker',
  description: 'Detects individual database queries without row limits or pagination',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const ignore = [...new Set([...['node_modules', 'dist', '.next', '.git'], ...(config.ignore ?? [])])];

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
        const content = readFileSafe(file);
        if (content === null) continue;

        // Check each .from('...').select( occurrence individually
        const supabaseSelectRe = /\.from\s*\([^)]*\)\s*\.select\s*\(/g;
        let match: RegExpExecArray | null;
        while ((match = supabaseSelectRe.exec(content)) !== null) {
          const chain = getChainWindow(content, match.index);

          // Skip if this specific chain has explicit limits or meaningful filters
          if (BOUNDED_PATTERNS.some((p) => p.test(chain))) continue;
          if (FILTERED_PATTERNS.some((p) => p.test(chain))) continue;
          // Skip if this specific chain is a single-record lookup
          if (SINGLE_PATTERNS.some((p) => p.test(chain))) continue;
          // Skip if this is followed by a write operation in the chain
          if (WRITE_PATTERNS.some((p) => p.test(chain))) continue;
          // Heuristic: 2+ .eq() calls = sufficiently filtered (tenant_id + date/status/etc.)
          const eqCount = (chain.match(/\.eq\s*\(/g) ?? []).length;
          if (eqCount >= 2) continue;

          const id = `PAGINATION-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'pagination-checker',
            severity: 'high',
            title: 'Database query without pagination or row limit',
            description:
              'A .from().select() query does not apply .limit(), .range(), or .single() within the method chain. Unbounded queries risk memory exhaustion and data exposure.',
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A05:2021',
            cwe: 770,
          });
        }

        // Check each findMany( occurrence — Prisma needs take:/skip: specifically
        // (where: filters but doesn't limit row count)
        const PRISMA_LIMIT_PATTERNS = [/\btake\s*:/, /\bskip\s*:/];
        const findManyRe = /findMany\s*\(/g;
        while ((match = findManyRe.exec(content)) !== null) {
          const chain = getChainWindow(content, match.index);
          if (PRISMA_LIMIT_PATTERNS.some((p) => p.test(chain))) continue;

          const id = `PAGINATION-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'pagination-checker',
            severity: 'high',
            title: 'Prisma findMany() without pagination',
            description:
              'A Prisma findMany() call does not include take: or skip: parameters. Without limits, large tables cause memory exhaustion.',
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A05:2021',
            cwe: 770,
          });
        }
      }
    }

    return {
      scanner: 'pagination-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
