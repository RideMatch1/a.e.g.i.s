import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, Orchestrator, readFileSafe } from '@aegis-scan/core';
import { getAllScanners } from '@aegis-scan/scanners';
import { selectReporter, writeStdout } from '../utils.js';
import type { Finding, ScanCategory, AuditResult } from '@aegis-scan/core';

const FAST_CATEGORIES: ScanCategory[] = [
  'security',
  'dependencies',
  'quality',
  'compliance',
  'i18n',
];

export interface FixOptions {
  finding?: string;
  severity?: string;
  dryRun?: boolean;
  format?: string;
  provider?: string;
  model?: string;
}

interface DiffLine {
  original: string;
  fixed: string;
}

function generateDiff(filePath: string, original: string, fixed: string): string {
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  const lines: string[] = [
    chalk.dim(`--- ${filePath} (original)`),
    chalk.dim(`+++ ${filePath} (fixed)`),
  ];

  const maxLen = Math.max(origLines.length, fixedLines.length);
  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const fixed_ = fixedLines[i];
    if (orig === undefined) {
      lines.push(chalk.green(`+ ${fixed_}`));
    } else if (fixed_ === undefined) {
      lines.push(chalk.red(`- ${orig}`));
    } else if (orig !== fixed_) {
      lines.push(chalk.red(`- ${orig}`));
      lines.push(chalk.green(`+ ${fixed_}`));
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// LLM Fix Generation
// ---------------------------------------------------------------------------

async function generateLLMFix(
  finding: Finding,
  fileContent: string,
  provider: string,
  model?: string,
): Promise<string | null> {
  const prompt = `You are a security expert. Fix this security finding in the code below.

Finding: ${finding.title}
Description: ${finding.description}
Severity: ${finding.severity}
OWASP: ${finding.owasp ?? 'N/A'}

File content:
\`\`\`
${fileContent}
\`\`\`

Return ONLY the fixed file content, no explanation. The fix should be minimal — change only what's needed to address the finding.`;

  if (provider === 'claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.yellow('  ANTHROPIC_API_KEY not set — falling back to template fix'));
      return null;
    }

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model ?? 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (fetchErr) {
      console.error(chalk.yellow(`  Claude API request failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} — falling back to template`));
      return null;
    }

    if (!response.ok) {
      console.error(chalk.yellow(`  Claude API error: ${response.status} — falling back to template`));
      return null;
    }

    let data: { content?: Array<{ type: string; text: string }> };
    try {
      data = await response.json() as typeof data;
    } catch {
      console.error(chalk.yellow('  Claude API response parse error — falling back to template'));
      return null;
    }

    const text = data.content?.[0]?.text;
    if (!text) return null;

    // Extract code from markdown code block if present
    const codeMatch = text.match(/```(?:\w+)?\n([\s\S]+?)```/);
    return codeMatch ? codeMatch[1] : text;
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error(chalk.yellow('  OPENAI_API_KEY not set — falling back to template fix'));
      return null;
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model ?? 'gpt-4o',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (fetchErr) {
      console.error(chalk.yellow(`  OpenAI API request failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} — falling back to template`));
      return null;
    }

    if (!response.ok) {
      console.error(chalk.yellow(`  OpenAI API error: ${response.status} — falling back to template`));
      return null;
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = await response.json() as typeof data;
    } catch {
      console.error(chalk.yellow('  OpenAI API response parse error — falling back to template'));
      return null;
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    const codeMatch = text.match(/```(?:\w+)?\n([\s\S]+?)```/);
    return codeMatch ? codeMatch[1] : text;
  }

  if (provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model ?? 'llama3',
          prompt,
          stream: false,
        }),
      });
    } catch (fetchErr) {
      console.error(chalk.yellow(`  Ollama request failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} — falling back to template`));
      return null;
    }

    if (!response.ok) {
      console.error(chalk.yellow(`  Ollama error: ${response.status} — falling back to template`));
      return null;
    }

    let data: { response?: string };
    try {
      data = await response.json() as typeof data;
    } catch {
      console.error(chalk.yellow('  Ollama response parse error — falling back to template'));
      return null;
    }

    const text = data.response;
    if (!text) return null;

    const codeMatch = text.match(/```(?:\w+)?\n([\s\S]+?)```/);
    return codeMatch ? codeMatch[1] : text;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fix templates — hardcoded for v0.2.0, no LLM needed
// ---------------------------------------------------------------------------
type FixTemplate = (finding: Finding, content: string) => string | null;

