import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * RSC Data Checker — detects React Server Components that pass full DB records
 * to Client Components, potentially exposing sensitive fields.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor
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

/** Detects Supabase `.select('*')` — full record selection. */
const SELECT_ALL_PATTERN = /\.select\s*\(\s*['"]\*['"]\s*\)/;

/** v0.10 Z6: Prisma full-record methods. findUnique / findMany / findFirst
 *  and their OrThrow variants return all scalar fields by default (no
 *  field-allowlist via `select:`). When the result is then spread into
 *  JSX via DATA_TO_JSX / SPREAD_DATA, the leak surface is identical to
 *  Supabase `.select('*')`. Description emphasises the use of `select:
 *  { field: true, ... }` projection or a DTO mapper. */
const PRISMA_FULL_RECORD_PATTERN =
  /prisma\s*\.\s*\w+\s*\.\s*(?:findFirst|findUnique|findMany|findFirstOrThrow|findUniqueOrThrow)\s*\(/;

/** v0.10 Z6: detect ANY JSX prop whose value is a single-variable
 *  expression matching a "likely-full-record" name. Covers the
 *  Supabase `data={data}` classic shape AND the Prisma-idiomatic
 *  `user={user}` / `post={post}` / `profile={profile}` shapes where
 *  the prop name mirrors the model name. */
const LIKELY_FULL_RECORD_VARS =
  'data|result|rows|records|items|user|users|post|posts|profile|profiles|row|record|item|account|accounts|subscription|subscriptions|organization|organizations|team|teams|workspace|workspaces|document|documents';

const DATA_TO_JSX_PATTERN = new RegExp(
  `=\\s*\\{\\s*(?:${LIKELY_FULL_RECORD_VARS})\\s*\\}`,
);

/** Also detect spreading the full result: {...data} */
const SPREAD_DATA_PATTERN = new RegExp(
  `\\{\\s*\\.\\.\\.(?:${LIKELY_FULL_RECORD_VARS})\\s*\\}`,
);

export const rscDataCheckerScanner: Scanner = {
  name: 'rsc-data-checker',
  description: 'Detects Server Components passing full DB records to client — may expose sensitive fields (CWE-200)',
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

    // Server Components are typically page.tsx and layout.tsx
    const files = walkFiles(projectPath, ignore, ['tsx', 'ts', 'jsx', 'js']);

    for (const file of files) {
      if (shouldSkipFile(file)) continue;

      // Only check Server Components — page.tsx and layout.tsx files
      const isServerComponent = /(?:page|layout)\.(tsx|jsx|ts|js)$/.test(file);
      if (!isServerComponent) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // v0.10 Z6: emit on either Supabase `.select('*')` or Prisma
      // full-record method (no `select:` projection). Each is only a
      // CWE-200 risk when the result flows to JSX without field-picking.
      const hasSupabaseSelectAll = SELECT_ALL_PATTERN.test(content);
      const hasPrismaFullRecord = PRISMA_FULL_RECORD_PATTERN.test(content);
      if (!hasSupabaseSelectAll && !hasPrismaFullRecord) continue;

      // Check if the full data is passed to JSX
      const passesToJsx = DATA_TO_JSX_PATTERN.test(content) || SPREAD_DATA_PATTERN.test(content);
      if (!passesToJsx) continue;

      const triggerPatterns: Array<{ pattern: RegExp; family: 'supabase' | 'prisma' }> = [];
      if (hasSupabaseSelectAll) triggerPatterns.push({ pattern: SELECT_ALL_PATTERN, family: 'supabase' });
      if (hasPrismaFullRecord) triggerPatterns.push({ pattern: PRISMA_FULL_RECORD_PATTERN, family: 'prisma' });

      for (const { pattern, family } of triggerPatterns) {
        const re = new RegExp(pattern.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          const id = `RSC-${String(idCounter++).padStart(3, '0')}`;
          const title =
            family === 'supabase'
              ? 'Server Component passes full DB record to client — may expose sensitive fields'
              : 'Server Component with Prisma full-record query passes result to client — may expose sensitive fields';
          const description =
            family === 'supabase'
              ? 'A React Server Component uses .select(\'*\') and passes the full result to client-side JSX. This can expose sensitive database fields (passwords, tokens, internal IDs, PII) to the browser. Use explicit field selection (.select(\'id, name, email\')) to return only the fields the client needs, or map the data to a safe DTO before passing to client components.'
              : 'A React Server Component calls prisma.*.findUnique / findMany / findFirst (or the OrThrow variants) without a `select:` projection and passes the full record to client-side JSX. By default these return every scalar field on the model — including any password_hash, resetToken, mfaSecret, etc. Add `select: { id: true, name: true, ... }` or map the record to a safe DTO before passing it into client components.';
          findings.push({
            id,
            scanner: 'rsc-data-checker',
            severity: 'medium',
            title,
            description,
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A01:2021',
            cwe: 200,
          });
        }
      }
    }

    return {
      scanner: 'rsc-data-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
