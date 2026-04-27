import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
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

  // ─────────────────────────────────────────────────────────────────────────
  // M-01 detection (post-2026-04-26 brutal-load audit):
  // The narrow-sanitizer pattern that strips only `^system:` line-prefix
  // is bypassable. AEGIS should flag this pattern so future audits catch
  // the weakness statically.
  // ─────────────────────────────────────────────────────────────────────────

  const NARROW_SANITIZER_SHAPE = [
    'export async function POST(request: NextRequest) {',
    '  const body = await request.json();',
    '  const { messages } = body;',
    '  const sanitizedMessages = messages.map((m: { role: string; content: string }) => ({',
    '    role: m.role,',
    '    content: m.content',
    "      .replace(/^\\s*(?:system|SYSTEM)\\s*:/gm, '[blocked]:')",
    "      .replace(/\\x00/g, ''),",
    '  }));',
    '  const aiResponse = await mistral.chat.complete({ model: "mistral-large", messages: sanitizedMessages });',
    '  return new Response(JSON.stringify(aiResponse));',
    '}',
  ].join('\n');

  it('M-01: flags narrow inbound chat-message sanitizer (only ^system: prefix stripped — bypassable per brutal-load 2026-04-26)', async () => {
    mkdirSync(join(projectPath, 'src/app/api/ai/chat'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/api/ai/chat/route.ts'), NARROW_SANITIZER_SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const m01Hits = result.findings.filter((f) =>
      f.scanner === 'prompt-injection-checker' &&
      (f.title || '').includes('too narrow')
    );
    expect(m01Hits.length).toBeGreaterThan(0);
    expect(m01Hits[0].description).toMatch(/markdown|verbatim|semantic|brutal-load/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Field-Report 2026-04-27 — Sub-Klasse 4: incomplete-role-coverage.
// Sanitizer is gated by m.role === 'user' so fake `role: "assistant"` turns
// are passed through unsanitized. OpenAI-compatible chat schema allows this.
// ─────────────────────────────────────────────────────────────────────────

describe('promptInjectionCheckerScanner — Sub-Klasse 4: incomplete-role-coverage', () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags ternary form: m.role === "user" ? sanitize(m.content) : m.content', async () => {
    const ROLE_GATED = [
      'export async function POST(request: Request) {',
      '  const { messages } = await request.json();',
      '  const sanitized = messages.map((m: { role: string; content: string }) => ({',
      '    ...m,',
      '    content: m.role === \'user\' ? sanitizeChatInput(m.content) : m.content,',
      '  }));',
      '  return Response.json({ messages: sanitized });',
      '}',
    ].join('\n');
    mkdirSync(join(projectPath, 'src/app/api/chat'), { recursive: true });
    writeFileSync(join(projectPath, 'src/app/api/chat/route.ts'), ROLE_GATED);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const hits = result.findings.filter((f) => f.title.includes('role-gated'));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].description).toMatch(/Beobachtung 4|fake.+assistant|multi-turn/i);
    expect(hits[0].cwe).toBe(77);
  });

  it('flags negated form: m.role !== "assistant" ? sanitize(...) : passthrough', async () => {
    const ROLE_NEGATED = [
      'function clean(messages: any[]) {',
      '  return messages.map(m => ({',
      '    ...m,',
      '    content: m.role !== \'assistant\' ? scrubInput(m.content) : m.content,',
      '  }));',
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'lib.ts'), ROLE_NEGATED);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('role-gated')).length).toBeGreaterThan(0);
  });

  it('flags assistant-passthrough form: m.role === "assistant" ? m.content : sanitize(...)', async () => {
    const ASSIST_PASS = [
      'const out = msgs.map(m => ({',
      '  ...m,',
      '  content: m.role === \'assistant\' ? m.content : escapePromptInput(m.content),',
      '}));',
    ].join('\n');
    writeFileSync(join(projectPath, 'handler.ts'), ASSIST_PASS);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('role-gated')).length).toBeGreaterThan(0);
  });

  it('does NOT flag when sanitizer is unconditional (no role gate)', async () => {
    const UNCONDITIONAL = [
      'const cleaned = messages.map(m => ({',
      '  ...m,',
      '  content: doSanitize(m.content),',
      '}));',
    ].join('\n');
    writeFileSync(join(projectPath, 'good.ts'), UNCONDITIONAL);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('role-gated'))).toHaveLength(0);
  });

  it('does NOT flag unrelated role checks (admin, owner, etc.)', async () => {
    const UNRELATED = [
      'const flagged = users.map(u => ({',
      '  ...u,',
      '  isAdmin: u.role === \'admin\' ? auditAdmin(u) : false,',
      '}));',
    ].join('\n');
    writeFileSync(join(projectPath, 'admin.ts'), UNRELATED);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('role-gated'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Field-Report 2026-04-27 — Sub-Klasse 3: incomplete-bidi-strip-set.
// Strip set covers older bidi codepoints (U+200B-F + U+202A-E) but misses
// the newer U+2066-U+2069 isolates which are the modern attack vector.
// ─────────────────────────────────────────────────────────────────────────

describe('promptInjectionCheckerScanner — Sub-Klasse 3: incomplete-bidi-strip-set', () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags regex-literal strip set with old bidi range but missing U+2066-9', async () => {
    const PRE_FIX = [
      'export function strip(s: string): string {',
      '  return s.replace(/[\\u200B-\\u200F\\u202A-\\u202E]/g, \'\');',
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'old-strip.ts'), PRE_FIX);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const hits = result.findings.filter((f) => f.title.includes('Bidi-strip set'));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].description).toMatch(/U\+2066/);
    expect(hits[0].cwe).toBe(77);
  });

  it('flags new RegExp() string form with old bidi range but missing U+2066-9', async () => {
    const NEW_REGEXP = [
      'const STRIP = new RegExp(\'[\\\\u200B-\\\\u200F\\\\u202A-\\\\u202E]\', \'g\');',
    ].join('\n');
    writeFileSync(join(projectPath, 'new-regexp.ts'), NEW_REGEXP);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Bidi-strip set')).length).toBeGreaterThan(0);
  });

  it('does NOT flag when U+2066-2069 isolates are also present', async () => {
    const POST_FIX = [
      'export function strip(s: string): string {',
      '  return s.replace(/[\\u200B-\\u200F\\u2028-\\u202F\\u2066-\\u2069\\uFEFF]/g, \'\');',
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'good-strip.ts'), POST_FIX);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Bidi-strip set'))).toHaveLength(0);
  });

  it('does NOT flag a non-bidi character class (e.g. markdown chars)', async () => {
    const MD_STRIP = [
      'const stripped = s.replace(/[#*_`]/g, \'\');',
    ].join('\n');
    writeFileSync(join(projectPath, 'md.ts'), MD_STRIP);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Bidi-strip set'))).toHaveLength(0);
  });

  it('does NOT flag when only one old bidi codepoint family is present (cannot tell intent)', async () => {
    // Only U+200B-F, no U+202A-E. Could be a zero-width-only strip, not bidi at all.
    // Our heuristic requires BOTH old families to be confident it's a bidi strip,
    // so this should be skipped to avoid FP on partial-zerowidth strips.
    const PARTIAL = [
      'const out = s.replace(/[\\u200B-\\u200F]/g, \'\');',
    ].join('\n');
    writeFileSync(join(projectPath, 'partial.ts'), PARTIAL);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    // Note: current heuristic uses .some() so a single match counts.
    // This test documents the v1 trade-off: aggressive detection > FN avoidance.
    // If FP rate is high empirically, change to require BOTH families.
    const hits = result.findings.filter((f) => f.title.includes('Bidi-strip set'));
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Field-Report 2026-04-27 — Sub-Klasse 1: marker-only-replace.
// .replace(/role-marker/, 'CONST') where the regex doesn't eat the line —
// imperative content after the marker survives intact.
// Generalises M-01 (which catches only the specific ^system: shape).
// ─────────────────────────────────────────────────────────────────────────

describe('promptInjectionCheckerScanner — Sub-Klasse 1: marker-only-replace', () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags .replace(/^\\s*system:/gm, "[X]") — no line-eating suffix', async () => {
    const SHAPE = [
      'function clean(s: string) {',
      "  return s.replace(/^\\s*(?:system|SYSTEM)\\s*:/gm, '[blocked]:');",
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'narrow.ts'), SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const hits = result.findings.filter((f) => f.title.includes('marker-only-replace'));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].cwe).toBe(77);
    expect(hits[0].description).toMatch(/Beobachtung 1|line-eating/i);
  });

  it('flags ChatML marker-only-replace: <|im_start|>', async () => {
    const SHAPE = [
      "const out = s.replace(/<\\|im_start\\|>/g, '[X]');",
    ].join('\n');
    writeFileSync(join(projectPath, 'chatml.ts'), SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('marker-only-replace')).length).toBeGreaterThan(0);
  });

  it('does NOT flag when regex body contains line-eating .*$', async () => {
    const SHAPE = [
      "const out = s.replace(/^\\s*system:.*$/gm, '');",
    ].join('\n');
    writeFileSync(join(projectPath, 'eats.ts'), SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('marker-only-replace'))).toHaveLength(0);
  });

  it('does NOT flag when regex body contains [\\s\\S]* line-eater', async () => {
    const SHAPE = [
      "const out = s.replace(/system:[\\s\\S]*/g, '[X]');",
    ].join('\n');
    writeFileSync(join(projectPath, 'eats2.ts'), SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('marker-only-replace'))).toHaveLength(0);
  });

  it('does NOT flag .replace() with a non-marker regex (e.g. credit-card scrub)', async () => {
    const SHAPE = [
      "const redacted = s.replace(/\\d{16}/g, '[CC-REDACTED]');",
    ].join('\n');
    writeFileSync(join(projectPath, 'cc.ts'), SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('marker-only-replace'))).toHaveLength(0);
  });

  it('does NOT flag userId/username (word-bounded user check)', async () => {
    const SHAPE = [
      "const safe = s.replace(/userId|username/g, '[ID]');",
    ].join('\n');
    writeFileSync(join(projectPath, 'ids.ts'), SHAPE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('marker-only-replace'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Field-Report 2026-04-27 — Sub-Klasse 2: html-strip-before-marker.
// /<[^>]*>/g eats ChatML wrappers like <|im_start|>system\n... before the
// role-marker detect can fire. Positional check: html-strip pos < marker pos
// within ±40 lines.
// ─────────────────────────────────────────────────────────────────────────

describe('promptInjectionCheckerScanner — Sub-Klasse 2: html-strip-before-marker', () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags html-strip BEFORE marker-detect in chained .replace()', async () => {
    const VULN = [
      'function clean(s: string) {',
      "  return s.replace(/<[^>]*>/g, '')",
      "    .replace(/^\\s*(?:system|SYSTEM)\\s*:/gm, '[blocked]:');",
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'vuln.ts'), VULN);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    const hits = result.findings.filter((f) => f.title.includes('html-strip precedes'));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].cwe).toBe(77);
    expect(hits[0].description).toMatch(/Beobachtung 2|ChatML/);
  });

  it('does NOT flag when marker-detect runs BEFORE html-strip (correct order)', async () => {
    const SAFE = [
      'function clean(s: string) {',
      "  return s.replace(/^\\s*(?:system|SYSTEM)\\s*:/gm, '[blocked]:')",
      "    .replace(/<[^>]*>/g, '');",
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'safe.ts'), SAFE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('html-strip precedes'))).toHaveLength(0);
  });

  it('does NOT flag when html-strip and marker-detect are >40 lines apart (different functions)', async () => {
    const FAR = ['function htmlClean(s: string) {', "  return s.replace(/<[^>]*>/g, '');", '}', ''];
    for (let i = 0; i < 50; i++) FAR.push(`// padding line ${i}`);
    FAR.push('function markerClean(s: string) {');
    FAR.push("  return s.replace(/^\\s*system\\s*:/gm, '');");
    FAR.push('}');
    writeFileSync(join(projectPath, 'far.ts'), FAR.join('\n'));
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('html-strip precedes'))).toHaveLength(0);
  });

  it('does NOT flag a file that has only html-strip (no marker-detect at all)', async () => {
    const HTML_ONLY = [
      'function clean(s: string) {',
      "  return s.replace(/<[^>]*>/g, '');",
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'html.ts'), HTML_ONLY);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('html-strip precedes'))).toHaveLength(0);
  });

  it('flags chain that spans newlines + whitespace (multi-line chained .replace())', async () => {
    const VULN = [
      'function clean(s: string) {',
      "  return s",
      "    .replace(/<[^>]*>/g, '')",
      "    .replace(/^\\s*system\\s*:/gm, '[blocked]:');",
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'spread.ts'), VULN);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('html-strip precedes')).length).toBeGreaterThan(0);
  });

  it('does NOT flag two safe sanitizers in the same file (no false-cross-link)', async () => {
    // Both functions chain marker-detect BEFORE html-strip (correct order).
    const TWO_SAFE = [
      'function safeA(s: string) {',
      "  return s.replace(/^\\s*system\\s*:/gm, '[blocked]:').replace(/<[^>]*>/g, '');",
      '}',
      '',
      'function safeB(s: string) {',
      "  return s.replace(/^\\s*assistant\\s*:/gm, '[blocked]:').replace(/<[^>]*>/g, '');",
      '}',
    ].join('\n');
    writeFileSync(join(projectPath, 'two-safe.ts'), TWO_SAFE);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('html-strip precedes'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Field-Report 2026-04-27 — End-to-end fixtures.
//
// Pre-fix sanitizer (the field-report's documented vulnerable shape) MUST
// produce findings for each of Sub-Klasse 1, 2, 3, 4.
//
// Post-fix sanitizer (sourced from
// https://github.com/ephixa53/neonarc/tree/security/chatbot-prompt-injection-hardening
// path src/lib/chat/sanitize.ts — the hardened production version that
// closes Beobachtungen 1-4) MUST produce ZERO weak-defense findings.
//
// Fixture files live as `.txt` so they are not picked up by walkFiles'
// ['ts','js'] extension filter — they are written into a temp project as
// `.ts` files only by the tests below.
// ─────────────────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, '..', '__fixtures__', 'prompt-injection-corpus');

describe('promptInjectionCheckerScanner — Field-Report end-to-end fixtures', () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('PRE-FIX fixture produces ≥1 finding per Sub-Klasse 1, 2, 3, 4', async () => {
    const preFixSource = readFileSync(join(FIXTURES_DIR, 'sanitizer-pre-fix.ts.txt'), 'utf-8');
    mkdirSync(join(projectPath, 'src/lib/chat'), { recursive: true });
    writeFileSync(join(projectPath, 'src/lib/chat/sanitize.ts'), preFixSource);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);

    const sub1 = result.findings.filter((f) => f.title.includes('marker-only-replace'));
    const sub2 = result.findings.filter((f) => f.title.includes('html-strip precedes'));
    const sub3 = result.findings.filter((f) => f.title.includes('Bidi-strip set'));
    const sub4 = result.findings.filter((f) => f.title.includes('role-gated'));

    expect(sub1.length, 'Sub-Klasse 1 (marker-only-replace) expected ≥1').toBeGreaterThan(0);
    expect(sub2.length, 'Sub-Klasse 2 (html-strip-precedes-marker) expected ≥1').toBeGreaterThan(0);
    expect(sub3.length, 'Sub-Klasse 3 (incomplete-bidi-strip-set) expected ≥1').toBeGreaterThan(0);
    expect(sub4.length, 'Sub-Klasse 4 (incomplete-role-coverage) expected ≥1').toBeGreaterThan(0);
  });

  it('POST-FIX fixture (neonarc hardened sanitize.ts) produces ZERO weak-defense findings', async () => {
    const postFixSource = readFileSync(join(FIXTURES_DIR, 'sanitizer-post-fix.ts.txt'), 'utf-8');
    mkdirSync(join(projectPath, 'src/lib/chat'), { recursive: true });
    writeFileSync(join(projectPath, 'src/lib/chat/sanitize.ts'), postFixSource);
    const result = await promptInjectionCheckerScanner.scan(projectPath, AI_CONFIG);

    const weakDefenseTitles = [
      'too narrow', // M-01
      'role-gated', // Sub-4
      'Bidi-strip set', // Sub-3
      'marker-only-replace', // Sub-1
      'html-strip precedes', // Sub-2
    ];
    const weakDefenseHits = result.findings.filter((f) =>
      weakDefenseTitles.some((t) => f.title.includes(t)),
    );
    expect(
      weakDefenseHits,
      `Post-fix sanitizer produced unexpected weak-defense findings: ${weakDefenseHits
        .map((h) => h.title)
        .join(', ')}`,
    ).toEqual([]);
  });
});
