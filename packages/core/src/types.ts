export type Severity = 'blocker' | 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ScanCategory =
  | 'security' | 'dast' | 'dependencies' | 'compliance' | 'quality'
  | 'accessibility' | 'performance' | 'infrastructure' | 'i18n' | 'ai-llm' | 'runtime'
  | 'attack';

/**
 * Structured fix-guidance for a finding.
 * Introduced in v0.15.2 as the canonical shape. The Finding.fix field
 * remains a union with `string` through v0.15.x for backward-compat with
 * existing scanners that emit plain-text fix strings; the string arm is
 * deprecated and will be dropped in v0.16 (intentional breaking change
 * — see CHANGELOG v0.15.2 fix-field union-transition notice).
 */
export interface FixGuidance {
  /** Short actionable remediation sentence (2-3 sentences max). */
  description: string;
  /** Optional code snippet illustrating the fix. */
  code?: string;
  /** Optional external reference URLs (docs, CWE, RFC, vendor advisories). */
  links?: string[];
}

export interface Finding {
  id: string;
  scanner: string;
  category: ScanCategory;
  severity: Severity;
  title: string;
  description: string;
  /**
   * File path the finding is anchored to. v0.15.2 widens the type from
   * `string | undefined` to `string | null | undefined` — scanners that
   * emit a project-level finding SHOULD set `file: null` explicitly so
   * reporters can render the `(project-level)` location placeholder
   * rather than silently omit the key. Reporters treat `undefined` and
   * `null` identically for render purposes; the JSON reporter also
   * normalizes any under-scanRoot absolute path to a relative one via
   * node path.relative semantics, falling back to process.cwd() when
   * AuditResult.scanRoot is not set.
   */
  file?: string | null;
  line?: number;
  column?: number;
  /**
   * Remediation guidance. `string` = legacy plain-text (pre-v0.15.2),
   * `FixGuidance` = canonical structured form (v0.15.2+). Union retained
   * through v0.15.x; string arm deprecated in v0.16.
   */
  fix?: string | FixGuidance;
  owasp?: string;
  cwe?: number;
  reference?: string;
  /**
   * True when the finding is about the file AS A WHOLE, not a specific line
   * (e.g., "this route file lacks an auth guard", "this config lacks a CSP").
   * Scanners that emit such findings conventionally set `line: 1`, but the
   * precision-CLI fingerprint must not depend on source context near line 1 —
   * that context shifts when unrelated edits are made above.
   *
   * Set this to `true` on file-level emit sites. The precision CLI uses it to
   * short-circuit context-window hashing in favor of a stable
   * `scanner|file|title` identity that survives arbitrary line-drift.
   *
   * Optional (backward-compat). Undefined / false means "per-line finding" —
   * the default behavior remains unchanged.
   */
  fileLevel?: boolean;
  /**
   * v0.7 Phase 2: true when the finding spans a cross-module call — the
   * sink was reached via a summary of an exported function declared in a
   * different file from the one containing the taint source. Consumers
   * (SARIF reporter, precision CLI) treat this as a signal to emit
   * `relatedLocations` pointing at {@link crossFileOrigin}.
   */
  crossFile?: boolean;
  /**
   * v0.7 Phase 2: absolute path of the file declaring the cross-file
   * function that triggered the finding. Present only when `crossFile:
   * true`. The SARIF reporter emits this as a `relatedLocations` entry
   * so GitHub Code Scanning, Azure DevOps, and other SARIF consumers can
   * jump to the cross-module origin of the vulnerability.
   */
  crossFileOrigin?: string;
  /**
   * v0.7 Phase 5 calibration lever: per-finding confidence tier,
   * distinct from the scan-level `AuditResult.confidence`. Scanners
   * opt in when a finding class has measurement uncertainty that isn't
   * captured by severity alone. Cross-file findings in v0.7 set
   * `confidence: 'medium'` pending the n≥20 dogfood measurement that
   * v0.8 targets — the sample size in the v0.7 pre-tag dogfood (n=2)
   * was below the plan §3 TBD-3 threshold, so the FP-rate zone is
   * unmeasurable, not failed. Default (undefined / absent) continues
   * to mean "scanner's default confidence tier (typically high)".
   */
  confidence?: Confidence;
}

export interface ScanResult {
  scanner: string;
  category: ScanCategory;
  findings: Finding[];
  score?: number;
  duration: number;
  available: boolean;
  error?: string;
}

export interface Scanner {
  name: string;
  description: string;
  category: ScanCategory;
  /**
   * v0.15.4 D-N-003 — external-wrapper classification. When true, the
   * scanner wraps a third-party CLI binary (Semgrep, Gitleaks, Trivy,
   * …); its isAvailable check reflects binary-presence on PATH, and a
   * false return feeds the cold-install-UX banner at
   * packages/cli/src/commands/scan.ts. When false or undefined, the
   * scanner is internal (built-in regex / AST) — its isAvailable=false
   * means stack-gated skip, and the banner must NOT attribute the
   * skip to a missing install.
   */
  isExternal?: boolean;
  isAvailable(projectPath: string): Promise<boolean>;
  scan(projectPath: string, config: AegisConfig): Promise<ScanResult>;
}

