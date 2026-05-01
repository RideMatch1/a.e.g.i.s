import { readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * CSP-strength evaluator. Complements `header-checker` (which flags MISSING
 * CSP) by flagging WEAK CSP policies that fail to mitigate XSS — wildcard
 * hosts, `'unsafe-inline'` without a paired nonce / hash, `'unsafe-eval'`,
 * `http:` origins (TLS-downgrade vector), `data:` / `blob:` in script-src.
 *
 * F-CSP-EVAL-1 (v0.18.0) — scope-capped per advisor 2026-05-01:
 *
 *   1. Source-locations: `next.config.{ts,js,mjs}` + `middleware.{ts,js}`.
 *      Static-only — no live HTTP-response probing (that belongs to siege /
 *      pentest mode). The `<meta http-equiv="Content-Security-Policy">`
 *      vector is intentionally out-of-scope for v0.18.0.
 *   2. Directives: `script-src` (with `default-src` fallback). Other
 *      directives (`style-src`, `img-src`, `frame-ancestors`, `object-src`,
 *      `base-uri`) are out-of-scope for the first cut — adding them is a
 *      bounded follow-up F-target.
 *   3. CSP3 awareness — the FP-trap the advisor flagged:
 *        `'strict-dynamic'` + nonce / hash → CSP3-aware browsers IGNORE
 *        the URL allowlist AND `'unsafe-inline'` (the nonce / hash is the
 *        sole trust anchor). The scanner short-circuits weak-source checks
 *        in this case and only flags `'unsafe-eval'` (still dangerous).
 *      `'unsafe-inline'` paired with a nonce / hash WITHOUT strict-dynamic
 *        is flagged at MEDIUM (CSP3 neutralizes it, pre-CSP3 still loads).
 *
 * The IP behind the rule list is the policy-grading discipline; the JS
 * source from dr34mhacks/XSSNow `js/csp-evaluator.js:66-203` was studied
 * for spec-correct source-matching but not copied — this implementation
 * is AEGIS-original under MIT.
 */

const CONFIG_FILENAMES = [
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs',
  'middleware.ts',
  'middleware.js',
];

interface DirectiveFinding {
  severity: 'high' | 'medium';
  directive: string;
  source: string;
  reason: string;
}

const NONCE_RE = /^'nonce-[A-Za-z0-9+/=_-]+'$/;
const HASH_RE = /^'sha(?:256|384|512)-[A-Za-z0-9+/=]+'$/;

/**
 * Parse a CSP string into a directive map.
 *
 * `default-src 'self'; script-src 'self' 'unsafe-inline'`
 *   → { 'default-src': ["'self'"], 'script-src': ["'self'", "'unsafe-inline'"] }
 */
function parsePolicy(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    directives.set(name, tokens.slice(1));
  }
  return directives;
}

function evaluatePolicy(policy: string): DirectiveFinding[] {
  const findings: DirectiveFinding[] = [];
  const directives = parsePolicy(policy);

  // CSP3 fallback: when `script-src` is absent, `default-src` applies.
  const scriptSrc =
    directives.get('script-src') ?? directives.get('default-src') ?? [];

  const directiveName = directives.has('script-src') ? 'script-src' : 'default-src';

  const hasStrictDynamic = scriptSrc.includes("'strict-dynamic'");
  const hasNonceOrHash = scriptSrc.some(
    (s) => NONCE_RE.test(s) || HASH_RE.test(s),
  );
  const strictDynamicNeutralized = hasStrictDynamic && hasNonceOrHash;

  if (strictDynamicNeutralized) {
    // CSP3-aware modern hardened pattern. Per spec, the URL allowlist +
    // `'unsafe-inline'` are EXPLICITLY IGNORED by the browser when
    // `'strict-dynamic'` is present alongside a nonce or hash. Only flag
    // `'unsafe-eval'` (still dangerous regardless of strict-dynamic).
    if (scriptSrc.includes("'unsafe-eval'")) {
      findings.push({
        severity: 'high',
        directive: directiveName,
        source: "'unsafe-eval'",
        reason:
          "'unsafe-eval' permits eval() / Function() / setTimeout(string) — code-injection sink (still active even with 'strict-dynamic')",
      });
    }
    return findings;
  }

  // Non-strict-dynamic source-by-source evaluation.
  for (const source of scriptSrc) {
    // Wildcard host
    if (source === '*') {
      findings.push({
        severity: 'high',
        directive: directiveName,
        source: '*',
        reason:
          "wildcard '*' permits scripts from ANY host — CSP origin-restriction is fully neutralized",
      });
      continue;
    }
    // 'unsafe-inline' — severity differs based on nonce/hash presence
    if (source === "'unsafe-inline'") {
      if (hasNonceOrHash) {
        findings.push({
          severity: 'medium',
          directive: directiveName,
          source: "'unsafe-inline'",
          reason:
            "'unsafe-inline' is neutralized by the paired nonce / hash in CSP3-aware browsers, but pre-CSP3 browsers / older WebViews still execute every inline script — drop the redundant 'unsafe-inline'",
        });
      } else {
        findings.push({
          severity: 'high',
          directive: directiveName,
          source: "'unsafe-inline'",
          reason:
            "'unsafe-inline' permits inline-script execution with no nonce / hash gate — primary XSS-mitigation bypass",
        });
      }
      continue;
    }
    if (source === "'unsafe-eval'") {
      findings.push({
        severity: 'high',
        directive: directiveName,
        source: "'unsafe-eval'",
        reason:
          "'unsafe-eval' permits eval() / Function() / setTimeout(string) — code-injection sink",
      });
      continue;
    }
    // http: scheme (TLS-downgrade vector)
    if (source === 'http:' || source.startsWith('http://')) {
      findings.push({
        severity: 'high',
        directive: directiveName,
        source,
        reason: `${source} — TLS-stripped origin allows active-network attacker to downgrade the connection and inject arbitrary script`,
      });
      continue;
    }
    // data: / blob: in script-src
    if (source === 'data:' || source === 'blob:') {
      findings.push({
        severity: 'high',
        directive: directiveName,
        source,
        reason: `${source} in script-src bypasses origin restrictions — data:/blob: URI XSS payloads execute`,
      });
      continue;
    }
  }

  return findings;
}

