import { existsSync } from 'fs';
import { readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Middleware Auth Checker — detects Next.js middleware.ts that performs
 * authentication without mitigating CVE-2025-29927.
 *
 * CVE-2025-29927 (Next.js middleware auth bypass, March 2025):
 *   An attacker-supplied `x-middleware-subrequest` HTTP header caused the
 *   Next.js runtime to skip middleware execution entirely, bypassing any
 *   auth / redirect / rewrite logic implemented there. Patched in
 *   Next.js 15.2.3 / 14.2.25 / 13.5.9 / 12.3.5 by stripping the header
 *   before request dispatch.
 *
 *   For app-authors on older Next.js versions, or for defense-in-depth
 *   on any version, explicitly guarding the header in middleware code
 *   is the mitigation.
 *
 * OWASP A07:2021 — Identification and Authentication Failures
 * CWE-285 — Improper Authorization (the bypass elevates
 *           attacker-controlled requests past the auth gate)
 *
 * Scanner scope:
 *   - middleware.{ts,js} at project root or under `src/`
 *   - Emits when the file contains recognised auth logic AND does NOT
 *     contain an explicit x-middleware-subrequest guard.
 *   - Does NOT attempt to parse package.json for the Next.js version.
 *     Version check is explicitly out of scope (users upgrade on their
 *     own cadence); the explicit-guard approach is the robust,
 *     version-agnostic mitigation.
 */

/** Auth-related patterns inside middleware.ts — mirror of
 *  MIDDLEWARE_AUTH_PATTERNS in auth-enforcer. */
const MIDDLEWARE_AUTH_PATTERNS: readonly RegExp[] = [
  /\bgetToken\s*\(/,
  /\bwithAuth\s*\(/,
  /\bauth\s*\(\s*\)/,
  /NextAuth\b/,
  /\bclerkMiddleware\s*\(/,
  /\bauthMiddleware\s*\(/,
  // Both getSession and getServerSession (next-auth has both; v14+
  // app router uses the latter). Word-boundary before, substring-
  // match after to cover both names.
  /\bget(?:Server)?Session\s*\(/,
  /\bctx\.(?:session|user)\b/,
  /session\??\.user/,
];

/** Patterns that indicate the author explicitly handles the CVE's
 *  header. Any of these satisfies the check.
 *
 *  IMPORTANT: all patterns require code shape (quoted header literal or
 *  specific API call or helper-name call). A loose word-match like
 *  `/x[-_]middleware[-_]subrequest/i` was tried and dropped — it
 *  matched prose in docstrings ("// this middleware does not handle
 *  x-middleware-subrequest") and self-suppressed findings on files
 *  whose authors KNOW about the CVE but haven't actually implemented
 *  the guard. Prose awareness ≠ code mitigation. */
const SUBREQUEST_GUARD_PATTERNS: readonly RegExp[] = [
  // Header API call shape with the header name as argument — all
  // three quote styles. This is the code mitigation shape; prose
  // mentions of the header in comments never reach this pattern
  // because they aren't inside `headers.get()` / .has() / .delete().
  /headers\s*\.\s*(?:get|has|delete)\s*\(\s*['"`]x-middleware-subrequest['"`]/i,
  // Call to a recognised strip / reject helper by name.
  /\b(?:stripSubrequestHeader|rejectSubrequest|blockMiddlewareBypass)\s*\(/,
];

const CANDIDATE_PATHS = [
  'middleware.ts',
  'middleware.js',
  'src/middleware.ts',
  'src/middleware.js',
];

export const middlewareAuthCheckerScanner: Scanner = {
  name: 'middleware-auth-checker',
  description:
    'Detects Next.js middleware.ts with auth logic missing CVE-2025-29927 `x-middleware-subrequest` guard (CWE-285)',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    for (const rel of CANDIDATE_PATHS) {
      const absPath = `${projectPath}/${rel}`;
      if (!existsSync(absPath)) continue;

      const content = readFileSafe(absPath);
      if (content === null) continue;

      const hasAuthLogic = MIDDLEWARE_AUTH_PATTERNS.some((p) => p.test(content));
      if (!hasAuthLogic) continue;

      const hasGuard = SUBREQUEST_GUARD_PATTERNS.some((p) => p.test(content));
      if (hasGuard) continue;

      const id = `MWAUTH-${String(idCounter++).padStart(3, '0')}`;
      findings.push({
        id,
        scanner: 'middleware-auth-checker',
        severity: 'high',
        title:
          'Next.js middleware performs auth without CVE-2025-29927 mitigation',
        description:
          'This middleware.ts file performs authentication checks (getToken / withAuth / auth() / getSession / etc.) but contains no explicit defense against the `x-middleware-subrequest` header exploit (CVE-2025-29927, March 2025). An attacker supplying that header on older Next.js versions (pre-15.2.3 / 14.2.25 / 13.5.9 / 12.3.5) causes the runtime to skip middleware entirely, bypassing all auth gates. Mitigations (any of): (a) upgrade Next.js to the patched minor, (b) add `if (req.headers.get("x-middleware-subrequest")) return new NextResponse("forbidden", {status: 403})` at the top of the middleware function, (c) strip the header at the edge / CDN before it reaches Next.js. Pick the one your deployment model supports.',
        file: absPath,
        line: 1,
        fileLevel: true,
        category: 'security',
        owasp: 'A07:2021',
        cwe: 285,
      });
    }

    return {
      scanner: 'middleware-auth-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
