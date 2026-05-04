import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * JWT-in-localStorage Checker — detects browser-side storage of JWT
 * access-tokens, refresh-tokens, or session-IDs in localStorage or
 * sessionStorage. JS-readable storage means any XSS = full token
 * theft = account takeover.
 *
 * v0.18.2 F-JWT-LOCALSTORAGE-1 — derived from a real-world audit
 * 2026-05-04 finding: a pilot crypto-trading product stored both
 * `ne_token` (access JWT) and `ne_refresh` (refresh JWT) in
 * localStorage with no Content-Security-Policy header. A single
 * XSS would chain to a 30-day account takeover (refresh-token
 * exp = 30d, no rotation-on-use).
 *
 * Best-practice for token storage:
 *   - refresh-token: HttpOnly + Secure + SameSite=Strict cookie
 *     (JS cannot read; XSS cannot exfiltrate)
 *   - access-token: in-memory only (React context / closure)
 *     accepting the small UX cost of re-refresh on tab open
 *
 * OWASP A02:2021 — Cryptographic Failures
 * CWE-922 — Insecure Storage of Sensitive Information
 *
 * Detection:
 *   1. localStorage.setItem(<key>, ...) or sessionStorage.setItem(<key>, ...)
 *   2. <key> normalises (camelCase / kebab → snake) to a token-like name:
 *      - *_token suffix (ne_token, auth_token, access_token, refresh_token)
 *      - jwt or *_jwt as discrete word
 *      - bearer or *_bearer as discrete word
 *      - session_id / sessionid / sessionId
 *      - *_refresh suffix (catches `ne_refresh`-style refresh-token keys)
 *
 * Conservative-by-design — matches only keys whose tokenized form
 * contains an unambiguous token-suggesting word. `tokenBalance` /
 * `refreshButton` / `theme` / `language` / `user_preferences` do
 * NOT fire. The dominant FP class accepted is `*_refresh` UI-state
 * keys (e.g. `auto_refresh`); reviewer can suppress per-line.
 */

function shouldSkipFile(filePath: string): boolean {
  if (isTestFile(filePath)) return true;
  return (
    filePath.includes('/vendor/') ||
    filePath.includes('.min.js') ||
    filePath.includes('/generated/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('/node_modules/') ||
    filePath.includes('/dist/') ||
    filePath.includes('/build/')
  );
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Capture every (?:local|session)Storage.setItem("<key>", ...) call. */
const STORAGE_SETITEM_RE =
  /(?<storage>localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*(?<quote>["'`])(?<key>[^"'`]+)\k<quote>/g;

/**
 * Decide if a storage-key looks like a token / JWT / session-id
 * after camelCase + kebab → snake normalisation.
 */
function isTokenLikeKey(key: string): boolean {
  // camelCase → snake_case + kebab → snake
  const norm = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
  return [
    /(?:^|_)token$/, // *_token suffix (ne_token, auth_token, refresh_token, access_token, id_token)
    /^token$/, // bare 'token'
    /(?:^|_)jwt(?:_|$)/, // jwt as discrete word
    /(?:^|_)bearer(?:_|$)/, // bearer as discrete word
    /(?:^|_)session_?id$/, // session_id / sessionid (camelCase post-norm)
    /(?:^|_)refresh$/, // *_refresh suffix (catches `ne_refresh`-style keys)
    /(?:^|_)(?:access|refresh|id|auth|bearer)_?token(?:_|$)/, // explicit *_token combos
  ].some((re) => re.test(norm));
}

export const jwtLocalstorageCheckerScanner: Scanner = {
  name: 'jwt-localstorage-checker',
  description:
    'Detects JWT / refresh-token / session-ID storage in localStorage or sessionStorage (XSS-readable; should be HttpOnly cookie or in-memory).',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    const files = walkFiles(
      projectPath,
      ['node_modules', '.git', '.next', 'dist', 'build', 'coverage'],
      ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    );

    for (const file of files) {
      if (shouldSkipFile(file)) continue;
      const content = readFileSafe(file);
      if (!content) continue;
      if (!content.includes('Storage.setItem') && !content.includes('localStorage') && !content.includes('sessionStorage')) {
        continue; // fast-skip: file doesn't mention storage at all
      }

      // Reset regex state per-file (global flag)
      STORAGE_SETITEM_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = STORAGE_SETITEM_RE.exec(content)) !== null) {
        const key = m.groups?.key ?? '';
        const storage = m.groups?.storage ?? 'localStorage';
        if (!isTokenLikeKey(key)) continue;

        const line = findLineNumber(content, m.index);
        const id = `JWTLS-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'jwt-localstorage-checker',
          category: 'security',
          severity: 'high',
          title: `JWT/token stored in ${storage}: "${key}"`,
          description:
            `${storage}.setItem("${key}", ...) ships a JWT/token/session-ID into JS-readable browser storage. ` +
            `Any XSS on this origin can read it via \`${storage}.getItem("${key}")\` and exfiltrate. ` +
            `Combined with a missing or weak Content-Security-Policy, a single reflected/stored/DOM XSS becomes complete account takeover. ` +
            `If this is a refresh-token, the replay-window is the entire refresh-exp (often days to months) — much worse than an access-token compromise. ` +
            `Best practice: refresh-tokens go in HttpOnly + Secure + SameSite=Strict cookies (JS cannot read; XSS cannot exfil). ` +
            `Access-tokens go in memory only (React context / closure variable) — accept the small UX cost of re-fetching on tab open. ` +
            `If this storage call is for a non-token value that happens to use a token-suggesting key name, suppress this finding inline with a justification comment.`,
          file,
          line,
          owasp: 'A02:2021',
          cwe: 922,
          fix: {
            description:
              `Move the token out of ${storage}. For refresh-tokens: have the backend set an \`HttpOnly; Secure; SameSite=Strict\` cookie on /auth/login and /auth/refresh; remove this client-side ${storage}.setItem call. For access-tokens: keep in a React context / module-level variable; clear on tab close; refresh on tab open.`,
            links: [
              'https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage',
              'https://owasp.org/www-community/HttpOnly',
            ],
          },
        });
      }
    }

    return {
      scanner: 'jwt-localstorage-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
