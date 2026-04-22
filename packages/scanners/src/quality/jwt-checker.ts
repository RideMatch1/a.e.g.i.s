import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — token-signing in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — token-signing in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

/** Detect whether a file uses a JWT library */
function detectJwtLibrary(content: string): { library: string; hasJwt: boolean } {
  if (/from\s+['"]jsonwebtoken['"]|require\s*\(\s*['"]jsonwebtoken['"]\s*\)/.test(content)) {
    return { library: 'jsonwebtoken', hasJwt: true };
  }
  if (/from\s+['"]jose['"]|require\s*\(\s*['"]jose['"]\s*\)/.test(content)) {
    return { library: 'jose', hasJwt: true };
  }
  if (/from\s+['"]jwt-decode['"]|require\s*\(\s*['"]jwt-decode['"]\s*\)/.test(content)) {
    return { library: 'jwt-decode', hasJwt: true };
  }
  if (/from\s+['"]@auth0\/nextjs-auth0['"]/.test(content)) {
    return { library: '@auth0/nextjs-auth0', hasJwt: true };
  }
  if (/\bjwt\b|\bJWT\b|\bjsonwebtoken\b/.test(content)) {
    return { library: 'unknown', hasJwt: true };
  }
  return { library: '', hasJwt: false };
}

export const jwtCheckerScanner: Scanner = {
  name: 'jwt-checker',
  description: 'Dedicated JWT security analysis — expiry, algorithm, secret strength, and verify vs decode',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    function addFinding(
      severity: Finding['severity'],
      title: string,
      description: string,
      file: string,
      line: number,
      fix?: string,
    ): void {
      findings.push({
        id: `JWT-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'jwt-checker',
        severity,
        title,
        description,
        file,
        line,
        category: 'security',
        owasp: 'A02:2021',
        cwe: 347,
        ...(fix ? { fix } : {}),
      });
    }

    const defaultIgnore = ['node_modules', 'dist', '.next', '.git', 'coverage'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx', 'mjs']);

    for (const file of files) {
      if (isTestFile(file)) continue;

      const content = readFileSafe(file);
      if (!content) continue;

      const { hasJwt, library } = detectJwtLibrary(content);
      if (!hasJwt) continue;

      // -------------------------------------------------------------------
      // Check 1: jwt.sign() without expiresIn / exp claim
      // -------------------------------------------------------------------
      // Pattern: jwt.sign(payload, secret, options?) or jwt.sign(payload, secret)
      const signRe = /(?:jwt|JWT)\.sign\s*\(\s*([^,]+),\s*([^,)]+)(?:,\s*(\{[^}]*\}))?\s*\)/g;
      let signMatch: RegExpExecArray | null;
      while ((signMatch = signRe.exec(content)) !== null) {
        const optionsStr = signMatch[3] ?? '';
        const payloadStr = signMatch[1] ?? '';

        const hasExpiry =
          /expiresIn/i.test(optionsStr) ||
          /\bexp\b/.test(payloadStr) ||
          /expiresIn/i.test(content.slice(Math.max(0, signMatch.index - 100), signMatch.index + signMatch[0].length + 100));

        if (!hasExpiry) {
          addFinding(
            'high',
            'JWT signed without expiry (expiresIn / exp claim)',
            'jwt.sign() is called without an expiresIn option or exp claim. Tokens without expiry are valid indefinitely, meaning a stolen token can never be invalidated short of rotating the secret. Always set a short expiry (e.g. expiresIn: "15m" for access tokens, "7d" for refresh tokens).',
            file,
            findLineNumber(content, signMatch.index),
            'Add `{ expiresIn: "15m" }` as the third argument to jwt.sign().',
          );
        }
      }

      // -------------------------------------------------------------------
      // Check 2: Algorithm not explicitly specified in sign/verify
      // -------------------------------------------------------------------
      const signAlgorithmRe = /(?:jwt|JWT)\.sign\s*\(\s*[^)]+\)/g;
      signAlgorithmRe.lastIndex = 0;
      let algorithmMatch: RegExpExecArray | null;
      while ((algorithmMatch = signAlgorithmRe.exec(content)) !== null) {
        const call = algorithmMatch[0];
        const hasAlgorithm = /algorithm\s*:/i.test(call);
        if (!hasAlgorithm) {
          addFinding(
            'medium',
            'JWT signed without explicit algorithm',
            'jwt.sign() does not specify an explicit algorithm option. Some JWT library versions default to HS256 which is acceptable, but relying on defaults is risky: if the library changes defaults, or if an attacker can influence the algorithm field, tokens could be accepted with a weak or "none" algorithm. Always specify { algorithm: "HS256" } or another approved algorithm explicitly.',
            file,
            findLineNumber(content, algorithmMatch.index),
            'Add `algorithm: "HS256"` to the jwt.sign() options: jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "15m" }).',
          );
        }
      }

      // -------------------------------------------------------------------
      // Check 3: Short secret key (< 32 chars = < 256 bits for HS256)
      // -------------------------------------------------------------------
      // Patterns: jwt.sign(payload, 'short_secret', ...) or jwt.verify(token, 'short_secret', ...)
      const shortSecretRe = /(?:jwt|JWT)\.(?:sign|verify)\s*\(\s*[^,]+,\s*['"]([^'"]{1,31})['"]/g;
      let shortSecretMatch: RegExpExecArray | null;
      while ((shortSecretMatch = shortSecretRe.exec(content)) !== null) {
        const secret = shortSecretMatch[1];
        // Skip if it looks like a variable reference inside the quotes (unlikely but safe check)
        if (secret.includes('${') || secret.includes('process')) continue;
        addFinding(
          'high',
          `JWT secret too short: "${secret.slice(0, 8)}…" (< 256 bits)`,
          `A hardcoded JWT secret shorter than 32 characters (256 bits) was found. Short secrets are vulnerable to brute-force and dictionary attacks. HS256 requires at least 256 bits of key material. Use a randomly generated secret of at least 32 bytes, stored in an environment variable.`,
          file,
          findLineNumber(content, shortSecretMatch.index),
          'Replace with: jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "15m" }) where JWT_SECRET is a 32+ byte random string.',
        );
      }

      // -------------------------------------------------------------------
      // Check 4: jwt.decode() used instead of jwt.verify() for auth decisions
      // -------------------------------------------------------------------
      // decode() doesn't validate the signature — only verify() does
      const decodeRe = /(?:jwt|JWT)\.decode\s*\(/g;
      let decodeMatch: RegExpExecArray | null;
      while ((decodeMatch = decodeRe.exec(content)) !== null) {
        // Check if the same file ALSO calls verify() — if so, decode might be intentional (e.g. reading claims after verify)
        const hasVerifyInFile = /(?:jwt|JWT)\.verify\s*\(/.test(content);

        if (!hasVerifyInFile) {
          addFinding(
            'critical',
            'JWT decoded without signature verification (jwt.decode instead of jwt.verify)',
            'jwt.decode() is called but jwt.verify() is not found in this file. jwt.decode() only base64-decodes the token payload WITHOUT verifying the signature. An attacker can craft arbitrary tokens and they will be accepted. Always use jwt.verify(token, secret) to validate the token signature before trusting any claims in the payload.',
            file,
            findLineNumber(content, decodeMatch.index),
            'Replace jwt.decode(token) with jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }).',
          );
        } else {
          // verify is present but decode is also used — might be loading claims from an already-verified token
          // Flag as low / informational
          addFinding(
            'low',
            'jwt.decode() used alongside jwt.verify() — verify decode is not used for auth decisions',
            'Both jwt.decode() and jwt.verify() are used in this file. While jwt.verify() validates the signature, jwt.decode() does not. Ensure that jwt.decode() is only used on tokens that have already been verified, and that auth decisions are never made based solely on decoded (unverified) claims.',
            file,
            findLineNumber(content, decodeMatch.index),
            'Audit all uses of jwt.decode() to ensure they only operate on previously verified tokens.',
          );
        }
      }

      // -------------------------------------------------------------------
      // Check 5: jose library — SignJWT without setExpirationTime
      // -------------------------------------------------------------------
      if (library === 'jose') {
        const joseSignRe = /new\s+SignJWT\s*\(/g;
        let joseMatch: RegExpExecArray | null;
        while ((joseMatch = joseSignRe.exec(content)) !== null) {
          // Look ahead for .setExpirationTime in the same chain
          const chainWindow = content.slice(joseMatch.index, joseMatch.index + 500);
          const hasExpiry = /setExpirationTime|setIssuedAt.*setExpirationTime/.test(chainWindow);
          if (!hasExpiry) {
            addFinding(
              'high',
              'jose SignJWT without setExpirationTime()',
              'A jose SignJWT is created without calling .setExpirationTime(). Tokens without expiry are valid indefinitely. Call .setExpirationTime("15m") (or appropriate duration) on the SignJWT builder.',
              file,
              findLineNumber(content, joseMatch.index),
              'Add .setExpirationTime("15m") to the SignJWT chain before .sign().',
            );
          }
        }
      }

      // -------------------------------------------------------------------
      // Check 6: algorithms: ['none'] or algorithm: 'none'
      // -------------------------------------------------------------------
      const noneAlgRe = /algorithms?\s*[=:]\s*(?:\[?\s*['"]none['"]\s*\]?)/gi;
      let noneMatch: RegExpExecArray | null;
      while ((noneMatch = noneAlgRe.exec(content)) !== null) {
        addFinding(
          'critical',
          'JWT "none" algorithm explicitly allowed',
          'The JWT "none" algorithm is explicitly set in algorithms or algorithm options. The "none" algorithm means the token has no signature, allowing attackers to forge arbitrary tokens. Remove "none" from the allowed algorithms list entirely.',
          file,
          findLineNumber(content, noneMatch.index),
          'Remove "none" from algorithms array. Use only ["HS256"] or ["RS256"] as appropriate.',
        );
      }
    }

    return {
      scanner: 'jwt-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
