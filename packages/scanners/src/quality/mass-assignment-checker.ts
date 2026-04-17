import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/**
 * Patterns that indicate the request body is read.
 *
 * v0.9.2 (validator MAJOR-01): accept both `req` and `request` as
 * handler-parameter aliases. Next.js App Router allows either name for
 * the incoming `NextRequest` argument; the `req` abbreviation is
 * extremely common in the ecosystem. Previously only `request.json()`
 * matched, so every codebase using `const body = await req.json()`
 * silently bypassed the detection. Kept symmetric with
 * `packages/scanners/src/ast/sources.ts` TAINT_SOURCES which already
 * handles both aliases.
 */
const REQUEST_JSON_PATTERN = /await\s+(?:req|request)\.json\s*\(\s*\)/;

/** Patterns that indicate the raw body is passed directly to a DB operation */
const RAW_DB_PATTERNS = [
  // Supabase: .insert(body|data|payload|...) / .update(...) / .upsert(...)
  /\.(insert|update|upsert)\s*\(\s*(?:body|data|payload|params|input|values)\s*\)/,
  // Prisma: prisma.*.create({ data: body|data|payload|... }) / .update / .upsert
  /prisma\s*\.\s*\w+\s*\.\s*(?:create|update|upsert)\s*\(\s*\{[^}]*data\s*:\s*(?:body|data|payload|params|input|values)\b/,
  // Inline: .insert(await req.json()) / .update(await request.json()) / .upsert(...) — either alias
  /\.(insert|update|upsert)\s*\(\s*await\s+(?:req|request)\.json\s*\(\s*\)\s*\)/,
];

/** Patterns that indicate the body is sanitised before DB use.
 *  If ANY of these are found, the file is considered mitigated. */
const MITIGATION_PATTERNS = [
  // Zod parse / safeParse — either alias
  /\.parse\s*\(\s*(?:body|await\s+(?:req|request)\.json\s*\(\s*\))/,
  /\.safeParse\s*\(\s*(?:body|await\s+(?:req|request)\.json\s*\(\s*\))/,
  // Any safeParse or parseAsync call anywhere in the file
  /\.safeParse\s*\(/,
  /\.parseAsync\s*\(/,
  /\.safeParseAsync\s*\(/,
  // Explicit field destructuring from body/data/payload/params/input/values
  /const\s*\{[^}]+\}\s*=\s*(?:body|data|payload|params|input|values)/,
  // Inline destructure direct from the await — either alias
  /const\s*\{[^}]+\}\s*=\s*await\s+(?:req|request)\.json/,
];

function hasMitigation(content: string): boolean {
  return MITIGATION_PATTERNS.some((p) => p.test(content));
}

function hasRequestJson(content: string): boolean {
  return REQUEST_JSON_PATTERN.test(content);
}

function hasRawDbWrite(content: string): boolean {
  return RAW_DB_PATTERNS.some((p) => p.test(content));
}

export const massAssignmentCheckerScanner: Scanner = {
  name: 'mass-assignment-checker',
  description: 'Detects API routes where an unvalidated request body is passed directly to a database write operation',
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
        const content = readFileSafe(file);
        if (content === null) continue;

        // Must read request body AND write it raw to the DB
        if (!hasRequestJson(content)) continue;
        if (!hasRawDbWrite(content)) continue;

        // Skip if the body is validated or destructured before use
        if (hasMitigation(content)) continue;

        // Find the line of the first direct DB write for the finding location
        let lineNumber = 1;
        for (const pattern of RAW_DB_PATTERNS) {
          const match = pattern.exec(content);
          if (match) {
            lineNumber = findLineNumber(content, match.index);
            break;
          }
        }

        const id = `MASS-${String(idCounter.value++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'mass-assignment-checker',
          severity: 'high',
          title: 'Mass assignment: raw request body passed directly to database',
          description:
            'The request body from request.json() is passed directly to a database insert/update/upsert without Zod validation or explicit field destructuring. This allows attackers to set arbitrary fields, including privilege columns like role, tenantId, or isAdmin. Validate with a Zod schema or destructure only the expected fields.',
          file,
          line: lineNumber,
          category: 'security',
          owasp: 'A08:2021',
          cwe: 915,
        });
      }
    }

    return {
      scanner: 'mass-assignment-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