function looksLikeNextJsProject(projectPath: string): boolean {
  for (const c of CONFIG_FILENAMES) {
    if (existsSync(join(projectPath, c))) return true;
  }
  try {
    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSafe(pkgPath) ?? '{}') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const combined = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    return 'next' in combined;
  } catch {
    return false;
  }
}

/**
 * Locate every CSP value-string in source. Matches both canonical shapes:
 *
 *   - Next.js `headers()` array entry:
 *       { key: 'Content-Security-Policy', value: "<policy>" }
 *   - Middleware response-header set:
 *       res.headers.set('Content-Security-Policy', "<policy>")
 *       headers['Content-Security-Policy'] = "<policy>"
 *
 * with single / double / backtick string-quote variants. The non-capturing
 * `(?:value\s*:\s*|,\s*|\]\s*=\s*)` accepts either `value:` (key-value
 * object literal), a bare `,` (function-call positional arg), or `] =`
 * (bracket-assignment). The `[\s\S]{0,400}?` corridor between the key
 * literal and the connector keeps the regex tolerant of formatter
 * variation (line-breaks, trailing comma, inline spread). Bounded at 400
 * chars to keep the lookahead local to one header definition.
 */
const CSP_LOCATOR_RE =
  /['"`]Content-Security-Policy['"`][\s\S]{0,400}?(?:value\s*:\s*|,\s*|\]\s*=\s*)(['"`])([\s\S]*?)\1/gi;

export const cspEvaluatorScanner: Scanner = {
  name: 'csp-evaluator',
  description:
    'Evaluates Content-Security-Policy strength for XSS-mitigation gaps (wildcard hosts, unsafe-inline without nonce, unsafe-eval, http: origins, data:/blob: in script-src). Honors CSP3 strict-dynamic + nonce neutralization.',
  category: 'security',
  isExternal: false,

  async isAvailable(projectPath: string): Promise<boolean> {
    return looksLikeNextJsProject(projectPath);
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    for (const filename of CONFIG_FILENAMES) {
      const filePath = join(projectPath, filename);
      if (!existsSync(filePath)) continue;
      const content = readFileSafe(filePath);
      if (content === null) continue;

      // Reset lastIndex; CSP_LOCATOR_RE is module-level + /g, so prior
      // calls (or repeat scans of the same file across calls) would
      // otherwise leave a stale offset.
      CSP_LOCATOR_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = CSP_LOCATOR_RE.exec(content)) !== null) {
        const policy = match[2];
        const lineNum = content.slice(0, match.index).split('\n').length;
        const directiveFindings = evaluatePolicy(policy);
        for (const df of directiveFindings) {
          const id = `CSP-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'csp-evaluator',
            severity: df.severity,
            title: `Weak CSP ${df.directive}: ${df.source}`,
            description: `${filename} CSP ${df.directive} has ${df.reason}. Policy excerpt: \`${policy.slice(0, 200)}${policy.length > 200 ? '…' : ''}\``,
            file: filePath,
            line: lineNum,
            category: 'security',
            owasp: 'A05:2021',
            cwe: 693,
            fix: {
              description:
                "Replace weak script-src sources with CSP3 hardening: 'strict-dynamic' + 'nonce-{random}' (or 'sha256-…' hash) as the trust anchor, drop 'unsafe-inline' / 'unsafe-eval', and prefer https-only origins. The nonce becomes the sole gate, neutralizing inline-script bypass and TLS-downgrade vectors.",
              code: "// next.config.js\n{\n  key: 'Content-Security-Policy',\n  value: \"default-src 'self'; script-src 'strict-dynamic' 'nonce-${rand}' 'unsafe-inline' https:; object-src 'none'; base-uri 'self'\",\n}",
              links: [
                'https://www.w3.org/TR/CSP3/',
                'https://csp-evaluator.withgoogle.com/',
                'https://owasp.org/www-project-secure-headers/#content-security-policy',
                'https://cwe.mitre.org/data/definitions/693.html',
              ],
            },
          });
        }
      }
    }

    return {
      scanner: 'csp-evaluator',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