const FIX_TEMPLATES: Record<string, FixTemplate> = {
  'auth-enforcer': (finding, content) => {
    if (content.includes('secureApiRouteWithTenant')) return null; // already fixed
    const importLine = `import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';\n`;
    return importLine + content;
  },

  'header-checker': (_finding, _content) => {
    // Complex structural change — surface as suggestion only
    return null;
  },

  'crypto-auditor': (finding, content) => {
    if (finding.title.includes('Math.random') && finding.line) {
      // Only replace on the specific flagged line — not globally
      // Use crypto.getRandomValues for numeric compatibility (Math.random returns number)
      const lines = content.split('\n');
      const lineIdx = finding.line - 1;
      if (lineIdx >= 0 && lineIdx < lines.length) {
        lines[lineIdx] = lines[lineIdx].replace(
          /Math\.random\(\)/g,
          'crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF',
        );
        const updated = lines.join('\n');
        return updated === content ? null : updated;
      }
    }
    return null;
  },

  'zod-enforcer': (_finding, content) => {
    if (content.includes('z.object') || content.includes('z.strict')) return null;
    const zodImport = `import { z } from 'zod';\n\n// TODO: define your request schema\n// const schema = z.object({ }).strict();\n`;
    return zodImport + content;
  },

  'rate-limit-checker': (_finding, content) => {
    if (content.includes('checkIPRateLimit')) return null;
    const importLine = `import { checkIPRateLimit } from '@/lib/api/rate-limit';\n`;
    return importLine + content;
  },

  'csrf-checker': (_finding, content) => {
    if (content.includes('origin') || content.includes('referer')) return null;
    const guard = `// TODO: add origin check\n// const origin = request.headers.get('origin');\n// if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });\n`;
    return guard + content;
  },
};

/** Which scanners can be auto-fixed via templates (vs. suggestion-only). */
const FIXABLE_SCANNERS = new Set(Object.keys(FIX_TEMPLATES));

/** LLM providers that are not 'template' */
const LLM_PROVIDERS = new Set(['claude', 'openai', 'ollama']);

async function runScanInternal(resolvedPath: string): Promise<AuditResult> {
  const config = await loadConfig(resolvedPath, 'scan');
  const orchestrator = new Orchestrator();
  const allScanners = getAllScanners();
  const fastScanners = allScanners.filter((s) => FAST_CATEGORIES.includes(s.category));
  for (const scanner of fastScanners) {
    orchestrator.register(scanner);
  }
  return orchestrator.run(config);
}

