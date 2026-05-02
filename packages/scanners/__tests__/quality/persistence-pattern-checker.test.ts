import { describe, it, expect, vi } from 'vitest';
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
    isTestFile: (filePath: string) =>
      /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) ||
      /[\/\\]__tests__[\/\\]/.test(filePath) ||
      /[\/\\]__mocks__[\/\\]/.test(filePath) ||
      /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
  };
});

import { persistencePatternCheckerScanner } from '../../src/quality/persistence-pattern-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-persistence-test-'));
}

function writeFile(projectPath: string, relPath: string, content: string): void {
  const full = join(projectPath, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

describe('persistence-pattern-checker — TP detection', () => {
  it('flags top-level child_process.spawn (CWE-506)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `import { spawn } from 'child_process';\nspawn('curl', [process.env.URL]);\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 506 && /spawn/.test(f.title))).toBe(true);
  });

  it('flags dynamic require(varName) at top-level (CWE-829)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `const mod = require(process.env.UPDATE_URL);\nmodule.exports = { mod };\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 829)).toBe(true);
  });

  it('flags dynamic import(varName) inside a top-level IIFE (CWE-829, IIFE evasion)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `(async () => {\n  const m = await import(process.env.PAYLOAD_URL);\n  m.run();\n})();\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 829)).toBe(true);
  });

  it('flags top-level eval(varName) (CWE-94)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `eval(decodeURIComponent(process.env.PAYLOAD));\nexport const noop = () => null;\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 94)).toBe(true);
  });

  it('flags new Function() at top-level (CWE-94)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `const f = new Function('a', 'b', 'return a + b');\nf(1, 2);\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 94)).toBe(true);
  });

  it('flags fs.appendFile to ~/.bashrc at top-level (CWE-506)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `import { appendFileSync } from 'fs';\nimport { homedir } from 'os';\nimport { join } from 'path';\nappendFileSync(join(homedir(), '.bashrc'), '\\nalias ls=evil\\n');\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 506)).toBe(true);
  });

  it('flags fs.writeFile to authorized_keys split across path.join args (CWE-506)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `import { writeFileSync } from 'fs';\nimport { homedir } from 'os';\nimport { join } from 'path';\nwriteFileSync(\n  join(homedir(), '.ssh', 'authorized_keys'),\n  'ssh-rsa attacker',\n);\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 506)).toBe(true);
  });

  it('flags top-level cron.schedule registration (CWE-912)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `import cron from 'node-cron';\ncron.schedule('0 * * * *', () => { exec('rm -rf /tmp/*') });\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 912)).toBe(true);
  });

  it('flags top-level setInterval registration (CWE-912)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `setInterval(() => phoneHome(), 60_000);\nfunction phoneHome() {}\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.some((f) => f.cwe === 912)).toBe(true);
  });
});

describe('persistence-pattern-checker — FP suppression (boundary regression-guards)', () => {
  it('does NOT flag spawn() inside a function body (in-function discriminator)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/build.ts',
      `import { spawn } from 'child_process';\nexport function runBuild() {\n  return spawn('tsc', ['--build']);\n}\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 506)).toHaveLength(0);
  });

  it('does NOT flag require() with a static literal path (static-string discriminator)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `const config = require('./config.json');\nconst lib = require('lodash');\nmodule.exports = { config, lib };\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 829)).toHaveLength(0);
  });

  it('does NOT flag eval() of a static literal string (literal-arg discriminator)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `const r = eval('1 + 2');\nexport { r };\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 94)).toHaveLength(0);
  });

  it('does NOT flag fs writes to project-relative paths (path-classifier discriminator)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/init.ts',
      `import { appendFileSync } from 'fs';\nappendFileSync('./logs/boot.log', 'init\\n');\nappendFileSync('/tmp/app.tmp', 'tmp\\n');\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 506)).toHaveLength(0);
  });

  it('does NOT flag spawn() in next.config.js (config-file path-exclusion)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'next.config.js',
      `const { spawnSync } = require('child_process');\nconst r = spawnSync('git', ['rev-parse', 'HEAD']);\nmodule.exports = { env: { COMMIT: r.stdout.toString() } };\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 506)).toHaveLength(0);
  });

  it('does NOT flag patterns inside test files (test-file path-exclusion)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/foo.test.ts',
      `import { spawn } from 'child_process';\nspawn('echo', ['testing']);\nconst m = require(process.env.X);\neval(process.env.PAYLOAD);\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag spawn() referenced as identifier without call (no-call discriminator)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `import { spawn } from 'child_process';\nexport { spawn };\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 506)).toHaveLength(0);
  });

  it('does NOT flag spawn() in scripts/ directory (build-script path-exclusion)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'scripts/release.ts',
      `import { spawn } from 'child_process';\nspawn('npm', ['publish']);\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag setInterval/cron INSIDE a function body (in-function discriminator for cron-class)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/heartbeat.ts',
      `export function startHeartbeat() {\n  setInterval(() => fetch('/health'), 30_000);\n}\n\nexport function startCron() {\n  const cron = require('node-cron');\n  cron.schedule('0 * * * *', () => doWork());\n}\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.cwe === 912)).toHaveLength(0);
  });
});

describe('persistence-pattern-checker — finding-shape contract', () => {
  it('emits findings with required Finding fields (id, scanner, severity, cwe, file, line)', async () => {
    const proj = makeTempProject();
    writeFile(
      proj,
      'src/index.ts',
      `import { spawn } from 'child_process';\nspawn('curl', [process.env.URL]);\n`,
    );
    const result = await persistencePatternCheckerScanner.scan(proj, MOCK_CONFIG);
    const f = result.findings.find((x) => x.cwe === 506);
    expect(f).toBeDefined();
    expect(f!.scanner).toBe('persistence-pattern-checker');
    expect(f!.id).toMatch(/^PERSIST-\d{3,}$/);
    expect(f!.severity).toBe('high');
    expect(f!.line).toBeGreaterThan(0);
    expect(f!.file).toMatch(/index\.ts$/);
    expect(f!.category).toBe('quality');
  });
});
