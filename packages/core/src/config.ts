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

/**
 * v0.15: structured config for the supply-chain scanner.
 *
 * `criticalDeps` lists package names whose installed version MUST be
 * exact-pinned (no `^`, `~`, range comparators, or `"latest"`). When
 * a listed package appears in `package.json` with a non-exact version,
 * the supply-chain scanner emits a HIGH-severity finding tagged
 * CWE-494 (Download of Code Without Integrity Check). Rationale: an
 * unpinned critical dep can resolve to a future upstream publish —
 * including one pushed by a compromised publish-token — without
 * triggering any in-repo review step.
 *
 * A distinct CWE (494) is used instead of CWE-829 (shared with the
 * existing wildcard-version check) so canary-RED-baselines can
 * discriminate between the two checks pre- vs post-impl.
 *
 * Empty-string entries are rejected at schema-parse time because a
 * typo silently disabling an intended pin would defeat the purpose.
 */
const SupplyChainScannerConfigSchema = z.object({
  criticalDeps: z
    .array(
      z.string().min(1, {
        message: 'criticalDeps entries must be non-empty package names',
      }),
    )
    .optional(),
}).strict();

/**
 * v0.15.4 D-C-002: tenant-isolation-checker heuristic-config for
 * public-route-with-path-param-as-tenant-discriminant detection.
 *
 * `publicRoutePrefixes` lists file-path segments that mark a route as
 * "public-by-architecture" (e.g. `/api/public/`). Default: `['/api/public/']`.
 * When the scanner sees service-role-use inside a file whose path
 * contains any listed prefix AND a bracket-segment with a name in
 * `tenantDiscriminantParams`, the emission is downgraded from
 * CRITICAL to INFO with a context-note prompting operator-review of
 * the downstream `.eq()` scope-filter.
 *
 * `tenantDiscriminantParams` lists bracket-segment inner-names
 * recognized as architectural tenant-discriminants (e.g. `[slug]`,
 * `[tenant]`). Default: `['slug', 'tenant', 'workspace', 'org',
 * 'handle']`. Conservative-start — projects that use other
 * discriminant names (e.g. `[tenantSlug]`, `[restaurantId]`) can
 * extend via this field.
 *
 * Heuristic is path-pattern-only — it does NOT verify that the
 * downstream `.eq('slug', slug)` scope-filter is actually present.
 * That verification requires AST-taint extension deferred to
 * v0.15.5+.
 */
const TenantIsolationScannerConfigSchema = z.object({
  publicRoutePrefixes: z
    .array(
      z.string().min(1, {
        message: 'publicRoutePrefixes entries must be non-empty path-segments',
      }),
    )
    .optional(),
  tenantDiscriminantParams: z
    .array(
      z.string().min(1, {
        message: 'tenantDiscriminantParams entries must be non-empty param-names',
      }),
    )
    .optional(),
}).strict();

/**
 * v0.15: structured scanner-configs. Known-scanner keys get strict
 * validation — typos in sub-keys surface as ZodError rather than
 * silent no-ops. Unknown scanner keys pass through unstructured for
 * backward-compat with v0.14 scanner-configs that haven't been
 * migrated yet (tenantIsolation [superseded by structured schema
 * in v0.15.4], authEnforcer, csrf, etc.).
 */
const ScannersConfigSchema = z
  .object({
    supplyChain: SupplyChainScannerConfigSchema.optional(),
    tenantIsolation: TenantIsolationScannerConfigSchema.optional(),
  })
  .catchall(z.record(z.unknown()));

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
  scanners: ScannersConfigSchema.optional(),
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
  // Vendored / public assets (v0.9.5 corpus finding, v0.10 Z9 refined):
  // scanning the project-root `public/` dir produces massive FP noise
  // from minified third-party bundles (Monaco Editor, vendor scripts,
  // etc.) that the project doesn't own. Leading slash (`/public`)
  // encodes "root-only" per walkFiles — legitimate nested dirs like
  // `app/api/public/` or `src/components/assets/` are NOT skipped.
  '/public',
  '/static',
  '/assets',
  // Vendor-template / third-party / minified (v0.15.4 D-C-001, Round-4):
  // walkFiles picomatch-glob-support (v0.15.4) lets these patterns match
  // across nested depths and file-extensions. `Templates*` is capital-T
  // case-sensitive on purpose — lowercase `templates/` is legit-source
  // in many projects (email / handlebars). `third_party` / `third-party`
  // are standard vendor-dir conventions (Google-style + Bazel-class).
  // `**/*.min.js` / `**/*.min.css` catch minified bundles at any depth.
  'Templates*',
  'third_party',
  'third-party',
  '**/*.min.js',
  '**/*.min.css',
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
