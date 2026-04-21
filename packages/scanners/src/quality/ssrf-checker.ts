import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * SSRF Checker — detects fetch/http calls with user-controlled URLs
 * that don't use a safeFetch wrapper or URL validation.
 *
 * OWASP A10:2021 — Server-Side Request Forgery
 */

/** Patterns indicating a potentially unsafe fetch with a variable URL */
const UNSAFE_FETCH_PATTERNS = [
  /fetch\s*\(\s*(?!['"`]https?:\/\/)(\w+)/,                    // fetch(variable) — not a literal URL
  /fetch\s*\(\s*`\$\{([A-Za-z_]\w*)/,                          // fetch(`${var}...`) — capture host-var
  /fetch\s*\(\s*new\s+URL\s*\(\s*(?!['"`])\w+/,                // fetch(new URL(variable...))
  /axios\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*(?!['"`]https?:\/\/)(\w+)/, // axios.get(variable)
  /got\s*\(\s*(?!['"`]https?:\/\/)(\w+)/,                       // got(variable)
  /http\.request\s*\(\s*(?!['"`]https?:\/\/)(\w+)/,             // http.request(variable)
];

/** Safe patterns — if present, the file handles SSRF properly */
const SAFE_PATTERNS = [
  /safeFetch/,                    // Custom SSRF-safe wrapper
  /isAllowedUrl/,                 // URL allowlist check
  /isValidUrl/,                   // URL validation
  /allowedHosts/,                 // Host allowlist
  /ALLOWED_HOSTS/,                // Host allowlist constant
  /url\.startsWith\s*\(\s*['"]https?:\/\//,  // Protocol check
  /new\s+URL\s*\([^)]+\)\s*\.hostname/,       // Hostname extraction for validation
  // v0.11 Cluster B (D4): user-defined URL/Host/Origin guard function
  // with explicit `: boolean` return type. Narrow by convention — the
  // name token and the typed return together distinguish a URL guard
  // from generic boolean helpers (e.g. `isAdmin`, `isEnabled`) that
  // don't handle SSRF risk. Paired in taint-analyzer with the
  // consumer-side dominator check; both scanners go silent for the
  // same structural shape.
  /\bfunction\s+\w*(?:Url|URL|Host|Origin)\w*\s*\([^)]+\)\s*:\s*boolean\b/,
];

function shouldSkipFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) ||
    filePath.includes('__tests__/') || filePath.includes('__mocks__/') ||
    filePath.includes('/scripts/') ||
    // Service Workers use fetch(event.request) for caching — not SSRF
    /sw\.(ts|js)$/.test(filePath) ||
    /service[-_]?worker\.(ts|js)$/.test(filePath);
}

/**
 * v0.11 Z4 — library wrapper heuristic.
 *
 * Returns true when `fetch(varName, …)` is inside an enclosing function
 * whose parameter list contains `varName`. That is the shape of a
 * library HTTP wrapper:
 *
 *   async function apiFetch(url: string, opts?) {
 *     return fetch(url, opts);       // ← varName = 'url' is a parameter
 *   }
 *
 * The wrapper itself is not a CWE-918 risk — any SSRF exposure materialises
 * at the consumer's call site where user input may reach `url`. The
 * taint-analyzer catches that cross-file flow; ssrf-checker firing on the
 * wrapper produces noise.
 *
 * v0.11.x FP #1: the original v0.11 heuristic required `export` before the
 * function keyword. Real-world codebases frequently structure wrappers as
 * non-exported internal helpers (`apiFetch`) called from exported wrappers
 * (`apiGet`/`apiPost`). The SSRF reasoning is identical — the wrapper
 * itself has no user input, the call site does. Dropping the `export`
 * gate covers the internal-helper case without expanding risk.
 *
 * Regex approximation (no AST): find an `(async )? function` declaration
 * whose parameter list contains `varName`, starting BEFORE the fetch. The
 * nearest-preceding declaration is treated as the enclosing function. The
 * `[^)]*` capture prevents body-bleed from the pre-tighten `[\s\S]*?`
 * shape (the Z4 Day-1 lesson that over-silenced true positives).
 */
function isWrapperParameterFetch(
  content: string,
  matchIndex: number,
  varName: string,
): boolean {
  if (!varName) return false;
  const before = content.slice(0, matchIndex);
  // Capture the parameter lists of every `(async )? function <name>(…)`
  // declaration before the fetch. Covers both exported and non-exported
  // wrappers (v0.11.x FP #1 widening).
  // `\w+[^(]*\(` tolerates TypeScript generics between the name and
  // the opening paren — `function apiFetch<T>(url)` is a common real-
  // world shape the original Day-1 regex missed (the `\w+\s*\(` form
  // expected literal whitespace between the name and `(`, no generic).
  const wrapperRe = /(?:^|\n|\s|;)(?:export\s+)?(?:async\s+)?function\s+\w+[^(]*\(([^)]*)\)/g;
  let lastParams: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = wrapperRe.exec(before)) !== null) {
    lastParams = m[1];
  }
  if (lastParams === null) return false;
  const varBoundary = new RegExp(`\\b${varName}\\b`);
  return varBoundary.test(lastParams);
}

/**
 * v0.11.x FP #2 — env-assigned-host heuristic.
 *
 * Suppresses `fetch(\`${X}/...\`)` when X is assigned from `process.env`
 * somewhere in the same file:
 *
 *   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
 *   // …
 *   const res = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, …);
 *
 * Env-loaded hosts are config-fixed at deployment time and not user-
 * controllable, so the SSRF concern doesn't apply — the template-
 * literal regex otherwise fires on every such shape (dominant idiom
 * in Next.js + Supabase codebases). Destructure-from-env is out of
 * scope for v0.11.x and will still emit (conservative).
 *
 * Also accepts the `??` / `||` fallback shape commonly seen in config
 * modules: `const X = process.env.Y ?? 'default-host'`.
 */
function isTemplateEnvHostFetch(content: string, varName: string): boolean {
  if (!varName) return false;
  const envRe = new RegExp(
    `\\b(?:const|let|var)\\s+${varName}\\b[^;\\n=]*=\\s*process\\.env\\.`,
  );
  return envRe.test(content);
}

function findLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export const ssrfCheckerScanner: Scanner = {
  name: 'ssrf-checker',
  description: 'Detects fetch/HTTP calls with user-controlled URLs without SSRF protection (OWASP A10)',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const ignore = [...new Set([...['node_modules', 'dist', '.next', '.git'], ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'js']);

    for (const file of files) {
      if (shouldSkipFile(file)) continue;
      if (file.includes('/scripts/')) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // Skip files that have SSRF protection
      if (SAFE_PATTERNS.some((p) => p.test(content))) continue;

      for (const pattern of UNSAFE_FETCH_PATTERNS) {
        const re = new RegExp(pattern.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          // Skip if the variable is a well-known safe source
          const matchedVar = match[1] ?? '';
          if (['undefined', 'null', 'true', 'false'].includes(matchedVar)) continue;

          // Skip if the variable is assigned a string literal (const url = 'https://...')
          if (matchedVar) {
            const constAssignPattern = new RegExp(
              `(?:const|let)\\s+${matchedVar}\\s*=\\s*['"\`]https?://`,
            );
            if (constAssignPattern.test(content)) continue;
          }

          // v0.11 Z4 + v0.11.x FP #1: skip fetch() when the URL is a
          // parameter of any enclosing function (library-wrapper shape
          // — exported or internal helper). See `isWrapperParameterFetch`
          // for the full rationale + widening history.
          if (matchedVar && isWrapperParameterFetch(content, match.index, matchedVar)) {
            continue;
          }

          // v0.11.x FP #2: skip template-literal fetch when the host
          // variable is assigned from process.env in this file — env-
          // loaded hosts are config-fixed at deployment, not user-
          // controllable.
          if (matchedVar && isTemplateEnvHostFetch(content, matchedVar)) {
            continue;
          }

          const id = `SSRF-${String(idCounter.value++).padStart(3, '0')}`;
          // v0.15.4 D-N-002 — include the matched HTTP-client call in the
          // title so reports distinguish fetch(url) / axios.get(url) /
          // got(url) / http.request(url) patterns rather than repeating
          // a single generic string for every finding.
          const matchedCall = match[0].slice(0, 60).replace(/\s+/g, ' ').trim();
          findings.push({
            id,
            scanner: 'ssrf-checker',
            severity: 'high',
            title: `SSRF-class pattern — variable URL in HTTP call: ${matchedCall}`,
            description:
              'An HTTP client is called with a variable URL rather than a hardcoded string. If this URL originates from user input, an attacker can force the server to make requests to internal services (cloud metadata, databases, admin panels). Use a safeFetch wrapper with URL allowlisting.',
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A10:2021',
            cwe: 918,
            fix: {
              description:
                'Wrap the outbound call in a safeFetch helper that validates the URL against an allowlist, blocks private-IP and loopback ranges, enforces HTTPS, caps redirects, and sets a request timeout. Never let user input reach the raw HTTP client.',
              code: 'const res = await safeFetch(url, { allowHosts: ALLOW_HOSTS, timeoutMs: 5000 });',
              links: [
                'https://cwe.mitre.org/data/definitions/918.html',
                'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/',
              ],
            },
          });
          break; // One finding per file per pattern is enough
        }
      }
    }

    return {
      scanner: 'ssrf-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
