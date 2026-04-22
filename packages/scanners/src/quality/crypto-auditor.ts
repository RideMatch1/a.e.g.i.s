import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — dynamic-evaluation in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — dynamic-evaluation in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

const SECURITY_DIRS = ['api', 'lib', 'utils', 'services'];

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
  fix?: Finding['fix'];
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
  fix?: Finding['fix'];
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
    fix: {
      description:
        'Set httpOnly, secure, and sameSite on every session/auth cookie. httpOnly blocks document.cookie reads from XSS, secure forces HTTPS-only transmission, and sameSite blocks cross-site CSRF attempts on top-level navigations.',
      code: "res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'lax' });",
      links: [
        'https://cwe.mitre.org/data/definitions/614.html',
        'https://owasp.org/www-community/controls/SecureCookieAttribute',
      ],
    },
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
    fix: {
      description:
        'Math.random() uses a non-cryptographic PRNG seeded from time; its output is trivially predictable and unusable for tokens, session IDs, or any secret derivation. Pull from the platform CSPRNG: crypto.randomUUID() for identifiers, crypto.randomBytes(N) or crypto.getRandomValues() for raw random bytes.',
      code: "import { randomUUID, randomBytes } from 'node:crypto';\nconst token = randomUUID();\nconst raw = randomBytes(32);",
      links: [
        'https://cwe.mitre.org/data/definitions/338.html',
        'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
      ],
    },
  },
  {
    pattern: /createHash\(['"`]md5['"`]\)|createHash\(['"`]sha1['"`]\)/,
    severity: 'medium',
    title: 'Weak hash algorithm',
    description:
      'MD5 and SHA-1 are cryptographically broken and should not be used for security purposes. Use SHA-256 or SHA-3 instead.',
    owasp: 'A02:2021',
    cwe: 327,
    fix: {
      description:
        'Both MD5 and SHA-1 have practical collision attacks and must not be used for integrity, signing, or password storage. Replace with SHA-256 (or SHA-3 variants for new code). For password hashing, use a memory-hard KDF like bcrypt, argon2, or scrypt instead of a plain hash.',
      code: "import { createHash } from 'node:crypto';\nconst digest = createHash('sha256').update(data).digest('hex');",
      links: [
        'https://cwe.mitre.org/data/definitions/327.html',
        'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
      ],
    },
  },
  {
    pattern: /createHash\(['"`]sha256['"`]\)/,
    severity: 'low',
    title: 'Consider HMAC for token generation',
    description:
      'createHash(sha256) without a nearby createHmac may indicate plain hashing where an HMAC (keyed hash) would be more appropriate for token/MAC generation.',
    owasp: 'A02:2021',
    cwe: 327,
    fix: {
      description:
        'If the hash is used as a message authentication code or token, switch to an HMAC with a secret key — a plain SHA-256 digest is forgeable by anyone who can compute the same hash. Use createHmac for MAC verification and timing-safe comparison for the check.',
      code: "import { createHmac, timingSafeEqual } from 'node:crypto';\nconst mac = createHmac('sha256', secret).update(data).digest();",
      links: [
        'https://cwe.mitre.org/data/definitions/327.html',
        'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
      ],
    },
  },
  {
    pattern: /['"]sk_live_[A-Za-z0-9]+['"]/,
    severity: 'blocker',
    title: 'Hardcoded LIVE API key',
    description:
      'A hardcoded Stripe LIVE API key (sk_live_*) was found in source code. Remove it immediately and rotate the key. Use environment variables.',
    owasp: 'A02:2021',
    cwe: 798,
    fix: {
      description:
        'Rotate the key in the Stripe dashboard right now — the leaked key is compromised regardless of whether this repository is public. Then scrub it from git history (git-filter-repo or BFG), move the new key to a secrets manager or environment variable, and add the variable to a pre-commit hook (gitleaks / trufflehog) to prevent recurrence. Load the new key from process.env server-side only; never inline the literal.',
      links: [
        'https://cwe.mitre.org/data/definitions/798.html',
        'https://stripe.com/docs/keys',
      ],
    },
  },
  {
    pattern: /['"]sk_test_[A-Za-z0-9]+['"]/,
    severity: 'high',
    title: 'Hardcoded test API key',
    description:
      'A hardcoded Stripe test API key (sk_test_*) was found outside of test files. Use environment variables instead.',
    owasp: 'A02:2021',
    cwe: 798,
    fix: {
      description:
        'Even sk_test_ keys should not live in source — they leak into git history and scaffold tarballs, and they make it easy to paste the wrong key (sk_live_) in the same spot later. Move the value to process.env and load it from .env.local (gitignored) or a secrets manager in CI. Read it server-side only; never inline the literal.',
      links: [
        'https://cwe.mitre.org/data/definitions/798.html',
        'https://stripe.com/docs/keys',
      ],
    },
  },
  {
    // \beval\b: word boundaries exclude evalite/evaluate.
    // No \s* between eval and (: eliminates comment-prose FPs ("run eval (watch mode)").
    // (?<!\.): negative lookbehind excludes method calls (redis.eval, someLib.eval)
    // which are NOT JavaScript's code-injection eval().
    pattern: /(?<!\.)\beval\b\(\s*[^'"`\s)]/,
    severity: 'blocker',
    title: 'Code injection risk — eval with dynamic input',
    description:
      'eval() is called with a variable or expression (not a string literal). This is a critical code injection vector. Remove it entirely or replace with a safe alternative.',
    owasp: 'A03:2021',
    cwe: 95,
    fix: {
      description:
        'Eval with dynamic input is a direct RCE if any part of the string comes from a request, file, or other untrusted source. Identify what the eval is actually trying to do and replace it: JSON input → JSON.parse; dynamic module import → import() or require() with an allowlist; expression evaluation → a sandboxed AST-walker or a DSL-parser. Never eval user input.',
      code: "const config = JSON.parse(userInput); // not eval(userInput)",
      links: [
        'https://cwe.mitre.org/data/definitions/95.html',
        'https://owasp.org/Top10/A03_2021-Injection/',
      ],
    },
  },
  {
    pattern: /(?<!\.)\beval\b\(\s*['"`]/,
    severity: 'high',
    title: 'eval() with string literal',
    description:
      'eval() is called with a hardcoded string. While not directly exploitable, eval() should be avoided entirely. Consider using dynamic import() or conditional require() instead.',
    owasp: 'A03:2021',
    cwe: 95,
    fix: {
      description:
        'Even with a literal string, eval is a maintenance liability — it bypasses the type checker and the bundler, prevents dead-code elimination, and invites a later refactor to splice in a variable. Replace with the direct equivalent: an eval of a module-require becomes a native dynamic import; an eval of an object-literal becomes the object directly or a JSON.parse on the string.',
      links: [
        'https://cwe.mitre.org/data/definitions/95.html',
        'https://owasp.org/Top10/A03_2021-Injection/',
      ],
    },
  },
  {
    pattern: /[jJ][wW][tT]\.sign\s*\(/,
    severity: 'medium',
    title: 'JWT sign without explicit algorithm verification',
    description:
      'jwt.sign() or JWT.sign() was found. Some JWT libraries default to "none" or a weak algorithm when no explicit algorithm is specified. Always pass an explicit algorithm option (e.g. { algorithm: "HS256" }) to prevent algorithm confusion attacks.',
    owasp: 'A02:2021',
    cwe: 327,
    fix: {
      description:
        'Pass an explicit algorithm option on both sign and verify paths so the library cannot fall back to a weaker default. On verify, enforce an algorithms allowlist (e.g. HS256 only) to prevent algorithm-confusion attacks where an attacker forges an HS256-signed token that gets verified with the RS256 public key as the HMAC secret. Always include an expiresIn/exp on sign so leaked tokens have a blast-radius bound.',
      links: [
        'https://cwe.mitre.org/data/definitions/327.html',
        'https://www.rfc-editor.org/rfc/rfc8725',
      ],
    },
  },
  {
    pattern: /Buffer\.from\s*\(\s*['"][^'"]{1,31}['"]\s*,\s*['"]base64['"]\)/,
    severity: 'medium',
    title: 'Short Base64 secret in Buffer.from()',
    description:
      'Buffer.from() is called with a short string literal (< 32 chars) as a Base64 secret. Short secrets are vulnerable to brute-force attacks. Use at least 256 bits (32 bytes) of entropy for cryptographic keys.',
    owasp: 'A02:2021',
    cwe: 327,
    fix: {
      description:
        'Keys below 256 bits (32 random bytes, ~44 Base64 chars) are within reach of modern brute-force if ciphertext leaks. Generate a fresh key with crypto.randomBytes(32).toString("base64"), move it to an environment variable, and rotate any key that was ever checked in.',
      code: "const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64'); // 32+ bytes",
      links: [
        'https://cwe.mitre.org/data/definitions/327.html',
        'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
      ],
    },
  },
  {
    pattern: /createHmac\s*\([^)]*,\s*process\.env\./,
    severity: 'medium',
    title: 'Environment variable used directly as HMAC key',
    description:
      'process.env.* is used directly as an HMAC key without hashing first. Environment variables may have low entropy or predictable formats. Derive a proper key using HKDF, PBKDF2, or at minimum hash the env var before using it as an HMAC key.',
    owasp: 'A02:2021',
    cwe: 327,
    fix: {
      description:
        'If the env var is already cryptographically random (32+ bytes from /dev/urandom, generated via openssl rand), this is a style issue; if it is a human-typed password or low-entropy string, derive a proper key first. HKDF (hkdfSync) is preferred for pre-shared secrets; PBKDF2 or scrypt for password-derived keys.',
      code: "import { hkdfSync } from 'node:crypto';\nconst key = Buffer.from(hkdfSync('sha256', process.env.HMAC_SECRET, '', 'app/v1/hmac', 32));",
      links: [
        'https://cwe.mitre.org/data/definitions/327.html',
        'https://www.rfc-editor.org/rfc/rfc5869',
      ],
    },
  },
  {
    pattern: /algorithm['":\s]*['"]?none['"]?|alg['":\s]*['"]?none['"]?|verify\s*:\s*false|algorithms\s*:\s*\[.*['"]none['"]/i,
    severity: 'blocker',
    title: "JWT 'none' algorithm vulnerability",
    description:
      "JWT 'none' algorithm or verify: false detected. This allows attackers to forge tokens without any signature. Always enforce a specific algorithm (HS256, RS256) and never disable verification.",
    owasp: 'A02:2021',
    cwe: 327,
    fix: {
      description:
        "The null-algorithm bypass (and verify: false) lets an attacker forge any token by stripping the signature — this is the canonical JWT forgery. Pin a specific algorithm on both sign and verify paths, and never read the algorithm from the token header. For public-key verification use RS256 or EdDSA with an explicit allowlist.",
      links: [
        'https://cwe.mitre.org/data/definitions/327.html',
        'https://www.rfc-editor.org/rfc/rfc8725#section-3.1',
      ],
    },
  },
  {
    pattern: /session[_-]?secret\s*[:=]\s*['"][^'"]{1,30}['"]/i,
    severity: 'high',
    title: 'Hardcoded session secret',
    description:
      'A hardcoded session secret was found in source code. Session secrets must be loaded from environment variables or a secrets manager. Hardcoded secrets are visible to anyone with code access and cannot be rotated without redeployment.',
    owasp: 'A02:2021',
    cwe: 798,
    fix: {
      description:
        'Rotate the secret (any leaked session secret allows forging session cookies for every user), move it to an environment variable or secrets manager, and generate a fresh 32-byte random value for the new secret. In multi-instance deployments the secret must be shared across instances — fetch it once at boot, not per request.',
      code: "const sessionSecret = process.env.SESSION_SECRET; // generated via: openssl rand -base64 32",
      links: [
        'https://cwe.mitre.org/data/definitions/798.html',
        'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
      ],
    },
  },
  {
    pattern: /Content-Disposition[^;]*\$\{/,
    severity: 'high',
    title: 'Content-Disposition header with user input (template literal)',
    description:
      'A Content-Disposition header is constructed using template literal interpolation. If user-controlled input flows into this header, an attacker can inject CRLF sequences to split the HTTP response and inject arbitrary headers or body content.',
    owasp: 'A03:2021',
    cwe: 113,
    fix: {
      description:
        'Sanitize the filename before interpolating: strip CR (\\r), LF (\\n), quotes, and any non-ASCII bytes, then wrap in RFC 6266 quoted-string or filename* encoded form. Most frameworks have a helper (express.res.attachment, Next.js Response headers builder) that does this correctly — prefer that over hand-rolled string templates.',
      code: "const safe = filename.replace(/[\\r\\n\"']/g, '_');\nres.setHeader('Content-Disposition', `attachment; filename=\"${safe}\"`);",
      links: [
        'https://cwe.mitre.org/data/definitions/113.html',
        'https://www.rfc-editor.org/rfc/rfc6266',
      ],
    },
  },
  {
    pattern: /Content-Disposition[^;]*\+\s*\w+/,
    severity: 'high',
    title: 'Content-Disposition header with string concatenation',
    description:
      'A Content-Disposition header is constructed using string concatenation with a variable. If user-controlled input flows into this header, an attacker can inject CRLF sequences for HTTP response splitting.',
    owasp: 'A03:2021',
    cwe: 113,
    fix: {
      description:
        'Same mitigation as the template-literal variant — strip CRLF, quotes, and non-ASCII from the filename before concatenation. Prefer the framework builder (res.attachment, NextResponse header setter) which handles the RFC 6266 escaping automatically.',
      code: "const safe = filename.replace(/[\\r\\n\"']/g, '_');\nres.setHeader('Content-Disposition', 'attachment; filename=\"' + safe + '\"');",
      links: [
        'https://cwe.mitre.org/data/definitions/113.html',
        'https://www.rfc-editor.org/rfc/rfc6266',
      ],
    },
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
            ...(rule.fix ? { fix: rule.fix } : {}),
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
            ...(rule.fix ? { fix: rule.fix } : {}),
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
              ...(rule.fix ? { fix: rule.fix } : {}),
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
              fix: {
                description:
                  'Truncating an HMAC below 128 bits shrinks the forgery-probability budget below NIST SP 800-107 guidance. Either keep the full digest or truncate to 32 hex chars (128 bits) minimum; for CSRF/audit tokens 16 bytes (32 hex) is the standard.',
                code: "const tag = hmac.digest('hex').slice(0, 32); // 128 bits — NIST minimum",
                links: [
                  'https://cwe.mitre.org/data/definitions/328.html',
                  'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf',
                ],
              },
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
              fix: {
                description:
                  'Parse the body through a schema (Zod, Yup, Ajv) that rejects unknown keys, then read only the allowlisted fields into the target object. Schema validation blocks __proto__ / constructor / prototype injection at the boundary instead of relying on downstream spread-hygiene.',
                code: "const parsed = BodySchema.strict().parse(body); // throws on unknown keys\nconst record = { id: parsed.id, name: parsed.name };",
                links: [
                  'https://cwe.mitre.org/data/definitions/1321.html',
                  'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/',
                ],
              },
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
