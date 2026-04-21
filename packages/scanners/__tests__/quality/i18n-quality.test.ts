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
  };
});

import { i18nQualityScanner } from '../../src/quality/i18n-quality.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = { stack: { hasI18n: false } } as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-i18n-test-'));
}

function createTsxFile(projectPath: string, name: string, content: string): string {
  const fullPath = join(projectPath, name);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('i18nQualityScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await i18nQualityScanner.isAvailable()).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('detects "Loschen" as missing umlaut (should be Löschen)', async () => {
    createTsxFile(
      projectPath,
      'DeleteButton.tsx',
      `
      export function DeleteButton() {
        return <button title="Loschen">X</button>;
      }
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Loschen'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('i18n');
  });

  it('detects "Ubersicht" as missing umlaut (should be Übersicht)', async () => {
    createTsxFile(
      projectPath,
      'Dashboard.tsx',
      `
      export function Dashboard() {
        return <h1>Ubersicht</h1>;
      }
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Ubersicht'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('detects "Schliessen" as missing ß (should be Schließen)', async () => {
    createTsxFile(
      projectPath,
      'Modal.tsx',
      `
      export function Modal() {
        return <button aria-label="Schliessen">×</button>;
      }
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Schliessen'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('detects "Prufen" as missing umlaut', async () => {
    createTsxFile(
      projectPath,
      'Form.tsx',
      `
      const label = "Prufen";
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Prufen'));
    expect(finding).toBeDefined();
  });

  it('detects "Bestatigen" as missing umlaut', async () => {
    createTsxFile(
      projectPath,
      'Confirm.tsx',
      `
      export const LABEL = "Bestatigen";
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Bestatigen'));
    expect(finding).toBeDefined();
  });

  it('does NOT flag correct German with real umlauts', async () => {
    createTsxFile(
      projectPath,
      'Correct.tsx',
      `
      export function Correct() {
        return (
          <div>
            <button title="Löschen">X</button>
            <button title="Übersicht">O</button>
            <span>Schließen</span>
          </div>
        );
      }
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const umlautFindings = result.findings.filter((f) => f.severity === 'high');
    expect(umlautFindings).toHaveLength(0);
  });

  it('generates I18N-xxx IDs', async () => {
    createTsxFile(
      projectPath,
      'Bad.tsx',
      `const a = "Loschen"; const b = "Prufen";`,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const ids = result.findings.map((f) => f.id);
    expect(ids.some((id) => id.startsWith('I18N-'))).toBe(true);
  });

  it('reports correct line number for umlaut finding', async () => {
    createTsxFile(
      projectPath,
      'Lines.tsx',
      `// line 1
// line 2
const bad = "Offnen";
// line 4
`,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Offnen'));
    expect(finding).toBeDefined();
    expect(finding!.line).toBe(3);
  });
});

describe('i18nQualityScanner — French accent patterns', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('detects "Cafe" as missing accent when locale is fr', async () => {
    createTsxFile(
      projectPath,
      'Menu.tsx',
      `
      export function Menu() {
        return <span title="Cafe">Coffee</span>;
      }
    `,
    );

    const frConfig = { locale: 'fr', stack: { hasI18n: false } } as AegisConfig;
    const result = await i18nQualityScanner.scan(projectPath, frConfig);
    const finding = result.findings.find((f) => f.title.includes('Cafe'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag French accents when locale is de', async () => {
    createTsxFile(
      projectPath,
      'Info.tsx',
      `
      export function Info() {
        return <span title="Cafe">Info</span>;
      }
    `,
    );

    const deConfig = { locale: 'de', stack: { hasI18n: false } } as AegisConfig;
    const result = await i18nQualityScanner.scan(projectPath, deConfig);
    const finding = result.findings.find((f) => f.title.includes('Cafe'));
    expect(finding).toBeUndefined();
  });
});

describe('i18nQualityScanner — Spanish accent patterns', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('detects "Informacion" as missing accent when locale is es', async () => {
    createTsxFile(
      projectPath,
      'Header.tsx',
      `
      export function Header() {
        return <h1 title="Informacion">Title</h1>;
      }
    `,
    );

    const esConfig = { locale: 'es', stack: { hasI18n: false } } as AegisConfig;
    const result = await i18nQualityScanner.scan(projectPath, esConfig);
    const finding = result.findings.find((f) => f.title.includes('Informacion'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('detects "Contrasena" (missing tilde) when locale is es', async () => {
    createTsxFile(
      projectPath,
      'Login.tsx',
      `
      export function Login() {
        return <input placeholder="Contrasena" />;
      }
    `,
    );

    const esConfig = { locale: 'es', stack: { hasI18n: false } } as AegisConfig;
    const result = await i18nQualityScanner.scan(projectPath, esConfig);
    const finding = result.findings.find((f) => f.title.includes('Contrasena'));
    expect(finding).toBeDefined();
  });
});

describe('i18nQualityScanner — missing lang attribute', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags layout.tsx with <html> but no lang attribute', async () => {
    const appDir = join(projectPath, 'src', 'app');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, 'layout.tsx'),
      `
      export default function RootLayout({ children }) {
        return (
          <html>
            <body>{children}</body>
          </html>
        );
      }
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('lang attribute'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag layout.tsx with <html lang="en">', async () => {
    const appDir = join(projectPath, 'src', 'app');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, 'layout.tsx'),
      `
      export default function RootLayout({ children }) {
        return (
          <html lang="en">
            <body>{children}</body>
          </html>
        );
      }
    `,
    );

    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('lang attribute'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag when no root layout file exists', async () => {
    // No layout.tsx, no _app.tsx etc.
    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('lang attribute'));
    expect(finding).toBeUndefined();
  });

  it('v0.15.4 D-M-001: populates FixGuidance fix.description on emitted findings', async () => {
    // Uses "Bestatigen" which IS in UMLAUT_PATTERNS (→ Bestätigen),
    // so the scanner fires accent-substitution finding-class which
    // lacks fix-field pre-v0.15.4 D-M-001 and must gain one post-impl.
    createTsxFile(
      projectPath,
      'greet.tsx',
      `export default function Page() { return <button>Bestatigen</button>; }`,
    );
    const result = await i18nQualityScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.scanner === 'i18n-quality');
    expect(finding).toBeDefined();
    expect(typeof finding!.fix).toBe('object');
    expect(finding!.fix).not.toBeNull();
    const fix = finding!.fix as { description?: string };
    expect(fix.description).toEqual(expect.any(String));
    expect(fix.description!.length).toBeGreaterThan(20);
    expect(fix.description).toMatch(/i18n|locale|translat|accent|umlaut|UTF-8|Bestätigen/i);
  });
});
