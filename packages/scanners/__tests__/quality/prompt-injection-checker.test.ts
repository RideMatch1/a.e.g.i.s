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

import { promptInjectionCheckerScanner } from '../../src/quality/prompt-injection-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const AI_CONFIG = {
  stack: { ai: 'mistral' },
} as unknown as AegisConfig;

const NO_AI_CONFIG = {
  stack: { ai: 'none' },
} as unknown as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-promptinj-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('promptInjectionCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await promptInjectionCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.scanner).toBe('prompt-injection-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('skips scanning when ai is none', async () => {
    createFile(
      projectPath,
      'lib/ai.ts',
      'const prompt: `Hello ${userInput}`;\n',
    );

    const result = await promptInjectionCheckerScanner.scan(projectPath, NO_AI_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags prompt template with interpolated variable as HIGH', async () => {
    createFile(
      projectPath,
      'lib/ai-chat.ts',
      `
async function askAI(userMessage: string) {
  const response = await client.create({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: \`\${userMessage}\` },
    ],
  });
  return response;
}
`,
    );

    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.id).toMatch(/^PROMPTINJ-/);
    expect(finding.owasp).toBe('A03:2021');
    expect(finding.cwe).toBe(77);
  });

  it('flags prompt: property with template literal', async () => {
    createFile(
      projectPath,
      'lib/ai-wrapper.ts',
      `
function generatePrompt(userInput: string) {
  return {
    prompt: \`Translate this text: \${userInput}\`,
    model: 'mistral-large',
  };
}
`,
    );

    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const finding = result.findings.find(f => f.title.includes('prompt template'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag when sanitization is present', async () => {
    createFile(
      projectPath,
      'lib/safe-ai.ts',
      `
import { escapeForPrompt } from '@/lib/sanitize';

function generatePrompt(userInput: string) {
  return {
    prompt: \`Translate: \${escapeForPrompt(userInput)}\`,
  };
}
`,
    );

    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'lib/__tests__/ai.test.ts',
      `
const result = { prompt: \`Hello \${userInput}\` };
`,
    );

    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // v0.10 Z7 — direct-variable (non-template-literal) shape.
  it('v0.10 Z7: flags direct-variable content in messages array (idiomatic OpenAI SDK)', async () => {
    createFile(projectPath, 'api/chat.ts', `
import OpenAI from 'openai';
const openai = new OpenAI();

export async function POST(req) {
  const { message } = await req.json();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: message },
    ],
  });
  return Response.json({ reply: completion.choices[0].message.content });
}
`);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const directVariableFindings = result.findings.filter((f) =>
      f.title.includes('user variable passed directly'),
    );
    expect(directVariableFindings.length).toBeGreaterThan(0);
    expect(directVariableFindings[0].cwe).toBe(77);
  });
});

describe('promptInjectionCheckerScanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  const PROMPT_WITH_USER_INTERP = [
    'async function askAI(userMessage: string) {',
    '  const response = await client.create({',
    '    messages: [',
    "      { role: 'system', content: 'You are a helpful assistant.' },",
    '      { role: \'user\', content: `${userMessage}` },',
    '    ],',
    '  });',
    '  return response;',
    '}',
  ].join('\n');

  it('N1-class: flags prompt with user-interpolation under /api/test/ route path (regression-guard for v0.16.3 fix)', async () => {
    mkdirSync(join(projectPath, 'src/app/api/test'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/api/test/route.ts'), PROMPT_WITH_USER_INTERP);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const hits = result.findings.filter((f) => f.scanner === 'prompt-injection-checker' && f.cwe === 77);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('P1-class: skips prompt with user-interpolation in *.test.ts basename (canonical isTestFile extension-match)', async () => {
    mkdirSync(join(projectPath, 'src'), { recursive: true });
    writeFileSync(join(projectPath, 'src/foo.test.ts'), PROMPT_WITH_USER_INTERP);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.scanner === 'prompt-injection-checker')).toHaveLength(0);
  });
});
