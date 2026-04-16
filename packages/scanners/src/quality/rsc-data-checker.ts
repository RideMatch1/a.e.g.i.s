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

/** Detects .select('*') — full record selection */
const SELECT_ALL_PATTERN = /\.select\s*\(\s*['"]\*['"]\s*\)/;

/** Detects data being passed to JSX as a prop */
const DATA_TO_JSX_PATTERN = /\bdata\s*=\s*\{(?:data|result|rows|records|items)\s*\}/;

/** Also detect spreading the full result: {...data} */
const SPREAD_DATA_PATTERN = /\{\s*\.\.\.(?:data|result|rows|records|items)\s*\}/;

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

      // Skip if no .select('*') is used — specific field selection is fine
      if (!SELECT_ALL_PATTERN.test(content)) continue;

      // Check if the full data is passed to JSX
      const passesToJsx = DATA_TO_JSX_PATTERN.test(content) || SPREAD_DATA_PATTERN.test(content);
      if (!passesToJsx) continue;

      // Find the location of select('*')
      const selectRe = new RegExp(SELECT_ALL_PATTERN.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = selectRe.exec(content)) !== null) {
        const id = `RSC-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'rsc-data-checker',
          severity: 'medium',
          title: 'Server Component passes full DB record to client — may expose sensitive fields',
          description:
            'A React Server Component uses .select(\'*\') and passes the full result to client-side JSX. This can expose sensitive database fields (passwords, tokens, internal IDs, PII) to the browser. Use explicit field selection (.select(\'id, name, email\')) to return only the fields the client needs, or map the data to a safe DTO before passing to client components.',
          file,
          line: findLineNumber(content, match.index),
          category: 'security',
          owasp: 'A01:2021',
          cwe: 200,
        });
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
