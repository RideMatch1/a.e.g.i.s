import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { stripComments } from '../ast/page-context.js';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — hardcoded JWT in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — hardcoded JWT in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

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
 *   - String-concat JWT-shape (e.g. `"eyJ…" + "." + "…" + "." + "…"`) is
 *     not detected. The regex requires a continuous `eyJ…`-shape within
 *     a single quoted string-literal; splitting across multiple literals
 *     joined by `+` breaks the `{15,}` length-anchor on each segment.
 *     Documented in the v0153-jwt-known-limitations/FP-concat-known
 *     canary. AST-pass for concat-reconstruction tracked for v0.16.
 *     Surfaced as Round-3 adversarial probe A1b (grade D).
 *   - Unicode-homoglyph prefix (e.g. `"\u{FF45}yJ…"` — fullwidth Latin
 *     small letter e U+FF45, and adjacent Cyrillic е U+0435 / Greek е
 *     U+03B5 variants) bypasses the ASCII-exact `eyJ`-anchor. The regex
 *     matches only the ASCII byte-sequence `e-y-J`; a visually-
 *     indistinguishable homoglyph at position 0 defeats the match.
 *     Documented in the v0153-jwt-known-limitations/FP-homoglyph-known
 *     canary. Normalization-pass (NFKD plus homoglyph-folding to ASCII
 *     before scan) tracked for v0.16. Surfaced as Round-3 adversarial
 *     probe A1c (grade D).
 *   - Multi-line `+`-concat (`"eyJ…" +\n"…" +\n"…"`) is a sub-class of
 *     the string-concat bypass above — the line-wrapping makes the
 *     continuous-match requirement even more obviously broken. Same
 *     AST-level workaround applies. Surfaced as Round-3 adversarial
 *     probe A1e (grade D).
 *   - Entropy-scanner may double-fire on the same hardcoded JWT at
 *     HIGH/MEDIUM severity per segment. Acceptable — different scanners
 *     surface different angles.
 */

const JWT_REGEX = /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{5,}/g;

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git', 'coverage', 'build', 'out', '.turbo'];

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
        // v0.15.4 D-N-002 — include the first 12 characters of the matched
        // token (always starts with eyJ, followed by the deterministic
        // base64 of the JWT header) so multi-token reports differentiate
        // rather than listing identical titles. Never include the full
        // token — the signature portion could be a live secret.
        const tokenPrefix = match[0].slice(0, 12);
        findings.push({
          id: `SECRET-JWT-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'jwt-detector',
          severity: 'critical',
          category: 'security',
          title: `Hardcoded JWT credential detected in source (${tokenPrefix}…)`,
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
