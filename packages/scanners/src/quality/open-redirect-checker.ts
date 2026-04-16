import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Dangerous redirect patterns where user-controlled input flows into a redirect.
 * These patterns use variables/params, not hardcoded strings.
 */
const DANGEROUS_REDIRECT_PATTERNS: RegExp[] = [
  // redirect(searchParams.get(...)) or redirect(query.xxx)
  /\bredirect\s*\(\s*(?:searchParams\.get\(|query\.|req\.query\.)/,
  // NextResponse.redirect(new URL(variable)) — variable not a string literal
  /NextResponse\.redirect\s*\(\s*new\s+URL\s*\(\s*(?!['"]).+?\)/,
  // res.redirect(req.query.xxx) or res.redirect(req.body.xxx)
  /res\.redirect\s*\(\s*req\.(query|body)\./,
];

/** Patterns that indicate safe URL validation is present in the file */
const SAFE_VALIDATION_PATTERNS: RegExp[] = [
  // Allowlist / whitelist check
  /allowlist|whitelist|allowedUrls|allowedRedirects/i,
  // Ensures only relative paths (starts with /)
  /startsWith\s*\(\s*['"]\//,
  // Safe base-URL construction: new URL(input, baseUrl) — relative forced
  /new\s+URL\s*\(\s*\w+\s*,\s*(?:process\.env\.|(?:['"]|https?:\/\/)|\bbaseUrl\b|\borigin\b)/,
  // Explicit allowlist pattern check
  /ALLOWED_REDIRECT|SAFE_REDIRECT|redirectAllowlist|safeOrigins/i,
];

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

function isSafeRedirect(content: string): boolean {
  return SAFE_VALIDATION_PATTERNS.some((p) => p.test(content));
}

function detectScanDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
    `${projectPath}/src/app`,
    `${projectPath}/app`,
  ];
}

export const openRedirectCheckerScanner: Scanner = {
  name: 'open-redirect-checker',
  description: 'Detects redirect patterns that use unvalidated user-controlled input',
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

    const scanDirs = detectScanDirs(projectPath);
    // Deduplicate dirs to avoid scanning overlapping paths twice
    const seenFiles = new Set<string>();

    for (const dir of scanDirs) {
      let files: string[];
      try {
        files = walkFiles(dir, ignore, ['ts', 'js']);
      } catch {
        continue;
      }

      for (const file of files) {
        if (seenFiles.has(file)) continue;
        seenFiles.add(file);

        const content = readFileSafe(file);
        if (content === null) continue;

        // If the file has safe validation patterns, skip — the developer has handled it
        if (isSafeRedirect(content)) continue;

        for (const pattern of DANGEROUS_REDIRECT_PATTERNS) {
          const re = new RegExp(pattern.source, `${pattern.flags}g`);
          let match: RegExpExecArray | null;
          while ((match = re.exec(content)) !== null) {
            const id = `REDIR-${String(idCounter++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'open-redirect-checker',
              severity: 'medium',
              title: 'Potential open redirect with unvalidated input',
              description:
                'A redirect using user-controlled input (query param, request body) was detected without URL allowlist validation. An attacker could redirect users to a malicious site. Validate the redirect target: ensure it starts with "/" (relative), matches an explicit allowlist, or use new URL(input, baseUrl) to enforce same-origin.',
              file,
              line: findLineNumber(content, match.index),
              category: 'security',
              owasp: 'A01:2021',
              cwe: 601,
            });
          }
        }
      }
    }

    return {
      scanner: 'open-redirect-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
