import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) =>
      walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { xssCheckerScanner } from '../../src/quality/xss-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-xss-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('xssCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await xssCheckerScanner.isAvailable()).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('xss-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags dangerouslySetInnerHTML without sanitization as HIGH', async () => {
    createFile(
      projectPath,
      'components/RichText.tsx',
      `
      export function RichText({ html }: { html: string }) {
        return <div dangerouslySetInnerHTML={{ __html: html }} />;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.id).toBe('XSS-001');
    expect(finding.category).toBe('security');
    expect(finding.owasp).toBe('A03:2021');
    expect(finding.cwe).toBe(79);
    expect(finding.title).toContain('dangerouslySetInnerHTML');
    expect(finding.file).toContain('RichText.tsx');
  });

  it('does NOT flag dangerouslySetInnerHTML when DOMPurify is imported', async () => {
    createFile(
      projectPath,
      'components/SafeHtml.tsx',
      `
      import DOMPurify from 'dompurify';
      export function SafeHtml({ html }: { html: string }) {
        return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag dangerouslySetInnerHTML when isomorphic-dompurify is imported', async () => {
    createFile(
      projectPath,
      'components/IsomorphicHtml.tsx',
      `
      import DOMPurify from 'isomorphic-dompurify';
      export function IsomorphicHtml({ html }: { html: string }) {
        return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag dangerouslySetInnerHTML when sanitize-html is imported', async () => {
    createFile(
      projectPath,
      'components/SanitizeHtml.tsx',
      `
      import sanitizeHtml from 'sanitize-html';
      export function Content({ html }: { html: string }) {
        return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags .innerHTML = variable without sanitization as HIGH', async () => {
    createFile(
      projectPath,
      'lib/dom-utils.ts',
      `
      function renderContent(el: HTMLElement, content: string) {
        el.innerHTML = content;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('dom-utils.ts'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.title).toContain('innerHTML');
  });

  it('does NOT flag .innerHTML = variable when DOMPurify is present', async () => {
    createFile(
      projectPath,
      'lib/safe-dom.ts',
      `
      import DOMPurify from 'dompurify';
      function renderContent(el: HTMLElement, content: string) {
        el.innerHTML = DOMPurify.sanitize(content);
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags v-html directive without sanitization', async () => {
    createFile(
      projectPath,
      'components/VueWidget.vue',
      `
      <template>
        <div v-html="userContent"></div>
      </template>
    `,
    );

    // Vue files have .vue extension — but scanner only walks ts/js/tsx/jsx
    // Create equivalent .ts file to test detection
    createFile(
      projectPath,
      'components/vue-renderer.ts',
      `
      // render helper
      const html = \`<div v-html="\${content}"></div>\`;
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('vue-renderer'));
    expect(finding).toBeDefined();
    expect(finding!.title).toContain('v-html');
  });

  it('flags Angular [innerHTML] binding without sanitization', async () => {
    createFile(
      projectPath,
      'components/angular-widget.ts',
      `
      @Component({
        template: \`<div [innerHTML]="userContent"></div>\`
      })
      export class Widget {}
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('angular-widget'));
    expect(finding).toBeDefined();
    expect(finding!.title).toContain('[innerHTML]');
  });

  it('flags document.write() with variable as HIGH', async () => {
    createFile(
      projectPath,
      'lib/legacy.ts',
      `
      function injectScript(src: string) {
        document.write(src);
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.file.includes('legacy.ts'));
    expect(finding).toBeDefined();
    expect(finding!.title).toContain('document.write');
    expect(finding!.severity).toBe('high');
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'components/__tests__/XssTest.test.tsx',
      `
      // Testing XSS patterns intentionally
      const el = document.createElement('div');
      el.innerHTML = userInput;
      expect(el.innerHTML).toBe(expected);
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes correct line number', async () => {
    createFile(
      projectPath,
      'components/line-test.tsx',
      `// line 1
// line 2
export function Comp({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
`,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].line).toBe(4);
  });

  it('generates incrementing IDs across multiple violations', async () => {
    createFile(
      projectPath,
      'components/a.tsx',
      `export function A({ html }: any) { return <div dangerouslySetInnerHTML={{ __html: html }} />; }`,
    );
    createFile(
      projectPath,
      'components/b.tsx',
      `export function B({ html }: any) { return <div dangerouslySetInnerHTML={{ __html: html }} />; }`,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('XSS-001');
    expect(ids).toContain('XSS-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // --- New XSS patterns ---

  it('flags insertAdjacentHTML without sanitization as HIGH', async () => {
    createFile(
      projectPath,
      'lib/dom-inject.ts',
      `
      function injectContent(el: HTMLElement, content: string) {
        el.insertAdjacentHTML('beforeend', content);
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('insertAdjacentHTML'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag insertAdjacentHTML when DOMPurify is imported', async () => {
    createFile(
      projectPath,
      'lib/safe-inject.ts',
      `
      import DOMPurify from 'dompurify';
      function injectContent(el: HTMLElement, content: string) {
        el.insertAdjacentHTML('beforeend', DOMPurify.sanitize(content));
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('insertAdjacentHTML'));
    expect(finding).toBeUndefined();
  });

  it('flags DOMParser.parseFromString with variable input as MEDIUM', async () => {
    createFile(
      projectPath,
      'lib/parser.ts',
      `
      function parseHtml(htmlString: string) {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        return doc.body.innerHTML;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('DOMParser'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags dynamic script element with variable src as HIGH', async () => {
    createFile(
      projectPath,
      'lib/script-loader.ts',
      `
      function loadScript(url: string) {
        const script = document.createElement('script');
        script.src = url;
        document.head.appendChild(script);
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('dynamic script'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags srcdoc attribute with variable input as HIGH', async () => {
    createFile(
      projectPath,
      'components/IframePreview.tsx',
      `
      export function IframePreview({ html }: { html: string }) {
        return <iframe srcdoc={html} />;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('srcdoc'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag srcdoc when sanitization is imported', async () => {
    createFile(
      projectPath,
      'components/SafeIframe.tsx',
      `
      import DOMPurify from 'dompurify';
      export function SafeIframe({ html }: { html: string }) {
        return <iframe srcdoc={DOMPurify.sanitize(html)} />;
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('srcdoc'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag innerHTML = "" — safe empty-string clear (corpus FP: midday chat-input)', async () => {
    createFile(
      projectPath,
      'components/chat-input.tsx',
      `
      useEffect(() => {
        const el = editableRef.current;
        if (!el) return;
        if (value === "") {
          el.innerHTML = "";
        } else {
          el.textContent = value;
        }
      }, [value]);
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('innerHTML'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag innerHTML comparison — reading not writing', async () => {
    createFile(
      projectPath,
      'components/editor.tsx',
      `
      if (el.innerHTML !== "") {
        el.innerHTML = "";
      }
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const innerHtmlFindings = result.findings.filter((f) => f.title.includes('innerHTML'));
    expect(innerHtmlFindings).toHaveLength(0);
  });

  it('DOES flag innerHTML = variable — real XSS risk', async () => {
    createFile(
      projectPath,
      'components/renderer.tsx',
      `
      el.innerHTML = userContent;
    `,
    );

    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('innerHTML'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });
});

describe('xssCheckerScanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  const UNSAFE_HTML = [
    'export default function TestPage({ searchParams }: { searchParams: { q: string } }) {',
    '  const userInput = searchParams.q;',
    '  return <div dangerouslySetInnerHTML={{ __html: userInput }} />;',
    '}',
  ].join('\n');

  it('N1-class: flags unsafe-html in page.tsx under /test/ route path (regression-guard for v0.16.3 fix)', async () => {
    mkdirSync(join(projectPath, 'src/app/test'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/test/page.tsx'), UNSAFE_HTML);
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'xss-checker' && f.cwe === 79);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('P1-class: skips unsafe-html in *.test.tsx basename (canonical isTestFile extension-match)', async () => {
    mkdirSync(join(projectPath, 'src/app'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/foo.test.tsx'), UNSAFE_HTML);
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'xss-checker')).toHaveLength(0);
  });
});

describe('xssCheckerScanner — v0.17.5 F2.1 backtracking-bypass regression-guards', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('does NOT flag multi-line literal script.src (POLABDC-class regression)', async () => {
    createFile(
      projectPath,
      'lib/loadPdfLib.ts',
      [
        "export async function ensurePdfLib() {",
        "  if (!(window as any).PDFLib) {",
        "    const script = document.createElement('script');",
        "    script.src =",
        "      'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';",
        "    document.head.appendChild(script);",
        "  }",
        "}",
      ].join('\n'),
    );
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => /script element with variable src/.test(f.title));
    expect(hits).toHaveLength(0);
  });

  it('DOES flag multi-line script.src = variable (real TP)', async () => {
    createFile(
      projectPath,
      'lib/loadDynamicScript.ts',
      [
        "export function loadDynamicScript(userInput: string) {",
        "  const script = document.createElement('script');",
        "  script.src =",
        "    userInput;",
        "  document.head.appendChild(script);",
        "}",
      ].join('\n'),
    );
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => /script element with variable src/.test(f.title));
    expect(hits.length).toBeGreaterThan(0);
  });

  it('does NOT flag multi-line literal document.write (legacy bootstrap)', async () => {
    createFile(
      projectPath,
      'lib/legacy-bootstrap.ts',
      [
        "export function legacyBootstrap() {",
        "  document.write(",
        "    '<noscript>JS required</noscript>',",
        "  );",
        "}",
      ].join('\n'),
    );
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => /document\.write/.test(f.title));
    expect(hits).toHaveLength(0);
  });

  it('does NOT flag multi-line literal insertAdjacentHTML', async () => {
    createFile(
      projectPath,
      'lib/insertHelp.ts',
      [
        "export function insertHelp(el: HTMLElement) {",
        "  el.insertAdjacentHTML(",
        "    'beforeend',",
        "    '<span>help</span>',",
        "  );",
        "}",
      ].join('\n'),
    );
    const result = await xssCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter((f) => /insertAdjacentHTML/.test(f.title));
    expect(hits).toHaveLength(0);
  });
});
