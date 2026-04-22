import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig, Severity } from '@aegis-scan/core';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — unsafe-html in page.tsx under /test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — unsafe-html in *.test.tsx basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

/** Files to skip — tests, vendor, minified, generated */
function shouldSkipFile(filePath: string): boolean {
  if (isTestFile(filePath)) return true;
  return (
    filePath.includes('/vendor/') ||
    filePath.includes('/plugins/') ||
    filePath.includes('.min.js') ||
    filePath.includes('.min.ts') ||
    filePath.includes('/generated/') ||
    filePath.includes('/Templates')
  );
}

/**
 * Sanitization libraries whose presence indicates the developer is handling XSS.
 * We only skip if the import exists — the actual usage check is a best-effort heuristic.
 */
const SANITIZATION_IMPORTS: RegExp[] = [
  /['"]dompurify['"]/i,
  /['"]isomorphic-dompurify['"]/i,
  /['"]sanitize-html['"]/i,
  /DOMPurify\.sanitize/,
  /sanitizeHtml\s*\(/,
];

interface XssRule {
  pattern: RegExp;
  title: string;
  description: string;
  /** If true, the finding is only raised when no sanitization import is present */
  requiresNoSanitization: boolean;
  /** Extra check: skip if the match is a string literal (not a variable) */
  skipStringLiteral?: boolean;
  /** Override default severity (high) */
  severity?: Severity;
}

const XSS_RULES: XssRule[] = [
  {
    // dangerouslySetInnerHTML={{ __html: ... }} — React
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{/,
    title: 'XSS risk — dangerouslySetInnerHTML without sanitization',
    description:
      'dangerouslySetInnerHTML is used without a detectable sanitization library (DOMPurify, sanitize-html, isomorphic-dompurify). Unsanitized HTML injection can lead to stored or reflected XSS. Import and apply a sanitizer before passing content: { __html: DOMPurify.sanitize(content) }.',
    requiresNoSanitization: true,
  },
  {
    // .innerHTML = <variable> — only flag writes with a non-literal RHS.
    // Negative lookahead excludes:
    //   - string literals: "...", '...', `...`
    //   - empty-string clears: innerHTML = ""  (safe, common React pattern)
    //   - comparisons/reads: if (el.innerHTML !== "")
    // Positive match requires the RHS to start like a variable/expression:
    //   identifier char, template expression ${, or function call word(
    pattern: /\.innerHTML\s*=\s*(?!["'`])(?=\w|\$\{)/,
    title: 'XSS risk — innerHTML assignment with variable',
    description:
      'innerHTML is assigned a variable value without detectable sanitization. If the value contains user-controlled HTML, this is an XSS vulnerability. Use textContent for plain text, or sanitize with DOMPurify.sanitize() before assigning to innerHTML.',
    requiresNoSanitization: true,
    skipStringLiteral: false, // negative lookahead already excludes literals
  },
  {
    // v-html= (Vue)
    pattern: /v-html\s*=\s*/,
    title: 'XSS risk — v-html directive without sanitization',
    description:
      'Vue v-html directive renders raw HTML and is vulnerable to XSS if the content contains user data. Apply DOMPurify.sanitize() before binding, or replace with v-text / text interpolation {{ }} for plain text.',
    requiresNoSanitization: true,
  },
  {
    // [innerHTML]= (Angular)
    pattern: /\[innerHTML\]\s*=\s*/,
    title: 'XSS risk — Angular [innerHTML] binding without sanitization',
    description:
      'Angular [innerHTML] property binding renders raw HTML. While Angular has built-in sanitization, it can be bypassed with DomSanitizer.bypassSecurityTrustHtml(). If bypassing is used or content is already trusted, ensure sanitization happens upstream.',
    requiresNoSanitization: true,
  },
  {
    // document.write( with variable
    pattern: /document\.write\s*\(\s*(?!['"(`])/,
    title: 'XSS risk — document.write() with variable',
    description:
      "document.write() is called with a variable argument. Passing user-controlled values to document.write() is a classic DOM XSS vector. Replace with safe DOM APIs (createElement, textContent) or sanitize the content first.",
    requiresNoSanitization: true,
  },
  {
    // insertAdjacentHTML( without sanitization
    pattern: /\.insertAdjacentHTML\s*\(\s*['"][^'"]+['"]\s*,\s*(?!['"(`])/,
    title: 'XSS risk — insertAdjacentHTML() without sanitization',
    description:
      'insertAdjacentHTML() inserts raw HTML into the DOM. If the content contains user-controlled data, this is an XSS vulnerability. Use textContent for plain text, or sanitize with DOMPurify.sanitize() before inserting.',
    requiresNoSanitization: true,
  },
  {
    // DOMParser().parseFromString( with user input
    pattern: /DOMParser\s*\(\s*\)\s*\.parseFromString\s*\(\s*(?!['"(`])/,
    title: 'XSS risk — DOMParser.parseFromString() with potential user input',
    description:
      'DOMParser().parseFromString() parses a string as HTML. If the input contains user-controlled data, scripts in the parsed document can execute when nodes are imported into the main document. Sanitize the input with DOMPurify before parsing, or validate the content type.',
    requiresNoSanitization: true,
    severity: 'medium',
  },
  {
    // document.createElement('script') with dynamic src
    pattern: /document\.createElement\s*\(\s*['"]script['"]\s*\)[\s\S]{0,100}?\.src\s*=\s*(?!['"(`])/,
    title: 'XSS risk — dynamic script element with variable src',
    description:
      'A script element is created with document.createElement(\'script\') and its src is set to a variable. If the variable is user-controlled, an attacker can load and execute arbitrary JavaScript. Only use hardcoded, trusted URLs for script sources, or validate the URL against an allowlist.',
    requiresNoSanitization: false,
  },
  {
    // srcdoc= attribute with user input
    pattern: /srcdoc\s*=\s*\{(?!['"(`])/,
    title: 'XSS risk — srcdoc attribute with potential user input',
    description:
      'The srcdoc attribute on an iframe accepts raw HTML. If the value contains user-controlled data, this is an XSS vulnerability — the HTML executes in the iframe context and can access the parent via postMessage or same-origin policies. Sanitize the content with DOMPurify before setting srcdoc.',
    requiresNoSanitization: true,
  },
];

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

function hasSanitizationImport(content: string): boolean {
  return SANITIZATION_IMPORTS.some((p) => p.test(content));
}

export const xssCheckerScanner: Scanner = {
  name: 'xss-checker',
  description: 'Detects DOM XSS vectors: dangerouslySetInnerHTML, innerHTML, v-html, document.write',
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

    // XSS can appear in any frontend or full-stack file
    const files = walkFiles(projectPath, ignore, ['tsx', 'jsx', 'ts', 'js']);

    for (const file of files) {
      // Skip test files — they intentionally contain patterns we're scanning for
      if (shouldSkipFile(file)) continue;
      // Skip scripts directory
      if (file.includes('/scripts/')) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      const hasSanitization = hasSanitizationImport(content);

      for (const rule of XSS_RULES) {
        // If rule requires no sanitization and sanitization is present, skip
        if (rule.requiresNoSanitization && hasSanitization) continue;

        const re = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          const id = `XSS-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'xss-checker',
            severity: rule.severity ?? 'high',
            title: rule.title,
            description: rule.description,
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A03:2021',
            cwe: 79,
            fix: {
              description:
                'Render user-supplied content through React text-children (automatic escaping) or pass the value through a vetted sanitizer before the sink. Avoid raw-HTML sinks unless the payload has already been sanitized on the server.',
              code: 'const clean = DOMPurify.sanitize(userContent);',
              links: [
                'https://cwe.mitre.org/data/definitions/79.html',
                'https://owasp.org/Top10/A03_2021-Injection/',
              ],
            },
          });
        }
      }
    }

    return {
      scanner: 'xss-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