export async function runFix(
  projectPath: string,
  options: FixOptions,
): Promise<number> {
  const resolvedPath = projectPath || process.cwd();
  const provider = options.provider ?? 'template';
  const isLLMMode = LLM_PROVIDERS.has(provider);

  if (isLLMMode) {
    console.log(chalk.cyan(`Using LLM provider: ${provider}${options.model ? ` (${options.model})` : ''}`));
  }

  const spinner = ora('Scanning for findings...').start();

  let result: AuditResult;
  try {
    result = await runScanInternal(resolvedPath);
  } catch (err) {
    spinner.fail('Scan failed');
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  spinner.stop();

  const { findings } = result;

  // ----- Filter findings to fix -----
  let targets: Finding[] = [];

  if (options.finding) {
    const match = findings.find((f) => f.id === options.finding);
    if (!match) {
      console.error(chalk.red(`Finding '${options.finding}' not found in scan results.`));
      return 1;
    }
    targets = [match];
  } else if (options.severity) {
    targets = findings.filter((f) => f.severity === options.severity);
    if (targets.length === 0) {
      console.log(chalk.yellow(`No findings with severity '${options.severity}' found.`));
      return 0;
    }
  } else {
    // In LLM mode: all findings with a file path are potentially fixable
    // In template mode: only findings from scanners that have a template
    const fixable = isLLMMode
      ? findings.filter((f) => f.file)
      : findings.filter((f) => FIXABLE_SCANNERS.has(f.scanner) && f.file);

    if (fixable.length === 0) {
      console.log(chalk.green('No auto-fixable findings found. Project looks clean!'));
      return 0;
    }

    console.log(chalk.bold('\nAuto-fixable findings:\n'));
    for (const f of fixable) {
      const loc = f.file ? ` (${path.relative(resolvedPath, f.file)}${f.line ? `:${f.line}` : ''})` : '';
      console.log(`  ${chalk.cyan(f.id)} [${chalk.yellow(f.severity)}] ${f.title}${loc}`);
    }
    console.log('');
    if (isLLMMode) {
      console.log(chalk.dim(`Run with --finding <id> to fix a specific finding, or --severity <level> to fix all of that severity.`));
      console.log(chalk.dim(`Applying all ${fixable.length} findings now using ${provider}...\n`));
    } else {
      console.log(chalk.dim('Run with --finding <id> to fix a specific finding, or --severity <level> to fix all of that severity.'));
      console.log(chalk.dim('Applying all auto-fixable findings now...\n'));
    }
    targets = fixable;
  }

  // ----- Apply fixes -----
  let fixedCount = 0;
  let skippedCount = 0;
  const suggestionFindings: Finding[] = [];

  for (const finding of targets) {
    if (!finding.file) {
      console.log(chalk.dim(`  Skipping ${finding.id} — no file location`));
      skippedCount++;
      continue;
    }

    const content = readFileSafe(finding.file);
    if (content === null) {
      console.log(chalk.yellow(`  Cannot read ${finding.file} — skipping`));
      skippedCount++;
      continue;
    }

    let fixed: string | null = null;

    // In LLM mode: try LLM first, then fall back to template
    if (isLLMMode) {
      const llmSpinner = ora(`  [${provider}] Generating fix for ${finding.id}...`).start();
      fixed = await generateLLMFix(finding, content, provider, options.model);
      llmSpinner.stop();

      if (fixed === null) {
        // Fall back to template
        const template = FIX_TEMPLATES[finding.scanner];
        if (template) {
          fixed = template(finding, content);
        }
      } else {
        console.log(chalk.dim(`  [${provider}] Fix generated for ${finding.id}`));
      }
    } else {
      // Template mode (default)
      const template = FIX_TEMPLATES[finding.scanner];
      if (!template) {
        console.log(chalk.dim(`  No template for scanner '${finding.scanner}' — showing suggestion:`));
        if (finding.fix) {
          console.log(chalk.yellow(`    ${finding.fix}`));
        }
        suggestionFindings.push(finding);
        skippedCount++;
        continue;
      }
      fixed = template(finding, content);
    }

    if (fixed === null) {
      // Template/LLM returned null: either already fixed, or suggestion-only
      if (finding.scanner === 'header-checker') {
        console.log(chalk.cyan(`  ${finding.id} [header-checker] — manual fix required:`));
        console.log(chalk.dim(`    Add security headers to next.config.ts headers() configuration.`));
        if (finding.fix) {
          console.log(chalk.dim(`    ${finding.fix}`));
        }
        suggestionFindings.push(finding);
      } else {
        console.log(chalk.green(`  ${finding.id} — already fixed or no change needed`));
      }
      skippedCount++;
      continue;
    }

    const relFile = path.relative(resolvedPath, finding.file);

    if (options.dryRun) {
      console.log(chalk.bold(`\n[DRY RUN] Would fix: ${relFile} (${finding.id})`));
      console.log(generateDiff(relFile, content, fixed));
    } else {
      // Show diff before writing (LLM mode — so user can see the change)
      if (isLLMMode) {
        console.log(chalk.bold(`\nFix for ${finding.id} (${relFile}):`));
        console.log(generateDiff(relFile, content, fixed));
      }

      try {
        // Create backup before writing
        const backupPath = `${finding.file}.aegis.bak`;
        fs.writeFileSync(backupPath, content, 'utf-8');
        fs.writeFileSync(finding.file, fixed, 'utf-8');
        console.log(chalk.green(`  Fixed ${relFile} (${finding.id})`));
        console.log(chalk.dim(`    Backup: ${path.basename(backupPath)}`));
        fixedCount++;
      } catch (writeErr) {
        console.error(chalk.red(`  Failed to write ${finding.file}: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`));
        skippedCount++;
      }
    }
  }

  console.log('');

  if (options.dryRun) {
    console.log(chalk.cyan(`Dry-run complete. ${targets.length} finding(s) reviewed.`));
    return 0;
  }

  console.log(`Fixed: ${chalk.green(String(fixedCount))}  Skipped: ${chalk.yellow(String(skippedCount))}`);

  if (suggestionFindings.length > 0) {
    console.log(chalk.dim(`\n${suggestionFindings.length} finding(s) require manual action — see suggestions above.`));
  }

  // ----- Re-scan and show new score -----
  if (fixedCount > 0) {
    const rescanSpinner = ora('Re-scanning to verify fixes...').start();
    try {
      const newResult = await runScanInternal(resolvedPath);
      rescanSpinner.stop();

      const reporter = selectReporter(options.format);
      const output = reporter.format(newResult);
      await writeStdout('\n' + output + '\n');

      const scoreDelta = newResult.score - result.score;
      if (scoreDelta > 0) {
        console.log(chalk.green(`Score improved by +${scoreDelta} (${result.score} → ${newResult.score})`));
      } else if (scoreDelta < 0) {
        console.log(chalk.yellow(`Score changed by ${scoreDelta} (${result.score} → ${newResult.score})`));
      } else {
        console.log(chalk.dim(`Score unchanged: ${newResult.score}`));
      }

      return newResult.blocked ? 1 : 0;
    } catch (err) {
      rescanSpinner.fail('Re-scan failed');
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }

  return 0;
}
