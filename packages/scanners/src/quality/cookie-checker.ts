import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/** Test files — intentional patterns, not real issues */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

function isTestContent(content: string): boolean {
  return /describe\s*\(|it\s*\(|expect\s*\(|beforeEach\s*\(/.test(content);
}

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

/** Checks whether a cookie-setting code block contains the given flag (case-insensitive). */
function hasFlag(block: string, flag: string): boolean {
  return new RegExp(flag, 'i').test(block);
}

/**
 * Extracts a window of lines around a match to inspect nearby flags.
 * Looks ±5 lines from the match index.
 */
function extractContext(content: string, matchIndex: number, lineRadius = 5): string {
  const lines = content.split('\n');
  const line = content.slice(0, matchIndex).split('\n').length - 1;
  const start = Math.max(0, line - lineRadius);
  const end = Math.min(lines.length - 1, line + lineRadius);
  return lines.slice(start, end + 1).join('\n');
}

interface CookieMatch {
  index: number;
  context: string;
  line: number;
  raw: string;
}

/** Find all cookie-setting patterns in file content. */
function findCookieSetters(content: string): CookieMatch[] {
  const matches: CookieMatch[] = [];

  const patterns = [
    // Response.headers.set('Set-Cookie', ...)
    /[Ss]et-[Cc]ookie/g,
    // res.cookie(
    /\bres\.cookie\s*\(/g,
    // response.cookie(
    /\bresponse\.cookie\s*\(/g,
    // cookies().set( / cookieStore.set(
    /\bcookies?\(\s*\)\.set\s*\(/g,
    // new ResponseCookies / NextResponse.cookies
    /\.cookies\.set\s*\(/g,
    // serialize('name', ...)
    /\bcookie\.serialize\s*\(/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const context = extractContext(content, match.index);
      matches.push({
        index: match.index,
        context,
        line: findLineNumber(content, match.index),
        raw: match[0],
      });
    }
  }

  // Deduplicate by line number (a single line may match multiple patterns)
  const seen = new Set<number>();
  return matches.filter((m) => {
    if (seen.has(m.line)) return false;
    seen.add(m.line);
    return true;
  });
}

export const cookieCheckerScanner: Scanner = {
  name: 'cookie-checker',
  description: 'Dedicated cookie security scanner — HttpOnly, Secure, SameSite, prefix, and Max-Age checks',
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
        id: `COOKIE-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'cookie-checker',
        severity,
        title,
        description,
        file,
        line,
        category: 'security',
        owasp: 'A02:2021',
        cwe: 614,
        ...(fix ? { fix } : {}),
      });
    }

    const defaultIgnore = ['node_modules', 'dist', '.next', '.git', 'coverage'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    // Walk route files, middleware, API routes, and server-side code
    const files = walkFiles(
      projectPath,
      ignore,
      ['ts', 'tsx', 'js', 'jsx', 'mjs'],
    );

    for (const file of files) {
      if (isTestFile(file)) continue;

      const content = readFileSafe(file);
      if (!content) continue;

      // Skip files with no cookie-related code at all (fast path)
      if (
        !content.includes('cookie') &&
        !content.includes('Cookie') &&
        !content.includes('Set-Cookie')
      ) continue;

      // Skip test-like files that match test patterns in content
      if (isTestContent(content) && !file.includes('/middleware')) continue;

      const cookieMatches = findCookieSetters(content);

      for (const match of cookieMatches) {
        // Skip request-side cookie operations (internal, not sent to browser)
        if (/request\.cookies\.set|req\.cookies\.set/i.test(match.context)) continue;
        const ctx = match.context;

        // --- Check 1: HttpOnly ---
        if (!hasFlag(ctx, 'httpOnly|http_only|httponly')) {
          addFinding(
            'high',
            'Cookie missing HttpOnly flag',
            'A cookie is set without the HttpOnly flag. Without HttpOnly, JavaScript running on the page (including injected XSS scripts) can read the cookie value via document.cookie, enabling session theft. Add HttpOnly: true to all sensitive cookies.',
            file,
            match.line,
            'Add `httpOnly: true` to the cookie options.',
          );
        }

        // --- Check 2: Secure ---
        if (!hasFlag(ctx, '\\bsecure\\b')) {
          addFinding(
            'high',
            'Cookie missing Secure flag',
            'A cookie is set without the Secure flag. Without Secure, the cookie will be transmitted over plain HTTP connections, making it vulnerable to network interception (man-in-the-middle attacks). Add Secure: true to all cookies in production.',
            file,
            match.line,
            'Add `secure: true` to the cookie options.',
          );
        }

        // --- Check 3: SameSite ---
        const hasSameSite = hasFlag(ctx, 'SameSite|sameSite|same_site|samesite');
        if (!hasSameSite) {
          addFinding(
            'medium',
            'Cookie missing SameSite attribute',
            'A cookie is set without a SameSite attribute. Without SameSite, cookies are sent with cross-site requests, enabling CSRF attacks. Set SameSite to "Strict" or "Lax" for most cookies. Avoid "None" unless the cookie must be sent cross-site, and only with the Secure flag.',
            file,
            match.line,
            'Add `sameSite: "lax"` (or `"strict"`) to the cookie options.',
          );
        } else {
          // SameSite=None requires Secure
          const hasNone = /SameSite\s*[=:]\s*['"]?none['"]?/i.test(ctx) || /sameSite\s*:\s*['"]?none['"]?/i.test(ctx);
          if (hasNone && !hasFlag(ctx, '\\bsecure\\b')) {
            addFinding(
              'high',
              'Cookie has SameSite=None without Secure flag',
              'A cookie is set with SameSite=None but without the Secure flag. Per RFC 6265bis and modern browser requirements, SameSite=None cookies MUST have the Secure attribute. Without it, the browser will reject or ignore the SameSite=None attribute, and the cookie will be sent with cross-site requests over HTTP.',
              file,
              match.line,
              'Add `secure: true` when using `sameSite: "none"`.',
            );
          }
        }

        // --- Check 4: Missing __Host- or __Secure- prefix on session/auth cookies ---
        // Only flag if the cookie name is clearly an auth/session cookie
        const cookieNameMatch = /(?:Set-Cookie[^:]*:\s*|\.cookie\s*\(\s*['"]|\.set\s*\(\s*['"])([^'";\s,]+)/i.exec(ctx);
        if (cookieNameMatch) {
          const cookieName = cookieNameMatch[1];
          const isAuthCookie = /session|auth|token|jwt|sid|id/i.test(cookieName);
          const hasSecurePrefix = cookieName.startsWith('__Host-') || cookieName.startsWith('__Secure-');

          if (isAuthCookie && !hasSecurePrefix) {
            addFinding(
              'low',
              `Auth cookie "${cookieName}" missing __Host- or __Secure- prefix`,
              `The authentication/session cookie "${cookieName}" does not use the __Host- or __Secure- cookie name prefix. These prefixes provide additional protection: __Host- requires Secure, Path=/, and no Domain attribute (preventing subdomain injection). __Secure- requires the Secure flag. Consider renaming to "__Host-${cookieName}" for session cookies that don't need cross-subdomain access.`,
              file,
              match.line,
              `Rename to "__Host-${cookieName}" and ensure Secure, Path=/, no Domain attribute.`,
            );
          }
        }

        // --- Check 5: Session cookies without expiry ---
        const hasMaxAge = hasFlag(ctx, 'maxAge|max-age|max_age|expires|Expires');
        // Only flag cookies that appear to be persistent (not purely session-scoped)
        const isSessionCookieContext = hasFlag(ctx, 'session|Session') && !hasMaxAge;
        if (isSessionCookieContext) {
          addFinding(
            'medium',
            'Session cookie without explicit Max-Age or Expires',
            'A session cookie is set without a Max-Age or Expires attribute. Session cookies without explicit expiry live until the browser is closed, which may be undesirable for security-sensitive sessions. Consider setting a short Max-Age (e.g. 30 minutes for auth tokens) to limit the exposure window if a session is stolen.',
            file,
            match.line,
            'Add `maxAge: 1800` (seconds) or an explicit `expires` date to bound the cookie lifetime.',
          );
        }
      }
    }

    return {
      scanner: 'cookie-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
