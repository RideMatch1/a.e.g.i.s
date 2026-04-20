import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { stripComments } from '../ast/page-context.js';

/**
 * Detects hardcoded JWT-shaped credentials embedded in source files.
 *
 * Emits a CRITICAL finding per match with rule-id `SECRET-JWT-NNN`, OWASP
 * A02:2021 mapping, and CWE-798 (Hardcoded Credentials). Introduced in
 * v0.15.2 as part of the Detection Hardening hotfix (Item-1) after the
 * Round-2 external review flagged a credibility-critical gap: a crafted
 * Next.js+Supabase fixture with a literal `eyJ…service_role…` JWT scanned
 * clean at grade A under v0.15.0-v0.15.1.
 *
 * Comment-aware via `stripComments`
 * (`packages/scanners/src/ast/page-context.ts`). JWT-shape detections
 * inside `//` line-comments and `/* \*\/` block-comments are correctly
 * skipped — the v0152-jwt-detector canary suite covers this behavior via
 * its FP-comment-jwt fixture.
 *
 * Shape matched (loosened from the plan spec `{20,20,10}` to `{15,15,5}`
 * after Flag-A audit so the canonical HS256-minimal header
 * `eyJhbGciOiJIUzI1NiJ9` (17 chars post-`eyJ`) is caught):
 *   eyJ[A-Za-z0-9_-]{15,} . [A-Za-z0-9_-]{15,} . [A-Za-z0-9_-]{5,}
 *
 * Known limitations:
 *   - Interpolated template-literals (`` `eyJ…${payload}.${sig}` ``) are
 *     not reconstructed — detection would require an AST pass. Documented
 *     in the FP-interpolated-template-jwt canary, slated for v0.15.3 /
 *     semgrep pairing.
 *   - Entropy-scanner may double-fire on the same hardcoded JWT at
 *     HIGH/MEDIUM severity per segment. Acceptable — different scanners
 *     surface different angles.
 */

const JWT_REGEX = /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{5,}/g;

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git', 'coverage', 'build', 'out', '.turbo'];

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

export const jwtDetectorScanner: Scanner = {
  name: 'jwt-detector',
  description: 'Detects hardcoded JWT-shaped credentials in source (CWE-798). Comment-aware via stripComments.',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    const ignore = [...new Set([...DEFAULT_IGNORE, ...(config.ignore ?? [])])];
    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

    for (const file of files) {
      if (isTestFile(file)) continue;

      const raw = readFileSafe(file);
      if (!raw) continue;

      const sanitized = stripComments(raw);
      const re = new RegExp(JWT_REGEX.source, JWT_REGEX.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(sanitized)) !== null) {
        findings.push({
          id: `SECRET-JWT-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'jwt-detector',
          severity: 'critical',
          category: 'security',
          title: 'Hardcoded JWT credential detected in source',
          description:
            `A JWT-shaped literal was found embedded in source code. Hardcoded `
            + `credentials are vulnerable to exposure via repository access, `
            + `client-bundle leaks, and log captures, and they cannot be rotated `
            + `without a redeploy. Tokens of this shape are treated as long-lived `
            + `secrets and must be loaded from environment variables or a secrets `
            + `manager at runtime.`,
          file,
          line: findLineNumber(sanitized, match.index),
          owasp: 'A02:2021',
          cwe: 798,
          fix: {
            description:
              'Move the JWT to an environment variable and reference it at runtime. '
              + 'Rotate the leaked credential immediately — once committed to a repo '
              + 'or shipped in a client bundle it must be treated as compromised.',
            code: 'const token = process.env.SERVICE_ROLE_KEY;',
            links: [
              'https://cwe.mitre.org/data/definitions/798.html',
              'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
            ],
          },
        });
      }
    }

    return {
      scanner: 'jwt-detector',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
