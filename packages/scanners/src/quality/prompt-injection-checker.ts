import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Prompt Injection Checker — detects user input flowing into LLM prompts
 * without sanitization, enabling prompt injection attacks.
 *
 * OWASP A03:2021 — Injection
 * CWE-77 — Improper Neutralization of Special Elements used in a Command
 */

function shouldSkipFile(filePath: string): boolean {
  if (isTestFile(filePath)) return true;
  return (
    filePath.includes('/vendor/') ||
    filePath.includes('.min.js') ||
    filePath.includes('/generated/') ||
    filePath.includes('/scripts/')
  );
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Patterns where user input is interpolated into LLM prompts */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; title: string; description: string }> = [
  {
    // Template literals with ${} in chat/create messages calls
    pattern: /\.create\s*\(\s*\{[^}]*messages\s*:\s*\[[\s\S]{0,200}?\$\{/,
    title: 'Prompt injection risk — interpolated variable in LLM messages',
    description:
      'A variable is interpolated into an LLM API messages array via a template literal. If this variable contains user input, an attacker can inject prompt instructions to manipulate the AI\'s behavior, extract system prompts, or bypass safety guardrails. Sanitize user input before embedding it in prompts: strip markdown, escape special characters, or use a dedicated prompt sanitizer.',
  },
  {
    // .chat( with template literal containing interpolation
    pattern: /\.chat\s*\([^)]*`[^`]*\$\{/,
    title: 'Prompt injection risk — interpolated variable in .chat() call',
    description:
      'User input appears to be interpolated into an LLM .chat() call via a template literal. An attacker can inject instructions that override the system prompt. Apply input sanitization before inserting user data into prompts.',
  },
  {
    // prompt: `...${...}...` — common in AI wrapper functions
    pattern: /prompt\s*:\s*`[^`]*\$\{/,
    title: 'Prompt injection risk — interpolated variable in prompt template',
    description:
      'A prompt property uses a template literal with variable interpolation. If the interpolated value is user-controlled, this enables prompt injection. Use a sanitization function (escapeForPrompt, sanitize) to strip control characters and markdown formatting before embedding user input in prompts.',
  },
  {
    // v0.10 Z7: direct-variable content assignment inside an LLM
    // messages array — the idiomatic OpenAI SDK / Anthropic SDK shape:
    //   messages: [{ role: 'user', content: userMessage }]
    // The prior patterns required `${...}` interpolation; this shape
    // carries the same risk without a template-literal, so it escaped
    // detection.
    pattern:
      /messages\s*:\s*\[[\s\S]{0,300}?content\s*:\s*(?!['"`])(?!\s*[\[\{])\w+/,
    title:
      'Prompt injection risk — user variable passed directly as LLM message content',
    description:
      'An LLM messages array has a `content:` field assigned a bare variable (not a string literal). If the variable contains user input, an attacker can inject role-switch instructions ("ignore previous instructions") or extract the system prompt. Wrap the variable in a sanitizer (escapeForPrompt / sanitizePrompt) or use a system-prompt-isolation pattern: always pass the user text inside a clearly-delimited block the model is instructed to treat as data, not instructions.',
  },
  {
    // v0.10 Z7: direct-variable prompt assignment (Anthropic / Google
    // Gemini shape):
    //   prompt: userMessage
    // Without a template literal there is no `${…}` anchor.
    pattern: /prompt\s*:\s*(?!['"`])(?!\s*[\[\{])\w+\b(?!\s*[\(.`])/,
    title:
      'Prompt injection risk — user variable passed directly as prompt parameter',
    description:
      'A prompt property is assigned a bare variable (not a string literal). If the variable is user-controlled, this enables prompt injection. Sanitize via escapeForPrompt / sanitizePrompt or wrap the variable inside a system-prompt-isolation template before dispatch.',
  },
];

/** Patterns indicating prompt sanitization is present */
const SANITIZATION_PATTERNS: RegExp[] = [
  /escapeForPrompt\s*\(/,
  /sanitizePrompt\s*\(/,
  /sanitize\s*\(/,
  /\.replace\s*\(\s*\/\[#\*_`\]/,
  /stripMarkdown\s*\(/,
  /cleanInput\s*\(/,
];

export const promptInjectionCheckerScanner: Scanner = {
  name: 'prompt-injection-checker',
  description: 'Detects user input in LLM prompts without sanitization — prompt injection risk (CWE-77)',
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

    // Only scan if project uses AI
    if (config.stack?.ai === 'none') {
      return {
        scanner: 'prompt-injection-checker',
        category: 'security',
        findings: [],
        duration: Date.now() - start,
        available: true,
      };
    }

    const files = walkFiles(projectPath, ignore, ['ts', 'js']);

    for (const file of files) {
      if (shouldSkipFile(file)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // Skip files with sanitization present
      if (SANITIZATION_PATTERNS.some((p) => p.test(content))) continue;

      const lines = content.split('\n');

      for (const rule of DANGEROUS_PATTERNS) {
        const re = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          const matchLine = findLineNumber(content, match.index);

          // Check nearby lines for sanitization
          const nearbyLines = lines.slice(Math.max(0, matchLine - 6), matchLine + 3).join('\n');
          if (SANITIZATION_PATTERNS.some((p) => p.test(nearbyLines))) continue;

          const id = `PROMPTINJ-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'prompt-injection-checker',
            severity: 'high',
            title: rule.title,
            description: rule.description,
            file,
            line: matchLine,
            category: 'security',
            owasp: 'A03:2021',
            cwe: 77,
          });
        }
      }
    }

    return {
      scanner: 'prompt-injection-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
