import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const SECURITY_DIRS = ['api', 'lib', 'utils', 'services'];

/** Test files — findings here are usually intentional patterns, not real issues */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

function isInSecurityDir(filePath: string): boolean {
  return SECURITY_DIRS.some((dir) => filePath.includes(`/${dir}/`));
}

interface PatternRule {
  pattern: RegExp;
  severity: Finding['severity'];
  title: string;
  description: string;
  onlyInSecurityDirs?: boolean;
  owasp?: string;
  cwe?: number;
}

/** Additional rules that require compound checks (trigger + mitigation on same file) */
interface CompoundRule {
  trigger: RegExp;
  /** Returns true if the file is mitigated (i.e., no finding should be raised) */
  isMitigated: (content: string) => boolean;
  severity: Finding['severity'];
  title: string;
  description: string;
  owasp?: string;
  cwe?: number;
}

const COMPOUND_RULES: CompoundRule[] = [
  {
    trigger: /(?:Set-Cookie|setCookie|cookie\(|res\.cookie\(|response\.cookie\()/i,
    isMitigated: (content: string) =>
      /httpOnly/i.test(content) && /\bsecure\b/i.test(content) && /SameSite/i.test(content),
    severity: 'high',
    title: 'Cookie missing security flags (httpOnly, secure, SameSite)',
    description:
      'Cookie is set without all three security flags: httpOnly, secure, and SameSite. Missing flags expose cookies to XSS theft (no httpOnly), network interception (no secure), or CSRF (no SameSite). Set all three on every sensitive cookie.',
    owasp: 'A02:2021',
    cwe: 327,
  },
];

/** Route files for scoping prototype pollution checks */
const ROUTE_FILE_PATTERNS = [/\/route\.(ts|js)$/, /\/api\/.*\.(ts|js)$/];

function isRouteFile(filePath: string): boolean {
  return ROUTE_FILE_PATTERNS.some((p) => p.test(filePath));
}

const RULES: PatternRule[] = [
  {
    pattern: /Math\.random\(\)/,
    severity: 'high',
    title: 'Weak RNG in security context',
    description:
      'Math.random() is not cryptographically secure and must not be used in security-sensitive code (tokens, IDs, secrets). Use crypto.randomUUID() or crypto.getRandomValues() instead.',
    onlyInSecurityDirs: true,
    owasp: 'A02:2021',
    cwe: 338,
  },
  {
    pattern: /createHash\(['"`]md5['"`]\)|createHash\(['"`]sha1['"`]\)/,
    severity: 'medium',
    title: 'Weak hash algorithm',
    description:
      'MD5 and SHA-1 are cryptographically broken and should not be used for security purposes. Use SHA-256 or SHA-3 instead.',
    owasp: 'A02:2021',
    cwe: 327,
  },
  {
    pattern: /createHash\(['"`]sha256['"`]\)/,
    severity: 'low',
    title: 'Consider HMAC for token generation',
    description:
      'createHash(sha256) without a nearby createHmac may indicate plain hashing where an HMAC (keyed hash) would be more appropriate for token/MAC generation.',
    owasp: 'A02:2021',
    cwe: 327,
  },
  {
    pattern: /['"]sk_live_[A-Za-z0-9]+['"]/,
    severity: 'blocker',
    title: 'Hardcoded LIVE API key',
    description:
      'A hardcoded Stripe LIVE API key (sk_live_*) was found in source code. Remove it immediately and rotate the key. Use environment variables.',
    owasp: 'A02:2021',
    cwe: 798,
  },
  {
    pattern: /['"]sk_test_[A-Za-z0-9]+['"]/,
    severity: 'high',
    title: 'Hardcoded test API key',
    description:
      'A hardcoded Stripe test API key (sk_test_*) was found outside of test files. Use environment variables instead.',
    owasp: 'A02:2021',
    cwe: 798,
  },
  {
    pattern: /\beval\s*\(\s*[^'"`\s)]/,
    severity: 'blocker',
    title: 'Code injection risk — eval with dynamic input',
    description:
      'eval() is called with a variable or expression (not a string literal). This is a critical code injection vector. Remove it entirely or replace with a safe alternative.',
    owasp: 'A03:2021',
    cwe: 95,
  },
  {
    pattern: /\beval\s*\(\s*['"`]/,
    severity: 'high',
    title: 'eval() with string literal',
    description:
      'eval() is called with a hardcoded string. While not directly exploitable, eval() should be avoided entirely. Consider using dynamic import() or conditional require() instead.',
    owasp: 'A03:2021',
    cwe: 95,
  },
  {
    pattern: /[jJ][wW][tT]\.sign\s*\(/,
    severity: 'medium',
    title: 'JWT sign without explicit algorithm verification',
    description:
      'jwt.sign() or JWT.sign() was found. Some JWT libraries default to "none" or a weak algorithm when no explicit algorithm is specified. Always pass an explicit algorithm option (e.g. { algorithm: "HS256" }) to prevent algorithm confusion attacks.',
    owasp: 'A02:2021',
    cwe: 327,
  },
  {
    pattern: /Buffer\.from\s*\(\s*['"][^'"]{1,31}['"]\s*,\s*['"]base64['"]\)/,
    severity: 'medium',
    title: 'Short Base64 secret in Buffer.from()',
    description:
      'Buffer.from() is called with a short string literal (< 32 chars) as a Base64 secret. Short secrets are vulnerable to brute-force attacks. Use at least 256 bits (32 bytes) of entropy for cryptographic keys.',
    owasp: 'A02:2021',
    cwe: 327,
  },
  {
    pattern: /createHmac\s*\([^)]*,\s*process\.env\./,
    severity: 'medium',
    title: 'Environment variable used directly as HMAC key',
    description:
      'process.env.* is used directly as an HMAC key without hashing first. Environment variables may have low entropy or predictable formats. Derive a proper key using HKDF, PBKDF2, or at minimum hash the env var before using it as an HMAC key.',
    owasp: 'A02:2021',
    cwe: 327,
  },
  {
    pattern: /algorithm['":\s]*['"]?none['"]?|alg['":\s]*['"]?none['"]?|verify\s*:\s*false|algorithms\s*:\s*\[.*['"]none['"]/i,
    severity: 'blocker',
    title: "JWT 'none' algorithm vulnerability",
    description:
      "JWT 'none' algorithm or verify: false detected. This allows attackers to forge tokens without any signature. Always enforce a specific algorithm (HS256, RS256) and never disable verification.",
    owasp: 'A02:2021',
    cwe: 327,
  },
  {
    pattern: /session[_-]?secret\s*[:=]\s*['"][^'"]{1,30}['"]/i,
    severity: 'high',
    title: 'Hardcoded session secret',
    description:
      'A hardcoded session secret was found in source code. Session secrets must be loaded from environment variables or a secrets manager. Hardcoded secrets are visible to anyone with code access and cannot be rotated without redeployment.',
    owasp: 'A02:2021',
    cwe: 798,
  },
  {
    pattern: /Content-Disposition[^;]*\$\{/,
    severity: 'high',
    title: 'Content-Disposition header with user input (template literal)',
    description:
      'A Content-Disposition header is constructed using template literal interpolation. If user-controlled input flows into this header, an attacker can inject CRLF sequences to split the HTTP response and inject arbitrary headers or body content.',
    owasp: 'A03:2021',
    cwe: 113,
  },
  {
    pattern: /Content-Disposition[^;]*\+\s*\w+/,
    severity: 'high',
    title: 'Content-Disposition header with string concatenation',
    description:
      'A Content-Disposition header is constructed using string concatenation with a variable. If user-controlled input flows into this header, an attacker can inject CRLF sequences for HTTP response splitting.',
    owasp: 'A03:2021',
    cwe: 113,
  },
];

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

/** Build a global regex from a pattern, deduplicating flags */
function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = new Set(pattern.flags.split(''));
  flags.add('g');
  return new RegExp(pattern.source, [...flags].join(''));
}

export const cryptoAuditorScanner: Scanner = {
  name: 'crypto-auditor',
  description: 'Detects weak cryptography, hardcoded secrets, and dangerous functions',
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

    const files = walkFiles(
      projectPath,
      ignore,
      ['ts', 'js'],
    );

    for (const file of files) {
      // Skip test files — they intentionally contain patterns we're scanning for
      if (isTestFile(file)) continue;
      // Skip scripts directory — build/dev tools, not production code
      if (file.includes('/scripts/')) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // For the sha256/HMAC rule we need to check both patterns together
      const hasSha256 = /createHash\(['"`]sha256['"`]\)/.test(content);
      const hasHmac = /createHmac/.test(content);

      for (const rule of RULES) {
        if (rule.onlyInSecurityDirs && !isInSecurityDir(file)) continue;

        // Special-case: sha256 rule only fires when HMAC is NOT nearby
        if (rule.severity === 'low' && rule.title.includes('HMAC')) {
          if (!hasSha256 || hasHmac) continue;
          const id = `CRYPTO-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'crypto-auditor',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file,
            line: 1,
            fileLevel: true,
            category: 'security',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
          });
          continue;
        }

        let match: RegExpExecArray | null;
        const re = toGlobalRegex(rule.pattern);
        while ((match = re.exec(content)) !== null) {
          const id = `CRYPTO-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'crypto-auditor',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
          });
        }
      }

      // Compound rules: trigger pattern found BUT mitigation NOT found in same file
      for (const rule of COMPOUND_RULES) {
        if (rule.trigger.test(content) && !rule.isMitigated(content)) {
          const triggerRe = toGlobalRegex(rule.trigger);
          let match: RegExpExecArray | null;
          while ((match = triggerRe.exec(content)) !== null) {
            const id = `CRYPTO-${String(idCounter++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'crypto-auditor',
              severity: rule.severity,
              title: rule.title,
              description: rule.description,
              file,
              line: findLineNumber(content, match.index),
              category: 'security',
              ...(rule.owasp ? { owasp: rule.owasp } : {}),
              ...(rule.cwe ? { cwe: rule.cwe } : {}),
            });
          }
        }
      }

      // Custom check: HMAC truncation — .digest('hex').slice(0, N) where N < 32
      {
        const hmacTruncRe = /\.digest\(['"]hex['"]\)\.slice\(0,\s*(\d+)\)/g;
        let hmacMatch: RegExpExecArray | null;
        while ((hmacMatch = hmacTruncRe.exec(content)) !== null) {
          const truncLen = parseInt(hmacMatch[1], 10);
          if (truncLen < 32) {
            const id = `CRYPTO-${String(idCounter++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'crypto-auditor',
              severity: 'medium',
              title: 'HMAC digest truncated to fewer than 128 bits',
              description:
                `The HMAC digest is truncated to ${truncLen} hex characters (${truncLen * 4} bits). NIST recommends at least 128 bits (32 hex chars) for HMAC truncation to prevent brute-force attacks on the tag.`,
              file,
              line: findLineNumber(content, hmacMatch.index),
              category: 'security',
              owasp: 'A02:2021',
              cwe: 328,
            });
          }
        }
      }

      // Custom check: Prototype pollution — spreading request body into an object in route files
      if (isRouteFile(file)) {
        const protoPatterns = [
          /Object\.assign\(\s*\{\}\s*,.*body\)/g,
          /\{\s*\.\.\.body\s*[,}]/g,
        ];
        for (const protoRe of protoPatterns) {
          let protoMatch: RegExpExecArray | null;
          while ((protoMatch = protoRe.exec(content)) !== null) {
            const id = `CRYPTO-${String(idCounter++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'crypto-auditor',
              severity: 'high',
              title: 'Potential prototype pollution via request body spreading',
              description:
                'The request body is spread into an object using Object.assign({}, body) or {...body}. If the body contains __proto__ or constructor keys, this can pollute the prototype chain. Validate and whitelist body properties before spreading.',
              file,
              line: findLineNumber(content, protoMatch.index),
              category: 'security',
              owasp: 'A08:2021',
              cwe: 1321,
            });
          }
        }
      }
    }

    return {
      scanner: 'crypto-auditor',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
