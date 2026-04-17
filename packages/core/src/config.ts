import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { detectStack } from './detect.js';
import type { AegisConfig, DetectedStack } from './types.js';

const CweStringSchema = z.string().regex(/^CWE-\d+$/, { message: 'expected CWE-<digits>' });
const SeverityEnum = z.enum(['blocker', 'critical', 'high', 'medium', 'low', 'info']);

const CustomSourceSchema = z.object({
  pattern: z.string().min(1, { message: 'pattern must not be empty' }),
}).strict();

const CustomSinkSchema = z.object({
  pattern: z.string().min(1, { message: 'pattern must not be empty' }),
  type: z.enum(['call', 'constructor', 'property']).default('call'),
  cwe: CweStringSchema,
  severity: SeverityEnum.default('high'),
  category: z.string().optional(),
}).strict();

const CustomSanitizerSchema = z.object({
  pattern: z.string().min(1, { message: 'pattern must not be empty' }),
  cwes: z.array(CweStringSchema).min(1, { message: 'sanitizer must neutralize at least one CWE' }),
}).strict();

const SuppressionEntrySchema = z.object({
  file: z.string().min(1, { message: 'file glob must not be empty' }),
  rule: z.string().optional(),
  reason: z.string().min(10, { message: 'reason must be at least 10 characters so future readers understand WHY' }),
}).strict();

const SuppressionOptionsSchema = z.object({
  warnUnused: z.boolean().default(true),
  warnNaked: z.boolean().default(true),
}).strict();

const ConfigFileSchema = z.object({
  // v0.9 polish: optional human-friendly documentation fields. JSON
  // doesn't support comments, and strict-schema previously rejected the
  // usual `$comment` / `$description` escape hatches — users had no
  // way to annotate their config for future readers. These two
  // optional fields are NOP in the scanner but accepted by validation.
  description: z.string().optional(),
  $schema: z.string().optional(),
  stack: z.object({
    framework: z.string().optional(),
    database: z.string().optional(),
    auth: z.string().optional(),
    ai: z.string().optional(),
    payment: z.string().optional(),
    deploy: z.string().optional(),
    language: z.string().optional(),
    hasI18n: z.boolean().optional(),
    hasTests: z.boolean().optional(),
  }).optional(),
  locale: z.string().optional(),
  compliance: z.array(z.string()).optional(),
  scanners: z.record(z.record(z.unknown())).optional(),
  rules: z.record(z.string()).optional(),
  ignore: z.array(z.string()).optional(),
  target: z.string().optional(),
  customSources: z.array(CustomSourceSchema).optional(),
  customSinks: z.array(CustomSinkSchema).optional(),
  customSanitizers: z.array(CustomSanitizerSchema).optional(),
  suppressions: z.array(SuppressionEntrySchema).optional(),
  suppressionOptions: SuppressionOptionsSchema.optional(),
  allowOverrides: z.boolean().optional(),
}).strict();

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.vercel',
  '.cache',
  'out',
  '.output',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'vendor',
  'target',
  '.gradle',
  '.idea',
  '.vscode',
  '.auto-claude',
  '.claude',
  '.cursor',
  '.windsurf',
  '.codex',
  '.aider',
  // Test + benchmark fixtures (v0.7.1): scanning these is almost always
  // noise — they contain intentionally-vulnerable code OR mocked data.
  // Users who DO want to scan their tests can override via
  // aegis.config.json `ignore` (unions with this list) or explicitly
  // include paths on the CLI.
  '__tests__',
  '__test__',
  'test',
  'tests',
  '__mocks__',
  '__fixtures__',
  'fixtures',
  'benchmark',
  'benchmarks',
  // Vendored / public assets (v0.9.5 corpus finding): scanning public/ dirs
  // produces massive FP noise from minified third-party bundles (Monaco Editor,
  // vendor scripts, etc.) that the project doesn't own or control.
  'public',
  'static',
  'assets',
];

/**
 * Shape of a user-provided config file (aegis.config.json).
 * `projectPath` and `mode` are always set by CLI args, never from the file.
 */
export type ConfigFileShape = Partial<Omit<AegisConfig, 'projectPath' | 'mode'>>;

/**
 * Attempt to load aegis.config.json from the project directory.
 * Only JSON config is supported — JS config files are not loaded to avoid
 * arbitrary code execution.
 */
async function loadConfigFile(projectPath: string): Promise<ConfigFileShape | null> {
  const jsonPath = path.join(projectPath, 'aegis.config.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const result = ConfigFileSchema.safeParse(parsed);
      if (result.success) {
        return result.data as ConfigFileShape;
      }
      // Validation failed — escalate to console.error so it doesn't get lost in
      // CI output noise. The whole config is discarded and auto-detection runs
      // (the safer default — better than applying a partial config).
      const details = result.error.issues
        .map((i) => `  - ${i.path.length > 0 ? i.path.join('.') : '<root>'}: ${i.message}`)
        .join('\n');
      console.error(
        `[aegis] CONFIG REJECTED — ${jsonPath} failed validation.\n` +
          `Custom rules, suppressions, and all other fields WILL NOT BE APPLIED.\n` +
          `Issues:\n${details}\n` +
          `Fix the config file and re-run. Falling back to auto-detection.`,
      );
      return null;
    } catch (err) {
      // Malformed JSON — also escalate (same problem: user thinks config is applied but isn't)
      console.error(
        `[aegis] CONFIG REJECTED — ${jsonPath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}.\n` +
          `Falling back to auto-detection.`,
      );
    }
  }

  return null;
}

export async function loadConfig(
  projectPath: string,
  mode: AegisConfig['mode'] = 'scan',
): Promise<AegisConfig> {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const stack = detectStack(projectPath);

  const config: AegisConfig = {
    projectPath,
    stack,
    mode,
    ignore: [...DEFAULT_IGNORE],
  };

  // Load and merge user config file (values override auto-detected)
  const fileConfig = await loadConfigFile(projectPath);
  if (fileConfig) {
    if (fileConfig.stack) {
      config.stack = { ...stack, ...fileConfig.stack } as DetectedStack;
    }
    if (fileConfig.locale !== undefined) {
      config.locale = fileConfig.locale;
    }
    if (fileConfig.compliance !== undefined) {
      config.compliance = fileConfig.compliance;
    }
    if (fileConfig.scanners !== undefined) {
      config.scanners = fileConfig.scanners;
    }
    if (fileConfig.rules !== undefined) {
      config.rules = fileConfig.rules;
    }
    if (fileConfig.ignore !== undefined) {
      // Merge with defaults — never lose node_modules/.git protection
      config.ignore = [...new Set([...DEFAULT_IGNORE, ...fileConfig.ignore])];
    }
    if (fileConfig.target !== undefined) {
      config.target = fileConfig.target;
    }
    if (fileConfig.customSources !== undefined) {
      config.customSources = fileConfig.customSources;
    }
    if (fileConfig.customSinks !== undefined) {
      config.customSinks = fileConfig.customSinks;
    }
    if (fileConfig.customSanitizers !== undefined) {
      config.customSanitizers = fileConfig.customSanitizers;
    }
    if (fileConfig.suppressions !== undefined) {
      config.suppressions = fileConfig.suppressions;
    }
    if (fileConfig.suppressionOptions !== undefined) {
      config.suppressionOptions = fileConfig.suppressionOptions;
    }
    if (fileConfig.allowOverrides !== undefined) {
      config.allowOverrides = fileConfig.allowOverrides;
    }
  }

  return config;
}