export interface DetectedStack {
  framework: 'nextjs' | 'react' | 'vue' | 'svelte' | 'nuxt' | 'astro' | 'remix' | 'express' | 'fastify' | 'django' | 'flask' | 'rails' | 'laravel' | 'spring' | 'go' | 'rust' | 'unknown';
  database: 'supabase' | 'firebase' | 'prisma' | 'drizzle' | 'mongoose' | 'raw-pg' | 'none' | 'unknown';
  auth: 'supabase-auth' | 'next-auth' | 'clerk' | 'lucia' | 'passport' | 'none' | 'unknown';
  ai: 'openai' | 'anthropic' | 'mistral' | 'ollama' | 'none' | 'unknown';
  payment: 'stripe' | 'none' | 'unknown';
  deploy: 'vercel' | 'docker' | 'railway' | 'fly' | 'netlify' | 'none' | 'unknown';
  language: 'typescript' | 'javascript' | 'python' | 'ruby' | 'go' | 'rust' | 'php' | 'java' | 'unknown';
  hasI18n: boolean;
  hasTests: boolean;
}

/**
 * User-defined taint source (extends built-in TAINT_SOURCES).
 * Pattern is the exact expression prefix — e.g., `internalCtx.userInput`.
 */
export interface CustomSource {
  pattern: string;
}

/**
 * User-defined sink.
 * `type` selects which sink registry to extend (call / constructor / property).
 * `cwe` is required — without it the scanner cannot report a meaningful finding.
 */
export interface CustomSink {
  pattern: string;
  type?: 'call' | 'constructor' | 'property';
  cwe: string;
  severity?: Severity;
  category?: string;
}

/**
 * User-defined sanitizer — neutralizes taint for the listed CWEs.
 * If `cwes` is empty, the sanitizer is treated as blocking ALL taint classes.
 */
export interface CustomSanitizer {
  pattern: string;
  cwes: string[];
}

/**
 * Config-level suppression — glob-matched file filter.
 * Applies before inline `// aegis-ignore` runs, so this is the coarser layer.
 */
export interface SuppressionEntry {
  /** Glob pattern, relative to projectPath (e.g., `src/legacy/**`). */
  file: string;
  /** Optional CWE (`CWE-918`) or scanner-id (`taint-analyzer`) filter. */
  rule?: string;
  /** Required — why this suppression exists. */
  reason: string;
}

/**
 * Options for the inline suppression diagnostic layer.
 * Controls whether unused/naked suppressions warn on stderr.
 */
export interface SuppressionOptions {
  /** Default true — log a warning for each suppression that never matched. */
  warnUnused?: boolean;
  /** Default true — log a warning for suppressions without a reason. */
  warnNaked?: boolean;
}

export interface AegisConfig {
  projectPath: string;
  stack: DetectedStack;
  locale?: string;
  compliance?: string[];
  scanners?: Record<string, Record<string, unknown>>;
  rules?: Record<string, Severity>;
  ignore?: string[];
  target?: string;
  mode: 'scan' | 'audit' | 'pentest' | 'siege' | 'fortress';
  /** When set, only report findings for files in this list (diff mode). Absolute paths. */
  diffFiles?: string[];
  /** User-defined taint sources extending built-in TAINT_SOURCES. */
  customSources?: CustomSource[];
  /** User-defined sinks extending built-in TAINT_SINKS/CONSTRUCTOR_SINKS/PROPERTY_SINKS. */
  customSinks?: CustomSink[];
  /** User-defined sanitizers extending built-in TAINT_SANITIZER_DEFS. */
  customSanitizers?: CustomSanitizer[];
  /** Config-level file/rule suppressions (coarse layer; complements inline `// aegis-ignore`). */
  suppressions?: SuppressionEntry[];
  /** Controls stderr diagnostic output for inline suppressions. */
  suppressionOptions?: SuppressionOptions;
  /** Opt-in override of built-in security defaults (e.g., PARSE_NOT_SANITIZER). Default false. */
  allowOverrides?: boolean;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type Badge = 'FORTRESS' | 'HARDENED' | 'SOLID' | 'NEEDS_WORK' | 'AT_RISK' | 'CRITICAL';
export type Confidence = 'low' | 'medium' | 'high';

export interface AuditResult {
  score: number;
  grade: Grade;
  badge: Badge;
  blocked: boolean;
  blockerReason?: string;
  breakdown: Record<ScanCategory, { score: number; maxScore: number; findings: number }>;
  findings: Finding[];
  scanResults: ScanResult[];
  stack: DetectedStack;
  duration: number;
  timestamp: string;
  confidence: Confidence;
  /**
   * Absolute path of the scan-root. v0.15.2 Item-4 surfaces this on the
   * result object so reporters can produce consumer-stable relative file
   * paths via `path.relative(scanRoot, finding.file)` rather than
   * leaking caller-absolute paths that break PR-comment dedup across CI
   * runners with different checkout locations. Optional for backward
   * compatibility — reporters fall back to `process.cwd()` when not set.
   */
  scanRoot?: string;
}

export interface Reporter {
  name: string;
  format(result: AuditResult): string;
}
